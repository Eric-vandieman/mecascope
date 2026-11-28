'use strict';
window.mecaAdminClients=async function(main){
 const root=main.querySelector('#meca-clients-root');
 if(!root)return;
 root.replaceChildren();
 root.style.cssText='display:block;max-width:1200px;margin:0 auto';
 const css=document.createElement('style');css.textContent=`
 .mc-toolbar{display:grid;grid-template-columns:minmax(220px,2fr) repeat(2,minmax(140px,1fr)) minmax(180px,1.3fr);gap:12px;margin-bottom:18px}
 .mc-toolbar label{display:flex;flex-direction:column;gap:6px;color:#d5e0ed;font-weight:600;font-size:13px}
 .mc-toolbar input,.mc-toolbar select{box-sizing:border-box;width:100%;min-width:0;background:#101923;color:#f6f8fa;border:1px solid #657a8e;padding:12px;border-radius:10px;font:inherit}
 .mc-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:18px}
 .mc-summary>div{padding:17px;border:1px solid #455c70;background:#192734;border-radius:12px}
 .mc-summary strong{display:block;font-size:25px;color:#f9b76a}
 .mc-summary small{color:#bed0dc}
 .mc-list{display:grid;gap:11px}
 .mc-client{border:1px solid #546c80;border-radius:13px;background:#1a2835;padding:17px;display:grid;grid-template-columns:minmax(0,2fr) minmax(155px,1.1fr) minmax(105px,.7fr) auto;gap:16px;align-items:center}
 .mc-name{font-size:17px;font-weight:750;color:#f8fafc;overflow-wrap:anywhere}
 .mc-muted{font-size:13px;color:#bacbd7;margin-top:5px;overflow-wrap:anywhere}
 .mc-client a{color:#b7d8ff}
 .mc-button{border:0;padding:11px 16px;border-radius:9px;background:#efa143;color:#16212b;font-weight:750;cursor:pointer;white-space:nowrap}
 .mc-detail{margin-top:17px;border:1px solid #c38d4c;border-radius:13px;background:#182632;padding:20px}
 .mc-order{margin:11px 0;border:1px solid #546b7d;border-radius:10px;background:#202f3d;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:15px}
 .mc-order strong{color:#ffbd71}
 @media(max-width:1000px){.mc-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.mc-client{grid-template-columns:minmax(0,1fr) auto}}
 @media(max-width:640px){.mc-toolbar,.mc-summary,.mc-client,.mc-order{grid-template-columns:1fr}.mc-client{gap:9px}}
 `;
 root.append(css);
 const intro=document.createElement('p');intro.className='muted';intro.textContent='Fichier client Mécascope — comptes enregistrés, demandes et recherches reliées à la base. Les montants correspondent uniquement aux règlements à l’unité confirmés.';root.append(intro);
 const controls=document.createElement('div');controls.className='mc-toolbar';
 const search=make('input',{type:'search',placeholder:'Nom, e-mail, téléphone, référence…'});
 const from=make('input',{type:'date'}),to=make('input',{type:'date'});
 const order=make('select');
 for(const [value,label] of [['recent','Clients les plus récents'],['old','Clients les plus anciens'],['spent','Dépenses décroissantes'],['low','Dépenses croissantes'],['orders','Plus de demandes'],['name','Nom A à Z']]){const option=make('option',{value});option.textContent=label;order.append(option)}
 for(const [label,control] of [['Rechercher un client',search],['Demande depuis',from],['Demande jusqu’au',to],['Trier les clients',order]]){const wrap=make('label');wrap.append(document.createTextNode(label),control);controls.append(wrap)}
 root.append(controls);
 const summary=make('div',{className:'mc-summary'}),list=make('div',{className:'mc-list'}),detail=make('section',{className:'mc-detail'});
 detail.hidden=true;root.append(summary,list,detail);
 const fmtDate=x=>x?new Date(x).toLocaleDateString('fr-FR'):'—';
 const fmtDateTime=x=>x?new Date(x).toLocaleString('fr-FR'):'—';
 const euro=c=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format((Number(c)||0)/100);
 const clean=x=>String(x||'').trim();
 const lower=x=>clean(x).toLocaleLowerCase('fr-FR');
 const statusText={deposee:'Demande reçue',devis_envoye:'Proposition envoyée',acompte_paye:'Recherche en cours',reussite:'Pièce trouvée — solde attendu',solde_paye:'Terminée — solde réglé',echec:'Recherche infructueuse',refuse:'Devis refusé'};
 function make(tag,attributes={}){const node=document.createElement(tag);for(const [k,v] of Object.entries(attributes)){if(k==='className')node.className=v;else node.setAttribute(k,v)}return node}
 function revenue(d){
  const prices={ciblee:[1900,2000],approfondie:[3900,4000],expert:[6900,8000]};
  const [standardInitial,standardSolde]=prices[d.offre]||[0,0];
  const initial=Number.isInteger(d.devis_acompte_personnalise_centimes)?d.devis_acompte_personnalise_centimes:standardInitial;
  const solde=Number.isInteger(d.devis_total_personnalise_centimes)&&Number.isInteger(d.devis_acompte_personnalise_centimes)?d.devis_total_personnalise_centimes-d.devis_acompte_personnalise_centimes:standardSolde;
  const express=d.express_option==='24h'?5000:d.express_option==='48h'?2000:0;
  return (d.initial_paid_at?initial+(d.options_paiement_avance?express:0):0)
    +(d.solde_paid_at?solde+(!d.options_paiement_avance&&d.express_validee?express:0)+(d.reservation_validee?1000:0):0);
 }
 function addInfo(p,name,email,phone,date){
  if(name&&!p.name)p.name=name;if(email&&!p.email)p.email=email;if(phone&&!p.phone)p.phone=phone;
  if(date&&(!p.first||date<p.first))p.first=date;
 }
 const groups=new Map();
 function item(key,type){if(!groups.has(key))groups.set(key,{key,type,name:'',email:'',phone:'',first:null,latest:null,orders:[],pro:[],spent:0});return groups.get(key)}
 const showError=msg=>{list.replaceChildren();const p=make('p');p.textContent=msg;list.append(p)};
 showError('Chargement du fichier clients…');
 try{
  const ss=await fetch('/api/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session'}),cache:'no-store'});
  if(!ss.ok)throw Error('Veuillez vous reconnecter à votre espace administrateur.');
  const rr=await fetch('/api/reporting',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'clients'}),cache:'no-store'});
  const data=await rr.json().catch(()=>({}));if(!rr.ok)throw Error(data.message||'Liste clients indisponible');
  const garages=Array.isArray(data.garages)?data.garages:[];
  for(const g of garages){const p=item('pro:'+g.id,'professionnel');addInfo(p,g.nom||g.contact,g.email,g.telephone,g.cree_le);p.subtitle=g.contact?('Contact : '+g.contact):''}
  for(const c of Array.isArray(data.comptes_particuliers)?data.comptes_particuliers:[]){
   const id=lower(c.email);if(!id)continue;
   const p=item('client:'+id,'particulier');addInfo(p,c.nom||'',c.email,c.telephone,c.cree_le);
  }
  for(const d of Array.isArray(data.dossiers)?data.dossiers:[]){
   const id=d.garage_id?'pro:'+d.garage_id:'client:'+lower(d.email);
   if(id==='client:')continue;
   const p=item(id,d.garage_id?'professionnel':'particulier');
   addInfo(p,d.contact,d.email,d.telephone,d.cree_le);
   p.orders.push(d);p.spent+=revenue(d);
   if(d.cree_le&&(!p.latest||d.cree_le>p.latest))p.latest=d.cree_le;
  }
  for(const r of Array.isArray(data.recherches_pro)?data.recherches_pro:[]){
   if(!r.garage_id)continue;
   const p=item('pro:'+r.garage_id,'professionnel');
   p.pro.push(r);
   if(r.cree_le&&(!p.latest||r.cree_le>p.latest))p.latest=r.cree_le;
   if(!p.first||r.cree_le<p.first)p.first=r.cree_le;
  }
  for(const p of groups.values()){
   p.name=p.name||p.email||'Client sans nom';p.orders.sort((a,b)=>String(b.cree_le||'').localeCompare(String(a.cree_le||'')));
   p.pro.sort((a,b)=>String(b.cree_le||'').localeCompare(String(a.cree_le||'')));
  }
  let selected=null;
  const all=[...groups.values()];
  function addStat(label,value){const box=make('div'),n=make('strong'),sub=make('small');n.textContent=value;sub.textContent=label;box.append(n,sub);summary.append(box)}
  function showDetail(p){
   selected=p.key;
   detail.hidden=false;detail.replaceChildren();
   const h=make('h2');h.textContent='Suivi client — '+p.name;detail.append(h);
   const desc=make('p');desc.className='mc-muted';desc.textContent=(p.type==='professionnel'?'Compte professionnel':'Compte particulier')+' · '+(p.email||'E-mail non renseigné')+' · '+(p.phone||'Téléphone non communiqué');detail.append(desc);
   const total=make('p');total.textContent=(p.orders.length+p.pro.length)+' demande(s) enregistrée(s) · '+euro(p.spent)+' encaissés sur les prestations à l’unité';detail.append(total);
   const deletion=make('div');
   deletion.style.cssText='margin:18px 0 20px;padding:15px;border:1px solid #89695b;border-radius:11px;background:#2b2225';
   const deletionHeading=make('strong');deletionHeading.textContent='Gestion de la fiche client';deletionHeading.style.cssText='display:block;margin-bottom:10px';
   const deletionButtons=make('div');deletionButtons.style.cssText='display:flex;flex-wrap:wrap;gap:10px';
   const hide=make('button',{type:'button'});hide.textContent='Supprimer uniquement la fiche client';
   hide.style.cssText='padding:11px 13px;border-radius:8px;border:1px solid #bd985f;color:#ffe4bb;background:#413522;cursor:pointer;font-weight:700';
   const purge=make('button',{type:'button'});purge.textContent='Supprimer toutes les données client';
   purge.style.cssText='padding:11px 13px;border-radius:8px;border:1px solid #ec8585;color:#fff;background:#822f34;cursor:pointer;font-weight:700';
   const hint=make('p');hint.className='mc-muted';hint.textContent='Fiche seule : masquer dans ce répertoire, sans modifier les commandes. Données client : retirer le suivi et les échanges non financiers ; paiements, factures et obligations comptables conservés. Les comptes de connexion ne sont pas supprimés.';
   const deleteStatus=make('p');deleteStatus.setAttribute('role','status');deleteStatus.style.cssText='margin:8px 0;color:#ffcd95';
   deletionButtons.append(hide,purge);deletion.append(deletionHeading,deletionButtons,hint,deleteStatus);detail.append(deletion);
   async function deleteClient(scope){
     const identity=p.type==='professionnel'?p.key.slice(4):lower(p.email);
     if(!identity){deleteStatus.textContent='Identifiant client indisponible : suppression impossible.';return}
     const full=scope==='complete';
     const explanation=full
       ?'ATTENTION : supprimer les demandes et les échanges non financiers de '+p.name+' ? Les paiements et justificatifs comptables seront préservés. Les comptes avec des obligations financières actives peuvent être bloqués.'
       :'Retirer la fiche de '+p.name+' du fichier clients ? Ses demandes, paiements et statistiques resteront inchangés.';
     if(!confirm(explanation))return;
     const phrase=full?'EFFACER':'SUPPRIMER';
     const typed=prompt('Pour confirmer, saisissez exactement '+phrase+' :');
     if(typed!==phrase){deleteStatus.textContent='Suppression annulée : confirmation incorrecte.';return}
     hide.disabled=true;purge.disabled=true;deleteStatus.textContent='Suppression sécurisée en cours…';
     try{
       const response=await fetch('/api/reporting',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'client_delete',clientType:p.type,clientKey:identity,scope,confirmation:phrase}),cache:'no-store'});
       const result=await response.json().catch(()=>({}));
       if(!response.ok||result.ok!==true)throw Error(result.message||'Suppression refusée');
       deleteStatus.textContent=result.message||'Opération confirmée.';
       groups.delete(p.key);
       const idx=all.findIndex(x=>x.key===p.key);
       if(idx>=0)all.splice(idx,1);
       selected=null;detail.hidden=true;render();
     }catch(error){deleteStatus.textContent=error.message;hide.disabled=false;purge.disabled=false}
   }
   hide.onclick=()=>deleteClient('fiche');
   purge.onclick=()=>deleteClient('complete');

   if(!p.orders.length&&!p.pro.length){const t=make('p');t.textContent='Ce client possède un compte, mais aucune commande enregistrée.';detail.append(t)}
   for(const d of p.orders){
    const card=make('div',{className:'mc-order'}),left=make('div'),right=make('div'),ref=make('strong');
    ref.textContent=d.reference||'Dossier sans référence';
    const info=make('p');info.textContent=[d.details?.brand,d.details?.model,d.details?.part].filter(Boolean).join(' · ')||'Pièce non précisée';info.style.margin='6px 0';
    const meta=make('div',{className:'mc-muted'});meta.textContent=fmtDateTime(d.cree_le)+' · '+(statusText[d.statut]||d.statut||'Statut inconnu')+' · '+(d.devis_decision==='refuse'?'Devis refusé':d.offre||'Formule non définie');
    left.append(ref,info,meta);
    if(d.devis_email_envoye_le||d.devis_email_delivre_confirme||d.devis_page_consultee_le){
      const tracking=make('div',{className:'mc-muted'});
      tracking.style.cssText='margin-top:9px;font-size:12px;line-height:1.5;overflow-wrap:anywhere';
      tracking.textContent='✉ Envoyé : '+(d.devis_email_envoye_le?fmtDateTime(d.devis_email_envoye_le):'historique')+
       ' · Livraison : '+(d.devis_email_delivre_confirme?'confirmée Resend':'non confirmée')+
       ' · Ouverture e-mail : '+(d.devis_email_ouverture_detectee_le?'détection Resend le '+fmtDateTime(d.devis_email_ouverture_detectee_le):'non mesurée / non détectée')+' · Page devis : '+(d.devis_page_consultee_le?'consultée le '+fmtDateTime(d.devis_page_consultee_le):'non constatée');
      left.append(tracking);
    }
    const price=make('div');price.textContent=euro(revenue(d))+' encaissés';price.style.cssText='font-weight:700;margin-bottom:9px;text-align:right';
    const btn=make('button',{type:'button',className:'mc-button'});btn.textContent='Ouvrir le dossier';btn.onclick=()=>{sessionStorage.setItem('meca-dossier-selected',d.id);location.hash='#/admin/demandes?dossier='+encodeURIComponent(d.id)};
    right.append(price,btn);card.append(left,right);detail.append(card);
   }
   for(const r of p.pro){
    const card=make('div',{className:'mc-order'}),left=make('div'),ref=make('strong');ref.textContent='Recherche professionnelle';
    const line=make('div');line.textContent=[r.marque,r.modele,r.piece].filter(Boolean).join(' · ')||'Recherche professionnelle';
    const meta=make('small',{className:'mc-muted'});meta.textContent=fmtDateTime(r.cree_le)+' · '+(r.statut||'Enregistrée')+' · Recherche liée au forfait/crédit Pro';
    left.append(ref,line,meta);
    const right=make('div');const btn=make('button',{type:'button',className:'mc-button'});btn.textContent='Voir la recherche';btn.onclick=()=>{location.hash='#/admin/demandes?source=professionnel&dossier='+encodeURIComponent(r.id)};right.append(btn);card.append(left,right);detail.append(card);
   }
   detail.scrollIntoView?.({behavior:'smooth',block:'start'});
  }
  function render(){
   const q=lower(search.value),after=from.value,before=to.value;
   const matched=all.filter(p=>{
    if(q&&!lower([p.name,p.email,p.phone,p.subtitle,...p.orders.map(d=>d.reference)].join(' ')).includes(q))return false;
    if(after||before){const dates=[...p.orders.map(d=>d.cree_le),...p.pro.map(d=>d.cree_le)].map(x=>String(x||'').slice(0,10));if(!dates.some(dt=>dt&&(!after||dt>=after)&&(!before||dt<=before)))return false}
    return true;
   });
   const mode=order.value;
   matched.sort((a,b)=>mode==='spent'?b.spent-a.spent:mode==='low'?a.spent-b.spent:mode==='old'?String(a.first||'').localeCompare(String(b.first||'')):mode==='orders'?(b.orders.length+b.pro.length)-(a.orders.length+a.pro.length):mode==='name'?a.name.localeCompare(b.name,'fr'):String(b.latest||b.first||'').localeCompare(String(a.latest||a.first||'')));
   summary.replaceChildren();addStat('Clients visibles',String(matched.length));addStat('Demandes visibles',String(matched.reduce((n,p)=>n+p.orders.length+p.pro.length,0)));addStat('Encaissé à l’unité',euro(matched.reduce((n,p)=>n+p.spent,0)));
   list.replaceChildren();
   if(!matched.length){showError('Aucun client ne correspond aux critères sélectionnés.');return}
   for(const p of matched){
    const card=make('article',{className:'mc-client'}),a=make('div'),b=make('div'),c=make('div'),d=make('div');
    const title=make('div',{className:'mc-name'});title.textContent=p.name;const type=make('div',{className:'mc-muted'});type.textContent=p.type==='professionnel'?'Professionnel':'Particulier';
    const latest=make('div',{className:'mc-muted'});latest.textContent='Dernière demande : '+(p.latest?fmtDate(p.latest):'Aucune');a.append(title,type,latest);
    const mail=make('div');mail.textContent=p.email||'E-mail non renseigné';mail.style.overflowWrap='anywhere';const tel=make('div',{className:'mc-muted'});tel.textContent=p.phone||'Téléphone non communiqué';b.append(mail,tel);
    const spent=make('strong');spent.textContent=euro(p.spent);const n=make('div',{className:'mc-muted'});n.textContent=(p.orders.length+p.pro.length)+' demande(s)';c.append(spent,n);
    const button=make('button',{type:'button',className:'mc-button'});button.textContent='Voir le suivi';button.onclick=()=>showDetail(p);d.append(button);
    card.append(a,b,c,d);list.append(card);
   }
   if(selected){const p=matched.find(x=>x.key===selected);if(!p)detail.hidden=true}
  }
  for(const ctrl of [search,from,to,order])ctrl.addEventListener(ctrl===order?'change':'input',render);
  render();
 }catch(error){showError('Impossible de charger le fichier clients : '+error.message)}
};
