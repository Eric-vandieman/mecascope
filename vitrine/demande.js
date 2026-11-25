document.querySelector('#demande')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form=event.currentTarget;
  const fields=new FormData(form);
  const labels={vehicleType:'Catégorie de véhicule',plate:'Immatriculation (facultatif)',brand:'Marque',model:'Modèle',year:'Année',part:'Pièce recherchée',ref:'Référence',budget:'Budget'};\n  const brandSelect=form.querySelector('select[name="brand"]');\n  if(brandSelect&&!brandSelect.hidden&&brandSelect.value)fields.set('brand',brandSelect.selectedOptions[0]?.textContent||'');
  const body=Object.entries(labels).map(([key,label])=>label+' : '+(fields.get(key)||'—')).join('\n');
  const mail='mailto:contact@xn--mcascope-b1a.fr?subject='+encodeURIComponent('Mécascope – recherche de pièce')+'&body='+encodeURIComponent(body);
  const button=form.querySelector('[type=submit]'),status=document.getElementById('meca-request-save-status');
  if(button)button.disabled=true;
  try{
    const data=Object.fromEntries(Object.keys(labels).map(key=>[key,fields.get(key)||'']));
    // Une recherche Pro est d'abord enregistrée dans le dossier commun du garage.
    const response=await fetch('/api/pro-collaboration',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',...data})});
    if(response.ok){
      const result=await response.json();
      if(status)status.textContent='Votre demande a été enregistrée dans le tableau de bord de votre garage. Réf. '+result.id+'. Votre messagerie va s’ouvrir pour transmission.';
    }else if(response.status===401||response.status===403){
      if(status)status.textContent='Votre messagerie va s’ouvrir pour envoyer votre demande.';
    }else{
      const result=await response.json().catch(()=>({}));
      if(status)status.textContent='La sauvegarde du dossier Pro n’a pas abouti ('+(result.message||'service indisponible')+'). Vous pouvez néanmoins transmettre votre demande par e-mail.';
    }
  }catch{
    if(status)status.textContent='Suivi Pro indisponible. Votre messagerie va s’ouvrir pour transmettre la demande.';
  }finally{if(button)button.disabled=false}
  location.href=mail;
});
