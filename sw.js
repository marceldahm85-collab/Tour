// sw.js — Service Worker für Bergtouren Tracker
// Der PDF-Magazin-Renderer wird direkt über index.html geladen.
const CACHE_NAME = 'bergtouren-cache-premium-alpine-v434';

const APP_SHELL = [
  './',
  './index.html',
  './fonts.css?v=1',
  './fonts/inter-latin-wght-normal.woff2',
  './fonts/roboto-condensed-latin-wght-normal.woff2',
  './fonts/nunito-sans-latin-wght-normal.woff2',
  './fonts/righteous-latin-400-normal.woff2',
  './android-backup-bridge.js?v=5',
  './app-main-20261019.js?v=106',
  './touch-ripple-feedback.js?v=1',
  './native-app-ready.js?v=2',
  './more-menu-navigation-fix.js?v=1',
  './osttirol-slide-background.js?v=1',
  './assets/osttirol-lienz-background.webp',
  './android/app/src/main/res/drawable-nodpi/splash_alpine_panorama.webp',
  './stats-premium-alpine.js?v=13',
  './view-accordion-behavior.js?v=8',
  './stats-premium-charts.js?v=52',
  './stats-premium-charts.css?v=9',
  './theme-editor-unified.js?v=34',
  './background-image-manager.js?v=13',
  './background-image-picker.js?v=8',
  './background-image-picker.css?v=3',
  './theme-editor-workflow.css?v=10',
  './theme-editor-workflow.js?v=8',
  './app-start-editor.css?v=3',
  './app-start-editor.js?v=7',
  './dashboard-premium-alpine.js?v=37',
  './dashboard-stat-modal-premium.js?v=6',
  './premium-modal-surface.js?v=2',
  './app-navigation-history.js?v=1',
  './android-gallery-photos.js?v=9',
  './tour-detail-modal-sections.js?v=1',
  './premium-alpine-icons.js?v=3',
  './android-gallery-photos.css?v=5',
  './bergwelt-badges-20261019.css?v=3',
  './bergwelt-premium-alpine.css?v=22',
  './bergwelt-badges-20261019.js?v=6',
  './styles.css?v=22',
  './styles-overrides.css?v=108',
  './dashboard-premium-alpine.css?v=36',
  './dashboard-stat-modal-premium.css?v=5',
  './premium-modal-surface.css?v=3',
  './premium-modal-header.css?v=2',
  './comparison-premium.css?v=9',
  './premium-glass-surfaces.css?v=3',
  './premium-motion-feedback.css?v=3',
  './premium-depth-effects.css?v=6',
  './premium-top3-metal.css?v=2',
  './premium-image-presentation.css?v=1',
  './premium-image-presentation.js?v=1',
  './premium-experience.js?v=1',
  './stats-premium-alpine.css?v=38',
  './map-premium-alpine.css?v=20',
  './appview-premium-alpine.css?v=22',
  './assets/topography/lienzer-dolomiten-contours-fine.svg',
  './assets/topography/lienzer-dolomiten-contours-index.svg',
  './plan-premium-alpine.css?v=6',
  './typography-profiles.css?v=1',
  'https://images.unsplash.com/photo-1694968537484-d4e1733301b5?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1632665099926-094c0d6b92bb?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1516733745173-62e8f8651711?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1789909145224-b12f9ac21ab9?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1486068720048-47715511ce71?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1636043982206-a2255072410e?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1642520175002-90a1168a0d57?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1789414297236-295409dfeb37?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1699448095339-c07828dee7c4?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1762375212956-46c0a0964336?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1757330878011-418ff67dd845?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1628091864452-095d137137e0?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1666567693318-27238d192d6a?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  'https://images.unsplash.com/photo-1792928442695-aaa9c0bf9cd5?fit=crop&crop=entropy&fm=jpg&q=82&w=1440&h=2560',
  './assets/milestones/alpine-backdrop.svg?v=2',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg/1280px-Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/20-06-2020_-_Alps_panorama.jpg/1280px-20-06-2020_-_Alps_panorama.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Dolomites.jpg/1280px-Dolomites.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Mountain_Reflection_on_Alpine_Lake.jpg/1280px-Mountain_Reflection_on_Alpine_Lake.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Dolomites_and_Lake_Landro%2C_Italy.jpg/1280px-Dolomites_and_Lake_Landro%2C_Italy.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Tyrol_-_hiking_trail.jpg/1280px-Tyrol_-_hiking_trail.jpg',
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Alpenpanorama_bei_Sonnenuntergang.jpg/1280px-Alpenpanorama_bei_Sonnenuntergang.jpg',
  './assets/milestones/milestone-asc.svg?v=5',
  './assets/milestones/milestone-dist.svg?v=5',
  './assets/milestones/milestone-peaks.svg?v=5',
  './assets/milestones/milestone-steps.svg?v=5',
  './assets/milestones/milestone-time.svg?v=5',
  './manifest.json',
  './pdf-magazine.js?v=3',
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
    /\/(?:index\.html|app-main(?:-20261019)?\.js|stats-premium-charts\.js|theme-editor-unified\.js|premium-experience\.js|background-image-(?:manager|picker)\.js|android-gallery-photos\.js|bergwelt(?:-badges-20261019)?\.(?:js|css))$/.test(requestUrl.pathname);

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
