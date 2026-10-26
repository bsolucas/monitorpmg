// Cache só da "casca" do app. O status.json nunca é cacheado (sempre rede).
const V = 'painel-v1';
const CASCA = ['index.html','painel.html','css/style.css','js/app.js','js/auth.js','manifest.webmanifest','icons/icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(CASCA))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.pathname.includes('/data/') || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
