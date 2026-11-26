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
 if(!r.ok){
  const info=await r.json().catch(()=>({}));
  const code=String(info?.code||'');
  const message=code==='42501'?'Accès administrateur refusé par Supabase':code==='PGRST202'?'Fonction de notifications indisponible dans Supabase':code==='23514'?'Abonnement de ce navigateur refusé':r.status===401?'Connexion Supabase expirée':'Échec du service de notifications (HTTP '+r.status+')';
  throw Object.assign(new Error(message),{status:r.status,code});
 }
 if(r.status===204||r.status===205)return null;
 const body=await r.text();
 return body?JSON.parse(body):null;
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
 const isUrgent=data.event_type==='demande_urgente';
 const result=await deliver(data.subscribers,{id:data.id,title:isUrgent?'🚨🚨 MÉCASCOPE — DEMANDE URGENTE':'🔧 Mécascope — Nouvelle alerte',urgent:isUrgent,
  body:isUrgent?'Nouveau client en urgence : ouvrir la demande en priorité. Aucun délai Express n’est encore souscrit.':data.event_type==='paiement_initial'?'Paiement confirmé : dossier à démarrer':
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
async function dispatchClient(id){
 const claimed=await rpc('meca_client_push_claim',{p_secret:secret(),p_id:id});
 if(!claimed?.claimed)return {ignored:true};
 const quote=claimed.event_type==='devis_disponible';
 const payload={
  id:claimed.id,
  title:quote?'📋 Mécascope — Votre devis est disponible':'✅ Mécascope — Une pièce a été trouvée',
  body:quote?'Votre proposition de recherche est prête. Connectez-vous pour consulter votre devis et répondre.':'Une source de pièce a été identifiée pour votre dossier. Consultez le résultat dans votre espace Mécascope.',
  url:'/mon-espace.html#demandes',
  tag:'meca-client-'+claimed.id
 };
 const result=await deliver(claimed.subscribers,payload);
 const ok=result.success>0&&result.errors.length===0;
 await rpc('meca_client_push_finish',{p_secret:secret(),p_id:id,p_success:ok,
  p_error:result.success===0?'Aucun appareil atteint : '+result.errors.join(', '):result.errors.join(', '),
  p_expired:result.expired}).catch(()=>{});
 return {sent:result.success,errors:result.errors.length,expired:result.expired.length};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 if(req.method!=='POST')return json(res,405,{message:'Méthode non autorisée'});
 const b=req.body||{};
 try{
  if(b.action==='dispatch-client'){
   if(!same(req.headers['x-meca-push-secret'],secret()))return json(res,403,{message:'Accès refusé'});
   if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return json(res,400,{message:'Événement invalide'});
   return json(res,200,await dispatchClient(b.id));
  }
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
 }catch(e){const status=e.status===401?401:e.status===403?403:503;
  const message=e.message&&/^(Accès administrateur|Fonction de notifications|Abonnement de ce navigateur|Connexion Supabase|Échec du service de notifications|Clés VAPID|Destination Push)/.test(e.message)?e.message:'Service de notifications momentanément indisponible';
  console.error('meca-push-error',{action:String(b.action||'').slice(0,30),status,code:e.code||null,error:String(e.message||'').slice(0,160)});
  return json(res,status,{message});
 }
}