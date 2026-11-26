(async function(){
 const qs=new URLSearchParams(location.search),token=qs.get('t');if(!/^[a-f0-9]{64}$/i.test(token||''))return;
 const main=document.querySelector('main.mission');if(!main)return;
 const section=document.createElement('section');section.style.cssText='border-top:1px solid #6b533a;margin-top:30px;padding-top:22px';
 const h=document.createElement('h2');h.textContent='Votre conversation avec Mécascope';section.append(h);
 const result=document.createElement('div');result.style.cssText='padding:14px;border-radius:10px;background:#15202b;margin-bottom:15px;line-height:1.7';section.append(result);
 const messages=document.createElement('div');messages.style.cssText='max-height:400px;overflow:auto;white-space:pre-wrap;line-height:1.6';section.append(messages);
 const input=document.createElement('textarea');input.placeholder='Votre message à propos de cette recherche';input.maxLength=3000;input.rows=4;input.style.cssText='width:100%;padding:13px;border-radius:8px;background:#0f1821;color:white;border:1px solid #71502d;resize:vertical';section.append(input);
 const send=document.createElement('button');send.textContent='Envoyer mon message';send.style.marginTop='12px';section.append(send);
 const status=document.createElement('p');status.setAttribute('role','status');section.append(status);main.append(section);
 async function load(message){
  const r=await fetch('/api/unitaire'+(message===undefined?'?action=conversation&t='+encodeURIComponent(token):''),message===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send-message',token,message})});
  const d=await r.json();if(!r.ok){if(r.status===403){input.hidden=true;send.hidden=true;result.textContent='🔒 Après paiement, connectez-vous à votre compte Mécascope confirmé (espace particulier ou espace professionnel selon votre dossier). Vos messages et le suivi y resteront accessibles.';}throw Error(d.message||'Conversation indisponible')};
  messages.replaceChildren();for(const m of d.messages||[]){const el=document.createElement('p');el.textContent=(m.auteur==='client'?'Vous':'Mécascope')+' — '+new Date(m.cree_le).toLocaleString('fr-FR')+'\n'+m.contenu;messages.append(el)}
  result.replaceChildren();
  if(d.resultat){for(const [label,value] of [['Pays',d.resultat.pays],['Prix de la pièce',new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(d.resultat.prix_centimes/100)],['Délai estimé',d.resultat.delai],['État',d.resultat.etat],['Compatibilité',d.resultat.compatibilite],['Fournisseur',d.resultat.fournisseur||'Coordonnées communiquées après confirmation du paiement du solde']]){const row=document.createElement('p');row.textContent=label+' : '+value;result.append(row)}}
  else result.textContent='Le résultat de la recherche apparaîtra ici dès sa validation.';
 }
 send.onclick=async()=>{const value=input.value.trim();if(!value)return;send.disabled=true;status.textContent='Envoi…';try{await load(value);input.value='';status.textContent='Message enregistré dans votre dossier.'}catch(e){status.textContent=e.message}finally{send.disabled=false}};
 try{await load()}catch(e){status.textContent=e.message}
 // Comptage statistique sans cookie tiers et sans collecte d'IP.
 try{let visitor=sessionStorage.getItem('meca-session-visit');if(!visitor){visitor=crypto.randomUUID();sessionStorage.setItem('meca-session-visit',visitor)}fetch('/api/unitaire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'visit',visitor,path:location.pathname}),keepalive:true}).catch(()=>{})}catch{}
})();