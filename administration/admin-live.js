'use strict';
window.mecaAdminLive=async function(main,path){
 const endpoint='/api/reporting';
 const call=async body=>{const session=await fetch('/api/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'session'}),cache:'no-store'});if(!session.ok)throw Error('Session administrateur expirée ou révoquée : reconnectez-vous.');const r=await fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'Service non disponible');return d};
 const set=(id,value)=>{const x=main.querySelector('#'+id);if(x)x.textContent=value};
 const eur=x=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format((Number(x)||0)/100);
 const label=(name,value)=>{for(const m of main.querySelectorAll('.metric')){if(m.querySelector('.label')?.textContent.includes(name)){const v=m.querySelector('.value');if(v)v.textContent=String(value);break}}};
 try{
  const d=await call({action:'reporting'});
  const summary=main.querySelector('.meca-admin-live-status');
  if(summary)summary.textContent='Statistiques synchronisées avec la base Mécascope. Les encaissements comptés correspondent aux paiements confirmés côté serveur.';
  for(const [id,key] of Object.entries({'meca-single-month':'paiements_uniques_mois','meca-single-previous':'paiements_uniques_precedent','meca-single-total':'paiements_uniques_total','meca-type-targeted':'unitaire_ciblee','meca-type-deep':'unitaire_approfondie','meca-type-expert':'unitaire_expert','meca-start-payments':'paiements_initiaux','meca-success-payments':'paiements_soldes','meca-pro-priority':'abonnements_priorite','meca-pro-five':'abonnements_pro5','meca-pro-ten':'abonnements_pro10'}))set(id,d[key]??0);
  set('meca-oneoff-revenue',eur(d.ca_unitaire_centimes));
  label('Nouvelles demandes',d.nouvelles_demandes||0);label('Recherches en cours',d.recherches_en_cours||0);label('Résultats à débloquer',d.resultats_a_debloquer||0);label('Demandes urgentes',d.urgences||0);
  // Aucune estimation du CA des abonnements : seul Stripe (factures payées, mode réel) fait foi.
  if(path==='/admin'||path==='/admin/statistiques'){
   let finance=null;
   try{finance=await call({action:'finance_stripe'});}catch(err){
    const note=document.createElement('p');note.className='meca-stripe-audit-note';
    note.textContent='CA abonnements non vérifié : '+(err?.message||'connexion Stripe indisponible')+'. Aucun chiffre estimé n’est affiché.';
    main.querySelector('.pagehead')?.after(note);
   }
   const verified=finance?.ok===true&&finance?.source==='stripe_paid_invoices'&&finance.exact===true;
   label('Chiffre d’affaires',verified?eur((d.ca_unitaire_centimes||0)+finance.abonnements_ca_centimes):'—');
   label('Récurrence mensuelle',verified?eur(finance.abonnements_ca_mois_centimes):'—');
   const anchor=main.querySelector('.metrics.six')||main.querySelector('.meca-single-section')||main.querySelector('.panel');
   if(anchor){
     const tile=document.createElement('section');tile.className='panel meca-stripe-ca';tile.style.cssText='margin:14px 0;padding:15px;border:1px solid #6a8296;border-radius:10px';
     const title=document.createElement('strong');title.textContent='CA des abonnements — factures Stripe réellement payées';
     const amount=document.createElement('div');amount.style.cssText='font-size:23px;font-weight:750;margin:7px 0';amount.textContent=verified?eur(finance.abonnements_ca_centimes):'Non vérifié';
     const sub=document.createElement('small');sub.textContent=verified?finance.factures_payees+' facture(s) payée(s) vérifiée(s), hors remboursements enregistrés en avoir, mode réel uniquement.':'Calcul en attente des données Stripe confirmées ; aucune estimation tirée des crédits.';
     tile.append(title,amount,sub);anchor.after(tile);
   }
  }
  label('Priorité Pro',d.abonnements_priorite||0);label('Pro 5',d.abonnements_pro5||0);label('Pro 10',d.abonnements_pro10||0);
  if(path==='/admin/statistiques'){
   const tbody=main.querySelector('#meca-pages-report-rows'),status=main.querySelector('#meca-pages-report-status');
   if(tbody){
    try{
     const pages=await call({action:'pages_stats'});
     if(!Array.isArray(pages))throw Error('Format de statistiques inattendu');
     const names={'/':'Accueil','/tarifs.html':'Tarifs','/qui-sommes-nous.html':'Qui sommes-nous','/mission.html':'Rechercher une pièce','/espace-pro.html':'Espace Pro','/compte.html':'Compte client'};
     tbody.replaceChildren();
     if(!pages.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.style.padding='12px 8px';td.textContent='Aucune visite enregistrée.';tr.append(td);tbody.append(tr);}
     for(const item of pages){
      const tr=document.createElement('tr');
      const td=document.createElement('td');td.style.padding='12px 8px';td.style.borderTop='1px solid #343b45';td.textContent=names[item.chemin]||item.chemin;
      const views=document.createElement('td');views.style.cssText='padding:12px 8px;border-top:1px solid #343b45;text-align:right';views.textContent=String(item.vues??0);
      const unique=document.createElement('td');unique.style.cssText='padding:12px 8px;border-top:1px solid #343b45;text-align:right';unique.textContent=String(item.visiteurs??0);
      tr.append(td,views,unique);tbody.append(tr);
     }
     if(status)status.textContent='Données réelles issues du suivi Mécascope, cumulées depuis son activation.';
    }catch(e){
     tbody.replaceChildren();const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.style.padding='12px 8px';td.textContent='Impossible de charger les visites par page.';tr.append(td);tbody.append(tr);
     if(status)status.textContent=String(e?.message||'Erreur de chargement');
    }
   }
  }
  if(path==='/admin'){
   const block=main.querySelector('.metrics.six');
   if(block&&!main.querySelector('#meca-proposals-awaiting-tile')){
    const tile=document.createElement('div');tile.className='metric meca-proposals-awaiting-tile';
    tile.id='meca-proposals-awaiting-tile';
    tile.style.cssText='cursor:pointer;border:1px solid rgba(235,161,75,.65)';
    tile.setAttribute('role','button');tile.tabIndex=0;
    const title=document.createElement('div');title.className='label';title.textContent='Propositions envoyées — en attente';
    const value=document.createElement('div');value.className='value';value.textContent=String(d.propositions_en_attente||0);
    const note=document.createElement('small');note.textContent=(d.propositions_relance_24h||0)+' à relancer après 24 h · '+(d.propositions_relance_48h||0)+' après 48 h';
    const body=document.createElement('div');body.append(title,value,note);tile.append(body);
    const go=()=>{location.hash='#/admin/demandes?filtre=devis_en_attente'};
    tile.onclick=go;tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}};
    block.append(tile);
   }
  }
  if(path==='/admin'){
   const block=main.querySelector('.metrics.six');
   if(block&&!main.querySelector('#meca-visitors-tile')){
    const div=document.createElement('div');div.className='metric';div.id='meca-visitors-tile';
    div.innerHTML='<div><div class="label">Visiteurs aujourd’hui</div><div class="value"></div><div class="meca-single-card-desc"></div></div>';
    div.querySelector('.value').textContent=String(d.visiteurs_jour||0);
    div.querySelector('.meca-single-card-desc').textContent=(d.visites_total||0)+' visites depuis le démarrage du suivi';
    block.append(div);
   }
  }
  const dossiers=Array.isArray(d.dossiers)?d.dossiers:[];
  const conversations=await call({action:'conversations'}).catch(()=>[]);
  const inbox=Array.isArray(conversations)?conversations:[];
  const unreadTotal=inbox.reduce((n,c)=>n+Number(c.non_lus||0),0);
  const pendingCount=inbox.filter(c=>c.dernier_auteur==='client').length;
  const unreadConversationCount=inbox.filter(c=>Number(c.non_lus||0)>0).length;
  for(const nav of document.querySelectorAll('.side a[href*="/admin/messages"],.side a[data-go="/admin/messages"]')){
    const mark=nav.querySelector('.meca-inbox-unread-badge')||document.createElement('span');
    mark.className='meca-inbox-unread-badge';mark.textContent=unreadTotal?String(unreadTotal):'';
    mark.style.cssText='display:inline-block;margin-left:8px;padding:2px 8px;border-radius:20px;background:'+(unreadTotal?'#e9812a':'transparent')+';color:#161b22;font-weight:800';
    if(!mark.parentNode)nav.append(mark);
  }
  if(path==='/admin'){
    const metrics=main.querySelector('.metrics.six');
    if(metrics){
      const tile=document.createElement('div');tile.className='metric';tile.id='meca-inbox-tile';tile.style.cssText='cursor:pointer;border:2px solid '+(pendingCount?'#ff9933':'#586471')+';background:'+(pendingCount?'#38291e':'#1a222b');
      tile.tabIndex=0;tile.setAttribute('role','button');
      const box=document.createElement('div'),caption=document.createElement('div'),count=document.createElement('div'),sub=document.createElement('small');
      caption.className='label';caption.textContent='Messages clients à traiter';
      count.className='value';count.textContent=String(pendingCount);
      sub.textContent=unreadConversationCount+' conversation(s) non lue(s) · '+unreadTotal+' message(s) non lu(s) · '+inbox.length+' conversation(s) au total';
      box.append(caption,count,sub);tile.append(box);
      const go=()=>{location.hash='#/admin/messages'};tile.onclick=go;tile.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}};
      metrics.append(tile);
    }
  }

  if(path==='/admin/demandes'){
   const requested=new URLSearchParams(location.hash.split('?')[1]||'');
   const id=requested.get('dossier');
   if(requested.get('source')!=='professionnel'&&/^[a-f0-9-]{36}$/i.test(id||'')&&!dossiers.some(x=>x.id===id)){
    try{
     const response=await fetch('/api/push',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'single-dossier',id}),cache:'no-store'});
     const result=await response.json();
     if(response.ok&&result.dossier)dossiers.unshift(result.dossier);
    }catch{}
   }
  }
  if(path==='/admin'){
   const tbody=main.querySelector('.tablewrap tbody');
   if(tbody){tbody.replaceChildren();for(const item of dossiers.slice(0,15)){const tr=document.createElement('tr');for(const v of [item.reference,item.contact,item.details?.brand+' '+item.details?.model,item.statut,item.cree_le?.slice(0,10)]){const td=document.createElement('td');td.textContent=v||'—';tr.append(td)}const td=document.createElement('td');const btn=document.createElement('button');btn.className='btn dark small';btn.textContent='Ouvrir';btn.onclick=()=>{location.hash='#/admin/demandes';sessionStorage.setItem('meca-dossier-selected',item.id)};td.append(btn);tr.append(td);tbody.append(tr)}main.querySelector('.tablewrap .empty')?.remove()}
  }

  // Messagerie autonome : la page /admin/messages n'a pas le formulaire de devis.
  if(path==='/admin/messages'){
    const old=main.querySelector('.meca-inbox');
    if(old)old.remove();
    const head=main.querySelector('.pagehead');
    // La page Messages contient seulement la liste des clients et la conversation.
    const layout=document.createElement('section');
    layout.className='meca-messages-layout';
    layout.style.cssText='display:grid;grid-template-columns:minmax(260px,345px) minmax(0,1fr);gap:18px;margin-top:18px;align-items:start';
    const left=document.createElement('section');left.className='panel';
    left.style.cssText='padding:15px;border:1px solid #465866;border-radius:12px;background:#16202a';
    const listTitle=document.createElement('h2');listTitle.textContent='Conversations clients';
    listTitle.style.cssText='margin:0 0 8px;font-size:20px';
    const listSummary=document.createElement('p');listSummary.style.cssText='margin:0 0 14px;color:#bfcad6;font-size:14px';
    const list=document.createElement('div');list.style.cssText='display:grid;gap:10px';
    left.append(listTitle,listSummary,list);
    const right=document.createElement('section');right.className='panel';
    right.style.cssText='padding:20px;border:1px solid #536b81;border-radius:12px;background:#15212e;min-height:330px';
    const title=document.createElement('h2');title.textContent='Conversation avec le client';title.style.cssText='margin:0 0 10px';
    const dossier=document.createElement('div');dossier.style.cssText='white-space:pre-wrap;color:#d9e1ea;font-size:14px;line-height:1.6;margin:0 0 15px';
    const messages=document.createElement('div');messages.style.cssText='display:flex;flex-direction:column;gap:14px;max-height:550px;min-height:150px;overflow:auto;padding:17px;background:#0d1620;border:1px solid #425466;border-radius:12px';
    const reply=document.createElement('form');reply.style.cssText='display:none;margin-top:17px;padding:16px;background:#20364a;border:1px solid #769bbb;border-radius:10px';
    const replyLabel=document.createElement('label');replyLabel.textContent='Votre réponse au client';replyLabel.style.cssText='display:block;font-weight:700;margin-bottom:8px';
    const input=document.createElement('textarea');input.rows=4;input.maxLength=3000;input.required=true;input.placeholder='Écrivez votre message au client…';input.style.cssText='width:100%;padding:12px;box-sizing:border-box;border-radius:8px;color:#162333;background:#fff;border:1px solid #a6bed4;line-height:1.5';
    const send=document.createElement('button');send.type='submit';send.className='btn orange';send.textContent='Envoyer ma réponse';send.style.marginTop='10px';
    const sendStatus=document.createElement('p');sendStatus.setAttribute('role','status');
    reply.append(replyLabel,input,send,sendStatus);
    right.append(title,dossier,messages,reply);
    layout.append(left,right);main.append(layout);
    const responsive=document.createElement('style');responsive.textContent='@media(max-width:800px){.meca-messages-layout{grid-template-columns:1fr!important}}';main.append(responsive);
    let currentId=null;
    let inboxItems=Array.isArray(inbox)?inbox:[];
    const awaiting=c=>Number(c?.non_lus||0)>0;
    const renderList=()=>{
      list.replaceChildren();
      const waiting=inboxItems.filter(awaiting).length;
      listTitle.textContent='Conversations clients ('+inboxItems.length+')';
      listSummary.textContent=waiting+' conversation(s) non lue(s) · Vert : message non lu · Gris : conversation consultée';
      if(!inboxItems.length){const empty=document.createElement('p');empty.textContent='Aucune conversation client enregistrée.';list.append(empty)}
      for(const c of inboxItems){
        const pending=awaiting(c);
        const button=document.createElement('button');button.type='button';
        button.dataset.dossier=c.dossier_id;button.setAttribute('aria-pressed',String(currentId===c.dossier_id));
        button.style.cssText='width:100%;text-align:left;padding:14px;border-radius:10px;white-space:normal;line-height:1.5;cursor:pointer;border:2px solid '+(pending?'#4cca87':'#617386')+';background:'+(pending?'#174431':'#26313c')+';color:#fff;box-shadow:'+(currentId===c.dossier_id?'0 0 0 2px #f5aa52':'none');
        const name=document.createElement('strong');name.style.cssText='display:block;font-size:15px';
        name.textContent=(pending?'● NON LU · ':'✓ LU · ')+(c.reference||'Dossier')+' — '+(c.contact||'Client');
        const snippet=document.createElement('div');snippet.style.cssText='margin:7px 0;color:#e1e9f0;font-size:14px;overflow-wrap:anywhere';
        snippet.textContent=String(c.extrait||'Message disponible').slice(0,175);
        const meta=document.createElement('small');meta.textContent=(c.non_lus?c.non_lus+' nouveau(x) · ':'')+(c.dernier_message?new Date(c.dernier_message).toLocaleString('fr-FR'):'');
        button.append(name,snippet,meta);
        button.onclick=()=>openConversation(c.dossier_id);
        list.append(button);
      }
    };
    const refreshInbox=async()=>{
      const data=await call({action:'conversations'});
      if(!Array.isArray(data))throw Error('Liste des conversations indisponible');
      inboxItems=data;renderList();
      const unread=data.reduce((n,c)=>n+Number(c.non_lus||0),0);
      for(const mark of document.querySelectorAll('.meca-inbox-unread-badge')){mark.textContent=unread?String(unread):'';mark.style.background=unread?'#e9812a':'transparent'}
    };
    const renderMessages=items=>{
      messages.replaceChildren();
      if(!items.length){const empty=document.createElement('p');empty.textContent='Aucun échange enregistré dans ce dossier.';messages.append(empty);return}
      for(const m of items){
        const client=m.auteur==='client';
        const line=document.createElement('div');line.style.cssText='display:flex;justify-content:'+(client?'flex-start':'flex-end');
        const bubble=document.createElement('article');bubble.style.cssText='max-width:87%;padding:13px 17px;background:'+(client?'#274a35':'#284b70')+';border:1px solid '+(client?'#65c991':'#81b2f0')+';color:#fff;border-radius:'+(client?'5px 15px 15px 15px':'15px 5px 15px 15px');
        const who=document.createElement('strong');who.style.cssText='display:block;margin-bottom:7px';who.textContent=client?'👤 Message du client':'🔧 Réponse Mécascope';
        const body=document.createElement('div');body.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6';body.textContent=m.contenu||'';
        const date=document.createElement('small');date.style.cssText='display:block;margin-top:8px;opacity:.8;text-align:right';date.textContent=m.cree_le?new Date(m.cree_le).toLocaleString('fr-FR'):'';
        bubble.append(who,body,date);line.append(bubble);messages.append(line);
      }
      messages.scrollTop=messages.scrollHeight;
    };
    const openConversation=async id=>{
      currentId=id;renderList();
      const c=inboxItems.find(x=>x.dossier_id===id);
      title.textContent='Conversation — '+(c?.reference||'Dossier client');
      dossier.textContent=(c?.contact||'Client')+' · '+(c?.email||'')+' · '+(c?.statut||'');
      messages.textContent='Chargement de la conversation…';reply.style.display='block';sendStatus.textContent='';
      if(window.innerWidth<801)right.scrollIntoView?.({block:'start',behavior:'smooth'});
      try{
        const result=await call({action:'messages',id});
        if(currentId!==id)return;
        renderMessages(Array.isArray(result.messages)?result.messages:[]);
        await call({action:'mark_read',id});
        if(currentId===id){const item=inboxItems.find(x=>x.dossier_id===id);if(item)item.non_lus=0;renderList();const unread=inboxItems.reduce((n,c)=>n+Number(c.non_lus||0),0);for(const mark of document.querySelectorAll('.meca-inbox-unread-badge')){mark.textContent=unread?String(unread):'';mark.style.background=unread?'#e9812a':'transparent'}}
      }catch(error){if(currentId===id)messages.textContent='Erreur de chargement : '+error.message}
    };
    reply.addEventListener('submit',async event=>{
      event.preventDefault();const content=input.value.trim();
      if(!currentId||!content)return;
      send.disabled=true;sendStatus.textContent='Envoi de la réponse en cours…';
      try{
        const id=currentId;
        const result=await call({action:'chat',id,message:content});
        input.value='';
        sendStatus.textContent=result.message||'Réponse enregistrée.';
        await refreshInbox();
        await openConversation(id);
      }catch(error){sendStatus.textContent='Envoi impossible : '+error.message}
      finally{send.disabled=false}
    });
    renderList();
    const requested=new URLSearchParams(location.hash.split('?')[1]||'').get('dossier');
    if(requested&&inboxItems.some(x=>x.dossier_id===requested))openConversation(requested);
    else if(inboxItems.length){messages.textContent='Cliquez sur un dossier dans la liste verte ou grise à gauche pour afficher toute la conversation.';}
    // Conversations professionnelles : source distincte, même onglet administrateur.
    const proPanel=document.createElement('section');proPanel.className='panel meca-messages-pro';proPanel.style.cssText='margin-top:20px;padding:20px;border:1px solid #637d91;border-radius:12px';
    const proHeading=document.createElement('h2');proHeading.textContent='Conversations professionnelles';
    const proNote=document.createElement('p');proNote.className='muted';proNote.textContent='Échanges avec les garages et professionnels. Ces messages ne sont pas liés à un devis particulier.';
    const proColumns=document.createElement('div');proColumns.style.cssText='display:grid;grid-template-columns:minmax(200px,300px) minmax(0,1fr);gap:15px';
    const proList=document.createElement('div');proList.style.cssText='display:grid;gap:9px;align-content:start';
    const proBody=document.createElement('div');proBody.style.cssText='background:#202c37;border:1px solid #5e7383;padding:15px;border-radius:11px;min-width:0';
    const proMessages=document.createElement('div');proMessages.style.cssText='display:grid;gap:10px;max-height:430px;overflow:auto;padding:9px 0';
    const proForm=document.createElement('form');proForm.style.cssText='display:grid;gap:10px;margin-top:15px';
    const proInput=document.createElement('textarea');proInput.rows=4;proInput.maxLength=3000;proInput.placeholder='Répondre au professionnel…';proInput.setAttribute('aria-label','Réponse au professionnel');
    const proSend=document.createElement('button');proSend.type='submit';proSend.className='btn orange';proSend.textContent='Envoyer la réponse au professionnel';
    const proStatus=document.createElement('p');proStatus.setAttribute('role','status');proStatus.className='muted';
    proForm.append(proInput,proSend,proStatus);proForm.hidden=true;
    proBody.append(proMessages,proForm);proColumns.append(proList,proBody);proPanel.append(proHeading,proNote,proColumns);main.append(proPanel);
    let selectedGarage=null,proConversations=[];
    const paintPro=()=>{
      proList.replaceChildren();
      if(!proConversations.length){const n=document.createElement('p');n.className='muted';n.textContent='Aucune conversation professionnelle pour le moment.';proList.append(n);return}
      for(const c of proConversations){
        const btn=document.createElement('button');btn.type='button';btn.className='btn dark';
        btn.style.cssText='white-space:normal;text-align:left;overflow-wrap:anywhere;padding:13px;background:'+(selectedGarage===c.garage_id?'#31475a':'#26313c');
        btn.textContent=(c.nom||c.contact||'Garage Pro')+' · '+(c.total_messages||0)+' message(s)';
        btn.onclick=()=>openPro(c.garage_id);
        proList.append(btn);
      }
    };
    const openPro=async id=>{
      selectedGarage=id;paintPro();
      const c=proConversations.find(item=>item.garage_id===id);
      proMessages.replaceChildren();
      const heading=document.createElement('h3');heading.textContent=(c?.nom||'Compte professionnel')+' · '+(c?.email||'');
      proMessages.append(heading);proForm.hidden=false;proStatus.textContent='Chargement…';
      try{
        const rows=await call({action:'pro_messages',id});
        if(selectedGarage!==id)return;
        proMessages.replaceChildren(heading);
        for(const m of Array.isArray(rows)?rows:[]){
          const entry=document.createElement('article');entry.style.cssText='background:'+(m.auteur==='support'?'#244a67':'#33483c')+';padding:12px;border-radius:9px;white-space:pre-wrap;overflow-wrap:anywhere';
          const title=document.createElement('strong');title.textContent=(m.auteur==='support'?'Mécascope':'Professionnel')+' · '+(m.cree_le?new Date(m.cree_le).toLocaleString('fr-FR'):'');
          const content=document.createElement('div');content.textContent=m.contenu||'';
          entry.append(title,content);proMessages.append(entry);
        }
        proStatus.textContent='';
      }catch(e){proStatus.textContent='Impossible de lire les messages Pro : '+e.message}
    };
    proForm.addEventListener('submit',async e=>{
      e.preventDefault();if(!selectedGarage||!proInput.value.trim())return;
      const id=selectedGarage;proSend.disabled=true;proStatus.textContent='Envoi en cours…';
      try{
        await call({action:'pro_reply',id,message:proInput.value.trim()});
        proInput.value='';await openPro(id);
        proStatus.textContent='Réponse enregistrée dans la messagerie du professionnel.';
      }catch(err){proStatus.textContent='Envoi non confirmé : '+err.message}
      finally{proSend.disabled=false}
    });
    try{const received=await call({action:'pro_conversations'});proConversations=Array.isArray(received)?received:[];paintPro()}
    catch(err){proList.textContent='Conversations Pro indisponibles : '+err.message}
    return;
  }
  if(['/admin/demandes','/admin/messages'].includes(path)){
   const query=new URLSearchParams(location.hash.split('?')[1]||'');
   if(query.get('source')==='professionnel'&&/^[a-f0-9-]{36}$/i.test(query.get('dossier')||'')&&!dossiers.some(x=>x.id===query.get('dossier')))dossiers.unshift({id:query.get('dossier'),reference:'Dossier professionnel',contact:'Client professionnel',type_dossier:'professionnel',statut:'recherche'});
   const form=main.querySelector('#meca-result-form');if(!form)return;
   const compactDemandes=path==='/admin/demandes';
   const composerPanel=form.closest('section.panel');
   const select=document.createElement('select');select.id='meca-live-dossier';
   const initial=document.createElement('option');initial.value='';initial.textContent='Choisir un dossier client';select.append(initial);
   for(const row of dossiers){const option=document.createElement('option');option.value=row.id;option.textContent=row.reference+' — '+row.contact+' ('+row.statut+')';select.append(option)}
   const wrap=document.createElement('div');wrap.className='panel';wrap.append(select);
   const history=document.createElement('div');history.id='meca-live-history';history.style.cssText='white-space:pre-wrap;padding:12px;line-height:1.7';wrap.append(history);
   // La fiche doit être hors du panneau de compte rendu, qui reste masqué avant paiement.
   if(compactDemandes&&composerPanel)composerPanel.before(wrap);
   else form.before(wrap);
   if(compactDemandes){
    wrap.hidden=true;wrap.style.display='none';
    if(composerPanel){composerPanel.hidden=true;composerPanel.style.display='none'}
    const close=document.createElement('button');close.type='button';close.className='btn dark small';close.textContent='← Fermer le dossier et revenir aux demandes';
    close.style.cssText='margin-bottom:12px';
    close.onclick=()=>{
      select.value='';select.dispatchEvent(new Event('change'));
      wrap.hidden=true;wrap.style.display='none';
      if(composerPanel){composerPanel.hidden=true;composerPanel.style.display='none'}
      main.querySelector('#list-content')?.scrollIntoView?.({block:'start',behavior:'smooth'});
    };
    wrap.prepend(close);
   }
   // Registre des dossiers réels : visible immédiatement, même sans sélection.
   const registry=document.createElement('section');
   registry.className='panel meca-dossiers-registry';
   const heading=document.createElement('h2');heading.textContent='Dossiers clients à traiter ('+dossiers.length+')';registry.append(heading);
   const helper=document.createElement('p');helper.className='muted';helper.textContent='Sélectionnez un dossier pour consulter le client, le véhicule et préparer sa réponse.';registry.append(helper);
   const list=document.createElement('div');list.style.cssText='display:grid;gap:10px';registry.append(list);
   const detail=document.createElement('div');detail.className='panel';detail.style.cssText='margin-top:14px;white-space:pre-wrap;line-height:1.7';detail.textContent='Sélectionnez un dossier pour afficher ses informations.';registry.append(detail);
   if(compactDemandes){registry.hidden=true;registry.style.display='none';wrap.insertBefore(detail,wrap.firstChild);detail.hidden=true}
   const fields=[['Type de véhicule','vehicleType'],['Marque','brand'],['Modèle','model'],['Année','year'],['Motorisation','engine'],['Carburant','fuel'],['Boîte','gearbox'],['Finition','trim'],['Pièce recherchée','part'],['Référence de pièce','ref'],['VIN','vin'],['Budget maximum d’achat de la pièce','budget'],['Remarques','notes']];
   function showDossier(row){
     if(!row){detail.textContent='Sélectionnez un dossier.';return}
     const lines=['DOSSIER '+(row.reference||row.id),'Statut : '+(row.statut==='refuse'?'Devis refusé — nouvelle proposition possible':row.statut||'—')+(row.statut==='devis_envoye'&&row.devis_decision==='accepte'?' (devis accepté, paiement initial attendu)':''),'Client : '+(row.contact||'—'),'E-mail : '+(row.email||'—'),'Créé le : '+(row.cree_le?new Date(row.cree_le).toLocaleString('fr-FR'):'—'),'Type : '+(row.garage_id||row.type_dossier==='professionnel'?'Professionnel — recherche à l’unité':'Particulier')];
     lines.push('Priorité déclarée : '+(row.urgent?'🚨 URGENTE — examiner dès que possible (Express à proposer seulement dans le devis)':'Normale'));
     lines.push('Téléphone : '+(String(row.telephone||'').trim()||'NON COMMUNIQUÉ — à demander au client'));
     const budget=String(row.details?.budget??'').trim();
     if(!budget)lines.push('Règle de réussite : une offre fournisseur compatible, disponible et au prix vérifié peut valider la recherche quel que soit le prix de la pièce, sans obligation d’achat.');
     lines.push('Budget maximum de la pièce : '+(budget?budget:'NON INDIQUÉ — pas de plafond communiqué ; prix fournisseur sans limite contractuelle si offre qualifiée (aucun achat sans accord)'));
     for(const [label,key] of fields){if(key==='budget')continue;const v=row.details?.[key];if(v!==null&&v!==undefined&&String(v).trim())lines.push(label+' : '+String(v))}
     detail.textContent=lines.join('\n');
     if(path==='/admin/demandes'&&row.initial_paid_at){
       const supplierPanel=document.createElement('section');
       supplierPanel.className='meca-dossier-fournisseurs-payes';
       supplierPanel.style.cssText='white-space:normal;margin-top:17px;padding:17px;border:1px solid #587b91;border-radius:12px;background:#192937';
       const heading=document.createElement('h3');heading.textContent='Fournisseurs adaptés à ce dossier — acompte confirmé';
       const info=document.createElement('p');info.className='muted';info.textContent='Seuls les fournisseurs correspondant au type de véhicule demandé sont présentés ici. Le répertoire complet et le journal des contacts restent dans Fournisseurs.';
       const suppliers=document.createElement('div');suppliers.textContent='Recherche des fournisseurs correspondants…';
       const link=document.createElement('button');link.type='button';link.className='btn dark small';link.textContent='Ouvrir la gestion des fournisseurs';link.style.marginTop='12px';
       link.onclick=()=>{location.hash='#/admin/fournisseurs?dossier='+encodeURIComponent(row.id)};
       supplierPanel.append(heading,info,suppliers,link);detail.append(supplierPanel);
       const selectedId=row.id;
       (async()=>{
         try{
           const result=await fetch('/api/fournisseurs',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list',dossier:selectedId,type:'particulier'})});
           const payload=await result.json().catch(()=>({}));
           if(select.value!==selectedId||!supplierPanel.isConnected)return;
           if(!result.ok)throw Error(payload.message||'Fournisseurs momentanément indisponibles');
           const data=payload.result||{},entries=Array.isArray(data.fournisseurs)?data.fournisseurs:[];
           suppliers.replaceChildren();
           const summary=document.createElement('p');summary.textContent=entries.length+' fournisseur(s) correspondant à '+(data.categorie_dossier||'la catégorie du véhicule');
           suppliers.append(summary);
           for(const item of entries){
             const line=document.createElement('article');line.style.cssText='margin:9px 0;padding:11px;background:#233745;border:1px solid #496477;border-radius:9px';
             const name=document.createElement('strong');name.textContent=item.nom||'Fournisseur';
             line.append(name);
             const contact=document.createElement('div');contact.style.cssText='font-size:13px;margin-top:6px;overflow-wrap:anywhere';contact.textContent=[item.pays,item.telephone,item.email].filter(Boolean).join(' · ');
             line.append(contact);
             suppliers.append(line);
           }
           if(!entries.length){const empty=document.createElement('p');empty.textContent='Aucun fournisseur enregistré pour cette catégorie. Consultez Fournisseurs pour enrichir le répertoire.';suppliers.append(empty)}
         }catch(e){if(select.value===selectedId&&supplierPanel.isConnected)suppliers.textContent=e.message}
       })();
     }
   }
   for(const row of dossiers){
     const button=document.createElement('button');button.type='button';button.className='btn dark small';button.style.cssText='text-align:left;white-space:normal;line-height:1.5;padding:12px';
     if(row.urgent){button.style.border='2px solid #f19b41';button.style.background='linear-gradient(100deg,#42251b,#29221c)';}
     button.textContent=(row.urgent?'🚨 URGENT · ':'')+(row.reference||'Dossier')+' · '+(row.contact||'Client')+' · '+(row.details?.brand||'')+' '+(row.details?.model||'')+' · '+(row.statut||'—');
     button.onclick=()=>{select.value=row.id;select.dispatchEvent(new Event('change'));detail.scrollIntoView?.({block:'nearest',behavior:'smooth'})};
     list.append(button);
   }
   if(!dossiers.length){const empty=document.createElement('p');empty.textContent='Aucun dossier reçu pour le moment.';list.append(empty)}
   wrap.before(registry);
   if(path==='/admin/messages'){
    registry.querySelector('h2').textContent='Boîte de réception · '+inbox.length+' conversation(s)';
    detail.hidden=true;
    if(composerPanel){composerPanel.hidden=true;composerPanel.style.display='none'}
    helper.textContent='En orange : le dernier message provient du client et attend votre réponse. Un message reste à traiter même après lecture, jusqu’à ce que vous répondiez.';
    list.replaceChildren();
    select.replaceChildren(new Option('Choisir une conversation client',''));
    for(const c of inbox){
      select.add(new Option(c.reference+' — '+c.contact,c.dossier_id));
      if(!dossiers.some(x=>x.id===c.dossier_id)){
        dossiers.push({id:c.dossier_id,reference:c.reference,contact:c.contact,email:c.email,statut:c.statut,details:{}});
      }
      const needsReply=c.dernier_auteur==='client';
      const card=document.createElement('button');card.type='button';card.className='btn dark small meca-inbox-conversation';card.dataset.dossier=c.dossier_id;
      card.style.cssText='text-align:left;display:flex;gap:14px;align-items:center;width:100%;padding:16px;border-radius:12px;white-space:normal;border:2px solid '+(needsReply?'#ffa23c':'#4b6279')+';background:'+(needsReply?'#4a2c1b':'#1d2b38')+';color:white';
      const body=document.createElement('div');body.style.cssText='flex:1;min-width:0';
      const title=document.createElement('strong');title.textContent=(c.non_lus?'● NON LU · ':needsReply?'● À TRAITER · ':'')+c.reference+' — '+c.contact;
      const excerpt=document.createElement('div');excerpt.textContent=c.extrait||'Message disponible';excerpt.style.cssText='font-weight:normal;opacity:.92;margin:7px 0;overflow-wrap:anywhere';
      const time=document.createElement('small');time.textContent=c.dernier_message?new Date(c.dernier_message).toLocaleString('fr-FR'):'';
      body.append(title,excerpt,time);card.append(body);
      if(Number(c.non_lus)>0){const unread=document.createElement('strong');unread.textContent=String(c.non_lus)+' nouveau(x)';unread.style.cssText='background:#f5a142;border-radius:15px;padding:6px 10px;color:#1b1b1b';card.append(unread)}
      card.onclick=()=>{select.value=c.dossier_id;select.dispatchEvent(new Event('change'));wrap.scrollIntoView?.({block:'start',behavior:'smooth'})};
      list.append(card);
    }
    if(!inbox.length){const empty=document.createElement('p');empty.textContent='Aucune conversation client pour le moment.';list.append(empty)}
    wrap.style.cssText='margin:16px 0;border:2px solid #6884a3;padding:18px;background:#1a2530';
    wrap.hidden=true;
    registry.append(wrap);
   }

   // Conversation = historique + une proposition prête à envoyer, sans plusieurs formulaires redondants.
   const assessmentPanel=document.createElement('section');assessmentPanel.className='panel';assessmentPanel.style.cssText='border:1px solid #be945a;padding:17px;margin:10px 0 14px';
   if(path==='/admin/messages')assessmentPanel.hidden=true;
   const assessmentTitle=document.createElement('h3');assessmentTitle.textContent='Bilan IA — formule définitive du dossier';
   const assessmentBody=document.createElement('div');assessmentBody.style.cssText='white-space:pre-wrap;line-height:1.65';
   assessmentPanel.append(assessmentTitle,assessmentBody);wrap.insertBefore(assessmentPanel,history);
   const conversationTitle=document.createElement('h2');conversationTitle.textContent='Conversation avec le client';wrap.insertBefore(conversationTitle,history);
   const quotePanel=document.createElement('section');quotePanel.className='panel meca-simple-proposal';quotePanel.style.cssText='margin-top:14px;border:1px solid #b07c3b;padding:18px';
   const quoteHeader=document.createElement('h3');quoteHeader.textContent='Ma proposition de recherche';quotePanel.append(quoteHeader);
   const quoteHelp=document.createElement('p');quoteHelp.className='muted';quoteHelp.textContent='L’IA prépare un message à partir du dossier. Relisez-le, adaptez-le avec vos mots, puis envoyez. Votre client choisira lui-même les options Express 48 h (+20 €), Express 24 h (+50 €) et demande de réservation 24 h (+10 €) au moment d’accepter le devis.';quotePanel.append(quoteHelp);
   const planLabel=document.createElement('label');planLabel.textContent='Formule proposée';
   const planSelect=document.createElement('select');planSelect.id='meca-quote-plan';const pendingOption=document.createElement('option');pendingOption.value='';pendingOption.textContent='Analyse du dossier en cours…';planSelect.append(pendingOption);
   for(const [key,name] of [['ciblee','Recherche ciblée — 39 € · 3 jours ouvrés'],['approfondie','Recherche approfondie — 79 € · 5 jours ouvrés'],['expert','Investigation Expert — 149 € · 7 jours ouvrés']]){const option=document.createElement('option');option.value=key;option.textContent=name;planSelect.append(option)}
   planLabel.append(planSelect);quotePanel.append(planLabel);planSelect.disabled=true;
   const titleLabel=document.createElement('label');titleLabel.textContent='Civilité (ne pas deviner à partir du nom)';
   const titleSelect=document.createElement('select');
   for(const [value,label] of [['','Madame, Monsieur (si inconnue)'],['Monsieur','Monsieur'],['Madame','Madame']]){const o=document.createElement('option');o.value=value;o.textContent=label;titleSelect.append(o)}
   titleLabel.append(titleSelect);quotePanel.append(titleLabel);
   const aiPanel=document.createElement('div');aiPanel.style.cssText='padding:10px 0';
   const aiBtn=document.createElement('button');aiBtn.type='button';aiBtn.className='btn dark';aiBtn.textContent='↻ Préparer / actualiser avec l’IA';
   const aiStatus=document.createElement('p');aiStatus.setAttribute('role','status');aiStatus.className='muted';
   const aiOutput=document.createElement('details');aiOutput.innerHTML='<summary>Voir les conseils techniques privés de l’IA</summary>';
   const aiDetails=document.createElement('pre');aiDetails.style.cssText='white-space:pre-wrap;font:inherit;line-height:1.6;max-height:400px;overflow:auto';aiOutput.append(aiDetails);
   aiPanel.append(aiBtn,aiStatus,aiOutput);quotePanel.append(aiPanel);
   const personalLabel=document.createElement('label');personalLabel.textContent='Message au client (modifiable avant envoi)';
   const personal=document.createElement('textarea');personal.rows=11;personal.maxLength=2600;personal.style.cssText='display:block;width:100%;line-height:1.65;padding:12px';personal.placeholder='L’IA prépare automatiquement votre proposition ici. Vous pouvez tout réécrire avant de l’envoyer.';
   personalLabel.append(personal);quotePanel.append(personalLabel);
   const priceInfo=document.createElement('p');priceInfo.className='muted';quotePanel.append(priceInfo);
   const optionPreview=document.createElement('section');optionPreview.style.cssText='padding:12px 15px;border:1px solid #555;border-radius:9px;margin:12px 0';
   optionPreview.innerHTML='<h4>Formulaire que le client verra SOUS votre signature</h4><p>Choix obligatoire du délai : ◯ Sans Express (0 €) &nbsp; ◯ 48 h (+20 €) &nbsp; ◯ 24 h (+50 €)</p><p>Réservation fournisseur 24 h : ◯ Oui (10 € au solde uniquement si réservation confirmée) &nbsp; ◯ Non (0 €)</p><p>☐ Conditions générales acceptées</p><p><b>Boutons :</b> Confirmer mon devis et payer / Refuser le devis</p><p class="muted">Aucune option n’est précochée. Seul le supplément Express est payé avec l’acompte ; la réservation est facturée uniquement au solde si elle est confirmée. Cette partie n’est pas à rédiger dans votre message.</p>';
   quotePanel.append(optionPreview);
   const quoteButton=document.createElement('button');quoteButton.type='button';quoteButton.className='btn orange';quoteButton.textContent='Envoyer ma proposition au client';quotePanel.append(quoteButton);
   const proposalStatus=document.createElement('p');proposalStatus.setAttribute('role','status');quotePanel.append(proposalStatus);
   const reviseButton=document.createElement('button');reviseButton.type='button';reviseButton.className='btn dark';reviseButton.textContent='✎ Modifier le devis';reviseButton.style.marginLeft='10px';reviseButton.hidden=true;quoteButton.after(reviseButton);
   const revisionPanel=document.createElement('section');revisionPanel.hidden=true;revisionPanel.style.cssText='margin-top:14px;padding:17px;border:2px solid #eda04b;border-radius:12px;background:#2d261d';
   const revisionTitle=document.createElement('h3');revisionTitle.textContent='Nouvelle proposition commerciale';

   const revisionHelp=document.createElement('p');revisionHelp.className='muted';
   revisionHelp.textContent='Choisissez une autre formule Mécascope ou créez un tarif commercial personnalisé. L’intitulé de la formule actuelle est conservé pour une remise personnalisée. Les options Express et réservation restent au choix du client.';
   const revisionModeLabel=document.createElement('label');revisionModeLabel.textContent='Type de nouvelle proposition';
   const revisionChoice=document.createElement('select');revisionChoice.style.cssText='display:block;width:100%;max-width:580px;margin-top:7px;padding:10px;border-radius:7px';
   for(const [v,label] of [['formule','Choisir une formule Mécascope existante'],['personnalise','Nouvelle offre commerciale personnalisée (conserver la formule actuelle)']]){
     const opt=document.createElement('option');opt.value=v;opt.textContent=label;revisionChoice.append(opt)
   }
   revisionModeLabel.append(revisionChoice);
   const revisionOfferLabel=document.createElement('label');revisionOfferLabel.textContent='Formule Mécascope';
   const revisionOffer=document.createElement('select');revisionOffer.style.cssText='display:block;width:100%;max-width:580px;margin-top:7px;padding:10px;border-radius:7px';
   for(const [v,label] of [['ciblee','Recherche ciblée — 39 € (acompte 19 €)'],['approfondie','Recherche approfondie — 79 € (acompte 39 €)'],['expert','Investigation Expert — 149 € (acompte 69 €)']]){
     const opt=document.createElement('option');opt.value=v;opt.textContent=label;revisionOffer.append(opt)
   }
   revisionOfferLabel.append(revisionOffer);
   revisionOfferLabel.style.cssText='display:block;margin-top:12px';revisionModeLabel.style.cssText='display:block;margin-top:12px';
   const revisionFields=document.createElement('div');revisionFields.style.cssText='display:flex;gap:15px;flex-wrap:wrap;margin-top:10px';
   const revisionTotalLabel=document.createElement('label');revisionTotalLabel.textContent='Nouveau prix de base (€)';
   const revisionTotal=document.createElement('input');revisionTotal.type='number';revisionTotal.step='0.01';revisionTotal.min='2';revisionTotal.max='2000';revisionTotal.style.cssText='display:block;min-width:120px;padding:9px;margin-top:5px';
   revisionTotalLabel.append(revisionTotal);
   const revisionDepositLabel=document.createElement('label');revisionDepositLabel.textContent='Acompte (€)';
   const revisionDeposit=document.createElement('input');revisionDeposit.type='number';revisionDeposit.step='0.01';revisionDeposit.min='1';revisionDeposit.style.cssText='display:block;min-width:120px;padding:9px;margin-top:5px';
   revisionDepositLabel.append(revisionDeposit);
   revisionFields.append(revisionTotalLabel,revisionDepositLabel);
   const revisionBalance=document.createElement('p');revisionBalance.style.cssText='font-weight:700;color:#ffcb86;margin:13px 0';
   const revisionOptions=document.createElement('p');revisionOptions.className='muted';
   revisionOptions.textContent='Options facultatives inchangées : Express 48 h (+20 €) ou Express 24 h (+50 €), à ajouter à l’acompte uniquement si le client le choisit ; réservation fournisseur 24 h (+10 €), facturée au solde uniquement si effectivement confirmée.';
   const revisionMessageLabel=document.createElement('label');revisionMessageLabel.textContent='Message complet envoyé au client — modifiable avant envoi';
   revisionMessageLabel.style.cssText='display:block;font-weight:bold;margin:16px 0 6px';
   const revisionMessage=document.createElement('textarea');revisionMessage.rows=19;revisionMessage.maxLength=2800;
   revisionMessage.style.cssText='width:100%;box-sizing:border-box;min-height:370px;padding:15px;color:#17232e;background:#fff;border:1px solid #e9a455;border-radius:9px;line-height:1.65;font:inherit;white-space:pre-wrap';
   const revisionCount=document.createElement('small');revisionCount.className='muted';
   const previewHeading=document.createElement('h4');previewHeading.textContent='Aperçu exact du texte de la proposition';
   const revisionPreview=document.createElement('div');revisionPreview.style.cssText='background:#fff;color:#222;padding:18px;border-radius:10px;border-left:4px solid #eda04b;white-space:pre-wrap;line-height:1.65;overflow-wrap:anywhere;margin-bottom:12px';
   const formPreview=document.createElement('div');formPreview.style.cssText='background:#202a32;color:#e9edf0;padding:14px;border-radius:9px;line-height:1.8';
   formPreview.textContent='Sous ce message, le client choisit : délai normal (0 €), Express 48 h (+20 €), Express 24 h (+50 €) ; réservation fournisseur 24 h : oui (+10 € si confirmée) / non. Puis il accepte ou refuse le devis. Ces options ne sont pas précochées.';
   const regenerate=document.createElement('button');regenerate.type='button';regenerate.className='btn dark';regenerate.textContent='↻ Recréer le message type';regenerate.style.marginBottom='14px';
   const sendRevision=document.createElement('button');sendRevision.type='button';sendRevision.className='btn orange';sendRevision.textContent='Envoyer cette nouvelle proposition';
   const cancelRevision=document.createElement('button');cancelRevision.type='button';cancelRevision.className='btn dark';cancelRevision.textContent='Annuler';cancelRevision.style.marginLeft='10px';
   const revisionStatus=document.createElement('p');revisionStatus.setAttribute('role','status');
   revisionPanel.append(revisionTitle,revisionHelp,revisionModeLabel,revisionOfferLabel,revisionFields,revisionBalance,revisionOptions,revisionMessageLabel,revisionMessage,revisionCount,previewHeading,revisionPreview,formPreview,regenerate,document.createElement('hr'),sendRevision,cancelRevision,revisionStatus);
   quotePanel.append(revisionPanel);
   let revisionMode=false;
   const euroCents=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100):NaN};
   const fmtEuro=n=>(n/100).toLocaleString('fr-FR',{maximumFractionDigits:2})+' €';
   const selectedRevisionPlan=()=>plans[revisionOffer.value]||plans.approfondie;
   function revisionAmounts(){
     if(revisionChoice.value==='formule'){
       const p=selectedRevisionPlan();
       revisionTotal.value=String(p.price);revisionDeposit.value=String(p.initial);
       revisionTotal.disabled=true;revisionDeposit.disabled=true;
     }else{revisionTotal.disabled=false;revisionDeposit.disabled=false}
     const total=euroCents(revisionTotal.value),deposit=euroCents(revisionDeposit.value);
     revisionBalance.textContent=Number.isSafeInteger(total)&&Number.isSafeInteger(deposit)&&total>deposit&&deposit>0?
       'Prix de base : '+fmtEuro(total)+' · Acompte : '+fmtEuro(deposit)+' · Solde si réussite : '+fmtEuro(total-deposit):
       'Vérifiez le total et l’acompte (inférieur au prix de base).';
   }
   function revisionDraft(){
     const row=dossiers.find(x=>x.id===select.value);if(!row)return '';
     const p=revisionChoice.value==='formule'?selectedRevisionPlan():(plans[row.offre]||plans.approfondie);
     const total=euroCents(revisionTotal.value),deposit=euroCents(revisionDeposit.value);
     if(!Number.isSafeInteger(total)||!Number.isSafeInteger(deposit)||deposit>=total)return '';
     const dt=row.details||{};
     const vehicle=[dt.brand,dt.model,dt.year].filter(Boolean).join(' ');
     const part=String(dt.part||'la pièce demandée');
     const ref=dt.ref?' (référence '+dt.ref+')':'';
     return [
       greeting(row),
       '',
       'Suite à nos échanges, nous avons révisé notre devis concernant votre dossier '+row.reference+'. Nous souhaitons vous proposer une nouvelle proposition commerciale mieux adaptée à votre demande.',
       '',
       'Votre recherche concerne '+part+ref+(vehicle?' pour votre '+vehicle:'')+'.',
       '',
       'Notre prestation comprend toujours la vérification des références exactes et de la compatibilité de la pièce, ainsi que la recherche et la confirmation de sa disponibilité auprès de fournisseurs adaptés, en France ou à l’étranger lorsque cela est nécessaire.',
       '',
       'Voici le nouveau devis proposé :',
       'Formule : '+p.name,
       'Nouveau prix de base : '+fmtEuro(total),
       'Acompte à régler pour lancer la recherche : '+fmtEuro(deposit),
       'Solde à régler uniquement en cas de recherche réussie : '+fmtEuro(total-deposit),
       'Délai de recherche normal : '+p.days+' jours ouvrés après paiement initial et réception des informations nécessaires.',
       '',
       'Les options facultatives restent inchangées et sont à votre choix :',
       '• Express 48 h : +20 € avec l’acompte ;',
       '• Express 24 h : +50 € avec l’acompte ;',
       '• Réservation de la pièce 24 h auprès du fournisseur : +10 €, uniquement au solde si une réservation est réellement confirmée.',
       '',
       'Ces options ne sont pas précochées : vous choisissez vous-même celles que vous souhaitez avant d’accepter le devis. Aucun supplément de réservation ne sera encaissé à l’avance.',
       ...(!String(dt.budget??'').trim()?['','Sans budget maximal déclaré pour l’achat de la pièce, une offre compatible, disponible et à prix fournisseur vérifié pourra valider la mission de recherche ; l’achat de la pièce restera entièrement facultatif. Cette condition doit être expressément acceptée.']:[]),
       '',
       'Cette proposition révisée remplace notre devis précédent. Vous restez libre de l’accepter ou de la refuser sans engagement.',
       '',
       'Cordialement,',
       'L’équipe Mécascope'
     ].join('\n');
   }
   const updateRevisionPreview=()=>{
     revisionPreview.textContent=revisionMessage.value||'Le message à envoyer s’affichera ici.';
     revisionCount.textContent=revisionMessage.value.length+' / 2 800 caractères';
   };
   const regenerateRevision=()=>{revisionMessage.value=revisionDraft();updateRevisionPreview()};
   revisionMessage.addEventListener('input',updateRevisionPreview);
   regenerate.onclick=regenerateRevision;
   revisionChoice.onchange=()=>{
     const current=dossiers.find(x=>x.id===select.value);
     revisionOffer.value=revisionChoice.value==='personnalise'?(current?.offre||'approfondie'):revisionOffer.value;
     revisionOffer.disabled=revisionChoice.value==='personnalise';
     revisionOfferLabel.style.opacity=revisionOffer.disabled?'.7':'1';
     revisionAmounts();regenerateRevision();
   };
   revisionOffer.onchange=()=>{revisionAmounts();regenerateRevision()};
   revisionTotal.oninput=()=>{revisionAmounts();regenerateRevision()};
   revisionDeposit.oninput=()=>{revisionAmounts();regenerateRevision()};
   reviseButton.onclick=()=>{
     const d=dossiers.find(x=>x.id===select.value);
     if(!d||d.initial_paid_at||!['devis_envoye','refuse'].includes(d.statut)||d.devis_decision==='accepte')return;
     revisionMode=true;revisionPanel.hidden=false;reviseButton.hidden=true;quoteButton.hidden=true;
     personalLabel.hidden=true;aiPanel.hidden=true;optionPreview.hidden=true;priceInfo.hidden=true;
     personal.disabled=true;
     const original=plans[d.offre]||plans.approfondie;
     revisionChoice.value=d.devis_total_personnalise_centimes?'personnalise':'formule';
     revisionOffer.value=d.offre;
     revisionOffer.disabled=revisionChoice.value==='personnalise';
     revisionTotal.value=String(d.devis_total_personnalise_centimes?d.devis_total_personnalise_centimes/100:original.price);
     revisionDeposit.value=String(d.devis_acompte_personnalise_centimes?d.devis_acompte_personnalise_centimes/100:original.initial);
     revisionAmounts();regenerateRevision();
     revisionStatus.textContent='Relisez le texte complet, modifiez-le si nécessaire puis envoyez le nouveau devis.';
     revisionPanel.scrollIntoView?.({block:'start',behavior:'smooth'});
   };
   cancelRevision.onclick=()=>{revisionMode=false;revisionPanel.hidden=true;showOptions()};
   sendRevision.onclick=async()=>{
     const d=dossiers.find(x=>x.id===select.value);
     if(!d||d.initial_paid_at)return;
     const total=euroCents(revisionTotal.value),deposit=euroCents(revisionDeposit.value);
     if(!Number.isSafeInteger(total)||!Number.isSafeInteger(deposit)||total<200||total>200000||deposit<100||deposit>=total){revisionStatus.textContent='Montants invalides : vérifiez le total et l’acompte.';return}
     const message=revisionMessage.value.trim();
     for(const required of [d.reference,fmtEuro(total),fmtEuro(deposit),fmtEuro(total-deposit),'48 h','24 h','10 €']){
       if(!message.includes(required)){revisionStatus.textContent='Le message doit conserver les informations essentielles : '+required;return}
     }
     if(message.length<80||message.length>2800){revisionStatus.textContent='Le message doit faire entre 80 et 2 800 caractères.';return}
     if(!confirm('Remplacer le précédent devis de '+d.reference+' par une nouvelle proposition de '+fmtEuro(total)+' (acompte '+fmtEuro(deposit)+') et l’envoyer au client ?'))return;
     sendRevision.disabled=true;revisionStatus.textContent='Envoi de la nouvelle proposition…';
     try{
       const result=await call({action:'revise_quote',id:d.id,pricingMode:revisionChoice.value,offre:revisionChoice.value==='formule'?revisionOffer.value:d.offre,proposal:message,totalCentimes:total,depositCentimes:deposit});
       revisionStatus.textContent=result.message||'Devis révisé transmis au client.';
       await syncDemandesAfterAction(d.id);
     }catch(e){revisionStatus.textContent=e.message}
     finally{sendRevision.disabled=false}
   };

   const failButton=document.createElement('button');failButton.type='button';failButton.className='btn danger';failButton.textContent='Clôturer la recherche sans résultat';failButton.hidden=true;quotePanel.append(failButton);
   wrap.append(quotePanel);
   if(path==='/admin/messages')quotePanel.hidden=true;
   const chatPanel=document.createElement('div');chatPanel.style.cssText='margin-top:18px;padding:18px;background:#182e40;border:1px solid #6a9cc7;border-radius:12px';
   const chatHeading=document.createElement('h3');chatHeading.textContent='✉ Répondre au client (sans devis)';chatPanel.append(chatHeading);
   const chatInput=document.createElement('textarea');chatInput.rows=3;chatInput.maxLength=3000;chatInput.placeholder='Une question ou un complément pour le client…';chatInput.style.cssText='width:100%;padding:12px;min-height:95px;border-radius:9px;background:#f7fafc;color:#1d2833;border:1px solid #adc3d8';
   const chatButton=document.createElement('button');chatButton.type='button';chatButton.className='btn orange';chatButton.textContent='Envoyer ma réponse au client';
   const chatStatus=document.createElement('p');chatStatus.setAttribute('role','status');chatPanel.append(chatInput,chatButton,chatStatus);wrap.append(chatPanel);
   const plans={ciblee:{price:39,initial:19,solde:20,days:3,name:'Recherche ciblée'},approfondie:{price:79,initial:39,solde:40,days:5,name:'Recherche approfondie'},expert:{price:149,initial:69,solde:80,days:7,name:'Investigation Expert'}};
   const dossierName=row=>String(row?.contact||'').trim();
   const countryByBrand={volkswagen:'Allemagne',audi:'Allemagne',bmw:'Allemagne',mercedes:'Allemagne',opel:'Allemagne',porsche:'Allemagne',renault:'France',peugeot:'France',citroen:'France',citroën:'France',fiat:'Italie',alfa:'Italie',seat:'Espagne',skoda:'République tchèque',škoda:'République tchèque',toyota:'Japon',nissan:'Japon',honda:'Japon',volvo:'Suède',saab:'Suède',hyundai:'Corée du Sud',kia:'Corée du Sud',ford:'États-Unis',chevrolet:'États-Unis'};
   const greeting=row=>titleSelect.value
     ?'Bonjour '+titleSelect.value+(dossierName(row)?' '+dossierName(row):'')+','
     :'Bonjour Madame, Monsieur'+(dossierName(row)?' '+dossierName(row):'')+',';
   const abroad=row=>{const brand=String(row?.details?.brand||'').toLocaleLowerCase('fr-FR').trim();const country=countryByBrand[brand];return country&&country!=='France'?'Si les premières pistes françaises ne suffisent pas, je pourrai également solliciter des fournisseurs en '+country+', pays historiquement lié à la marque '+String(row?.details?.brand||'')+'. Cela reste une piste de recherche, sans garantie de disponibilité ni d’origine de la pièce.':'Je commencerai par des pistes françaises et, si cette référence est difficile à trouver, j’élargirai la recherche à des fournisseurs étrangers appropriés.'};
   let draftDirty=false;personal.addEventListener('input',()=>{draftDirty=true});
   function defaultDraft(row,formule){
    const p=plans[formule]||plans.approfondie,d=row?.details||{};
    const vehicle=[d.brand,d.model,d.year].filter(Boolean).join(' ');
    const part=String(d.part||'la pièce demandée');
    const reference=d.ref?(' (référence '+d.ref+')'):'';
    return [
      greeting(row),
      '',
      'J’ai étudié votre demande concernant '+part+reference+(vehicle?' pour votre '+vehicle:'')+'.',
      '',
      'Je vais d’abord vérifier les références exactes et la compatibilité pour éviter de vous orienter vers une mauvaise pièce. Il faudra également confirmer les stocks réels auprès de fournisseurs adaptés.',
      '',
      abroad(row),
      '',
      ...(String(row?.telephone||'').trim()?[]:['Afin de pouvoir vous joindre rapidement si un fournisseur répond ou si une précision est nécessaire, pourriez-vous également me communiquer un numéro de téléphone ?','']),
      ...(String(d.budget??'').trim()?[]:['Vous n’avez pas fixé de budget maximal pour l’achat de la pièce. Je pourrai donc examiner les offres fournisseurs sans plafond de prix. Si je trouve une pièce compatible, réellement disponible, avec un prix fournisseur vérifié, ma mission de recherche sera considérée comme réussie, quel que soit ce prix, et le solde de la prestation sera dû selon le devis. Vous resterez libre d’acheter ou non la pièce : aucun achat ne sera effectué sans votre accord.','']),
      'Compte tenu de ces vérifications, je vous propose la formule '+p.name+' à '+p.price+' €, avec un délai de '+p.days+' jours ouvrés après acceptation, paiement initial et réception des informations nécessaires.',
      '',
      'Vous pourrez choisir sous ce message une recherche Express en 48 h (+20 €) ou en 24 h (+50 €). Cette option se règle à l’avance avec l’acompte : si le délai convenu n’est pas tenu, son supplément sera remboursé. Vous pourrez demander une réservation de la pièce pendant 24 h auprès du fournisseur (+10 €), sans la payer avec l’acompte : elle ne sera ajoutée au solde que si une réservation est effectivement confirmée par le fournisseur.',
      '',
      'Vous restez libre de votre choix.',
      '',
      'Cordialement,',
      'L’équipe Mécascope'
    ].join('\n');
   }
   function buildProposal(){
     const row=dossiers.find(x=>x.id===select.value);
     if(row?.statut==='devis_envoye'&&row.proposition_texte)return row.proposition_texte;
     return 'Dossier '+(row?.reference||'à sélectionner')+'\n\n'+personal.value.trim();
   }
   function setPriceInfo(){const p=plans[planSelect.value]||plans.ciblee;priceInfo.textContent='Formule '+p.price+' € : acompte '+p.initial+' € + solde '+p.solde+' € si recherche aboutie. Options : Express 48 h (+20 €) ou 24 h (+50 €) payé avec l’acompte ; réservation 24 h (+10 €) ajoutée au solde seulement si elle est confirmée.'}
   function renderAssessment(q){
     if(!q||!plans[q.formule]){assessmentBody.textContent='Analyse en attente. Aucun prix provisoire ne peut être transmis au client.';quoteButton.disabled=true;return}
     const p=plans[q.formule];planSelect.value=q.formule;planSelect.disabled=true;
     assessmentBody.textContent='Formule retenue : '+p.name+' — '+p.price+' €'
       +'\nDélai prévu : '+p.days+' jours ouvrés'
       +'\nAcompte : '+p.initial+' € · Solde en cas de réussite : '+p.solde+' €'
       +'\nDifficulté : '+(q.difficulte||'évaluation à confirmer')
       +'\nAnalyse / justification : '+(q.justification||'références et compatibilité à vérifier')
       +'\nPoints sensibles : '+(Array.isArray(q.risques)?q.risques.join(' ; '):q.risques||'à vérifier')
       +'\nRecherche : en France, et auprès de fournisseurs étrangers si le dossier le justifie.'
       +'\n\nCe tarif est enregistré pour ce dossier. Une nouvelle analyse ne peut pas le remplacer automatiquement.';
     quoteButton.disabled=false;setPriceInfo();
   }
   let currentAiDossier=null;
   async function analyzeCurrent(force=false){
     const row=dossiers.find(x=>x.id===select.value);if(!row||row.type_dossier==='professionnel'||!['deposee','devis_envoye'].includes(row.statut))return;
     const id=row.id;
     if(!force&&currentAiDossier===id)return;
     if(row.qualification_ia?.formule){renderAssessment(row.qualification_ia);return}
     currentAiDossier=id;aiBtn.disabled=true;aiStatus.textContent='L’IA examine la demande et prépare une réponse…';
     try{
       const r=await fetch('/api/qualification',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,contact:row.contact||'',civilite:titleSelect.value||null}),cache:'no-store'});
       const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.message||'Analyse indisponible');
       if(select.value!==id)return;
       const q=data.qualification||{},key=q.formule;
       if(!plans[key])throw Error('Formule IA invalide : envoi bloqué');
       row.qualification_ia=q;renderAssessment(q);
       if(row.statut==='deposee'&&!draftDirty){
         const text=String(q.message_client||'').trim();
         // Le tarif affiché et le message sont toujours le même : une suggestion hors tarif est rejetée.
         const exact=String(plans[key].price)+' €';
         const draft=text.length>75&&text.includes(exact)?text:defaultDraft(row,key);
         const heading=greeting(row);
         const telephoneManquant=!String(row.telephone||'').trim();
         const budgetManquant=!String(row.details?.budget??'').trim();
         const first=draft.replace(/^Bonjour[^\n]*/,heading)
           .replace(/\s*Vous restez libre de votre choix\.[\s\S]*$/,'')
           .replace(/\s*Cordialement,[\s\S]*$/,'').trimEnd();
         const phoneLine=telephoneManquant?'\n\nPourriez-vous également me communiquer un numéro de téléphone afin de pouvoir vous joindre rapidement si un fournisseur a besoin d’une confirmation ?':'';
         const budgetLine=budgetManquant?'\n\nVous n’avez pas fixé de budget maximal pour la pièce. Toute offre fournisseur conforme, vérifiée et disponible pourra donc valider ma mission de recherche quel que soit son prix, et le solde de la prestation sera dû. Vous garderez le choix d’acheter ou non la pièce ; aucun achat ne sera effectué sans votre accord.':'';
         personal.value=first+phoneLine+budgetLine+'\n\nVous restez libre de votre choix.\n\nCordialement,\nL’équipe Mécascope';
       }
       aiDetails.textContent='Difficulté : '+(q.difficulte||'à préciser')+'\nPourquoi cette formule : '+(q.justification||'à vérifier')+'\nRisques / contrôles : '+(Array.isArray(q.risques)?q.risques.join(' ; '):q.risques||'à vérifier')+'\nInformations utiles : '+(Array.isArray(q.questions_client)?q.questions_client.join(' ; '):'—')+'\nPistes de recherche : '+(Array.isArray(q.pistes_recherche)?q.pistes_recherche.join(' ; '):'—');
       aiStatus.textContent='Proposition IA préparée. Vous pouvez modifier librement le message et la formule ; rien n’a été envoyé.';
       setPriceInfo();
     }catch(e){if(select.value===id){aiStatus.textContent='IA indisponible : '+e.message+' — vous pouvez utiliser et modifier le brouillon déjà préparé.';currentAiDossier=null}}
     finally{aiBtn.disabled=false}
   }
   aiBtn.onclick=()=>{
     const row=dossiers.find(x=>x.id===select.value);
     if(row?.qualification_ia?.formule){renderAssessment(row.qualification_ia);aiStatus.textContent='La recommandation est figée : aucune nouvelle estimation de prix n’est lancée.';return}
     analyzeCurrent(true);
   };
   titleSelect.onchange=()=>{
     if(draftDirty){proposalStatus.textContent='Civilité modifiée : corrigez seulement la salutation si vous avez déjà personnalisé le texte.';return}
     const row=dossiers.find(x=>x.id===select.value);if(row&&row.statut==='deposee'){personal.value=personal.value.replace(/^Bonjour[^\\n]*/,greeting(row))}
   };
   chatButton.onclick=async()=>{
     const row=dossiers.find(x=>x.id===select.value),message=chatInput.value.trim();
     if(!row||!message){chatStatus.textContent='Choisissez un dossier et écrivez votre message.';return}
     if(!confirm('Envoyer ce message au client dans son espace de suivi ?'))return;
     chatButton.disabled=true;
     try{const response=await call({action:'chat',id:row.id,message});chatInput.value='';chatStatus.textContent=response.message||'Message enregistré.';await refreshHistory();if(path==='/admin/messages'){const selected=main.querySelector('.meca-messages-layout [data-dossier="'+row.id+'"]');if(selected)selected.click()}}
     catch(e){chatStatus.textContent=e.message}finally{chatButton.disabled=false}
   };
   form.insertAdjacentHTML('beforeend','<label class="wide"><input type="checkbox" name="expressEligible"> Délai Express tenu et éligible au supplément prévu</label><label class="wide"><input type="checkbox" name="reservationConfirmed"> Réservation fournisseur effectivement confirmée</label>');

   function showOptions(){
     const row=dossiers.find(x=>x.id===select.value),existing=row?.statut==='devis_envoye';
     quotePanel.hidden=path==='/admin/messages'||!row||!['deposee','devis_envoye','acompte_paye','refuse'].includes(row.statut);
     revisionMode=false;revisionPanel.hidden=true;
     personalLabel.hidden=false;aiPanel.hidden=false;optionPreview.hidden=false;priceInfo.hidden=false;
     reviseButton.hidden=!row||!!row.initial_paid_at||!['devis_envoye','refuse'].includes(row.statut)||row.devis_decision==='accepte';
     if(compactDemandes&&composerPanel){const show=!!(row?.initial_paid_at);composerPanel.hidden=!show;composerPanel.style.display=show?'':'none'}
     quoteButton.hidden=!row||!['deposee','devis_envoye'].includes(row.statut)||(existing&&row.devis_decision!=='en_attente');
     failButton.hidden=!row||row.statut!=='acompte_paye';
     personal.disabled=existing||row?.statut==='refuse';planSelect.disabled=true;
     quoteButton.textContent=existing?'Renvoyer le même devis':'Envoyer ma proposition au client';
     draftDirty=false;
     const key=row?.qualification_ia?.formule||row?.offre;
     planSelect.value=key&&plans[key]?key:'';
     personal.value=(existing||row?.statut==='refuse')?(row.proposition_texte||''):(row&&key&&plans[key]?defaultDraft(row,key):'');
     proposalStatus.textContent='';aiDetails.textContent='';aiStatus.textContent='';currentAiDossier=null;
     if(row?.devis_total_personnalise_centimes){priceInfo.textContent='DEVIS RÉVISÉ : total '+(row.devis_total_personnalise_centimes/100).toLocaleString('fr-FR')+' € · acompte '+(row.devis_acompte_personnalise_centimes/100).toLocaleString('fr-FR')+' € · solde '+((row.devis_total_personnalise_centimes-row.devis_acompte_personnalise_centimes)/100).toLocaleString('fr-FR')+' €. Les options Express éventuelles restent facultatives.'}
     if(row?.qualification_ia?.formule)renderAssessment(row.qualification_ia);
     else if(row?.statut==='deposee'){renderAssessment(null);analyzeCurrent()}
     else{assessmentBody.textContent='Aucune qualification disponible pour ce dossier.';quoteButton.disabled=true}
   }
   quoteButton.onclick=async()=>{
     const row=dossiers.find(x=>x.id===select.value);if(!row)return;
     const fixed=row.qualification_ia?.formule;
     if(!fixed||fixed!==planSelect.value){proposalStatus.textContent='Le tarif n’est pas cohérent avec le bilan IA enregistré. Envoi bloqué.';return}
     const message=buildProposal();
     const negotiated=Number.isInteger(row.devis_total_personnalise_centimes)?row.devis_total_personnalise_centimes/100:plans[fixed].price;
     const requiredPrice=negotiated.toLocaleString('fr-FR',{maximumFractionDigits:2})+' €';
     if(!message.includes(requiredPrice)){proposalStatus.textContent='Le message doit contenir le tarif exact enregistré : '+requiredPrice+'. Corrigez la proposition avant envoi.';return}
     if(message.length<80||message.length>2800){proposalStatus.textContent='Vérifiez votre message (80 à 2 800 caractères, référence comprise).';return}
     if(!confirm('Envoyer votre proposition de '+(negotiated||'—')+' € à '+(row.contact||'ce client')+' avec toutes les options facultatives à sélectionner sur son devis ?'))return;
     quoteButton.disabled=true;proposalStatus.textContent='Envoi de votre proposition…';
     try{const result=await call({action:'quote',id:row.id,offre:planSelect.value,proposal:message});proposalStatus.textContent=result.message||'Devis transmis au client.';await syncDemandesAfterAction(row.id)}
     catch(e){proposalStatus.textContent=e.message}finally{quoteButton.disabled=false}
   };
   failButton.onclick=async()=>{const d=dossiers.find(x=>x.id===select.value);if(!d||!confirm('Clôturer cette recherche comme infructueuse, sans solde à payer ?'))return;
    failButton.disabled=true;try{await call({action:'fail',id:d.id});await call({action:'reply',id:d.id,found:false,message:'Nous vous informons que notre recherche n’a pas permis d’identifier une pièce conforme. Aucun solde de réussite n’est dû. Nous restons à votre disposition pour tout complément.'});status.textContent='Recherche clôturée et client informé.';await syncDemandesAfterAction(d.id)}catch(e){alert(e.message)}finally{failButton.disabled=false}
   };


   history.style.cssText='display:flex;flex-direction:column;gap:14px;min-height:130px;max-height:560px;overflow:auto;padding:18px;background:#111923;border:1px solid #65798b;border-radius:13px;white-space:normal;line-height:1.55';
   async function refreshHistory(){
    history.replaceChildren();
    if(!select.value){history.textContent='Sélectionnez une conversation.';return}
    try{
     const r=await call({action:'messages',id:select.value});
     const messages=Array.isArray(r.messages)?r.messages:[];
     if(!messages.length){history.textContent='Aucun message échangé pour le moment.';return}
     for(const m of messages){
      const client=m.auteur==='client';
      const line=document.createElement('div');line.style.cssText='display:flex;justify-content:'+(client?'flex-start':'flex-end');
      const bubble=document.createElement('article');bubble.style.cssText='max-width:86%;min-width:150px;padding:13px 16px;border-radius:'+(client?'5px 15px 15px 15px':'15px 5px 15px 15px')+';border:1px solid '+(client?'#f5a84d':'#81b5eb')+';background:'+(client?'#493121':'#203e5b')+';color:#fff;box-shadow:0 2px 8px #0004';
      const head=document.createElement('strong');head.textContent=client?'👤 Client':'🔧 Mécascope (vous)';head.style.cssText='display:block;margin-bottom:5px;color:'+(client?'#ffd6a2':'#bfe0ff');
      const body=document.createElement('div');body.textContent=m.contenu;body.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';
      const date=document.createElement('small');date.textContent=m.cree_le?new Date(m.cree_le).toLocaleString('fr-FR'):'';
      date.style.cssText='display:block;margin-top:7px;opacity:.8;text-align:right';
      bubble.append(head,body,date);line.append(bubble);history.append(line);
     }
     history.scrollTop=history.scrollHeight;
    }catch(e){history.textContent='Impossible de charger la conversation : '+e.message}
   }

   if(path==='/admin/demandes')window.mecaPieceHistory?.(main,select,dossiers);
   function openTreatment(id){
    if(!dossiers.some(x=>x.id===id))return;
    select.value=id;
    if(compactDemandes){
      wrap.hidden=false;wrap.style.display='';
      if(composerPanel){const paid=!!dossiers.find(x=>x.id===id)?.initial_paid_at;composerPanel.hidden=!paid;composerPanel.style.display=paid?'':'none'}
      detail.hidden=false;
      if(sendButton){sendButton.hidden=false;status.hidden=false}
    }
    select.dispatchEvent(new Event('change'));
    (compactDemandes?wrap:registry).scrollIntoView?.({block:'start',behavior:'smooth'});
   }
   let sendButton=null;
   select.onchange=async()=>{
    const row=dossiers.find(x=>x.id===select.value);
    form.elements.ref.value=row?.reference||'';
    showDossier(row);showOptions();
    if(path==='/admin/messages'){
      wrap.hidden=!row;
      if(row){
        try{
          await call({action:'mark_read',id:row.id});
          const active=inbox.find(x=>x.dossier_id===row.id);if(active)active.non_lus=0;
          const card=list.querySelector('[data-dossier="'+row.id+'"]');
          if(card){const awaiting=active?.dernier_auteur==='client';card.style.borderColor=awaiting?'#ffa23c':'#4b6279';card.style.background=awaiting?'#4a2c1b':'#1d2b38';const title=card.querySelector('strong');if(title)title.textContent=(awaiting?'● À TRAITER · ':'')+row.reference+' — '+row.contact;const unreadBadge=card.querySelector('strong:last-child');if(unreadBadge&&unreadBadge.textContent.includes('nouveau(x)'))unreadBadge.remove()}
          const waiting=inbox.filter(c=>c.dernier_auteur==='client').length;
          for(const badge of document.querySelectorAll('.meca-inbox-unread-badge'))badge.textContent=waiting?String(waiting):'';
        }catch(e){history.textContent='Lecture non confirmée : '+e.message}
      }
    }
    await refreshHistory();
   };
   // Alimenter le tableau principal attendu dans Gestion des demandes.
   let demandesPage=1, demandesSearch='', demandesStatus='', demandesType='tous', demandesRequest=0;
   async function renderDemandesTable(){
     if(path!=='/admin/demandes')return;
     const table=main.querySelector('#list-content tbody'),host=main.querySelector('#list-content');
     if(!table||!host)return;
     let toolbar=main.querySelector('.meca-demandes-toolbar');
     if(!toolbar){
       toolbar=document.createElement('div');toolbar.className='meca-demandes-toolbar';
       toolbar.style.cssText='display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:14px;background:#1c2935;border-radius:12px;margin:12px 0';
       const search=document.createElement('input');search.type='search';search.placeholder='Rechercher un dossier, client, pièce, référence…';search.setAttribute('aria-label','Rechercher toutes les demandes');
       search.style.cssText='flex:1;min-width:210px;padding:10px';
       const status=document.createElement('select');status.setAttribute('aria-label','Statut des demandes');
       for(const [value,label] of [['tous','Tous les statuts'],['deposee','Nouvelles demandes'],['devis_en_attente','Devis en attente'],['acompte_paye','Acompte payé'],['reussite','Pièce trouvée'],['solde_paye','Terminées payées'],['refuse','Refusées']]){const o=new Option(label,value);status.append(o)}
       const type=document.createElement('select');type.setAttribute('aria-label','Type de client');
       for(const [value,label] of [['tous','Particuliers et professionnels'],['particulier','Particuliers'],['professionnel','Professionnels']])type.append(new Option(label,value));
       const clear=document.createElement('button');clear.type='button';clear.className='btn dark small';clear.textContent='Effacer les filtres';
       const notice=document.createElement('small');notice.className='meca-demandes-total';notice.style.cssText='width:100%;color:#d3dbe5';
       toolbar.append(search,status,type,clear,notice);
       host.prepend(toolbar);
       const requested=new URLSearchParams(location.hash.split('?')[1]||'');
       if(requested.get('filtre')==='devis_en_attente'){demandesStatus='devis_en_attente';status.value='devis_en_attente'}
       let timer;
       search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{demandesSearch=search.value.trim();demandesPage=1;renderDemandesTable().catch(()=>{})},280)});
       status.addEventListener('change',()=>{demandesStatus=status.value;demandesPage=1;renderDemandesTable().catch(()=>{})});
       type.addEventListener('change',()=>{demandesType=type.value;demandesPage=1;renderDemandesTable().catch(()=>{})});
       clear.onclick=()=>{search.value='';status.value='tous';type.value='tous';demandesSearch='';demandesStatus='tous';demandesType='tous';demandesPage=1;renderDemandesTable().catch(()=>{})};
     }
     const request=++demandesRequest;
     const marker=toolbar.querySelector('.meca-demandes-total');
     marker.textContent='Chargement des demandes…';
     try{
       const result=await call({action:'demandes_page',page:demandesPage,size:20,search:demandesSearch,status:demandesStatus||'tous',type:demandesType});
       if(request!==demandesRequest||!main.isConnected)return;
       const items=Array.isArray(result.items)?result.items:[];
       for(const row of items){if(row.type_dossier==='particulier'&&!dossiers.some(d=>d.id===row.id))dossiers.push(row)}
       table.replaceChildren();
       main.querySelectorAll('.meca-demandes-counter,.meca-demandes-empty,.meca-demandes-pagination,.meca-demandes-filter-note').forEach(x=>x.remove());
       const counter=document.createElement('p');counter.className='meca-demandes-counter';
       counter.textContent=Number(d.nouvelles_demandes||0)+' nouvelles demandes particulières · En marron : à traiter · En gris : déjà traitées · Les professionnels ont leur propre statut.';
       toolbar.after(counter);
       for(const row of items){
         const pro=row.type_dossier==='professionnel';
         const tr=document.createElement('tr'),fresh=row.statut==='deposee'||(pro&&['deposee','soumise','en_attente'].includes(row.statut));
         tr.style.cssText='background:'+(fresh?'#4b3320':'#29313b')+';color:#f5f7fa;border-left:4px solid '+(fresh?'#eda34b':'#667784');
         const vehicle=[row.details?.brand,row.details?.model,row.details?.year].filter(Boolean).join(' ')||'—';
         const statut=row.statut==='devis_envoye'&&row.devis_decision==='en_attente'?'Devis envoyé · en attente':row.statut||'—';
         const values=[(pro?'PRO · ':'PART · ')+(row.reference||row.id),row.contact||'—',vehicle,statut,row.cree_le?new Date(row.cree_le).toLocaleString('fr-FR'):'—'];
         for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td)}
         const action=document.createElement('td'),open=document.createElement('button');
         open.type='button';open.className='btn '+(fresh?'orange':'dark')+' small';open.textContent=pro?'Voir la recherche Pro':fresh?'Traiter la nouvelle demande':'Voir le dossier';
         open.onclick=()=>{if(pro){location.hash='#/admin/demandes?source=professionnel&dossier='+encodeURIComponent(row.id)}else openTreatment(row.id)};
         action.append(open);tr.append(action);table.append(tr);
       }
       if(!items.length){const empty=document.createElement('p');empty.className='empty meca-demandes-empty';empty.textContent='Aucune demande ne correspond aux filtres.';host.querySelector('.tablewrap')?.append(empty)}
       const pages=Math.max(1,Number(result.total_pages)||1),total=Math.max(0,Number(result.total)||0);
       marker.textContent=total+' demande(s) correspondante(s) · Page '+demandesPage+' sur '+pages+' · 20 par page';
       const pagination=document.createElement('div');pagination.className='meca-demandes-pagination';pagination.style.cssText='display:flex;gap:12px;justify-content:center;align-items:center;padding:16px';
       const previous=document.createElement('button');previous.type='button';previous.className='btn dark small';previous.textContent='← Précédent';previous.disabled=demandesPage<=1;
       const next=document.createElement('button');next.type='button';next.className='btn dark small';next.textContent='Suivant →';next.disabled=demandesPage>=pages;
       const position=document.createElement('span');position.textContent=demandesPage+' / '+pages;
       previous.onclick=()=>{demandesPage=Math.max(1,demandesPage-1);renderDemandesTable().catch(()=>{})};
       next.onclick=()=>{demandesPage=Math.min(pages,demandesPage+1);renderDemandesTable().catch(()=>{})};
       pagination.append(previous,position,next);host.append(pagination);
     }catch(e){if(request!==demandesRequest)return;marker.textContent='Impossible de récupérer la liste : '+e.message}
   }
   await renderDemandesTable();

   async function syncDemandesAfterAction(id){
     // Synchronisation silencieuse : aucune navigation, aucun rafraîchissement document.
     const current=select.value||id;
     const latest=await call({action:'reporting'});
     if(!main.isConnected)return;
     const updated=Array.isArray(latest.dossiers)?latest.dossiers:[];
     dossiers.splice(0,dossiers.length,...updated);
     for(const row of dossiers){
       let option=[...select.options].find(o=>o.value===row.id);
       if(!option){option=document.createElement('option');option.value=row.id;select.append(option)}
       option.textContent=(row.reference||row.id)+' — '+(row.contact||'Client')+' ('+(row.statut||'')+')';
     }
     for(const option of [...select.options]){
       if(option.value&&!dossiers.some(row=>row.id===option.value))option.remove();
     }
     const badge=document.querySelector('.side a[href="#/admin/demandes"] .meca-demandes-unread');
     if(badge){
       const n=Number(latest.nouvelles_demandes)||0;
       badge.textContent=n?String(n):'';
       badge.hidden=n===0;
     }
     await renderDemandesTable();
     if(dossiers.some(row=>row.id===current)){
       select.value=current;
       showDossier(dossiers.find(row=>row.id===current));
       showOptions();
       await refreshHistory();
     }
   }
   const send=document.createElement('button');send.type='button';send.className='btn orange';send.textContent='Envoyer la réponse dans la conversation';
   const status=document.createElement('p');status.setAttribute('role','status');
   form.after(status);form.after(send);
   sendButton=send;
   if(compactDemandes||path==='/admin/messages'){send.hidden=true;status.hidden=true}
   send.onclick=async()=>{
    const row=dossiers.find(x=>x.id===select.value);
    if(!row){status.textContent='Sélectionnez un dossier.';return}
    if(!row.initial_paid_at){status.textContent='Acompte non confirmé : réponse fournisseur indisponible.';return}
    const fields=Object.fromEntries(new FormData(form));
    const found=fields.result==='Pièce trouvée';
    const message=main.querySelector('#meca-compose-preview')?.textContent||'';
    if(found&&(!fields.price||!fields.delay||!fields.supplier)){status.textContent='Complétez prix, délai et fournisseur.';return}
    send.disabled=true;status.textContent='Enregistrement en cours…';
    try{const result=await call({action:'reply',id:row.id,found,message,country:fields.country==='Autre'?fields.other:fields.country,price:fields.price,delay:fields.delay,condition:fields.condition,fit:fields.fit,supplier:fields.supplier,details:fields.details,expressEligible:fields.expressEligible==='on',reservationConfirmed:fields.reservationConfirmed==='on'});status.textContent=result.message||(result.emailed?'Message enregistré et notification envoyée au client.':'Message enregistré. Notification e-mail non confirmée ; le client peut le lire via son lien personnel.');await refreshHistory()}
    catch(e){status.textContent=e.message}
    finally{send.disabled=false}
   };
   const deep=new URLSearchParams(location.hash.split('?')[1]||'').get('dossier');
   const remembered=deep&&/^[a-f0-9-]{36}$/i.test(deep)?deep:sessionStorage.getItem('meca-dossier-selected');
   if(remembered&&dossiers.some(x=>x.id===remembered)){openTreatment(remembered);sessionStorage.removeItem('meca-dossier-selected')}
   else if(!compactDemandes&&path!=='/admin/messages'&&dossiers.length){select.value=dossiers[0].id;select.dispatchEvent(new Event('change'))}
  }
 }catch(e){const p=document.createElement('p');p.className='meca-admin-live-status';p.textContent='Synchronisation indisponible : '+e.message;main.prepend(p)}
};