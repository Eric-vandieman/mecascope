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
     const lines=['DOSSIER '+(row.reference||row.id),'Statut : '+(row.statut==='refuse'?'Devis refusé — dossier clôturé':row.statut||'—')+(row.statut==='devis_envoye'&&row.devis_decision==='accepte'?' (devis accepté, paiement initial attendu)':''),'Client : '+(row.contact||'—'),'E-mail : '+(row.email||'—'),'Créé le : '+(row.cree_le?new Date(row.cree_le).toLocaleString('fr-FR'):'—'),'Type : '+(row.type_dossier==='professionnel'?'Professionnel':'Particulier')];
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

   // Conversation = historique + une proposition prête à envoyer, sans plusieurs formulaires redondants.
   const conversationTitle=document.createElement('h2');conversationTitle.textContent='Conversation avec le client';wrap.insertBefore(conversationTitle,history);
   const quotePanel=document.createElement('section');quotePanel.className='panel meca-simple-proposal';quotePanel.style.cssText='margin-top:14px;border:1px solid #b07c3b;padding:18px';
   const quoteHeader=document.createElement('h3');quoteHeader.textContent='Ma proposition de recherche';quotePanel.append(quoteHeader);
   const quoteHelp=document.createElement('p');quoteHelp.className='muted';quoteHelp.textContent='L’IA prépare un message à partir du dossier. Relisez-le, adaptez-le avec vos mots, puis envoyez. Votre client choisira lui-même les options Express 48 h (+20 €), Express 24 h (+50 €) et réservation fournisseur (+10 €) au moment d’accepter le devis.';quotePanel.append(quoteHelp);
   const planLabel=document.createElement('label');planLabel.textContent='Formule proposée';
   const planSelect=document.createElement('select');planSelect.id='meca-quote-plan';
   for(const [key,name] of [['ciblee','Recherche ciblée — 39 € · 3 jours ouvrés'],['approfondie','Recherche approfondie — 79 € · 5 jours ouvrés'],['expert','Investigation Expert — 149 € · 7 jours ouvrés']]){const option=document.createElement('option');option.value=key;option.textContent=name;planSelect.append(option)}
   planLabel.append(planSelect);quotePanel.append(planLabel);
   const aiPanel=document.createElement('div');aiPanel.style.cssText='padding:10px 0';
   const aiBtn=document.createElement('button');aiBtn.type='button';aiBtn.className='btn dark';aiBtn.textContent='↻ Préparer / actualiser avec l’IA';
   const aiStatus=document.createElement('p');aiStatus.setAttribute('role','status');aiStatus.className='muted';
   const aiOutput=document.createElement('details');aiOutput.innerHTML='<summary>Voir les conseils techniques privés de l’IA</summary>';
   const aiDetails=document.createElement('pre');aiDetails.style.cssText='white-space:pre-wrap;font:inherit;line-height:1.6;max-height:400px;overflow:auto';aiOutput.append(aiDetails);
   aiPanel.append(aiBtn,aiStatus,aiOutput);quotePanel.append(aiPanel);
   const personalLabel=document.createElement('label');personalLabel.textContent='Message au client (modifiable avant envoi)';
   const personal=document.createElement('textarea');personal.rows=11;personal.maxLength=2600;personal.style.cssText='display:block;width:100%;line-height:1.65;padding:12px';personal.placeholder='L’IA prépare automatiquement votre proposition ici. Vous pouvez tout réécrire avant de l’envoyer.';
   personalLabel.append(personal);quotePanel.append(personalLabel);
   const priceInfo=document.createElement('p');priceInfo.className='muted';quotePanel.append(priceInfo);
   const quoteButton=document.createElement('button');quoteButton.type='button';quoteButton.className='btn orange';quoteButton.textContent='Envoyer ma proposition au client';quotePanel.append(quoteButton);
   const proposalStatus=document.createElement('p');proposalStatus.setAttribute('role','status');quotePanel.append(proposalStatus);
   const failButton=document.createElement('button');failButton.type='button';failButton.className='btn danger';failButton.textContent='Clôturer la recherche sans résultat';failButton.hidden=true;quotePanel.append(failButton);
   wrap.append(quotePanel);
   const chatPanel=document.createElement('div');chatPanel.style.cssText='margin-top:18px';
   const chatHeading=document.createElement('h3');chatHeading.textContent='Envoyer un simple message (sans devis)';chatPanel.append(chatHeading);
   const chatInput=document.createElement('textarea');chatInput.rows=3;chatInput.maxLength=3000;chatInput.placeholder='Une question ou un complément pour le client…';chatInput.style.width='100%';
   const chatButton=document.createElement('button');chatButton.type='button';chatButton.className='btn dark';chatButton.textContent='Envoyer ce message';
   const chatStatus=document.createElement('p');chatStatus.setAttribute('role','status');chatPanel.append(chatInput,chatButton,chatStatus);wrap.append(chatPanel);
   const plans={ciblee:{price:39,initial:19,solde:20,days:3,name:'Recherche ciblée'},approfondie:{price:79,initial:39,solde:40,days:5,name:'Recherche approfondie'},expert:{price:149,initial:69,solde:80,days:7,name:'Investigation Expert'}};
   const dossierName=row=>String(row?.contact||'').trim();
   function defaultDraft(row,formule){
    const p=plans[formule]||plans.approfondie,d=row?.details||{};
    const vehicle=[d.brand,d.model,d.year].filter(Boolean).join(' ');
    const part=String(d.part||'la pièce demandée');
    const reference=d.ref?(' (référence '+d.ref+')'):'';
    const greeting=dossierName(row)?'Bonjour '+dossierName(row)+',':'Bonjour,';
    return greeting+'\n\nJ’ai regardé votre demande concernant '+part+reference+(vehicle?' pour votre '+vehicle:'')+'. Pour éviter de vous orienter vers une pièce qui ne conviendrait pas, je vais d’abord vérifier les références compatibles et les fournisseurs susceptibles de l’avoir. La disponibilité reste à confirmer.\n\nPour cette recherche, je vous propose la formule '+p.name+' à '+p.price+' €, avec un délai de '+p.days+' jours ouvrés à compter de la validation et du paiement initial. '+(formule==='approfondie'?'Le travail nécessite des vérifications plus étendues qu’une recherche ciblée à 39 €. ':formule==='expert'?'La difficulté suppose une recherche auprès de sources spécialisées. ':'Cette formule permet de commencer par une recherche ciblée. ')+'\n\nSi vous le souhaitez, vous pourrez choisir directement sur le devis une recherche Express en 48 h (+20 €), en 24 h (+50 €) ou une demande de réservation auprès du fournisseur (+10 €). Ces options sont facultatives et réglées avec l’acompte ; elles sont remboursables si leurs conditions de réalisation ne sont pas remplies. Le prix d’achat de la pièce reste distinct.\n\nJe reste disponible si vous souhaitez une précision.\n\nCordialement,\nMécascope';
   }
   function buildProposal(){
     const row=dossiers.find(x=>x.id===select.value);
     if(row?.statut==='devis_envoye'&&row.proposition_texte)return row.proposition_texte;
     return 'Dossier '+(row?.reference||'à sélectionner')+'\n\n'+personal.value.trim();
   }
   function setPriceInfo(){const p=plans[planSelect.value]||plans.ciblee;priceInfo.textContent='Formule '+p.price+' € : acompte '+p.initial+' € + solde '+p.solde+' € si recherche aboutie. Options du client : 48 h +20 €, 24 h +50 €, réservation +10 € (payées avec l’acompte).'}
   planSelect.onchange=()=>{
     setPriceInfo();
     const row=dossiers.find(x=>x.id===select.value);
     if(!row||row.statut!=='deposee')return;
     // Si l'administrateur change la formule, le brouillon suit sans écraser le texte déjà personnalisé.
     proposalStatus.textContent='Formule modifiée : adaptez si nécessaire le tarif et le délai dans le message avant l’envoi.';
   };
   let currentAiDossier=null;
   async function analyzeCurrent(force=false){
     const row=dossiers.find(x=>x.id===select.value);if(!row||row.type_dossier==='professionnel'||!['deposee','devis_envoye'].includes(row.statut))return;
     const id=row.id;
     if(!force&&currentAiDossier===id)return;
     currentAiDossier=id;aiBtn.disabled=true;aiStatus.textContent='L’IA examine la demande et prépare une réponse…';
     try{
       const r=await fetch('/api/qualification',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,contact:row.contact||''}),cache:'no-store'});
       const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'Analyse indisponible');
       if(select.value!==id)return;
       const q=data.qualification||{};const key=plans[q.formule]?q.formule:'approfondie';
       if(row.statut==='deposee'){
         planSelect.value=key;
         const proposal=String(q.message_client||'').trim();
         personal.value=proposal.length>75?proposal:defaultDraft(row,key);
       }
       aiDetails.textContent='Difficulté : '+(q.difficulte||'à préciser')+'\nPourquoi cette formule : '+(q.justification||'à vérifier')+'\nRisques / contrôles : '+(Array.isArray(q.risques)?q.risques.join(' ; '):q.risques||'à vérifier')+'\nInformations utiles : '+(Array.isArray(q.questions_client)?q.questions_client.join(' ; '):'—')+'\nPistes de recherche : '+(Array.isArray(q.pistes_recherche)?q.pistes_recherche.join(' ; '):'—');
       aiStatus.textContent='Proposition IA préparée. Vous pouvez modifier librement le message et la formule ; rien n’a été envoyé.';
       setPriceInfo();
     }catch(e){if(select.value===id){aiStatus.textContent='IA indisponible : '+e.message+' — vous pouvez utiliser et modifier le brouillon déjà préparé.';currentAiDossier=null}}
     finally{aiBtn.disabled=false}
   }
   aiBtn.onclick=()=>analyzeCurrent(true);
   chatButton.onclick=async()=>{
     const row=dossiers.find(x=>x.id===select.value),message=chatInput.value.trim();
     if(!row||!message){chatStatus.textContent='Choisissez un dossier et écrivez votre message.';return}
     if(!confirm('Envoyer ce message au client dans son espace de suivi ?'))return;
     chatButton.disabled=true;
     try{const response=await call({action:'chat',id:row.id,message});chatInput.value='';chatStatus.textContent=response.message||'Message enregistré.';await refreshHistory()}
     catch(e){chatStatus.textContent=e.message}finally{chatButton.disabled=false}
   };
   form.insertAdjacentHTML('beforeend','<label class="wide"><input type="checkbox" name="expressEligible"> Délai Express tenu et éligible au supplément prévu</label><label class="wide"><input type="checkbox" name="reservationConfirmed"> Réservation fournisseur effectivement confirmée</label>');

   function showOptions(){
     const row=dossiers.find(x=>x.id===select.value),existing=row?.statut==='devis_envoye',canQuote=row&&['deposee','devis_envoye'].includes(row.statut);
     quotePanel.hidden=!row||!['deposee','devis_envoye','acompte_paye'].includes(row.statut);
     quoteButton.hidden=!canQuote||(existing&&row.devis_decision!=='en_attente');
     failButton.hidden=!row||row.statut!=='acompte_paye';
     planSelect.value=existing&&plans[row.offre]?row.offre:'approfondie';
     planSelect.disabled=existing;personal.disabled=existing;
     quoteButton.textContent=existing?'Renvoyer le même devis':'Envoyer ma proposition au client';
     personal.value=existing?(row.proposition_texte||''):(row?defaultDraft(row,planSelect.value):'');
     setPriceInfo();
     proposalStatus.textContent='';
     aiDetails.textContent='';
     aiStatus.textContent='';
     currentAiDossier=null;
     if(row&&row.statut==='deposee'&&row.type_dossier!=='professionnel')analyzeCurrent();
   }
   quoteButton.onclick=async()=>{
     const row=dossiers.find(x=>x.id===select.value);if(!row)return;
     const message=buildProposal();
     if(message.length<80||message.length>2800){proposalStatus.textContent='Vérifiez votre message (80 à 2 800 caractères, référence comprise).';return}
     if(!confirm('Envoyer votre proposition de '+(plans[planSelect.value]?.price||'—')+' € à '+(row.contact||'ce client')+' avec toutes les options facultatives à sélectionner sur son devis ?'))return;
     quoteButton.disabled=true;proposalStatus.textContent='Envoi de votre proposition…';
     try{const result=await call({action:'quote',id:row.id,offre:planSelect.value,proposal:message});proposalStatus.textContent=result.message||'Devis transmis au client.';await refreshHistory();location.reload()}
     catch(e){proposalStatus.textContent=e.message}finally{quoteButton.disabled=false}
   };
   failButton.onclick=async()=>{const d=dossiers.find(x=>x.id===select.value);if(!d||!confirm('Clôturer cette recherche comme infructueuse, sans solde à payer ?'))return;
    failButton.disabled=true;try{await call({action:'fail',id:d.id});await call({action:'reply',id:d.id,found:false,message:'Nous vous informons que notre recherche n’a pas permis d’identifier une pièce conforme. Aucun solde de réussite n’est dû. Nous restons à votre disposition pour tout complément.'});alert('Recherche clôturée et client informé.');location.reload()}catch(e){alert(e.message)}finally{failButton.disabled=false}
   };

   async function refreshHistory(){history.textContent='';if(!select.value)return;try{const r=await call({action:'messages',id:select.value});for(const m of r.messages||[]){const p=document.createElement('p');p.textContent=(m.auteur==='client'?'Client':'Mécascope')+' · '+new Date(m.cree_le).toLocaleString('fr-FR')+' : '+m.contenu;history.append(p)}}catch(e){history.textContent=e.message}}
   window.mecaPieceHistory?.(main,select,dossiers);
   select.onchange=()=>{const row=dossiers.find(x=>x.id===select.value);form.elements.ref.value=row?.reference||'';showDossier(row);showOptions();refreshHistory()};
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