// Abonnements professionnels : la facturation reste désactivée tant que
// Stripe LIVE, les prix, le webhook et le registre des crédits ne sont pas raccordés.
const COOKIE='__Host-mecascope-professional';
const getCookie=h=>{const value=String(h||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));if(!value)return '';try{return decodeURIComponent(value.slice(COOKIE.length+1))}catch{return ''}};
const plans={priorite:['STRIPE_PRICE_PRIORITE',0],pro5:['STRIPE_PRICE_PRO5',10],pro10:['STRIPE_PRICE_PRO10',20]};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const configured=process.env.MECASCOPE_ENABLE_LIVE_BILLING==='true'&&
  (/^((sk|rk)_live_)/).test(process.env.STRIPE_SECRET_KEY||'')&&
  !!process.env.STRIPE_WEBHOOK_SECRET&&!!process.env.SUPABASE_SERVICE_ROLE_KEY&&
  !!process.env.SUPABASE_URL&&!!process.env.SUPABASE_PUBLISHABLE_KEY&&
  !!process.env.STRIPE_PRICE_PRIORITE&&!!process.env.STRIPE_PRICE_PRO5&&!!process.env.STRIPE_PRICE_PRO10;
 async function liveAccess(){
  if(!configured)return false;
  try{
   const stripeHeaders={Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY};
   const dbSecret=process.env.SUPABASE_SERVICE_ROLE_KEY;
   const dbHeaders={apikey:dbSecret,...(dbSecret.startsWith('eyJ')?{Authorization:'Bearer '+dbSecret}:{})};
   const [priceCheck,subscriptionsCheck,databaseCheck]=await Promise.all([
    fetch('https://api.stripe.com/v1/prices/'+encodeURIComponent(process.env.STRIPE_PRICE_PRO5),{headers:stripeHeaders,signal:AbortSignal.timeout(7000)}),
    fetch('https://api.stripe.com/v1/subscriptions?limit=1',{headers:stripeHeaders,signal:AbortSignal.timeout(7000)}),
    fetch(process.env.SUPABASE_URL.replace(/\\/$/,'')+'/rest/v1/meca_stripe_abonnements?select=stripe_subscription_id&limit=0',{headers:dbHeaders,signal:AbortSignal.timeout(7000)})
   ]);
   if(!priceCheck.ok||!subscriptionsCheck.ok||!databaseCheck.ok)return false;
   const p=await priceCheck.json();
   return p.active===true&&p.livemode===true&&p.unit_amount===34900&&p.recurring?.interval==='month';
  }catch{return false}
 }
 if(req.method==='GET')return res.status(200).json({available:await liveAccess()});
 if(req.method!=='POST')return res.status(405).json({message:'Méthode non autorisée'});
 if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({message:'Origine non autorisée'});
 const plan=String(req.body?.plan||'');
 if(!Object.hasOwn(plans,plan))return res.status(400).json({message:'Formule invalide'});
 const stripeKey=process.env.STRIPE_SECRET_KEY;
 const price=process.env[plans[plan][0]];
 if(!configured||!price||!(await liveAccess())){
  return res.status(503).json({message:'La souscription en ligne n’est pas encore activée. Aucun paiement ne sera engagé.'});
 }
 const cookie=getCookie(req.headers.cookie);
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!cookie||!url||!key)return res.status(401).json({message:'Connectez-vous au compte responsable du garage.'});
 const headers={apikey:key,Authorization:'Bearer '+cookie,'Content-Type':'application/json'};
 try{
  const [identity,profile]=await Promise.all([
   fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)}),
   fetch(url+'/rest/v1/rpc/meca_tableau_bord',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)})
  ]);
  if(!identity.ok||!profile.ok)return res.status(403).json({message:'Compte professionnel non validé.'});
  const user=await identity.json(),data=await profile.json();
  if(!user.email_confirmed_at||user.user_metadata?.profil!=='professionnel'||data.role!=='owner'||!data.garage?.id)
    return res.status(403).json({message:'Souscription réservée au titulaire d’un établissement professionnel validé.'});
  // Ne pas permettre le paiement tant que l'entreprise n'a pas été approuvée.
  // Ce champ doit être ajouté dans le parcours de vérification administrative.
  if(data.garage.verified!==true)return res.status(403).json({message:'Le SIRET de votre établissement doit être validé avant la souscription.'});
  const form=new URLSearchParams();
  form.set('mode','subscription');form.set('line_items[0][price]',price);form.set('line_items[0][quantity]','1');
  form.set('client_reference_id',data.garage.id);
  form.set('customer_email',user.email);
  form.set('metadata[garage_id]',data.garage.id);form.set('metadata[plan]',plan);form.set('metadata[service]','mecascope');
  form.set('subscription_data[metadata][garage_id]',data.garage.id);
  form.set('subscription_data[metadata][plan]',plan);
  form.set('subscription_data[metadata][service]','mecascope');
  form.set('success_url','https://xn--mcascope-b1a.fr/espace-pro.html?paiement=retour&session_id={CHECKOUT_SESSION_ID}');
  form.set('cancel_url','https://xn--mcascope-b1a.fr/abonnement.html?plan='+encodeURIComponent(plan)+'&paiement=annule');
  const request=await fetch('https://api.stripe.com/v1/checkout/sessions',{
   method:'POST',headers:{Authorization:'Bearer '+stripeKey,'Content-Type':'application/x-www-form-urlencoded'},
   body:form.toString(),signal:AbortSignal.timeout(12000)
  });
  const session=await request.json().catch(()=>({}));
  if(!request.ok||!session.url||session.mode!=='subscription')return res.status(503).json({message:'La création de la session de paiement a échoué. Aucun paiement n’a été engagé.'});
  return res.status(200).json({checkoutUrl:session.url});
 }catch{return res.status(503).json({message:'Service d’abonnement momentanément indisponible.'})}
}
