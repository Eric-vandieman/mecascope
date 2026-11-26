'use strict';
const API='/api/particulier-auth';
const form=document.getElementById('meca-auth-form');
const status=document.querySelector('.meca-auth-status');
const setStatus=(message,ok=false)=>{if(status){status.textContent=message;status.dataset.ok=ok?'true':'false'}};
document.querySelectorAll('.meca-toggle-pass').forEach(button=>button.addEventListener('click',()=>{
  const input=button.parentElement.querySelector('input');
  const shown=input.type==='text';input.type=shown?'password':'text';button.textContent=shown?'Afficher':'Masquer';
}));
if(form)form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));
  const mode=form.dataset.mode;
  if(mode==='signup' && data.password!==data.confirm){setStatus('Les mots de passe ne correspondent pas.');return}
  if(mode==='signup' && data.legal!=='on'){setStatus('Vous devez accepter les CGU et les CGV.');return}
  const submit=form.querySelector('[type="submit"]');submit.disabled=true;setStatus('Vérification en cours…');
  try{
    const r=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,email:data.email,password:data.password,prenom:data.prenom,nom:data.nom,telephone:data.telephone,legalAccepted:mode==='signup'&&data.legal==='on',legalVersion:'2026-11-24',marketingOptIn:data.marketing==='on',pushOptIn:data.pushOptIn==='on'})});
    const v=await r.json();setStatus(v.message||'Impossible de terminer la demande.',r.ok);
    if(r.ok&&v.authenticated){location.assign('/mon-espace.html')}
    else if(r.ok&&mode==='signup'){sessionStorage.setItem('meca-particulier-email-pending',data.email.trim());location.assign('/confirmation.html?espace=particulier&attente=1');return}
  }catch{setStatus('Connexion momentanément indisponible. Réessayez.')}
  finally{submit.disabled=false}
});
const resendButton=document.getElementById('meca-resend-confirmation');
if(resendButton)resendButton.addEventListener('click',async()=>{
 const emailField=document.getElementById('email');
 const address=emailField?.value?.trim()||'';
 if(!address||!emailField.checkValidity()){setStatus('Renseignez votre adresse e-mail pour recevoir un nouveau lien de validation.');emailField?.focus();return}
 resendButton.disabled=true;
 setStatus('Demande de renvoi en cours…');
 try{
  const response=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend',email:address})});
  const result=await response.json();
  setStatus(result.message||'Envoi non confirmé.',response.ok);
 }catch{setStatus('Impossible de contacter le service de confirmation pour le moment.')}
 finally{resendButton.disabled=false}
});
document.querySelectorAll('[data-private-tab]').forEach(button=>button.addEventListener('click',()=>{
 const tab=button.dataset.privateTab;
 document.querySelectorAll('[data-private-tab]').forEach(b=>{
  const active=b.dataset.privateTab===tab;
  b.classList.toggle('is-active',active);b.setAttribute('aria-current',active?'page':'false');
 });
 document.querySelectorAll('[data-private-panel]').forEach(panel=>panel.hidden=panel.dataset.privatePanel!==tab);
}));
const privateBox=document.getElementById('meca-private');
if(privateBox){
  fetch(API,{credentials:'same-origin',cache:'no-store'}).then(async r=>{
    if(!r.ok){location.replace('/connexion.html?retour=espace');return}
    const v=await r.json();
    document.getElementById('meca-guest').hidden=true;privateBox.hidden=false;
    privateBox.querySelector('.meca-auth-welcome').textContent='Bienvenue '+([v.prenom,v.nom].filter(Boolean).join(' ')||'dans votre espace Mécascope')+' !';
    const details=document.getElementById('meca-personal-details');
    if(details){
      details.replaceChildren();
      for(const [key,value] of [['Nom', [v.prenom,v.nom].filter(Boolean).join(' ')],['E-mail',v.email],['Téléphone',v.telephone]]){
        if(!value)continue;
        const dt=document.createElement('dt'),dd=document.createElement('dd');
        dt.textContent=key;dd.textContent=value;details.append(dt,dd);
      }
    }
    if(location.hash==='#demandes')document.querySelector('[data-private-tab="demandes"]')?.click();
    window.dispatchEvent(new Event('meca-auth-updated'));
  }).catch(()=>{setStatus('Impossible de vérifier la connexion pour le moment.')});
  privateBox.querySelector('.meca-logout').addEventListener('click',async()=>{
    await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});
    location.assign('/connexion.html')
  });
}
