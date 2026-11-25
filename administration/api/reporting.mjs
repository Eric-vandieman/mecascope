export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(req.method!=='POST')return res.status(405).end();
try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).end()}catch{return res.status(403).end()}
const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-admin='))?.slice(13);
if(!token)return res.status(401).json({message:'Connexion requise'});
const quoteAction={quote:'admin-quote',success:'admin-success',fail:'admin-fail'}[req.body?.action];
if(quoteAction){
 const b=req.body||{};
 if(!/^[0-9a-f-]{36}$/i.test(String(b.id||'')))return res.status(400).json({message:'Dossier invalide'});
 try{const r=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
  method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
  body:JSON.stringify({action:quoteAction,id:b.id,offre:b.offre,express:b.express,reservation:b.reservation,expressEligible:b.expressEligible,reservationConfirmed:b.reservationConfirmed}),
  signal:AbortSignal.timeout(15000)});
  const answer=await r.json().catch(()=>({message:'Réponse indisponible'}));
  return res.status(r.status).json(answer);
 }catch{return res.status(503).json({message:'La proposition n’a pas pu être transmise.'})}
}
const b=req.body||{},names={reporting:'meca_admin_reporting',messages:'meca_admin_messages',reply:'meca_admin_repondre',chat:'meca_admin_message_qualification'},action=b.action;
if(!names[action])return res.status(400).end();
if(action!=='reporting'&&!/^[0-9a-f-]{36}$/i.test(String(b.id||'')))return res.status(400).end();
const args=action==='messages'?{p_dossier:b.id}:action==='chat'?{p_dossier:b.id,p_contenu:String(b.message||'').trim().slice(0,3000)}:action==='reply'?{p_dossier:b.id,p_contenu:String(b.message||'').trim().slice(0,3000),p_pays:b.found?String(b.country||'').trim():null,p_prix_centimes:b.found?Math.round(Number(b.price)*100):null,p_delai:b.found?String(b.delay||'').trim():null,p_etat:b.found?String(b.condition||'').trim():null,p_compatibilite:b.found?String(b.fit||'').trim():null,p_fournisseur:b.found?String(b.supplier||'').trim():null,p_precisions:String(b.details||'').trim().slice(0,3000)}:{};
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
try{const r=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/'+names[action],{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});if(!r.ok)return res.status(403).json({message:'Accès ou opération refusé (autorisation/paiement initial).'});const data=await r.json();
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
 let emailed=b.found===true;
 if(!b.found)try{const notify=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
  method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
  body:JSON.stringify({action:'admin-notify',id:b.id}),signal:AbortSignal.timeout(12000)});emailed=notify.ok}catch{}
 return res.status(200).json({saved:true,id:data,emailed});
}
return res.status(200).json(data)}catch{return res.status(503).json({message:'Service indisponible'})}
}