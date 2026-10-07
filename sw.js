// sw.js — Service Worker für Bergtouren Tracker
// PDF-Magazin-Layout wird über eine zusätzliche JS-Datei in index.html eingebunden.
const CACHE_NAME = 'bergtouren-cache-v9';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './pdf-magazine.js',
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

// --- Installation: App-Shell + externe Libraries cachen ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
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

async function injectPdfMagazine(response) {
  if (!response) return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  try {
    const html = await response.clone().text();
    if (html.includes('pdf-magazine.js')) return response;

    const injected = html.replace(
      /<\/body>/i,
      '<script src="./pdf-magazine.js"></script></body>'
    );

    const headers = new Headers();
    headers.set('content-type', 'text/html; charset=UTF-8');

    return new Response(injected, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (err) {
    console.warn('SW: PDF-Magazin konnte nicht eingebunden werden:', err);
    return response;
  }
});

// --- Fetch-Strategie: Stale-While-Revalidate ---
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      const networkFetch = fetch(event.request)
        .then((networkRes) => {
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          }
          return networkRes;
        })
        .catch(() => cached);

      const response = cached || await networkFetch;

      if (event.request.mode === 'navigate') {
        return injectPdfMagazine(response);
      }

      return response;
    })
  );
});