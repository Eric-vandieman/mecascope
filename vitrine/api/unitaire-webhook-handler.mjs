// Événements Stripe concernant les paiements à l'unité. Retourne true après traitement.
export default async function handleUnitaire(event,res,{key,url,admin}){
 const raw=event.data?.object||{};
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)
   ||raw.mode!=='payment'||raw.metadata?.service!=='mecascope_unitaire')return false;
 const sessionId=String(raw.id||'');
 if(!/^cs_live_[A-Za-z0-9_]+$/.test(sessionId)){res.status(400).json({message:'Session invalide'});return true}
 const prices={initial:{ciblee:['STRIPE_PRICE_CIBLEE_INITIAL',1900],approfondie:['STRIPE_PRICE_APPROFONDIE_INITIAL',3900],expert:['STRIPE_PRICE_EXPERT_INITIAL',6900]},
  solde:{ciblee:['STRIPE_PRICE_CIBLEE_SUCCESS',2000],approfondie:['STRIPE_PRICE_APPROFONDIE_SUCCESS',4000],expert:['STRIPE_PRICE_EXPERT_SUCCESS',8000]}};
 const hdr={apikey:admin,...(admin.startsWith('eyJ')?{Authorization:'Bearer '+admin}:{}),'Content-Type':'application/json'};
 try{
  const s=await fetch('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=line_items',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});
  if(!s.ok)throw Error('Stripe indisponible');
  const session=await s.json();
  // Les moyens asynchrones peuvent signaler checkout.session.completed avant paiement.
  // On attend checkout.session.async_payment_succeeded plutôt que de réclamer l'argent.
  if(session.payment_status==='unpaid' && event.type==='checkout.session.completed'){
   res.status(200).json({received:true,pending:true});return true;
  }
  const dossier=String(session.metadata?.dossier_id||''),stage=session.metadata?.stage;
  if(!session.livemode||session.id!==sessionId||session.mode!=='payment'||session.payment_status!=='paid'||session.status!=='complete'
   ||session.metadata?.service!=='mecascope_unitaire'||!/^[a-f0-9-]{36}$/i.test(dossier)||!['initial','solde'].includes(stage))
   throw Error('Session non payée');
  const d=await fetch(url+'/rest/v1/meca_demandes_unitaires?id=eq.'+encodeURIComponent(dossier)+'&select=id,offre,email,initial_price,solde_price&limit=1',{headers:hdr,signal:AbortSignal.timeout(12000)});
  if(!d.ok)throw Error('Dossier manquant');
  const row=(await d.json())[0],entry=prices[stage]?.[row?.offre],price=entry&&process.env[entry[0]];
  if(!row||!price||session.metadata?.price_id!==price||session.currency!=='eur'
   ||session.amount_total!==entry[1]||session.line_items?.data?.length!==1
   ||session.line_items.data[0]?.price?.id!==price
   ||session.customer_details?.email?.toLowerCase()!==String(row.email).toLowerCase()
   ||row[stage==='initial'?'initial_price':'solde_price']!==price)throw Error('Contrôle montant/client échoué');
  const result=await fetch(url+'/rest/v1/rpc/meca_unitaire_confirmer_paiement',{
   method:'POST',headers:hdr,
   body:JSON.stringify({p_dossier:dossier,p_session:sessionId,p_etape:stage,p_price:price}),
   signal:AbortSignal.timeout(12000)});
  if(!result.ok)throw Error('Écriture refusée');
  res.status(200).json({received:true});return true;
 }catch{res.status(500).json({message:'Synchronisation unitaire non finalisée'});return true}
}
