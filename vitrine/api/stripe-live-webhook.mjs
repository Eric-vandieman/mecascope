import {createHmac,timingSafeEqual} from 'node:crypto';
// Intégration préparée : ne fonctionne qu'après configuration secrets LIVE + migration SQL.
export const config={api:{bodyParser:false}};
async function rawBody(req){
 if(Buffer.isBuffer(req.rawBody))return req.rawBody;
 if(typeof req.rawBody==='string')return Buffer.from(req.rawBody);
 if(Buffer.isBuffer(req.body))return req.body;
 // Ne jamais re-sérialiser un JSON déjà analysé pour la signature Stripe.
 if(req.body&&typeof req.body==='object')throw Error('Corps brut indisponible');
 const chunks=[];
 for await(const chunk of req){chunks.push(Buffer.from(chunk));if(chunks.reduce((sum,c)=>sum+c.length,0)>1024*1024)throw Error('Payload trop volumineux')}
 return Buffer.concat(chunks);
}
function signed(buf,signature,secret){
 const chunks=String(signature||'').split(',').map(x=>x.split('='));
 const stamp=chunks.find(([k])=>k==='t')?.[1];
 if(!stamp||!/^[0-9]+$/.test(stamp)||Math.abs(Date.now()/1000-Number(stamp))>300)return false;
 const expected=createHmac('sha256',secret).update(stamp+'.').update(buf).digest();
 return chunks.some(([kind,value])=>{
  if(kind!=='v1'||!value||!/^[a-f0-9]{64}$/.test(value))return false;
  return timingSafeEqual(expected,Buffer.from(value,'hex'));
 });
}
const plans={priorite:['STRIPE_PRICE_PRIORITE',0],pro5:['STRIPE_PRICE_PRO5',10],pro10:['STRIPE_PRICE_PRO10',20]};
const id=x=>typeof x==='string'?x:x?.id||'';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 const secret=process.env.STRIPE_WEBHOOK_SECRET,key=process.env.STRIPE_SECRET_KEY;
 const url=process.env.SUPABASE_URL,admin=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(process.env.MECASCOPE_ENABLE_LIVE_BILLING!=='true'||!secret||!(/^((sk|rk)_live_)/).test(key||'')||!url||!admin)
  return res.status(503).json({message:'Facturation non activée'});
 let event;
 try{
  const bytes=await rawBody(req);
  if(!signed(bytes,req.headers['stripe-signature'],secret))return res.status(400).json({message:'Signature invalide'});
  event=JSON.parse(bytes.toString('utf8'));
 }catch{return res.status(400).json({message:'Evénement Stripe invalide'})}
 if(event.livemode!==true)return res.status(400).json({message:'Environnement incorrect'});
 const o=event.data?.object||{};
 if(!['invoice.paid','checkout.session.completed','customer.subscription.deleted'].includes(event.type))return res.status(200).json({ignored:true});
 async function stripe(path){
  const r=await fetch('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Erreur de validation Stripe');
  return r.json();
 }
 async function rpc(functionName,body){
  const r=await fetch(url+'/rest/v1/rpc/'+functionName,{
   method:'POST',headers:{apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{}),'Content-Type':'application/json'},
   body:JSON.stringify(body),signal:AbortSignal.timeout(12000)
  });
  if(!r.ok)throw Error('Base des crédits non raccordée');
  return r.json().catch(()=>null);
 }
 try{
  if(event.type==='customer.subscription.deleted'){
   if(o.metadata?.service!=='mecascope')return res.status(200).json({ignored:true});
   await rpc('meca_stripe_statut_abonnement',{p_subscription:o.id,p_statut:'resilie'});
   return res.status(200).json({received:true});
  }
  let subscriptionId='';
  if(event.type==='checkout.session.completed'){
   if(o.mode!=='subscription'||!o.subscription)return res.status(200).json({ignored:true});
   subscriptionId=id(o.subscription);
  }else if(event.type==='invoice.paid'){
   if(o.status!=='paid'||o.amount_paid===undefined)return res.status(400).json({message:'Facture non réglée'});
   subscriptionId=id(o.parent?.subscription_details?.subscription||o.subscription);
  }
  if(!subscriptionId)return res.status(200).json({ignored:true});
  const s=await stripe('subscriptions/'+encodeURIComponent(subscriptionId));
  if(!s.livemode||s.id!==subscriptionId||!s.customer)throw Error('Abonnement non vérifié');
  // Ce compte Stripe est partagé avec d'autres produits de l'entreprise.
  // Les événements des autres applications ne doivent jamais créer de crédit Mécascope.
  if(s.metadata?.service!=='mecascope')return res.status(200).json({ignored:true});
  const garage=id(s.metadata?.garage_id),plan=s.metadata?.plan;
  if(!/^[a-f0-9-]{36}$/i.test(garage)||!Object.hasOwn(plans,plan))throw Error('Garage ou formule absent');
  const [envKey,credits]=plans[plan],expectedPrice=process.env[envKey];
  if(!expectedPrice||!s.items?.data?.some(item=>id(item.price)===expectedPrice))throw Error('Prix Stripe non reconnu');
  if(!['active','past_due','trialing'].includes(s.status))throw Error('Abonnement non actif');
  await rpc('meca_stripe_lier_abonnement',{
   p_garage:garage,p_subscription:subscriptionId,p_customer:id(s.customer),
   p_plan:plan,p_price:expectedPrice,p_credits:credits
  });
  if(event.type==='invoice.paid'){
   if(!String(o.id||'').startsWith('in_'))throw Error('Facture invalide');
   await rpc('meca_stripe_crediter_facture',{p_subscription:subscriptionId,p_invoice:o.id});
  }
  return res.status(200).json({received:true});
 }catch{
  // Stripe réessaiera cet événement plutôt que de valider un paiement sans crédits.
  return res.status(500).json({message:'Synchronisation non finalisée'});
 }
}
