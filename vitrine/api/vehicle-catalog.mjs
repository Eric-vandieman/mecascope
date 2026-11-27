import {localBrands,localModels} from '../vehicle-models-europe.mjs';
import {globalVehicleModels} from '../vehicle-models-global.mjs';
import {supplementalModels} from '../vehicle-models-special.mjs';

// Catalogue multi-sources : VehiclesDB CC-BY 4.0 (2026.11.15), Mécascope,
// puis vPIC NHTSA en complément pour les catégories quads et agricoles.
// Aucune liste ne garantit toutes les variantes de toutes les époques.
// Le formulaire conserve la saisie libre.
const VEHICLE_TYPES={
 automobile:['car','van','truck'],
 moto:['motorcycle'],
 scooter:['moped'],
 quad:[],
 agricole:[],
 collection:['car','van','motorcycle','moped']
};
const NHTSA_TYPES={quad:'off-road vehicle',agricole:'tractor'};
const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
const alphabet=(a,b)=>a.localeCompare(b,'fr',{numeric:true,sensitivity:'base'});
const catalog={};
for(const [type,kinds] of Object.entries(VEHICLE_TYPES)){
 const brands=new Map();
 const add=(brand,models)=>{
  if(!brand||!models?.length)return;
  const key=normalize(brand);
  if(!key)return;
  if(!brands.has(key))brands.set(key,{name:brand,models:new Map()});
  const entry=brands.get(key);
  for(const name of models){
   const n=String(name||'').trim(),modelKey=normalize(n);
   if(modelKey&&!entry.models.has(modelKey))entry.models.set(modelKey,n);
  }
 };
 for(const kind of kinds){
  for(const [brand,models] of Object.entries(globalVehicleModels[kind]||{}))add(brand,models);
 }
 if(type==='automobile'||type==='collection'){
  for(const brand of localBrands)add(brand,localModels(brand));
 }
 for(const [brand,models] of Object.entries(supplementalModels[type]||{}))add(brand,models);
 catalog[type]=brands;
}
const dedupe=items=>[...new Map(items.filter(x=>x.name).map(x=>[normalize(x.name),x])).values()].sort((a,b)=>alphabet(a.name,b.name));
async function remoteVpic(action,type,make){
 const vehicleType=NHTSA_TYPES[type];
 if(!vehicleType)return [];
 const path=action==='makes'
  ?'GetMakesForVehicleType/'+encodeURIComponent(vehicleType)
  :'GetModelsForMakeIdYear/makeId/'+encodeURIComponent(make)+'/vehicletype/'+encodeURIComponent(vehicleType);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),3000);
 try{
  const response=await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/'+path+'?format=json',{signal:controller.signal});
  if(!response.ok)throw Error('Catalogue distant indisponible');
  const data=await response.json();
  return (Array.isArray(data.Results)?data.Results:[]).map(m=>action==='makes'
   ?{id:String(m.MakeId??m.Make_ID??''),name:String(m.MakeName??m.Make_Name??'')}
   :{id:String(m.Model_ID??m.ModelId??''),name:String(m.Model_Name??m.ModelName??'')})
   .filter(x=>x.name&&(action==='models'||/^[0-9]{1,7}$/.test(x.id)));
 }finally{clearTimeout(timeout)}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=86400');
 if(req.method!=='GET')return res.status(405).json({error:'Méthode interdite'});
 const type=String(req.query.type||'automobile'),action=String(req.query.action||'makes');
 const make=String(req.query.make||'');
 if(!Object.hasOwn(VEHICLE_TYPES,type)||!['makes','models'].includes(action))return res.status(400).json({error:'Catégorie ou action inconnue'});
 if(action==='makes'){
  const local=[...catalog[type].values()].map(x=>({id:'local:'+x.name,name:x.name}));
  if(!NHTSA_TYPES[type]){
   return res.status(200).json({items:dedupe(local),source:'VehiclesDB 2026.11.15 + Mécascope',complete:false,manualEntryAllowed:true});
  }
  let remote=[];
  try{remote=await remoteVpic('makes',type,'')}catch{}
  return res.status(200).json({items:dedupe([...remote,...local]),source:'Mécascope + NHTSA vPIC',complete:false,manualEntryAllowed:true});
 }
 if(make.startsWith('local:')){
  const brand=make.slice(6);
  if(brand.length>120)return res.status(400).json({error:'Marque invalide'});
  const data=catalog[type].get(normalize(brand));
  if(!data)return res.status(404).json({error:'Marque non trouvée, utilisez la saisie libre',items:[],manualEntryAllowed:true});
  const items=[...data.models.values()].sort(alphabet).map(name=>({id:name,name}));
  return res.status(200).json({items,source:'VehiclesDB + Mécascope',complete:false,manualEntryAllowed:true});
 }
 if(!NHTSA_TYPES[type]||!/^[0-9]{1,7}$/.test(make))return res.status(400).json({error:'Marque invalide, utilisez la saisie libre',items:[],manualEntryAllowed:true});
 try{
  const remote=await remoteVpic('models',type,make);
  return res.status(200).json({items:dedupe(remote.map(x=>({id:x.name,name:x.name}))),source:'NHTSA vPIC',complete:false,manualEntryAllowed:true});
 }catch{return res.status(503).json({error:'Catalogue temporairement indisponible, saisissez votre modèle',items:[],manualEntryAllowed:true})}
}
