import {localBrands,localModels,localMatch} from '../vehicle-models-europe.mjs';

// Catalogue NHTSA + référentiel européen local : vPIC seul ne couvre pas tous les
// véhicules anciens/européens. Le formulaire permet en permanence la saisie libre.
const TYPES={automobile:'car',moto:'motorcycle',scooter:'motorcycle',quad:'off-road vehicle',agricole:'tractor',collection:'car'};
const EURO_CAR=new Set(['automobile','collection']);
const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const uniqueItems=items=>[...new Map(items.filter(x=>x?.name).map(x=>[normalize(x.name),x])).values()].sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true}));
async function vpic(action,type,make){
 const path=action==='makes'?'GetMakesForVehicleType/'+encodeURIComponent(TYPES[type]):
 'GetModelsForMakeIdYear/makeId/'+encodeURIComponent(make)+'/vehicletype/'+encodeURIComponent(TYPES[type]);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7500);
 try{
  const result=await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/'+path+'?format=json',{signal:controller.signal});
  if(!result.ok)throw Error('Source distante indisponible');
  const response=await result.json();
  const rows=Array.isArray(response.Results)?response.Results:[];
  return rows.map(x=>action==='makes'?{id:String(x.MakeId??x.Make_ID??''),name:String(x.MakeName??x.Make_Name??'')}:
    {id:String(x.Model_ID??x.ModelId??''),name:String(x.Model_Name??x.ModelName??'')}).filter(x=>x.name&&(action==='models'||x.id));
 }finally{clearTimeout(timeout)}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=86400');
 if(req.method!=='GET')return res.status(405).json({message:'Méthode interdite'});
 const type=String(req.query.type||'automobile');
 if(!TYPES[type])return res.status(400).json({error:'Catégorie invalide'});
 const action=String(req.query.action||'makes'),make=String(req.query.make||'');
 if(!['makes','models'].includes(action))return res.status(400).json({error:'Action invalide'});
 const isLocal=make.startsWith('local:');
 const localName=isLocal?localMatch(make.slice(6)):null;
 if(action==='models'&&!(localName||/^[0-9]{1,7}$/.test(make)))return res.status(400).json({error:'Marque invalide'});
 const car=EURO_CAR.has(type);
 if(action==='models'&&localName&&car){
  const items=uniqueItems(localModels(localName).map(name=>({id:name,name})));
  return res.status(200).json({items,source:'Mécascope référentiel européen',complete:false,manualEntryAllowed:true});
 }
 let remote=[];
 try{remote=await vpic(action,type,make)}catch(error){
  if(!car||action!=='makes')return res.status(503).json({error:'Catalogue distant indisponible. Utilisez la saisie manuelle.',items:[],manualEntryAllowed:true});
 }
 if(action==='makes'&&car){
  const local=localBrands.map(name=>({id:'local:'+name,name}));
  // Donner priorité au référentiel européen pour les marques qu'il couvre.
  const items=uniqueItems([...remote,...local]);
  return res.status(200).json({items,source:'Mécascope + NHTSA vPIC',complete:false,manualEntryAllowed:true});
 }
 const items=uniqueItems(remote.map(x=>({id:action==='models'?x.name:x.id,name:x.name})));
 return res.status(200).json({items,source:'NHTSA vPIC',complete:false,manualEntryAllowed:true});
}
