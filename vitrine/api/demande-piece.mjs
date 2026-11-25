import {randomUUID} from 'node:crypto';

const limited=(v,n=140)=>typeof v==='string'?v.trim().slice(0,n):'';
const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&s.length<=254;
const names=['vehicleType','brand','model','year','engine','trim','vin','fuel','gearbox','ref','part','budget','colourType','notes'];
const descriptions={vehicleType:'Catégorie',brand:'Marque',model:'Modèle',year:'Année',engine:'Motorisation / cylindrée',trim:'Version / finition',vin:'VIN / numéro de châssis',fuel:'Énergie',gearbox:'Transmission',ref:'Référence OEM',part:'Pièce recherchée',budget:'Budget maximal',colourType:'Couleur',notes:'Précisions'};
const allowTypes=new Set(['automobile','moto','scooter','quad','agricole','collection']);
// Limiteur de précaution par instance : compléter par une règle WAF distribuée avant une campagne massive.
const attempts=new Map();
function checkOrigin(req){
 try{return req.headers.origin&&new URL(req.headers.origin).host===req.headers.host}catch{return false}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({message:'Méthode non autorisée'});
 if(!checkOrigin(req))return res.status(403).json({message:'Origine non autorisée'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({message:'Format non pris en charge'});
 const b=req.body||{};
 if(b.website)return res.status(400).json({message:'Demande refusée'});
 const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,80);
 const now=Date.now(),entry=attempts.get(ip)||{start:now,count:0};
 if(now-entry.start>60000){entry.start=now;entry.count=0}
 entry.count++;attempts.set(ip,entry);
 if(attempts.size>3000)for(const [key,value] of attempts){if(now-value.start>60000)attempts.delete(key)}
 if(entry.count>4)return res.status(429).json({message:'Trop de demandes successives. Réessayez dans une minute.'});
 const email=limited(b.email,254).toLowerCase(),contact=limited(b.contact,120);
 const phone=limited(b.phone,22);
 if(!validEmail(email)||contact.length<2||!allowTypes.has(b.vehicleType)||!limited(b.brand)||!limited(b.model)||!limited(b.part)||!/^((19|20)\d{2})$/.test(String(b.year||'')))
  return res.status(400).json({message:'Complétez votre nom, e-mail, type de véhicule, marque, modèle, année et pièce recherchée.'});
 if(b.vin && !/^[A-HJ-NPR-Z0-9]{4,17}$/i.test(limited(b.vin,30)))return res.status(400).json({message:'Le VIN indiqué semble incorrect. Corrigez-le ou laissez ce champ vide.'});
 const photos=Array.isArray(b.photos)?b.photos:[];
 if(photos.length>5)return res.status(413).json({message:'Cinq photos maximum.'});
 const allowed=new Set(['image/jpeg','image/png','image/webp']);
 let total=0;
 const attachments=[];
 for(let i=0;i<photos.length;i++){
  const photo=photos[i];
  if(!photo || !allowed.has(photo.type) || typeof photo.data!=='string' || photo.data.length>1350000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.data))
   return res.status(400).json({message:'Photo non valide. Utilisez JPG, PNG ou WebP (950 Ko maximum par photo).'});
  total+=photo.data.length;
  if(total>3200000)return res.status(413).json({message:'Photos trop volumineuses (2,3 Mo cumulés maximum).'});
  attachments.push({filename:'piece-'+(i+1)+'.'+({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[photo.type]),content:photo.data});
 }
 const key=process.env.RESEND_API_KEY,from=process.env.MECASCOPE_MAIL_FROM;
 if(!key||!from)return res.status(503).json({message:'L’envoi sécurisé est momentanément indisponible. Aucun dossier n’a été transmis.'});
 const reference='MECA-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+randomUUID().slice(0,8).toUpperCase();
 const lines=names.map(name=>descriptions[name]+' : '+limited(b[name],800)).join('\n');
 const body='Nouvelle demande Mécascope — '+reference+'\n\n'+lines+'\n\nClient : '+contact+'\nE-mail : '+email+'\nTéléphone : '+phone+'\nPhotos : '+attachments.length;
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({from,to:['contact@xn--mcascope-b1a.fr'],reply_to:email,subject:'Mécascope · Nouvelle demande '+reference,text:body,attachments}),
   signal:AbortSignal.timeout(14000)
  });
  if(!response.ok)return res.status(503).json({message:'L’envoi de votre dossier n’a pas pu être confirmé. Réessayez ou contactez Mécascope.',sent:false});
  const confirmation=await response.json().catch(()=>({}));
  if(!confirmation.id)return res.status(503).json({message:'L’envoi n’a pas pu être confirmé. Vérifiez avec Mécascope avant de réessayer.',sent:false});
  return res.status(200).json({sent:true,reference,message:'Votre demande a été transmise à Mécascope. Conservez votre référence.'});
 }catch{return res.status(503).json({sent:false,message:'Service indisponible. Votre demande n’a pas pu être confirmée.'})}
}
