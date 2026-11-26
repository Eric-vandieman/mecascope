'use strict';
(()=>{
 const endpoint='/api/push',vapidID='meca-push-vapid';
 const isSupported=()=>('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window);
 let registration=null,config=null,interval=null;
 let urgentSoundEnabled=false,urgentAudio=null,urgentBaseline=false;
 const urgentSeen=new Set();
 const playUrgentTone=()=>{
  if(!urgentSoundEnabled||!urgentAudio)return;
  try{
   if(urgentAudio.state==='suspended')urgentAudio.resume().catch(()=>{});
   const start=urgentAudio.currentTime+.05;
   for(const [i,freq] of [740,1047,740,1175].entries()){
    const osc=urgentAudio.createOscillator(),gain=urgentAudio.createGain(),t=start+i*.18;
    osc.type='square';osc.frequency.setValueAtTime(freq,t);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.12,t+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.145);
    osc.connect(gain);gain.connect(urgentAudio.destination);osc.start(t);osc.stop(t+.15);
   }
  }catch{}
 };
 const api=async payload=>{
  const session=await fetch('/api/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session'}),cache:'no-store'});
  if(!session.ok)throw Error('Connexion administrateur requise');
  const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.message||'Fonction indisponible');
  return json;
 };
 const bytes=str=>{const b64=(str+'='.repeat((4-str.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b64),c=>c.charCodeAt(0))};
 const state=(v,message,enabled,disabled)=>{
  if(message)message.textContent=v;
  if(enabled)enabled.disabled=v.startsWith('Activées')||v.startsWith('Autorisation refusée')||v.startsWith('Non compatible');
  if(disabled)disabled.disabled=!v.startsWith('Activées');
 };
 async function updateRegistration(){
  if(!isSupported())return null;
  registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  await registration.update();
  return registration;
 }
 async function fetchCenter(host,button){
  const details=host.querySelector('.meca-push-items');if(!details)return;
  try{
   const data=await api({action:'center'});
   button.textContent='🔔 '+Number(data.unread||0);
   details.replaceChildren();
   const items=data.notifications||[];
   for(const n of items){
    if(n.event_type!=='demande_urgente'||n.lu_le)continue;
    if(urgentBaseline&&!urgentSeen.has(n.id))playUrgentTone();
    urgentSeen.add(n.id);
   }
   urgentBaseline=true;
   if(!items.length){const p=document.createElement('p');p.textContent='Aucune notification pour le moment.';details.append(p);return}
   for(const n of items){
    const entry=document.createElement('button');entry.type='button';
    entry.className='meca-push-item'+(!n.lu_le?' unread':'');
    const date=new Date(n.cree_le).toLocaleString('fr-FR');
    entry.textContent=(n.event_type==='demande_urgente'?'🚨 URGENT · ':'')+(n.lu_le?'':'● ')+n.titre+' — '+n.message+' · '+n.reference+' · '+date;
    if(n.event_type==='demande_urgente'){entry.style.border='2px solid #e88c3b';entry.style.background='rgba(152,64,29,.19)';}
    entry.onclick=async()=>{
     await api({action:'center',mark:n.id}).catch(()=>{});
     host.hidden=true;
     const destination='/admin/demandes?dossier='+encodeURIComponent(n.dossier_id)+(n.source_type==='professionnel'?'&source=professionnel':'');
     if(location.hash==='#'+destination)window.dispatchEvent(new HashChangeEvent('hashchange'));
     else location.hash=destination;
    };
    details.append(entry);
   }
  }catch(e){details.textContent='Notifications indisponibles : '+e.message}
 }
 async function addCenter(){
  if(document.querySelector('#meca-push-bell'))return;
  const top=document.querySelector('.admin-top')||document.querySelector('header.top');
  if(!top)return;
  const wrap=document.createElement('div');wrap.className='meca-push-bell-wrap';
  const button=document.createElement('button');button.type='button';button.id='meca-push-bell';
  button.className='meca-push-bell';button.textContent='🔔';button.title='Centre de notifications';
  const panel=document.createElement('section');panel.className='meca-push-center';panel.hidden=true;
  const title=document.createElement('h2');title.textContent='Notifications Mécascope';panel.append(title);
  const list=document.createElement('div');list.className='meca-push-items';panel.append(list);
  const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Actualiser';
  refresh.onclick=()=>fetchCenter(panel,button);panel.append(refresh);
  button.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)fetchCenter(panel,button)};
  wrap.append(button,panel);top.append(wrap);
  fetchCenter(panel,button);
  if(interval)clearInterval(interval);
  interval=setInterval(()=>{if(document.querySelector('#meca-push-bell'))fetchCenter(panel,button);else clearInterval(interval)},45000);
 }
 const catalog=[
  ['Demandes clients','nouvelle_demande','Nouvelle demande particulière'],
  ['Demandes clients','demande_urgente','Nouvelle demande signalée urgente'],
  ['Demandes clients','nouvelle_demande_pro','Nouvelle demande professionnelle'],
  ['Demandes clients','demande_pro_validee','Demande professionnelle validée'],
  ['Devis','devis_emis','Proposition envoyée au client'],
  ['Devis','devis_accepte','Devis accepté par le client'],
  ['Devis','devis_refuse','Devis refusé par le client'],
  ['Paiements','paiement_initial','Acompte confirmé par Stripe'],
  ['Paiements','solde_regle','Paiement du solde confirmé'],
  ['Recherche','dossier_urgent','Option Express sélectionnée'],
  ['Recherche','piece_trouvee','Pièce trouvée / résultat fournisseur'],
  ['Recherche','recherche_infructueuse','Recherche clôturée sans résultat'],
  ['Communication','message_client','Nouveau message client']
 ];
 const planned=[
  ['Suivi et délais','relance_devis','Devis sans réponse après 24 h / 48 h'],
  ['Suivi et délais','echeance_sla','Délai contractuel proche de l’échéance'],
  ['Suivi et délais','infos_attente','Informations complémentaires reçues'],
  ['Suivi et délais','reservation','Réservation fournisseur confirmée / échouée'],
  ['Comptes et équipes','compte_client','Compte client créé ou confirmé'],
  ['Comptes et équipes','equipe_pro','Collaborateur Pro invité / ajouté'],
  ['Comptes et équipes','abonnement_pro','Souscription / renouvellement Pro'],
  ['Comptes et équipes','credits_pro','Crédits Pro faibles / expirés'],
  ['Gestion financière','remboursement','Remboursement / réclamation'],
  ['Gestion financière','paiement_echoue','Paiement refusé ou abandonné']
 ];
 async function preferencesTable(area){
  const section=document.createElement('section');section.className='panel';section.id='meca-notification-preferences';
  section.style.cssText='margin-top:18px';
  const title=document.createElement('h2');title.textContent='Mes préférences de notifications';
  const desc=document.createElement('p');desc.className='muted';desc.textContent='Pour chaque situation, choisissez une alerte Push sur vos appareils et/ou un événement visible dans la cloche 🔔. Les réglages sont enregistrés dès que vous les modifiez. Les alertes masquées restent dans le journal technique pour l’audit.';
  const note=document.createElement('p');note.className='muted';note.setAttribute('role','status');note.textContent='Chargement des préférences…';
  const tableWrap=document.createElement('div');tableWrap.style.cssText='overflow-x:auto;width:100%';
  const table=document.createElement('table');table.className='table';table.style.cssText='width:100%;min-width:520px;border-collapse:collapse';
  const thead=document.createElement('thead'),header=document.createElement('tr');
  for(const label of ['Événement / situation','Push Android','Cloche 🔔','État']){
   const cell=document.createElement('th');cell.textContent=label;cell.scope='col';cell.style.cssText='padding:12px 8px;text-align:left';header.append(cell);
  }
  thead.append(header);table.append(thead);
  const tbody=document.createElement('tbody');table.append(tbody);tableWrap.append(table);
  section.append(title,desc,note,tableWrap);area.after(section);
  let data;
  try{data=await api({action:'preferences'});}catch(e){note.textContent='Impossible de charger les préférences : '+e.message;return}
  const settings=new Map((data.preferences||[]).map(x=>[x.event_type,x]));
  const renderGroup=(name,items,available)=>{
   const group=document.createElement('tr'),h=document.createElement('th');h.colSpan=4;h.textContent=name;h.style.cssText='text-align:left;background:rgba(240,166,77,.12);padding:13px 8px;color:#f0b678';group.append(h);tbody.append(group);
   for(const [,key,label] of items){
    const saved=settings.get(key)||{push_enabled:true,center_enabled:true};
    const tr=document.createElement('tr');tr.style.borderBottom='1px solid rgba(180,180,180,.18)';
    const nameCell=document.createElement('td');nameCell.textContent=label;nameCell.style.padding='12px 8px';tr.append(nameCell);
    const checks=[];
    for(const [field,word] of [['push_enabled','Push'],['center_enabled','Cloche']]){
     const cell=document.createElement('td');cell.style.cssText='text-align:center;padding:12px 8px';
     const check=document.createElement('input');check.type='checkbox';check.checked=available?Boolean(saved[field]):false;check.disabled=!available;check.style.cssText='width:21px;height:21px;accent-color:#e99c43;cursor:pointer;margin:0';
     check.setAttribute('aria-label',word+' : '+label);
     cell.append(check);tr.append(cell);checks.push(check);
    }
    const stateCell=document.createElement('td');stateCell.style.cssText='padding:12px 8px;font-size:13px';stateCell.textContent=available?'Actif':'À venir';tr.append(stateCell);
    if(available){
     for(const check of checks)check.onchange=async()=>{
      checks.forEach(x=>x.disabled=true);stateCell.textContent='Enregistrement…';note.textContent='Sauvegarde des préférences en cours…';
      try{
       const v=await api({action:'save-preference',event_type:key,push_enabled:checks[0].checked,center_enabled:checks[1].checked});
       settings.set(key,v.saved);stateCell.textContent='Enregistré ✓';note.textContent='Préférence « '+label+' » enregistrée.';
       if(!checks[1].checked){const bell=document.querySelector('#meca-push-bell');if(bell)fetchCenter(bell.closest('.meca-push-bell-wrap').querySelector('.meca-push-center'),bell).catch(()=>{});}
      }catch(e){
       checks[0].checked=Boolean(settings.get(key)?.push_enabled??true);checks[1].checked=Boolean(settings.get(key)?.center_enabled??true);
       stateCell.textContent='Erreur';note.textContent='Sauvegarde impossible : '+e.message;
      }finally{checks.forEach(x=>x.disabled=false)}
     };
    }
    tbody.append(tr);
   }
  };
  for(const name of [...new Set(catalog.map(x=>x[0]))])renderGroup(name,catalog.filter(x=>x[0]===name),true);
  const titlePlanned=document.createElement('tr'),cellPlanned=document.createElement('th');cellPlanned.colSpan=4;cellPlanned.textContent='ÉVÉNEMENTS À RACCORDER — non configurables actuellement';cellPlanned.style.cssText='padding:14px 8px;text-align:left';titlePlanned.append(cellPlanned);tbody.append(titlePlanned);
  for(const name of [...new Set(planned.map(x=>x[0]))])renderGroup(name,planned.filter(x=>x[0]===name),false);
  note.textContent='Préférences chargées. Les notifications ne seront envoyées que pour les situations cochées et déjà raccordées.';
 }
 async function setup(main,path){
  addCenter();
  const params=new URLSearchParams(location.hash.split('?')[1]||'');
  const proId=params.get('dossier');
  if(path==='/admin/demandes'&&params.get('source')==='professionnel'&&/^[a-f0-9-]{36}$/i.test(proId||'')){
   const box=document.createElement('section');box.className='panel meca-push-pro-detail';
   const title=document.createElement('h2');title.textContent='Dossier professionnel';box.append(title);
   const info=document.createElement('div');info.textContent='Chargement du dossier…';box.append(info);
   (main.querySelector('.pagehead')||main.firstElementChild)?.after(box);
   api({action:'pro-detail',id:proId}).then(result=>{
    const d=result.dossier;
    if(!d){info.textContent='Dossier introuvable.';return}
    info.replaceChildren();
    for(const [label,value] of [['Référence',d.reference],['Garage',d.garage_nom],['Contact',d.contact],['Téléphone',d.telephone],['SIRET',d.siret],['Ville',d.ville],['Pièce recherchée',d.piece],['Véhicule',[d.marque,d.modele,d.annee].filter(Boolean).join(' ')],['Référence pièce',d.reference_piece],['Budget',d.budget],['Statut',d.statut],['Validation responsable',d.approuvee?'Oui':'Non']]){
     const line=document.createElement('p');line.textContent=label+' : '+(value||'—');info.append(line)
    }
   }).catch(e=>info.textContent=e.message);
  }
  const old=main.querySelector('#meca-push-install');
  if(old)return;
  // Les réglages de notifications restent dans l’onglet Notifications, jamais sur l’accueil ni les dossiers.
  if(path!=='/admin/notifications')return;
  const area=document.createElement('section');area.className='panel meca-push-settings';area.id='meca-push-install';
  area.innerHTML='<h2>🔔 Alertes Android</h2><p>Recevez les nouvelles demandes, les paiements et les messages sur votre téléphone, même lorsque Chrome n’est pas au premier plan.</p>';
  const status=document.createElement('p');status.className='meca-push-status';status.setAttribute('role','status');area.append(status);
  const enabled=document.createElement('button');enabled.className='btn orange';enabled.type='button';enabled.textContent='🔔 Activer les notifications sur ce téléphone';
  const disabled=document.createElement('button');disabled.className='btn dark';disabled.type='button';disabled.textContent='Désactiver sur ce téléphone';
  const test=document.createElement('button');test.className='btn dark';test.type='button';test.textContent='Envoyer une notification de test';
  const sound=document.createElement('button');sound.className='btn dark';sound.type='button';sound.textContent='🔊 Activer le signal sonore Urgence (administration ouverte)';
  const soundHint=document.createElement('p');soundHint.className='muted';soundHint.textContent='Le signal distinctif fonctionne uniquement quand cette page est ouverte et que vous l’avez activé. En arrière-plan sur Android, le son dépend du système et ne peut pas être personnalisé par le site.';
  area.append(enabled,disabled,test,sound,soundHint);
  sound.onclick=()=>{
   if(urgentSoundEnabled){urgentSoundEnabled=false;sound.textContent='🔊 Activer le signal sonore Urgence (administration ouverte)';return}
   try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx){soundHint.textContent='Signal sonore non pris en charge par ce navigateur.';return}
    urgentAudio=urgentAudio||new Ctx();urgentAudio.resume().catch(()=>{});
    urgentSoundEnabled=true;
    sound.textContent='🔕 Désactiver le signal sonore Urgence';
    soundHint.textContent='Son Urgence activé pour cet onglet. Écoutez le signal de test ; les prochaines demandes urgentes déclencheront ce son tant que la page reste ouverte.';
    playUrgentTone();
   }catch(e){soundHint.textContent='Son indisponible : '+e.message}
  };
  const target=main.querySelector('.pagehead')||main.firstElementChild;
  if(target)target.after(area);else main.prepend(area);
  preferencesTable(area).catch(e=>{const p=document.createElement('p');p.textContent='Préférences indisponibles : '+e.message;area.after(p)});
  if(!isSupported()){state('Non compatible — Chrome Android récent requis',status,enabled,disabled);test.disabled=true;return}
  if(Notification.permission==='denied'){state('Autorisation refusée — réactivez-la dans les paramètres du navigateur',status,enabled,disabled);test.disabled=true;return}
  try{
   config=await api({action:'config'});
   if(!config?.ready||!config?.publicKey){state('Erreur de configuration — clés VAPID absentes',status,enabled,disabled);return}
   await updateRegistration();
   const sub=await registration.pushManager.getSubscription();
   if(sub&&Notification.permission==='granted'){
    await api({action:'subscribe',subscription:sub.toJSON()});
    state('Activées — notifications enregistrées sur cet appareil',status,enabled,disabled);
    test.disabled=false;
   }else{state('Désactivées — cliquez pour autoriser les alertes',status,enabled,disabled);test.disabled=true}
  }catch(e){state('Erreur de configuration : '+e.message,status,enabled,disabled)}
  enabled.onclick=async()=>{
   enabled.disabled=true;status.textContent='Activation…';
   try{
    // Cette demande de permission ne se produit qu'après un clic explicite.
    const permission=await Notification.requestPermission();
    if(permission!=='granted'){state('Autorisation refusée — vérifiez Chrome Android',status,enabled,disabled);return}
    const reg=registration||await updateRegistration();
    const subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(config.publicKey)});
    await api({action:'subscribe',subscription:subscription.toJSON()});
    state('Activées — les alertes Android sont enregistrées',status,enabled,disabled);test.disabled=false;
   }catch(e){state('Activation impossible : '+e.message,status,enabled,disabled);enabled.disabled=false}
  };
  disabled.onclick=async()=>{
   disabled.disabled=true;
   try{const subscription=await (registration||await updateRegistration()).pushManager.getSubscription();
    if(subscription){await api({action:'unsubscribe',endpoint:subscription.endpoint});await subscription.unsubscribe()}
    state('Désactivées — les alertes ont été retirées de cet appareil',status,enabled,disabled);test.disabled=true;
   }catch(e){status.textContent='Désactivation impossible : '+e.message;disabled.disabled=false}
  };
  test.onclick=async()=>{test.disabled=true;status.textContent='Envoi de test…';
   try{const data=await api({action:'test'});status.textContent=data.message||'Test accepté par le service Push'}
   catch(e){status.textContent='Test échoué : '+e.message}
   finally{test.disabled=false}
  };
 }
 window.mecaPushSetup=setup;
})();
