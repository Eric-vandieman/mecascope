'use strict';
window.mecaSuppliers=async function(main,path){
 if(!['/admin/fournisseurs','/admin/demandes','/admin/messages'].includes(path))return;
 const isDirectory=path==='/admin/fournisseurs',selection=main.querySelector('#meca-live-dossier');
 if(!isDirectory&&!selection)return;
 const api=async payload=>{
  const renew=await fetch('/api/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session'}),cache:'no-store'});
  if(!renew.ok)throw Error('Reconnectez-vous à l’administration.');
  const r=await fetch('/api/fournisseurs',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.message||'Opération impossible');
  return d.result;
 };
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=String(text);return n};
 const btn=(name,fn,secondary=false)=>{const b=el('button','btn '+(secondary?'dark':'orange')+' meca-fbtn',name);b.type='button';b.onclick=fn;return b};
 const safeLink=(url,caption)=>{try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol))return null;const a=el('a','meca-supplier-link',caption);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a}catch{return null}};
 const fmtDate=x=>{try{return new Date(x).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return '—'}};
 const labels={telephone:'Téléphone',email:'E-mail',formulaire:'Formulaire',autre:'Autre',en_attente:'En attente',positif:'Positif',negatif:'Négatif',sans_reponse:'Sans réponse'};
 const types={automobile:'Automobile',moto:'Moto',quad:'Quad / ATV',scooter:'Scooter',agricole:'Tracteur / agricole',collection:'Véhicule de collection',poids_lourd:'Poids lourd',engins:'Engins / TP',multi:'Multisecteur'};
 const vehicleTypes=['automobile','moto','quad','scooter','agricole','collection','poids_lourd','engins'];
 const state={suppliers:[],contacts:[],dossier:null,type:'particulier',vehicleCategory:null,loading:false};
 const root=el('section','meca-suppliers-root');
 if(isDirectory){
  main.replaceChildren(root);
  root.innerHTML='<div class="pagehead"><div><h1>Répertoire fournisseurs</h1><p class="muted">Fiches, coordonnées professionnelles et historique réel des contacts</p></div></div><div class="meca-supplier-toolbar"><input id="meca-f-search" placeholder="Rechercher un fournisseur, une pièce, un pays…" aria-label="Rechercher fournisseur"><select id="meca-f-category" aria-label="Catégorie"><option value="">Toutes les catégories</option><option value="automobile">Automobile</option><option value="moto">Moto</option><option value="quad">Quad / ATV</option><option value="scooter">Scooter</option><option value="agricole">Tracteur / Agricole</option><option value="collection">Collection</option><option value="poids_lourd">Poids lourds</option><option value="engins">Engins</option><option value="multi">Multisecteur</option></select><button id="meca-f-add" class="btn orange">+ Ajouter un fournisseur</button></div><p class="meca-supplier-help">Le taux positif mesure les réponses positives parmi les réponses positives ou négatives ; ce n’est pas une garantie de qualité ni de disponibilité. Les contacts sans réponse restent comptés séparément.</p><p id="meca-f-status" role="status"></p><div class="meca-supplier-summary" id="meca-f-metrics"></div><div id="meca-f-list" class="meca-supplier-grid"></div>';
 }else{
  root.innerHTML='<h2>☎ Fournisseurs contactés pour ce dossier</h2><p class="muted">Sélectionne un fournisseur, note ton appel ou ton e-mail, puis renseigne la réponse lorsque tu l’obtiens. Les autres dossiers ne seront pas mélangés.</p><p class="meca-f-context" role="status">Sélectionne un dossier ci-dessus.</p><div class="meca-supplier-toolbar"><input id="meca-f-search" placeholder="Rechercher nom, pays ou spécialité…" aria-label="Rechercher fournisseur"><select id="meca-f-category"><option value="">Toutes catégories</option><option value="automobile">Auto</option><option value="moto">Moto</option><option value="quad">Quad / ATV</option><option value="scooter">Scooter</option><option value="agricole">Tracteur / Agricole</option><option value="collection">Collection</option><option value="poids_lourd">Poids lourd</option><option value="engins">Engins</option><option value="multi">Multisecteur</option></select><button id="meca-f-add" class="btn dark" type="button">+ Fournisseur</button></div><div id="meca-f-history" class="meca-f-history"></div><div id="meca-f-list" class="meca-supplier-grid"></div><p id="meca-f-status" role="status"></p>';
  selection.closest('.panel')?.after(root);
 }
 const directorySelect=isDirectory?el('select','meca-f-dossier-select'):null;
 if(directorySelect){
  directorySelect.setAttribute('aria-label','Dossier de recherche');
  const place=el('div','meca-f-dossier-chooser');
  place.append(el('strong','','Travailler sur un dossier : '),directorySelect);
  root.querySelector('.meca-supplier-toolbar')?.before(place);
  directorySelect.onchange=load;
 }
 const search=root.querySelector('#meca-f-search'),category=root.querySelector('#meca-f-category'),results=root.querySelector('#meca-f-list'),status=root.querySelector('#meca-f-status');
 const history=root.querySelector('#meca-f-history'),context=root.querySelector('.meca-f-context');
 const error=e=>{status.textContent=String(e?.message||e)};
 const supplierModal=(record=null)=>{
  const overlay=el('div','meca-supplier-overlay');
  const modal=el('form','meca-supplier-modal');
  modal.innerHTML='<h2>Fiche fournisseur</h2><div class="meca-f-form-grid"><label>Nom<input name="name" required maxlength="160"></label><label>Pays<input name="country" maxlength="80" value="France"></label><label>Spécialités<input name="specialties" maxlength="450" placeholder="Ex. boîtes de vitesse anciennes"></label><label>Téléphone<input name="phone" type="tel"></label><label>E-mail<input name="email" type="email"></label><label>Site web<input name="website" type="url" placeholder="https://"></label><label>Page contact<input name="contactUrl" type="url" placeholder="https://"></label><label>Source des coordonnées<input name="sourceUrl" type="url" placeholder="https://"></label><label class="full">Notes internes<textarea name="notes" maxlength="2000" rows="3"></textarea></label></div><div class="meca-f-actions"><button type="submit" class="btn orange">Enregistrer</button><button type="button" class="btn dark" data-close>Annuler</button></div><p role="status"></p>';
  const data={name:record?.nom||'',category:record?.categorie||'automobile',country:record?.pays||'France',specialties:record?.specialites||'',phone:record?.telephone||'',email:record?.email||'',website:record?.site_web||'',contactUrl:record?.contact_url||'',sourceUrl:record?.source_url||'',notes:record?.note_privee||''};
  for(const [key,value] of Object.entries(data))if(modal.elements.namedItem(key))modal.elements.namedItem(key).value=value;
  const choices=el('fieldset','meca-f-category-choices');
  const legend=el('legend','','Catégories prises en charge (plusieurs possibles)');choices.append(legend);
  for(const v of vehicleTypes){
   const label=el('label','meca-f-choice'),input=document.createElement('input');
   input.type='checkbox';input.name='vehicleCategory';input.value=v;
   input.checked=(record?.categories||[record?.categorie||'automobile']).includes(v);
   label.append(input,document.createTextNode(types[v]));choices.append(label);
  }
  modal.querySelector('.meca-f-form-grid').append(choices);
  modal.querySelector('[data-close]').onclick=()=>overlay.remove();
  modal.onsubmit=async ev=>{
   ev.preventDefault();const submit=modal.querySelector('[type=submit]');submit.disabled=true;modal.querySelector('[role=status]').textContent='Enregistrement…';
   try{
    const categories=[...modal.querySelectorAll('input[name="vehicleCategory"]:checked')].map(n=>n.value);
    if(!categories.length)throw Error('Coche au moins une catégorie de véhicules.');
    const payload=Object.fromEntries(new FormData(modal));delete payload.vehicleCategory;
    const result=await api({action:'save',id:record?.id||null,...payload,category:categories[0]});
    await api({action:'categories',id:result,categories});
    overlay.remove();await load();
   }
   catch(e){modal.querySelector('[role=status]').textContent=e.message}finally{submit.disabled=false}
  };
  overlay.append(modal);document.body.append(overlay);
 };
 const contactModal=supplier=>{
  if(!state.dossier){status.textContent='Choisis d’abord un dossier.';return}
  const overlay=el('div','meca-supplier-overlay');const form=el('form','meca-supplier-modal');
  form.innerHTML='<h2>Noter un contact fournisseur</h2><p class="muted">Cet enregistrement concerne uniquement le dossier sélectionné. Aucun appel ni e-mail n’est envoyé automatiquement.</p><div class="meca-f-form-grid"><label>Canal<select name="channel"><option value="telephone">Appel téléphonique</option><option value="email">E-mail</option><option value="formulaire">Formulaire web</option><option value="autre">Autre</option></select></label><label>Relancer le (facultatif)<input type="date" name="reminder"></label><label class="full">Compte rendu / pièce demandée<textarea name="notes" rows="4" maxlength="2500" placeholder="Référence OEM, prix demandé, interlocuteur…"></textarea></label></div><div class="meca-f-actions"><button type="submit" class="btn orange">Enregistrer le contact</button><button type="button" class="btn dark" data-close>Annuler</button></div><p role="status"></p>';
  form.insertBefore(el('p','meca-f-identify','Fournisseur : '+supplier.nom),form.children[1]);
  form.querySelector('[data-close]').onclick=()=>overlay.remove();
  form.onsubmit=async e=>{e.preventDefault();const submit=form.querySelector('[type=submit]');submit.disabled=true;
   try{const vals=Object.fromEntries(new FormData(form));await api({action:'contact',supplier:supplier.id,dossier:state.dossier,type:state.type,channel:vals.channel,notes:vals.notes,reminder:vals.reminder||null});overlay.remove();await load()}
   catch(e){form.querySelector('[role=status]').textContent=e.message}finally{submit.disabled=false}
  };
  overlay.append(form);document.body.append(overlay);
 };
 function renderHistory(){
  if(!history)return;history.replaceChildren();
  const contacts=state.contacts;
  if(!state.dossier){context.textContent='Sélectionne d’abord un dossier pour voir ses contacts.';return}
  context.textContent=(state.vehicleCategory==='inconnu'?'Catégorie à renseigner':(types[state.vehicleCategory]||'Catégorie non détectée'))+' · '+contacts.length+' contact(s) enregistrés sur ce dossier';
  if(!contacts.length){history.append(el('p','muted','Aucun fournisseur contacté pour ce dossier.'));return}
  const title=el('h3','','Historique des fournisseurs contactés');history.append(title);
  const supplierMap=new Map(state.suppliers.map(s=>[s.id,s]));
  for(const c of contacts){
   const card=el('article','meca-f-log');
   const name=supplierMap.get(c.fournisseur_id)?.nom||'Fournisseur non référencé';
   card.append(el('strong','',name+' · '+(labels[c.canal]||c.canal)+' · '+fmtDate(c.contact_le)));
   card.append(el('p','',c.commentaire||'Aucun commentaire'));
   const row=el('div','meca-f-log-controls');
   const result=el('select');for(const [value,name] of Object.entries({en_attente:'En attente',positif:'Réponse positive',negatif:'Réponse négative',sans_reponse:'Sans réponse'})){const opt=el('option','',name);opt.value=value;result.append(opt)}result.value=c.resultat;
   const update=btn('Enregistrer la réponse',async()=>{update.disabled=true;try{await api({action:'response',contact:c.id,outcome:result.value});await load()}catch(e){error(e)}finally{update.disabled=false}},true);
   row.append(el('span','meca-f-label','Résultat : '),result,update);
   if(c.relance_le){const due=el('span','meca-f-reminder','Relance prévue : '+fmtDate(c.relance_le));if(new Date(c.relance_le)<new Date()&&c.resultat==='en_attente')due.classList.add('overdue');row.append(due)}
   card.append(row);history.append(card);
  }
 }
 function render(){
  if(!root.isConnected)return;
  const q=search.value.trim().toLocaleLowerCase('fr'),filter=category.value;
  const sorted=state.suppliers.filter(s=>(!filter||(s.categories||[s.categorie]).includes(filter))&&(!q||[s.nom,s.pays,s.specialites].join(' ').toLocaleLowerCase('fr').includes(q)))
   .sort((a,b)=> (state.dossier?(b.contacts_dossier-a.contacts_dossier):0)||((b.nb_positifs+b.nb_negatifs>=3?Number(b.taux_positif):0)-(a.nb_positifs+a.nb_negatifs>=3?Number(a.taux_positif):0))||a.nom.localeCompare(b.nom,'fr'));
  results.replaceChildren();
  if(isDirectory){
   const metric=root.querySelector('#meca-f-metrics');metric.replaceChildren();
   const totals=[['Fournisseurs',state.suppliers.length],['Contacts enregistrés',state.suppliers.reduce((a,s)=>a+s.nb_contacts,0)],['Réponses positives',state.suppliers.reduce((a,s)=>a+s.nb_positifs,0)],['Réponses négatives',state.suppliers.reduce((a,s)=>a+s.nb_negatifs,0)]];
   for(const [label,num] of totals){const box=el('div','meca-f-kpi');box.append(el('strong','',num),el('span','',label));metric.append(box)}
  }
  for(const s of sorted){
   const card=el('article','meca-f-supplier-card'+(s.contacts_dossier?' contacted':''));
   const title=el('div','meca-f-card-title');title.append(el('strong','',s.nom),el('span','meca-f-tag',(s.categories||[s.categorie]).map(c=>types[c]||c).join(' · ')));card.append(title);
   card.append(el('p','meca-f-card-sub',s.pays+' · '+(s.specialites||'Spécialité à préciser')));
   const row=el('div','meca-f-card-stats');
   for(const text of [s.nb_contacts+' contacts',s.nb_positifs+' positifs',s.nb_negatifs+' négatifs',s.nb_sans_reponse+' sans réponse'])row.append(el('span','',text));
   card.append(row);
   const sample=Number(s.nb_positifs)+Number(s.nb_negatifs);
   card.append(el('p','meca-f-score',sample>=3?('Réponses positives : '+s.taux_positif+' % ('+sample+' réponses)'):'Score en construction · '+sample+' réponse(s) documentée(s)'));
   if(state.dossier&&s.contacts_dossier)card.append(el('p','meca-f-already','✓ Déjà contacté pour CE dossier · '+s.contacts_dossier+' fois'));
   if(s.dernier_contact)card.append(el('p','meca-f-last','Dernier contact : '+fmtDate(s.dernier_contact)));
   const links=el('div','meca-f-card-links');
   if(s.telephone){const a=el('a','','☎ '+s.telephone);a.href='tel:'+s.telephone.replace(/[^\d+]/g,'');links.append(a)}
   if(s.email&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)){const a=el('a','','✉ '+s.email);a.href='mailto:'+s.email;links.append(a)}
   for(const [url,caption] of [[s.contact_url,'Page contact'],[s.site_web,'Site web']]){const link=safeLink(url,caption);if(link)links.append(link)}
   card.append(links);
   const actions=el('div','meca-f-card-actions');
   if(state.dossier)actions.append(btn(s.contacts_dossier?'Noter une relance':'Noter le contact',()=>contactModal(s)));
   actions.append(btn('Modifier la fiche',()=>supplierModal(s),true));
   card.append(actions);results.append(card);
  }
  if(!sorted.length)results.append(el('p','muted','Aucun fournisseur ne correspond à cette recherche.'));
  renderHistory();
 }
 let revision=0;
 async function load(){
  const thisRevision=++revision;
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const selected=directorySelect?.value||'';
  const [chosenType,chosenId]=selected.split('|');
  const dossier=isDirectory?(chosenId||null):(params.get('source')==='professionnel'?params.get('dossier'):(selection?.value||params.get('dossier')||null));
  const type=isDirectory?(chosenType||'particulier'):(params.get('source')==='professionnel'?'professionnel':'particulier');
  state.dossier=dossier;state.type=type;
  status.textContent='Chargement des fournisseurs…';
  try{
   const data=await api({action:'list',dossier,type});
   if(thisRevision!==revision||!root.isConnected)return;
   state.suppliers=Array.isArray(data.fournisseurs)?data.fournisseurs:[];
   state.contacts=Array.isArray(data.contacts)?data.contacts:[];
   const automaticCategory=data.categorie_dossier;
   state.vehicleCategory=automaticCategory;
   if(dossier){
    category.value='';
    status.textContent=automaticCategory==='inconnu'?
      'Catégorie du dossier non renseignée : aucun fournisseur proposé avant classification.' :
      state.suppliers.length+' fournisseur(s) adaptés à '+(types[automaticCategory]||automaticCategory)+' uniquement';
    if(context)context.textContent='Catégorie détectée : '+(types[automaticCategory]||'À préciser');
   }else status.textContent=state.suppliers.length+' fournisseur(s) dans le répertoire';
   category.style.display=dossier?'none':'';

   render();
  }catch(e){if(thisRevision===revision){error(e);state.suppliers=[];state.contacts=[];render()}}
 }
 root.querySelector('#meca-f-add').onclick=()=>supplierModal();
 search.oninput=render;category.onchange=render;
 if(selection)selection.addEventListener('change',load);
 if(directorySelect){
  directorySelect.append(new Option('Répertoire général — choisir un dossier',''));
  try{
   const dossiers=await api({action:'dossiers'});
   for(const d of dossiers||[])directorySelect.append(new Option(d.reference+' · '+d.client+' ('+(d.type==='professionnel'?'Pro':'Particulier')+')',d.type+'|'+d.id));
  }catch(e){error(e)}
 }
 await load();
};