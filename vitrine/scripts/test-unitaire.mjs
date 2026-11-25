import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import demande from '../api/demande-piece.mjs';
import unitaire from '../api/unitaire.mjs';
import webhook from '../api/stripe-live-webhook.mjs';
const garageAdmin='fc80d0f5-3762-46af-a9f1-c49f20dc0b32';
const origin='https://xn--mcascope-b1a.fr',db='https://fake.supabase.test';
const price={ciblee:{initial:'price_ciblee_initial_mock',solde:'price_ciblee_solde_mock',sum:[1900,2000]},
 approfondie:{initial:'price_approfondie_initial_mock',solde:'price_approfondie_solde_mock',sum:[3900,4000]},
 expert:{initial:'price_expert_initial_mock',solde:'price_expert_solde_mock',sum:[6900,8000]}};
Object.assign(process.env,{
 MECASCOPE_ENABLE_LIVE_BILLING:'true',STRIPE_SECRET_KEY:'sk_live_mock',STRIPE_WEBHOOK_SECRET:'whsec_mock',
 SUPABASE_SERVICE_ROLE_KEY:'sb_secret_mock',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_mock',
 SUPABASE_URL:db,RESEND_API_KEY:'re_mock',MECASCOPE_MAIL_FROM:'Mécascope <contact@example.org>',
 STRIPE_PRICE_CIBLEE_INITIAL:price.ciblee.initial,STRIPE_PRICE_CIBLEE_SUCCESS:price.ciblee.solde,
 STRIPE_PRICE_APPROFONDIE_INITIAL:price.approfondie.initial,STRIPE_PRICE_APPROFONDIE_SUCCESS:price.approfondie.solde,
 STRIPE_PRICE_EXPERT_INITIAL:price.expert.initial,STRIPE_PRICE_EXPERT_SUCCESS:price.expert.solde,
 STRIPE_PRICE_EXPRESS_24:'price_express24_mock',STRIPE_PRICE_EXPRESS_48:'price_express48_mock',STRIPE_PRICE_RESERVATION:'price_reservation_mock'
});
const dossiers=new Map(), emails=[], sessions=new Map(),operations=new Set();
let checkoutSeq=1,checks=0;
function respond(data,status=200){return {ok:status>=200&&status<300,status,async json(){return data}}}
function asUrl(url){return new URL(String(url))}
const previous=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
 const u=asUrl(url),method=options.method||'GET',body=options.body?JSON.parseIfAvailable?.(options.body):null;
 if(u.hostname==='fake.supabase.test'&&u.pathname.includes('/rest/v1/meca_demandes_unitaires')){
  const target=u.searchParams.get('id'),hash=u.searchParams.get('jeton_hash');
  if(method==='POST'){
   const row=JSON.parse(options.body);row.id='aaaaaaaa-bbbb-4ccc-8ddd-'+String(dossiers.size+1).padStart(12,'0');
   row.offre=null;row.jeton_hash=null;row.initial_price=null;row.solde_price=null;row.initial_paid_at=null;row.solde_paid_at=null;row.initial_session=null;row.solde_session=null;
   dossiers.set(row.id,row);return respond([row]);
  }
  if(method==='GET'){
   let rows=[...dossiers.values()];
   if(target)rows=rows.filter(d=>d.id===target.slice(3));
   if(hash)rows=rows.filter(d=>d.jeton_hash===hash.slice(3));
   return respond(rows);
  }
  if(method==='PATCH'){
   const row=dossiers.get(target?.slice(3));if(!row||row.statut!==u.searchParams.get('statut')?.slice(3))return respond([]);
   Object.assign(row,JSON.parse(options.body));return respond([row]);
  }
 }
 if(u.hostname==='fake.supabase.test'&&u.pathname.includes('/rest/v1/meca_admins'))return respond([{user_id:garageAdmin}]);
 if(u.hostname==='fake.supabase.test'&&u.pathname==='/auth/v1/user')return respond({id:garageAdmin,email_confirmed_at:'2026-11-25'});
 if(u.hostname==='fake.supabase.test'&&u.pathname.includes('/rpc/meca_unitaire_confirmer_paiement')){
  const b=JSON.parse(options.body),d=dossiers.get(b.p_dossier);
  const field=b.p_etape==='initial'?'initial':'solde',k=b.p_dossier+'|'+field;
  if(operations.has(k))return respond(d.statut);
  if((field==='initial'&&d.statut!=='devis_envoye')||(field==='solde'&&d.statut!=='reussite'))return respond({error:'incorrect state'},409);
  if(d[field+'_price']!==b.p_price)return respond({error:'wrong price'},409);
  operations.add(k);d[field+'_session']=b.p_session;d[field+'_paid_at']=new Date().toISOString();d.statut=field==='initial'?'acompte_paye':'solde_paye';
  return respond(d.statut);
 }
 if(u.hostname==='api.resend.com'){
  emails.push(JSON.parse(options.body));return respond({id:'email_mock_'+emails.length});
 }
 if(u.hostname==='api.stripe.com'&&u.pathname==='/v1/checkout/sessions'&&method==='POST'){
  const x=new URLSearchParams(options.body),id='cs_live_mock_'+String(checkoutSeq++).padStart(5,'0');
  const met=Object.fromEntries(['service','dossier_id','stage','price_id'].map(k=>[k,x.get('metadata['+k+']')]));
  const total=Object.values(price).flatMap(v=>[{id:v.initial,amount:v.sum[0]},{id:v.solde,amount:v.sum[1]}]).find(v=>v.id===met.price_id)?.amount;
  assert.equal(x.get('mode'),'payment');assert.equal(x.get('line_items[0][price]'),met.price_id);assert.ok(total);
  sessions.set(id,{id,livemode:true,mode:'payment',payment_status:'paid',status:'complete',
    metadata:met,currency:'eur',amount_total:total,line_items:{data:[{price:{id:met.price_id}}]},
    customer_details:{email:dossiers.get(met.dossier_id).email}});
  return respond({id,url:'https://checkout.stripe.com/c/pay/mock',mode:'payment'});
 }
 if(u.hostname==='api.stripe.com'&&u.pathname.startsWith('/v1/checkout/sessions/')){
  const id=u.pathname.split('/').at(-1);return sessions.has(id)?respond(sessions.get(id)):respond({message:'not found'},404);
 }
 throw Error('Unexpected HTTP '+method+' '+String(url).slice(0,180));
};
function res(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(x){this.statusCode=x;return this},json(x){this.body=x;return this},end(){return this}}}
async function invoke(handler,body={},method='POST',query={},cookie=''){
 const out=res();await handler({method,headers:{origin,host:'xn--mcascope-b1a.fr',cookie,'content-type':'application/json'},
  query,body},out);return out;
}
function tokenFromLastMail(){
 const html=emails.at(-1).html;const m=html.match(/mission\.html\?t=([a-f0-9]{64})/);assert.ok(m,'mail has link');return m[1];
}
async function event(sessionId){
 const data={id:'evt_mock',type:'checkout.session.completed',livemode:true,data:{object:sessions.get(sessionId)}};
 const buf=Buffer.from(JSON.stringify(data)),stamp=Math.floor(Date.now()/1000);
 const sig=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(stamp+'.').update(buf).digest('hex');
 const out=res();await webhook({method:'POST',headers:{'stripe-signature':'t='+stamp+',v1='+sig},rawBody:buf},out);return out;
}
function check(title,success){assert.ok(success,title);checks++;console.log('PASS '+title)}
try{
 for(const [offer,conf] of Object.entries(price)){
  let request=await invoke(demande,{vehicleType:'automobile',brand:'Peugeot',model:'205',year:'1990',part:'Alternateur',
   email:'client@example.org',contact:'Client de test',photos:[]});
  check(offer+' dépôt gratuit enregistré',request.statusCode===200&&request.body.sent===true);
  const d=[...dossiers.values()].at(-1);const admin='__Host-mecascope-professional=mock_authorized_user';
  let adminResult=await invoke(unitaire,{action:'admin-quote',id:d.id,offre:offer},'POST',{},admin);
  check(offer+' devis envoyé',adminResult.statusCode===200&&d.statut==='devis_envoye');
  let token=tokenFromLastMail();
  let status=await invoke(unitaire,{},'GET',{action:'status',t:token});
  check(offer+' consultation sécurisée du devis',status.statusCode===200&&status.body.offre);
  let early=await invoke(unitaire,{action:'checkout',stage:'solde',token});
  check(offer+' solde impossible avant réussite',early.statusCode===409);
  let pay=await invoke(unitaire,{action:'checkout',stage:'initial',token});
  check(offer+' Checkout acompte montant validé',pay.statusCode===200);
  let id=[...sessions.keys()].at(-1);
  let evt=await event(id);
  check(offer+' paiement initial confirmé par webhook',evt.statusCode===200&&d.statut==='acompte_paye');
  evt=await event(id);
  check(offer+' webhook duplicate sans double paiement',evt.statusCode===200&&d.statut==='acompte_paye');
  adminResult=await invoke(unitaire,{action:'admin-success',id:d.id},'POST',{},admin);
  check(offer+' résultat validé et solde proposé',adminResult.statusCode===200&&d.statut==='reussite');
  token=tokenFromLastMail();
  pay=await invoke(unitaire,{action:'checkout',stage:'solde',token});
  check(offer+' Checkout du solde',pay.statusCode===200);
  id=[...sessions.keys()].at(-1);evt=await event(id);
  check(offer+' solde confirmé par webhook',evt.statusCode===200&&d.statut==='solde_paye');
 }
 // Failed case: no balance paid
 let request=await invoke(demande,{vehicleType:'automobile',brand:'Renault',model:'Clio',year:'2005',part:'Calculateur',
  email:'client@example.org',contact:'Client test',photos:[]});
 const d=[...dossiers.values()].at(-1),admin='__Host-mecascope-professional=mock_authorized_user';
 await invoke(unitaire,{action:'admin-quote',id:d.id,offre:'expert'},'POST',{},admin);
 let token=tokenFromLastMail();await invoke(unitaire,{action:'checkout',stage:'initial',token});
 const id=[...sessions.keys()].at(-1);await event(id);
 const fail=await invoke(unitaire,{action:'admin-fail',id:d.id},'POST',{},admin);
 check('Échec de la recherche sans solde',fail.statusCode===200&&d.statut==='echec');
 const blocked=await invoke(unitaire,{action:'checkout',stage:'solde',token});
 check('Échec : paiement du solde interdit',blocked.statusCode===409);
 const bad=await invoke(unitaire,{action:'admin-success',id:d.id},'POST',{},admin);
 check('Échec : impossible de transformer ensuite en réussite',bad.statusCode===409);
 console.log('UNITAIRE SIMULATION:',checks,'checks passed; no real Stripe charge, no real database write');
}catch(err){console.error('FAILED',err.stack||err);process.exitCode=1}
finally{globalThis.fetch=previous}
