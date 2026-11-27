import {sendProposalSms} from '../lib/ovh-sms.mjs';

const siteApi='https://xn--mcascope-b1a.fr/api/unitaire';
async function sendResultSmsOnce(token,id){
 const action=async payload=>{
  const response=await fetch(siteApi,{
   method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
  const info=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(info.message||'Suivi SMS indisponible ('+response.status+')');
  return info;
 };
 try{
  const claim=await action({action:'admin-sms-claim',id,smsType:'piece_trouvee'});
  if(!claim.claimed)return claim.status||'deja_traite';
  let status='echec',jobId='',error='';
  try{
   const result=await sendProposalSms(claim.telephone,'piece_trouvee',claim.message);
   status='envoye';jobId=result.jobId;
  }catch(e){
   error=String(e?.message||'Envoi SMS non confirmé').slice(0,250);
   if(/portable absent|portable.*invalide/.test(error))status='non_envoye';
  }
  try{await action({action:'admin-sms-complete',id,smsType:'piece_trouvee',status,jobId,error})}
  catch(e){console.error('Mécascope: suivi SMS résultat non confirmé',String(e?.message||e))}
  return status;
 }catch(e){console.error('Mécascope SMS résultat:',String(e?.message||e));return 'suivi_indisponible'}
}
const resultSmsMessage=status=>({
 envoye:' SMS pièce trouvée transmis à OVHcloud.',
 echec:' Attention : SMS pièce trouvée non confirmé.',
 non_envoye:' Aucun portable valide pour envoyer le SMS pièce trouvée.',
 en_attente:' SMS pièce trouvée déjà en cours.',
 suivi_indisponible:' Attention : suivi SMS pièce trouvée indisponible.',
 deja_traite:' SMS pièce trouvée déjà traité.'
}[status]||' SMS pièce trouvée déjà traité ('+status+').');

export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(req.method!=='POST')return res.status(405).end();
try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).end()}catch{return res.status(403).end()}
const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-admin='))?.slice(13);
if(!token)return res.status(401).json({message:'Connexion requise'});
if(req.body?.action==='sms_templates'){
 const b=req.body||{},payload={action:'admin-sms-templates',mode:b.mode||'list'};
 if(payload.mode==='save'){
  payload.smsType=b.smsType;
  payload.message=b.message;
 }
 try{
  const response=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
   method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)
  });
  return res.status(response.status).json(await response.json().catch(()=>({message:'Réponse SMS indisponible'})));
 }catch{return res.status(503).json({message:'Impossible de charger ou enregistrer les modèles SMS.'})}
}
if(req.body?.action==='finance_stripe'){
 try{
  const response=await fetch('https://xn--mcascope-b1a.fr/api/admin-finances',{
   method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:'{}',signal:AbortSignal.timeout(25000)
  });
  return res.status(response.status).json(await response.json().catch(()=>({message:'Statistiques Stripe indisponibles'})));
 }catch{return res.status(503).json({message:'Rapprochement Stripe impossible'})}
}
const quoteAction={quote:'admin-quote',revise_quote:'admin-revise-quote',success:'admin-success',fail:'admin-fail'}[req.body?.action];
if(quoteAction){
 const b=req.body||{};
 if(!/^[0-9a-f-]{36}$/i.test(String(b.id||'')))return res.status(400).json({message:'Dossier invalide'});
 try{const r=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
  method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
  body:JSON.stringify({action:quoteAction,id:b.id,offre:b.offre,express:b.express,reservation:b.reservation,proposal:b.proposal,totalCentimes:b.totalCentimes,depositCentimes:b.depositCentimes,pricingMode:b.pricingMode,expressEligible:b.expressEligible,reservationConfirmed:b.reservationConfirmed}),
  signal:AbortSignal.timeout(15000)});
  const answer=await r.json().catch(()=>({message:'Réponse indisponible'}));
  if(r.ok&&['admin-quote','admin-revise-quote'].includes(quoteAction)){
   const sendAction=async(payload)=>{
    const response=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
     method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
     body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Suivi SMS indisponible ('+response.status+')');
    return response.json();
   };
   try{
    const claim=await sendAction({action:'admin-sms-claim',id:b.id});
    if(claim.claimed){
     let status='echec',jobId='',error='';
     try{const info=await sendProposalSms(claim.telephone,'proposition',claim.message);status='envoye';jobId=info.jobId}
     catch(e){error=String(e?.message||'SMS non confirmé').slice(0,250);if(/portable absent|portable.*invalide/.test(error))status='non_envoye'}
     await sendAction({action:'admin-sms-complete',id:b.id,status,jobId,error});
     answer.smsStatus=status;
    }else answer.smsStatus=claim.status||'deja_traite';
   }catch(e){answer.smsStatus='suivi_indisponible';console.error('Mécascope SMS:',String(e?.message||'erreur de suivi'))}
   const label={envoye:' SMS transmis à OVHcloud.',echec:' Attention : SMS refusé ou non confirmé.',non_envoye:' Attention : aucun portable valide pour ce client.',en_attente:' SMS déjà en cours de traitement.',suivi_indisponible:' Attention : suivi SMS indisponible.',deja_traite:' SMS déjà traité.'}[answer.smsStatus]||' SMS déjà traité ('+answer.smsStatus+').';
   answer.message=(answer.message||'Proposition transmise au client.')+label;
  }
  if(r.ok&&quoteAction==='admin-success'){
   answer.smsResultatStatus=await sendResultSmsOnce(token,b.id);
   answer.message=(answer.message||'Résultat communiqué.')+resultSmsMessage(answer.smsResultatStatus);
  }
  return res.status(r.status).json(answer);
 }catch{return res.status(503).json({message:'La proposition n’a pas pu être transmise.'})}
}
const b=req.body||{},names={demandes_page:'meca_admin_demandes_page',pro_conversations:'meca_admin_conversations_pro',pro_messages:'meca_admin_messages_pro',pro_read:'meca_admin_pro_marquer_lus',pro_reply:'meca_admin_repondre_pro',client_delete:'meca_admin_supprimer_fiche_client',clients:'meca_admin_fichier_clients',reporting:'meca_admin_reporting',pages_stats:'meca_admin_stats_pages',messages:'meca_admin_messages',conversations:'meca_admin_liste_conversations',mark_read:'meca_admin_marquer_messages_lus',reply:'meca_admin_repondre',chat:'meca_admin_message_qualification'},action=b.action;
if(!names[action])return res.status(400).end();
if(!['demandes_page','pro_conversations','client_delete','clients','reporting','pages_stats','conversations'].includes(action)&&!/^[0-9a-f-]{36}$/i.test(String(b.id||'')))return res.status(400).end();
const args=action==='demandes_page'?{p_page:Math.max(1,Math.min(100000,Number(b.page)||1)),p_taille:Math.max(1,Math.min(100,Number(b.size)||20)),p_recherche:String(b.search||'').slice(0,120),p_statut:String(b.status||'tous').slice(0,50),p_type:String(b.type||'tous').slice(0,30)}:['pro_messages','pro_read'].includes(action)?{p_garage:b.id}:action==='pro_reply'?{p_garage:b.id,p_contenu:String(b.message||'').trim().slice(0,3000)}:action==='client_delete'?{p_type:String(b.clientType||''),p_cle:String(b.clientKey||''),p_portee:String(b.scope||''),p_confirmation:String(b.confirmation||'')}:['messages','mark_read'].includes(action)?{p_dossier:b.id}:action==='chat'?{p_dossier:b.id,p_contenu:String(b.message||'').trim().slice(0,3000)}:action==='reply'?{p_dossier:b.id,p_contenu:String(b.message||'').trim().slice(0,3000),p_pays:b.found?String(b.country||'').trim():null,p_prix_centimes:b.found?Math.round(Number(b.price)*100):null,p_delai:b.found?String(b.delay||'').trim():null,p_etat:b.found?String(b.condition||'').trim():null,p_compatibilite:b.found?String(b.fit||'').trim():null,p_fournisseur:b.found?String(b.supplier||'').trim():null,p_precisions:String(b.details||'').trim().slice(0,3000)}:{};
if(action==='client_delete'&&(!['particulier','professionnel'].includes(args.p_type)||!['fiche','complete'].includes(args.p_portee)||args.p_cle.length>320||args.p_cle.length<5||args.p_confirmation!==(args.p_portee==='fiche'?'SUPPRIMER':'EFFACER')))return res.status(400).json({message:'Suppression non confirmée ou paramètres invalides'});
if(action==='pro_reply'&&!args.p_contenu)return res.status(400).json({message:'Message vide'});
if(action==='chat'&&!args.p_contenu)return res.status(400).json({message:'Message vide'});
if(action==='reply'&&(!args.p_contenu||(b.found&&(!args.p_pays||!args.p_delai||!args.p_fournisseur||!Number.isSafeInteger(args.p_prix_centimes)||args.p_prix_centimes<0))))return res.status(400).json({message:'Champs incomplets'});
if(action==='reply'&&b.found){
 try{
  const prep=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/meca_admin_preparer_resultat',{
   method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({p_dossier:b.id,p_pays:args.p_pays,p_prix_centimes:args.p_prix_centimes,p_delai:args.p_delai,p_etat:args.p_etat,p_compatibilite:args.p_compatibilite,p_fournisseur:args.p_fournisseur,p_precisions:args.p_precisions}),
   signal:AbortSignal.timeout(12000)});
  if(!prep.ok)return res.status(409).json({message:'Résultat fournisseur non enregistré. Aucun solde proposé.'});
 }catch{return res.status(503).json({message:'Résultat indisponible. Aucun solde proposé.'})}
 try{const confirmation=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
  method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
  body:JSON.stringify({action:'admin-success',id:b.id,expressEligible:b.expressEligible===true,reservationConfirmed:b.reservationConfirmed===true}),
  signal:AbortSignal.timeout(15000)});
  if(!confirmation.ok)return res.status(409).json({message:'Impossible de confirmer la source et de proposer le solde. Vérifiez les options souscrites.'});
 }catch{return res.status(503).json({message:'Le solde n’a pas pu être proposé, recommencez.'})}
}
try{const r=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/'+names[action],{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});if(!r.ok){const reason=await r.json().catch(()=>({}));return res.status(r.status===400?400:403).json({message:action==='client_delete'?(reason.message||'Suppression refusée pour protéger les données financières.'):'Accès ou opération refusé (autorisation/paiement initial).'})}const data=await r.json();
if(action==='chat'){
 let emailed=false;
 try{
  const notify=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
   method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
   body:JSON.stringify({action:'admin-notify',id:b.id}),signal:AbortSignal.timeout(12000)});
  emailed=notify.ok;
 }catch{}
 return res.status(200).json({saved:true,id:data,emailed,message:emailed?'Message enregistré et e-mail de notification envoyé.':'Message enregistré dans le dossier ; e-mail de notification non confirmé.'});
}
if(action==='reply'){
 let smsResultatStatus=null;
 if(b.found)smsResultatStatus=await sendResultSmsOnce(token,b.id);
 let emailed=b.found===true;
 if(!b.found)try{const notify=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
  method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
  body:JSON.stringify({action:'admin-notify',id:b.id}),signal:AbortSignal.timeout(12000)});emailed=notify.ok}catch{}
 return res.status(200).json({saved:true,id:data,emailed,...(smsResultatStatus?{smsResultatStatus,message:'Résultat enregistré et proposition de solde transmise.'+resultSmsMessage(smsResultatStatus)}:{})});
}
return res.status(200).json(data)}catch{return res.status(503).json({message:'Service indisponible'})}
}