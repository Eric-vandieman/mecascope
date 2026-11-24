'use strict';
const cookieName='__Host-mecascope-particulier';
function session(header){const part=String(header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));if(!part)return null;try{return decodeURIComponent(part.slice(cookieName.length+1))}catch{return null}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private,no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'Méthode non autorisée'});
 if(req.method==='POST'){
  try{if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({message:'Origine non autorisée'})}catch{return res.status(403).json({message:'Origine non autorisée'})}
 }
 const token=session(req.headers.cookie);
 if(!token)return res.status(401).json({message:'Connexion requise'});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return res.status(503).json({message:'Messagerie momentanément indisponible'});
 const headers={apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
 try{
  const u=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!u.ok)return res.status(401).json({message:'Session expirée'});
  const account=await u.json();
  if(account.user_metadata?.profil!=='particulier')return res.status(403).json({message:'Espace particulier uniquement'});
  const action=req.method==='GET'?'read':req.body?.action;
  const map={read:'meca_messages_lire_particulier',send:'meca_messages_envoyer_particulier'};
  if(!map[action])return res.status(400).json({message:'Action invalide'});
  const b=req.body||{};
  const args=action==='send'?{p_sujet:String(b.subject||'').trim(),p_contenu:String(b.body||'').trim()}:{};
  if(action==='send'&&(!args.p_sujet||args.p_sujet.length>160||!args.p_contenu||args.p_contenu.length>3000))return res.status(400).json({message:'Renseignez le sujet et un message de 3 000 caractères maximum.'});
  const response=await fetch(url+'/rest/v1/rpc/'+map[action],{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok)return res.status(400).json({message:result.message||'Impossible d’enregistrer ce message'});
  return res.status(200).json(action==='read'?{messages:Array.isArray(result)?result:[]}:{id:result,message:'Votre message a bien été enregistré.'});
 }catch{return res.status(503).json({message:'Service de messagerie momentanément indisponible'})}
}