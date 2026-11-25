export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).end();
 if(req.method==='POST'){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).end()}catch{return res.status(403).end()}}
 const token=String(req.method==='GET'?req.query?.token:req.body?.token||'');
 const message=req.method==='POST'?String(req.body?.message||'').trim():null;
 if(!/^[a-f0-9]{64}$/i.test(token)||message!==null&&(!message||message.length>3000))return res.status(400).json({message:'Lien ou message invalide'});
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return res.status(503).json({message:'Service indisponible'});
 try{const r=await fetch(base+'/rest/v1/rpc/meca_client_conversation',{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json'},body:JSON.stringify({p_jeton:token,p_message:message}),signal:AbortSignal.timeout(11000)});if(!r.ok)return res.status(403).json({message:'Lien invalide ou expiré'});return res.status(200).json(await r.json())}catch{return res.status(503).json({message:'Service temporairement indisponible'})}
}