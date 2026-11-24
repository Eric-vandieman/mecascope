export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'POST') return res.status(405).end();
  if(!req.headers.origin || new URL(req.headers.origin).host !== req.headers.host) return res.status(403).end();
  const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key}=process.env;
  if(!url || !key) return res.status(503).json({message:'La connexion sera disponible après le raccordement de la base de préproduction.'});
  const {email,password,action,legalAccepted,legalVersion,marketingOptIn}=req.body || {};
  if(!['login','signup'].includes(action) || typeof email!=='string' || typeof password!=='string' || email.length>254 || password.length>256)
    return res.status(400).json({message:'Informations invalides.'});
  if(action==='signup' && (legalAccepted!==true || legalVersion!=='2026-11-24')) return res.status(400).json({message:'Veuillez accepter les CGU et les CGV en vigueur avant de créer votre compte.'});
  const endpoint=action==='login'?'token?grant_type=password':'signup';
  const authPayload=action==='signup'?{email,password,data:{mecascope_legal_version:'2026-11-24',mecascope_legal_accepted_at:new Date().toISOString(),mecascope_marketing_opt_in:marketingOptIn===true}}:{email,password};
  try {
    const result=await fetch(url+'/auth/v1/'+endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(authPayload),signal:AbortSignal.timeout(10000)});
    if(!result.ok) return res.status(400).json({message:'Demande refusée. Vérifiez vos informations.'});
    const data=await result.json();
    if(data.access_token) res.setHeader('Set-Cookie','__Host-mecascope='+encodeURIComponent(data.access_token)+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+Math.min(3600,Number(data.expires_in)||3600));
    return res.json({message:data.access_token?'Connexion réussie.':'Consultez votre messagerie pour confirmer votre adresse.'});
  } catch {return res.status(503).json({message:'Service temporairement indisponible.'});}
}
