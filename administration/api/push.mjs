import webpush from 'web-push';
import {timingSafeEqual} from 'node:crypto';
export const config={maxDuration:20};
const base=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const pub=()=>process.env.SUPABASE_PUBLISHABLE_KEY||'';
const secret=()=>process.env.MECA_PUSH_DB_SECRET||'';
const json=(res,code,body)=>res.status(code).json(body);
const cookie=(req,name)=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
const same=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y)};
function setup(){
 if(!process.env.MECA_VAPID_PUBLIC||!process.env.MECA_VAPID_PRIVATE)throw Error('Clés VAPID absentes');
 webpush.setVapidDetails('mailto:contact@xn--mcascope-b1a.fr',process.env.MECA_VAPID_PUBLIC,process.env.MECA_VAPID_PRIVATE);
}
async function rpc(fn,args={},token){
 const r=await fetch(base()+'/rest/v1/rpc/'+fn,{
  method:'POST',headers:{apikey:pub(),...token?{Authorization:'Bearer '+token}:{},'Content-Type':'application/json'},
  body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Object.assign(new Error('Service de notifications indisponible'),{status:r.status});
 return r.json();
}
async function authorized(req){
 const token=cookie(req,'__Host-admin');
 if(!token)return null;
 const check=await fetch(base()+'/rest/v1/rpc/synthese_administration',{
  method:'POST',headers:{apikey:pub(),Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:'{}',signal:AbortSignal.timeout(10000)});
 return check.ok?token:null;
}
const isOrigin=req=>{try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}};
function target(item){
 const u=new URL(item.endpoint);
 if(u.protocol!=='https:'||!(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)$/.test(u.hostname)||/\.push\.apple\.com$/.test(u.hostname)))throw Error('Destination Push non autorisée');
 return {endpoint:item.endpoint,keys:item.keys};
}
async function deliver(subscriptions,payload){
 setup();
 const expired=[];let success=0;let errors=[];
 for(const sub of (subscriptions||[]).slice(0,40)){
  try{await webpush.sendNotification(target(sub),JSON.stringify(payload),{TTL:3600,urgency:'high'});success++}
  catch(e){
   if([404,410].includes(e.statusCode))expired.push(sub.endpoint);
   else errors.push('Push HTTP '+String(e.statusCode||'erreur'));
  }
 }
 return {success,expired,errors};
}
async function dispatch(id){
 const claimed=await rpc('meca_push_claim',{p_secret:secret(),p_id:id});
 if(!claimed?.claimed)return {ignored:true};
 const data=claimed;
 const url='/#/'+'admin/demandes?dossier='+encodeURIComponent(data.dossier_id);
 const result=await deliver(data.subscribers,{id:data.id,title:'🔧 Mécascope — Nouvelle alerte',
  body:data.event_type==='paiement_initial'?'Paiement confirmé : dossier à démarrer':
   data.event_type==='solde_regle'?'Solde confirmé sur un dossier':
   data.event_type==='message_client'?'Nouveau message client':
   'Une nouvelle activité nécessite votre attention',
  url,tag:'meca-'+data.id});
 const ok=result.success>0&&result.errors.length===0;
 await rpc('meca_push_finish',{p_secret:secret(),p_id:id,p_success:ok,
  p_error:result.success===0?'Aucun appareil livré : '+result.errors.join(', '):result.errors.join(', '),
  p_expired:result.expired}).catch(()=>{});
 return {sent:result.success,errors:result.errors.length,expired:result.expired.length};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 if(req.method!=='POST')return json(res,405,{message:'Méthode non autorisée'});
 const b=req.body||{};
 try{
  if(b.action==='dispatch'){
   if(!same(req.headers['x-meca-push-secret'],secret()))return json(res,403,{message:'Accès refusé'});
   if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return json(res,400,{message:'Événement invalide'});
   return json(res,200,await dispatch(b.id));
  }
  if(!isOrigin(req))return json(res,403,{message:'Origine non autorisée'});
  if(!base()||!pub())return json(res,503,{message:'Configuration Supabase manquante'});
  const token=await authorized(req);
  if(!token)return json(res,401,{message:'Authentification administrateur requise'});
  if(b.action==='config')return json(res,200,{publicKey:process.env.MECA_VAPID_PUBLIC||null,ready:!!process.env.MECA_VAPID_PRIVATE});
  if(b.action==='center')return json(res,200,await rpc('meca_push_center',{p_mark_read:b.mark||null},token));
  if(b.action==='pro-detail'){if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return json(res,400,{message:'Dossier invalide'});return json(res,200,{dossier:await rpc('meca_push_pro_dossier',{p_id:b.id},token)})}
  if(b.action==='single-dossier'){if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return json(res,400,{message:'Dossier invalide'});return json(res,200,{dossier:await rpc('meca_push_single_dossier',{p_id:b.id},token)})}
  if(b.action==='subscribe'){
   const sub=b.subscription||{},keys=sub.keys||{};
   if(typeof sub.endpoint!=='string'||typeof keys.p256dh!=='string'||typeof keys.auth!=='string')return json(res,400,{message:'Abonnement invalide'});
   target(sub);
   await rpc('meca_push_subscribe',{p_endpoint:sub.endpoint,p_p256dh:keys.p256dh,p_auth:keys.auth},token);
   const pending=await rpc('meca_push_pending',{p_secret:secret()}).catch(()=>[]);
   for(const id of (pending||[]).slice(0,8))await dispatch(id).catch(()=>{});
   return json(res,200,{active:true});
  }
  if(b.action==='unsubscribe'){
   if(typeof b.endpoint!=='string')return json(res,400,{message:'Abonnement invalide'});
   await rpc('meca_push_unsubscribe',{p_endpoint:b.endpoint},token);
   return json(res,200,{active:false});
  }
  if(b.action==='test'){
   const subs=await rpc('meca_push_test_targets',{},token);
   if(!subs?.length)return json(res,409,{message:'Aucun téléphone abonné'});
   const sent=await deliver(subs,{id:'test-'+Date.now(),title:'🔔 Mécascope — Test',
    body:'Vos notifications administrateur sont configurées.',url:'/#/admin',tag:'meca-test-'+Date.now()});
   if(!sent.success)return json(res,502,{message:'Le service Push a refusé la notification de test'});
   return json(res,200,{submitted:sent.success,message:'Notification transmise au service Push de votre téléphone'});
  }
  return json(res,400,{message:'Action inconnue'});
 }catch(e){return json(res,e.status===403?403:503,{message:e.status===403?'Accès refusé':'Une erreur est survenue dans le service de notifications'})}
}