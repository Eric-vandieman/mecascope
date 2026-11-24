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
  async function membership(accessToken){
    if(!accessToken)return null;
    try{
      const r=await fetch(url+'/rest/v1/rpc/meca_tableau_bord',{method:'POST',headers:{...headers,Authorization:'Bearer '+accessToken},body:'{}',signal:AbortSignal.timeout(8000)});
      if(!r.ok)return null;
      const data=await r.json();
      return data?.garage?data:null;
    }catch{return null}
  }
  async function acceptPendingInvite(accessToken,user){
    const code=user?.user_metadata?.mecascope_invite_code;
    if(typeof code!=='string'||code.length<30||code.length>180)return null;
    try{
      const r=await fetch(url+'/rest/v1/rpc/meca_accepter_invitation',{
        method:'POST',headers:{...headers,Authorization:'Bearer '+accessToken},
        body:JSON.stringify({p_code:code}),signal:AbortSignal.timeout(8000)
      });
      if(!r.ok)return null;
      // Le rattachement est fait dans la base et la permission de l'invitation s'applique.
      return await membership(accessToken);
    }catch{return null}
  }
  const memberProfile=(user,data)=>({...profile(user),etablissement:data.garage.nom,siret:data.garage.siret,adresse:data.garage.adresse,code_postal:data.garage.code_postal,ville:data.garage.ville,role:data.role});
  try{
    if(req.method==='GET'){
      const token=getCookie(req.headers.cookie);
      if(!token)return res.status(401).json({message:'Non connecté.'});
      const r=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
      if(!r.ok){res.setHeader('Set-Cookie',cookie('',0));return res.status(401).json({message:'Session expirée.'})}
      const user=await r.json();
      if(user.user_metadata?.profil==='particulier')return res.status(403).json({message:'Ce compte est un compte particulier.'});
      const member=await membership(token) || await acceptPendingInvite(token,user);
      if(member)return res.status(200).json({authenticated:true,profile:memberProfile(user,member)});
      if(!ready(user))return res.status(200).json({authenticated:false,needsProfile:true,profile:profile(user),message:'Complétez vos coordonnées professionnelles pour terminer votre accès.'});
      return res.status(200).json({authenticated:true,profile:profile(user)});
    }
    const b=req.body||{};
    if(b.action==='logout'){res.setHeader('Set-Cookie',cookie('',0));return res.status(200).json({message:'Déconnecté.'})}
    if(b.action==='resume-confirmed'){
      // Reprise sécurisée après le lien de confirmation Supabase : le jeton est validé côté serveur.
      const accessToken=typeof b.access_token==='string'&&b.access_token.length<4096?b.access_token:'';
      if(!accessToken)return res.status(400).json({message:'Lien de confirmation incomplet.'});
      const verified=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(10000)});
      if(!verified.ok)return res.status(401).json({message:'Le lien de confirmation a expiré ou n’a pas été validé.'});
      const account=await verified.json();
      if(account.user_metadata?.profil!=='professionnel')return res.status(403).json({message:'Ce lien n’est pas lié à un compte professionnel.'});
      const member=await membership(accessToken)||await acceptPendingInvite(accessToken,account);
      res.setHeader('Set-Cookie',cookie(accessToken,Math.min(Number(b.expires_in)||3600,3600)));
      if(member)return res.status(200).json({authenticated:true,joined:true,profile:memberProfile(account,member)});
      return res.status(200).json({authenticated:false,needsProfile:!ready(account),message:'Adresse confirmée. Vous pouvez poursuivre dans votre espace professionnel.'});
    }

    if(b.action==='invite-signup'){
      const email=clean(b.email,254).toLowerCase();
      const password=b.password;
      const contact=clean(b.contact,120),telephone=clean(b.telephone,22);
      if(!email||!email.includes('@')||typeof password!=='string'||password.length<8||password.length>256||!contact||!phoneOK(telephone)||b.legalAccepted!==true||b.legalVersion!=='2026-11-24')
        return res.status(400).json({message:'Vérifiez votre e-mail, votre nom, votre téléphone et les conditions.'});
      const invitation=typeof b.code==='string'?b.code:'';
      if(invitation.length<30||invitation.length>180)return res.status(400).json({message:'Utilisez une invitation valide pour créer ce compte collaborateur.'});
      const validate=await fetch(url+'/rest/v1/rpc/meca_verifier_invitation',{method:'POST',headers,body:JSON.stringify({p_code:invitation,p_email:email}),signal:AbortSignal.timeout(10000)});
      if(!validate.ok)return res.status(400).json({message:'Impossible de vérifier l’invitation.'});
      const invitationStatus=await validate.json();
      if(invitationStatus?.valide!==true)return res.status(400).json({message:'Cette invitation est invalide, a expiré, ou ne correspond pas à cette adresse e-mail.'});
      if(invitationStatus.compte_existant===true)return res.status(409).json({message:'Cette adresse possède déjà un compte Mécascope. Utilisez ce compte existant pour rejoindre l’équipe, sans créer un deuxième compte.'});
      const payload={email,password,data:{contact,telephone,profil:'professionnel',invite_pending:true,mecascope_invite_code:invitation,mecascope_garage_name:invitationStatus.garage||'',mecascope_inviter_name:invitationStatus.inviteur||'',mecascope_legal_version:'2026-11-24',mecascope_legal_accepted_at:new Date().toISOString()}};
      const r=await fetch(authRequest,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
      if(!r.ok)return res.status(400).json({message:'Création impossible. Si votre compte existe, connectez-vous avec ce compte.'});
      const result=await r.json();
      if(result.access_token){
        res.setHeader('Set-Cookie',cookie(result.access_token,Math.min(3600,Number(result.expires_in)||3600)));
        const membershipData=await membership(result.access_token) || await acceptPendingInvite(result.access_token,await (await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+result.access_token}})).json());
        return res.status(200).json({authenticated:true,joined:!!membershipData,message:membershipData?'Votre compte professionnel est créé et rattaché au garage.':'Compte créé. Confirmez votre adresse e-mail pour terminer le rattachement.'});
      }
      return res.status(200).json({authenticated:false,message:'Confirmez votre adresse e-mail, puis revenez sur le lien d’invitation pour rejoindre l’équipe.'});
    }
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
    const member=await membership(data.access_token) || await acceptPendingInvite(data.access_token,user);
    res.setHeader('Set-Cookie',cookie(data.access_token,Math.min(3600,Number(data.expires_in)||3600)));
    if(member)return res.status(200).json({authenticated:true,profile:memberProfile(user,member),message:'Connexion réussie.'});
    if(!ready(user))return res.status(200).json({authenticated:false,needsProfile:true,profile:profile(user),message:'Connexion réussie. Complétez votre profil professionnel afin d’accéder à votre espace.'});
    return res.status(200).json({authenticated:true,profile:profile(user),message:'Connexion réussie.'});
  }catch{return res.status(503).json({message:'Service temporairement indisponible. Réessayez.'})}
}