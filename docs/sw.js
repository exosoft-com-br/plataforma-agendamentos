// agendei.io — Service Worker
// Estratégia: Cache-first para assets estáticos, Network-first para API

const CACHE_NAME = 'agendei-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/agenda/agenda-negocio.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap'
];

// Instalar: pré-cachear assets estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// Ativar: limpar caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first para API, Cache-first para assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Nunca interceptar requisições à API
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api/')) {
    return;
  }

  // Cache-first para assets estáticos (CSS, JS, fontes, imagens)
  if (
    event.request.destination === 'style' ||
    event.request.destination === 'script' ||
    event.request.destination === 'font' ||
    event.request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Network-first com fallback para cache em páginas HTML
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('/index.html'))
      )
    );
    return;
  }
});
