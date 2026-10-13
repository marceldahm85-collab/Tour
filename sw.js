// sw.js — Service Worker für Bergtouren Tracker
// Der PDF-Magazin-Renderer wird direkt über index.html geladen.
const CACHE_NAME = 'bergtouren-cache-v40';

const APP_SHELL = [
  './',
  './index.html',
  './app-core.js',
  './styles.css',
  './styles-landscape.css',
  './styles-overrides.css',
  './map-view.js',
  './stats-analysis.js',
  './wrapped.js',
  './backup-export.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512_neu.png'
];

// --- Installation: App-Shell + Libraries cachen ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const request = new Request(url, {
              mode: url.startsWith('http') ? 'cors' : 'same-origin'
            });
            const response = await fetch(request);
            if (response && (response.ok || response.type === 'opaque')) {
              await cache.put(request, response);
            }
          } catch (err) {
            console.warn('SW: Konnte nicht cachen:', url, err);
          }
        })
      );
      await self.skipWaiting();
    })
  );
});

// --- Aktivierung: alte Caches löschen ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch-Strategie: Stale-While-Revalidate ---
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
