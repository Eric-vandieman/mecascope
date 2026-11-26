'use strict';
(()=>{
 const box=document.getElementById('meca-client-push');
 if(!box)return;
 const state=box.querySelector('[data-push-status]'),enable=box.querySelector('[data-push-enable]'),disable=box.querySelector('[data-push-disable]');
 const supported=()=>('serviceWorker'in navigator)&&('PushManager'in window)&&('Notification'in window);
 const api=async payload=>{
  const response=await fetch('/api/notifications-particulier',payload?{
   method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'
  }:{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.message||'Notifications indisponibles');
  return data;
 };
 const bytes=str=>{const b64=(str+'='.repeat((4-str.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(b64),c=>c.charCodeAt(0))};
 let registration=null,key=null;
 const status=(msg,active)=>{state.textContent=msg;enable.hidden=!!active;disable.hidden=!active};
 async function init(){
  if(!supported()){status('Notifications push non compatibles avec ce navigateur ou cet appareil.',false);enable.disabled=true;return}
  const cfg=await api();key=cfg.publicKey;
  if(!key)throw Error('Configuration des notifications manquante');
  registration=await navigator.serviceWorker.register('/sw-client.js',{scope:'/'});
  await registration.update();
  const sub=await registration.pushManager.getSubscription();
  if(sub&&Notification.permission==='granted'){
   await api({action:'subscribe',subscription:sub.toJSON()});
   status('Notifications de suivi activées sur cet appareil : devis disponible et pièce trouvée.',true);
  }else if(Notification.permission==='denied'){status('Notifications bloquées. Autorisez-les dans les réglages du navigateur pour ce site.',false);enable.disabled=true}
  else status('Notifications désactivées. Activez-les pour être averti des devis et des pièces trouvées, même lorsque cette page est fermée.',false);
 }
 window.addEventListener('meca-auth-updated',()=>init().catch(e=>status(e.message,false)),{once:true});
 enable.onclick=async()=>{
  enable.disabled=true;status('Activation des notifications…',false);
  try{
   if(!supported())throw Error('Ce navigateur ne gère pas les notifications');
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error('Notifications non autorisées sur cet appareil');
   const reg=registration||await navigator.serviceWorker.register('/sw-client.js',{scope:'/'});
   const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(key)});
   await api({action:'subscribe',subscription:sub.toJSON()});
   status('Notifications activées. Vous recevrez une alerte sur cet appareil pour un nouveau devis et une pièce trouvée.',true);
  }catch(e){status('Activation impossible : '+e.message,false)}
  finally{enable.disabled=false}
 };
 disable.onclick=async()=>{
  disable.disabled=true;
  try{
   const reg=registration||await navigator.serviceWorker.register('/sw-client.js',{scope:'/'});
   const sub=await reg.pushManager.getSubscription();
   if(sub){await api({action:'unsubscribe',endpoint:sub.endpoint});await sub.unsubscribe()}
   status('Notifications désactivées sur cet appareil. Les e-mails de suivi restent envoyés.',false);
  }catch(e){status('Désactivation impossible : '+e.message,true)}
  finally{disable.disabled=false}
 };
})();
