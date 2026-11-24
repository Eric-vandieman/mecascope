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
  async function check(url){
    try{
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)return null;
      return await response.json();
    }catch{return null}
  }
  function render(){
    if(!selected){
      label.textContent='Connexion';
      login.href='/connexion.html';
      login.title='Se connecter';
      login.classList.remove('meca-logged-in');
      if(register)register.hidden=false;
      if(logout)logout.hidden=true;
      return;
    }
    const professional=selected.kind==='pro';
    const p=selected.profile||{};
    const displayName=professional
      ? (p.etablissement||p.contact||'Mon compte professionnel')
      : ([selected.prenom,selected.nom].filter(Boolean).join(' ')||selected.email||'Mon compte');
    label.textContent=displayName;
    login.href=professional?'/espace-pro.html':'/mon-espace.html';
    login.title=professional?'Accéder à mon espace professionnel':'Accéder à mon tableau de bord particulier';
    login.setAttribute('aria-label',login.title+' — '+displayName);
    login.classList.add('meca-logged-in');
    header.querySelectorAll('a[href="/compte.html#professionnel"]').forEach(a=>{
      a.href='/espace-pro.html';
    });
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
    const proInfo=pro?.authenticated?{kind:'pro',profile:pro.profile||{}}:null;
    const individualInfo=individual?.authenticated?{kind:'particulier',...individual}:null;
    const isPersonalPage=/\/(?:mon-espace|inscription|connexion)\.html$/.test(location.pathname);
    selected=(isPersonalPage?individualInfo||proInfo:proInfo||individualInfo);
    render();
  }
  window.addEventListener('meca-auth-updated',refresh);
  refresh();
})();