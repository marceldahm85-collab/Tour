// sw.js — Service Worker für Bergtouren Tracker
// Version bei jeder inhaltlichen Änderung erhöhen (v1 -> v2 -> ...),
// damit alte Caches automatisch ersetzt werden.
const CACHE_NAME = 'bergtouren-cache-v3';

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

// --- Fetch-Strategie ---
// HTML/Navigationsanfragen werden zuerst aus dem Netz geladen.
// So wird nach App-Updates auf mobilen Geräten nicht dauerhaft
// eine alte index.html aus dem Service-Worker ausgeliefert.
// Bei Offline-Betrieb fällt die Navigation auf den Cache zurück.
// Statische Ressourcen bleiben cache-first.

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document';

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, resClone)
            );
          }
          return networkRes;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((networkRes) => {
        if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, resClone)
          );
        }
        return networkRes;
      });
    })
  );
});
