const form=document.querySelector('form');
async function appeler(payload){
  return fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
async function ouvrir(payload){
  try {
    const r=await appeler(payload);
    if(!r.ok){if(payload.action==='login') document.querySelector('[role=status]').textContent=(await r.json()).message;return;}
    const data=await r.json();
    form.reset(); form.hidden=true;
    document.querySelector('section').hidden=false;
    document.querySelector('[role=status]').textContent='';
    document.querySelector('#chiffres').textContent=data.entreprises+' entreprises · '+data.etablissements+' établissements · '+data.aVerifier+' entreprises à vérifier';
  } catch {document.querySelector('[role=status]').textContent='Connexion interrompue.';}
}
form.onsubmit=e=>{e.preventDefault();ouvrir({action:'login',...Object.fromEntries(new FormData(form))});};
document.querySelector('#sortir').onclick=async()=>{if((await appeler({action:'logout'})).ok) location.reload();};
ouvrir({action:'session'});
