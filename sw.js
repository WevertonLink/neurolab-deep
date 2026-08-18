/* =====================================================================
   NeuroLab Deep · service worker

   GERADO por tools/build-app.js — não edite à mão.

   VERSION é o hash do index.html. Não existe "esquecer de incrementar":
   qualquer mudança no app produz uma versão nova, e a antiga é apagada.
   `tools/test-app.js` confere que este arquivo corresponde ao index.html
   commitado, de modo que publicar um app que o portão nunca viu falha o CI.
   ===================================================================== */
const VERSION = 'deep-1d954c5b771f';
const ATIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener('install', function(ev){
  ev.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(ATIVOS); })
    .then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(ev){
  ev.waitUntil(caches.keys().then(function(chaves){
    return Promise.all(chaves.filter(function(k){ return k !== VERSION; })
      .map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

/* Cache primeiro, rede depois. O app é um arquivo só e não conversa com
   servidor nenhum: uma vez guardado, funciona em modo avião, que é o ponto.
   A busca de rede em segundo plano atualiza o cache para a próxima abertura. */
self.addEventListener('fetch', function(ev){
  if(ev.request.method !== 'GET') return;
  ev.respondWith(caches.match(ev.request).then(function(guardado){
    var daRede = fetch(ev.request).then(function(resp){
      if(resp && resp.ok && resp.type === 'basic'){
        var copia = resp.clone();
        caches.open(VERSION).then(function(c){ c.put(ev.request, copia); });
      }
      return resp;
    }).catch(function(){ return guardado; });
    return guardado || daRede;
  }));
});
