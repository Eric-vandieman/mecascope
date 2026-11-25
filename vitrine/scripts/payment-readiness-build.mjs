// Contrôle production en lecture seule, effectué à chaque build. Aucun secret n'est affiché.
const env=process.env;
const key=env.STRIPE_SECRET_KEY,db=env.SUPABASE_SERVICE_ROLE_KEY,url=env.SUPABASE_URL;
if(!/^(sk|rk)_live_/.test(key||'')||!db||!url||!env.STRIPE_PRICE_PRO5) {
 console.error('BILLING PREFLIGHT: missing required server configuration',JSON.stringify({stripe:!!key,db:!!db,url:!!url,price:!!env.STRIPE_PRICE_PRO5,production:env.VERCEL_ENV==='production',stripeLiveFormat:/^(sk|rk)_live_/.test(key||''),supabaseSecretFormat:db?.startsWith('sb_secret_')||db?.startsWith('eyJ')}));process.exitCode=1;
}else{
 try{
  const stripeHeaders={Authorization:'Bearer '+key};
  const dbHeaders={apikey:db,...(db.startsWith('eyJ')?{Authorization:'Bearer '+db}:{})};
  const [price,subs,garage]=await Promise.all([
   fetch('https://api.stripe.com/v1/prices/'+encodeURIComponent(env.STRIPE_PRICE_PRO5),{headers:stripeHeaders,signal:AbortSignal.timeout(12000)}),
   fetch('https://api.stripe.com/v1/subscriptions?limit=1',{headers:stripeHeaders,signal:AbortSignal.timeout(12000)}),
   fetch(url+'/rest/v1/meca_stripe_abonnements?select=stripe_subscription_id&limit=0',{headers:dbHeaders,signal:AbortSignal.timeout(12000)})
  ]);
  const p=price.ok?await price.json():{};
  const result={stripe_prices:price.ok&&p.active===true&&p.livemode===true&&p.unit_amount===34900,
    stripe_subscriptions_read:subs.ok,supabase_service_read:garage.ok};
  console.log('BILLING PREFLIGHT',JSON.stringify(result));
  if(Object.values(result).some(x=>!x))process.exitCode=1;
 }catch(error){console.error('BILLING PREFLIGHT network failure:',String(error?.name||'unknown'));process.exitCode=1}
}
