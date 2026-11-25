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
   const fields=[['Type de véhicule','vehicleType'],['Marque','brand'],['Modèle','model'],['Année','year'],['Motorisation','engine'],['Carburant','fuel'],['Boîte','gearbox'],['Finition','trim'],['Pièce recherchée','part'],['Référence de pièce','ref'],['VIN','vin'],['Budget maximum d’achat de la pièce','budget'],['Remarques','notes']];
   function showDossier(row){
     if(!row){detail.textContent='Sélectionnez un dossier.';return}
     const lines=['DOSSIER '+(row.reference||row.id),'Statut : '+(row.statut==='refuse'?'Devis refusé — dossier clôturé':row.statut||'—')+(row.statut==='devis_envoye'&&row.devis_decision==='accepte'?' (devis accepté, paiement initial attendu)':''),'Client : '+(row.contact||'—'),'E-mail : '+(row.email||'—'),'Créé le : '+(row.cree_le?new Date(row.cree_le).toLocaleString('fr-FR'):'—'),'Type : '+(row.type_dossier==='professionnel'?'Professionnel':'Particulier')];
     lines.push('Téléphone : '+(String(row.telephone||'').trim()||'NON COMMUNIQUÉ — à demander au client'));
     const budget=String(row.details?.budget??'').trim();
     lines.push('Budget maximum de la pièce : '+(budget?budget:'NON COMMUNIQUÉ — aucun plafond annoncé ; validation du prix nécessaire avant achat'));
     for(const [label,key] of fields){if(key==='budget')continue;const v=row.details?.[key];if(v!==null&&v!==undefined&&String(v).trim())lines.push(label+' : '+String(v))}
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
   const assessmentPanel=document.createElement('section');assessmentPanel.className='panel';assessmentPanel.style.cssText='border:1px solid #be945a;padding:17px;margin:10px 0 14px';
   const assessmentTitle=document.createElement('h3');assessmentTitle.textContent='Bilan IA — formule définitive du dossier';
   const assessmentBody=document.createElement('div');assessmentBody.style.cssText='white-space:pre-wrap;line-height:1.65';
   assessmentPanel.append(assessmentTitle,assessmentBody);wrap.insertBefore(assessmentPanel,history);
   const conversationTitle=document.createElement('h2');conversationTitle.textContent='Conversation avec le client';wrap.insertBefore(conversationTitle,history);
   const quotePanel=document.createElement('section');quotePanel.className='panel meca-simple-proposal';quotePanel.style.cssText='margin-top:14px;border:1px solid #b07c3b;padding:18px';
   const quoteHeader=document.createElement('h3');quoteHeader.textContent='Ma proposition de recherche';quotePanel.append(quoteHeader);
   const quoteHelp=document.createElement('p');quoteHelp.className='muted';quoteHelp.textContent='L’IA prépare un message à partir du dossier. Relisez-le, adaptez-le avec vos mots, puis envoyez. Votre client choisira lui-même les options Express 48 h (+20 €), Express 24 h (+50 €) et demande de réservation 24 h (+10 €) au moment d’accepter le devis.';quotePanel.append(quoteHelp);
   const planLabel=document.createElement('label');planLabel.textContent='Formule proposée';
   const planSelect=document.createElement('select');planSelect.id='meca-quote-plan';const pendingOption=document.createElement('option');pendingOption.value='';pendingOption.textContent='Analyse du dossier en cours…';planSelect.append(pendingOption);
   for(const [key,name] of [['ciblee','Recherche ciblée — 39 € · 3 jours ouvrés'],['approfondie','Recherche approfondie — 79 € · 5 jours ouvrés'],['expert','Investigation Expert — 149 € · 7 jours ouvrés']]){const option=document.createElement('option');option.value=key;option.textContent=name;planSelect.append(option)}
   planLabel.append(planSelect);quotePanel.append(planLabel);planSelect.disabled=true;
   const titleLabel=document.createElement('label');titleLabel.textContent='Civilité (ne pas deviner à partir du nom)';
   const titleSelect=document.createElement('select');
   for(const [value,label] of [['','Madame, Monsieur (si inconnue)'],['Monsieur','Monsieur'],['Madame','Madame']]){const o=document.createElement('option');o.value=value;o.textContent=label;titleSelect.append(o)}
   titleLabel.append(titleSelect);quotePanel.append(titleLabel);
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
   const optionPreview=document.createElement('section');optionPreview.style.cssText='padding:12px 15px;border:1px solid #555;border-radius:9px;margin:12px 0';
   optionPreview.innerHTML='<h4>Formulaire que le client verra SOUS votre signature</h4><p>Choix obligatoire du délai : ◯ Sans Express (0 €) &nbsp; ◯ 48 h (+20 €) &nbsp; ◯ 24 h (+50 €)</p><p>Réservation fournisseur 24 h : ◯ Oui (+10 €) &nbsp; ◯ Non (0 €)</p><p>☐ Conditions générales acceptées</p><p><b>Boutons :</b> Confirmer mon devis et payer / Refuser le devis</p><p class="muted">Aucune option n’est précochée. Le client choisit, confirme et paie. Cette partie n’est pas à rédiger dans votre message.</p>';
   quotePanel.append(optionPreview);
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
   const countryByBrand={volkswagen:'Allemagne',audi:'Allemagne',bmw:'Allemagne',mercedes:'Allemagne',opel:'Allemagne',porsche:'Allemagne',renault:'France',peugeot:'France',citroen:'France',citroën:'France',fiat:'Italie',alfa:'Italie',seat:'Espagne',skoda:'République tchèque',škoda:'République tchèque',toyota:'Japon',nissan:'Japon',honda:'Japon',volvo:'Suède',saab:'Suède',hyundai:'Corée du Sud',kia:'Corée du Sud',ford:'États-Unis',chevrolet:'États-Unis'};
   const greeting=row=>titleSelect.value
     ?'Bonjour '+titleSelect.value+(dossierName(row)?' '+dossierName(row):'')+','
     :'Bonjour Madame, Monsieur'+(dossierName(row)?' '+dossierName(row):'')+',';
   const abroad=row=>{const brand=String(row?.details?.brand||'').toLocaleLowerCase('fr-FR').trim();const country=countryByBrand[brand];return country&&country!=='France'?'Si les premières pistes françaises ne suffisent pas, je pourrai également solliciter des fournisseurs en '+country+', pays historiquement lié à la marque '+String(row?.details?.brand||'')+'. Cela reste une piste de recherche, sans garantie de disponibilité ni d’origine de la pièce.':'Je commencerai par des pistes françaises et, si cette référence est difficile à trouver, j’élargirai la recherche à des fournisseurs étrangers appropriés.'};
   let draftDirty=false;personal.addEventListener('input',()=>{draftDirty=true});
   function defaultDraft(row,formule){
    const p=plans[formule]||plans.approfondie,d=row?.details||{};
    const vehicle=[d.brand,d.model,d.year].filter(Boolean).join(' ');
    const part=String(d.part||'la pièce demandée');
    const reference=d.ref?(' (référence '+d.ref+')'):'';
    return [
      greeting(row),
      '',
      'J’ai étudié votre demande concernant '+part+reference+(vehicle?' pour votre '+vehicle:'')+'.',
      '',
      'Je vais d’abord vérifier les références exactes et la compatibilité pour éviter de vous orienter vers une mauvaise pièce. Il faudra également confirmer les stocks réels auprès de fournisseurs adaptés.',
      '',
      abroad(row),
      '',
      ...(String(row?.telephone||'').trim()?[]:['Afin de pouvoir vous joindre rapidement si un fournisseur répond ou si une précision est nécessaire, pourriez-vous également me communiquer un numéro de téléphone ?','']),
      ...(String(d.budget??'').trim()?[]:['Vous n’avez pas indiqué de budget maximal pour l’achat de la pièce. Je pourrai examiner les offres disponibles sans plafond prédéfini, mais je vous demanderai votre accord sur le prix avant toute décision d’achat.','']),
      'Compte tenu de ces vérifications, je vous propose la formule '+p.name+' à '+p.price+' €, avec un délai de '+p.days+' jours ouvrés après acceptation, paiement initial et réception des informations nécessaires.',
      '',
      'Vous pourrez choisir sous ce message une recherche Express en 48 h (+20 €) ou en 24 h (+50 €). Cette option se règle à l’avance avec l’acompte : si le délai convenu n’est pas tenu, son supplément sera remboursé. Vous pourrez également demander une réservation de la pièce pendant 24 h auprès du fournisseur (+10 €), indépendamment du délai de recherche choisi ; elle reste sous réserve de confirmation du fournisseur.',
      '',
      'Vous restez libre de votre choix.',
      '',
      'Cordialement,',
      'L’équipe Mécascope'
    ].join('\n');
   }
   function buildProposal(){
     const row=dossiers.find(x=>x.id===select.value);
     if(row?.statut==='devis_envoye'&&row.proposition_texte)return row.proposition_texte;
     return 'Dossier '+(row?.reference||'à sélectionner')+'\n\n'+personal.value.trim();
   }
   function setPriceInfo(){const p=plans[planSelect.value]||plans.ciblee;priceInfo.textContent='Formule '+p.price+' € : acompte '+p.initial+' € + solde '+p.solde+' € si recherche aboutie. Options du client : 48 h +20 €, 24 h +50 €, réservation +10 € (payées avec l’acompte).'}
   function renderAssessment(q){
     if(!q||!plans[q.formule]){assessmentBody.textContent='Analyse en attente. Aucun prix provisoire ne peut être transmis au client.';quoteButton.disabled=true;return}
     const p=plans[q.formule];planSelect.value=q.formule;planSelect.disabled=true;
     assessmentBody.textContent='Formule retenue : '+p.name+' — '+p.price+' €'
       +'\nDélai prévu : '+p.days+' jours ouvrés'
       +'\nAcompte : '+p.initial+' € · Solde en cas de réussite : '+p.solde+' €'
       +'\nDifficulté : '+(q.difficulte||'évaluation à confirmer')
       +'\nAnalyse / justification : '+(q.justification||'références et compatibilité à vérifier')
       +'\nPoints sensibles : '+(Array.isArray(q.risques)?q.risques.join(' ; '):q.risques||'à vérifier')
       +'\nRecherche : en France, et auprès de fournisseurs étrangers si le dossier le justifie.'
       +'\n\nCe tarif est enregistré pour ce dossier. Une nouvelle analyse ne peut pas le remplacer automatiquement.';
     quoteButton.disabled=false;setPriceInfo();
   }
   let currentAiDossier=null;
   async function analyzeCurrent(force=false){
     const row=dossiers.find(x=>x.id===select.value);if(!row||row.type_dossier==='professionnel'||!['deposee','devis_envoye'].includes(row.statut))return;
     const id=row.id;
     if(!force&&currentAiDossier===id)return;
     if(row.qualification_ia?.formule){renderAssessment(row.qualification_ia);return}
     currentAiDossier=id;aiBtn.disabled=true;aiStatus.textContent='L’IA examine la demande et prépare une réponse…';
     try{
       const r=await fetch('/api/qualification',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,contact:row.contact||'',civilite:titleSelect.value||null}),cache:'no-store'});
       const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'Analyse indisponible');
       if(select.value!==id)return;
       const q=data.qualification||{},key=q.formule;
       if(!plans[key])throw Error('Formule IA invalide : envoi bloqué');
       row.qualification_ia=q;renderAssessment(q);
       if(row.statut==='deposee'&&!draftDirty){
         const text=String(q.message_client||'').trim();
         // Le tarif affiché et le message sont toujours le même : une suggestion hors tarif est rejetée.
         const exact=String(plans[key].price)+' €';
         const draft=text.length>75&&text.includes(exact)?text:defaultDraft(row,key);
         const heading=greeting(row);
         const telephoneManquant=!String(row.telephone||'').trim();
         const budgetManquant=!String(row.details?.budget??'').trim();
         const first=draft.replace(/^Bonjour[^\n]*/,heading)
           .replace(/\s*Vous restez libre de votre choix\.[\s\S]*$/,'')
           .replace(/\s*Cordialement,[\s\S]*$/,'').trimEnd();
         const phoneLine=telephoneManquant?'\n\nPourriez-vous également me communiquer un numéro de téléphone afin de pouvoir vous joindre rapidement si un fournisseur a besoin d’une confirmation ?':'';
         const budgetLine=budgetManquant?'\n\nVous n’avez pas indiqué de budget maximal pour l’achat de la pièce. Je pourrai examiner différentes offres et vous demanderai votre accord sur le prix avant tout achat.':'';
         personal.value=first+phoneLine+budgetLine+'\n\nVous restez libre de votre choix.\n\nCordialement,\nL’équipe Mécascope';
       }
       aiDetails.textContent='Difficulté : '+(q.difficulte||'à préciser')+'\nPourquoi cette formule : '+(q.justification||'à vérifier')+'\nRisques / contrôles : '+(Array.isArray(q.risques)?q.risques.join(' ; '):q.risques||'à vérifier')+'\nInformations utiles : '+(Array.isArray(q.questions_client)?q.questions_client.join(' ; '):'—')+'\nPistes de recherche : '+(Array.isArray(q.pistes_recherche)?q.pistes_recherche.join(' ; '):'—');
       aiStatus.textContent='Proposition IA préparée. Vous pouvez modifier librement le message et la formule ; rien n’a été envoyé.';
       setPriceInfo();
     }catch(e){if(select.value===id){aiStatus.textContent='IA indisponible : '+e.message+' — vous pouvez utiliser et modifier le brouillon déjà préparé.';currentAiDossier=null}}
     finally{aiBtn.disabled=false}
   }
   aiBtn.onclick=()=>{
     const row=dossiers.find(x=>x.id===select.value);
     if(row?.qualification_ia?.formule){renderAssessment(row.qualification_ia);aiStatus.textContent='La recommandation est figée : aucune nouvelle estimation de prix n’est lancée.';return}
     analyzeCurrent(true);
   };
   titleSelect.onchange=()=>{
     if(draftDirty){proposalStatus.textContent='Civilité modifiée : corrigez seulement la salutation si vous avez déjà personnalisé le texte.';return}
     const row=dossiers.find(x=>x.id===select.value);if(row&&row.statut==='deposee'){personal.value=personal.value.replace(/^Bonjour[^\\n]*/,greeting(row))}
   };
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
     const row=dossiers.find(x=>x.id===select.value),existing=row?.statut==='devis_envoye';
     quotePanel.hidden=!row||!['deposee','devis_envoye','acompte_paye'].includes(row.statut);
     quoteButton.hidden=!row||!['deposee','devis_envoye'].includes(row.statut)||(existing&&row.devis_decision!=='en_attente');
     failButton.hidden=!row||row.statut!=='acompte_paye';
     personal.disabled=existing;planSelect.disabled=true;
     quoteButton.textContent=existing?'Renvoyer le même devis':'Envoyer ma proposition au client';
     draftDirty=false;
     const key=row?.qualification_ia?.formule||row?.offre;
     planSelect.value=key&&plans[key]?key:'';
     personal.value=existing?(row.proposition_texte||''):(row&&key&&plans[key]?defaultDraft(row,key):'');
     proposalStatus.textContent='';aiDetails.textContent='';aiStatus.textContent='';currentAiDossier=null;
     if(row?.qualification_ia?.formule)renderAssessment(row.qualification_ia);
     else if(row?.statut==='deposee'){renderAssessment(null);analyzeCurrent()}
     else{assessmentBody.textContent='Aucune qualification disponible pour ce dossier.';quoteButton.disabled=true}
   }
   quoteButton.onclick=async()=>{
     const row=dossiers.find(x=>x.id===select.value);if(!row)return;
     const fixed=row.qualification_ia?.formule;
     if(!fixed||fixed!==planSelect.value){proposalStatus.textContent='Le tarif n’est pas cohérent avec le bilan IA enregistré. Envoi bloqué.';return}
     const message=buildProposal();
     const requiredPrice=String(plans[fixed].price)+' €';
     if(!message.includes(requiredPrice)){proposalStatus.textContent='Le message doit contenir le tarif exact enregistré : '+requiredPrice+'. Corrigez la proposition avant envoi.';return}
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