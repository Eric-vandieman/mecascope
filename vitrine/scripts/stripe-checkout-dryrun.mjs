const key=process.env.STRIPE_SECRET_KEY||'';
if(!/^(sk|rk)_live_/.test(key))throw Error('Clé Stripe LIVE absente');
const post=async(path,body)=>{
 const r=await fetch('https://api.stripe.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:AbortSignal.timeout(15000)});
 const j=await r.json();if(!r.ok)throw Error('Stripe HTTP '+r.status+' '+String(j.error?.code||j.error?.message||'unknown').slice(0,100));return j;
};
let failed=0;
for(const [label,price,mode] of [['unitaire',process.env.STRIPE_PRICE_CIBLEE_INITIAL,'payment'],['pro5',process.env.STRIPE_PRICE_PRO5,'subscription']]){
 let session;
 try{
  const f=new URLSearchParams({mode,success_url:'https://xn--mcascope-b1a.fr/',cancel_url:'https://xn--mcascope-b1a.fr/'});
  f.set('line_items[0][price]',price);f.set('line_items[0][quantity]','1');
  f.set('metadata[dry_run]','mecascope_checkout_no_charge');
  session=await post('checkout/sessions',f);
  if(!session.livemode||session.mode!==mode||!session.id?.startsWith('cs_live_'))throw Error('Session incorrecte');
  console.log('LIVE CHECKOUT CREATE PASS',label);
 }catch(e){console.error('LIVE CHECKOUT CREATE FAIL',label,String(e));failed++}
 finally{
  if(session?.id)try{
   const e=await post('checkout/sessions/'+encodeURIComponent(session.id)+'/expire',new URLSearchParams());
   if(e.status!=='expired')throw Error('Expire non confirmé');
   console.log('LIVE CHECKOUT EXPIRE PASS',label);
  }catch(e){console.error('LIVE CHECKOUT EXPIRE FAIL',label,String(e));failed++}
 }
}
console.log('NO CARD USED. NO CHARGE MADE.');if(failed)process.exitCode=1;