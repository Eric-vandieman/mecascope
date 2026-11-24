document.querySelector('#demande')?.addEventListener('submit', event => {
  event.preventDefault();
  const fields = new FormData(event.currentTarget);
  const labels = {brand:'Marque',model:'Modèle',year:'Année',part:'Pièce recherchée',ref:'Référence',budget:'Budget'};
  const body = Object.entries(labels).map(([key,label]) => label + ' : ' + (fields.get(key) || '—')).join('\n');
  location.href = 'mailto:contact@xn--mcascope-b1a.fr?subject=' + encodeURIComponent('Mécascope – recherche de pièce') + '&body=' + encodeURIComponent(body);
});
