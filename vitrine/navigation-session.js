'use strict';
/* Navigation partagée : identifiant visible sur toutes les pages, sans exposer les jetons de session. */
(function(){
  const header=document.querySelector('.meca-new-top');
  if(!header)return;
  const login=header.querySelector('.meca-login');
  const register=header.querySelector('.meca-register');
  if(!login)return;
  const label=login.querySelector('span')||login;
  let selected=null;
  let logout=null;
  let creditBadge=null;
  async function check(url){
    try{
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)return null;
      return await response.json();
    }catch{return null}
  }
  function proNavigationLink(){
    return [...header.querySelectorAll('nav a')].find(a=>
      a.getAttribute('href')==='/espace-pro.html' ||
      a.getAttribute('href')==='/compte.html#professionnel' ||
      a.textContent?.toLowerCase().includes('espace pro')
    );
  }
  async function loadCredits(){
    const link=proNavigationLink();
    if(!selected || selected.kind!=='pro' || selected.needsProfile || !link){
      if(creditBadge)creditBadge.hidden=true;
      return;
    }
    try{
      const response=await fetch('/api/pro-collaboration?view=credits',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw Error('Solde indisponible');
      const data=await response.json();
      if(!Number.isSafeInteger(data.credits)||data.credits<0)throw Error('Solde invalide');
      if(!creditBadge){
        creditBadge=document.createElement('span');
        creditBadge.className='meca-credit-badge';
        creditBadge.title='Solde de crédits partagé de votre établissement';
        creditBadge.setAttribute('aria-label','Crédits disponibles pour votre entreprise');
        creditBadge.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5.7"></circle><path d="M9.5 12h5M12 9.5v5"></path></svg><span class="meca-credit-amount"></span>';
      }
      if(creditBadge.parentElement!==link)link.append(creditBadge);
      creditBadge.querySelector('.meca-credit-amount').textContent=String(data.credits);
      creditBadge.hidden=false;
    }catch{
      if(creditBadge)creditBadge.hidden=true;
    }
  }
  function render(){
    if(!selected){
      label.textContent='Connexion';
      login.href='/connexion.html';
      login.title='Se connecter';
      login.classList.remove('meca-logged-in');
      if(register)register.hidden=false;
      if(logout)logout.hidden=true;
      if(creditBadge)creditBadge.hidden=true;
      return;
    }
    const professional=selected.kind==='pro';
    const p=selected.profile||{};
    const displayName=professional
      ? (p.etablissement||p.contact||'Mon compte professionnel')
      : ([selected.prenom,selected.nom].filter(Boolean).join(' ')||selected.email||'Mon compte');
    label.textContent=displayName;
    login.href=professional?(selected.needsProfile?'/compte.html#professionnel':'/espace-pro.html'):'/mon-espace.html';
    login.title=professional?'Accéder à mon espace professionnel':'Accéder à mon tableau de bord particulier';
    login.setAttribute('aria-label',login.title+' — '+displayName);
    login.classList.add('meca-logged-in');
    if(professional&&!selected.needsProfile){
      header.querySelectorAll('a[href="/compte.html#professionnel"]').forEach(a=>{
        a.href='/espace-pro.html';
      });
    }
    if(register)register.hidden=true;
    if(!logout){
      logout=document.createElement('button');
      logout.type='button';
      logout.className='btn dark meca-global-logout';
      logout.textContent='Déconnexion';
      logout.addEventListener('click',async()=>{
        logout.disabled=true;
        const url=selected?.kind==='pro'?'/api/pro-auth':'/api/particulier-auth';
        try{
          await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
        }finally{
          location.assign('/');
        }
      });
      header.querySelector('.topright')?.append(logout);
    }
    logout.hidden=false;
  }
  async function refresh(){
    const [pro,individual]=await Promise.all([check('/api/pro-auth'),check('/api/particulier-auth')]);
    const proInfo=(pro?.authenticated||pro?.needsProfile)?{kind:'pro',profile:pro.profile||{},needsProfile:!!pro?.needsProfile}:null;
    const individualInfo=individual?.authenticated?{kind:'particulier',...individual}:null;
    const isPersonalPage=/\/(?:mon-espace|inscription|connexion)\.html$/.test(location.pathname);
    selected=(isPersonalPage?individualInfo||proInfo:proInfo||individualInfo);
    render();
    await loadCredits();
  }
  window.addEventListener('meca-auth-updated',refresh);
  refresh();
})();