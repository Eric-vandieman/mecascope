'use strict';
const root=document.getElementById('dossiers'),status=document.getElementById('status');
const offers={ciblee:'Recherche ciblée : 19 € + 20 €',approfondie:'Recherche approfondie : 39 € + 40 €',expert:'Investigation Expert : 69 € + 80 €'};
async function send(id,action,offre,extras={}){
 if(!confirm(action==='admin-quote'?'Envoyer ce devis au client ?':action==='admin-success'?'Recherche réussie : proposer le solde ?':'Clôturer sans solde ?'))return;
 status.textContent='Enregistrement en cours…';
 try{
  const r=await fetch('/api/unitaire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,offre,...extras})});
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
    const express=document.createElement('select');
    for(const [val,label] of [['','Sans option express'],['48h','Express 48 h (+20 € si délai tenu)'],['24h','Express 24 h (+50 € si délai tenu)']]){
     const o=document.createElement('option');o.value=val;o.textContent=label;express.append(o)
    }
    express.value=d.express_option||'';div.append(express);
    const reservation=document.createElement('label'),reserve=document.createElement('input');reserve.type='checkbox';
    reserve.checked=d.reservation_option===true;
    reservation.append(reserve,document.createTextNode(' Réservation fournisseur (+10 € uniquement si confirmée)'));div.append(reservation);
    const b=document.createElement('button');b.textContent='Accepter et envoyer le devis';
    b.onclick=()=>send(d.id,'admin-quote',s.value,{express:express.value,reservation:reserve.checked});div.append(b);
   }
   if(d.statut==='acompte_paye'){
    const x=document.createElement('label'),ex=document.createElement('input');ex.type='checkbox';ex.disabled=!d.express_option;
    x.append(ex,document.createTextNode(' Express '+(d.express_option||'(non souscrit)')+' : source conforme trouvée dans le délai convenu'));div.append(x);
    const y=document.createElement('label'),rv=document.createElement('input');rv.type='checkbox';rv.disabled=!d.reservation_option;
    y.append(rv,document.createTextNode(' Réservation fournisseur effectivement confirmée'));div.append(y);
    const b=document.createElement('button');b.textContent='Renseigner le résultat dans l’administration';
    b.onclick=()=>{location.href='https://mecascope-administration.vercel.app/#/admin/demandes?dossier='+encodeURIComponent(d.id)};div.append(b);
    const f=document.createElement('button');f.textContent='Échec : clôturer sans solde';f.onclick=()=>send(d.id,'admin-fail');div.append(f);
   }
   root.append(div);
  }
  if(!j.dossiers?.length)status.textContent='Aucun dossier.';
 }catch(e){status.textContent=e.message}
}
document.getElementById('reload').onclick=load;load();
