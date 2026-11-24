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
      const m=user.user_metadata||{};
      if(m.profil!=='particulier')return res.status(403).json({message:'Ce compte ne correspond pas à un espace particulier.'});
      return res.status(200).json({email:user.email||null,prenom:m.prenom||'',nom:m.nom||'',telephone:m.telephone||'',authenticated:true});
    }
    const {action}=req.body||{};
    if(action==='logout'){res.setHeader('Set-Cookie',cookie('',0));return res.status(200).json({message:'Déconnexion effectuée.'})}
    if(action==='verify-email-token'){
      const hash=typeof req.body.token_hash==='string'?req.body.token_hash:'';
      if(!/^[a-zA-Z0-9_-]{20,256}$/.test(hash))return res.status(400).json({message:'Lien de confirmation invalide.'});
      const verification=await fetch(base+'verify',{method:'POST',headers,body:JSON.stringify({token_hash:hash,type:'email'}),signal:AbortSignal.timeout(12000)});
      const data=await verification.json().catch(()=>({}));
      if(!verification.ok||!data.access_token)return res.status(400).json({message:'Lien expiré ou déjà utilisé. Demandez un nouveau lien de confirmation.'});
      const authenticated=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+data.access_token},signal:AbortSignal.timeout(10000)});
      if(!authenticated.ok)return res.status(401).json({message:'Impossible de confirmer la session.'});
      const user=await authenticated.json();
      if(user.user_metadata?.profil!=='particulier'||!user.email_confirmed_at)
        return res.status(403).json({message:'Cette confirmation ne concerne pas un compte particulier.'});
      res.setHeader('Set-Cookie',cookie(data.access_token,Math.max(1,Math.min(Number(data.expires_in)||3600,3600))));
      return res.status(200).json({authenticated:true,message:'Adresse confirmée. Votre tableau de bord s’ouvre.'});
    }
    if(action==='resume-confirmed'){
      const token=typeof req.body.access_token==='string'&&req.body.access_token.length<4096?req.body.access_token:'';
      if(!token)return res.status(400).json({message:'Jeton de confirmation manquant.'});
      const verification=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
      if(!verification.ok)return res.status(401).json({message:'Lien de confirmation invalide ou expiré.'});
      const user=await verification.json();
      if(user.user_metadata?.profil!=='particulier'||!user.email_confirmed_at)
        return res.status(403).json({message:'Ce lien ne correspond pas à un compte particulier confirmé.'});
      const age=Math.max(1,Math.min(Number(req.body.expires_in)||3600,3600));
      res.setHeader('Set-Cookie',cookie(token,age));
      return res.status(200).json({authenticated:true,message:'Adresse confirmée et compte particulier connecté.'});
    }
    if(action==='resend'){
      const address=norm(req.body.email,254)?.toLowerCase();
      if(!address||!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(address))
        return res.status(400).json({message:'Renseignez une adresse e-mail valide.'});
      const redirect='https://xn--mcascope-b1a.fr/confirmation.html?espace=particulier';
      const result=await fetch(base+'resend?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers,body:JSON.stringify({type:'signup',email:address}),signal:AbortSignal.timeout(12000)});
      if(result.status===429)return res.status(429).json({message:'Le service d’envoi limite actuellement les confirmations. Réessayez plus tard. Le domaine doit être connecté au SMTP Mécascope pour lever cette limite.'});
      if(!result.ok){
        const problem=await result.json().catch(()=>({}));
        const code=String(problem.code||'');
        return res.status(503).json({message:code==='email_address_not_authorized'?'L’expéditeur Supabase ne permet pas d’envoyer vers cette adresse. Activez le SMTP Mécascope.':'Impossible de renvoyer la confirmation pour le moment. Vérifiez l’envoi SMTP Supabase.'});
      }
      return res.status(200).json({message:'Si cette adresse possède un compte en attente de validation, un nouveau lien de confirmation a été demandé. Vérifiez aussi vos courriers indésirables.'});
    }
    if(!['login','signup'].includes(action))return res.status(400).json({message:'Demande invalide.'});
    const email=norm(req.body.email,254)?.toLowerCase();
    const password=req.body.password;
    if(!email||!email.includes('@')||typeof password!=='string'||password.length<8||password.length>256)
      return res.status(400).json({message:'Vérifiez votre adresse e-mail et votre mot de passe (8 caractères minimum).'});
    if(action==='signup'){
      const prenom=norm(req.body.prenom,80),nom=norm(req.body.nom,80),telephone=norm(req.body.telephone,22);
      if(!prenom||!nom||!telephone||!/^[+0-9 ()-]{8,22}$/.test(telephone)||telephone.replace(/\D/g,'').length<9||req.body.legalAccepted!==true||req.body.legalVersion!=='2026-11-24')
        return res.status(400).json({message:'Complétez vos informations et acceptez les conditions applicables.'});
      const payload={email,password,data:{prenom,nom,telephone,profil:'particulier',mecascope_legal_version:'2026-11-24',mecascope_legal_accepted_at:new Date().toISOString(),mecascope_marketing_opt_in:req.body.marketingOptIn===true}};
      const response=await fetch(base+'signup?redirect_to='+encodeURIComponent('https://xn--mcascope-b1a.fr/confirmation.html?espace=particulier'),{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
      if(!response.ok){
        const error=await response.json().catch(()=>({}));
        if(response.status===429)return res.status(429).json({message:'Le service de confirmation a atteint sa limite d’e-mails. L’inscription n’a pas pu être finalisée : réessayez plus tard.'});
        if(error.code==='email_address_not_authorized')return res.status(503).json({message:'Supabase refuse d’envoyer à cette adresse. Le SMTP personnalisé Mécascope doit être activé.'});
        return res.status(400).json({message:'Inscription impossible pour le moment. Vérifiez votre adresse ou réessayez.'});
      }
      const result=await response.json();
      if(result.access_token){res.setHeader('Set-Cookie',cookie(result.access_token,Math.min(Number(result.expires_in)||3600,3600)));return res.status(200).json({authenticated:true,message:'Votre compte particulier a été créé.'})}
      return res.status(200).json({authenticated:false,message:'Si un e-mail de confirmation peut être envoyé à cette adresse, vous le recevrez pour activer votre compte. Si rien n’arrive, utilisez « Renvoyer la confirmation » ci-dessous.',canResend:true});
    }
    const response=await fetch(base+'token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)return res.status(401).json({message:'Identifiants incorrects ou adresse e-mail non confirmée.'});
    const result=await response.json();
    if(!result.access_token)return res.status(401).json({message:'Connexion impossible.'});
    const ur=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+result.access_token},signal:AbortSignal.timeout(10000)});
    if(!ur.ok)return res.status(401).json({message:'Session non vérifiée.'});
    const user=await ur.json();
    if(user.user_metadata?.profil!=='particulier')return res.status(403).json({message:'Ce compte est professionnel. Utilisez l’Espace Pro.'});
    res.setHeader('Set-Cookie',cookie(result.access_token,Math.min(Number(result.expires_in)||3600,3600)));
    return res.status(200).json({authenticated:true,message:'Connexion réussie.'});
  }catch{return res.status(503).json({message:'Le service est momentanément indisponible. Réessayez.'})}
}
