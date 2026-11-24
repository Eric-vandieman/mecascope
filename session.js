const MECA_LEGAL_VERSION='2026-11-24';
const signupDialog=document.getElementById('meca-legal-dialog');
let pendingSignup=null;
async function soumettreCompte(fields,action,legal=null) {
  const status=document.querySelector('[role=status]');
  status.textContent='Demande en cours…';
  try {
    const response=await fetch('/api/session',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'same-origin',
      body:JSON.stringify({...fields,action,...(legal||{})})
    });
    const data=await response.json();
    status.textContent=data.message||'Une erreur est survenue.';
    if(response.ok) await afficherEntreprises();
  } catch {status.textContent='Connexion interrompue. Réessayez.';}
}
document.querySelector('main form').addEventListener('submit',event=>{
  event.preventDefault();
  const fields=Object.fromEntries(new FormData(event.currentTarget));
  const action=event.submitter?.value||'login';
  if(action!=='signup'){soumettreCompte(fields,'login');return;}
  if(!signupDialog){document.querySelector('[role=status]').textContent='Acceptation des conditions indisponible : inscription interrompue.';return;}
  pendingSignup=fields;
  document.getElementById('legal-accept').checked=false;
  document.getElementById('legal-marketing').checked=false;
  document.getElementById('legal-error').textContent='';
  signupDialog.showModal();
});
document.getElementById('legal-cancel')?.addEventListener('click',()=>{pendingSignup=null;signupDialog.close();});
signupDialog?.addEventListener('close',()=>{pendingSignup=null;});
document.getElementById('legal-confirm')?.addEventListener('click',()=>{
  if(!pendingSignup)return;
  if(!document.getElementById('legal-accept').checked){
    document.getElementById('legal-error').textContent='Vous devez accepter les CGU et les CGV pour créer votre compte.';
    return;
  }
  const fields=pendingSignup;
  const marketingOptIn=document.getElementById('legal-marketing').checked;
  pendingSignup=null;
  signupDialog.close();
  soumettreCompte(fields,'signup',{legalVersion:MECA_LEGAL_VERSION,legalAccepted:true,marketingOptIn});
});

async function afficherEntreprises() {
  const response = await fetch('/api/entreprises');
  if (!response.ok) return;
  const entreprises = await response.json();
  document.querySelector('main form').hidden = true;
  document.querySelector('#espace').hidden = false;
  const liste = document.querySelector('#sites');
  liste.replaceChildren();
  for (const entreprise of entreprises) {
    const ligne = document.createElement('li');
    ligne.textContent = entreprise.nom + ' · ' + entreprise.etablissements.map(site => site.siret).join(', ') + (entreprise.verifiee ? ' · vérifiée' : ' · en attente de vérification');
    liste.append(ligne);
  }
}
afficherEntreprises().catch(() => {});
document.querySelector('#entreprise').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.querySelector('[role=status]');
  try {
    const response = await fetch('/api/entreprises',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});
    if (!response.ok) {status.textContent = (await response.json()).message; return;}
    event.target.reset();
    status.textContent = 'Entreprise enregistrée.';
    await afficherEntreprises();
  } catch { status.textContent = 'Connexion interrompue.'; }
});
document.querySelector('#sortir').addEventListener('click', async () => {
  const response = await fetch('/api/deconnexion',{method:'POST'});
  if (response.ok) location.reload();
});
