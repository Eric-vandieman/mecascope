'use strict';
const cookieName='__Host-mecascope-particulier';
const getCookie=header=>{const p=String(header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));if(!p)return '';try{return decodeURIComponent(p.slice(cookieName.length+1))}catch{return ''}};
const validOrigin=req=>{try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}};
const endpointAllowed=endpoint=>{try{const url=new URL(endpoint);return url.protocol==='https:'&&(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)$/.test(url.hostname)||/\.push\.apple\.com$/.test(url.hostname))}catch{return false}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode non autorisée'});
 if(req.method==='POST'&&!validOrigin(req))return res.status(403).json({message:'Origine non autorisée'});
 const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
 const pub=process.env.SUPABASE_PUBLISHABLE_KEY,admin=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!pub||!admin)return res.status(503).json({message:'Notifications indisponibles'});
 const access=getCookie(req.headers.cookie);
 if(!access)return res.status(401).json({message:'Connectez-vous à votre compte Mécascope'});
 try{
  const response=await fetch(base+'/auth/v1/user',{headers:{apikey:pub,Authorization:'Bearer '+access},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return res.status(401).json({message:'Session expirée'});
  const user=await response.json();
  if(!user.id||!user.email_confirmed_at||user.user_metadata?.profil!=='particulier')return res.status(403).json({message:'Compte particulier confirmé requis'});
  const headers={apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{}),'Content-Type':'application/json'};
  const action=req.method==='GET'?'config':req.body?.action;
  const path=base+'/rest/v1/meca_client_push_subscriptions';
  if(action==='config'){
   const r=await fetch(path+'?utilisateur=eq.'+encodeURIComponent(user.id)+'&actif=eq.true&select=id&limit=10',{headers,signal:AbortSignal.timeout(9000)});
   if(!r.ok)throw Error('Abonnement indisponible');
   const rows=await r.json();
   return res.status(200).json({publicKey:process.env.MECA_CLIENT_VAPID_PUBLIC||null,subscriptions:rows.length});
  }
  if(action==='subscribe'){
   const s=req.body?.subscription||{},keys=s.keys||{};
   if(typeof s.endpoint!=='string'||s.endpoint.length>1900||!endpointAllowed(s.endpoint)||
     typeof keys.p256dh!=='string'||!/^[A-Za-z0-9_-]{50,200}$/.test(keys.p256dh)||
     typeof keys.auth!=='string'||!/^[A-Za-z0-9_-]{12,200}$/.test(keys.auth))
     return res.status(400).json({message:'Abonnement Push invalide'});
   // Evite qu'un ancien appareil attribué à un autre compte reçoive ses notifications.
   const body={utilisateur:user.id,endpoint:s.endpoint,p256dh:keys.p256dh,auth_secret:keys.auth,actif:true,actualise_le:new Date().toISOString()};
   const r=await fetch(path+'?on_conflict=endpoint',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Abonnement impossible');
   return res.status(200).json({active:true});
  }
  if(action==='unsubscribe'){
   const endpoint=req.body?.endpoint;
   if(typeof endpoint!=='string'||endpoint.length>1900||!endpointAllowed(endpoint))return res.status(400).json({message:'Abonnement invalide'});
   const r=await fetch(path+'?utilisateur=eq.'+encodeURIComponent(user.id)+'&endpoint=eq.'+encodeURIComponent(endpoint),{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({actif:false,actualise_le:new Date().toISOString()}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Désactivation impossible');
   return res.status(200).json({active:false});
  }
  return res.status(400).json({message:'Action inconnue'});
 }catch(e){return res.status(503).json({message:'Service de notifications indisponible'})}
}
