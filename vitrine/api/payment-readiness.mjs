// Vérification non transactionnelle : aucune session Stripe, facture ou crédit créé.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 const secret=process.env.STRIPE_SECRET_KEY||'',supabase=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 const stripeKey=/^(sk|rk)_live_/.test(secret),dbKey=supabase.startsWith('sb_secret_')||supabase.startsWith('eyJ');
 if(!stripeKey||!dbKey||!process.env.SUPABASE_URL||!process.env.STRIPE_PRICE_PRO5)
  return res.status(200).json({ready:false,stripe:false,database:false});
 let stripe=false,database=false;
 try{
  const r=await fetch('https://api.stripe.com/v1/prices/'+encodeURIComponent(process.env.STRIPE_PRICE_PRO5),{
   headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(8000)
  });
  if(r.ok){const p=await r.json();stripe=p.active===true&&p.livemode===true&&p.unit_amount===34900&&p.recurring?.interval==='month'}
 }catch{}
 try{
  const headers={apikey:supabase,...(supabase.startsWith('eyJ')?{Authorization:'Bearer '+supabase}:{}),'Content-Type':'application/json'};
  const r=await fetch(process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/meca_stripe_abonnements?select=stripe_subscription_id&limit=0',{headers,signal:AbortSignal.timeout(8000)});
  database=r.ok;
 }catch{}
 return res.status(200).json({ready:stripe&&database,stripe,database});
}
