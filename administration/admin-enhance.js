'use strict';
window.mecaEnhanceAdminLayout=layout=>{
 const tile=(label,id,sub)=>'<div class="metric"><div><div class="label">'+label+'</div><div class="value" id="'+id+'">—</div><small>'+sub+'</small></div></div>';
 const singles='<section class="meca-single-section"><h2>Prestations uniques</h2><div class="meca-single-cards">'+tile('Ce mois','meca-single-month','Paiements confirmés')+tile('Mois précédent','meca-single-previous','Comparatif')+tile('Depuis toujours','meca-single-total','Total historique')+'</div></section>';
 const note='<div class="meca-admin-live-status"><strong>Données réelles uniquement :</strong> le registre des prestations ponctuelles n’est pas encore connecté. Aucun paiement ni dossier réel n’est effacé. Les valeurs non disponibles sont affichées par « — ».</div>';
 let p=layout.pages['/admin'];
 p=p.replace('class="metric"><div class="symbol"','class="metric meca-kpi-new"><div class="symbol"');
 for(const [label,color] of [['Chiffre d’affaires','meca-kpi-revenue'],['Demandes urgentes','meca-kpi-urgent']]){
  const i=p.indexOf('<div class="label">'+label+'</div>'),start=p.lastIndexOf('<div class="metric">',i);
  if(i>=0&&start>=0)p=p.slice(0,start)+p.slice(start).replace('<div class="metric">','<div class="metric '+color+'">');
 }
 p=p.replace('<div class="panel admin-glow',note+singles+'<div class="panel admin-glow');
 p=p.replace('Montants de démonstration. Aucun encaissement réel.','Paiements : rapprochement bancaire à connecter.');
 layout.pages['/admin']=p;
 layout.pages['/admin/statistiques']=layout.pages['/admin/statistiques'].replace('<div class="stats-page">',note+singles+'<div class="stats-page">').replace('Statistiques calculées sur les dossiers de démonstration enregistrés dans ce navigateur.','Statistiques réelles exclusivement.');
 const composer='<section class="panel"><h2>Compte rendu fournisseur — réponse au client</h2><p class="muted">Brouillon structuré. L’envoi en conversation nécessite le raccordement aux dossiers et aux paiements confirmés.</p><form class="meca-compose-grid" id="meca-result-form"><label>Référence dossier<input name="ref" placeholder="MECA-..." required></label><label>Résultat<select name="result"><option>Pièce trouvée</option><option>Recherche infructueuse</option><option>Informations à compléter</option></select></label><label>Pays<select name="country"><option>France</option><option>Belgique</option><option>Allemagne</option><option>Italie</option><option>Espagne</option><option>Pays-Bas</option><option>Royaume-Uni</option><option>Suisse</option><option>Autre</option></select></label><label>Pays (si autre)<input name="other" maxlength="100"></label><label>Prix pièce (€)<input name="price" type="number" min="0" step="0.01"></label><label>Délai estimé<input name="delay" maxlength="120"></label><label>État<select name="condition"><option>À confirmer</option><option>Neuve</option><option>Occasion</option><option>Reconditionnée</option></select></label><label>Compatibilité<select name="fit"><option>À confirmer</option><option>Vérifiée</option><option>Non vérifiée</option></select></label><label class="wide">Message complémentaire<textarea name="details" maxlength="2400" rows="4"></textarea></label><label class="wide">Fournisseur — note strictement privée<input name="supplier" maxlength="200"></label></form><pre class="meca-compose-preview" id="meca-compose-preview"></pre><button class="btn orange" id="meca-compose-copy" type="button">Copier le message au client</button><p class="note">Le nom et les coordonnées du fournisseur ne sont pas ajoutés au message client. Ce brouillon ne valide aucun paiement et n’envoie aucun message.</p></section>';
 for(const page of ['/admin/demandes','/admin/messages'])layout.pages[page]=layout.pages[page].replace('</main>',composer+'</main>');
 return layout;
};
window.mecaAdminComposer=root=>{
 const f=root.querySelector('#meca-result-form'),out=root.querySelector('#meca-compose-preview'),copy=root.querySelector('#meca-compose-copy');if(!f||!out)return;
 const make=()=>{const d=Object.fromEntries(new FormData(f));return 'Mécascope — dossier '+(d.ref||'à renseigner')+'\n'+d.result+'\nPays : '+(d.country==='Autre'?d.other||'à confirmer':d.country)+'\nPrix pièce : '+(d.price||'à confirmer')+' €\nDélai : '+(d.delay||'à confirmer')+'\nÉtat : '+d.condition+'\nCompatibilité : '+d.fit+'\n'+(d.details||'')+'\n\nCoordonnées fournisseur communiquées uniquement après paiement du solde exigible, conformément aux conditions acceptées.'};
 f.addEventListener('input',()=>out.textContent=make());out.textContent=make();copy.addEventListener('click',()=>navigator.clipboard.writeText(make()).then(()=>copy.textContent='Copié').catch(()=>copy.textContent='Sélectionnez le texte'));
};
