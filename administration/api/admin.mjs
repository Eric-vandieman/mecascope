// Session durable Mécascope : jeton court + renouvellement côté serveur.
const accessName='__Host-admin', refreshName='__Host-admin-refresh';
const longAge=365*24*60*60;
function getCookie(req,name){
 const entry=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
 return entry?entry.slice(name.length+1):'';
}
function setCookies(res,session){
 res.setHeader('Set-Cookie',[
  accessName+'='+session.access_token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age='+Math.min(Math.max(Number(session.expires_in)||3600,60),3600),
  refreshName+'='+session.refresh_token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age='+longAge
 ]);
}
function clearCookies(res){
 res.setHeader('Set-Cookie',[
  accessName+'=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
  refreshName+'=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
 ]);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Méthode non autorisée'});
 if(req.headers.origin!=='https://'+req.headers.host)return res.status(403).json({message:'Origine non autorisée'});
 const {email,password,action}=req.body||{};
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return res.status(503).json({message:'Connexion de production indisponible'});
 const headers={apikey:key,'Content-Type':'application/json'};
 const deny=()=>res.status(403).json({message:'Accès refusé. Vérifiez vos identifiants administrateur.'});
 const tokenRequest=async(grant,body)=>{
  const response=await fetch(url+'/auth/v1/token?grant_type='+grant,{
   method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const session=await response.json();
  return session?.access_token&&session?.refresh_token?session:null;
 };
 const verify=async token=>{
  if(!token)return null;
  const result=await fetch(url+'/rest/v1/rpc/synthese_administration',{
   method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:'{}',signal:AbortSignal.timeout(10000)});
  return result.ok?await result.json():null;
 };
 try{
  let token=getCookie(req,accessName),renewal=getCookie(req,refreshName);
  if(action==='logout'){
   if(!token&&renewal){
    const renewed=await tokenRequest('refresh_token',{refresh_token:renewal});
    token=renewed?.access_token||'';
   }
   if(token)await fetch(url+'/auth/v1/logout',{method:'POST',headers:{...headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)}).catch(()=>{});
   clearCookies(res);
   return res.status(204).end();
  }
  if(!['login','session'].includes(action))return res.status(400).json({message:'Action inconnue'});
  if(action==='login'){
   if(typeof email!=='string'||email.length>254||typeof password!=='string'||password.length>256)return deny();
   const login=await tokenRequest('password',{email,password});
   if(!login)return deny();
   token=login.access_token;renewal=login.refresh_token;
   const allowed=await verify(token);
   if(!allowed)return deny();
   setCookies(res,login);
   return res.status(200).json(allowed);
  }
  let allowed=await verify(token);
  if(allowed)return res.status(200).json(allowed);
  if(!renewal){clearCookies(res);return res.status(401).json({message:'Connectez-vous à votre espace administrateur.'})}
  const refreshed=await tokenRequest('refresh_token',{refresh_token:renewal});
  if(!refreshed){clearCookies(res);return res.status(401).json({message:'Votre session a été révoquée. Reconnectez-vous.'})}
  allowed=await verify(refreshed.access_token);
  if(!allowed){clearCookies(res);return deny()}
  setCookies(res,refreshed);
  return res.status(200).json(allowed);
 }catch{return res.status(503).json({message:'Service de connexion momentanément indisponible'})}
}
