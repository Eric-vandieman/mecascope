'use strict';
window.mecaSmsModels=async function(main){
 const root=main.querySelector('#meca-sms-editor');if(!root)return;
 const styles=document.createElement('style');
 styles.textContent=`
 #meca-sms-editor{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:18px;margin-top:20px}
 .meca-sms-card{background:#171b21;border:1px solid #57504a;border-radius:15px;padding:22px}
 .meca-sms-card h2{color:#ffbd62;margin:0 0 10px;font-size:19px}
 .meca-sms-card p{line-height:1.55;color:#c5c9d0}
 .meca-sms-card textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;min-height:160px;border-radius:10px;background:#0c1118;color:#fff;border:1px solid #697382;padding:15px;line-height:1.65;font-size:15px}
 .meca-sms-card .meca-sms-counter{font-size:14px;margin:12px 0;color:#cbd1d9}
 .meca-sms-card .meca-sms-counter.invalid{color:#ff8585;font-weight:700}
 .meca-sms-card button{padding:12px 18px;background:#ffac43;border:0;border-radius:9px;font-weight:700;color:#171717;cursor:pointer}
 .meca-sms-card button:disabled{opacity:.45;cursor:not-allowed}
 .meca-sms-card [role=status]{min-height:24px;font-size:14px}
 `;
 root.append(styles);
 const gsm=new Set([...("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")]);
 const ext=new Set([...("^{}\\[~]|€\f")]);
 const measure=v=>{
  let units=0,standard=true;
  for(const c of v){if(gsm.has(c))units++;else if(ext.has(c))units+=2;else{standard=false;break}}
  if(!standard)units=v.length;
  const max=standard?160:70;
  return {units,max,remaining:max-units,standard,valid:v.trim().length>0&&units<=max};
 };
 const call=async payload=>{
  const r=await fetch('/api/reporting',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sms_templates',...payload}),cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.message||'Erreur de connexion');
  return data;
 };
 const types=[['proposition','SMS n° 1 — Proposition envoyée','Envoyé lorsque tu transmets un devis au client.'],['piece_trouvee','SMS n° 2 — Pièce trouvée','Envoyé après acompte confirmé et annonce du résultat.']];
 const cards={};
 for(const [type,title,help] of types){
  const card=document.createElement('section');card.className='meca-sms-card';
  const heading=document.createElement('h2');heading.textContent=title;
  const description=document.createElement('p');description.textContent=help;
  const label=document.createElement('label');label.textContent='Texte envoyé au client';
  const textarea=document.createElement('textarea');textarea.setAttribute('aria-label',title);
  textarea.placeholder='Saisissez votre SMS automatique ici...';
  const counter=document.createElement('p');counter.className='meca-sms-counter';counter.setAttribute('aria-live','polite');
  const button=document.createElement('button');button.type='button';button.textContent='Enregistrer ce SMS';button.disabled=true;
  const status=document.createElement('p');status.setAttribute('role','status');
  let saved='';
  function refresh(){
   const m=measure(textarea.value);counter.classList.toggle('invalid',!m.valid);
   counter.textContent=m.units+' / '+m.max+' unités · '+(m.standard?'SMS standard (GSM-7)':'Unicode (accents/symboles non GSM-7)')+' · '+Math.max(0,m.remaining)+' restantes.'+(m.valid?' 1 SMS.':' Trop long ou vide : enregistrement bloqué.');
   button.disabled=!m.valid||textarea.value.trim()===saved;
  }
  textarea.addEventListener('input',()=>{status.textContent='';refresh()});
  button.addEventListener('click',async()=>{
   if(!measure(textarea.value).valid)return;
   button.disabled=true;status.textContent='Enregistrement...';
   try{
    const data=await call({mode:'save',smsType:type,message:textarea.value});
    saved=data.model.message;textarea.value=saved;status.textContent='Texte enregistré. Il sera utilisé pour les prochains SMS.';
   }catch(e){status.textContent=e.message}
   finally{refresh()}
  });
  card.append(heading,description,label,textarea,counter,button,status);root.append(card);
  cards[type]={textarea,counter,status,refresh,setSaved:value=>{saved=value;textarea.value=value;refresh()}};
 }
 const info=main.querySelector('#meca-sms-load-status');if(info)info.textContent='Chargement des textes enregistrés...';
 try{
  const data=await call({mode:'list'});
  for(const [type] of types){
   const match=(data.models||[]).find(x=>x.type===type);
   if(match)cards[type].setSaved(match.message);
   else{cards[type].status.textContent='Modèle absent : aucun enregistrement possible avant correction.';cards[type].textarea.disabled=true}
  }
  if(info)info.textContent='Les deux messages sont synchronisés avec la base Mécascope.';
 }catch(e){
  for(const type in cards){cards[type].textarea.disabled=true;cards[type].status.textContent='Chargement impossible : '+e.message}
  if(info)info.textContent='Modèles indisponibles : aucune modification enregistrée.';
 }
};
