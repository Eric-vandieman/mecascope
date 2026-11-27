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
function confirmerAlerteEmails(){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-labelledby','meca-spam-title');
  dialog.setAttribute('aria-describedby','meca-spam-message');
  dialog.style.cssText='width:min(94vw,540px);max-height:90vh;overflow:auto;background:#17202a;color:#f5f7f9;border:2px solid #f2a43f;border-radius:16px;padding:26px;box-shadow:0 25px 80px #000a';
  dialog.innerHTML='<h2 id="meca-spam-title" style="margin:0 0 16px;color:#ffb75d;font-size:24px">⚠️ Important : surveillez votre messagerie</h2>'+
   '<div id="meca-spam-message" style="line-height:1.65;font-size:16px"><p><strong>Mécascope répond à chaque demande.</strong> Nous vous adressons une réponse ou une proposition dans les 24 heures suivant sa prise en charge, pendant nos jours d’ouverture.</p>'+
   '<p><strong>Attention :</strong> nos e-mails peuvent parfois arriver dans vos <strong>courriers indésirables (spams)</strong> plutôt que dans votre boîte de réception.</p>'+
   '<p>Si vous ne voyez aucune réponse dans les 24 heures suivant votre demande, <strong>vérifiez vos spams</strong> et recherchez « Mécascope » dans votre messagerie.</p>'+
   '<p>Vous n’avez pas besoin de créer un compte pour recevoir et consulter votre proposition initiale. Le lien personnel reçu par e-mail vous permet d’y répondre.</p>'+
   '<p style="font-size:14px;color:#cfdae5">Pensez à ajouter contact@mécascope.fr à vos contacts ou expéditeurs autorisés.</p></div>';
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin-top:22px';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Retour au formulaire';cancel.style.cssText='padding:12px 16px;border:1px solid #667582;border-radius:9px;background:#283441;color:#fff;cursor:pointer';
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent='J’ai compris, envoyer ma demande';confirm.style.cssText='padding:12px 16px;border:0;border-radius:9px;background:#f4a13e;color:#1a1a1a;font-weight:700;cursor:pointer';
  actions.append(cancel,confirm);dialog.append(actions);document.body.append(dialog);
  let settled=false;
  const finish=answer=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(answer)};
  cancel.onclick=()=>finish(false);confirm.onclick=()=>finish(true);
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false)});
  if(typeof dialog.showModal==='function'){dialog.showModal();confirm.focus()}else{dialog.setAttribute('open','');dialog.style.position='fixed';dialog.style.zIndex='99999';dialog.style.top='12vh';dialog.style.left='50%';dialog.style.transform='translateX(-50%)';confirm.focus()}
 });
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 const phoneValue=String(form.querySelector('[name="phone"]')?.value||'').replace(/[\s().-]/g,'');
 if(!(/^(0[67]\d{8}|(?:\+33|0033)[67]\d{8}|\+(?!33)[1-9]\d{7,14})$/.test(phoneValue))){setStatus('Le numéro de téléphone portable est obligatoire. Pour la France, indiquez un 06 ou 07 valide.');form.querySelector('[name="phone"]')?.focus();return}
 if(!form.reportValidity()||!checkFiles()){form.reportValidity();return}
 if(!(await confirmerAlerteEmails()))return;
 const button=form.querySelector('[type="submit"]');
 if(button)button.disabled=true;
 setStatus('Transmission sécurisée en cours…');
 try{
  const fields=new FormData(form);
  const brandSelect=form.querySelector('select[name="brand"]');
  if(brandSelect&&!brandSelect.hidden&&brandSelect.value)fields.set('brand',brandSelect.selectedOptions[0]?.textContent||'');
  const names=['vehicleType','brand','model','year','engine','trim','vin','fuel','gearbox','ref','part','budget','colourType','notes','contact','email','phone','website'];
  const payload=Object.fromEntries(names.map(name=>[name,String(fields.get(name)||'').trim()]));
  payload.urgent=fields.get('urgent')==='oui';
  payload.vin=payload.vin.replace(/\s+/g,'').toUpperCase();
  payload.photos=await Promise.all([...(files?.files||[])].map(readPhoto));
  const response=await fetch('/api/demande-piece',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.sent)throw Error(result.message||'La transmission a échoué.');
  setStatus((payload.urgent?'🚨 Votre demande urgente est enregistrée. Elle sera examinée pendant nos horaires de traitement.':'Demande transmise à Mécascope !')+' Référence : '+result.reference,true);
  form.reset();checkFiles();
  setStatus((payload.urgent?'🚨 Votre demande urgente est enregistrée.':'Votre demande est enregistrée.')+' Référence : '+result.reference+' IMPORTANT : surveillez votre boîte mail et vos spams. Si vous ne voyez pas de réponse sous 24 heures, vérifiez les courriers indésirables.',true);
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