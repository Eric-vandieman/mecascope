export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).end();
  if (req.method === 'POST' && req.headers.origin !== 'https://' + req.headers.host) return res.status(403).end();
  const token = (req.headers.cookie || '').split('; ').find(value => value.startsWith('__Host-mecascope='))?.slice('__Host-mecascope='.length);
  if (!token) return res.status(401).json({message:'Connectez-vous pour accéder à votre entreprise.'});
  const headers = {apikey:process.env.SUPABASE_PUBLISHABLE_KEY, Authorization:'Bearer ' + token, 'Content-Type':'application/json'};
  const create = req.method === 'POST';
  const path = create ? 'rpc/inscrire_entreprise' : 'entreprises?select=id,nom,siren,verifiee,etablissements(siret)';
  const {nom,siret} = req.body || {};
  if (create && (typeof nom !== 'string' || !nom.trim() || nom.length > 200 || !/^\d{14}$/.test(siret))) return res.status(400).json({message:'Vérifiez le nom et les 14 chiffres du SIRET.'});
  try {
    const upstream = await fetch(process.env.SUPABASE_URL+'/rest/v1/'+path,{method:req.method,headers,body:create?JSON.stringify({nom_societe:nom.trim(),premier_siret:siret}):undefined,signal:AbortSignal.timeout(10000)});
    if (!upstream.ok) return res.status(upstream.status).json({message:upstream.status===409?'Cette entreprise est déjà enregistrée.':'Demande refusée. Vérifiez votre session et votre adresse e-mail.'});
    return res.json(await upstream.json());
  } catch {return res.status(503).json({message:'Base temporairement indisponible.'});}
}
