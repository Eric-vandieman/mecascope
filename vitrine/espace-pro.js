'use strict';
const service='/api/pro-auth';
const collab='/api/pro-collaboration';
const workspace=document.getElementById('pro-workspace');
const loading=document.getElementById('workspace-loading');
const tabs=[...document.querySelectorAll('[data-workspace-tab]')];
const panels=[...document.querySelectorAll('[data-workspace-panel]')];
let current={};
const labelStatus=(id,message)=>{const el=document.getElementById(id);if(el)el.textContent=message||''};
function node(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x}
function showTab(name){
 tabs.forEach(b=>{const active=b.dataset.workspaceTab===name;b.classList.toggle('is-active',active);b.setAttribute('aria-current',active?'page':'false')});
 panels.forEach(p=>p.hidden=p.dataset.workspacePanel!==name);
 if(['recherches','equipe'].includes(name))refresh().catch(()=>{});
}
tabs.forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.workspaceTab)));
document.querySelectorAll('[data-workspace-go]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.workspaceGo)));
function fill(id,fields){const d=document.getElementById(id);if(!d)return;d.replaceChildren();for(const [key,value] of fields){if(!value)continue;d.append(node('dt',key),node('dd',String(value)))}}
async function request(action,fields){
 const r=await fetch(collab,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...fields})});
 const data=await r.json();if(!r.ok)throw Error(data.message||'Demande refusée');return data
}
async function refresh(){
 const response=await fetch(collab,{credentials:'same-origin',cache:'no-store'});
 let data;try{data=await response.json()}catch{data={}};
 if(!response.ok)throw Error(data.message||'Service indisponible');
 current=data;drawTeam();drawSearches();return data
}
function drawTeam(){
 const team=document.getElementById('team-members'),pending=document.getElementById('team-pending');
 if(!team||!pending)return;
 team.replaceChildren();pending.replaceChildren();
 const own=current.role==='owner',canInvite=own||current.role==='manager';
 document.getElementById('team-invite-zone').hidden=!canInvite;
 document.getElementById('team-role').querySelector('option[value=manager]').disabled=!own;
 for(const member of current.membres||[]){
  const card=node('div',undefined,'meca-team-entry');
  const info=node('div');info.append(node('strong',member.nom||member.email||'Collaborateur'),node('small',(member.email||'')+' · '+({owner:'Titulaire',manager:'Responsable',member:'Collaborateur'}[member.role]||member.role)));
  card.append(info);
  if(own&&member.role!=='owner'){
   const select=node('select');select.setAttribute('aria-label','Rôle de '+(member.nom||member.email));
   for(const [value,label] of [['member','Collaborateur'],['manager','Responsable'],['remove','Retirer de l’équipe']]){
    const op=node('option',label);op.value=value;select.append(op)
   }
   select.value=member.role;
   select.addEventListener('change',async()=>{
    if(select.value==='remove'&&!confirm('Retirer cet utilisateur de l’équipe ?')){select.value=member.role;return}
    select.disabled=true;
    try{await request('member',{user_id:member.id,role:select.value});labelStatus('team-feedback','Droits mis à jour.');await refresh()}
    catch(e){labelStatus('team-feedback',e.message);select.value=member.role}
    finally{select.disabled=false}
   });
   card.append(select)
  }
  team.append(card)
 }
 if(!team.childElementCount)team.append(node('p','Aucun collaborateur encore rattaché.'));
 for(const inv of current.invitations||[]){
  const card=node('div',undefined,'meca-team-entry');
  const info=node('div');info.append(node('strong',inv.email||'Invitation par QR code'),node('small',({manager:'Responsable',member:'Collaborateur'}[inv.role]||inv.role)+' · expire le '+new Date(inv.expire_le).toLocaleDateString('fr-FR')));
  card.append(info);
  if(canInvite){const revoke=node('button','Annuler','meca-team-small-button');revoke.addEventListener('click',async()=>{
   revoke.disabled=true;try{await request('revoke',{id:inv.id});await refresh()}catch(e){labelStatus('team-feedback',e.message);revoke.disabled=false}
  });card.append(revoke)}
  pending.append(card)
 }
 if(!pending.childElementCount)pending.append(node('p','Aucune invitation en attente.'));
}
function drawSearches(){
 const el=document.getElementById('team-searches');if(!el)return;el.replaceChildren();
 const canEdit=['owner','manager'].includes(current.role);
 for(const item of current.recherches||[]){
  const card=node('article',undefined,'meca-team-search');
  const head=node('div');head.append(node('strong',item.marque+' '+item.modele+' · '+item.piece),node('small','Créée le '+new Date(item.cree_le).toLocaleDateString('fr-FR')+(item.reference_piece?' · Réf. '+item.reference_piece:'')));
  card.append(head);
  const controls=node('div',undefined,'meca-team-search-controls');
  if(canEdit){
   const status=node('select');status.setAttribute('aria-label','Statut de la recherche');
   for(const [v,t] of [['nouvelle','Nouvelle'],['en_cours','En cours'],['en_attente','En attente'],['terminee','Terminée']]){const o=node('option',t);o.value=v;status.append(o)}status.value=item.statut;
   const assignee=node('select');assignee.setAttribute('aria-label','Collaborateur attribué');
   const blank=node('option','Non attribuée');blank.value='';assignee.append(blank);
   for(const member of current.membres||[]){const o=node('option',member.nom||member.email);o.value=member.id;assignee.append(o)}assignee.value=item.attribue_a||'';
   const save=node('button','Mettre à jour','meca-team-small-button');
   save.addEventListener('click',async()=>{
    save.disabled=true;try{await request('update-search',{id:item.id,status:status.value,assignee:assignee.value||null});labelStatus('team-searches-feedback','Dossier mis à jour.');await refresh()}
    catch(e){labelStatus('team-searches-feedback',e.message)}finally{save.disabled=false}
   });controls.append(status,assignee,save)
  }else controls.append(node('span','Statut : '+({nouvelle:'Nouvelle',en_cours:'En cours',en_attente:'En attente',terminee:'Terminée'}[item.statut]||item.statut)));
  card.append(controls);el.append(card)
 }
 if(!el.childElementCount)el.append(node('p','Aucune recherche enregistrée pour cet établissement. Les recherches déposées depuis le site apparaîtront ici.'));
}
async function init(){
 try{
  const response=await fetch(service,{credentials:'same-origin',cache:'no-store'});
  if(!response.ok){location.replace('/compte.html#professionnel');return}
  const result=await response.json();
  if(result.needsProfile||!result.authenticated){location.replace('/compte.html#professionnel');return}
  const p=result.profile||{};
  document.getElementById('pro-workspace-welcome').textContent='Établissement : '+(p.etablissement||'Mécascope Pro');
  const d=[['Établissement',p.etablissement],['SIRET',p.siret],['Adresse',p.adresse],['Code postal',p.code_postal],['Ville',p.ville],['Contact',p.contact],['Téléphone',p.telephone],['E-mail professionnel',p.email]];
  fill('workspace-overview',d);fill('workspace-establishment',d);
  workspace.hidden=false;loading.hidden=true;window.dispatchEvent(new Event('meca-auth-updated'));
  try{await refresh()}catch(e){labelStatus('team-feedback',e.message);labelStatus('team-searches-feedback',e.message)}
 }catch{loading.querySelector('p').textContent='Impossible de vérifier la session. Actualisez pour réessayer.'}
}
document.getElementById('team-invite-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]');
 button.disabled=true;labelStatus('team-feedback','Création de l’invitation…');
 try{
  const email=form.email.value.trim(),role=form.role.value;
  const invite=await request('invite',{email,role});
  const result=document.getElementById('team-invite-result');
  document.getElementById('team-invite-link').value=invite.link;
  document.getElementById('team-invite-message').textContent=invite.message;
  const mailto='mailto:'+(email||'')+'?subject='+encodeURIComponent('Invitation à rejoindre l’équipe Mécascope')+'&body='+encodeURIComponent('Bonjour,\n\nVous êtes invité à rejoindre notre équipe Mécascope en tant que '+(role==='manager'?'responsable':'collaborateur')+'.\n\nUtilisez ce lien personnel (valable 7 jours) :\n'+invite.link+'\n\nÀ bientôt.');
  const send=document.getElementById('team-email-send');send.href=mailto;send.textContent=email?'Ouvrir l’e-mail d’invitation':'Partager par e-mail';
  const qr=document.getElementById('team-qr');qr.replaceChildren();
  if(typeof QRCode!=='undefined')new QRCode(qr,{text:invite.link,width:208,height:208,colorDark:'#10151b',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
  else qr.append(node('p','Impossible de créer le QR code sur ce navigateur. Copiez le lien.'));
  result.hidden=false;labelStatus('team-feedback','Invitation prête. Ouvrez votre messagerie pour l’envoyer, ou partagez le QR code.');
  await refresh();
 }catch(e){labelStatus('team-feedback',e.message)}
 finally{button.disabled=false}
});
document.getElementById('team-copy').addEventListener('click',async()=>{
 const link=document.getElementById('team-invite-link');try{await navigator.clipboard.writeText(link.value);labelStatus('team-feedback','Lien copié.')}catch{link.select();document.execCommand('copy');labelStatus('team-feedback','Lien sélectionné : copiez-le.')}
});
document.getElementById('workspace-logout').addEventListener('click',async()=>{
 await fetch(service,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});location.replace('/');
});
init();
