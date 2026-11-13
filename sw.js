// Offline shell: built-in stories continue working after first online visit.
// Microphone recognition may require the browser's online speech service.
const CACHE='reader-ai-shell-v3';
const SHELL=['./','./index.html','./app.mjs','./engine.mjs','./styles.css','./manifest.webmanifest','./assets/icon.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('buddy-reads-shell-')||key.startsWith('reader-ai-shell-'))&&key!==CACHE).map(key=>caches.delete(key)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
  return;
 }
 event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});
