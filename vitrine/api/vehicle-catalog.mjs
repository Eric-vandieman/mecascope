// Catalogue public NHTSA vPIC : gratuit mais couverture non exhaustive pour l'Europe, agricoles et anciens.
const TYPES = {automobile:'car',moto:'motorcycle',scooter:'motorcycle',quad:'off-road vehicle',agricole:'tractor',collection:'car'};
export default async function handler(req,res){
  res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=86400');
  const type=String(req.query.type||'automobile');
  if(!TYPES[type])return res.status(400).json({error:'Catégorie invalide'});
  const action=String(req.query.action||'makes');
  const make=String(req.query.make||'');
  if(action!=='makes'&&action!=='models')return res.status(400).json({error:'Action invalide'});
  if(action==='models'&&(!/^[0-9]{1,7}$/.test(make)))return res.status(400).json({error:'Marque invalide'});
  const path=action==='makes'
    ? 'GetMakesForVehicleType/'+encodeURIComponent(TYPES[type])
    : 'GetModelsForMakeId/'+encodeURIComponent(make);
  try{
    const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),9000);
    let upstream;
    try{upstream=await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/'+path+'?format=json',{signal:ac.signal})}finally{clearTimeout(timer)}
    if(!upstream.ok)throw Error('Catalogue indisponible');
    const json=await upstream.json();
    const rows=Array.isArray(json.Results)?json.Results:[];
    const items=rows.map(x=>action==='makes'?{id:String(x.MakeId??x.Make_ID??''),name:String(x.MakeName??x.Make_Name??'')}:{id:String(x.Model_ID??''),name:String(x.Model_Name??'')}).filter(x=>x.name&&(action==='models'||x.id));
    const unique=[...new Map(items.map(x=>[x.name.toLocaleLowerCase('fr'),x])).values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    res.status(200).json({items:unique,source:'NHTSA vPIC',complete:false});
  }catch{res.status(503).json({error:'Catalogue momentanément indisponible',items:[]})}
}
