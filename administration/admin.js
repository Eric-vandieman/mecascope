const form=document.querySelector('form');
async function appeler(payload){
  return fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
async function ouvrir(payload){
  try {
    const r=await appeler(payload);
    if(!r.ok){const status=document.querySelector('[role=status]');if(status)status.textContent=(await r.json().catch(()=>({}))).message||'Connexion impossible.';return;}
    const data=await r.json();
    const layoutResponse=await fetch('/console.json');
    if(!layoutResponse.ok) throw new Error('Interface indisponible');
    const layout=await layoutResponse.json();
    window.mecaEnhanceAdminLayout?.(layout);
    const css=document.createElement('link');
    css.rel='stylesheet'; css.href='/console.css?v=20261125-1627';
    document.querySelector('style').remove();
    document.head.append(css);
    document.body.innerHTML=layout.shell;
    // Badge des demandes nouvelles : uniquement les dossiers pas encore traités.
    let lastBadgeCount=null;
    async function updateDemandesBadge(){
      try{
        const r=await fetch('/api/reporting',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reporting'})});
        if(!r.ok)return;
        const data=await r.json();
        const n=Math.max(0,Number(data.nouvelles_demandes)||0);
        if(n===lastBadgeCount&&document.querySelector('.meca-demandes-unread'))return;
        lastBadgeCount=n;
        const link=document.querySelector('.side a[href="#/admin/demandes"]');
        if(!link)return;
        let badge=link.querySelector('.meca-demandes-unread');
        if(!badge){badge=document.createElement('span');badge.className='meca-demandes-unread';badge.style.cssText='display:inline-block;margin-left:8px;padding:2px 8px;border-radius:22px;font-size:13px;font-weight:800';link.append(badge)}
        badge.textContent=n?String(n):'';
        badge.hidden=n===0;
        badge.style.background=n?'#ed9c38':'transparent';badge.style.color='#18242d';
        badge.setAttribute('aria-label',n+' nouvelle(s) demande(s)');
      }catch{}
    }
    setInterval(()=>{if(document.visibilityState==='visible')updateDemandesBadge()},30000);
    const afficher=()=>{
      const requested=location.hash.slice(1).split('?')[0];
      const path=Object.hasOwn(layout.pages,requested)?requested:'/admin';
      document.querySelector('main').outerHTML=layout.pages[path];
      document.querySelectorAll('.side a').forEach(a=>a.classList.toggle('active',a.hash==='#'+path));
      const main=document.querySelector('main');
      updateDemandesBadge();
      main.querySelectorAll('.metric .value,.stat-tile strong').forEach(value=>value.textContent='—');
      main.querySelectorAll('.note').forEach(element=>{
        element.textContent=element.textContent.replace(/démonstration|démo|fictif|fictifs/gi,'non connecté');
      });
      if(path!=='/admin/messages'&&path!=='/admin/clients'){
        const summary=document.createElement('div');
        summary.className='meca-admin-live-status';
        summary.textContent='Suivi réel des comptes professionnels : '+Number(data.entreprises||0)+' entreprises · '+Number(data.etablissements||0)+' établissements · '+Number(data.aVerifier||0)+' entreprises à vérifier. Les autres indicateurs attendent une source vérifiée.';
        main.querySelector('.pagehead')?.after(summary);
        window.mecaAdminComposer?.(main);
      }
      if(path==='/admin/sms'){
        Promise.resolve(window.mecaSmsModels?.(main)).catch(error=>{const p=document.createElement('p');p.textContent='Erreur SMS : '+error.message;main.append(p)});
      }else if(path==='/admin/clients'){
        Promise.resolve(window.mecaAdminClients?.(main)).catch(error=>{const p=document.createElement('p');p.textContent='Erreur du fichier clients : '+error.message;main.append(p)});
      }else{
        Promise.resolve(window.mecaAdminLive?.(main,path)).catch(()=>{}).finally(()=>window.mecaSuppliers?.(main,path));
      }
      window.mecaPushSetup?.(main,path);
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
