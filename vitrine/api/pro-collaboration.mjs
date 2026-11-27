import {normalizeMobile} from './ovh-sms.mjs';
import {randomBytes,randomUUID,createHash,createHmac} from 'node:crypto';
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
  const action=req.method==='GET'?(req.query?.view==='credits'?'credits':req.query?.view==='messages'?'messages':req.query?.view==='oneoff'?'oneoff-list':'dashboard'):req.body?.action;
  if(action==='oneoff-list'||action==='oneoff-create'){
   const board=await rpc('meca_tableau_bord');
   if(!board?.garage?.id)return res.status(403).json({message:'Établissement professionnel non rattaché'});
   if(action==='oneoff-list'&&board.permissions?.view!==true)return res.status(403).json({message:'Consultation des recherches non autorisée'});
   if(action==='oneoff-create'&&board.permissions?.create!==true)return res.status(403).json({message:'Création de recherches non autorisée par votre établissement'});
   const admin=process.env.SUPABASE_SERVICE_ROLE_KEY,secret=process.env.STRIPE_WEBHOOK_SECRET;
   if(!admin||!secret)return res.status(503).json({message:'Recherches ponctuelles indisponibles'});
   const dbHeaders={apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{}),'Content-Type':'application/json'};
   const table=url+'/rest/v1/meca_demandes_unitaires';
   if(action==='oneoff-list'){
    const q='?garage_id=eq.'+encodeURIComponent(board.garage.id)+'&select=id,reference,contact,details,offre,statut,devis_decision,urgent,devis_envoye_le,initial_paid_at,solde_paid_at,cree_le&order=cree_le.desc&limit=150';
    const response=await fetch(table+q,{headers:dbHeaders,signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Impossible de récupérer les recherches ponctuelles');
    const rows=await response.json();
    const out=rows.map(row=>{
     const stage=['reussite','solde_paye'].includes(row.statut)?'reussite':'devis_envoye';
     const available=['devis_envoye','acompte_paye','reussite','solde_paye','echec','refuse'].includes(row.statut);
     const token=available?createHmac('sha256',secret).update('meca-unitaire-v1:'+row.id+':'+stage).digest('hex'):null;
     return {reference:row.reference,contact:row.contact,details:row.details,offre:row.offre,statut:row.statut,decision:row.devis_decision,urgent:row.urgent,
      devis_envoye_le:row.devis_envoye_le,acompte_confirme:!!row.initial_paid_at,solde_confirme:!!row.solde_paid_at,cree_le:row.cree_le,
      lien:token?'/mission.html?t='+encodeURIComponent(token):null};
    });
    return res.status(200).json({recherches:out});
   }
   if(req.method!=='POST')return res.status(405).json({message:'Méthode non autorisée'});
   if(!user.id||!user.email_confirmed_at||user.user_metadata?.profil!=='professionnel')return res.status(403).json({message:'Compte professionnel confirmé requis'});
   const b=req.body||{},clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
   const brand=clean(b.brand,100),model=clean(b.model,120),part=clean(b.part,220);
   if(!brand||!model||!part)return res.status(400).json({message:'Marque, modèle et pièce recherchée sont obligatoires'});
   const details={vehicleType:clean(b.vehicleType,80),brand,model,part,year:clean(b.year,4),ref:clean(b.ref,140),
    engine:clean(b.engine,140),vin:clean(b.vin,60),budget:clean(b.budget,40),notes:clean(b.notes,700)};
   const portable=normalizeMobile(b.phone);
   if(!portable)return res.status(400).json({message:'Indiquez un numéro de téléphone portable valide pour recevoir votre proposition.'});
   const reference='MECA-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().slice(0,8).toUpperCase();
   const contact=String(user.user_metadata?.contact||board.garage.contact||board.garage.nom||'Contact professionnel').slice(0,140);
   const record={reference,contact,email:String(user.email).toLowerCase(),telephone:portable,
    details,urgent:b.urgent===true,statut:'deposee',garage_id:board.garage.id,pro_createur_id:user.id};
   const saved=await fetch(table,{method:'POST',headers:{...dbHeaders,Prefer:'return=representation'},body:JSON.stringify(record),signal:AbortSignal.timeout(12000)});
   if(!saved.ok)throw Error('Enregistrement de la recherche impossible');
   return res.status(200).json({reference,message:'Demande à l’unité enregistrée. Mécascope vous enverra une proposition avant tout paiement. Aucun crédit Pro consommé.'});
  }
  if(action==='messages'){
   const messages=await rpc('meca_messages_lire_pro');
   return res.status(200).json({messages:Array.isArray(messages)?messages:[]});
  }
  if(action==='send-message'){
   const subject=String(req.body.subject||'').trim(),body=String(req.body.body||'').trim();
   if(!subject||subject.length>160||!body||body.length>3000)return res.status(400).json({message:'Sujet et message requis (3 000 caractères maximum)'});
   const id=await rpc('meca_messages_envoyer_pro',{p_sujet:subject,p_contenu:body});
   return res.status(200).json({id,message:'Votre message a été enregistré dans la messagerie Mécascope.'});
  }
  if(action==='credits'){
   const value=await rpc('meca_solde_credits');
   if(!Number.isSafeInteger(value)||value<0)return res.status(409).json({message:'Solde indisponible pour ce compte.'});
   return res.status(200).json({credits:value});
  }
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
     try{
     const sender=await rpc('meca_identite_inviteur');
     const inviter=sender?.contact||user.user_metadata?.contact||user.email||'Le responsable';
     const garage=sender?.garage||'votre établissement';
     const safe=x=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
     const textBody='Bonjour,\\n\\n'+inviter+' vous invite à rejoindre l’équipe de '+garage+' sur Mécascope.\\n\\nPour créer votre compte collaborateur, utilisez votre invitation personnelle :\\n'+link+'\\n\\nVous n’avez pas besoin de saisir le SIRET de votre entreprise : votre accès sera associé à son équipe. Si une confirmation de votre adresse est requise, suivez les indications reçues pour activer votre accès.\\n\\nCe lien est valable 7 jours et ne peut être utilisé qu’une seule fois. Si vous n’êtes pas concerné, vous pouvez ignorer ce message.\\n\\nMécascope — Service proposé par Zoralys Studio\\nhttps://mécascope.fr';
     const htmlBody='<div style="font-family:Arial,Helvetica,sans-serif;max-width:590px;margin:auto;padding:28px;color:#202731;background:#ffffff"><p style="font-size:24px;font-weight:800;color:#121d2b">Mécascope</p><h1 style="font-size:21px;line-height:1.4">Vous êtes invité à rejoindre une équipe professionnelle</h1><p>Bonjour,</p><p><strong>'+safe(inviter)+'</strong> vous invite à rejoindre l’équipe de <strong>'+safe(garage)+'</strong> sur Mécascope.</p><p>Créez votre compte collaborateur avec votre nom, votre téléphone et votre adresse e-mail. Votre accès sera rattaché à l’établissement, sans nouveau SIRET.</p><p style="margin:30px 0"><a style="background:#ee922b;color:#161616;padding:13px 22px;border-radius:7px;text-decoration:none;font-weight:bold" href="'+safe(link)+'">Créer mon compte collaborateur</a></p><p style="font-size:13px;color:#5d6975">Ce lien personnel reste valide 7 jours. Si vous n’attendez pas cette invitation, ignorez ce message.</p><hr style="border:0;border-top:1px solid #e2e5e9;margin:25px 0"><p style="font-size:12px;color:#68737d">Mécascope — Zoralys Studio<br>https://mécascope.fr</p></div>';
     const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.MECASCOPE_MAIL_FROM,to:[email],subject:'Mécascope — '+inviter+' vous invite à rejoindre son équipe',html:htmlBody,text:textBody}),signal:AbortSignal.timeout(12000)});
     if(sent.ok)emailSent=true;
     else emailError='L’invitation existe, mais l’envoi du courriel a échoué. Vérifiez la configuration du domaine Mécascope.';
     }catch{emailError='L’invitation existe, mais le service d’envoi n’a pas répondu. Partagez le lien ou le QR code.'}
    }else emailError='L’invitation existe. L’expéditeur officiel Mécascope n’est pas encore configuré : partagez le lien ou le QR code.';
   }
   return res.status(200).json({id,link,email,role,emailSent,emailError,permissions:perms,message:emailSent?'Invitation envoyée par Mécascope.':emailError||'Invitation générée. Valable 7 jours, utilisable une seule fois.'});
  }
  if(action==='invite-accepted'){
   const code=req.body.code;
   if(typeof code!=='string'||code.length<30||code.length>180)return res.status(400).json({message:'Invitation invalide'});
   return res.status(200).json({accepted:await rpc('meca_invitation_est_acceptee',{p_code:code})});
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
   const detail=[['Catégorie',b.vehicleType],['Motorisation',b.engine],['Version',b.trim],['VIN',b.vin],['Énergie',b.fuel],['Transmission',b.gearbox],['Couleur',b.colourType],['Précisions',b.notes]].filter(x=>typeof x[1]==='string'&&x[1].trim()).map(([k,v])=>k+' : '+v.trim().slice(0,250)).join(' | ');
   const part=String(b.part||'').trim().slice(0,220);
   if(!part||!String(b.brand||'').trim()||!String(b.model||'').trim())return res.status(400).json({message:'Véhicule et pièce requis'});
   const id=await rpc('meca_creer_recherche',{p_marque:String(b.brand).slice(0,120),p_modele:String(b.model).slice(0,120),p_annee:String(b.year||'').slice(0,4),p_piece:(part+(detail?' — '+detail:'' )).slice(0,490),p_reference:String(b.ref||'').slice(0,140),p_budget:String(b.budget||'').slice(0,40)});
   return res.status(200).json({id,message:'Recherche enregistrée dans votre tableau de bord professionnel.'});
  }
  if(action==='update-search'){
   if(Object.hasOwn(req.body,'status'))return res.status(403).json({message:'Les statuts de mission sont réservés à Mécascope.'});
   const current=await rpc('meca_tableau_bord');
   const item=(current.recherches||[]).find(x=>x.id===req.body.id);
   if(!item)return res.status(404).json({message:'Recherche introuvable ou non autorisée'});
   const ok=await rpc('meca_modifier_recherche',{p_id:item.id,p_statut:item.statut,p_attribue_a:req.body.assignee||null});
   return res.status(200).json({ok});
  }
  return res.status(400).json({message:'Action non reconnue'});
 }catch(e){
  const error=message(e.message);return res.status(/Droits insuffisants|non rattaché|réservée|expirée|déjà utilisée|déjà enregistré|appartient déjà/.test(error)?403:400).json({message:error});
 }
}