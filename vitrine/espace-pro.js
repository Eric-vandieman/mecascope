'use strict';
const service='/api/pro-auth';
const workspace=document.getElementById('pro-workspace');
const loading=document.getElementById('workspace-loading');
const tabs=[...document.querySelectorAll('[data-workspace-tab]')];
const panels=[...document.querySelectorAll('[data-workspace-panel]')];
function showTab(name){
  tabs.forEach(b=>{const active=b.dataset.workspaceTab===name;b.classList.toggle('is-active',active);b.setAttribute('aria-current',active?'page':'false')});
  panels.forEach(panel=>{panel.hidden=panel.dataset.workspacePanel!==name});
}
tabs.forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.workspaceTab)));
document.querySelectorAll('[data-workspace-go]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.workspaceGo)));
function fill(id,fields){
  const d=document.getElementById(id);if(!d)return;d.replaceChildren();
  for(const [label,value] of fields){
    if(!value)continue;
    const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=label;dd.textContent=String(value);d.append(dt,dd);
  }
}
async function init(){
  try{
    const response=await fetch(service,{credentials:'same-origin',cache:'no-store'});
    if(!response.ok){location.replace('/compte.html#professionnel');return}
    const result=await response.json();
    if(result.needsProfile){location.replace('/compte.html#professionnel');return}
    if(!result.authenticated){location.replace('/compte.html#professionnel');return}
    const p=result.profile||{};
    document.getElementById('pro-workspace-welcome').textContent='Établissement : '+(p.etablissement||'Mécascope Pro');
    const details=[['Établissement',p.etablissement],['SIRET',p.siret],['Adresse',p.adresse],['Code postal',p.code_postal],['Ville',p.ville],['Contact',p.contact],['Téléphone',p.telephone],['E-mail professionnel',p.email]];
    fill('workspace-overview',details);
    fill('workspace-establishment',details);
    workspace.hidden=false;loading.hidden=true;
    window.dispatchEvent(new Event('meca-auth-updated'));
  }catch{
    loading.querySelector('p').textContent='Impossible de vérifier la session. Actualisez cette page pour réessayer.';
  }
}
document.getElementById('workspace-logout').addEventListener('click',async()=>{
  await fetch(service,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})}).catch(()=>{});
  location.replace('/');
});
init();
