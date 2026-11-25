'use strict';
const root=document.getElementById('dossiers'),status=document.getElementById('status');
const offers={ciblee:'Recherche ciblée : 19 € + 20 €',approfondie:'Recherche approfondie : 39 € + 40 €',expert:'Investigation Expert : 69 € + 80 €'};
async function send(id,action,offre){
 if(!confirm(action==='admin-quote'?'Envoyer ce devis au client ?':action==='admin-success'?'Recherche réussie : proposer le solde ?':'Clôturer sans solde ?'))return;
 status.textContent='Enregistrement en cours…';
 try{
  const r=await fetch('/api/unitaire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,offre})});
  const j=await r.json();if(!r.ok)throw Error(j.message||'Action refusée');
  status.textContent=j.message||'Enregistré';await load();
 }catch(e){status.textContent=e.message}
}
async function load(){
 try{
  const r=await fetch('/api/unitaire?action=admin-list',{cache:'no-store'}),j=await r.json();
  if(!r.ok)throw Error(j.message||'Accès refusé');
  root.replaceChildren();
  for(const d of j.dossiers||[]){
   const div=document.createElement('section');div.className='case';
   const title=document.createElement('h2');title.textContent=d.reference+' — '+d.statut;div.append(title);
   const p=document.createElement('p');p.textContent=[d.contact,d.email,d.telephone].filter(Boolean).join(' · ');div.append(p);
   const info=document.createElement('p');info.textContent='Véhicule : '+[d.details?.brand,d.details?.model,d.details?.year].filter(Boolean).join(' ')+' | Pièce : '+(d.details?.part||'');div.append(info);
   if(['deposee','devis_envoye'].includes(d.statut)){
    const s=document.createElement('select');
    for(const [id,label] of Object.entries(offers)){const o=document.createElement('option');o.value=id;o.textContent=label;s.append(o)}
    if(d.offre)s.value=d.offre;div.append(s);
    const b=document.createElement('button');b.textContent='Accepter et envoyer le devis';b.onclick=()=>send(d.id,'admin-quote',s.value);div.append(b);
   }
   if(d.statut==='acompte_paye'){
    const b=document.createElement('button');b.textContent='Source trouvée : proposer le solde';b.onclick=()=>send(d.id,'admin-success');div.append(b);
    const f=document.createElement('button');f.textContent='Échec : clôturer sans solde';f.onclick=()=>send(d.id,'admin-fail');div.append(f);
   }
   root.append(div);
  }
  if(!j.dossiers?.length)status.textContent='Aucun dossier.';
 }catch(e){status.textContent=e.message}
}
document.getElementById('reload').onclick=load;load();
