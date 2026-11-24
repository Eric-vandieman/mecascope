'use strict';
const endpoint='/api/pro-auth';
const gate=document.getElementById('meca-pro-gate');
const connected=document.getElementById('meca-pro-connected');
const status=document.getElementById('meca-pro-status');
const login=document.getElementById('meca-pro-login');
const signup=document.getElementById('meca-pro-signup');
const tabs=document.querySelector('.meca-pro-switch');
let completing=false;
const showStatus=(message,ok=false)=>{status.textContent=message;status.dataset.ok=ok?'true':'false'};
function setTab(mode){
  if(completing)return;
  login.hidden=mode!=='login';signup.hidden=mode!=='signup';
  document.querySelectorAll('[data-pro-tab]').forEach(b=>{
    const active=b.dataset.proTab===mode;
    b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));
  });
  showStatus('');
  history.replaceState(null,'','#'+(mode==='signup'?'creer-un-compte':'professionnel'));
}
document.querySelectorAll('[data-pro-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.proTab)));
function render(p){
  completing=false;gate.hidden=true;connected.hidden=false;
  document.getElementById('meca-pro-welcome').textContent=(p.etablissement||'Votre établissement')+' · '+(p.email||'Compte professionnel connecté');
  const d=document.getElementById('meca-pro-profile');d.replaceChildren();
  for(const [key,value] of [['Établissement',p.etablissement],['SIRET',p.siret],['Adresse',p.adresse],['Code postal',p.code_postal],['Ville',p.ville],['Contact',p.contact],['Téléphone',p.telephone]]){
    if(!value)continue;
    const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=key;dd.textContent=value;d.append(dt,dd);
  }
  window.dispatchEvent(new Event('meca-auth-updated'));
  connected.querySelector('h1')?.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'smooth'});
}
function showCompletion(profile={}){
  completing=true;gate.hidden=false;connected.hidden=true;tabs.hidden=true;
  login.hidden=true;signup.hidden=false;signup.dataset.mode='complete';
  signup.querySelector('h2').textContent='Compléter mon compte professionnel';
  signup.querySelector('button[type=submit]').textContent='Enregistrer mon profil professionnel';
  signup.querySelector('.meca-pro-helper').textContent='Ces informations permettent de finaliser votre profil. Le SIRET sera vérifié séparément.';
  const email=signup.querySelector('#pro-register-email');
  const label=signup.querySelector('label[for=pro-register-email]');
  label.hidden=true;email.hidden=true;email.required=false;email.disabled=true;
  const pw=signup.querySelector('#pro-register-password').closest('.meca-pro-two');
  pw.hidden=true;pw.querySelectorAll('input').forEach(input=>{input.disabled=true;input.required=false});
  for(const key of ['siret','etablissement','adresse','code_postal','ville','contact','telephone']){
    const field=signup.elements.namedItem(key);
    if(field&&profile[key])field.value=profile[key];
  }
  showStatus('Votre adresse e-mail est connectée. Complétez les coordonnées de votre établissement pour activer votre espace.');
}
async function send(form,mode){
  if(!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form));
  if(mode==='signup'&&fields.password!==fields.confirm){
    showStatus('Les mots de passe ne correspondent pas.');return;
  }
  const button=form.querySelector('button[type=submit]');button.disabled=true;
  showStatus('Vérification en cours…');
  try{
    const payload={...fields,action:mode,legalAccepted:fields.legal==='on',legalVersion:'2026-11-24',marketingOptIn:fields.marketing==='on'};
    const res=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    if(res.ok&&data.authenticated){render(data.profile||{email:fields.email});return}
    if(res.ok&&data.needsProfile){showCompletion(data.profile||{});return}
    if(res.ok&&mode==='signup'){signup.reset();setTab('login');showStatus(data.message,true);return}
    showStatus(data.message||'Impossible de terminer la demande.',res.ok);
  }catch{showStatus('Service momentanément inaccessible. Réessayez.')}
  finally{button.disabled=false}
}
login.addEventListener('submit',e=>{e.preventDefault();send(login,'login')});
signup.addEventListener('submit',e=>{e.preventDefault();send(signup,completing?'complete':'signup')});
document.getElementById('meca-pro-resend')?.addEventListener('click',async()=>{
  const email=login.elements.namedItem('email').value.trim()||signup.elements.namedItem('email').value.trim();
  if(!email){showStatus('Indiquez d’abord votre e-mail professionnel dans le formulaire.');return}
  const button=document.getElementById('meca-pro-resend');button.disabled=true;showStatus('Demande de renvoi en cours…');
  try{
    const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'resend',email})});
    const data=await r.json();showStatus(data.message||'Demande impossible.',r.ok);
  }catch{showStatus('Impossible de joindre le service pour le moment.')}
  finally{button.disabled=false}
});
document.getElementById('meca-pro-logout').addEventListener('click',async()=>{
  await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});
  location.assign('/compte.html#professionnel');
});
if(location.hash==='#creer-un-compte')setTab('signup');
fetch(endpoint,{credentials:'same-origin',cache:'no-store'})
  .then(async r=>{if(!r.ok)return;const data=await r.json();
    if(data.authenticated)render(data.profile||{});
    else if(data.needsProfile)showCompletion(data.profile||{});
  }).catch(()=>{});
