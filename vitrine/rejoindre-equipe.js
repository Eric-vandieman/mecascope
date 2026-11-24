'use strict';
const qs=new URLSearchParams(location.search),code=qs.get('code');
const status=document.getElementById('join-status');
const guest=document.getElementById('join-not-connected');
const ready=document.getElementById('join-ready');
const success=document.getElementById('join-success');
if(!code||code.length<30||code.length>180){status.textContent='Ce lien d’invitation est invalide.'}
else{
 sessionStorage.setItem('meca-invite',code);
 const login=document.getElementById('join-login'),signup=document.getElementById('join-signup');
 login.href='/compte.html?invitation='+encodeURIComponent(code)+'#professionnel';
 signup.href='/compte.html?invitation='+encodeURIComponent(code)+'#creer-un-compte';
 fetch('/api/pro-auth',{credentials:'same-origin',cache:'no-store'}).then(async r=>{
   if(!r.ok){guest.hidden=false;status.textContent='Connectez-vous à un compte professionnel pour poursuivre.';return}
   ready.hidden=false;status.textContent='Vous êtes connecté. Vous pouvez accepter cette invitation.';
 }).catch(()=>{guest.hidden=false;status.textContent='Veuillez vous connecter pour accepter.'});
 document.getElementById('join-accept').addEventListener('click',async()=>{
  const b=document.getElementById('join-accept');b.disabled=true;status.textContent='Validation de l’invitation…';
  try{const r=await fetch('/api/pro-collaboration',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'accept',code})});const d=await r.json();if(!r.ok)throw Error(d.message||'Invitation refusée');
    sessionStorage.removeItem('meca-invite');status.textContent='Invitation acceptée.';ready.hidden=true;success.hidden=false;
  }catch(e){status.textContent=e.message;b.disabled=false}
 });
}
