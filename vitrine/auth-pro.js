'use strict';
const endpoint='/api/pro-auth';
const gate=document.getElementById('meca-pro-gate');
const connected=document.getElementById('meca-pro-connected');
const status=document.getElementById('meca-pro-status');
const login=document.getElementById('meca-pro-login');
const signup=document.getElementById('meca-pro-signup');
const showStatus=(message,ok=false)=>{status.textContent=message;status.dataset.ok=ok?'true':'false'};
function setTab(mode){
  login.hidden=mode!=='login';signup.hidden=mode!=='signup';
  document.querySelectorAll('[data-pro-tab]').forEach(b=>{let active=b.dataset.proTab===mode;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});
  showStatus('');history.replaceState(null,'','#'+(mode==='signup'?'creer-un-compte':'professionnel'));
}
document.querySelectorAll('[data-pro-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.proTab)));
function render(p){
  gate.hidden=true;connected.hidden=false;
  document.getElementById('meca-pro-welcome').textContent='Connecté : '+(p.email||'compte professionnel');
  const d=document.getElementById('meca-pro-profile');d.replaceChildren();
  for(const [key,value] of [['Établissement',p.etablissement],['SIRET',p.siret],['Adresse',p.adresse],['Code postal',p.code_postal],['Ville',p.ville],['Contact',p.contact],['Téléphone',p.telephone]]){
    if(!value)continue;
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;d.append(dt,dd);
  }
}
async function send(form,mode){
  if(!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form));
  if(mode==='signup'&&fields.password!==fields.confirm){showStatus('Les mots de passe ne correspondent pas.');return}
  const button=form.querySelector('button[type=submit]');button.disabled=true;showStatus('Vérification en cours…');
  try{
    const payload={...fields,action:mode,legalAccepted:fields.legal==='on',legalVersion:'2026-11-24',marketingOptIn:fields.marketing==='on'};
    const res=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();showStatus(data.message||'Erreur de connexion.',res.ok);
    if(res.ok&&data.authenticated)render(data.profile||{email:fields.email});
    else if(res.ok&&mode==='signup') {signup.reset();setTab('login');showStatus(data.message,true)}
  }catch{showStatus('Service momentanément inaccessible. Réessayez.')}
  finally{button.disabled=false}
}
login.addEventListener('submit',e=>{e.preventDefault();send(login,'login')});
signup.addEventListener('submit',e=>{e.preventDefault();send(signup,'signup')});
document.getElementById('meca-pro-logout').addEventListener('click',async()=>{
  await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});
  connected.hidden=true;gate.hidden=false;login.reset();setTab('login');
});
if(location.hash==='#creer-un-compte')setTab('signup');
fetch(endpoint,{credentials:'same-origin',cache:'no-store'}).then(async r=>{if(r.ok){const data=await r.json();render(data.profile||{})}}).catch(()=>{});
