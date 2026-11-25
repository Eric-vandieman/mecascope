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
 const valid=selected.length<=5&&total<=50000000&&selected.every(f=>allowed.has(f.type)&&f.size<=20000000);
 if(files)files.setCustomValidity(valid?'':'Jusqu’à 5 photos JPG, PNG ou WebP. Les images sont optimisées automatiquement avant l’envoi.');
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
 const url=URL.createObjectURL(file),image=new Image();
 image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Photo illisible : choisissez une image JPG, PNG ou WebP.'))};
 image.onload=()=>{
  URL.revokeObjectURL(url);
  try{
   const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Impossible de préparer les photos.');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   let quality=.8;
   let data=canvas.toDataURL('image/jpeg',quality).split(',')[1];
   while(data.length>580000&&quality>.36){
    quality=Math.max(.35,quality-.1);
    data=canvas.toDataURL('image/jpeg',quality).split(',')[1];
   }
   if(data.length>900000)throw Error('Cette image est trop détaillée. Choisissez une photo moins volumineuse.');
   resolve({type:'image/jpeg',data});
  }catch(error){reject(error)}
 };
 image.src=url;
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
  setStatus('Demande transmise à Mécascope ! Référence : '+result.reference,true);
  form.reset();checkFiles();
 }catch(e){
  setStatus(((e&&e.message)||'Erreur d’envoi.')+' Aucun envoi n’a été confirmé.');
  // Secours explicite, jamais présenté comme une demande envoyée.
  if(status){
   const parts=new FormData(form);
   const brandSelect=form.querySelector('select[name="brand"]');
   if(brandSelect&&!brandSelect.hidden&&brandSelect.value)parts.set('brand',brandSelect.selectedOptions[0]?.textContent||'');
   const plain=[...parts.entries()].filter(([,v])=>typeof v==='string').map(([k,v])=>k+' : '+v).join('\\n');
   const link=document.createElement('a');link.href='mailto:contact@xn--mcascope-b1a.fr?subject='+encodeURIComponent('Mécascope - demande de pièce')+'&body='+encodeURIComponent(plain);
   link.textContent=' Envoi manuel par e-mail (sans les photos)';link.style.textDecoration='underline';
   status.append(document.createTextNode(' '),link);
  }
 }
 finally{if(button)button.disabled=false}
});
})();