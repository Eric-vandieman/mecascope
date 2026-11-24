'use strict';
const COOKIE='__Host-mecascope-professional';
const cookie=(t,age)=>COOKIE+'='+encodeURIComponent(t||'')+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
function getCookie(h){const a=String(h||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));if(!a)return '';try{return decodeURIComponent(a.slice(COOKIE.length+1))}catch{return ''}}
const clean=(x,n)=>typeof x==='string'&&x.trim().length<=n?x.trim():'';
const phoneOK=s=>/^[+0-9 ()-]{8,22}$/.test(s)&&s.replace(/\D/g,'').length>=9;
const profile=u=>{const m=u.user_metadata||{};return {email:u.email||'',etablissement:m.etablissement||'',siret:m.siret||'',adresse:m.adresse||'',code_postal:m.code_postal||'',ville:m.ville||'',contact:m.contact||'',telephone:m.telephone||''}};
const ready=u=>u.user_metadata?.profil==='professionnel' && /^\d{14}$/.test(profile(u).siret) && phoneOK(profile(u).telephone) && !!profile(u).etablissement && !!profile(u).contact && !!profile(u).adresse && !!profile(u).ville && !!profile(u).code_postal;
const fieldsFrom=b=>({siret:clean(b.siret,14),etablissement:clean(b.etablissement,160),adresse:clean(b.adresse,220),code_postal:clean(b.code_postal,16),ville:clean(b.ville,100),contact:clean(b.contact,120),telephone:clean(b.telephone,22)});
const validFields=(fields,b)=>/^\d{14}$/.test(fields.siret)&&phoneOK(fields.telephone)&&Object.values(fields).every(Boolean)&&b.legalAccepted===true&&b.legalVersion==='2026-11-24';
const confirmationUrl='https://xn--mcascope-b1a.fr/confirmation.html?espace=pro';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode non autorisée.'});
  if(req.method==='POST'){
    try{if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({message:'Origine non autorisée.'})}catch{return res.status(403).json({message:'Origine non autorisée.'})}
  }
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return res.status(503).json({message:'Le service de connexion est indisponible pour le moment.'});
  const base=url.replace(/\/$/,'')+'/auth/v1/';
  const authRequest=base+'signup?redirect_to='+encodeURIComponent(confirmationUrl);
  const headers={apikey:key,'Content-Type':'application/json'};
  try{
    if(req.method==='GET'){
      const token=getCookie(req.headers.cookie);
      if(!token)return res.status(401).json({message:'Non connecté.'});
      const r=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
      if(!r.ok){res.setHeader('Set-Cookie',cookie('',0));return res.status(401).json({message:'Session expirée.'})}
      const user=await r.json();
      if(user.user_metadata?.profil==='particulier')return res.status(403).json({message:'Ce compte est un compte particulier.'});
      if(!ready(user))return res.status(200).json({authenticated:false,needsProfile:true,profile:profile(user),message:'Complétez vos coordonnées professionnelles pour terminer votre accès.'});
      return res.status(200).json({authenticated:true,profile:profile(user)});
    }
    const b=req.body||{};
    if(b.action==='logout'){res.setHeader('Set-Cookie',cookie('',0));return res.status(200).json({message:'Déconnecté.'})}
    if(b.action==='complete'){
      const token=getCookie(req.headers.cookie);
      if(!token)return res.status(401).json({message:'Reconnectez-vous pour compléter votre profil.'});
      const ur=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
      if(!ur.ok)return res.status(401).json({message:'Session expirée. Reconnectez-vous.'});
      const user=await ur.json();
      if(user.user_metadata?.profil==='particulier')return res.status(403).json({message:'Ce compte est réservé aux particuliers.'});
      const fields=fieldsFrom(b);
      if(!validFields(fields,b))return res.status(400).json({message:'Vérifiez tous les champs obligatoires, le SIRET, le téléphone et les conditions.'});
      const metadata={...user.user_metadata,...fields,profil:'professionnel',mecascope_legal_version:'2026-11-24',mecascope_legal_accepted_at:new Date().toISOString(),mecascope_marketing_opt_in:b.marketingOptIn===true};
      const upd=await fetch(base+'user',{method:'PUT',headers:{...headers,Authorization:'Bearer '+token},body:JSON.stringify({data:metadata}),signal:AbortSignal.timeout(10000)});
      if(!upd.ok)return res.status(400).json({message:'Impossible d’enregistrer les coordonnées. Réessayez.'});
      const updated=await upd.json();
      if(!ready(updated))return res.status(400).json({message:'Votre profil professionnel reste incomplet.'});
      return res.status(200).json({authenticated:true,profile:profile(updated),message:'Votre espace professionnel est accessible. Vérification du SIRET à venir.'});
    }
    if(b.action==='resend'){
      const email=clean(b.email,254).toLowerCase();
      if(!email||!email.includes('@'))return res.status(400).json({message:'Saisissez une adresse e-mail valide.'});
      await fetch(base+'resend?redirect_to='+encodeURIComponent(confirmationUrl),{method:'POST',headers,body:JSON.stringify({type:'signup',email}),signal:AbortSignal.timeout(10000)});
      return res.status(200).json({message:'Si votre adresse attend confirmation, un nouvel e-mail a été demandé. Vérifiez votre boîte de réception.'});
    }
    if(!['login','signup'].includes(b.action))return res.status(400).json({message:'Demande invalide.'});
    const email=clean(b.email,254).toLowerCase(),password=b.password;
    if(!email||!email.includes('@')||typeof password!=='string'||password.length<8||password.length>256)return res.status(400).json({message:'Vérifiez votre e-mail et votre mot de passe.'});
    if(b.action==='signup'){
      const fields=fieldsFrom(b);
      if(!validFields(fields,b))return res.status(400).json({message:'Vérifiez le SIRET, le téléphone, les coordonnées complètes et l’acceptation des conditions.'});
      const payload={email,password,data:{...fields,profil:'professionnel',mecascope_legal_version:'2026-11-24',mecascope_legal_accepted_at:new Date().toISOString(),mecascope_marketing_opt_in:b.marketingOptIn===true}};
      const r=await fetch(authRequest,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
      if(!r.ok)return res.status(400).json({message:'Inscription refusée. Vérifiez les informations ou utilisez une autre adresse e-mail.'});
      const data=await r.json();
      if(data.access_token){
        res.setHeader('Set-Cookie',cookie(data.access_token,Math.min(3600,Number(data.expires_in)||3600)));
        return res.status(200).json({authenticated:true,profile:{...fields,email},message:'Compte créé. Votre établissement reste à vérifier.'});
      }
      return res.status(200).json({authenticated:false,message:'Compte enregistré. Consultez votre messagerie et confirmez votre e-mail avant de vous connecter.'});
    }
    const r=await fetch(base+'token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000)});
    if(!r.ok)return res.status(401).json({message:'E-mail, mot de passe ou confirmation de compte incorrect.'});
    const data=await r.json();if(!data.access_token)return res.status(401).json({message:'Connexion impossible.'});
    const ur=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+data.access_token},signal:AbortSignal.timeout(10000)});
    if(!ur.ok)return res.status(401).json({message:'Session non vérifiée.'});
    const user=await ur.json();
    if(user.user_metadata?.profil==='particulier')return res.status(403).json({message:'Ce compte est un compte particulier. Utilisez la connexion particuliers.'});
    res.setHeader('Set-Cookie',cookie(data.access_token,Math.min(3600,Number(data.expires_in)||3600)));
    if(!ready(user))return res.status(200).json({authenticated:false,needsProfile:true,profile:profile(user),message:'Connexion réussie. Complétez votre profil professionnel afin d’accéder à votre espace.'});
    return res.status(200).json({authenticated:true,profile:profile(user),message:'Connexion réussie.'});
  }catch{return res.status(503).json({message:'Service temporairement indisponible. Réessayez.'})}
}