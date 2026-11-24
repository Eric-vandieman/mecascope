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
    const r=await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:mode,email:data.email,password:data.password,prenom:data.prenom,nom:data.nom,telephone:data.telephone,legalAccepted:mode==='signup'&&data.legal==='on',legalVersion:'2026-11-24',marketingOptIn:data.marketing==='on'})});
    const v=await r.json();setStatus(v.message||'Impossible de terminer la demande.',r.ok);
    if(r.ok&&v.authenticated){location.assign('/mon-espace.html')}
    else if(r.ok&&mode==='signup'){form.reset()}
  }catch{setStatus('Connexion momentanément indisponible. Réessayez.')}
  finally{submit.disabled=false}
});
const privateBox=document.getElementById('meca-private');
if(privateBox){
  fetch(API,{credentials:'same-origin',cache:'no-store'}).then(async r=>{
    if(!r.ok){location.replace('/connexion.html?retour=espace');return}
    const v=await r.json();
    document.getElementById('meca-guest').hidden=true;privateBox.hidden=false;
    privateBox.querySelector('.meca-auth-welcome').textContent='Connecté : '+(v.email||'compte particulier');
  }).catch(()=>{setStatus('Impossible de vérifier la connexion pour le moment.')});
  privateBox.querySelector('.meca-logout').addEventListener('click',async()=>{
    await fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});
    location.assign('/connexion.html')
  });
}
