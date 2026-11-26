'use strict';
const CACHE_VERSION='meca-client-push-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 const url=typeof data.url==='string'&&data.url==='/mon-espace.html#demandes'?data.url:'/mon-espace.html';
 const title=String(data.title||'Mécascope — Nouveau message').slice(0,110);
 event.waitUntil(self.registration.showNotification(title,{
  body:String(data.body||'Une mise à jour de votre recherche est disponible.').slice(0,180),
  icon:'/logo-ms-officiel.webp',badge:'/logo-ms-officiel.webp',
  tag:String(data.tag||'mecascope-suivi').slice(0,120),silent:false,
  data:{url}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'/mon-espace.html',self.location.origin);
 if(url.origin!==self.location.origin||url.pathname!=='/mon-espace.html')return;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients){if(new URL(client.url).origin===url.origin){await client.focus();await client.navigate(url.href);return}}
  await self.clients.openWindow(url.href);
 })());
});
