'use strict';
/* Messagerie privée de la personne ou partagée entre membres d'un même établissement. */
(function(){
 const form=document.getElementById('meca-message-form');
 const list=document.getElementById('meca-message-list');
 const status=document.getElementById('meca-message-status');
 if(!form||!list||!status)return;
 const isPro=!!document.getElementById('pro-workspace');
 const endpoint=isPro?'/api/pro-collaboration':'/api/particulier-messages';
 const sendData=fields=>isPro?{action:'send-message',...fields}:{action:'send',...fields};
 const details=m=>{
  const card=document.createElement('article');card.className='meca-message-card';
  const head=document.createElement('div');head.className='meca-message-header';
  const title=document.createElement('strong');title.textContent=m.sujet||'Message';
  const sender=document.createElement('small');
  const when=new Date(m.cree_le);
  sender.textContent=(m.type_auteur==='support'?'Équipe Mécascope':(m.auteur||'Votre compte'))+' · '+(Number.isNaN(when.getTime())?'':when.toLocaleString('fr-FR'));
  const body=document.createElement('p');body.textContent=m.contenu||'';
  head.append(title,sender);card.append(head,body);return card
 };
 async function load(){
  const path=isPro?endpoint+'?view=messages':endpoint;
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
  const result=await response.json();
  if(!response.ok)throw Error(result.message||'Impossible de charger la messagerie');
  list.replaceChildren();
  const messages=Array.isArray(result.messages)?result.messages:[];
  if(!messages.length){
   const empty=document.createElement('p');empty.textContent='Aucun message pour le moment.';list.append(empty)
  }else messages.forEach(m=>list.append(details(m)));
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const button=form.querySelector('[type=submit]');button.disabled=true;
  status.textContent='Envoi en cours…';
  try{
   const fields=Object.fromEntries(new FormData(form));
   const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(sendData(fields))});
   const result=await response.json();
   if(!response.ok)throw Error(result.message||'Échec de l’envoi');
   form.reset();status.textContent='Message enregistré dans votre messagerie Mécascope.';
   await load();
  }catch(error){status.textContent=error.message||'Message non envoyé.'}
  finally{button.disabled=false}
 });
 document.querySelectorAll('[data-workspace-tab="messages"],[data-private-tab="messages"]').forEach(b=>b.addEventListener('click',()=>load().catch(error=>{status.textContent=error.message})));
 window.addEventListener('meca-messages-refresh',()=>load().catch(()=>{}));
})();
