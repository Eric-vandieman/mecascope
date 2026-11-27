export const config={maxDuration:30};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Méthode interdite'});
 const token=String(req.headers.authorization||'').replace(/^Bearer /i,'');
 if(!token||token.length>6000)return res.status(401).json({message:'Authentification administrateur requise'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_PUBLISHABLE_KEY||!process.env.STRIPE_SECRET_KEY)
  return res.status(503).json({message:'Connecteur Stripe indisponible'});
 try{
  // Vérifie les droits sur Supabase. Une session client standard ne peut pas obtenir les montants.
  const check=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/meca_admin_reporting',{
   method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:'{}',signal:AbortSignal.timeout(8500)
  });
  if(!check.ok)return res.status(403).json({message:'Droits administrateur requis'});
  let cursor=null,total=0,month=0,previous=0,count=0,pages=0,exhaustive=false;
  const now=new Date(),monthStart=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1),priorStart=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1);
  while(pages<20){
   const params=new URLSearchParams({limit:'100',status:'paid'});
   if(cursor)params.set('starting_after',cursor);
   const resp=await fetch('https://api.stripe.com/v1/invoices?'+params.toString(),{headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY},signal:AbortSignal.timeout(12000)});
   if(!resp.ok)return res.status(502).json({message:'Stripe n’a pas confirmé les factures : '+resp.status});
   const payload=await resp.json();
   if(!Array.isArray(payload.data))return res.status(502).json({message:'Réponse Stripe invalide'});
   for(const invoice of payload.data){
    const subscriptionId=invoice.subscription||invoice.parent?.subscription_details?.subscription;
    if(!subscriptionId||!invoice.paid||!invoice.livemode||invoice.status!=='paid'||invoice.currency!=='eur')continue;
    const cents=Math.max(0,Math.round(Number(invoice.amount_paid||0)-Number(invoice.post_payment_credit_notes_amount||0)));
    const settled=(invoice.status_transitions?.paid_at||invoice.created||0)*1000;
    total+=cents;count++;
    if(settled>=monthStart)month+=cents;
    else if(settled>=priorStart)previous+=cents;
   }
   pages++;
   if(!payload.has_more){exhaustive=true;break}
   if(!payload.data.length)break;
   cursor=payload.data[payload.data.length-1].id;
  }
  if(!exhaustive)return res.status(503).json({message:'Historique Stripe partiel : total refusé pour éviter une statistique inexacte'});
  return res.status(200).json({ok:true,source:'stripe_paid_invoices',abonnements_ca_centimes:total,abonnements_ca_mois_centimes:month,abonnements_ca_precedent_centimes:previous,factures_payees:count,exact:true});
 }catch(e){return res.status(503).json({message:'Rapprochement des factures Stripe indisponible'})}
}
