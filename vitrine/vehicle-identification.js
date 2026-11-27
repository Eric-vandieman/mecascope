(()=>{
'use strict';
const form=document.querySelector('#demande');
if(!form)return;
const grid=form.querySelector('.formgrid');
const oldBrand=grid?.querySelector('[name="brand"]'),oldModel=grid?.querySelector('[name="model"]');
if(!oldBrand||!oldModel)return;
const categories=[
 ['automobile','Automobile','🚗'],['moto','Moto','🏍️'],['scooter','Scooter','🛵'],
 ['quad','Quad','🏁'],['agricole','Véhicule agricole','🚜'],['collection','Véhicule de collection','🚘']
];
const section=document.createElement('section');
section.className='meca-vehicle-identify';
section.innerHTML='<fieldset class="meca-vehicle-choices"><legend>1. Quel type de véhicule ? *</legend><div class="meca-vehicle-cards"></div></fieldset><p class="meca-catalog-hint" aria-live="polite">Choisissez votre type de véhicule, puis sa marque et son modèle.</p>';
const cards=section.querySelector('.meca-vehicle-cards');
for(const [value,label,emoji] of categories){
 const item=document.createElement('label');item.className='meca-vehicle-card';
 const radio=document.createElement('input');radio.type='radio';radio.name='vehicleType';radio.value=value;radio.required=true;
 const icon=document.createElement('span');icon.className='meca-vehicle-emoji';icon.textContent=emoji;
 const title=document.createElement('span');title.textContent=label;
 item.append(radio,icon,title);cards.append(item);
}
grid.before(section);
const message=section.querySelector('.meca-catalog-hint');
const brandField=oldBrand.parentElement,modelField=oldModel.parentElement;
const brand=document.createElement('select'),model=document.createElement('select');
brand.name='brand';model.name='model';brand.required=true;model.required=true;
brand.setAttribute('aria-label','Marque du véhicule');model.setAttribute('aria-label','Modèle du véhicule');
const manualBrand=document.createElement('input'),manualModel=document.createElement('input');
for(const input of [manualBrand,manualModel]){
 input.type='text';input.maxLength=120;input.hidden=true;input.disabled=true;input.autocomplete='off';
}
manualBrand.name='brand';manualBrand.placeholder='Saisissez la marque';
manualModel.name='model';manualModel.placeholder='Saisissez le modèle';
brandField.replaceChild(brand,oldBrand);brandField.append(manualBrand);
modelField.replaceChild(model,oldModel);modelField.append(manualModel);
const brandSearch=document.createElement('input'),modelSearch=document.createElement('input');
for(const input of [brandSearch,modelSearch]){input.type='search';input.autocomplete='off';input.hidden=true;input.style.cssText='width:100%;box-sizing:border-box;margin:8px 0;padding:10px;border:1px solid #9b7049;border-radius:7px'}
brandSearch.placeholder='Rechercher une marque (Peugeot, Yamaha, Ferrari…)';
modelSearch.placeholder='Rechercher un modèle (307, MT-07, Outlander…)';
brandSearch.setAttribute('aria-label','Filtrer les marques');modelSearch.setAttribute('aria-label','Filtrer les modèles');
brandField.insertBefore(brandSearch,brand);modelField.insertBefore(modelSearch,model);
let allBrands=[],allModels=[];
const normalized=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const filterItems=(items,text)=>items.filter(item=>normalized(item.name).includes(normalized(text.trim())));
const altBrand=document.createElement('button'),altModel=document.createElement('button');
for(const button of [altBrand,altModel]){button.type='button';button.className='meca-vehicle-other'}
brandField.append(altBrand);modelField.append(altModel);
function options(select,placeholder,items=[]){
 select.replaceChildren();
 const empty=new Option(placeholder,'');select.append(empty);
 for(const item of items)select.append(new Option(item.name,item.id));
 if(items.length)select.append(new Option(select===model?'Mon modèle est absent — le saisir':'Ma marque est absente — la saisir','__manual__'));
 select.disabled=!items.length;
}
function switchMode(kind,manual){
 const select=kind==='brand'?brand:model;
 const input=kind==='brand'?manualBrand:manualModel;
 const button=kind==='brand'?altBrand:altModel;
 const search=kind==='brand'?brandSearch:modelSearch;
 search.hidden=manual||!(kind==='brand'?allBrands:allModels).length;
 select.hidden=manual;select.disabled=manual||select.options.length<2;select.required=!manual;
 input.hidden=!manual;input.disabled=!manual;input.required=manual;
 button.textContent=manual?'Revenir à la liste':kind==='brand'?'Ma marque est absente':'Mon modèle est absent';
 if(manual)input.focus();
}
options(brand,'Choisissez d’abord une catégorie');
options(model,'Choisissez d’abord une marque');
switchMode('brand',false);switchMode('model',false);
altBrand.addEventListener('click',()=>{
 const useManual=manualBrand.hidden;
 allModels=[];modelSearch.value='';modelSearch.hidden=true;
 switchMode('brand',useManual);options(model,'Choisissez d’abord une marque');
 manualModel.value='';switchMode('model',useManual);
});
altModel.addEventListener('click',()=>switchMode('model',manualModel.hidden));
brandSearch.addEventListener('input',()=>{options(brand,'Choisissez une marque',filterItems(allBrands,brandSearch.value));model.value='';allModels=[];modelSearch.value='';modelSearch.hidden=true;options(model,'Choisissez d’abord une marque')});
modelSearch.addEventListener('input',()=>{options(model,'Choisissez un modèle',filterItems(allModels,modelSearch.value))});
let sequence=0;
async function load(action,vehicleType,make){
 const query=new URLSearchParams({action,type:vehicleType,catalogue:'global-20261127-vehiclesdb-v3'});
 if(make)query.set('make',make);
 const response=await fetch('/api/vehicle-catalog?'+query.toString());
 if(!response.ok)throw Error('catalogue indisponible');
 const json=await response.json();
 return json.items||[];
}
for(const radio of section.querySelectorAll('[name="vehicleType"]')){
 radio.addEventListener('change',async()=>{
  const n=++sequence,category=radio.value;
  manualBrand.value='';manualModel.value='';brandSearch.value='';modelSearch.value='';allBrands=[];allModels=[];
  switchMode('brand',false);switchMode('model',false);
  options(brand,'Chargement des marques…');options(model,'Choisissez une marque');
  message.textContent='Chargement des marques…';
  try{
   const items=await load('makes',category);
   if(n!==sequence)return;
   allBrands=items;options(brand,'Choisissez une marque',items);brandSearch.hidden=!items.length;
   message.textContent=items.length?'Sélectionnez une marque. Si elle manque, choisissez « Ma marque est absente ».':'Aucune marque disponible. Utilisez la saisie manuelle.';
   if(!items.length)switchMode('brand',true);
  }catch{
   if(n!==sequence)return;
   message.textContent='Le catalogue ne répond pas : renseignez la marque et le modèle manuellement.';
   switchMode('brand',true);switchMode('model',true);
  }
 });
}
brand.addEventListener('change',async()=>{
 const n=++sequence;
 allModels=[];modelSearch.value='';modelSearch.hidden=true;
 if(brand.value==='__manual__'){
  switchMode('brand',true);switchMode('model',true);
  message.textContent='Indiquez librement la marque et le modèle, même pour un véhicule ancien ou rare.';
  return;
 }
 manualModel.value='';switchMode('model',false);
 options(model,'Chargement des modèles…');
 if(!brand.value)return;
 const type=section.querySelector('[name="vehicleType"]:checked')?.value;
 try{
  const items=await load('models',type,brand.value);
  if(n!==sequence)return;
  allModels=items.map(item=>({id:item.name,name:item.name}));
  options(model,'Choisissez un modèle',allModels);modelSearch.hidden=!allModels.length;
  message.textContent=items.length?'Choisissez votre modèle, y compris les anciennes séries. Sinon sélectionnez « Mon modèle est absent — le saisir ».':'Modèle non répertorié : saisissez-le manuellement.';
  if(!items.length)switchMode('model',true);
 }catch{
  if(n!==sequence)return;
  message.textContent='Modèles indisponibles : saisissez le modèle manuellement.';
  switchMode('model',true);
 }
});
model.addEventListener('change',()=>{if(model.value==='__manual__'){switchMode('model',true);message.textContent='Saisissez votre modèle exact, sans limitation de catalogue.'}});
form.addEventListener('submit',event=>{
 if(!section.querySelector('[name="vehicleType"]:checked')){
  event.preventDefault();message.textContent='Veuillez choisir un type de véhicule.';
 }
},true);
})();