// API d'authentification pour les comptes particuliers Mécascope.
// Utilise uniquement la clé publiable Supabase côté serveur ; aucun secret n'est exposé.
const cookieName='__Host-mecascope-particulier';
const cookie=(token,maxAge)=>cookieName+'='+encodeURIComponent(token||'')+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+maxAge;
const readCookie=(header)=>{const name=cookieName+'=';const part=String(header||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name));if(!part)return null;try{return decodeURIComponent(part.slice(name.length))}catch{return null}};
const norm=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():null;
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode non autorisée.'});
  if(req.method==='POST'){
    const origin=req.headers.origin,host=req.headers.host;
    if(!origin||!host){return res.status(403).json({message:'Origine non autorisée.'})}
    try{if(new URL(origin).host!==host)return res.status(403).json({message:'Origine non autorisée.'})}
    catch{return res.status(403).json({message:'Origine non autorisée.'})}
  }
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return res.status(503).json({message:'Le service de comptes est momentanément indisponible.'});
  const base=url.replace(/\/$/,'')+'/auth/v1/';
  const headers={apikey:key,'Content-Type':'application/json'};
  try{
    if(req.method==='GET'){
      const token=readCookie(req.headers.cookie);
      if(!token)return res.status(401).json({message:'Non connecté.'});
      const result=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
      if(!result.ok){res.setHeader('Set-Cookie',cookie('',0));return res.status(401).json({message:'Session expirée.'})}
      const user=await result.json();
      return res.status(200).json({email:user.email||null});
    }
    const {action}=req.body||{};
    if(action==='logout'){res.setHeader('Set-Cookie',cookie('',0));return res.status(200).json({message:'Déconnexion effectuée.'})}
    if(!['login','signup'].includes(action))return res.status(400).json({message:'Demande invalide.'});
    const email=norm(req.body.email,254)?.toLowerCase();
    const password=req.body.password;
    if(!email||!email.includes('@')||typeof password!=='string'||password.length<8||password.length>256)
      return res.status(400).json({message:'Vérifiez votre adresse e-mail et votre mot de passe (8 caractères minimum).'});
    if(action==='signup'){
      const prenom=norm(req.body.prenom,80),nom=norm(req.body.nom,80);
      if(!prenom||!nom||req.body.legalAccepted!==true||req.body.legalVersion!=='2026-11-24')
        return res.status(400).json({message:'Complétez vos informations et acceptez les conditions applicables.'});
      const payload={email,password,data:{prenom,nom,profil:'particulier',mecascope_legal_version:'2026-11-24',mecascope_legal_accepted_at:new Date().toISOString(),mecascope_marketing_opt_in:req.body.marketingOptIn===true}};
      const response=await fetch(base+'signup',{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
      if(!response.ok)return res.status(400).json({message:'Inscription impossible avec ces informations. Vérifiez votre adresse ou réessayez.'});
      const result=await response.json();
      if(result.access_token){res.setHeader('Set-Cookie',cookie(result.access_token,Math.min(Number(result.expires_in)||3600,3600)));return res.status(200).json({authenticated:true,message:'Votre compte particulier a été créé.'})}
      return res.status(200).json({authenticated:false,message:'Vérifiez votre messagerie pour confirmer votre adresse et activer votre compte.'});
    }
    const response=await fetch(base+'token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)return res.status(401).json({message:'Identifiants incorrects ou adresse e-mail non confirmée.'});
    const result=await response.json();
    if(!result.access_token)return res.status(401).json({message:'Connexion impossible.'});
    res.setHeader('Set-Cookie',cookie(result.access_token,Math.min(Number(result.expires_in)||3600,3600)));
    return res.status(200).json({authenticated:true,message:'Connexion réussie.'});
  }catch{return res.status(503).json({message:'Le service est momentanément indisponible. Réessayez.'})}
}
