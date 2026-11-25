'use strict';
(()=>{
const list=document.getElementById('meca-mes-demandes'),form=document.getElementById('meca-claim-form'),status=document.getElementById('meca-claim-status');
if(!list||!form)return;
let loading=false;
const add=(el,label,txt)=>{const x=document.createElement(el);if(label)x.className=label;x.textContent=txt;return x};
async function load(){
 if(loading)return;loading=true;list.replaceChildren(add('p','','Chargement de vos dossiers…'));
 try{
  const response=await fetch('/api/particulier-auth?action=dossiers',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.message||'Suivi indisponible');
  list.replaceChildren();
  if(!data.dossiers?.length){list.append(add('p','','Aucune demande associée à ce compte pour le moment.'));return}
  for(const d of data.dossiers){
   const article=document.createElement('article');article.className='meca-private-demand';
   article.style.cssText='border:1px solid #8a633e;border-radius:12px;margin:10px 0;padding:15px;background:#171c23';
   article.append(add('h3','',d.reference),add('p','',([d.details?.brand,d.details?.model,d.details?.year,d.details?.part].filter(Boolean).join(' · ')||'Recherche de pièce')));
   article.append(add('p','', 'Statut : '+d.statut.replaceAll('_',' ')+' · Prestation : '+(d.offre||'en attente de devis')));
   article.append(add('p','',d.paiement_initial_confirme?'Paiement initial confirmé':'Paiement initial non encore confirmé'));
   if(d.missionUrl){const link=document.createElement('a');link.className='btn orange';link.href=d.missionUrl;link.textContent='Voir le dossier et les échanges';article.append(link)}
   else article.append(add('p','meca-private-muted','Votre proposition sera accessible après validation du devis.'));
   list.append(article);
  }
 }catch(e){list.replaceChildren(add('p','',e.message))}
 finally{loading=false}
}
const tokenFromLink=text=>{
 const raw=text.trim();
 if(/^[a-f0-9]{64}$/i.test(raw))return raw.toLowerCase();
 try{const u=new URL(raw);const t=u.searchParams.get('t')||'';return /^[a-f0-9]{64}$/i.test(t)?t.toLowerCase():''}catch{return ''}
};
form.addEventListener('submit',async e=>{
 e.preventDefault();const input=form.querySelector('input[name=lien]'),token=tokenFromLink(input?.value||'');
 if(!token){status.textContent='Le lien personnel doit contenir un jeton de mission valide.';return}
 const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='Association du dossier…';
 try{
  const r=await fetch('/api/particulier-auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'claim',missionToken:token})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.message||'Association impossible');
  input.value='';status.textContent=d.message||'Dossier associé';await load();
 }catch(e){status.textContent=e.message}
 finally{button.disabled=false}
});

async function loadInvoices(){
 const el=document.getElementById('meca-factures-particulier');if(!el)return;
 el.replaceChildren(add('p','','Chargement des paiements confirmés…'));
 try{
  const response=await fetch('/api/particulier-auth?action=factures',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.message||'Service de facturation indisponible');
  el.replaceChildren();
  if(!data.factures?.length){el.append(add('p','','Aucun paiement confirmé pour le moment.'));return}
  for(const item of data.factures){
   const box=document.createElement('article');box.style.cssText='border:1px solid #8a633e;border-radius:10px;margin:10px 0;padding:14px';
   const title=add('h3','',item.reference+' — '+(item.etape==='initial'?'Paiement initial':'Solde'));box.append(title);
   const euros=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(item.montant_centimes||0)/100);
   box.append(add('p','','Paiement confirmé le '+new Date(item.date).toLocaleDateString('fr-FR')+' · '+euros));
   if(item.numero)box.append(add('p','','Facture n° '+item.numero));
   const href=item.pdf||item.lien;
   if(href){try{const u=new URL(href);if(u.protocol==='https:'&&(u.hostname==='stripe.com'||u.hostname.endsWith('.stripe.com'))){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.className='btn orange';a.textContent='Consulter / télécharger la facture';box.append(a)}}catch{}}
   else box.append(add('p','','Facture non disponible pour ce paiement. Contactez Mécascope pour obtenir un justificatif.'));
   el.append(box);
  }
  if(data.limite)el.append(add('p','','Seuls les 25 paiements récents sont affichés ici.'));
 }catch(e){el.replaceChildren(add('p','',e.message))}
}
document.querySelector('[data-private-tab="factures"]')?.addEventListener('click',loadInvoices);

window.addEventListener('meca-auth-updated',load);
document.querySelector('[data-private-tab="demandes"]')?.addEventListener('click',load);
})();