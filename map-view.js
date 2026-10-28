/*
 * Kartenansicht: Gipfel-/Regionsfilter, Marker, Heatmap und Leistungsdarstellung.
 * Aus index.html ausgelagert; Funktionslogik bewusst unverändert.
 */

// ─── Karte ────────────────────────────────────────────────────────────────────

let tourMap            = null;
let tourMarkerList     = [];
let markerClusterGroup = null;
let mapQuickFilters    = new Set(['osttirol']);
let mapYearFilter      = String(new Date().getFullYear());
let _mapTourCache      = [];
let heatmapLayer       = null;
let performanceMapLayer = null;
let currentMapMode     = 'markers';
const mapPopupAutoCloseTimers = new WeakMap();

const MAP_UI_STATE_KEY = 'mapUiState_v1';
let mapUiStateRestored = false;

function restoreMapUiState() {
    if (mapUiStateRestored) return;
    mapUiStateRestored = true;

    const saved = appStorage.get(MAP_UI_STATE_KEY) || {};

    if (['markers', 'heatmap', 'performance'].includes(saved.mode)) {
        currentMapMode = saved.mode;
    }

    if (typeof saved.year === 'string' && saved.year) {
        mapYearFilter = saved.year;
    }

    if (Array.isArray(saved.filters) && saved.filters.length) {
        mapQuickFilters = new Set(saved.filters);
    }

    if (!mapQuickFilters.size) {
        mapQuickFilters = new Set(['all']);
    }

    document.querySelectorAll('#map-quick-filters .quick-filter-btn').forEach(btn => {
        btn.classList.toggle('active', mapQuickFilters.has(btn.dataset.mqf));
    });

    document.querySelectorAll('.map-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentMapMode);
    });

    const performanceLegend = document.getElementById('map-performance-legend');
    if (performanceLegend) {
        performanceLegend.hidden = currentMapMode !== 'performance';
    }
}

function saveMapUiState() {
    appStorage.set(MAP_UI_STATE_KEY, {
        mode: currentMapMode,
        year: mapYearFilter,
        filters: Array.from(mapQuickFilters)
    });
}

/* Kartenbibliotheken erst beim ersten Öffnen der Karte laden.
   Dadurch blockieren Leaflet und seine Plugins nicht den App-Start. */
const MAP_LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const MAP_CLUSTER_CSS = 'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
const MAP_LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const MAP_HEAT_JS = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
const MAP_CLUSTER_JS = 'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
const MAP_MAPLIBRE_GL_CSS_URL = 'https://cdn.jsdelivr.net/npm/maplibre-gl@6.9.0/dist/maplibre-gl.css';
const MAP_MAPLIBRE_GL_MODULE_URL = 'https://cdn.jsdelivr.net/npm/maplibre-gl@6.9.0/dist/maplibre-gl.mjs';
const MAP_MAPLIBRE_GL_LEAFLET_URL = 'https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js';
let mapViewLibreSupportPromise = null;

let mapLibrariesPromise = null;
const mapLibraryScriptPromises = new Map();
const mapLibraryStylePromises = new Map();

function loadMapStylesheetOnce(url) {
    if (mapLibraryStylePromises.has(url)) return mapLibraryStylePromises.get(url);
    const promise = new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.dataset.mapLibraryStylesheet = 'true';
        link.onload = resolve;
        link.onerror = () => reject(new Error('Stylesheet nicht geladen: ' + url));
        document.head.appendChild(link);
    }).catch(error => {
        mapLibraryStylePromises.delete(url);
        throw error;
    });
    mapLibraryStylePromises.set(url, promise);
    return promise;
}

function loadMapScriptOnce(url) {
    if (mapLibraryScriptPromises.has(url)) return mapLibraryScriptPromises.get(url);
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.dataset.mapLibraryScript = 'true';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Skript nicht geladen: ' + url));
        document.head.appendChild(script);
    }).catch(error => {
        mapLibraryScriptPromises.delete(url);
        throw error;
    });
    mapLibraryScriptPromises.set(url, promise);
    return promise;
}

function ensureMapLibreLayerSupport() {
    if (window.L && typeof window.L.maplibreGL === 'function') return Promise.resolve(true);
    if (!mapViewLibreSupportPromise) {
        mapViewLibreSupportPromise = (async () => {
            await loadMapStylesheetOnce(MAP_MAPLIBRE_GL_CSS_URL);
            const maplibregl = await import(MAP_MAPLIBRE_GL_MODULE_URL);
            window.maplibregl = maplibregl;
            await import(MAP_MAPLIBRE_GL_LEAFLET_URL);
            if (!window.L || typeof window.L.maplibreGL !== 'function') {
                throw new Error('Die Vektorkarte konnte nicht in Leaflet eingebunden werden.');
            }
            return true;
        })().catch(error => {
            mapViewLibreSupportPromise = null;
            throw error;
        });
    }
    return mapViewLibreSupportPromise;
}

function ensureMapLibraries() {
    if (
        window.L &&
        typeof window.L.map === 'function' &&
        typeof window.L.heatLayer === 'function' &&
        typeof window.L.markerClusterGroup === 'function'
    ) {
        return Promise.all([
            loadMapStylesheetOnce(MAP_LEAFLET_CSS),
            loadMapStylesheetOnce(MAP_CLUSTER_CSS)
        ]).then(() => ensureMapLibreLayerSupport());
    }
    if (mapLibrariesPromise) return mapLibrariesPromise;

    mapLibrariesPromise = (async () => {
        await Promise.all([
            loadMapStylesheetOnce(MAP_LEAFLET_CSS),
            loadMapStylesheetOnce(MAP_CLUSTER_CSS)
        ]);
        if (!window.L || typeof window.L.map !== 'function') {
            await loadMapScriptOnce(MAP_LEAFLET_JS);
        }
        if (typeof window.L.heatLayer !== 'function') {
            await loadMapScriptOnce(MAP_HEAT_JS);
        }
        if (typeof window.L.markerClusterGroup !== 'function') {
            await loadMapScriptOnce(MAP_CLUSTER_JS);
        }
        if (
            !window.L ||
            typeof window.L.heatLayer !== 'function' ||
            typeof window.L.markerClusterGroup !== 'function'
        ) {
            throw new Error('Die Karten-Bibliotheken wurden unvollständig geladen.');
        }
        await ensureMapLibreLayerSupport();
        return true;
    })().catch(error => {
        mapLibrariesPromise = null;
        throw error;
    });
    return mapLibrariesPromise;
}

const MAP_CENTER = [46.8268, 12.7671]; // Lienz, Osttirol
const MAP_ZOOM   = 9;

// Fallback-Zentren pro Region (für den Fall, dass 0 oder 1 Tour im Filter liegt)
const MAP_REGION_FALLBACK = {
    osttirol:  { center: [46.8268, 12.7671], zoom: 9 },  // Lienz
    kaernten:  { center: [46.6112, 13.8462], zoom: 9 },  // Villach
    nordtirol: { center: [47.2692, 11.4041], zoom: 9 },  // Innsbruck
    suedtirol: { center: [46.7093, 11.6552], zoom: 9 },  // Brixen
    salzburg:  { center: [47.8095, 13.0550], zoom: 9 }   // Salzburg Stadt
};

function getMapFallbackView() {
    const activeRegionKeys = Object.keys(MAP_REGION_FALLBACK).filter(k => mapQuickFilters.has(k));
    if (activeRegionKeys.length === 1) {
        return MAP_REGION_FALLBACK[activeRegionKeys[0]];
    }
    return { center: MAP_CENTER, zoom: MAP_ZOOM };
}

function populateMapYearSelect() {
    const yearSelect = document.getElementById('map-year-select');
    if (!yearSelect) return;

    const tours = appStorage.get('touren') || [];
    const years = new Set();

    tours.forEach(entry => {
        if (!entry.date) return;

        const date = new Date(entry.date);
        if (isNaN(date.getTime())) return;

        years.add(date.getFullYear());
    });

    const sortedYears = Array.from(years)
        .sort((a, b) => b - a);

    yearSelect.innerHTML = `
        <option value="all">Alle Jahre</option>
        <option value="past">Vergangene Jahre</option>
    `;

    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        yearSelect.appendChild(option);
    });

    const validValue =
        mapYearFilter === 'all' ||
        mapYearFilter === 'past' ||
        sortedYears.includes(Number(mapYearFilter));

    if (!validValue) {
        mapYearFilter = 'all';
    }

    yearSelect.value = mapYearFilter;

    updateMapYearButtons(sortedYears);
}

function updateMapYearButtons(sortedYears = null) {
    const yearSelect = document.getElementById('map-year-select');
    const prevBtn = document.getElementById('map-year-prev-btn');
    const nextBtn = document.getElementById('map-year-next-btn');

    if (!yearSelect || !prevBtn || !nextBtn) return;

    const years = sortedYears || Array.from(yearSelect.options)
        .map(option => option.value)
        .filter(value => value !== 'all' && value !== 'past')
        .map(Number)
        .sort((a, b) => b - a);

    if (
        mapYearFilter === 'all' ||
        mapYearFilter === 'past' ||
        years.length === 0
    ) {
        prevBtn.disabled = years.length === 0;
        nextBtn.disabled = years.length === 0;
        return;
    }

    const index = years.indexOf(Number(mapYearFilter));

    prevBtn.disabled =
        index === -1 || index >= years.length - 1;

    nextBtn.disabled =
        index === -1 || index <= 0;
}

function shiftMapYear(direction) {
    const yearSelect = document.getElementById('map-year-select');
    if (!yearSelect) return;

    const years = Array.from(yearSelect.options)
        .map(option => option.value)
        .filter(value => value !== 'all' && value !== 'past')
        .map(Number)
        .sort((a, b) => b - a);

    if (!years.length) return;

    let newValue;

    if (
        mapYearFilter === 'all' ||
        mapYearFilter === 'past'
    ) {
        newValue =
            direction === 'next'
                ? years[0]
                : years[years.length - 1];
    } else {
        const index = years.indexOf(Number(mapYearFilter));
        if (index === -1) return;

        const newIndex =
            direction === 'next'
                ? index - 1
                : index + 1;

        if (
            newIndex < 0 ||
            newIndex >= years.length
        ) {
            return;
        }

        newValue = years[newIndex];
    }

    yearSelect.value = String(newValue);
    yearSelect.dispatchEvent(new Event('change'));
}

function initTourMap() {
    const mapEl = document.getElementById('tour-map');
    if (!mapEl) return;

    restoreMapUiState();
    populateMapYearSelect();

    if (tourMap) return;

    tourMap = L.map('tour-map', {
    center: MAP_CENTER,
    zoom:   MAP_ZOOM,
    zoomControl: true,
    attributionControl: true,
    closePopupOnClick: false,
    minZoom: 1
});

    // OpenFreeMap Liberty — Vektorkarte ohne zusammengesetzte Raster-Bildkacheln.
    L.maplibreGL({
        style: 'https://tiles.openfreemap.org/styles/liberty',
        attribution:
            '<a href="https://openfreemap.org/" target="_blank" rel="noopener">© OpenFreeMap</a> ' +
            '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> ' +
            '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'
    }).addTo(tourMap);

    /* Karten-Popups automatisch nach 5 Sekunden schließen. */
    tourMap.on('popupopen', event => {
        const popup = event.popup;
        if (!popup) return;

        const oldTimer = mapPopupAutoCloseTimers.get(popup);
        if (oldTimer) clearTimeout(oldTimer);

        const timer = setTimeout(() => {
            if (tourMap) {
                tourMap.closePopup(popup);
            }
            mapPopupAutoCloseTimers.delete(popup);
        }, 5000);

        mapPopupAutoCloseTimers.set(popup, timer);
    });

    tourMap.on('popupclose', event => {
        const popup = event.popup;
        const timer = popup ? mapPopupAutoCloseTimers.get(popup) : null;
        if (timer) clearTimeout(timer);
        if (popup) mapPopupAutoCloseTimers.delete(popup);
    });

    // Marker-Cluster initialisieren
    if (typeof L.markerClusterGroup === 'function') {
        markerClusterGroup = L.markerClusterGroup({
            maxClusterRadius: 60,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            animate: true,
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                let size = 'small';
                if (count >= 15) size = 'medium';
                if (count >= 50) size = 'large';
                const dims = { small: 34, medium: 44, large: 54 };
                const dim = dims[size];
                return L.divIcon({
                    html: `<div class="tour-cluster tour-cluster-${size}">${count}</div>`,
                    className: '',
                    iconSize: [dim, dim],
                    iconAnchor: [dim / 2, dim / 2]
                });
            }
        });
        tourMap.addLayer(markerClusterGroup);
    }

    // Klick auf Karte → Koordinaten ins Formular übernehmen
    tourMap.on('click', (e) => {
        const latInput = document.getElementById('lat');
        const lngInput = document.getElementById('lng');
        if (!latInput || !lngInput) return;

        latInput.value = e.latlng.lat.toFixed(6);
        lngInput.value = e.latlng.lng.toFixed(6);

        // Kurzer Feedback-Marker
        const currentAccent =
    getComputedStyle(document.body)
        .getPropertyValue('--accent')
        .trim() || '#3aa0ff';

const tmp = L.circleMarker(e.latlng, {
    radius: 10,
    color: currentAccent,
    fillColor: currentAccent,
    fillOpacity: 0.5
}).addTo(tourMap);
        setTimeout(() => tourMap.removeLayer(tmp), 1500);
    });

    // Schnellfilter (kombinierbar, per erneutem Antippen abwählbar)
    document.querySelectorAll('#map-quick-filters .quick-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.mqf;

            if (key === 'all') {
                mapQuickFilters.clear();
                mapQuickFilters.add('all');
            } else {
                mapQuickFilters.delete('all');
                if (mapQuickFilters.has(key)) {
                    mapQuickFilters.delete(key);
                } else {
                    mapQuickFilters.add(key);
                }
                // Nichts mehr aktiv → automatisch auf "Alle" zurückfallen
                if (mapQuickFilters.size === 0) {
                    mapQuickFilters.add('all');
                }
            }

            document.querySelectorAll('#map-quick-filters .quick-filter-btn').forEach(b => {
                b.classList.toggle('active', mapQuickFilters.has(b.dataset.mqf));
            });

            saveMapUiState();
            refreshCurrentMap();
        });
    });

    // Mode Toggle
    document.querySelectorAll('.map-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMapMode(btn.dataset.mode));
    });

    const mapYearSelect =
        document.getElementById('map-year-select');

    mapYearSelect?.addEventListener('change', () => {
        mapYearFilter = mapYearSelect.value;
        updateMapYearButtons();
        saveMapUiState();
        refreshCurrentMap();
    });

    document
        .getElementById('map-year-prev-btn')
        ?.addEventListener('click', () => {
            shiftMapYear('prev');
        });

    document
        .getElementById('map-year-next-btn')
        ?.addEventListener('click', () => {
            shiftMapYear('next');
        });
}

const MAP_REGION_GROUPS = {
    osttirol:  ['Talboden & Dolomiten','Iseltal','Oberland & Pustertal','Defereggental'],
    kaernten:  ['Drautal','Gailtal','Mölltal','Donautal','Karawanken','Nockberge'],
    nordtirol: ['Nordtirol'],
    suedtirol: ['Südtirol'],
    salzburg:  ['Salzburg'],
    anderswo:  ['Anderswo']
};

function getMapFilteredTours() {
    const allTours = appStorage.get('touren') || [];

    let data = allTours.filter(e => {
        const lat = parseFloat(e.lat);
        const lng = parseFloat(e.lng);
        return lat && lng && !isNaN(lat) && !isNaN(lng);
    });

    // Eigenständiger Jahresfilter der Map
if (mapYearFilter !== 'all') {
    const currentYear = new Date().getFullYear();

    data = data.filter(entry => {
        if (!entry.date) return false;

        const date = new Date(entry.date);
        if (isNaN(date.getTime())) return false;

        if (mapYearFilter === 'past') {
            return date.getFullYear() !== currentYear;
        }

        return date.getFullYear() === Number(mapYearFilter);
    });
}

    // Regionen: mehrere aktive Regionen werden per ODER kombiniert
    const activeRegionKeys = Object.keys(MAP_REGION_GROUPS).filter(k => mapQuickFilters.has(k));
    if (activeRegionKeys.length > 0) {
        const allowedRegions = activeRegionKeys.flatMap(k => MAP_REGION_GROUPS[k]);
        data = data.filter(e => allowedRegions.includes(String(e.region || '')));
    }

    // Zusätzliche Filter: wirken als UND-Einschränkung
    if (mapQuickFilters.has('peaks')) {
        data = data.filter(e => (parseInt(e.gipfel) || 0) > 0);
    }

    if (mapQuickFilters.has('bigTours')) {
        data = data.filter(e => isBigTourCountable(e, data));
    }

    return data;
}

function updateMapMarkers() {
    if (!tourMap) return;

    // Cluster leeren
    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
    }
    tourMarkerList = [];
    _mapTourCache  = [];

    const data = getMapFilteredTours();
    const bounds = [];
    const isDark  = document.body.classList.contains('dark');
    const isGreen = document.body.classList.contains('green');
    const isSummit =
    document.body.classList.contains('summit');

    // Koordinaten-Zähler für Versatz bei gleichen Positionen
    const coordCount = {};

    data.forEach(entry => {
        const lat = parseFloat(entry.lat);
        const lng = parseFloat(entry.lng);
        if (!lat || !lng) return;

        // Eindeutiger Schlüssel für diese Position
        const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

        if (!coordCount[coordKey]) {
            coordCount[coordKey] = 0;
        }

        const count = coordCount[coordKey];
        coordCount[coordKey]++;

        // Versatz: bei Duplikaten in einem kleinen Kreis verteilen
        const offsetRadius = 0.0003;
        const angle = (count * 137.5 * Math.PI) / 180; // goldener Winkel
        const offsetLat = count === 0 ? 0 : offsetRadius * Math.cos(angle);
        const offsetLng = count === 0 ? 0 : offsetRadius * Math.sin(angle);

        const displayLat = lat + offsetLat;
        const displayLng = lng + offsetLng;

        bounds.push([displayLat, displayLng]);

        const markerColor =
    isSummit
        ? '#3aa0ff'
        : isGreen
        ? '#52b788'
        : isDark
        ? '#9b1c1c'
        : '#e07b39';


const borderColor =
    isSummit
        ? '#ffffff'
        : isGreen
        ? '#f2faf5'
        : isDark
        ? '#d6e1f0'
        : '#ffffff';

        const icon = L.divIcon({
            className: '',
            html: `<div style="
                width:16px; height:16px;
                border-radius:50%;
                background:${markerColor};
                border:2px solid ${borderColor};
                box-shadow:0 2px 6px rgba(0,0,0,0.35);
                cursor:pointer;
            "></div>`,
            iconSize:    [16, 16],
            iconAnchor:  [8, 8],
            popupAnchor: [0, -10]
        });

        const marker = L.marker([displayLat, displayLng], { icon });

        // Popup
        const peakStr = entry.gipfelDetails?.length
            ? entry.gipfelDetails.map(g => `⛰ ${escapeHtml(g.name || '')} ${g.hoehe ? escapeHtml(g.hoehe) + ' m' : ''}`).join('<br>')
            : '';

        const tourIndex = _mapTourCache.length;
        _mapTourCache.push(entry);

        const popupContent = `
            <div class="map-popup">
                <div class="map-popup-title">${escapeHtml(entry.tourname || 'Tour')}</div>
                <div class="map-popup-date">${entry.date || '–'}</div>
                <div class="map-popup-stats">
                    ${entry.strecke
    ? `🛤 ${formatDecimalAT(entry.strecke)} km`
    : ''}
                    ${entry.aufstieg ? `&nbsp;·&nbsp;↑ ${entry.aufstieg} hm` : ''}
                    ${entry.zeit     ? `&nbsp;·&nbsp;⏱ ${entry.zeit}` : ''}
                </div>
                ${peakStr ? `<div class="map-popup-peaks">${peakStr}</div>` : ''}
                <button class="map-popup-btn" onclick="window._mapOpenTour(${tourIndex})">
                    Tour öffnen
                </button>
            </div>
        `;

        marker.bindPopup(popupContent, {
            closeOnClick: false,
            autoClose: false,
            closeButton: true
        });

        if (markerClusterGroup) {
            markerClusterGroup.addLayer(marker);
        } else {
            marker.addTo(tourMap);
        }
        tourMarkerList.push(marker);
    });

    // Infobar
    const infoEl = document.getElementById('map-tour-count');
    if (infoEl) {
        infoEl.textContent = data.length
            ? `${data.length} Touren`
            : '0 Touren · Filter ändern oder anderes Jahr wählen';
    }

    // Karte auf Marker zentrieren
    if (bounds.length === 0) {
        const fb = getMapFallbackView();
        tourMap.setView(fb.center, fb.zoom);
    } else if (bounds.length === 1) {
        tourMap.setView(bounds[0], 13);
    } else {
        tourMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
}

function refreshTourMap() {
    initTourMap();
    requestAnimationFrame(() => {
        tourMap?.invalidateSize();
        refreshCurrentMap();
    });
}

// Globaler Helper für Popup-Button (Leaflet-Popup hat keinen direkten JS-Scope)
window._mapOpenTour = function(index) {
    const entry = _mapTourCache[index];
    tourMap?.closePopup();
    if (entry) openTourDetail(entry);
};

function getMapHeatGradient() {
    const isSummit = document.body.classList.contains('summit');
    const isDark = document.body.classList.contains('dark');
    const isGreen = document.body.classList.contains('green');

    if (isSummit) {
        return {
            0.00: 'rgba(21,90,156,0.16)',
            0.18: '#155a9c',
            0.38: '#176fc1',
            0.58: '#3aa0ff',
            0.78: '#63b7ff',
            1.00: '#c9eaff'
        };
    }

    if (isGreen) {
        return {
            0.00: 'rgba(20,70,35,0)',
            0.25: '#1b4332',
            0.50: '#2d6a4f',
            0.72: '#52b788',
            0.88: '#95d5b2',
            1.00: '#d8f3dc'
        };
    }

    if (isDark) {
        return {
            0.00: 'rgba(30,58,95,0)',
            0.30: '#1e3a5f',
            0.50: '#7b2d8b',
            0.70: '#c0392b',
            0.85: '#e67e22',
            1.00: '#f9d77e'
        };
    }

    return {
        0.00: 'rgba(59,130,246,0)',
        0.30: '#3b82f6',
        0.50: '#8b5cf6',
        0.70: '#ef4444',
        0.85: '#f97316',
        1.00: '#fef08a'
    };
}

// ─── Heatmap

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function updateHeatmap() {
    if (!tourMap) return;

    // Alte Heatmap entfernen
    if (heatmapLayer) {
        tourMap.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }

    const data = getMapFilteredTours();

    // Maximalwerte für relative Skalierung
    const maxAscent   = Math.max(1, ...data.map(e => parseFloat(e.aufstieg) || 0));
    const maxDistance = Math.max(1, ...data.map(e => parseFloat(e.strecke)  || 0));

    const points = data
        .map(entry => {
            const lat = parseFloat(entry.lat);
            const lng = parseFloat(entry.lng);
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

            const ascent   = parseFloat(entry.aufstieg) || 0;
            const distance = parseFloat(entry.strecke)  || 0;

            // 60% Aufstieg + 40% Strecke, relativ zu den Maximalwerten
            const combined = 0.6 * (ascent / maxAscent) + 0.4 * (distance / maxDistance);
            const intensity = Math.max(0.35, combined);
            return [lat, lng, intensity];
        })
        .filter(Boolean);


    if (points.length > 0) {
        heatmapLayer = L.heatLayer(points, {
            radius:     35,
            blur:       20,
            maxZoom:    17,
            minOpacity: 0.72,
            max:        1.0,
            gradient: getMapHeatGradient()
        }).addTo(tourMap);
    }

    // Infobar
    const infoEl = document.getElementById('map-tour-count');
    if (infoEl) {
        const topTour = data
            .filter(e => parseFloat(e.lat) && parseFloat(e.lng))
            .sort((a, b) => {
                const scoreA = 0.6 * ((parseFloat(a.aufstieg) || 0) / maxAscent)
                             + 0.4 * ((parseFloat(a.strecke)  || 0) / maxDistance);
                const scoreB = 0.6 * ((parseFloat(b.aufstieg) || 0) / maxAscent)
                             + 0.4 * ((parseFloat(b.strecke)  || 0) / maxDistance);
                return scoreB - scoreA;
            })[0];

        if (topTour) {
            infoEl.textContent = `${data.length} Touren · Intensivste: ${topTour.tourname || '–'} (${topTour.aufstieg || 0} hm / ${topTour.strecke || 0} km)`;
        } else {
            infoEl.textContent = data.length
                ? `${data.length} Touren`
                : '0 Touren · Filter ändern oder anderes Jahr wählen';
        }
    }

    // Bounds
    const bounds = points.map(p => [p[0], p[1]]);
    if (bounds.length === 0) {
        const fb = getMapFallbackView();
        tourMap.setView(fb.center, fb.zoom);
    } else if (bounds.length === 1) {
        tourMap.setView(bounds[0], 13);
    } else {
        tourMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
}



function getPerformanceMapVisual(score, isTop) {
    if (isTop) {
        return { color: '#ffd23f', radius: 10.5, label: 'Top 10 %' };
    }

    if (!Number.isFinite(score)) {
        return { color: '#7b8794', radius: 5.5, label: 'nicht auswertbar' };
    }

    if (score >= 75) {
        return { color: '#f97316', radius: 8.8, label: 'hoch' };
    }

    if (score >= 50) {
        return { color: '#3aa0ff', radius: 7.2, label: 'mittel' };
    }

    return { color: '#64748b', radius: 6.0, label: 'niedriger' };
}

function updatePerformanceMap() {
    if (!tourMap) return;

    if (performanceMapLayer) {
        tourMap.removeLayer(performanceMapLayer);
        performanceMapLayer = null;
    }

    const data = getMapFilteredTours();
    const scored = data.map(entry => {
        const performance = calculatePerformanceIndex(entry);
        return {
            entry,
            score: performance && Number.isFinite(performance.score)
                ? Number(performance.score)
                : null
        };
    });

    const validScores = scored
        .map(item => item.score)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    const topThreshold = validScores.length
        ? validScores[Math.max(0, Math.ceil(validScores.length * 0.90) - 1)]
        : Infinity;

    performanceMapLayer = L.layerGroup().addTo(tourMap);
    _mapTourCache = [];
    tourMarkerList = [];

    const bounds = [];
    const coordCount = {};
    const isDark = document.body.classList.contains('dark') ||
        document.body.classList.contains('green') ||
        document.body.classList.contains('summit');

    scored.forEach(item => {
        const entry = item.entry;
        const lat = parseFloat(entry.lat);
        const lng = parseFloat(entry.lng);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

        const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        const count = coordCount[coordKey] || 0;
        coordCount[coordKey] = count + 1;

        const offsetRadius = 0.00026;
        const angle = (count * 137.5 * Math.PI) / 180;
        const displayLat = lat + (count ? offsetRadius * Math.cos(angle) : 0);
        const displayLng = lng + (count ? offsetRadius * Math.sin(angle) : 0);
        bounds.push([displayLat, displayLng]);

        const isTop = Number.isFinite(item.score) && item.score >= topThreshold && validScores.length >= 3;
        const visual = getPerformanceMapVisual(item.score, isTop);
        const tourIndex = _mapTourCache.length;
        _mapTourCache.push(entry);

        const marker = L.circleMarker([displayLat, displayLng], {
            radius: visual.radius,
            color: isDark ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.96)',
            weight: isTop ? 2.4 : 1.7,
            fillColor: visual.color,
            fillOpacity: 0.88,
            opacity: 0.95
        });

        marker.bindPopup(`
            <div class="map-popup">
                <div class="map-popup-title">${escapeHtml(entry.tourname || 'Tour')}</div>
                <div class="map-popup-date">${entry.date || '–'}</div>
                <div class="map-popup-stats">
                    ⚡ Leistungsindex: ${Number.isFinite(item.score) ? `${Math.round(item.score)} / 100` : '–'}
                    ${isTop ? '&nbsp;·&nbsp;🏆 Top 10 %' : ''}
                </div>
                <div class="map-popup-stats">
                    ${entry.strecke ? `🛤 ${formatDecimalAT(entry.strecke)} km` : ''}
                    ${entry.aufstieg ? `&nbsp;·&nbsp;↑ ${entry.aufstieg} hm` : ''}
                </div>
                <button class="map-popup-btn" onclick="window._mapOpenTour(${tourIndex})">Tour öffnen</button>
            </div>
        `, {
            closeOnClick: false,
            autoClose: false,
            closeButton: true
        });

        marker.addTo(performanceMapLayer);
        tourMarkerList.push(marker);
    });

    const infoEl = document.getElementById('map-tour-count');
    const best = scored
        .filter(item => Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score)[0];

    if (infoEl) {
        if (!data.length) {
            infoEl.textContent = '0 Touren · Filter ändern oder anderes Jahr wählen';
        } else if (best) {
            infoEl.textContent = `${data.length} Touren · Beste Leistung: ${best.entry.tourname || '–'} (${Math.round(best.score)} / 100)`;
        } else {
            infoEl.textContent = `${data.length} Touren · noch keine auswertbare Leistung`;
        }
    }

    if (!bounds.length) {
        const fb = getMapFallbackView();
        tourMap.setView(fb.center, fb.zoom);
    } else if (bounds.length === 1) {
        tourMap.setView(bounds[0], 13);
    } else {
        tourMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
}


function setMapMode(mode) {
    currentMapMode = ['markers', 'heatmap', 'performance'].includes(mode)
        ? mode
        : 'markers';

    document.querySelectorAll('.map-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentMapMode);
    });

    const performanceLegend = document.getElementById('map-performance-legend');
    if (performanceLegend) {
        performanceLegend.hidden = currentMapMode !== 'performance';
    }

    if (heatmapLayer) {
        tourMap.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }

    if (performanceMapLayer) {
        tourMap.removeLayer(performanceMapLayer);
        performanceMapLayer = null;
    }

    if (currentMapMode === 'markers') {
        if (markerClusterGroup && !tourMap.hasLayer(markerClusterGroup)) {
            tourMap.addLayer(markerClusterGroup);
        }
        updateMapMarkers();
        saveMapUiState();
        return;
    }

    if (markerClusterGroup) {
        markerClusterGroup.clearLayers();
        if (tourMap.hasLayer(markerClusterGroup)) {
            tourMap.removeLayer(markerClusterGroup);
        }
    }

    tourMarkerList = [];
    _mapTourCache = [];

    if (currentMapMode === 'heatmap') {
        updateHeatmap();
    } else {
        updatePerformanceMap();
    }

    saveMapUiState();
}

function refreshCurrentMap() {
    if (!tourMap) return;

    if (currentMapMode === 'heatmap') {
        updateHeatmap();
    } else if (currentMapMode === 'performance') {
        updatePerformanceMap();
    } else {
        updateMapMarkers();
    }
}


