const VERSION = 'holo-firebase-__VERSION__';
const ASSETS = __ASSETS__;
self.addEventListener('install', event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(['/index.html', '/cards.json', '/holosim-card-index.json', ...ASSETS]))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('holo-firebase-') && key !== VERSION).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Auth, databases, GitHub metadata and third-party card images stay outside
  // this app-shell cache. No private account responses or APKs are cached here.
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html'))); return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(VERSION).then(cache => cache.put(event.request, copy))); } return response; }))); return;
  }
  if (['/cards.json', '/holosim-card-index.json'].includes(url.pathname)) {
    event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(VERSION).then(cache => cache.put(event.request, copy))); } return response; }).catch(() => caches.match(event.request)));
  }
});
