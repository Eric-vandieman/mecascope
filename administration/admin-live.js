'use strict';
window.mecaAdminLive=async function(main,path){
 const endpoint='/api/reporting';
 const call=async body=>{const session=await fetch('/api/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session'}),cache:'no-store'});if(!session.ok)throw Error('Session administrateur expirée ou révoquée : reconnectez-vous.');const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'Service non disponible');return d};
 const set=(id,value)=>{const x=main.querySelector('#'+id);if(x)x.textContent=value};
 const eur=x=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format((Number(x)||0)/100);
 const label=(name,value)=>{for(const m of main.querySelectorAll('.metric')){if(m.querySelector('.label')?.textContent.includes(name)){const v=m.querySelector('.value');if(v)v.textContent=String(value);break}}};
 try{
  const d=await call({action:'reporting'});
  const summary=main.querySelector('.meca-admin-live-status');
  if(summary)summary.textContent='Statistiques synchronisées avec la base Mécascope. Les encaissements comptés correspondent aux paiements confirmés côté serveur.';
  for(const [id,key] of Object.entries({'meca-single-month':'paiements_uniques_mois','meca-single-previous':'paiements_uniques_precedent','meca-single-total':'paiements_uniques_total','meca-type-targeted':'unitaire_ciblee','meca-type-deep':'unitaire_approfondie','meca-type-expert':'unitaire_expert','meca-start-payments':'paiements_initiaux','meca-success-payments':'paiements_soldes','meca-pro-priority':'abonnements_priorite','meca-pro-five':'abonnements_pro5','meca-pro-ten':'abonnements_pro10'}))set(id,d[key]??0);
  set('meca-oneoff-revenue',eur(d.ca_unitaire_centimes));
  label('Nouvelles demandes',d.nouvelles_demandes||0);label('Recherches en cours',d.recherches_en_cours||0);label('Résultats à débloquer',d.resultats_a_debloquer||0);label('Demandes urgentes',d.urgences||0);
  label('Chiffre d’affaires',eur((d.ca_unitaire_centimes||0)+(d.abonnements_ca_centimes||0)));
  label('Priorité Pro',d.abonnements_priorite||0);label('Pro 5',d.abonnements_pro5||0);label('Pro 10',d.abonnements_pro10||0);
  label('Récurrence mensuelle',eur(d.abonnements_ca_centimes||0));
  if(path==='/admin'){
   const block=main.querySelector('.metrics.six');
   if(block&&!main.querySelector('#meca-visitors-tile')){
    const div=document.createElement('div');div.className='metric';div.id='meca-visitors-tile';
    div.innerHTML='<div><div class="label">Visiteurs aujourd’hui</div><div class="value"></div><div class="meca-single-card-desc"></div></div>';
    div.querySelector('.value').textContent=String(d.visiteurs_jour||0);
    div.querySelector('.meca-single-card-desc').textContent=(d.visites_total||0)+' visites depuis le démarrage du suivi';
    block.append(div);
   }
  }
  const dossiers=Array.isArray(d.dossiers)?d.dossiers:[];
  if(path==='/admin/demandes'){
   const requested=new URLSearchParams(location.hash.split('?')[1]||'');
   const id=requested.get('dossier');
   if(requested.get('source')!=='professionnel'&&/^[a-f0-9-]{36}$/i.test(id||'')&&!dossiers.some(x=>x.id===id)){
    try{
     const response=await fetch('/api/push',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'single-dossier',id}),cache:'no-store'});
     const result=await response.json();
     if(response.ok&&result.dossier)dossiers.unshift(result.dossier);
    }catch{}
   }
  }
  if(path==='/admin'){
   const tbody=main.querySelector('.tablewrap tbody');
   if(tbody){tbody.replaceChildren();for(const item of dossiers.slice(0,15)){const tr=document.createElement('tr');for(const v of [item.reference,item.contact,item.details?.brand+' '+item.details?.model,item.statut,item.cree_le?.slice(0,10)]){const td=document.createElement('td');td.textContent=v||'—';tr.append(td)}const td=document.createElement('td');const btn=document.createElement('button');btn.className='btn dark small';btn.textContent='Ouvrir';btn.onclick=()=>{location.hash='#/admin/demandes';sessionStorage.setItem('meca-dossier-selected',item.id)};td.append(btn);tr.append(td);tbody.append(tr)}main.querySelector('.tablewrap .empty')?.remove()}
  }
  if(['/admin/demandes','/admin/messages'].includes(path)){
   const query=new URLSearchParams(location.hash.split('?')[1]||'');
   if(query.get('source')==='professionnel'&&/^[a-f0-9-]{36}$/i.test(query.get('dossier')||'')&&!dossiers.some(x=>x.id===query.get('dossier')))dossiers.unshift({id:query.get('dossier'),reference:'Dossier professionnel',contact:'Client professionnel',type_dossier:'professionnel',statut:'recherche'});
   const form=main.querySelector('#meca-result-form');if(!form)return;
   const select=document.createElement('select');select.id='meca-live-dossier';
   const initial=document.createElement('option');initial.value='';initial.textContent='Choisir un dossier client';select.append(initial);
   for(const row of dossiers){const option=document.createElement('option');option.value=row.id;option.textContent=row.reference+' — '+row.contact+' ('+row.statut+')';select.append(option)}
   const wrap=document.createElement('div');wrap.className='panel';wrap.append(select);
   const history=document.createElement('div');history.id='meca-live-history';history.style.cssText='white-space:pre-wrap;padding:12px;line-height:1.7';wrap.append(history);
   form.before(wrap);
   // Registre des dossiers réels : visible immédiatement, même sans sélection.
   const registry=document.createElement('section');
   registry.className='panel meca-dossiers-registry';
   const heading=document.createElement('h2');heading.textContent='Dossiers clients à traiter ('+dossiers.length+')';registry.append(heading);
   const helper=document.createElement('p');helper.className='muted';helper.textContent='Sélectionnez un dossier pour consulter le client, le véhicule et préparer sa réponse.';registry.append(helper);
   const list=document.createElement('div');list.style.cssText='display:grid;gap:10px';registry.append(list);
   const detail=document.createElement('div');detail.className='panel';detail.style.cssText='margin-top:14px;white-space:pre-wrap;line-height:1.7';detail.textContent='Sélectionnez un dossier pour afficher ses informations.';registry.append(detail);
   const fields=[['Type de véhicule','vehicleType'],['Marque','brand'],['Modèle','model'],['Année','year'],['Motorisation','engine'],['Carburant','fuel'],['Boîte','gearbox'],['Finition','trim'],['Pièce recherchée','part'],['Référence de pièce','ref'],['VIN','vin'],['Budget','budget'],['Remarques','notes']];
   function showDossier(row){
     if(!row){detail.textContent='Sélectionnez un dossier.';return}
     const lines=['DOSSIER '+(row.reference||row.id),'Statut : '+(row.statut||'—'),'Client : '+(row.contact||'—'),'E-mail : '+(row.email||'—'),'Créé le : '+(row.cree_le?new Date(row.cree_le).toLocaleString('fr-FR'):'—'),'Type : '+(row.type_dossier==='professionnel'?'Professionnel':'Particulier')];
     for(const [label,key] of fields){const v=row.details?.[key];if(v!==null&&v!==undefined&&String(v).trim())lines.push(label+' : '+String(v))}
     detail.textContent=lines.join('\n');
   }
   for(const row of dossiers){
     const button=document.createElement('button');button.type='button';button.className='btn dark small';button.style.cssText='text-align:left;white-space:normal;line-height:1.5;padding:12px';
     button.textContent=(row.reference||'Dossier')+' · '+(row.contact||'Client')+' · '+(row.details?.brand||'')+' '+(row.details?.model||'')+' · '+(row.statut||'—');
     button.onclick=()=>{select.value=row.id;select.dispatchEvent(new Event('change'));detail.scrollIntoView?.({block:'nearest',behavior:'smooth'})};
     list.append(button);
   }
   if(!dossiers.length){const empty=document.createElement('p');empty.textContent='Aucun dossier reçu pour le moment.';list.append(empty)}
   wrap.before(registry);
   const quotePanel=document.createElement('div');quotePanel.className='panel';
   quotePanel.innerHTML='<h3>Préparer le devis — validation humaine</h3><p class="muted">Choisissez uniquement la formule de recherche. Le client sélectionnera lui-même les options Express (48 h +20 €, 24 h +50 €) et la réservation (+10 €) dans le formulaire du devis. Ces options seront payées avec son acompte, et non à la fin.</p><div class="meca-compose-grid"><label>Formule à proposer<select id="meca-quote-plan"><option value="ciblee">Recherche ciblée · 39 €</option><option value="approfondie">Recherche approfondie · 79 €</option><option value="expert">Investigation Expert · 149 €</option></select></label></div>';
   const proposalBox=document.createElement('div');proposalBox.className='panel';proposalBox.style.marginTop='14px';
   proposalBox.innerHTML='<h3>Votre message au client — rédigé par vous</h3><p class="muted">L’IA ne rédige pas à votre place. Les suggestions ci-dessous sont STRICTEMENT PRIVÉES : elles servent de pense-bête, jamais de texte transmis automatiquement. Seul ce que vous écrivez dans la zone libre est envoyé. Les prix et les options sont présentés séparément dans le formulaire client.</p>';
   const introLabel=document.createElement('label');introLabel.textContent='Pense-bête privé : idées pour introduire votre réponse';
   const introSelect=document.createElement('select');
   for(const x of ['Après étude de votre demande, voici la solution de recherche que je vous propose.','J’ai étudié les informations de votre véhicule et la pièce demandée.','Merci pour votre demande. Voici mon analyse et ma proposition de prise en charge.']){const o=document.createElement('option');o.textContent=x;o.value=x;introSelect.append(o)}
   introLabel.append(introSelect);
   const reasonLabel=document.createElement('label');reasonLabel.textContent='Pense-bête privé : pourquoi proposer cette formule ?';
   const reasonSelect=document.createElement('select');
   for(const x of ['La recherche nécessite de vérifier plusieurs sources et de confirmer la compatibilité exacte.','La formule à 39 € convient à une recherche ciblée lorsque la référence est suffisamment identifiable et que les pistes initiales sont limitées.','La formule à 79 € est proposée plutôt que celle à 39 € car la recherche nécessite davantage de recoupements, de fournisseurs et de vérifications de compatibilité.','La formule à 149 € est proposée lorsque la rareté potentielle impose une investigation experte et des recherches documentaires plus larges.']){const o=document.createElement('option');o.value=x;o.textContent=x;reasonSelect.append(o)}
   reasonLabel.append(reasonSelect);
   const constraintLabel=document.createElement('h4');constraintLabel.textContent='Pense-bête privé : difficultés à considérer (jamais envoyées automatiquement)';
   const checks=document.createElement('div');checks.style.cssText='display:grid;gap:8px';
   const choices=['Référence constructeur / équivalence à confirmer','Compatibilité véhicule / motorisation à vérifier','Disponibilité et stock fournisseur non garantis','État, dimensions ou caractéristiques techniques à contrôler','Rareté probable nécessitant plusieurs fournisseurs','Informations complémentaires ou photos éventuellement nécessaires','Prix de la pièce distinct du tarif de recherche'];
   let aiConstraints=[];
   function populateChecks(extras=[]){checks.replaceChildren();for(const x of [...new Set([...choices,...extras.map(v=>String(v).slice(0,220))])].slice(0,16)){const l=document.createElement('label');l.style.cssText='display:flex;gap:8px;align-items:flex-start';const c=document.createElement('input');c.type='checkbox';c.value=x;c.style.width='auto';l.append(c,document.createTextNode(' '+x));checks.append(l)}}
   populateChecks();
   const personalLabel=document.createElement('label');personalLabel.textContent='Mon message personnel au client (obligatoire, rédigé par moi)';
   const personal=document.createElement('textarea');personal.rows=5;personal.maxLength=1500;personal.placeholder='Bonjour, j’ai regardé votre demande… Expliquez ici avec vos mots les difficultés et pourquoi vous proposez cette formule. Le client ne verra aucun texte IA.';personal.style.width='100%';personalLabel.append(personal);
   const previewTitle=document.createElement('h4');previewTitle.textContent='Message qui sera transmis au client';
   const preview=document.createElement('pre');preview.style.cssText='white-space:pre-wrap;line-height:1.6;background:#111923;padding:14px;border-radius:8px;max-height:440px;overflow:auto';
   const price={ciblee:{name:'Recherche ciblée',total:39,initial:19,balance:20,days:3},approfondie:{name:'Recherche approfondie',total:79,initial:39,balance:40,days:5},expert:{name:'Investigation Expert',total:149,initial:69,balance:80,days:7}};
   function buildProposal(){
      const row=dossiers.find(x=>x.id===select.value);
      if(row?.statut==='devis_envoye'&&row.proposition_texte)return row.proposition_texte;
      return 'Dossier '+(row?.reference||'à sélectionner')+'\\n\\n'+personal.value.trim();
   }
   function refreshPreview(){preview.textContent=buildProposal()}
   proposalBox.append(introLabel,reasonLabel,constraintLabel,checks,personalLabel,previewTitle,preview);
   quotePanel.append(proposalBox);
   proposalBox.addEventListener('input',refreshPreview);
   proposalBox.addEventListener('change',refreshPreview);
   quotePanel.querySelector('#meca-quote-plan').addEventListener('change',refreshPreview);
   const quoteButton=document.createElement('button');quoteButton.type='button';quoteButton.className='btn orange';quoteButton.textContent='Valider et envoyer le devis';quotePanel.append(quoteButton);
   const failButton=document.createElement('button');failButton.type='button';failButton.className='btn danger';failButton.textContent='Clôturer la recherche sans résultat';failButton.hidden=true;
   quotePanel.append(failButton);form.before(quotePanel);
   // Qualification IA réservée à l'administrateur, jamais envoyée automatiquement.
   const aiPanel=document.createElement('section');aiPanel.className='panel';
   aiPanel.innerHTML='<h2>Estimation IA de la recherche</h2><p class="muted">Analyse interne de la difficulté, du temps de travail estimé et de la formule conseillée. Prix et délais contractuels fixes, validation humaine obligatoire.</p>';
   const aiBtn=document.createElement('button');aiBtn.type='button';aiBtn.className='btn orange';aiBtn.textContent='Analyser la demande avec l’IA';
   const aiStatus=document.createElement('p');aiStatus.setAttribute('role','status');
   const aiOutput=document.createElement('div');aiOutput.style.cssText='white-space:pre-wrap;line-height:1.7;margin-top:12px';
   aiPanel.append(aiBtn,aiStatus,aiOutput);quotePanel.before(aiPanel);
   aiBtn.onclick=async()=>{
     if(!select.value){aiStatus.textContent='Sélectionnez un dossier.';return}
     const id=select.value;aiBtn.disabled=true;aiStatus.textContent='Qualification commerciale en cours…';aiOutput.replaceChildren();
     try{
       const r=await fetch('/api/qualification',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),cache:'no-store'});
       const response=await r.json().catch(()=>({}));if(!r.ok)throw Error(response.message||'Analyse indisponible');
       if(id!==select.value)return;
       const q=response.qualification||{},plan=response.recommandation||{};
       const hours=[q.temps_interne_heures_min,q.temps_interne_heures_max].filter(v=>v!==null&&v!==undefined).join(' à ');
       aiOutput.textContent='Formule suggérée : '+(plan.label||'À examiner')+' — '+(plan.prix_eur||'—')+' €'+'\\nDélai contractuel : '+(plan.delai_jours_ouvres||'—')+' jours ouvrés après conditions remplies'+'\\nPaiement initial : '+(plan.acompte_eur||'—')+' € · Solde si résultat : '+(plan.solde_eur||'—')+' €'+'\\nDifficulté : '+(q.difficulte||'—')+' · Confiance : '+(q.confiance||'—')+'\\nTemps de travail interne estimé : '+(hours||'Non estimé')+' heures'+'\\nJustification : '+(q.justification||'Non précisée')+'\\nRisques : '+(q.risques||'À vérifier')+'\\nQuestions au client :\\n'+(Array.isArray(q.questions_client)?q.questions_client.map(x=>'• '+x).join('\\n'):'—')+'\\nPistes fournisseurs :\\n'+(Array.isArray(q.pistes_recherche)?q.pistes_recherche.map(x=>'• '+x).join('\\n'):'—');
       if(q.formule&&quotePanel.querySelector('#meca-quote-plan')?.querySelector('option[value="'+q.formule+'"]'))quotePanel.querySelector('#meca-quote-plan').value=q.formule;
       // L'IA suggère des précautions ; leur reprise commerciale requiert une sélection manuelle.
       aiConstraints=[...(Array.isArray(q.questions_client)?q.questions_client:[]),...(Array.isArray(q.risques)?q.risques:typeof q.risques==='string'?[q.risques]:[])];
       populateChecks(aiConstraints);
       if(q.justification){reasonSelect.selectedIndex=q.formule==='ciblee'?1:q.formule==='approfondie'?2:q.formule==='expert'?3:0}
       refreshPreview();
       aiStatus.textContent='Analyse prête. Vérifiez-la avant tout devis. Aucune proposition envoyée.';
     }catch(e){aiStatus.textContent=e.message}finally{aiBtn.disabled=false}
   };
   // Conversation de qualification : possible avant paiement, aucun résultat fournisseur révélé.
   const chatPanel=document.createElement('section');chatPanel.className='panel';
   chatPanel.innerHTML='<h2>Conversation avec le client</h2><p class="muted">Utilisez ce chat pour demander des précisions avant le devis et échanger pendant la recherche. Les résultats fournisseurs restent soumis au paiement confirmé.</p>';
   const chatInput=document.createElement('textarea');chatInput.rows=4;chatInput.maxLength=3000;chatInput.placeholder='Votre message au client (référence, photos, dimensions, questions…)';chatInput.style.width='100%';
   const chatButton=document.createElement('button');chatButton.type='button';chatButton.className='btn orange';chatButton.textContent='Enregistrer le message dans la conversation';
   const chatStatus=document.createElement('p');chatStatus.setAttribute('role','status');
   chatPanel.append(chatInput,chatButton,chatStatus);wrap.after(chatPanel);
   chatButton.onclick=async()=>{
     const message=chatInput.value.trim(),row=dossiers.find(x=>x.id===select.value);
     if(!row||!message){chatStatus.textContent='Sélectionnez un dossier et saisissez un message.';return}
     if(!confirm('Enregistrer ce message visible par le client dans le dossier '+row.reference+' ?'))return;
     chatButton.disabled=true;chatStatus.textContent='Enregistrement…';
     try{
       const response=await call({action:'chat',id:row.id,message});
       chatInput.value='';chatStatus.textContent=response.message||'Message enregistré dans le dossier.';await refreshHistory();
     }catch(e){chatStatus.textContent=e.message}finally{chatButton.disabled=false}
   };

   form.insertAdjacentHTML('beforeend','<label class="wide"><input type="checkbox" name="expressEligible"> Délai Express tenu et éligible au supplément prévu</label><label class="wide"><input type="checkbox" name="reservationConfirmed"> Réservation fournisseur effectivement confirmée</label>');
   function showOptions(){
    const d=dossiers.find(x=>x.id===select.value),existing=d?.statut==='devis_envoye';
    const planSelect=quotePanel.querySelector('#meca-quote-plan');
    planSelect.value=existing&&d.offre?d.offre:'ciblee';
    planSelect.disabled=existing;
    proposalBox.querySelectorAll('select,input,textarea').forEach(x=>x.disabled=existing);
    quoteButton.textContent=existing?'Renvoyer le devis identique':'Valider et envoyer le devis';
    refreshPreview();
    quotePanel.hidden=!d||!['deposee','devis_envoye','acompte_paye'].includes(d.statut);
    quoteButton.hidden=!d||!['deposee','devis_envoye'].includes(d.statut);
    failButton.hidden=!d||d.statut!=='acompte_paye';
   }
   quoteButton.onclick=async()=>{const d=dossiers.find(x=>x.id===select.value);if(!d)return;
    const message=buildProposal();if((d.statut!=='devis_envoye'&&personal.value.trim().length<45)||message.length<80||message.length>2800){alert('Rédigez personnellement au moins 45 caractères et ne dépassez pas 2 800 caractères au total.');return}
    if(!confirm('Envoyer ce devis et cet argumentaire dans la messagerie de '+d.contact+', avec un e-mail contenant le lien de paiement ?'))return;
    quoteButton.disabled=true;
    try{const r=await call({action:'quote',id:d.id,offre:quotePanel.querySelector('#meca-quote-plan').value,proposal:message});alert(r.message||'Devis envoyé');location.reload()}
    catch(e){alert(e.message)}finally{quoteButton.disabled=false}
   };
   failButton.onclick=async()=>{const d=dossiers.find(x=>x.id===select.value);if(!d||!confirm('Clôturer cette recherche comme infructueuse, sans solde à payer ?'))return;
    failButton.disabled=true;try{await call({action:'fail',id:d.id});await call({action:'reply',id:d.id,found:false,message:'Nous vous informons que notre recherche n’a pas permis d’identifier une pièce conforme. Aucun solde de réussite n’est dû. Nous restons à votre disposition pour tout complément.'});alert('Recherche clôturée et client informé.');location.reload()}catch(e){alert(e.message)}finally{failButton.disabled=false}
   };

   async function refreshHistory(){history.textContent='';if(!select.value)return;try{const r=await call({action:'messages',id:select.value});for(const m of r.messages||[]){const p=document.createElement('p');p.textContent=(m.auteur==='client'?'Client':'Mécascope')+' · '+new Date(m.cree_le).toLocaleString('fr-FR')+' : '+m.contenu;history.append(p)}}catch(e){history.textContent=e.message}}
   window.mecaPieceHistory?.(main,select,dossiers);
   select.onchange=()=>{const row=dossiers.find(x=>x.id===select.value);form.elements.ref.value=row?.reference||'';personal.value='';populateChecks();reasonSelect.selectedIndex=0;aiOutput.replaceChildren();aiStatus.textContent='';showDossier(row);showOptions();refreshHistory()};
   // Alimenter le tableau principal attendu dans Gestion des demandes.
   if(path==='/admin/demandes'){
     const table=main.querySelector('#list-content tbody');
     if(table){
       table.replaceChildren();
       for(const row of dossiers){
         const tr=document.createElement('tr');
         const vehicle=[row.details?.brand,row.details?.model,row.details?.year].filter(Boolean).join(' ')||'—';
         for(const value of [row.reference||row.id,row.contact||'—',vehicle,row.statut||'—',row.cree_le?new Date(row.cree_le).toLocaleString('fr-FR'):'—']){
           const td=document.createElement('td');td.textContent=value;tr.append(td);
         }
         const action=document.createElement('td');
         const open=document.createElement('button');open.type='button';open.className='btn orange small';open.textContent='Ouvrir / traiter';
         open.onclick=()=>{select.value=row.id;select.dispatchEvent(new Event('change'));registry.scrollIntoView({block:'start',behavior:'smooth'})};
         action.append(open);tr.append(action);table.append(tr);
       }
       main.querySelector('#list-content .empty')?.remove();
       if(!dossiers.length){const message=document.createElement('p');message.className='empty';message.textContent='Aucun dossier client enregistré.';main.querySelector('#list-content .tablewrap')?.append(message)}
     }
   }
   const send=document.createElement('button');send.type='button';send.className='btn orange';send.textContent='Envoyer la réponse dans la conversation';
   const status=document.createElement('p');status.setAttribute('role','status');
   form.after(status);form.after(send);
   send.onclick=async()=>{
    const row=dossiers.find(x=>x.id===select.value);
    if(!row){status.textContent='Sélectionnez un dossier.';return}
    if(!row.initial_paid_at){status.textContent='Acompte non confirmé : réponse fournisseur indisponible.';return}
    const fields=Object.fromEntries(new FormData(form));
    const found=fields.result==='Pièce trouvée';
    const message=main.querySelector('#meca-compose-preview')?.textContent||'';
    if(found&&(!fields.price||!fields.delay||!fields.supplier)){status.textContent='Complétez prix, délai et fournisseur.';return}
    send.disabled=true;status.textContent='Enregistrement en cours…';
    try{const result=await call({action:'reply',id:row.id,found,message,country:fields.country==='Autre'?fields.other:fields.country,price:fields.price,delay:fields.delay,condition:fields.condition,fit:fields.fit,supplier:fields.supplier,details:fields.details,expressEligible:fields.expressEligible==='on',reservationConfirmed:fields.reservationConfirmed==='on'});status.textContent=result.emailed?'Message enregistré et notification envoyée au client.':'Message enregistré. Notification e-mail non confirmée ; le client peut le lire via son lien personnel.';await refreshHistory()}
    catch(e){status.textContent=e.message}
    finally{send.disabled=false}
   };
   const deep=new URLSearchParams(location.hash.split('?')[1]||'').get('dossier');
   const remembered=deep&&/^[a-f0-9-]{36}$/i.test(deep)?deep:sessionStorage.getItem('meca-dossier-selected');if(remembered&&dossiers.some(x=>x.id===remembered)){select.value=remembered;select.dispatchEvent(new Event('change'));sessionStorage.removeItem('meca-dossier-selected')}else if(dossiers.length){select.value=dossiers[0].id;select.dispatchEvent(new Event('change'))}
  }
 }catch(e){const p=document.createElement('p');p.className='meca-admin-live-status';p.textContent='Synchronisation indisponible : '+e.message;main.prepend(p)}
};