'use strict';
(()=>{
const form=document.querySelector('#demande');
if(!form)return;
const status=document.getElementById('meca-request-save-status');
const files=document.getElementById('meca-file-upload'),count=document.getElementById('meca-photo-count'),preview=document.getElementById('meca-photo-preview');
const allowed=new Set(['image/jpeg','image/png','image/webp']);
function setStatus(text,ok=false){if(status){status.textContent=text;status.dataset.ok=ok?'true':'false'}}
function checkFiles(){
 const selected=[...(files?.files||[])];
 const total=selected.reduce((sum,f)=>sum+f.size,0);
 const valid=selected.length<=5&&total<=2300000&&selected.every(f=>allowed.has(f.type)&&f.size<=950000);
 if(files)files.setCustomValidity(valid?'':'Jusqu’à 5 photos JPG, PNG ou WebP, 950 Ko chacune et 2,3 Mo au total.');
 if(count)count.textContent=selected.length+' / 5 photos'+(valid?'':' · Fichiers trop volumineux ou format non accepté');
 if(preview){
  preview.replaceChildren();
  const p=document.createElement('p');p.className='muted small';
  p.textContent=selected.length?selected.map(f=>f.name).join(' · '):'Aucune photo sélectionnée';
  preview.append(p);
 }
 return valid;
}
files?.addEventListener('change',checkFiles);
function readPhoto(file){return new Promise((resolve,reject)=>{
 const reader=new FileReader();
 reader.onerror=()=>reject(Error('Impossible de lire une photo.'));
 reader.onload=()=>{
 const result=String(reader.result||''),data=result.split(',')[1];
 if(!data)return reject(Error('Photo illisible.'));
 resolve({type:file.type,data});
 };
 reader.readAsDataURL(file);
})}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 if(!form.reportValidity()||!checkFiles()){form.reportValidity();return}
 const button=form.querySelector('[type="submit"]');
 if(button)button.disabled=true;
 setStatus('Transmission sécurisée en cours…');
 try{
  const fields=new FormData(form);
  const brandSelect=form.querySelector('select[name="brand"]');
  if(brandSelect&&!brandSelect.hidden&&brandSelect.value)fields.set('brand',brandSelect.selectedOptions[0]?.textContent||'');
  const names=['vehicleType','brand','model','year','engine','trim','vin','fuel','gearbox','ref','part','budget','colourType','notes','contact','email','phone','website'];
  const payload=Object.fromEntries(names.map(name=>[name,String(fields.get(name)||'').trim()]));
  payload.vin=payload.vin.replace(/\s+/g,'').toUpperCase();
  payload.photos=await Promise.all([...(files?.files||[])].map(readPhoto));
  const response=await fetch('/api/demande-piece',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.sent)throw Error(result.message||'La transmission a échoué.');
  let proMessage='';
  try{
   const pro=await fetch('/api/pro-collaboration',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',...payload})});
   if(pro.ok){const record=await pro.json();proMessage=' · Dossier du garage : '+record.id;}
   else if(pro.status!==401&&pro.status!==403)proMessage=' · Le dossier n’a pas été ajouté au tableau de bord Pro.';
  }catch{proMessage=' · Le suivi Pro n’a pas pu être synchronisé.'}
  setStatus('Demande transmise à Mécascope ! Référence : '+result.reference+proMessage,true);
  form.reset();checkFiles();
 }catch(e){setStatus((e&&e.message)||'Erreur d’envoi. La demande n’a pas été confirmée.');}
 finally{if(button)button.disabled=false}
});
})();