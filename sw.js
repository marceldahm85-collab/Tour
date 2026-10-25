// sw.js — Service Worker für Bergtouren Tracker
// Der PDF-Magazin-Renderer wird direkt über index.html geladen.
const CACHE_NAME = 'bergtouren-cache-premium-alpine-v27';

const APP_SHELL = [
  './',
  './index.html',
  './app-main-20261019.js?v=4',
  './app-navigation-history.js?v=1',
  './bergwelt-badges-20261019.css?v=6',
  './bergwelt-badges-20261019.js?v=5',
  './styles.css?v=2',
  './styles-overrides.css?v=35',
  './manifest.json',
  './pdf-magazine.js?v=1',
  './icons/icon-192.png',
  './icons/icon-512_neu.png',
  './libs/jspdf.umd.min.js',
  './libs/jspdf.plugin.autotable.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];

// --- Installation: App-Shell + Libraries cachen ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const request = new Request(url, {
              mode: url.startsWith('http') ? 'cors' : 'same-origin',
              // Refresh the browser HTTP cache as well as this service-worker cache.
              cache: url.startsWith('http') ? 'default' : 'reload'
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

  const requestUrl = new URL(event.request.url);
  const isCriticalAppAsset = requestUrl.origin === self.location.origin &&
    /\/(?:index\.html|app-main(?:-20261019)?\.js|bergwelt(?:-badges-20261019)?\.(?:js|css))$/.test(requestUrl.pathname);

  // App-Einstieg und kritische Module netzwerkzuerst laden. Bei Offline-Betrieb
  // wird auf die im aktuellen Cache gespeicherte Datei zurückgegriffen.
  if (event.request.mode === 'navigate' || isCriticalAppAsset) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Für übrige Ressourcen Cache zuerst, mit Netz-Fallback und Aktualisierung.
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
