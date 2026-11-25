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
 const token=cookies(req);if(!token)return false;
 const r=await fetch(db().base+'/auth/v1/user',{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 if(!r.ok)return false;
 const u=await obj(r);if(!u?.id||!u.email_confirmed_at)return false;
 const a=await query('meca_admins?user_id=eq.'+encodeURIComponent(u.id)+'&select=user_id&limit=1');
 return Array.isArray(a)&&a.length===1;
}
function minimal(d){const offer=offers[d.offre];const expressMax=d.express_option==='24h'?50:d.express_option==='48h'?20:0;const extra=(d.express_validee?expressMax:0)+(d.reservation_validee?10:0);return {reference:d.reference,statut:d.statut,offre:offer?.label||null,initial:offer?.deposit||null,total:offer?.total||null,solde:offer?offer.total-offer.deposit+(d.statut==='reussite'||d.statut==='solde_paye'?extra:0):null,expressOption:d.express_option||null,reservationOption:!!d.reservation_option,conditionalMax:expressMax+(d.reservation_option?10:0),paid:!!d.initial_paid_at,balancePaid:!!d.solde_paid_at};}
async function dossier(t){
 if(typeof t!=='string'||!(/^[a-f0-9]{64}$/i.test(t))&&!(t.length>=36&&t.length<=80))return null;
 const rows=await query('meca_demandes_unitaires?jeton_hash=eq.'+hash(t)+'&select=*&limit=1');
 return rows?.[0]||null;
}
async function email(to,subject,html){
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
 body:JSON.stringify({from:process.env.MECASCOPE_MAIL_FROM,to:[to],subject,html}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Envoi du courriel impossible');
 const d=await obj(r);if(!d?.id)throw Error('Courriel non confirmé');
}
async function replace(d,status,values){
 const search='meca_demandes_unitaires?id=eq.'+d.id+'&statut=eq.'+status;
 const rows=await query(search,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...values,modifie_le:new Date().toISOString()})});
 if(!Array.isArray(rows)||rows.length!==1)throw Error('Le dossier a changé entre-temps');
 return rows[0];
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode refusée'});
 if(!required()||process.env.MECASCOPE_ENABLE_LIVE_BILLING!=='true')
  return res.status(503).json({message:'Service temporairement indisponible'});
 if(req.method==='POST'&&!origin(req))return res.status(403).json({message:'Origine refusée'});
 const b=req.body||{},action=req.method==='GET'?(req.query?.action||'status'):b.action;
 try{
  if(action==='admin-list'){
   if(!(await getAdmin(req)))return res.status(403).json({message:'Accès réservé à Mécascope'});
   const rows=await query('meca_demandes_unitaires?select=id,reference,contact,email,telephone,details,offre,statut,express_option,reservation_option,express_validee,reservation_validee,initial_paid_at,solde_paid_at,cree_le&order=cree_le.desc&limit=100');
   return res.status(200).json({dossiers:rows});
  }
  if(['admin-quote','admin-success','admin-fail'].includes(action)){
   if(!(await getAdmin(req)))return res.status(403).json({message:'Accès réservé à Mécascope'});
   if(!/^[a-f0-9-]{36}$/i.test(String(b.id||'')))return res.status(400).json({message:'Identifiant invalide'});
   const rows=await query('meca_demandes_unitaires?id=eq.'+b.id+'&select=*&limit=1');
   const d=rows?.[0];if(!d)return res.status(404).json({message:'Dossier inconnu'});
   if(action==='admin-fail'){
    if(d.statut!=='acompte_paye')return res.status(409).json({message:'Échec uniquement après versement de l’acompte'});
    await replace(d,'acompte_paye',{statut:'echec'});
    return res.status(200).json({ok:true,message:'Recherche clôturée sans solde.'});
   }
   let plan=d.offre,stage,selectedExpress=null,selectedReservation=false;
   if(action==='admin-quote'){
    if(!['deposee','devis_envoye'].includes(d.statut)||!offers[b.offre]||d.initial_paid_at)return res.status(409).json({message:'Devis non autorisé'});
    if(d.statut==='devis_envoye'&&d.offre!==b.offre)return res.status(409).json({message:'Une proposition a déjà été envoyée. Son tarif ne peut plus être modifié pendant qu’un paiement Stripe peut être en cours.'});
    selectedExpress=['24h','48h'].includes(b.express)?b.express:null;
    selectedReservation=b.reservation===true;
    if(d.statut==='devis_envoye'&&(d.express_option!==selectedExpress||d.reservation_option!==selectedReservation))
      return res.status(409).json({message:'Les options déjà acceptables par paiement ne peuvent plus être modifiées sur ce devis.'});
    plan=b.offre;stage='devis_envoye';
   }else{
    if(d.statut!=='acompte_paye'||!d.initial_paid_at||!offers[plan])return res.status(409).json({message:'Solde interdit tant que l’acompte n’est pas confirmé'});
    if((b.expressEligible===true&&!d.express_option)||(b.reservationConfirmed===true&&!d.reservation_option))
      return res.status(409).json({message:'Supplément non accepté dans le devis initial'});
    stage='reussite';
   }
   const token=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update('meca-unitaire-v1:'+d.id+':'+stage).digest('hex'),offer=offers[plan];
   const updated=await replace(d,d.statut,{statut:stage,offre:plan,jeton_hash:hash(token),...(action==='admin-quote'?{initial_price:process.env[offer.initial],solde_price:process.env[offer.balance],express_option:selectedExpress,reservation_option:selectedReservation}:{express_validee:b.expressEligible===true,reservation_validee:b.reservationConfirmed===true})});
   const link='https://xn--mcascope-b1a.fr/mission.html?t='+encodeURIComponent(token);
   const text=action==='admin-quote'?
    '<h2>Proposition de recherche Mécascope</h2><p>Votre demande '+safe(d.reference)+' a été examinée.</p><p>Formule : <b>'+safe(offer.label)+'</b>. Tarif total : <b>'+offer.total+' €</b> dont <b>'+offer.deposit+' €</b> pour démarrer après votre accord.</p><p>Le solde ne sera dû que si une source conforme est trouvée.</p>'+ (selectedExpress?'<p>Option Express '+selectedExpress+' : '+(selectedExpress==='24h'?50:20)+' € uniquement si une source conforme est trouvée dans le délai convenu.</p>':'')+(selectedReservation?'<p>Réservation fournisseur : 10 € uniquement après confirmation.</p>':'')+'<p>Vous restez libre d’accepter ou de refuser.</p>':
    '<h2>Une source a été identifiée</h2><p>Pour votre dossier '+safe(d.reference)+', Mécascope a identifié une source conforme.</p><p>Le montant à régler est de <b>'+(offer.total-offer.deposit+(updated.express_validee?(updated.express_option==='24h'?50:20):0)+(updated.reservation_validee?10:0))+' €</b>, comprenant uniquement les suppléments conditionnels convenus et confirmés.</p>';
   try{await email(d.email,'Mécascope — '+(action==='admin-quote'?'votre proposition':'résultat de votre recherche')+' '+d.reference,
    '<div style="font:16px Arial;max-width:580px;margin:auto"><h1>Mécascope</h1>'+text+'<p><a href="'+safe(link)+'" style="display:inline-block;background:#ee922b;color:#171717;padding:14px 22px;text-decoration:none">Consulter et décider</a></p><p>Ne communiquez pas ce lien personnel.</p></div>');
   }catch(e){return res.status(503).json({message:'Le dossier est enregistré mais le courriel a échoué. Renouvelez l’envoi depuis la console.'})}
   return res.status(200).json({ok:true,statut:updated.statut,message:'Proposition transmise au client.'});
  }
  const token=req.method==='GET'?req.query?.t:b.token;
  const d=await dossier(token);
  if(!d)return res.status(404).json({message:'Lien invalide ou expiré'});
  if(action==='status')return res.status(200).json(minimal(d));
  if(action!=='checkout')return res.status(400).json({message:'Action inconnue'});
  const stage=b.stage,offer=offers[d.offre];
  if(!offer||!['initial','solde'].includes(stage))return res.status(400).json({message:'Paiement invalide'});
  if(stage==='initial'&&d.statut!=='devis_envoye'||stage==='solde'&&d.statut!=='reussite')
   return res.status(409).json({message:'Ce paiement n’est pas disponible pour le dossier'});
  const price=process.env[stage==='initial'?offer.initial:offer.balance];
  if(!price||price!==d[stage==='initial'?'initial_price':'solde_price'])
   return res.status(503).json({message:'Tarif du dossier non validé'});
  const params=new URLSearchParams();
  params.set('mode','payment');params.set('line_items[0][price]',price);params.set('line_items[0][quantity]','1');
  if(stage==='solde'){
   const additions=[d.express_validee?(d.express_option==='24h'?'STRIPE_PRICE_EXPRESS_24':'STRIPE_PRICE_EXPRESS_48'):null,
    d.reservation_validee?'STRIPE_PRICE_RESERVATION':null].filter(Boolean);
   for(const key of additions){const extra=process.env[key];if(!extra)return res.status(503).json({message:'Tarif de supplément indisponible'});
    const i=(Number(params.get('line_items_count')||1));params.set('line_items['+i+'][price]',extra);params.set('line_items['+i+'][quantity]','1');params.set('line_items_count',String(i+1));
   }params.delete('line_items_count');
  }
  params.set('customer_email',d.email);params.set('client_reference_id',d.id);
  params.set('metadata[service]','mecascope_unitaire');params.set('metadata[dossier_id]',d.id);
  params.set('metadata[stage]',stage);params.set('metadata[price_id]',price);
  params.set('payment_intent_data[metadata][dossier_id]',d.id);
  params.set('success_url','https://xn--mcascope-b1a.fr/mission.html?t='+encodeURIComponent(token)+'&paiement=retour');
  params.set('cancel_url','https://xn--mcascope-b1a.fr/mission.html?t='+encodeURIComponent(token)+'&paiement=annule');
  const sr=await fetch('https://api.stripe.com/v1/checkout/sessions',{
   method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,'Content-Type':'application/x-www-form-urlencoded',
    'Idempotency-Key':'meca-unitaire-'+stage+'-'+d.id},
   body:params.toString(),signal:AbortSignal.timeout(12000)});
  const session=await obj(sr);
  if(!sr.ok||!session?.url||session.mode!=='payment')return res.status(503).json({message:'Paiement momentanément indisponible'});
  return res.status(200).json({checkoutUrl:session.url});
 }catch{return res.status(503).json({message:'Impossible de traiter cette étape. Aucun paiement supplémentaire confirmé.'})}
}
