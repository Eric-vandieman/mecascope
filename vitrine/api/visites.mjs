import {createHmac} from 'node:crypto';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).end()}catch{return res.status(403).end()}
 const id=String(req.body?.visitor||''),path=String(req.body?.path||'');
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^\/[a-z0-9./-]{0,110}$/i.test(path))return res.status(400).end();
 const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)return res.status(503).end();
 const hash=createHmac('sha256',key).update(id).digest('hex');
 try{const r=await fetch(base+'/rest/v1/meca_visites_site',{method:'POST',headers:{apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({visiteur_hash:hash,chemin:path}),signal:AbortSignal.timeout(8000)});return res.status(r.ok?204:503).end()}catch{return res.status(503).end()}
}