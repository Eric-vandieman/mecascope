import {createHmac,timingSafeEqual} from 'node:crypto';

const liensMecascope=new Set(["plink_1UfIiFEiChhaPDNJ0sf6Pad8","plink_1UfIiJEiChhaPDNJZn31isr0","plink_1UfIiNEiChhaPDNJg9B8cYtK","plink_1UfIiREiChhaPDNJx37BRkPw","plink_1UfIiVEiChhaPDNJGwBSKcB9","plink_1UfIiZEiChhaPDNJdgujaurv","plink_1UfIidEiChhaPDNJ0W4T4jka","plink_1UfIiiEiChhaPDNJQWxD9ane","plink_1UfIilEiChhaPDNJWmbQaLSF","plink_1UfIipEiChhaPDNJplmMmU5a","plink_1UfIiuEiChhaPDNJV2rqHM7K","plink_1UfIiyEiChhaPDNJPY4Hyujm","plink_1UfIj2EiChhaPDNJUzjsgXp0"]);
const tarifsMecascope=new Set(["price_1UfIbcEiChhaPDNJIYdPCmQU","price_1UfIbXEiChhaPDNJ2fV2bAY6","price_1UfIbXEiChhaPDNJAhXJ9vGt","price_1UfIbTEiChhaPDNJrySpC50m","price_1UfIbPEiChhaPDNJL0mEh46q","price_1UfIbLEiChhaPDNJgrXG6Rkz","price_1UfIbKEiChhaPDNJshWLRby1","price_1UfIbGEiChhaPDNJLbjZBtU9","price_1UfIbCEiChhaPDNJ1LBaBS4y","price_1UfIbCEiChhaPDNJvRr4X201","price_1UfIb8EiChhaPDNJHrb9Tsjd","price_1UfIb3EiChhaPDNJhMJLyOWA","price_1UfIajEiChhaPDNJYq7k64Va"]);

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
  const concerneMecascope=event.type==='invoice.paid'
    ? o.lines?.data?.some(line=>tarifsMecascope.has(line.pricing?.price_details?.price??line.price?.id))
    : liensMecascope.has(o.payment_link);
  if(!concerneMecascope)return res.status(204).end();
  if(event.type==='invoice.paid' ? o.status!=='paid' : o.payment_status!=='paid')return res.status(204).end();
  try{
    const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/recevoir_paiement_test',{
      method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({cle:process.env.PAYMENTS_INGEST_TOKEN,evenement:event.id,objet:o.id,type_evenement:event.type,centimes:o.amount_paid??o.amount_total,devise:o.currency,lien:o.payment_link??null}),signal:AbortSignal.timeout(6000)
    });
    return res.status(response.ok?204:503).end();
  }catch{return res.status(503).end();}
}
