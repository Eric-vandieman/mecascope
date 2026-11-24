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
   const id=await rpc('meca_inviter',{p_hash:hash,p_email:email,p_role:role});
   const link='https://xn--mcascope-b1a.fr/rejoindre-equipe.html?code='+encodeURIComponent(secret);
   return res.status(200).json({id,link,email,role,message:'Invitation générée. Valable 7 jours, utilisable une seule fois.'});
  }
  if(action==='accept'){
   const code=req.body.code;
   if(typeof code!=='string'||code.length<30||code.length>180)return res.status(400).json({message:'Code invalide'});
   return res.status(200).json(await rpc('meca_accepter_invitation',{p_code:code}));
  }
  if(action==='revoke'){
   return res.status(200).json({ok:await rpc('meca_revoquer_invitation',{p_id:req.body.id})});
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