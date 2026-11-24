'use strict';
const parameters=new URLSearchParams(location.search);
const code=parameters.get('code')||'';
const status=document.getElementById('join-status');
const guest=document.getElementById('join-not-connected');
const ready=document.getElementById('join-ready');
const success=document.getElementById('join-success');
const joinForm=document.getElementById('join-signup-form');
const loginLink=document.getElementById('join-login');
let joining=false;
const setMessage=message=>{status.textContent=message};
const setSuccess=()=>{
  sessionStorage.removeItem('meca-invite');
  guest.hidden=true;ready.hidden=true;success.hidden=false;
  setMessage('Compte professionnel rattaché à l’équipe. Vos droits ont été appliqués.');
  window.dispatchEvent(new Event('meca-auth-updated'));
};
async function acceptInvitation(){
  if(joining)return;
  joining=true;guest.hidden=true;ready.hidden=false;
  setMessage('Rattachement de votre compte professionnel à l’établissement…');
  try{
    const response=await fetch('/api/pro-collaboration',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'accept',code})
    });
    const data=await response.json();
    if(!response.ok)throw Error(data.message||'Invitation non acceptée');
    setSuccess();
  }catch(error){
    ready.hidden=true;
    guest.hidden=false;
    setMessage(error.message||'Impossible de finaliser le rattachement. Vérifiez le compte utilisé et le lien reçu.');
  }finally{joining=false}
}
async function checkSession(){
  try{
    const response=await fetch('/api/pro-auth',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok){guest.hidden=false;setMessage('Créez votre compte professionnel collaborateur ou connectez-vous pour rejoindre l’équipe.');return}
    const data=await response.json();
    if(data.authenticated && !data.needsProfile){
      // Le compte a pu être automatiquement rattaché lors de la connexion.
      const check=await fetch('/api/pro-collaboration',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'invite-accepted',code})
      });
      if(check.ok){
        const result=await check.json();
        if(result.accepted===true){setSuccess();return}
      }
    }
    await acceptInvitation();
  }catch{
    guest.hidden=false;ready.hidden=true;
    setMessage('Vérification temporairement indisponible. Vous pouvez réessayer après connexion.');
  }
}
if(code.length<30||code.length>180){
  setMessage('Ce lien d’invitation est invalide. Demandez-en un nouveau au responsable de votre établissement.');
  guest.hidden=true;ready.hidden=true;
}else{
  sessionStorage.setItem('meca-invite',code);
  loginLink.href='/compte.html?invitation='+encodeURIComponent(code)+'#professionnel';
  joinForm.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!joinForm.reportValidity())return;
    const values=Object.fromEntries(new FormData(joinForm));
    if(values.password!==values.confirm){setMessage('Les mots de passe ne correspondent pas.');return}
    const submit=joinForm.querySelector('[type=submit]');submit.disabled=true;
    setMessage('Création de votre compte professionnel collaborateur…');
    try{
      const response=await fetch('/api/pro-auth',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...values,code,action:'invite-signup',legalAccepted:values.legal==='on',legalVersion:'2026-11-24'})
      });
      const data=await response.json();
      if(!response.ok)throw Error(data.message||'Inscription impossible');
      if(data.authenticated){
        await checkSession();
        return;
      }
      setMessage('Votre compte professionnel a été créé. Confirmez votre adresse e-mail, puis connectez-vous : vous rejoindrez automatiquement l’établissement.');
      joinForm.reset();
    }catch(error){setMessage(error.message||'Le service est temporairement indisponible.')}
    finally{submit.disabled=false}
  });
  document.getElementById('join-accept')?.addEventListener('click',acceptInvitation);
  checkSession();
}
