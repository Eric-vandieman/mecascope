document.querySelector('form').addEventListener('submit',async event=>{
  event.preventDefault();
  const status=document.querySelector('[role=status]');
  const fields=Object.fromEntries(new FormData(event.target));
  status.textContent='Demande en cours…';
  try {
    const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,action:event.submitter.value})});
    status.textContent=(await response.json()).message;
    if (response.ok) await afficherEntreprises();
  } catch {status.textContent='Connexion interrompue. Réessayez.';}
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
