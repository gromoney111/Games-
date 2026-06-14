const CACHE_NAME = 'game-zone-v1';
const STATIC_ASSETS = [
  '/Games-/',
  '/Games-/index.html',
  '/Games-/css/style.css',
  '/Games-/js/main.js',
  '/Games-/manifest.json',
  '/Games-/about.html',
];

// Cache game pages on first visit
const GAME_CACHE = 'game-zone-games-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(key => key !== CACHE_NAME && key !== GAME_CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Network-first for API calls
  if (request.url.includes('/api/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }
  
  // Cache-first for game pages and assets
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache game pages for offline play
        if (request.url.includes('/games/') && response.ok) {
          const clone = response.clone();
          caches.open(GAME_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      if (request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/Games-/index.html');
      }
    })
  );
});
