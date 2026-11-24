import {randomBytes,createHash} from 'node:crypto';
const COOKIE='__Host-mecascope-professional';
const cookieToken=h=>{const s=String(h||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return s?decodeURIComponent(s.slice(COOKIE.length+1)):null};
const message=e=>typeof e==='string'?e:'Action impossible';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode non autorisée'});
 if(req.method==='POST'){
  try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({message:'Origine non autorisée'})}catch{return res.status(403).json({message:'Origine non autorisée'})}
 }
 const token=cookieToken(req.headers.cookie);
 if(!token)return res.status(401).json({message:'Connectez-vous à votre compte professionnel'});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return res.status(503).json({message:'Base indisponible'});
 const headers={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 async function rpc(name,args={}){
  const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
  let result;try{result=await r.json()}catch{result=null}
  if(!r.ok)throw new Error(result?.message||result?.details||'Action refusée');
  return result;
 }
 try{
  const response=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!response.ok)return res.status(401).json({message:'Session expirée'});
  const user=await response.json();
  if(user.user_metadata?.profil==='particulier')return res.status(403).json({message:'Accès professionnel uniquement'});
  const action=req.method==='GET'?'dashboard':req.body?.action;
  if(action==='dashboard'){
   let data=await rpc('meca_tableau_bord');
   if(!data?.garage){
    const boot=await rpc('meca_mon_garage');
    if(boot?.garage)data=await rpc('meca_tableau_bord');
   }
   if(!data?.garage)return res.status(409).json({message:'Établissement non rattaché à un compte professionnel. Complétez votre profil ou acceptez une invitation.'});
   return res.status(200).json(data);
  }
  if(action==='invite'){
   const role=req.body.role==='manager'?'manager':'member';
   const email=String(req.body.email||'').trim().toLowerCase()||null;
   if(email&&(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254))return res.status(400).json({message:'Adresse e-mail invalide'});
   const secret=randomBytes(32).toString('base64url');
   const hash=createHash('sha256').update(secret).digest('hex');
   const p=req.body.permissions||{};
   const perms={view:p.view!==false,create:p.create===true,approval:p.approval!==false,spend:p.spend===true};
   const id=await rpc('meca_inviter_v2',{p_hash:hash,p_email:email,p_role:role,p_view:perms.view,p_create:perms.create,p_approval:perms.approval,p_spend:perms.spend});
   const link='https://xn--mcascope-b1a.fr/rejoindre-equipe.html?code='+encodeURIComponent(secret);
   let emailSent=false,emailError=null;
   if(email){
    const apiKey=process.env.RESEND_API_KEY;
    if(apiKey && process.env.MECASCOPE_MAIL_FROM){
     const sender=await rpc('meca_identite_inviteur');
     const inviter=sender?.contact||user.user_metadata?.contact||user.email||'Le responsable';
     const garage=sender?.garage||'votre établissement';
     const safe=x=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
     const textBody=inviter+' vous invite à rejoindre l’équipe de '+garage+' sur Mécascope.\n\nRôle proposé : '+(role==='manager'?'Responsable':'Collaborateur')+'.\nPour accepter (lien personnel valable 7 jours) :\n'+link+'\n\nSi vous ne reconnaissez pas cette invitation, ignorez ce message.';
     const htmlBody='<div style="font-family:Arial;background:#0d1720;color:#fff;padding:30px"><h1 style="color:#ffad58">Mécascope</h1><h2>Invitation à rejoindre une équipe</h2><p>'+safe(inviter)+' vous invite à rejoindre l’équipe de <b>'+safe(garage)+'</b> sur Mécascope.</p><p>Rôle proposé : '+safe(role==='manager'?'Responsable':'Collaborateur')+'</p><p><a style="background:#ef932c;color:#101820;padding:13px 20px;border-radius:8px;display:inline-block" href="'+safe(link)+'">Rejoindre l’équipe</a></p><p>Ce lien personnel expire dans 7 jours.</p></div>';
     const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MECASCOPE_MAIL_FROM,to:[email],subject:'Mécascope — '+inviter+' vous invite à rejoindre son équipe',html:htmlBody,text:textBody}),signal:AbortSignal.timeout(12000)});
     if(sent.ok)emailSent=true;
     else emailError='L’invitation existe, mais l’envoi du courriel a échoué.';
    }else emailError='L’invitation existe. L’expéditeur officiel Mécascope n’est pas encore configuré : partagez le lien ou le QR code.';
   }
   return res.status(200).json({id,link,email,role,emailSent,emailError,permissions:perms,message:emailSent?'Invitation envoyée par Mécascope.':emailError||'Invitation générée. Valable 7 jours, utilisable une seule fois.'});
  }
  if(action==='accept'){
   const code=req.body.code;
   if(typeof code!=='string'||code.length<30||code.length>180)return res.status(400).json({message:'Code invalide'});
   return res.status(200).json(await rpc('meca_accepter_invitation',{p_code:code}));
  }
  if(action==='revoke'){
   return res.status(200).json({ok:await rpc('meca_revoquer_invitation',{p_id:req.body.id})});
  }
  if(action==='permissions'){
   const p=req.body.permissions||{};
   return res.status(200).json({ok:await rpc('meca_modifier_droits',{p_user:req.body.user_id,p_view:p.view===true,p_create:p.create===true,p_approval:p.approval===true,p_spend:p.spend===true})});
  }
  if(action==='approve'){
   return res.status(200).json({ok:await rpc('meca_approbation_recherche',{p_id:req.body.id,p_approve:req.body.approve===true})});
  }
  if(action==='member'){
   return res.status(200).json({ok:await rpc('meca_modifier_membre',{p_user:req.body.user_id,p_role:req.body.role})});
  }
  if(action==='search'){
   const b=req.body;
   const id=await rpc('meca_creer_recherche',{p_marque:b.brand,p_modele:b.model,p_annee:b.year||'',p_piece:b.part,p_reference:b.ref||'',p_budget:b.budget||''});
   return res.status(200).json({id,message:'Recherche enregistrée dans votre tableau de bord professionnel.'});
  }
  if(action==='update-search'){
   const ok=await rpc('meca_modifier_recherche',{p_id:req.body.id,p_statut:req.body.status,p_attribue_a:req.body.assignee||null});
   return res.status(200).json({ok});
  }
  return res.status(400).json({message:'Action non reconnue'});
 }catch(e){
  const error=message(e.message);return res.status(/Droits insuffisants|non rattaché|réservée|expirée|déjà utilisée|déjà enregistré|appartient déjà/.test(error)?403:400).json({message:error});
 }
}