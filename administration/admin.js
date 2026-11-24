const form=document.querySelector('form');
async function appeler(payload){
  return fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
async function ouvrir(payload){
  try {
    const r=await appeler(payload);
    if(!r.ok){if(payload.action==='login') document.querySelector('[role=status]').textContent=(await r.json()).message;return;}
    const data=await r.json();
    const layoutResponse=await fetch('/console.json');
    if(!layoutResponse.ok) throw new Error('Interface indisponible');
    const layout=await layoutResponse.json();
    const css=document.createElement('link');
    css.rel='stylesheet'; css.href='/console.css';
    document.querySelector('style').remove();
    document.head.append(css);
    document.body.innerHTML=layout.shell;
    const afficher=()=>{
      const path=Object.hasOwn(layout.pages,location.hash.slice(1))?location.hash.slice(1):'/admin';
      document.querySelector('main').outerHTML=layout.pages[path];
      document.querySelectorAll('.side a').forEach(a=>a.classList.toggle('active',a.hash==='#'+path));
      const main=document.querySelector('main');
      const note=document.createElement('p');
      note.className='note preview';
      note.textContent='Aperçu des modules en cours de raccordement. Les chiffres de suivi des garages ci-dessous proviennent de la base Mécascope.';
      const suivi=document.createElement('div');
      suivi.className='panel';
      suivi.textContent=data.entreprises+' entreprises · '+data.etablissements+' établissements · '+data.aVerifier+' entreprises à vérifier';
      main.querySelector('.pagehead, h1')?.closest('.admin-head-hero, .pagehead')?.after(note);
      note.after(suivi);
      main.querySelectorAll('.metric .value').forEach(value=>value.textContent='—');
    };
    document.addEventListener('click',async e=>{
      const target=e.target.closest('[data-go],[data-logout]');
      if(!target)return;
      e.preventDefault();
      if(target.hasAttribute('data-logout')){
        if((await appeler({action:'logout'})).ok)location.replace('/');
      } else location.hash=target.dataset.go;
    });
    window.addEventListener('hashchange',afficher);
    afficher();
  } catch {document.querySelector('[role=status]').textContent='Connexion interrompue.';}
}
form.onsubmit=e=>{e.preventDefault();ouvrir({action:'login',...Object.fromEntries(new FormData(form))});};
document.querySelector('#sortir').onclick=async()=>{if((await appeler({action:'logout'})).ok) location.reload();};
ouvrir({action:'session'});
