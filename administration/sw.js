const CACHE_VERSION='meca-admin-push-v2-brand';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 const id=String(data.id||'notification').slice(0,80);
 const url=typeof data.url==='string'&&/^\/#\/admin(?:\/[a-z-]+)?(?:\?dossier=[a-f0-9-]+)?$/.test(data.url)?data.url:'/#/admin';
 event.waitUntil(self.registration.showNotification(String(data.title||'Mécascope — Notification').slice(0,100),{
  body:String(data.body||'Un événement vous attend dans votre administration.').slice(0,160),
  icon:'/icon-192.png',badge:'/badge-96.png',color:'#ff951f',tag:String(data.tag||id).slice(0,95),
  renotify:false,data:{url},silent:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const destination=new URL(event.notification.data?.url||'/#/admin',self.location.origin);
 if(destination.origin!==self.location.origin)return;
 event.waitUntil((async()=>{
  const pages=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const c of pages){if(new URL(c.url).origin===destination.origin){await c.focus();if('navigate'in c)await c.navigate(destination.href);return}}
  await self.clients.openWindow(destination.href);
 })());
});