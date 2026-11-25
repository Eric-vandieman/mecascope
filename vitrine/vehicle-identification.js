(function(){
 const form=document.getElementById('demande');if(!form)return;
 const grid=form.querySelector('.formgrid');if(!grid)return;
 const brandInput=grid.querySelector('[name="brand"]'),modelInput=grid.querySelector('[name="model"]');
 if(!brandInput||!modelInput)return;
 const block=document.createElement('section');block.className='meca-vehicle-identify';
 block.innerHTML='<label for="meca-vehicle-type">Type de véhicule *</label><select id="meca-vehicle-type" name="vehicleType" required><option value="">Choisissez un véhicule</option><option value="automobile">Automobile</option><option value="moto">Moto</option><option value="scooter">Scooter</option><option value="quad">Quad</option><option value="agricole">Véhicule agricole</option><option value="collection">Véhicule de collection</option></select><fieldset class="meca-identify-method"><legend>Comment identifier votre véhicule ?</legend><label><input type="radio" name="vehicleMethod" value="manual" checked> Marque et modèle</label><label><input type="radio" name="vehicleMethod" value="plate"> Immatriculation</label></fieldset><div id="meca-plate-zone" hidden><label for="meca-plate">Plaque française</label><input id="meca-plate" name="plate" maxlength="12" autocapitalize="characters" placeholder="AA-123-AA" autocomplete="off"><button type="button" id="meca-identify-plate">Identifier mon véhicule</button><p id="meca-plate-status" role="status" aria-live="polite"></p></div><p class="meca-catalog-hint" role="status" aria-live="polite">Sélectionnez une catégorie puis une marque. Vous pourrez saisir une marque ou un modèle rare si absent.</p>';
 grid.before(block);
 const type=block.querySelector('[name="vehicleType"]'),status=block.querySelector('.meca-catalog-hint');
 const brandSelect=document.createElement('select'),modelSelect=document.createElement('select');
 brandSelect.name='brand';modelSelect.name='model';brandSelect.required=true;modelSelect.required=true;
 const brandFallback=document.createElement('input'),modelFallback=document.createElement('input');
 for(const el of [brandFallback,modelFallback]){el.type='text';el.maxLength=120;el.hidden=true;el.disabled=true;el.autocomplete='off'}
 brandFallback.placeholder='Saisissez la marque exacte';modelFallback.placeholder='Saisissez le modèle exact';
 brandSelect.setAttribute('aria-label','Marque du véhicule');modelSelect.setAttribute('aria-label','Modèle du véhicule');
 const oldBrand=brandInput.parentElement,oldModel=modelInput.parentElement;
 oldBrand.replaceChild(brandSelect,brandInput);oldBrand.append(brandFallback);
 oldModel.replaceChild(modelSelect,modelInput);oldModel.append(modelFallback);
 const moreBrand=document.createElement('button'),moreModel=document.createElement('button');
 for(const b of [moreBrand,moreModel]){b.type='button';b.className='meca-vehicle-other'}
 moreBrand.textContent='Ma marque est absente';moreModel.textContent='Mon modèle est absent';
 oldBrand.append(moreBrand);oldModel.append(moreModel);
 const option=(select,text,value)=>{const item=document.createElement('option');item.value=value;item.textContent=text;select.append(item)};
 const reset=(select,placeholder)=>{select.replaceChildren();option(select,placeholder,'');select.disabled=true};
 reset(brandSelect,'Choisissez d’abord un type de véhicule');reset(modelSelect,'Choisissez d’abord une marque');
 function fallback(select,input,button){const show=!select.hidden;select.hidden=show;select.disabled=show;select.required=!show;input.hidden=!show;input.disabled=!show;input.required=show;button.textContent=show?'Revenir à la liste':'Saisie manuelle';if(show)input.focus()}
 moreBrand.addEventListener('click',()=>{fallback(brandSelect,brandFallback,moreBrand);reset(modelSelect,'Saisissez le modèle');if(!modelSelect.hidden)fallback(modelSelect,modelFallback,moreModel)});
 moreModel.addEventListener('click',()=>fallback(modelSelect,modelFallback,moreModel));
 brandFallback.addEventListener('input',()=>{if(!modelSelect.hidden){fallback(modelSelect,modelFallback,moreModel)}});
 let serial=0;
 async function load(action,make){const params=new URLSearchParams({action,type:type.value});if(make)params.set('make',make);const response=await fetch('/api/vehicle-catalog?'+params);if(!response.ok)throw Error('indisponible');return (await response.json()).items||[]}
 type.addEventListener('change',async()=>{const n=++serial;reset(brandSelect,'Chargement des marques…');reset(modelSelect,'Choisissez une marque');if(!type.value)return;status.textContent='Chargement du catalogue…';try{const items=await load('makes');if(n!==serial)return;reset(brandSelect,'Choisissez une marque');for(const item of items)option(brandSelect,item.name,item.id);brandSelect.disabled=false;status.textContent='Catalogue indicatif : certains véhicules anciens ou européens peuvent manquer. Utilisez « Ma marque est absente » si nécessaire.'}catch{status.textContent='Catalogue inaccessible : utilisez la saisie manuelle.';if(!brandSelect.hidden)fallback(brandSelect,brandFallback,moreBrand)}});
 brandSelect.addEventListener('change',async()=>{const n=++serial;reset(modelSelect,'Chargement des modèles…');if(!brandSelect.value)return;try{const items=await load('models',brandSelect.value);if(n!==serial)return;reset(modelSelect,'Choisissez un modèle');for(const item of items)option(modelSelect,item.name,item.name);modelSelect.disabled=false;if(!items.length)status.textContent='Aucun modèle trouvé : utilisez « Mon modèle est absent ».'}catch{status.textContent='Liste des modèles inaccessible : indiquez le modèle manuellement.';if(!modelSelect.hidden)fallback(modelSelect,modelFallback,moreModel)}});
 const plateZone=block.querySelector('#meca-plate-zone');
 for(const radio of block.querySelectorAll('[name="vehicleMethod"]'))radio.addEventListener('change',()=>{plateZone.hidden=radio.value!=='plate'||!radio.checked});
 block.querySelector('#meca-identify-plate').addEventListener('click',async()=>{
  const p=block.querySelector('#meca-plate').value.trim().toUpperCase(),s=block.querySelector('#meca-plate-status');
  if(!/^[A-Z]{2}-?[0-9]{3}-?[A-Z]{2}$/.test(p)){s.textContent='Saisissez une plaque au format AA-123-AA.';return}
  s.textContent='Recherche en cours…';
  try{const response=await fetch('/api/vehicle-plate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plate:p})});const data=await response.json();if(!response.ok){s.textContent=data.message||'Service de plaque indisponible. Utilisez la recherche manuelle.';return} s.textContent='Véhicule identifié : vérifiez les informations.';if(data.make){if(!brandSelect.hidden)fallback(brandSelect,brandFallback,moreBrand);brandFallback.value=data.make}if(data.model){if(!modelSelect.hidden)fallback(modelSelect,modelFallback,moreModel);modelFallback.value=data.model}if(data.year)form.querySelector('[name="year"]').value=data.year;}catch{s.textContent='Service indisponible. Identifiez le véhicule manuellement.'}
 });
 form.addEventListener('submit',e=>{if(!type.value){e.preventDefault();status.textContent='Choisissez le type de véhicule.';}},true);
})();
