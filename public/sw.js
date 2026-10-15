// Public pages only. Never cache admin, editor or API requests.
const CACHE='instante-public-v2';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add('/offline.html')));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('instante-')&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);let path;try{path=decodeURIComponent(url.pathname);}catch{return;}
 if(event.request.method!=='GET'||url.origin!==location.origin||/^\/(admin|editor|api)(\/|$)/.test(path)||event.request.mode!=='navigate')return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(async()=>await caches.match(event.request)||await caches.match('/offline.html')));
});
