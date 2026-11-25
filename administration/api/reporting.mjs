export default async function handler(req,res){
res.setHeader('Cache-Control','no-store');
if(req.method!=='POST')return res.status(405).end();
try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).end()}catch{return res.status(403).end()}
const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('__Host-admin='))?.slice(13);
if(!token)return res.status(401).json({message:'Connexion requise'});
const b=req.body||{},names={reporting:'meca_admin_reporting',messages:'meca_admin_messages',reply:'meca_admin_repondre'},action=b.action;
if(!names[action])return res.status(400).end();
if(action!=='reporting'&&!/^[0-9a-f-]{36}$/i.test(String(b.id||'')))return res.status(400).end();
const args=action==='messages'?{p_dossier:b.id}:action==='reply'?{p_dossier:b.id,p_contenu:String(b.message||'').trim().slice(0,3000),p_pays:b.found?String(b.country||'').trim():null,p_prix_centimes:b.found?Math.round(Number(b.price)*100):null,p_delai:b.found?String(b.delay||'').trim():null,p_etat:b.found?String(b.condition||'').trim():null,p_compatibilite:b.found?String(b.fit||'').trim():null,p_fournisseur:b.found?String(b.supplier||'').trim():null,p_precisions:String(b.details||'').trim().slice(0,3000)}:{};
if(action==='reply'&&(!args.p_contenu||(b.found&&(!args.p_pays||!args.p_delai||!args.p_fournisseur||!Number.isSafeInteger(args.p_prix_centimes)||args.p_prix_centimes<0))))return res.status(400).json({message:'Champs incomplets'});
try{const r=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/'+names[action],{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});if(!r.ok)return res.status(403).json({message:'Accès ou opération refusé (autorisation/paiement initial).'});const data=await r.json();
if(action==='reply'){
 let emailed=false;
 try{const notify=await fetch('https://xn--mcascope-b1a.fr/api/unitaire',{
  method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://xn--mcascope-b1a.fr','Content-Type':'application/json'},
  body:JSON.stringify({action:'admin-notify',id:b.id}),signal:AbortSignal.timeout(12000)});emailed=notify.ok}catch{}
 return res.status(200).json({saved:true,id:data,emailed});
}
return res.status(200).json(data)}catch{return res.status(503).json({message:'Service indisponible'})}
}