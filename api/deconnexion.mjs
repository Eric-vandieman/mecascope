export default function handler(req,res) {
  if(req.method !== 'POST' || req.headers.origin !== 'https://'+req.headers.host) return res.status(403).end();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Set-Cookie','__Host-mecascope=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');
  return res.status(204).end();
}
