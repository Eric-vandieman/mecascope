import {measureSms,DEFAULT_SMS} from '../lib/sms-text.mjs';
import {createHash,createHmac} from 'node:crypto';
const cookieName='__Host-mecascope-professional';
const hash=t=>createHash('sha256').update(String(t)).digest('hex');
const offers={
 ciblee:{label:'Recherche ciblée',initial:'STRIPE_PRICE_CIBLEE_INITIAL',balance:'STRIPE_PRICE_CIBLEE_SUCCESS',deposit:19,total:39},
 approfondie:{label:'Recherche approfondie',initial:'STRIPE_PRICE_APPROFONDIE_INITIAL',balance:'STRIPE_PRICE_APPROFONDIE_SUCCESS',deposit:39,total:79},
 expert:{label:'Investigation Expert',initial:'STRIPE_PRICE_EXPERT_INITIAL',balance:'STRIPE_PRICE_EXPERT_SUCCESS',deposit:69,total:149}
};
function cookies(req){const v=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));if(!v)return '';try{return decodeURIComponent(v.slice(cookieName.length+1))}catch{return ''}}
const origin=req=>{try{return new URL(req.headers.origin).host===req.headers.host}catch{return false}};
const safe=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const obj=r=>r.json().catch(()=>null);
const required=()=>['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_PUBLISHABLE_KEY','STRIPE_SECRET_KEY','RESEND_API_KEY','MECASCOPE_MAIL_FROM'].every(x=>!!process.env[x])
  &&/^sk_live_|^rk_live_/.test(process.env.STRIPE_SECRET_KEY||'');
const db=()=>{const k=process.env.SUPABASE_SERVICE_ROLE_KEY;return {base:process.env.SUPABASE_URL.replace(/\/$/,''),headers:{apikey:k,...(k.startsWith('eyJ')?{Authorization:'Bearer '+k}:{}),'Content-Type':'application/json'}}};
async function query(path,opts={}){const config=db();const r=await fetch(config.base+'/rest/v1/'+path,{...opts,headers:{...config.headers,...opts.headers},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Database HTTP '+r.status);return obj(r)}
async function getAdmin(req){
 const bearer=String(req.headers.authorization||'');
 const token=cookies(req)||(bearer.startsWith('Bearer ')?bearer.slice(7):'');if(!token)return false;
 const r=await fetch(db().base+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 if(!r.ok)return false;
 const u=await obj(r);if(!u?.id||!u.email_confirmed_at)return false;
 const a=await query('meca_admins?user_id=eq.'+encodeURIComponent(u.id)+'&select=user_id&limit=1');
 if(Array.isArray(a)&&a.length===1)return true;
 // L'administration historique utilise un autre registre d'habilitation.
 const verify=await fetch(db().base+'/rest/v1/rpc/synthese_administration',{
  method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:'{}',signal:AbortSignal.timeout(10000)});
 return verify.ok;
}
function minimal(d){const offer=offers[d.offre];const negotiatedTotal=Number(d.devis_total_personnalise_centimes)||null;const negotiatedDeposit=Number(d.devis_acompte_personnalise_centimes)||null;const fullAmount=negotiatedTotal!==null?negotiatedTotal/100:offer?.total;const baseDeposit=negotiatedDeposit!==null?negotiatedDeposit/100:offer?.deposit;const expressFee=d.express_option==='24h'?50:d.express_option==='48h'?20:0;const reservationFee=d.reservation_option?10:0;
 const prepaid=d.options_paiement_avance===true;const later=(prepaid?0:(d.express_validee?expressFee:0))+(d.reservation_validee?reservationFee:0);
 const initial=offer?baseDeposit+(prepaid?expressFee:0):null;
 return {reference:d.reference,statut:d.statut,decision:d.devis_decision||'en_attente',offre:offer?.label||null,initial,total:offer?fullAmount:null,solde:offer?fullAmount-baseDeposit+(d.statut==='reussite'||d.statut==='solde_paye'?later:0):null,versionDevis:d.devis_version||1,expressOption:d.express_option||null,reservationOption:!!d.reservation_option,optionsPayeesAvance:prepaid,conditionalMax:(prepaid?0:expressFee)+reservationFee,paid:!!d.initial_paid_at,professional:!!d.garage_id,balancePaid:!!d.solde_paid_at,proposition:d.proposition_texte||null,budgetNonRenseigne:!String(d.details?.budget??'').trim(),sansPlafondConfirme:!!d.sans_plafond_confirme,revisionDemandee:!!d.revision_demandee_le,champsManquants:Object.fromEntries(['engine','trim','vin','fuel','gearbox','ref','budget'].map(k=>[k,!String(d.details?.[k]??'').trim()])),telephoneManquant:!String(d.telephone||'').trim()};}
// Après paiement initial, le suivi privé exige un compte particulier confirmé.
async function clientAccount(req,d){
 if(!d?.initial_paid_at)return false;
 const fromCookie=name=>{
  const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
  if(!raw)return '';try{return decodeURIComponent(raw)}catch{return ''}
 };
 const pub=process.env.SUPABASE_PUBLISHABLE_KEY,root=db().base;
 if(!pub)return false;
 if(d.garage_id){
  const pro=fromCookie('__Host-mecascope-professional');
  if(!pro)return false;
  try{
   const ur=await fetch(root+'/auth/v1/user',{headers:{apikey:pub,Authorization:'Bearer '+pro},signal:AbortSignal.timeout(8000)});
   if(!ur.ok)return false;
   const user=await obj(ur);
   if(!user?.id||!user.email_confirmed_at||user.user_metadata?.profil!=='professionnel')return false;
   const access=await fetch(root+'/rest/v1/rpc/meca_tableau_bord',{method:'POST',
    headers:{apikey:pub,Authorization:'Bearer '+pro,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8500)});
   if(!access.ok)return false;
   const board=await obj(access);
   return board?.garage?.id===d.garage_id&&board.permissions?.view===true;
  }catch{return false}
 }
 const token=fromCookie('__Host-mecascope-particulier');if(!token)return false;
 try{
  const response=await fetch(root+'/auth/v1/user',{headers:{apikey:pub,Authorization:'Bearer '+token},signal:AbortSignal.timeout(9000)});
  if(!response.ok)return false;
  const u=await obj(response);
  return !!(u?.id&&u.email_confirmed_at&&u.user_metadata?.profil==='particulier'&&
   String(u.email||'').toLowerCase()===String(d.email||'').toLowerCase()&&
   (!d.particulier_id||d.particulier_id===u.id));
 }catch{return false}
}
async function dossier(t){
 if(typeof t!=='string'||!(/^[a-f0-9]{64}$/i.test(t))&&!(t.length>=36&&t.length<=80))return null;
 const rows=await query('meca_demandes_unitaires?jeton_hash=eq.'+hash(t)+'&select=*&limit=1');
 return rows?.[0]||null;
}
async function email(to,subject,html,options={}){
 const sender=options.devis?'Mécascope <contact@xn--mcascope-b1a.fr>':process.env.MECASCOPE_MAIL_FROM;
 const plain=String(html).replace(/<[^>]*>/g,' ').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/ +/g,' ').trim();
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
 body:JSON.stringify({from:sender,reply_to:'contact@xn--mcascope-b1a.fr',to:[to],subject,html,text:plain}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Envoi du courriel impossible');
 const d=await obj(r);if(!d?.id)throw Error('Courriel non confirmé');
 return d.id;
}
async function replace(d,status,values,revisionGuard=false){
 const search='meca_demandes_unitaires?id=eq.'+d.id+'&statut=eq.'+status+(revisionGuard?'&devis_decision=eq.'+encodeURIComponent(d.devis_decision)+'&initial_paid_at=is.null&initial_session=is.null':'');
 const rows=await query(search,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...values,modifie_le:new Date().toISOString()})});
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Le dossier a changé entre-temps');
 return rows[0];
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode refusée'});
 const extra=req.method==='GET'?req.query?.action:req.body?.action;
 if(['visit','conversation','send-message'].includes(extra)){
  if(req.method==='POST'&&!origin(req))return res.status(403).json({message:'Origine non autorisée'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({message:'Stockage indisponible'});
  try{
   if(extra==='visit'){
    if(req.method!=='POST')return res.status(405).end();
    const vid=String(req.body?.visitor||''),route=String(req.body?.path||'');
    if(!/^[0-9a-f-]{36}$/i.test(vid)||!/^\/[a-z0-9./-]{0,110}$/i.test(route))return res.status(400).end();
    const visitorHash=createHmac('sha256',process.env.SUPABASE_SERVICE_ROLE_KEY).update(vid).digest('hex');
    await query('meca_visites_site',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({visiteur_hash:visitorHash,chemin:route})});
    return res.status(204).end();
   }
   if(extra==='conversation'&&req.method!=='GET'||extra==='send-message'&&req.method!=='POST')return res.status(405).end();
   const token=String(extra==='conversation'?req.query?.t||'':req.body?.token||'');
   const message=extra==='send-message'?String(req.body?.message||'').trim():null;
   if(!/^[a-f0-9]{64}$/i.test(token)||(message!==null&&(!message||message.length>3000)))return res.status(400).json({message:'Lien ou message incorrect'});
   const entry=await dossier(token);
   if(!entry)return res.status(404).json({message:'Lien de mission invalide'});
   if(entry.initial_paid_at&&!(await clientAccount(req,entry)))return res.status(403).json({message:'Après paiement, connectez-vous à votre espace Mécascope confirmé (particulier ou professionnel selon la demande) pour consulter la conversation et suivre le dossier.'});
   const result=await query('rpc/meca_client_conversation',{method:'POST',body:JSON.stringify({p_jeton:token,p_message:message})});
   if(extra==='send-message'){
     try{await email('contact@xn--mcascope-b1a.fr','Mécascope — réponse client '+safe(result.reference||''),
       '<div style="font:16px Arial"><h2>Réponse d’un client</h2><p>Dossier : '+safe(result.reference||'')+'</p><p>Consultez la conversation dans l’administration Mécascope.</p></div>')}catch{}
   }
   return res.status(200).json(result);
  }catch{return res.status(503).json({message:'Dossier ou service indisponible'})}
 }
 if(!required()||process.env.MECASCOPE_ENABLE_LIVE_BILLING!=='true')
  return res.status(503).json({message:'Service temporairement indisponible'});
 if(req.method==='POST'&&!origin(req))return res.status(403).json({message:'Origine refusée'});
 const b=req.body||{},action=req.method==='GET'?(req.query?.action||'status'):b.action;
 try{
  if(action==='admin-finances'){
    if(req.method!=='POST')return res.status(405).json({message:'Méthode interdite'});
    if(!(await getAdmin(req)))return res.status(403).json({message:'Administration uniquement'});
    if(!process.env.STRIPE_SECRET_KEY)return res.status(503).json({message:'Source Stripe indisponible'});
    try{
  let cursor=null,total=0,month=0,previous=0,count=0,pages=0,exhaustive=false;
  const now=new Date(),monthStart=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1),priorStart=Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1);
  while(pages<20){
   const params=new URLSearchParams({limit:'100',status:'paid'});
   if(cursor)params.set('starting_after',cursor);
   const resp=await fetch('https://api.stripe.com/v1/invoices?'+params.toString(),{headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY},signal:AbortSignal.timeout(12000)});
   if(!resp.ok)return res.status(502).json({message:'Stripe n’a pas confirmé les factures : '+resp.status});
   const payload=await resp.json();
   if(!Array.isArray(payload.data))return res.status(502).json({message:'Réponse Stripe invalide'});
   for(const invoice of payload.data){
    const subscriptionId=invoice.subscription||invoice.parent?.subscription_details?.subscription;
    if(!subscriptionId||!invoice.paid||!invoice.livemode||invoice.status!=='paid'||invoice.currency!=='eur')continue;
    const cents=Math.max(0,Math.round(Number(invoice.amount_paid||0)-Number(invoice.post_payment_credit_notes_amount||0)));
    const settled=(invoice.status_transitions?.paid_at||invoice.created||0)*1000;
    total+=cents;count++;
    if(settled>=monthStart)month+=cents;
    else if(settled>=priorStart)previous+=cents;
   }
   pages++;
   if(!payload.has_more){exhaustive=true;break}
   if(!payload.data.length)break;
   cursor=payload.data[payload.data.length-1].id;
  }
  if(!exhaustive)return res.status(503).json({message:'Historique Stripe partiel : total refusé pour éviter une statistique inexacte'});
  return res.status(200).json({ok:true,source:'stripe_paid_invoices',abonnements_ca_centimes:total,abonnements_ca_mois_centimes:month,abonnements_ca_precedent_centimes:previous,factures_payees:count,exact:true});
    }catch(e){return res.status(503).json({message:'Rapprochement des factures Stripe indisponible'})}
  }
  if(action==='admin-notify'){
    if(!(await getAdmin(req)))return res.status(403).json({message:'Administration uniquement'});
    if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return res.status(400).json({message:'Dossier invalide'});
    const rows=await query('meca_demandes_unitaires?id=eq.'+encodeURIComponent(b.id)+'&select=reference,email,statut&limit=1');
    if(!rows?.length||['echec','refuse','solde_paye'].includes(rows[0].statut))return res.status(409).json({message:'Dossier absent ou clôturé'});
    const d=rows[0];await email(d.email,'Mécascope — nouveau message pour '+d.reference,
      '<div style="font:16px Arial;max-width:550px;margin:auto"><h2>Mécascope</h2><p>Une nouvelle réponse est disponible pour votre dossier <strong>'+safe(d.reference)+'</strong>.</p><p>Consultez votre lien personnel de suivi de mission reçu dans votre précédent courriel Mécascope. Ne communiquez jamais ce lien.</p></div>');
    return res.status(200).json({sent:true});
  }
  if(action==='admin-sms-templates'){
    if(!(await getAdmin(req)))return res.status(403).json({message:'Administration uniquement'});
    if(req.method!=='POST')return res.status(405).json({message:'Méthode non autorisée'});
    const mode=b.mode||'list';
    if(mode==='list'){
      const models=await query('meca_sms_modeles?select=type,message,modifie_le&order=type.asc');
      return res.status(200).json({models:models||[]});
    }
    if(mode!=='save'||!['proposition','piece_trouvee'].includes(b.smsType)||typeof b.message!=='string')
      return res.status(400).json({message:'Modèle de SMS invalide'});
    const message=b.message.trim();
    const info=measureSms(message);
    if(!message||message.length>160||!info.oneSms)
      return res.status(400).json({message:'Un SMS unique doit contenir 160 unités GSM-7 maximum, ou 70 unités Unicode. Retirez des caractères ou des accents avant d’enregistrer.',measure:info});
    const updated=await query('meca_sms_modeles?type=eq.'+b.smsType,{
      method:'PATCH',headers:{Prefer:'return=representation'},
      body:JSON.stringify({message,modifie_le:new Date().toISOString()})
    });
    if(!Array.isArray(updated)||updated.length!==1)
      return res.status(503).json({message:'Enregistrement du modèle non confirmé'});
    return res.status(200).json({saved:true,model:updated[0],measure:info});
  }
  if(action==='admin-sms-claim'){
    if(!(await getAdmin(req)))return res.status(403).json({message:'Administration uniquement'});
    if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return res.status(400).json({message:'Dossier invalide'});
    const smsType=b.smsType??'proposition';
    if(!['proposition','piece_trouvee'].includes(smsType))return res.status(400).json({message:'Type SMS inconnu'});
    const rows=await query('meca_demandes_unitaires?id=eq.'+b.id+'&select=id,telephone,statut,initial_paid_at,solde_paid_at,solde_email_envoye_le&limit=1');
    const dossier=rows?.[0];
    const eligible=smsType==='proposition'?dossier?.statut==='devis_envoye':(
      dossier?.statut==='reussite'&&!!dossier?.initial_paid_at&&!!dossier?.solde_email_envoye_le&&!dossier?.solde_paid_at);
    if(!eligible)return res.status(409).json({message:smsType==='piece_trouvee'?'Acompte ou annonce de résultat non confirmés : SMS interdit.':'Aucune proposition envoyée pour ce dossier'});
    const existing=await query('meca_sms_notifications?dossier_id=eq.'+b.id+'&type=eq.'+smsType+'&select=statut&limit=1');
    if(existing?.length)return res.status(200).json({claimed:false,status:existing[0].statut});
    const numero=String(dossier.telephone||'').trim();
    const insert=await query('meca_sms_notifications?on_conflict=dossier_id,type',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({dossier_id:b.id,type:smsType,telephone:numero,statut:'en_attente'})});
    const claimed=Array.isArray(insert)&&insert.length===1;
    if(!claimed)return res.status(200).json({claimed:false,status:'en_attente'});
    const templates=await query('meca_sms_modeles?type=eq.'+smsType+'&select=message&limit=1');
    const message=String(templates?.[0]?.message||DEFAULT_SMS[smsType]);
    // Un modèle non valide ne doit jamais déclencher un envoi facturable.
    if(!measureSms(message).oneSms)return res.status(409).json({message:'Modèle SMS invalide : envoi bloqué'});
    return res.status(200).json({claimed:true,telephone:numero,message});
   }
   if(action==='admin-sms-complete'){
    if(!(await getAdmin(req)))return res.status(403).json({message:'Administration uniquement'});
    const smsType=b.smsType??'proposition';
    if(!/^[a-f0-9-]{36}$/i.test(String(b.id||''))||!['proposition','piece_trouvee'].includes(smsType)||!['envoye','echec','non_envoye'].includes(b.status))return res.status(400).json({message:'Paramètres invalides'});
    const result=await query('meca_sms_notifications?dossier_id=eq.'+b.id+'&type=eq.'+smsType+'&statut=eq.en_attente',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({statut:b.status,ovh_job_id:String(b.jobId||'').slice(0,100),erreur:String(b.error||'').slice(0,250),modifie_le:new Date().toISOString()})});
    return res.status(200).json({ok:Array.isArray(result)&&result.length===1});
   }
   if(action==='admin-email-tracking'){
   if(!(await getAdmin(req)))return res.status(403).json({message:'Administration uniquement'});
   if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return res.status(400).json({message:'Dossier invalide'});
   const records=await query('meca_demandes_unitaires?id=eq.'+encodeURIComponent(b.id)+'&select=id,devis_email_resend_id,devis_email_envoye_le,devis_email_delivre_le,devis_email_delivre_confirme,devis_email_delivre_verifie_le,devis_page_consultee_le,devis_page_consultations,devis_decision,initial_paid_at,devis_version&limit=1');
   const item=records?.[0];if(!item)return res.status(404).json({message:'Dossier non trouvé'});
   const id=String(item.devis_email_resend_id||'');
   if(/^[0-9a-f-]{36}$/i.test(id)&&process.env.RESEND_API_KEY){
    try{
     const response=await fetch('https://api.resend.com/emails/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY},signal:AbortSignal.timeout(7000)});
     if(response.ok){
      const remote=await response.json();const delivered=remote.last_event==='delivered'||remote.last_event==='opened'||remote.last_event==='clicked'||remote.last_event==='delivery_delayed'?remote.last_event!=='delivery_delayed':remote.last_event==='delivered';
      if(delivered&&!item.devis_email_delivre_confirme){
       const now=new Date().toISOString();
       await query('meca_demandes_unitaires?id=eq.'+b.id+'&devis_email_resend_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({devis_email_delivre_confirme:true,devis_email_delivre_verifie_le:now})});
       item.devis_email_delivre_confirme=true;item.devis_email_delivre_verifie_le=now;
      }
     }
    }catch{}
   }
   return res.status(200).json({ok:true,...item});
  }
  if(action==='admin-list'){
   if(!(await getAdmin(req)))return res.status(403).json({message:'Accès réservé à Mécascope'});
   const rows=await query('meca_demandes_unitaires?select=id,reference,contact,email,telephone,details,offre,statut,express_option,reservation_option,express_validee,reservation_validee,initial_paid_at,solde_paid_at,cree_le&order=cree_le.desc&limit=100');
   return res.status(200).json({dossiers:rows});
  }
  if(['admin-quote','admin-revise-quote','admin-success','admin-fail'].includes(action)){
   if(!(await getAdmin(req)))return res.status(403).json({message:'Accès réservé à Mécascope'});
   if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return res.status(400).json({message:'Identifiant invalide'});
   const rows=await query('meca_demandes_unitaires?id=eq.'+b.id+'&select=*&limit=1');
   const d=rows?.[0];if(!d)return res.status(404).json({message:'Dossier inconnu'});
   if(action==='admin-fail'){
    if(d.statut!=='acompte_paye')return res.status(409).json({message:'Échec uniquement après versement de l’acompte'});
    await replace(d,'acompte_paye',{statut:'echec'});
    return res.status(200).json({ok:true,message:'Recherche clôturée sans solde.'});
   }
   const proposal=String(b.proposal||'').trim();
   if(['admin-quote','admin-revise-quote'].includes(action) && (proposal.length<80||proposal.length>2800||!proposal.includes(d.reference)))return res.status(400).json({message:'Complétez votre proposition personnalisée (80 à 2 800 caractères), avec la référence du dossier.'});
   if(action==='admin-quote' && d.statut==='devis_envoye' && d.proposition_texte && d.proposition_texte!==proposal)return res.status(409).json({message:'Le devis est déjà accessible au paiement. Son argumentaire ne peut être modifié sans une procédure de révision sécurisée.'});
   let plan=d.offre,stage,selectedExpress=null,selectedReservation=false;let revisionData=null;
   if(action==='admin-quote'){
    if(d.revision_demandee_le)return res.status(409).json({message:'Le client a demandé une révision : utilisez Modifier le devis pour envoyer une nouvelle proposition.'});
    if(!['deposee','devis_envoye'].includes(d.statut)||!offers[b.offre]||d.initial_paid_at||d.devis_decision==='accepte')return res.status(409).json({message:'Devis non autorisé'});
    // L'IA recommande sans jamais décider : l'administrateur choisit et confirme la formule.
    const planFige=d.qualification_ia?.formule;
    if(!process.env[offers[b.offre].initial]||!process.env[offers[b.offre].balance])return res.status(503).json({message:'Prix Stripe de cette formule non configurés.'});
    const advertised=d.statut==='devis_envoye'&&d.devis_total_personnalise_centimes?d.devis_total_personnalise_centimes/100:offers[b.offre].total;
    if(!proposal.includes(advertised.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €'))return res.status(409).json({message:'Le message client doit mentionner le montant exact de '+advertised+' €. Envoi bloqué.'});
    if(d.statut==='devis_envoye'&&d.devis_decision!=='en_attente')return res.status(409).json({message:'Devis déjà accepté ou refusé : aucun renvoi ou changement commercial possible.'});
    if(d.statut==='devis_envoye'&&d.offre!==b.offre)return res.status(409).json({message:'Une proposition a déjà été envoyée. Son tarif ne peut plus être modifié pendant qu’un paiement Stripe peut être en cours.'});
    selectedExpress=d.statut==='devis_envoye'?d.express_option:null;
    selectedReservation=d.statut==='devis_envoye'?d.reservation_option:false;
    if(d.statut==='devis_envoye'&&(d.express_option!==selectedExpress||d.reservation_option!==selectedReservation))
      return res.status(409).json({message:'Les options déjà acceptables par paiement ne peuvent plus être modifiées sur ce devis.'});
    plan=b.offre;stage='devis_envoye';
   }else if(action==='admin-revise-quote'){
    if(!['devis_envoye','refuse'].includes(d.statut)||!['en_attente','refuse'].includes(d.devis_decision)||d.initial_paid_at||d.initial_session||d.solde_paid_at)return res.status(409).json({message:'Modification impossible : devis accepté, acompte versé ou paiement déjà engagé.'});
    if(!offers[d.offre])return res.status(409).json({message:'Formule d’origine inconnue'});
    const pricingMode=String(b.pricingMode||'personnalise');
    if(!['formule','personnalise'].includes(pricingMode))return res.status(400).json({message:'Choisissez une formule existante ou un prix personnalisé.'});
    const chosenOffer=pricingMode==='formule'?String(b.offre||''):d.offre;
    if(!offers[chosenOffer])return res.status(400).json({message:'Formule non reconnue'});
    if(pricingMode==='formule'&&(!process.env[offers[plan]?.initial]||!process.env[offers[plan]?.balance])&&(!process.env[offers[chosenOffer].initial]||!process.env[offers[chosenOffer].balance]))return res.status(503).json({message:'Tarifs Stripe de cette formule indisponibles.'});
    const total=pricingMode==='formule'?offers[chosenOffer].total*100:Number(b.totalCentimes);
    const deposit=pricingMode==='formule'?offers[chosenOffer].deposit*100:Number(b.depositCentimes);
    if(!Number.isSafeInteger(total)||!Number.isSafeInteger(deposit)||total<200||total>200000||deposit<100||deposit>=total)return res.status(400).json({message:'Montants invalides : le total doit être supérieur à l’acompte.'});
    const euros=centimes=>(centimes/100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' €';
    if(!proposal.includes(euros(total))||!proposal.includes(euros(deposit))||!proposal.includes(euros(total-deposit))||!proposal.includes(d.reference))return res.status(400).json({message:'Le message doit contenir le numéro de dossier, le nouveau prix, l’acompte et le solde exacts.'});
    if(!proposal.includes('48 h')||!proposal.includes('24 h')||!proposal.includes('10 €'))return res.status(400).json({message:'Les trois options facultatives (Express 48 h, Express 24 h, réservation 10 €) doivent rester expliquées au client.'});
    const version=(Number(d.devis_version)||1)+1;
    plan=chosenOffer;
    revisionData={devis_total_personnalise_centimes:pricingMode==='personnalise'?total:null,devis_acompte_personnalise_centimes:pricingMode==='personnalise'?deposit:null,devis_version:version,
      initial_price:pricingMode==='personnalise'?'custom:'+deposit:process.env[offers[plan].initial],
      solde_price:pricingMode==='personnalise'?'custom:'+(total-deposit):process.env[offers[plan].balance],
      devis_accepte_le:null,devis_refuse_le:null,initial_session:null,solde_session:null,
      express_option:null,reservation_option:false,options_paiement_avance:true,devis_decision:'en_attente',
      proposition_texte:proposal,devis_envoye_le:new Date().toISOString(),revision_demandee_le:null,revision_demande_details:null,
      qualification_ia:d.qualification_ia?.formule?{...d.qualification_ia,revision_commerciale:true,formule_choisie_admin:plan}:null};
    selectedExpress=null;selectedReservation=false;stage='devis_envoye';
   }else{
    if(action==='admin-success'&&d.statut==='reussite'&&d.initial_paid_at&&d.solde_email_envoye_le)return res.status(200).json({ok:true,already:true,message:'Résultat déjà notifié au client.'});
    if(!['acompte_paye','reussite'].includes(d.statut)||!d.initial_paid_at||!offers[plan])return res.status(409).json({message:'Solde interdit tant que l’acompte n’est pas confirmé'});
    const verifiedResult=await query('meca_resultats_fournisseurs?dossier_id=eq.'+d.id+'&select=dossier_id&limit=1');
    if(!verifiedResult?.length)return res.status(409).json({message:'Enregistrez le résultat fournisseur avant de proposer le solde.'});
    if(!String(d.details?.budget??'').trim()&&d.options_paiement_avance===true&&!d.sans_plafond_confirme)return res.status(409).json({message:'Le client doit accepter explicitement la recherche sans budget maximal avant toute facturation du solde.'});
    if((b.expressEligible===true&&!d.express_option)||(b.reservationConfirmed===true&&!d.reservation_option))
      return res.status(409).json({message:'Supplément non accepté dans le devis initial'});
    stage='reussite';
   }
   const currentRevision=revisionData?.devis_version||(action==='admin-quote'?(d.devis_version||1):1);
   const token=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update('meca-unitaire-v1:'+d.id+':'+stage+(currentRevision>1?':revision:'+currentRevision:'')).digest('hex'),offer=offers[plan];
   if(revisionData){
    const oldTotal=d.devis_total_personnalise_centimes||(offers[d.offre]?.total||0)*100;
    const oldDeposit=d.devis_acompte_personnalise_centimes||(offers[d.offre]?.deposit||0)*100;
    await query('meca_devis_historique?on_conflict=dossier_id,version',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({dossier_id:d.id,version:d.devis_version||1,offre:d.offre,total_centimes:oldTotal,acompte_centimes:oldDeposit,proposition_texte:d.proposition_texte})});
   }
   const updated=(action==='admin-success'&&d.statut==='reussite')?d:await replace(d,d.statut,{statut:stage,offre:plan,jeton_hash:hash(token),...(revisionData?revisionData:action==='admin-quote'&&d.statut==='devis_envoye'?{devis_envoye_le:new Date().toISOString()}:action==='admin-quote'?{initial_price:process.env[offer.initial],solde_price:process.env[offer.balance],devis_total_personnalise_centimes:null,devis_acompte_personnalise_centimes:null,express_option:selectedExpress,reservation_option:selectedReservation,options_paiement_avance:true,devis_decision:'en_attente',proposition_texte:proposal}:{express_validee:!d.options_paiement_avance&&b.expressEligible===true,reservation_validee:b.reservationConfirmed===true&&d.reservation_option===true})},!!revisionData);
   const shownTotal=updated.devis_total_personnalise_centimes?updated.devis_total_personnalise_centimes/100:offer.total;
   const shownDeposit=updated.devis_acompte_personnalise_centimes?updated.devis_acompte_personnalise_centimes/100:offer.deposit;
   const shownBalance=shownTotal-shownDeposit;
   const link='https://xn--mcascope-b1a.fr/mission.html?t='+encodeURIComponent(token);
   const text=['admin-quote','admin-revise-quote'].includes(action)?
    '<p>'+(revisionData?'Voici votre nouvelle proposition, qui remplace le devis précédent':'Vous avez reçu une proposition de recherche')+' pour votre dossier <b>'+safe(d.reference)+'</b>.</p><div style="white-space:pre-line;line-height:1.65;padding:12px;border-left:3px solid #ed932d;background:#f8f8f8;color:#222">'+safe(updated.proposition_texte||proposal)+'</div><p><b>Offre : '+safe(offer.label)+' — '+shownTotal+' €</b> (acompte '+shownDeposit+' € ; solde '+shownBalance+' € uniquement en cas de résultat conforme).</p><p>Sur votre formulaire, vous pourrez sélectionner des options facultatives : recherche Express 48 h (+20 €), Express 24 h (+50 €), ou demande de réservation fournisseur (+10 €). Seule l’option Express est ajoutée à l’acompte. La demande de réservation de 10 € est facturée uniquement au solde si une réservation auprès du fournisseur a effectivement été confirmée.</p><p>'+(String(d.details?.budget??'').trim()?'':'<b>Budget de la pièce :</b> aucun montant maximal n’a été renseigné. Une offre fournisseur compatible, effectivement disponible et au prix vérifié pourra valider la mission et rendre exigible le solde de recherche, quel que soit le prix de la pièce. Vous gardez le choix de l’acheter ou non. Cette condition devra être expressément acceptée dans le formulaire.')+'</p><p>Vous pourrez accepter, refuser ou demander une révision de la formule en apportant des renseignements complémentaires, sans obligation.</p>'+(d.garage_id?'<p><b>Après paiement initial :</b> utilisez votre <b>compte professionnel Mécascope</b> pour suivre le dossier, échanger avec nous et régler le solde le cas échéant. Cette prestation est à l’unité, sans abonnement ni crédit Pro consommé.</p>':'<p><b>Après confirmation du paiement initial :</b> pour suivre votre dossier et recevoir nos messages, vous devrez créer votre compte particulier Mécascope (ou vous connecter à votre compte existant) avec cette même adresse e-mail. Nous vous inviterons à activer les notifications sur votre téléphone afin d’être informé rapidement des mises à jour, en complément des e-mails. L’autorisation des notifications reste facultative.</p>'):
    '<h2>Une source a été identifiée</h2><p>Pour votre dossier '+safe(d.reference)+', Mécascope a identifié une source conforme.</p><p>Le solde à régler est de <b>'+(shownBalance+((updated.options_paiement_avance?0:(updated.express_validee?(updated.express_option==='24h'?50:20):0))+(updated.reservation_validee?10:0)))+' €</b>.</p>';
   const isProposal=['admin-quote','admin-revise-quote'].includes(action);
   const heading=isProposal?(revisionData?'Votre devis Mécascope révisé est disponible':'Votre proposition Mécascope est prête'):'Votre recherche Mécascope : résultat disponible';
   const intro=isProposal?'<p>Bonjour,</p><p>Nous avons étudié votre demande concernant le dossier <strong>'+safe(d.reference)+'</strong>. '+(revisionData?'Votre précédent devis est remplacé par cette nouvelle proposition. Le précédent lien ne permet plus de payer.':'Votre proposition est prête.')+' Vous pouvez la consulter, l’accepter ou la refuser, sans engagement.</p>':'<p>Votre dossier <strong>'+safe(d.reference)+'</strong> a été mis à jour.</p>';
   const button='<p style="margin:22px 0"><a href="'+safe(link)+'" style="display:inline-block;background:#ed932d;color:#171717;font-weight:700;padding:14px 20px;border-radius:6px;text-decoration:none">'+(isProposal?'Voir ma proposition, les options ou demander une révision':'Consulter mon dossier')+'</a></p>';
   const reviseCta=isProposal?'<p style="margin:20px 0;padding:14px;border:1px solid #b8a18c;border-radius:9px"><b>Vous disposez de nouvelles informations ?</b><br>Vous pouvez demander une réévaluation de la formule avant de l’accepter, sans payer. <a href="'+safe(link)+'#revision" style="color:#a65b11;font-weight:bold">Demander une révision de ma formule et compléter mon dossier</a>.</p>':'';
   const html='<div style="font:16px/1.55 Arial,sans-serif;color:#202329;max-width:580px;margin:auto"><div style="padding:14px 16px;background:#171b20;color:#ffb25c;font-weight:bold;font-size:23px"><img src="https://xn--mcascope-b1a.fr/logo-officiel-email-20261126.jpg" width="48" height="48" alt="Logo Mécascope" style="width:48px;height:48px;object-fit:contain;vertical-align:middle;margin-right:12px;border-radius:10px">Mécascope</div><h2>'+heading+'</h2>'+intro+(isProposal?'<p><strong>'+safe(offer.label)+' : '+shownTotal+' €</strong> — acompte '+shownDeposit+' €, solde '+shownBalance+' € en cas de résultat conforme.</p>':'')+button+(isProposal?'<p>Vous préférez répondre à ce message ? Notre équipe est joignable à contact@mécascope.fr.</p>':'')+'<div style="border-top:1px solid #ddd;padding-top:14px;margin-top:16px"><h3>Détail du dossier</h3>'+text+'</div>'+reviseCta+'<p style="font-size:13px;color:#52565c">Ne communiquez pas ce lien personnel. Si vous ne retrouvez pas nos messages, vérifiez également les courriers indésirables.</p><p style="text-align:center;border-top:1px solid #ddd;padding-top:17px;margin-top:16px;font-size:15px"><a href="https://xn--mcascope-b1a.fr/" style="color:#a65b11;font-weight:bold;text-decoration:underline">www.mécascope.fr</a></p></div>';
   try{
    const resendId=await email(d.email,heading+' — '+d.reference,html,{devis:isProposal});
    if(isProposal){
     await query('meca_demandes_unitaires?id=eq.'+d.id+'&devis_version=eq.'+String(updated.devis_version||1),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({
       devis_email_resend_id:resendId,devis_email_envoye_le:new Date().toISOString(),devis_email_delivre_le:null,devis_email_delivre_confirme:false,devis_email_delivre_verifie_le:null,
       devis_page_consultee_le:null,devis_page_consultations:0
     })});
    }
   
   }catch(e){return res.status(503).json({message:'Le dossier est enregistré mais le courriel a échoué. Renouvelez l’envoi depuis la console.'})}
   if(action==='admin-success'){
    try{await query('meca_demandes_unitaires?id=eq.'+d.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({solde_email_envoye_le:new Date().toISOString()})})}
    catch{return res.status(503).json({message:'Courriel transmis, confirmation d’envoi non enregistrée. Vérifiez le dossier avant de recommencer.'})}
   }
   return res.status(200).json({ok:true,statut:updated.statut,message:'Proposition transmise au client.'});
  }
  const token=req.method==='GET'?req.query?.t:b.token;
  const d=await dossier(token);
  if(!d)return res.status(404).json({message:'Lien invalide ou expiré'});
  if(action==='proposal-viewed'){
   if(req.method!=='POST')return res.status(405).json({message:'Méthode invalide'});
   if(!origin(req))return res.status(403).json({message:'Origine refusée'});
   if(d.statut!=='devis_envoye'||d.devis_decision==='refuse'||d.initial_paid_at||d.cloture_admin_le)return res.status(200).json({ok:false,reason:'Dossier non éligible'});
   if(d.devis_page_consultee_le)return res.status(200).json({ok:true,already:true});
   const rows=await query('meca_demandes_unitaires?id=eq.'+d.id+'&devis_page_consultee_le=is.null&statut=eq.devis_envoye',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({devis_page_consultee_le:new Date().toISOString(),devis_page_consultations:1})});
   return res.status(200).json({ok:true,recorded:Array.isArray(rows)&&rows.length===1});
  }
  if(action==='status')return res.status(200).json({...minimal(d),accountReady:d.initial_paid_at?await clientAccount(req,d):false});
  if(action==='request-revision'){
   if(req.method!=='POST')return res.status(405).json({message:'Méthode invalide'});
   if(d.statut!=='devis_envoye'||d.devis_decision!=='en_attente'||d.initial_paid_at||d.initial_session||d.revision_demandee_le)
    return res.status(409).json({message:'La révision n’est plus disponible pour ce devis ou elle a déjà été demandée.'});
   const allowed=['engine','trim','vin','fuel','gearbox','ref','budget','telephone'];
   const input=b.fields&&typeof b.fields==='object'&&!Array.isArray(b.fields)?b.fields:{};
   const additions={},old=d.details||{};
   for(const key of Object.keys(input)){
    if(!allowed.includes(key))return res.status(400).json({message:'Champ non reconnu'});
    const value=String(input[key]??'').trim();
    if(!value)continue;
    if(key==='telephone'&&String(d.telephone||'').trim())return res.status(400).json({message:'Téléphone déjà renseigné'});
    if(key!=='telephone'&&String(old[key]??'').trim())return res.status(400).json({message:'Information déjà renseignée : '+key});
    if(value.length>(key==='vin'?17:120))return res.status(400).json({message:'Information trop longue : '+key});
    if(key==='budget'&&(!/^\\d+(?:[.,]\\d{1,2})?$/.test(value)||Number(value.replace(',','.'))<=0))return res.status(400).json({message:'Budget invalide'});
    additions[key]=value;
   }
   const explanation=String(b.explanation||'').trim();
   if(explanation.length>1500||(!explanation&&!Object.keys(additions).length))return res.status(400).json({message:'Ajoutez des renseignements ou une explication de la révision (1 500 caractères maximum).'});
   const details={...old,...Object.fromEntries(Object.entries(additions).filter(([k])=>k!=='telephone'))};
   const body={details,revision_demandee_le:new Date().toISOString(),revision_demande_details:{champs: additions,motif:explanation,version_devis:d.devis_version||1},modifie_le:new Date().toISOString()};
   if(additions.telephone)body.telephone=additions.telephone;
   const rows=await query('meca_demandes_unitaires?id=eq.'+encodeURIComponent(d.id)+'&statut=eq.devis_envoye&devis_decision=eq.en_attente&revision_demandee_le=is.null&initial_paid_at=is.null&initial_session=is.null',{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
   if(rows?.length!==1)return res.status(409).json({message:'Le dossier a changé, rechargez la page.'});
   // L’alerte admin ne doit pas bloquer l’enregistrement de la demande.
   try{await email('contact@xn--mcascope-b1a.fr','Demande de révision client — '+safe(d.reference),'<p>Le client a demandé une révision de sa formule pour le dossier <b>'+safe(d.reference)+'</b>.</p><p>Informations complétées : '+safe(Object.keys(additions).join(', ')||'Aucune')+'</p><p>Motif : '+safe(explanation||'Voir le dossier')+'</p><p>Ouvrez le tableau de bord administrateur Mécascope pour réexaminer la proposition.</p>')}catch{}
   return res.status(200).json({ok:true,message:'Votre demande de révision a été transmise à Mécascope. L’ancien devis est suspendu jusqu’à notre nouvelle proposition.'});
  }

  if(action==='decision'){
   if(req.method!=='POST'||!d.options_paiement_avance)return res.status(409).json({message:'Décision indisponible pour cette proposition'});
   if(d.statut!=='devis_envoye'||d.revision_demandee_le)return res.status(409).json({message:'Ce devis est en révision ou n’est plus en attente de réponse'});
   const choice=String(b.choice||'');
   if(!['accepter','refuser'].includes(choice))return res.status(400).json({message:'Choix invalide'});
   if(choice==='accepter'&&(!Object.hasOwn(b,'express')||!['','24h','48h'].includes(b.express)||!Object.hasOwn(b,'reservation')||typeof b.reservation!=='boolean'))
     return res.status(400).json({message:'Veuillez valider explicitement les choix Express et réservation, y compris si vous ne souhaitez aucune option.'});
   if(choice==='accepter'&&!String(d.details?.budget??'').trim()&&b.sansPlafondConfirme!==true)return res.status(400).json({message:'Veuillez confirmer que sans budget maximal indiqué, une offre qualifiée peut valider la recherche quel que soit le prix de la pièce. L’achat reste facultatif.'});
   if(d.devis_decision!=='en_attente')return res.status(409).json({message:'Votre décision a déjà été enregistrée'});
   const express=choice==='accepter'&&['24h','48h'].includes(b.express)?b.express:null;
   const reservation=choice==='accepter'&&b.reservation===true;
   const values=choice==='refuser'?{statut:'refuse',devis_decision:'refuse',devis_refuse_le:new Date().toISOString()}:
     {devis_decision:'accepte',devis_accepte_le:new Date().toISOString(),express_option:express,reservation_option:reservation,sans_plafond_confirme:!String(d.details?.budget??'').trim()?b.sansPlafondConfirme===true:false};
   const rows=await query('meca_demandes_unitaires?id=eq.'+encodeURIComponent(d.id)+'&statut=eq.devis_envoye&devis_decision=eq.en_attente',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...values,modifie_le:new Date().toISOString()})});
   if(rows?.length!==1)return res.status(409).json({message:'Ce devis a déjà changé, actualisez la page'});
   return res.status(200).json({ok:true,decision:rows[0].devis_decision,statut:rows[0].statut,initial:minimal(rows[0]).initial});
  }

  if(action!=='checkout')return res.status(400).json({message:'Action inconnue'});
  const stage=b.stage,offer=offers[d.offre];
  if(!offer||!['initial','solde'].includes(stage))return res.status(400).json({message:'Paiement invalide'});
  if(stage==='solde'&&!(await clientAccount(req,d)))return res.status(403).json({message:'Connectez-vous à votre espace Mécascope confirmé, particulier ou professionnel selon le dossier, avant de régler le solde.'});
  if(stage==='initial'&&(d.statut!=='devis_envoye'||d.revision_demandee_le||(d.options_paiement_avance&&d.devis_decision!=='accepte'))||stage==='solde'&&d.statut!=='reussite')
   return res.status(409).json({message:'Ce paiement n’est pas disponible pour le dossier'});
  const customPrice=stage==='initial'?d.devis_acompte_personnalise_centimes:(d.devis_total_personnalise_centimes-d.devis_acompte_personnalise_centimes);
  const custom=Number.isSafeInteger(Number(d.devis_total_personnalise_centimes))&&d.devis_total_personnalise_centimes!==null;
  const price=custom?'custom:'+customPrice:process.env[stage==='initial'?offer.initial:offer.balance];
  if(!price||price!==d[stage==='initial'?'initial_price':'solde_price'])
   return res.status(503).json({message:'Tarif du dossier non validé'});
  const params=new URLSearchParams();
  params.set('mode','payment');
  if(custom){params.set('line_items[0][price_data][currency]','eur');params.set('line_items[0][price_data][unit_amount]',String(customPrice));params.set('line_items[0][price_data][product_data][name]','Mécascope — '+d.reference+' — '+(stage==='initial'?'acompte devis révisé':'solde devis révisé'))}
  else params.set('line_items[0][price]',price);
  params.set('line_items[0][quantity]','1');
  const additions=stage==='initial'&&d.options_paiement_avance?
    [d.express_option?(d.express_option==='24h'?'STRIPE_PRICE_EXPRESS_24':'STRIPE_PRICE_EXPRESS_48'):null].filter(Boolean):
    stage==='solde'?
    [!d.options_paiement_avance&&d.express_validee?(d.express_option==='24h'?'STRIPE_PRICE_EXPRESS_24':'STRIPE_PRICE_EXPRESS_48'):null,d.reservation_validee&&d.reservation_option?'STRIPE_PRICE_RESERVATION':null].filter(Boolean):[];
  for(let i=0;i<additions.length;i++){
   const extra=process.env[additions[i]];if(!extra)return res.status(503).json({message:'Tarif de supplément indisponible'});
   params.set('line_items['+(i+1)+'][price]',extra);params.set('line_items['+(i+1)+'][quantity]','1');
  }
  // Une facture Stripe n'est établie qu'après la confirmation d'un paiement réel.
  params.set('billing_address_collection','required');
  params.set('invoice_creation[enabled]','true');
  params.set('invoice_creation[invoice_data][description]','Mécascope — '+d.reference+' — '+(stage==='initial'?'paiement initial':'solde de recherche'));
  params.set('invoice_creation[invoice_data][footer]','Mécascope · Eric Van Dieman EI · SIRET 518 613 617 00035 · TVA non applicable, article 293 B du CGI.');
  params.set('customer_email',d.email);params.set('client_reference_id',d.id);
  params.set('metadata[service]','mecascope_unitaire');params.set('metadata[dossier_id]',d.id);
  params.set('metadata[stage]',stage);params.set('metadata[price_id]',price);
  params.set('payment_intent_data[metadata][dossier_id]',d.id);
  params.set('success_url','https://xn--mcascope-b1a.fr/mission.html?t='+encodeURIComponent(token)+'&paiement=retour&etape='+stage);
  params.set('cancel_url','https://xn--mcascope-b1a.fr/mission.html?t='+encodeURIComponent(token)+'&paiement=annule&etape='+stage);
  const sr=await fetch('https://api.stripe.com/v1/checkout/sessions',{
   method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded',
    'Idempotency-Key':'meca-unitaire-'+stage+'-'+d.id},
   body:params.toString(),signal:AbortSignal.timeout(12000)});
  const session=await obj(sr);
  if(!sr.ok||!session?.url||session.mode!=='payment')return res.status(503).json({message:'Paiement momentanément indisponible'});
  return res.status(200).json({checkoutUrl:session.url});
 }catch{return res.status(503).json({message:'Impossible de traiter cette étape. Aucun paiement supplémentaire confirmé.'})}
}
