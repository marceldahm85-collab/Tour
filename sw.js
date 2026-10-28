// sw.js — Service Worker für Bergtouren Tracker
// Der PDF-Magazin-Renderer wird direkt über index.html geladen.
const CACHE_NAME = 'bergtouren-cache-premium-alpine-v155';

const APP_SHELL = [
  './',
  './index.html',
  './app-main-20261019.js?v=17',
  './stats-premium-alpine.js?v=10',
  './theme-editor-surface-compat.js?v=4',
  './theme-editor-unified.js?v=21',
  './dashboard-premium-alpine.js?v=35',
  './app-navigation-history.js?v=1',
  './bergwelt-badges-20261019.css?v=6',
  './bergwelt-badges-20261019.js?v=6',
  './styles.css?v=14',
  './styles-overrides.css?v=87',
  './dashboard-premium-alpine.css?v=22',
  './stats-premium-alpine.css?v=16',
  './map-premium-alpine.css?v=19',
  './appview-premium-alpine.css?v=9',
  './assets/bergwelt-fixed-alpine.webp',
  './assets/milestones/alpine-backdrop.svg?v=2',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg/1280px-Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/20-06-2020_-_Alps_panorama.jpg/1280px-20-06-2020_-_Alps_panorama.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Dolomites.jpg/1280px-Dolomites.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Tyrol_-_hiking_trail.jpg/1280px-Tyrol_-_hiking_trail.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Alpenpanorama_bei_Sonnenuntergang.jpg/1280px-Alpenpanorama_bei_Sonnenuntergang.jpg',
  './assets/milestones/milestone-asc.svg?v=3',
  './assets/milestones/milestone-dist.svg?v=3',
  './assets/milestones/milestone-peaks.svg?v=3',
  './assets/milestones/milestone-steps.svg?v=3',
  './assets/milestones/milestone-time.svg?v=3',
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
              mode: url.includes('wikimedia.org/') ? 'no-cors' : (url.startsWith('http') ? 'cors' : 'same-origin'),
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
  const isMaptoolkitAsset = [
    'styles.maptoolkit.org',
    'tiles.maptoolkit.org',
    'fonts.maptoolkit.org',
    'tiles.mapterhorn.com'
  ].includes(requestUrl.hostname);

  if (isMaptoolkitAsset) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isCriticalAppAsset = requestUrl.origin === self.location.origin &&
    /\/(?:index\.html|app-main(?:-20261019)?\.js|theme-editor-unified\.js|bergwelt(?:-badges-20261019)?\.(?:js|css))$/.test(requestUrl.pathname);

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
