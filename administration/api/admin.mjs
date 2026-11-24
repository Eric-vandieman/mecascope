export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST' || req.headers.origin!=='https://'+req.headers.host) return res.status(403).end();
  const {email,password,action}=req.body||{};
  if(action==='logout'){
    res.setHeader('Set-Cookie','__Host-admin=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return res.status(204).end();
  }
  const url=process.env.SUPABASE_URL;
  const headers={apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'};
  const deny=()=>res.status(403).json({message:'Accès refusé. Vérifiez votre compte administrateur.'});
  try {
    let token=(req.headers.cookie||'').split('; ').find(v=>v.startsWith('__Host-admin='))?.slice(13);
    if(action==='login'){
      if(typeof email!=='string'||typeof password!=='string'||password.length>256||email.length>254) return deny();
      const login=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password}),signal:AbortSignal.timeout(8000)});
      if(!login.ok) return deny();
      token=(await login.json()).access_token;
    }
    if(!token) return deny();
    const result=await fetch(url+'/rest/v1/rpc/synthese_administration',{method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:'{}',signal:AbortSignal.timeout(8000)});
    if(!result.ok) return deny();
    if(action==='login') res.setHeader('Set-Cookie','__Host-admin='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600');
    return res.json(await result.json());
  } catch {return res.status(503).json({message:'Service momentanément indisponible.'});}
}
