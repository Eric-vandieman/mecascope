import {createHash,createHmac} from 'node:crypto';
// API d'authentification pour les comptes particuliers Mécascope.
// Utilise uniquement la clé publiable Supabase côté serveur ; aucun secret n'est exposé.
const cookieName='__Host-mecascope-particulier';
const cookie=(token,maxAge)=>cookieName+'='+encodeURIComponent(token||'')+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+maxAge;
const readCookie=(header)=>{const name=cookieName+'=';const part=String(header||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name));if(!part)return null;try{return decodeURIComponent(part.slice(name.length))}catch{return null}};
const norm=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():null;

const clientPushCookieName='__Host-mecascope-particulier';
const clientPushGetCookie=header=>{const p=String(header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(clientPushCookieName+'='));if(!p)return '';try{return decodeURIComponent(p.slice(clientPushCookieName.length+1))}catch{return ''}};
const clientPushValidOrigin=req=>{try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}};
const clientPushEndpointAllowed=endpoint=>{try{const url=new URL(endpoint);return url.protocol==='https:'&&(/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com)$/.test(url.hostname)||/\.push\.apple\.com$/.test(url.hostname))}catch{return false}};
async function clientPush(req,res){
 res.setHeader('Cache-Control','private,no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode non autorisée'});
 if(req.method==='POST'&&!clientPushValidOrigin(req))return res.status(403).json({message:'Origine non autorisée'});
 const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
 const pub=process.env.SUPABASE_PUBLISHABLE_KEY,admin=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!pub||!admin)return res.status(503).json({message:'Notifications indisponibles'});
 const access=clientPushGetCookie(req.headers.cookie);
 if(!access)return res.status(401).json({message:'Connectez-vous à votre compte Mécascope'});
 try{
  const response=await fetch(base+'/auth/v1/user',{headers:{apikey:pub,Authorization:'Bearer '+access},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return res.status(401).json({message:'Session expirée'});
  const user=await response.json();
  if(!user.id||!user.email_confirmed_at||user.user_metadata?.profil!=='particulier')return res.status(403).json({message:'Compte particulier confirmé requis'});
  const headers={apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{}),'Content-Type':'application/json'};
  const action=req.method==='GET'?'config':req.body?.action==='push-subscribe'?'subscribe':req.body?.action==='push-unsubscribe'?'unsubscribe':null;
  const path=base+'/rest/v1/meca_client_push_subscriptions';
  if(action==='config'){
   const r=await fetch(path+'?utilisateur=eq.'+encodeURIComponent(user.id)+'&actif=eq.true&select=id&limit=10',{headers,signal:AbortSignal.timeout(9000)});
   if(!r.ok)throw Error('Abonnement indisponible');
   const rows=await r.json();
   return res.status(200).json({publicKey:process.env.MECA_CLIENT_VAPID_PUBLIC||null,subscriptions:rows.length});
  }
  if(action==='subscribe'){
   const s=req.body?.subscription||{},keys=s.keys||{};
   if(typeof s.endpoint!=='string'||s.endpoint.length>1900||!clientPushEndpointAllowed(s.endpoint)||
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
   if(typeof endpoint!=='string'||endpoint.length>1900||!clientPushEndpointAllowed(endpoint))return res.status(400).json({message:'Abonnement invalide'});
   const r=await fetch(path+'?utilisateur=eq.'+encodeURIComponent(user.id)+'&endpoint=eq.'+encodeURIComponent(endpoint),{method:'PATCH',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify({actif:false,actualise_le:new Date().toISOString()}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Désactivation impossible');
   return res.status(200).json({active:false});
  }
  return res.status(400).json({message:'Action inconnue'});
 }catch(e){return res.status(503).json({message:'Service de notifications indisponible'})}
}

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
  if((req.method==='GET'&&req.query?.action==='push-config')||(req.method==='POST'&&['push-subscribe','push-unsubscribe'].includes(req.body?.action)))return clientPush(req,res);
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
      if(req.query?.action==='factures'){
        if(!user.email_confirmed_at)return res.status(403).json({message:'Confirmez votre adresse e-mail.'});
        const admin=process.env.SUPABASE_SERVICE_ROLE_KEY,stripeKey=process.env.STRIPE_SECRET_KEY;
        if(!admin||!stripeKey)return res.status(503).json({message:'Service de facturation indisponible.'});
        const list=await fetch(url+'/rest/v1/meca_demandes_unitaires?particulier_id=eq.'+encodeURIComponent(user.id)+'&select=reference,offre,initial_session,solde_session,initial_paid_at,solde_paid_at&order=cree_le.desc&limit=100',{headers:{apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{})},signal:AbortSignal.timeout(10000)});
        if(!list.ok)return res.status(503).json({message:'Historique indisponible.'});
        const dossiers=await list.json();const entries=[];
        for(const d of dossiers){
         for(const [stage,sid,paidAt] of [['initial',d.initial_session,d.initial_paid_at],['solde',d.solde_session,d.solde_paid_at]]){
          if(!paidAt||!/^cs_live_[a-zA-Z0-9_]+$/.test(String(sid||'')))continue;
          entries.push({dossier:d.reference,stage,session:sid,date:paidAt});
         }
        }
        const invoices=(await Promise.all(entries.slice(0,20).map(async entry=>{
         try{
          const response=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(entry.session)+'?expand%5B%5D=invoice',{headers:{Authorization:'Bearer '+stripeKey},signal:AbortSignal.timeout(6000)});
          if(!response.ok)return null;
          const session=await response.json();
          if(!session.livemode||session.payment_status!=='paid'||session.status!=='complete'||session.metadata?.service!=='mecascope_unitaire'||session.metadata?.stage!==entry.stage)return null;
          const invoice=session.invoice&&typeof session.invoice==='object'?session.invoice:null;
          return {reference:entry.dossier,etape:entry.stage,date:entry.date,montant_centimes:session.amount_total||0,numero:invoice?.number||null,pdf:invoice?.invoice_pdf||null,lien:invoice?.hosted_invoice_url||null};
         }catch{return null}
        }))).filter(Boolean);
        return res.status(200).json({factures:invoices,limite:entries.length>20});
      }
      if(req.query?.action==='dossiers'){
        if(!user.email_confirmed_at)return res.status(403).json({message:'Validez votre adresse e-mail pour consulter vos dossiers.'});
        const admin=process.env.SUPABASE_SERVICE_ROLE_KEY,secret=process.env.STRIPE_WEBHOOK_SECRET;
        if(!admin)return res.status(503).json({message:'Suivi des dossiers indisponible'});
        const records=await fetch(url+'/rest/v1/meca_demandes_unitaires?particulier_id=eq.'+encodeURIComponent(user.id)+'&select=id,reference,statut,offre,details,cree_le,initial_paid_at,solde_paid_at,jeton_hash&order=cree_le.desc&limit=100',{
          headers:{apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{})},signal:AbortSignal.timeout(12000)});
        if(!records.ok)return res.status(503).json({message:'Impossible de récupérer vos demandes.'});
        const rows=await records.json();
        const dossiers=rows.map(d=>{
          let missionUrl=null;
          const stage=['devis_envoye','acompte_paye','echec'].includes(d.statut)?'devis_envoye':['reussite','solde_paye'].includes(d.statut)?'reussite':null;
          if(stage&&secret&&d.jeton_hash){
            const t=createHmac('sha256',secret).update('meca-unitaire-v1:'+d.id+':'+stage).digest('hex');
            if(createHash('sha256').update(t).digest('hex')===d.jeton_hash)missionUrl='/mission.html?t='+t;
          }
          return {reference:d.reference,statut:d.statut,offre:d.offre,details:d.details,cree_le:d.cree_le,paiement_initial_confirme:!!d.initial_paid_at,solde_confirme:!!d.solde_paid_at,missionUrl};
        });
        return res.status(200).json({dossiers});
      }
      return res.status(200).json({email:user.email||null,prenom:m.prenom||'',nom:m.nom||'',telephone:m.telephone||'',authenticated:true});
    }
    const {action}=req.body||{};
    if(action==='logout'){res.setHeader('Set-Cookie',cookie('',0));return res.status(200).json({message:'Déconnexion effectuée.'})}
    if(action==='claim'){
      const accessToken=readCookie(req.headers.cookie),missionToken=String(req.body?.missionToken||'').trim();
      if(!accessToken)return res.status(401).json({message:'Connectez-vous à votre compte particulier.'});
      if(!/^[a-f0-9]{64}$/i.test(missionToken))return res.status(400).json({message:'Saisissez le lien personnel de mission reçu par e-mail.'});
      const vr=await fetch(base+'user',{headers:{...headers,Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(10000)});
      if(!vr.ok)return res.status(401).json({message:'Session expirée.'});
      const user=await vr.json();
      if(!user.email_confirmed_at||user.user_metadata?.profil!=='particulier')return res.status(403).json({message:'Compte particulier confirmé requis.'});
      const admin=process.env.SUPABASE_SERVICE_ROLE_KEY;
      if(!admin)return res.status(503).json({message:'Rattachement indisponible'});
      const dbHeaders={apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{}),'Content-Type':'application/json'};
      const digest=createHash('sha256').update(missionToken).digest('hex');
      const found=await fetch(url+'/rest/v1/meca_demandes_unitaires?jeton_hash=eq.'+digest+'&select=id,email,particulier_id&limit=1',{headers:dbHeaders,signal:AbortSignal.timeout(10000)});
      if(!found.ok)return res.status(503).json({message:'Recherche du dossier indisponible'});
      const d=(await found.json())[0];
      if(!d||String(d.email||'').toLowerCase()!==String(user.email||'').toLowerCase())return res.status(403).json({message:'Ce dossier ne correspond pas à votre compte.'});
      if(d.particulier_id&&d.particulier_id!==user.id)return res.status(409).json({message:'Ce dossier est déjà rattaché à un autre compte.'});
      if(!d.particulier_id){
        const update=await fetch(url+'/rest/v1/meca_demandes_unitaires?id=eq.'+encodeURIComponent(d.id)+'&particulier_id=is.null',{
          method:'PATCH',headers:{...dbHeaders,Prefer:'return=representation'},body:JSON.stringify({particulier_id:user.id}),signal:AbortSignal.timeout(10000)});
        if(!update.ok||(await update.json()).length!==1)return res.status(409).json({message:'Dossier déjà rattaché, actualisez la page.'});
      }
      return res.status(200).json({message:'Votre dossier est maintenant visible dans Mes demandes.'});
    }

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
      const payload={email,password,data:{prenom,nom,telephone,profil:'particulier',mecascope_legal_version:'2026-11-24',mecascope_legal_accepted_at:new Date().toISOString(),mecascope_marketing_opt_in:req.body.marketingOptIn===true,mecascope_push_opt_in:req.body.pushOptIn===true}};
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
