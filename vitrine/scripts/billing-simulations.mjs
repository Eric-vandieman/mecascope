import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import checkout from '../api/pro-checkout.mjs';
import webhook from '../api/stripe-live-webhook.mjs';
const base='https://fake.supabase.test',garage='f7816deb-84db-47cc-bd3d-50752e5fec29';
Object.assign(process.env,{
 MECASCOPE_ENABLE_LIVE_BILLING:'true', STRIPE_SECRET_KEY:'sk_live_MOCK_NOT_REAL',STRIPE_WEBHOOK_SECRET:'whsec_mock_only',
 SUPABASE_SERVICE_ROLE_KEY:'sb_secret_mock_only',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock_only',
 SUPABASE_URL:base,STRIPE_PRICE_PRIORITE:'price_priorite_mock',STRIPE_PRICE_PRO5:'price_pro5_mock',
 STRIPE_PRICE_PRO10:'price_pro10_mock'
});
let credits=0,invoiceSet=new Set(),calls=[],subscriptionId='sub_mock_123456789';
const subscription={id:subscriptionId,livemode:true,status:'active',customer:'cus_mock_123456789',
 metadata:{service:'mecascope',plan:'pro5',garage_id:garage},
 items:{data:[{price:{id:'price_pro5_mock'}}]}};
const respond=(obj,status=200)=>({ok:status<400,status,async json(){return obj}});
const oldFetch=globalThis.fetch;
globalThis.fetch=async(url,opts={})=>{
 const uri=String(url);calls.push({url:uri,method:opts.method||'GET'});
 if(uri.includes('/v1/prices/'))return respond({id:'price_pro5_mock',livemode:true,active:true,unit_amount:34900,recurring:{interval:'month'}});
 if(uri.endsWith('/v1/subscriptions?limit=1'))return respond({data:[]});
 if(uri.includes('/subscriptions/'+subscriptionId))return respond(subscription);
 if(uri.includes('/auth/v1/user'))return respond({email:'test@example.com',email_confirmed_at:'2026-11-25',user_metadata:{profil:'professionnel'}});
 if(uri.endsWith('/rpc/meca_tableau_bord'))return respond({role:'owner',garage:{id:garage,verified:true}});
 if(uri.includes('/rest/v1/meca_stripe_abonnements?garage_id='))return respond([]);
 if(uri.includes('/rest/v1/meca_stripe_abonnements?select='))return respond([]);
 if(uri.endsWith('/rpc/meca_stripe_lier_abonnement'))return respond(null);
 if(uri.endsWith('/rpc/meca_stripe_crediter_facture')){
  const b=JSON.parse(opts.body);if(!invoiceSet.has(b.p_invoice)){invoiceSet.add(b.p_invoice);credits+=10}return respond(credits);
 }
 if(uri.includes('/checkout/sessions')){
  const p=new URLSearchParams(opts.body);assert.equal(p.get('subscription_data[metadata][service]'),'mecascope');
  assert.equal(p.get('line_items[0][price]'),'price_pro5_mock');
  return respond({mode:'subscription',url:'https://checkout.stripe.com/c/pay/mock'});
 }
 throw Error('unexpected '+uri);
};
function res(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(code){this.statusCode=code;return this},json(body){this.body=body;return this},end(){return this}}}
async function checkoutRun(body={},cookie=''){const output=res();await checkout({method:'POST',headers:{origin:'https://xn--mcascope-b1a.fr',host:'xn--mcascope-b1a.fr',cookie},body},output);return output}
function event(type,obj,livemode=true){return Buffer.from(JSON.stringify({id:'evt_mock_123456',type,livemode,data:{object:obj}}))}
async function send(buf,valid=true){const t=Math.floor(Date.now()/1000),sig=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(t+'.').update(buf).digest('hex');const output=res();await webhook({method:'POST',headers:{'stripe-signature':valid?'t='+t+',v1='+sig:'t='+t+',v1='+('0'.repeat(64))},rawBody:buf},output);return output}
const tests=[];
function check(title,condition){assert.ok(condition,title);tests.push('PASS '+title)}
try{
 let r=await checkoutRun({plan:'pro5'});check('checkout: authentification obligatoire',r.statusCode===401);
 r=await checkoutRun({plan:'pro5'},'__Host-mecascope-professional=mock_session');check('checkout: URL Stripe créée sans facture',r.statusCode===200&&r.body.checkoutUrl.includes('checkout.stripe.com'));
 r=await send(event('checkout.session.completed',{mode:'subscription',subscription:subscriptionId}));
 check('webhook: rattachement après checkout',r.statusCode===200&&credits===0);
 r=await send(event('invoice.paid',{id:'in_mock_1',status:'paid',amount_paid:34900,parent:{subscription_details:{subscription:subscriptionId}}}));
 check('webhook: facture payée crédite 10',r.statusCode===200&&credits===10);
 r=await send(event('invoice.paid',{id:'in_mock_1',status:'paid',amount_paid:34900,parent:{subscription_details:{subscription:subscriptionId}}}));
 check('webhook: rediffusion n\'ajoute pas de crédits',r.statusCode===200&&credits===10);
 r=await send(event('invoice.paid',{id:'in_mock_2',status:'paid',amount_paid:34900,parent:{subscription_details:{subscription:subscriptionId}}}));
 check('webhook: nouvelle période crédite 10',r.statusCode===200&&credits===20);
 r=await send(event('invoice.paid',{id:'in_fake',status:'paid',amount_paid:34900,parent:{subscription_details:{subscription:subscriptionId}}}),false);
 check('webhook: signature invalide rejetée',r.statusCode===400&&credits===20);
 r=await send(event('invoice.paid',{id:'in_test',status:'paid',amount_paid:34900,parent:{subscription_details:{subscription:subscriptionId}}},false));
 check('webhook: test mode rejeté par endpoint LIVE',r.statusCode===400&&credits===20);
 subscription.metadata.service='doclia';
 r=await send(event('invoice.paid',{id:'in_doclia',status:'paid',amount_paid:34900,parent:{subscription_details:{subscription:subscriptionId}}}));
 check('webhook: autres applications ignorées',r.statusCode===200&&credits===20);
 console.log('MECASCOPE BILLING SIMULATION:',tests.join(' | '));console.log('RESULT',tests.length,'of',tests.length,'passed');
}catch(error){console.error('SIMULATION FAILED:',String(error.stack||error));process.exitCode=1}
finally{globalThis.fetch=oldFetch}
