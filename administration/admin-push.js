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
