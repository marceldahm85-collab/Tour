// sw.js — Service Worker für Bergtouren Tracker
// Version bei jeder inhaltlichen Änderung erhöhen (v1 -> v2 -> ...),
// damit alte Caches automatisch ersetzt werden.
const CACHE_NAME = 'bergtouren-cache-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512_neu.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];

// --- Installation: App-Shell + externe Libraries cachen ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Einzeln cachen statt addAll(), damit ein einzelner Fehler
      // (z.B. CDN kurzzeitig nicht erreichbar) nicht das ganze Setup killt.
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const req = new Request(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' });
            const res = await fetch(req);
            if (res && (res.ok || res.type === 'opaque')) {
              await cache.put(req, res);
            }
          } catch (err) {
            console.warn('SW: Konnte nicht cachen:', url, err);
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// --- Aktivierung: alte Caches aus früheren Versionen aufräumen ---
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
// Sofort aus dem Cache liefern (schnell, offline-fähig),
// im Hintergrund aktualisieren für den nächsten Aufruf.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((networkRes) => {
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkRes;
        })
        .catch(() => cached); // Offline & nichts im Cache -> Fehler durchreichen

      return cached || networkFetch;
    })
  );
});