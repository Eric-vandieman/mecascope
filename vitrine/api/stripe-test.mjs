import {createHmac,timingSafeEqual} from 'node:crypto';

export function authentic(raw,header,secret,now=Math.floor(Date.now()/1000)){
  if(!secret || typeof header!=='string') return false;
  const parts=header.split(',');
  const t=parts.find(v=>v.startsWith('t='))?.slice(2);
  if(!t || !/^\d+$/.test(t) || Math.abs(now-Number(t))>300) return false;
  const expected=createHmac('sha256',secret).update(t+'.').update(raw).digest();
  return parts.some(p=>/^v1=[a-f0-9]{64}$/.test(p) && timingSafeEqual(expected,Buffer.from(p.slice(3),'hex')));
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).end();
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>524288)return res.status(413).end();chunks.push(Buffer.from(chunk));}
  const raw=Buffer.concat(chunks);
  if(!authentic(raw,req.headers['stripe-signature'],process.env.STRIPE_TEST_WEBHOOK_SECRET))return res.status(400).end();
  let event;
  try{event=JSON.parse(raw);}catch{return res.status(400).end();}
  if(event.livemode!==false)return res.status(400).end();
  const o=event.data?.object;
  if(!o || !['checkout.session.completed','checkout.session.async_payment_succeeded','invoice.paid'].includes(event.type))return res.status(204).end();
  if(event.type==='invoice.paid' ? o.status!=='paid' : o.payment_status!=='paid')return res.status(204).end();
  try{
    const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/recevoir_paiement_test',{
      method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({cle:process.env.PAYMENTS_INGEST_TOKEN,evenement:event.id,objet:o.id,type_evenement:event.type,centimes:o.amount_paid??o.amount_total,devise:o.currency,lien:o.payment_link??null}),signal:AbortSignal.timeout(6000)
    });
    return res.status(response.ok?204:503).end();
  }catch{return res.status(503).end();}
}
