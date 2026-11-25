// API privée du répertoire fournisseurs Mécascope
const ENDPOINTS={
 list:'meca_fournisseurs_lister',
 save:'meca_fournisseur_enregistrer',
 contact:'meca_fournisseur_contact',
 response:'meca_fournisseur_reponse',
 dossiers:'meca_fournisseurs_dossiers',
 categories:'meca_fournisseur_categories'
};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Méthode interdite'});
 try{if(new URL(String(req.headers.origin||'')).host!==req.headers.host)return res.status(403).json({message:'Origine interdite'})}
 catch{return res.status(403).json({message:'Origine interdite'})}
 const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-admin='))?.slice(13);
 if(!token)return res.status(401).json({message:'Authentification requise'});
 const b=req.body||{},action=String(b.action||'');
 if(!Object.hasOwn(ENDPOINTS,action))return res.status(400).json({message:'Action inconnue'});
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 const str=(v,n=300)=>String(v??'').trim().slice(0,n);
 let args;
 if(action==='dossiers')args={};
 else if(action==='categories'){
  if(!uuid(b.id)||!Array.isArray(b.categories)||!b.categories.length)return res.status(400).json({message:'Catégories requises'});
  args={p_id:b.id,p_categories:b.categories};
 }
 else if(action==='list'){
  if(b.dossier&&!uuid(b.dossier))return res.status(400).json({message:'Dossier invalide'});
  args={p_dossier:b.dossier||null,p_type:b.type==='professionnel'?'professionnel':'particulier'};
 }else if(action==='save'){
  if(b.id&&!uuid(b.id))return res.status(400).json({message:'Fournisseur invalide'});
  if(str(b.name,161).length<2)return res.status(400).json({message:'Nom requis'});
  args={p_id:b.id||null,p_nom:str(b.name,160),p_categorie:str(b.category,30),p_pays:str(b.country,80)||'France',
   p_specialites:str(b.specialties,450),p_telephone:str(b.phone,55),p_email:str(b.email,180),
   p_site_web:str(b.website,500),p_contact_url:str(b.contactUrl,500),p_source_url:str(b.sourceUrl,500),
   p_note_privee:str(b.notes,2000)};
 }else if(action==='contact'){
  if(!uuid(b.supplier)||!uuid(b.dossier))return res.status(400).json({message:'Fournisseur et dossier obligatoires'});
  const reminder=b.reminder?new Date(b.reminder):null;
  if(reminder&&!Number.isFinite(reminder.getTime()))return res.status(400).json({message:'Date de relance incorrecte'});
  args={p_fournisseur:b.supplier,p_dossier:b.dossier,p_type:b.type==='professionnel'?'professionnel':'particulier',
   p_canal:str(b.channel,20),p_commentaire:str(b.notes,2500),p_relance_le:reminder?.toISOString()||null};
 }else{
  if(!uuid(b.contact))return res.status(400).json({message:'Contact invalide'});
  args={p_contact:b.contact,p_resultat:str(b.outcome,30),p_commentaire:b.notes===undefined?null:str(b.notes,2500)};
 }
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return res.status(503).json({message:'Base fournisseur indisponible'});
 try{
  const response=await fetch(url+'/rest/v1/rpc/'+ENDPOINTS[action],{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
  if(!response.ok){
   const code=response.status;
   return res.status(code===401?401:code===403?403:400).json({
    message:code===401?'Session expirée':code===403?'Accès fournisseur non autorisé':
    'Enregistrement refusé : vérifiez les champs et la référence du dossier.'});
  }
  const body=await response.text();
  return res.status(200).json({result:body?JSON.parse(body):null});
 }catch{return res.status(503).json({message:'Service fournisseurs momentanément indisponible'})}
}
