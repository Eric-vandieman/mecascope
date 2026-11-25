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
window.addEventListener('meca-auth-updated',load);
document.querySelector('[data-private-tab="demandes"]')?.addEventListener('click',load);
})();