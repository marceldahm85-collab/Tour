/* Gemeinsame Foto- und Videogalerie für gespeicherte Touren in der nativen Android-App.
 * Originalmedien bleiben in der Gerätegalerie; die App speichert nur lokale URI-Metadaten.
 * Die Tagesabfrage startet ausschließlich nach ausdrücklichem Öffnen der Medienauswahl.
 */
(() => {
    'use strict';

    const nativeBridge = window.TourNative;
    const nativeBridgeAvailable = !!nativeBridge &&
        typeof nativeBridge.postMessage === 'function' &&
        typeof nativeBridge.addEventListener === 'function';
    const isAndroidWebView = /;\s*wv\)/i.test(
        String(window.navigator && window.navigator.userAgent || '')
    );

    if (!nativeBridgeAvailable && !isAndroidWebView) return;

    const pendingRequests = new Map();
    let requestCounter = 0;
    let activePanel = null;
    let detailObserver = null;
    let nativeFeatures = new Set();
    let viewer = null;
    let viewerItems = [];
    let viewerIndex = 0;
    let viewerRequestToken = 0;
    let previousBodyOverflow = '';

    function nextRequestId() {
        requestCounter += 1;
        return 'atg-' + Date.now() + '-' + requestCounter;
    }

    function handleNativeMessage(event) {
        let message;
        try {
            message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (error) {
            console.warn('[Android-Galerie] Ungültige native Antwort.', error);
            return;
        }

        if (!message || typeof message !== 'object') return;
        const id = String(message.requestId || '');
        const pending = pendingRequests.get(id);
        if (!pending) return;

        pendingRequests.delete(id);
        window.clearTimeout(pending.timeout);
        pending.resolve(message);
    }

    if (nativeBridgeAvailable) {
        nativeBridge.addEventListener('message', handleNativeMessage);
    }

    function nativeRequest(type, payload, timeoutMs) {
        payload = payload || {};
        timeoutMs = timeoutMs || 18000;

        if (!nativeBridgeAvailable) {
            return Promise.reject(new Error('Die native Android-Medienschnittstelle ist in dieser App-Sitzung nicht verfügbar.'));
        }

        return new Promise((resolve, reject) => {
            const requestId = nextRequestId();
            const timeout = window.setTimeout(() => {
                pendingRequests.delete(requestId);
                reject(new Error('Die Android-Medienfunktion antwortet gerade nicht.'));
            }, timeoutMs);

            pendingRequests.set(requestId, { resolve, reject, timeout });
            try {
                nativeBridge.postMessage(JSON.stringify(Object.assign({
                    type: type,
                    requestId: requestId
                }, payload)));
            } catch (error) {
                window.clearTimeout(timeout);
                pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }

    async function checkNativeGalleryBridge() {
        try {
            const reply = await nativeRequest('bridge.ping', {}, 8000);
            nativeFeatures = new Set(Array.isArray(reply.features) ? reply.features : []);
            return nativeFeatures.has('gallery.mediaStore.v1') &&
                nativeFeatures.has('gallery.thumbnail.v1');
        } catch (error) {
            console.warn('[Android-Galerie] Native Galerie-Bridge antwortet nicht.', error);
            nativeFeatures = new Set();
            return false;
        }
    }

    function normalizeTourDate(value) {
        const raw = String(value || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        const german = raw.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
        if (german) {
            return german[3] + '-' +
                String(german[2]).padStart(2, '0') + '-' +
                String(german[1]).padStart(2, '0');
        }
        return '';
    }

    function detectMediaType(media) {
        const uri = String(media && media.uri || '');
        return media && media.mediaType === 'video' || /\/video\/media\/\d+$/i.test(uri)
            ? 'video' : 'photo';
    }

    function cleanMedia(media) {
        if (!media || typeof media.uri !== 'string' ||
            !/^content:\/\/media\/(external\/(images|video)\/media)\/\d+$/i.test(media.uri)) {
            return null;
        }

        return {
            uri: media.uri,
            mediaType: detectMediaType(media),
            displayName: String(media.displayName || (detectMediaType(media) === 'video' ? 'Video' : 'Foto')),
            dateTaken: Number(media.dateTaken) || 0,
            dateAdded: Number(media.dateAdded) || 0,
            dateBasis: media.dateBasis === 'capture' || media.dateBasis === 'added'
                ? media.dateBasis : '',
            relativePath: String(media.relativePath || '').replace(/\\/g, '/'),
            mimeType: String(media.mimeType || (detectMediaType(media) === 'video' ? 'video/*' : 'image/*')),
            width: Number(media.width) || 0,
            height: Number(media.height) || 0,
            sizeBytes: Number(media.sizeBytes) || 0,
            durationMillis: Number(media.durationMillis) || 0
        };
    }

    function getSavedMedia(entry) {
        const photos = Array.isArray(entry && entry.galleryPhotos) ? entry.galleryPhotos : [];
        const videos = Array.isArray(entry && entry.galleryVideos) ? entry.galleryVideos : [];
        const byUri = new Map();

        photos.concat(videos).forEach(item => {
            const media = cleanMedia(item);
            if (media) byUri.set(media.uri, media);
        });
        return Array.from(byUri.values()).sort(compareMedia);
    }

    function getSavedPhotos(entry) {
        return getSavedMedia(entry).filter(media => media.mediaType === 'photo');
    }

    function compareMedia(a, b) {
        const aTime = a.dateTaken > 0 ? a.dateTaken : a.dateAdded;
        const bTime = b.dateTaken > 0 ? b.dateTaken : b.dateAdded;
        return aTime - bTime || a.displayName.localeCompare(b.displayName, 'de');
    }

    function getMediaSourceLabel(media) {
        const path = String(media && media.relativePath || '').toLowerCase();
        if (path.includes('whatsapp')) return 'WhatsApp';
        const segments = path.split('/').filter(Boolean);
        if (segments[0] === 'dcim' && segments[1] === 'camera') return 'Kamera';
        if (path.includes('screenshot')) return 'Screenshots';
        if (path.includes('download')) return 'Downloads';
        return path ? 'Weitere Medien' : 'Galerie';
    }

    function getMediaMetaLabel(media) {
        const source = getMediaSourceLabel(media);
        const basis = media && media.dateBasis === 'added'
            ? 'Speicherdatum'
            : media && media.dateBasis === 'capture'
                ? 'Aufnahmedatum'
                : '';
        const duration = media && media.mediaType === 'video' && media.durationMillis > 0
            ? formatDuration(media.durationMillis) : '';
        return [source, basis, duration].filter(Boolean).join(' · ');
    }

    function formatDuration(value) {
        const seconds = Math.max(0, Math.floor(Number(value) / 1000));
        const minutes = Math.floor(seconds / 60);
        return minutes + ':' + String(seconds % 60).padStart(2, '0') + ' min';
    }

    function setStatus(panel, text, kind) {
        const node = panel && panel.querySelector('.atg-status');
        if (!node) return;
        node.textContent = text;
        node.dataset.kind = kind || 'info';
    }

    function disconnectThumbnailObserver(panel) {
        if (panel && panel._atgObserver) {
            panel._atgObserver.disconnect();
            panel._atgObserver = null;
        }
    }

    function watchThumbnail(panel, image) {
        if ('IntersectionObserver' in window) {
            if (!panel._atgObserver) {
                panel._atgObserver = new IntersectionObserver(entries => {
                    entries.forEach(item => {
                        if (!item.isIntersecting) return;
                        panel._atgObserver.unobserve(item.target);
                        loadThumbnail(item.target);
                    });
                }, { rootMargin: '240px 0px' });
            }
            panel._atgObserver.observe(image);
        } else {
            loadThumbnail(image);
        }
    }

    function ensurePhotoViewer() {
        if (viewer && viewer.isConnected) return viewer;

        const root = document.createElement('div');
        root.id = 'atg-photo-viewer';
        root.className = 'atg-photo-viewer';
        root.hidden = true;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = [
            '<div class="atg-viewer-header">',
              '<div class="atg-viewer-heading">',
                '<div class="atg-viewer-title">Tourfoto</div>',
                '<div class="atg-viewer-counter"></div>',
              '</div>',
              '<button type="button" class="atg-viewer-close" aria-label="Vollbild schließen">✕</button>',
            '</div>',
            '<div class="atg-viewer-stage">',
              '<div class="atg-viewer-loading" role="status">Foto wird geladen …</div>',
              '<img class="atg-viewer-image" alt="Tourfoto in Vollbildansicht">',
            '</div>',
            '<div class="atg-viewer-footer">',
              '<button type="button" class="atg-viewer-nav atg-viewer-prev" aria-label="Vorheriges Foto">‹</button>',
              '<span class="atg-viewer-hint">Das vollständige Bild wird ohne Beschnitt angezeigt.</span>',
              '<button type="button" class="atg-viewer-nav atg-viewer-next" aria-label="Nächstes Foto">›</button>',
            '</div>'
        ].join('');
        document.body.appendChild(root);

        root.querySelector('.atg-viewer-close').addEventListener('click', closePhotoViewer);
        root.querySelector('.atg-viewer-prev').addEventListener('click', () => changeViewerPhoto(-1));
        root.querySelector('.atg-viewer-next').addEventListener('click', () => changeViewerPhoto(1));
        root.addEventListener('click', event => {
            if (event.target === root) closePhotoViewer();
        });

        const stage = root.querySelector('.atg-viewer-stage');
        let touchStartX = 0;
        stage.addEventListener('touchstart', event => {
            touchStartX = event.changedTouches && event.changedTouches[0]
                ? event.changedTouches[0].clientX : 0;
        }, { passive: true });
        stage.addEventListener('touchend', event => {
            const endX = event.changedTouches && event.changedTouches[0]
                ? event.changedTouches[0].clientX : touchStartX;
            const delta = endX - touchStartX;
            if (Math.abs(delta) > 65) changeViewerPhoto(delta < 0 ? 1 : -1);
        }, { passive: true });

        viewer = root;
        return viewer;
    }

    function openPhotoViewer(panel, media, availableMedia) {
        const photos = (Array.isArray(availableMedia) ? availableMedia : getSavedMedia(panel._atgEntry))
            .filter(item => item && item.mediaType === 'photo');
        const current = cleanMedia(media);
        if (!current || current.mediaType !== 'photo') return;

        viewerItems = photos.length ? photos : [current];
        let index = viewerItems.findIndex(item => item.uri === current.uri);
        if (index < 0) {
            viewerItems.push(current);
            index = viewerItems.length - 1;
        }

        const root = ensurePhotoViewer();
        if (root.hidden) {
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        root.hidden = false;
        root.classList.add('is-open');
        root.setAttribute('aria-hidden', 'false');
        showViewerPhoto(index);
    }

    function closePhotoViewer() {
        if (!viewer || viewer.hidden) return;
        viewer.classList.remove('is-open');
        viewer.hidden = true;
        viewer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = previousBodyOverflow;
        viewerRequestToken += 1;
    }

    function changeViewerPhoto(direction) {
        if (!viewer || viewer.hidden || viewerItems.length < 2) return;
        const next = (viewerIndex + direction + viewerItems.length) % viewerItems.length;
        showViewerPhoto(next);
    }

    async function showViewerPhoto(index) {
        if (!viewer || !viewerItems.length) return;
        viewerIndex = Math.max(0, Math.min(index, viewerItems.length - 1));
        const media = viewerItems[viewerIndex];
        const token = ++viewerRequestToken;
        const image = viewer.querySelector('.atg-viewer-image');
        const loading = viewer.querySelector('.atg-viewer-loading');
        const title = viewer.querySelector('.atg-viewer-title');
        const counter = viewer.querySelector('.atg-viewer-counter');
        const previous = viewer.querySelector('.atg-viewer-prev');
        const next = viewer.querySelector('.atg-viewer-next');

        image.removeAttribute('src');
        image.hidden = true;
        loading.hidden = false;
        loading.textContent = 'Foto wird geladen …';
        title.textContent = media.displayName || 'Tourfoto';
        counter.textContent = (viewerIndex + 1) + ' / ' + viewerItems.length;
        previous.hidden = viewerItems.length < 2;
        next.hidden = viewerItems.length < 2;

        try {
            if (!nativeFeatures.has('gallery.thumbnail.v1')) {
                await checkNativeGalleryBridge();
            }
            const action = nativeFeatures.has('gallery.image.full.v1')
                ? 'gallery.image.full' : 'gallery.thumbnail';
            const response = await nativeRequest(action, { uri: media.uri }, 30000);
            if (token !== viewerRequestToken || viewer.hidden) return;
            if (response.status !== 'ok' || !response.data) {
                throw new Error(response.status === 'permission_required'
                    ? 'Für dieses Foto fehlt aktuell der Galerie-Zugriff.'
                    : 'Das Foto kann gerade nicht geladen werden.');
            }
            image.src = 'data:' + (response.mimeType || 'image/jpeg') + ';base64,' + response.data;
            image.hidden = false;
            loading.hidden = true;
        } catch (error) {
            if (token !== viewerRequestToken || viewer.hidden) return;
            loading.textContent = error.message || 'Foto konnte nicht geladen werden.';
        }
    }

    function handleViewerKeys(event) {
        if (!viewer || viewer.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closePhotoViewer();
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            changeViewerPhoto(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            changeViewerPhoto(1);
        }
    }
    document.addEventListener('keydown', handleViewerKeys);

    async function playVideo(panel, media) {
        if (!nativeFeatures.has('gallery.video.player.v1')) {
            await checkNativeGalleryBridge();
        }
        if (!nativeFeatures.has('gallery.video.player.v1')) {
            setStatus(
                panel,
                'Für die Videowiedergabe innerhalb der App ist die aktuelle Android-App-Version erforderlich. Bitte installiere das aktualisierte APK.',
                'warning'
            );
            return;
        }

        try {
            const result = await nativeRequest('gallery.video.play', {
                uri: media.uri,
                title: media.displayName || 'Tourvideo'
            }, 12000);
            if (result.status === 'started') return;
            if (result.status === 'permission_required') {
                setStatus(panel, 'Für dieses Video fehlt der Zugriff auf Videos. Öffne die Medienauswahl und erteile die Freigabe.', 'warning');
            } else {
                setStatus(panel, 'Der Video-Player konnte nicht geöffnet werden.', 'error');
            }
        } catch (error) {
            setStatus(panel, error.message || 'Der Video-Player antwortet gerade nicht.', 'error');
        }
    }

    function createMediaCard(panel, media, selectable, selected, onToggle, mediaList) {
        const card = document.createElement('article');
        card.className = 'atg-photo-card atg-media-card';
        if (media.mediaType === 'video') card.classList.add('is-video');
        card.classList.toggle('is-selected', !!selected);

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'atg-thumb-wrap';
        if (media.mediaType === 'video') thumbWrap.classList.add('is-video');
        thumbWrap.setAttribute('role', 'button');
        thumbWrap.setAttribute('tabindex', '0');
        thumbWrap.setAttribute('aria-label', media.mediaType === 'video'
            ? 'Video abspielen: ' + media.displayName
            : 'Foto im Vollbild öffnen: ' + media.displayName);

        const placeholder = document.createElement('div');
        placeholder.className = 'atg-thumb-placeholder';
        placeholder.textContent = media.mediaType === 'video' ? '▶' : '⛰';
        thumbWrap.appendChild(placeholder);

        const image = document.createElement('img');
        image.className = 'atg-thumb';
        image.alt = media.displayName || (media.mediaType === 'video' ? 'Tourvideo' : 'Tourfoto');
        image.loading = 'lazy';
        image.decoding = 'async';
        image.dataset.uri = media.uri;
        thumbWrap.appendChild(image);

        if (media.mediaType === 'video') {
            const play = document.createElement('span');
            play.className = 'atg-video-play';
            play.setAttribute('aria-hidden', 'true');
            play.textContent = '▶';
            thumbWrap.appendChild(play);
        }

        const activate = () => {
            if (media.mediaType === 'video') playVideo(panel, media);
            else openPhotoViewer(panel, media, mediaList);
        };
        thumbWrap.addEventListener('click', activate);
        thumbWrap.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
            }
        });

        const name = document.createElement('div');
        name.className = 'atg-photo-name';
        name.textContent = media.displayName || (media.mediaType === 'video' ? 'Video' : 'Foto');

        const meta = document.createElement('div');
        meta.className = 'atg-photo-meta';
        meta.textContent = getMediaMetaLabel(media);

        card.append(thumbWrap, name, meta);

        if (selectable) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'atg-select-btn';
            button.classList.toggle('is-selected', !!selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
            button.textContent = selected ? '✓ Ausgewählt' : '+ Auswählen';
            button.addEventListener('click', () => onToggle(card, button));
            card.appendChild(button);
        }

        watchThumbnail(panel, image);
        return card;
    }

    function makePanel(entry) {
        const panel = document.createElement('section');
        panel.className = 'atg-panel';
        panel.id = 'td-gallery-panel';
        panel.dataset.tourId = String(entry.id || '');
        panel._atgEntry = entry;
        panel.innerHTML = [
            '<div class="atg-heading">',
              '<div class="atg-heading-copy">',
                '<div class="atg-title">Tourmedien</div>',
                '<div class="atg-subtitle"></div>',
              '</div>',
              '<span class="atg-count">0 zugeordnet</span>',
            '</div>',
            '<div class="atg-display">',
              '<div class="atg-empty atg-display-empty">Noch keine Fotos oder Videos zugeordnet.</div>',
              '<div class="atg-grid atg-saved-grid" aria-label="Der Tour zugeordnete Fotos und Videos" hidden></div>',
              '<div class="atg-actions atg-display-actions">',
                '<button type="button" class="atg-manage-btn">Medien hinzufügen</button>',
              '</div>',
            '</div>',
            '<div class="atg-picker" hidden>',
              '<div class="atg-status" role="status" aria-live="polite">Mediengalerie wird vorbereitet …</div>',
              '<div class="atg-actions atg-picker-top-actions">',
                '<button type="button" class="atg-access-btn" hidden>Medienzugriff erlauben</button>',
                '<button type="button" class="atg-refresh-btn" hidden>Erneut suchen</button>',
              '</div>',
              '<div class="atg-grid atg-picker-grid" aria-label="Fotos und Videos vom Tourtag"></div>',
              '<div class="atg-picker-footer">',
                '<span class="atg-picker-count">0 ausgewählt</span>',
                '<div class="atg-actions atg-picker-footer-actions">',
                  '<button type="button" class="atg-cancel-btn">Abbrechen</button>',
                  '<button type="button" class="atg-apply-btn" disabled>Auswahl übernehmen</button>',
                '</div>',
              '</div>',
            '</div>',
            '<div class="atg-footnote">Die Originalfotos und -videos bleiben in deiner Gerätegalerie. Gespeichert werden nur lokale Medienverweise, keine Medienkopien.</div>'
        ].join('');

        const date = normalizeTourDate(entry.date);
        panel.querySelector('.atg-subtitle').textContent = date
            ? new Date(date + 'T12:00:00').toLocaleDateString('de-AT', {
                weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
            })
            : 'Kein gültiges Tourdatum';

        panel.querySelector('.atg-manage-btn').addEventListener('click', () => {
            openMediaPicker(panel, entry);
        });
        panel.querySelector('.atg-access-btn').addEventListener('click', () => {
            requestGalleryAccess(panel, entry);
        });
        panel.querySelector('.atg-refresh-btn').addEventListener('click', () => {
            searchTourDate(panel, entry);
        });
        panel.querySelector('.atg-cancel-btn').addEventListener('click', () => {
            cancelMediaPicker(panel, entry);
        });
        panel.querySelector('.atg-apply-btn').addEventListener('click', () => {
            applyMediaSelection(panel, entry);
        });

        return panel;
    }

    function insertPanel(panel, body) {
        body.appendChild(panel);
    }

    async function waitForTourStorageCommit() {
        if (typeof _storageWriteQueue === 'undefined' ||
            typeof _idbGet !== 'function') {
            throw new Error('Die dauerhafte Tourenspeicherung ist in dieser App-Version nicht erreichbar.');
        }

        let queueSnapshot;
        do {
            queueSnapshot = _storageWriteQueue;
            await queueSnapshot;
        } while (queueSnapshot !== _storageWriteQueue);

        const persistedTours = await _idbGet('touren');
        if (!Array.isArray(persistedTours)) {
            throw new Error('Die gespeicherten Tourdaten konnten nach dem Schreiben nicht zurückgelesen werden.');
        }
        return persistedTours;
    }

    function getLatestStoredTour(entry) {
        const tourId = String(entry && entry.id || '');
        if (!tourId || typeof appStorage === 'undefined' || !appStorage) return entry;

        const tours = appStorage.get('touren') || [];
        return tours.find(item => String(item && item.id || '') === tourId) || entry;
    }

    async function saveMediaSelection(entry, selectedMedia, panel) {
        try {
            if (typeof appStorage === 'undefined' || !appStorage) {
                throw new Error('Der Tourenspeicher ist nicht verfügbar.');
            }
            const tourId = String(entry.id || '');
            if (!tourId) throw new Error('Der Tour fehlt eine eindeutige Kennung.');

            const allTours = (appStorage.get('touren') || []).slice();
            const index = allTours.findIndex(item => String(item && item.id || '') === tourId);
            if (index < 0) throw new Error('Die Tour wurde im Speicher nicht gefunden.');

            const metadata = selectedMedia.map(cleanMedia).filter(Boolean);
            const photos = metadata.filter(item => item.mediaType === 'photo');
            const videos = metadata.filter(item => item.mediaType === 'video');
            allTours[index] = Object.assign({}, allTours[index], {
                galleryPhotos: photos,
                galleryVideos: videos
            });

            appStorage.set('touren', allTours);
            const persistedTours = await waitForTourStorageCommit();
            const persistedEntry = persistedTours.find(
                item => String(item && item.id || '') === tourId
            );
            const persistedPhotos = Array.isArray(persistedEntry && persistedEntry.galleryPhotos)
                ? persistedEntry.galleryPhotos.map(cleanMedia).filter(Boolean) : [];
            const persistedVideos = Array.isArray(persistedEntry && persistedEntry.galleryVideos)
                ? persistedEntry.galleryVideos.map(cleanMedia).filter(Boolean) : [];

            const expectedUris = metadata.map(item => item.uri).sort();
            const actualUris = persistedPhotos.concat(persistedVideos).map(item => item.uri).sort();
            if (expectedUris.length !== actualUris.length ||
                expectedUris.some((uri, index) => uri !== actualUris[index])) {
                throw new Error('Die Medienauswahl wurde nicht dauerhaft gespeichert. Bitte versuche es erneut.');
            }

            entry.galleryPhotos = persistedPhotos.filter(item => item.mediaType === 'photo');
            entry.galleryVideos = persistedVideos.filter(item => item.mediaType === 'video');
            try {
                if (typeof currentDetailEntry !== 'undefined' &&
                    currentDetailEntry &&
                    String(currentDetailEntry.id || '') === tourId) {
                    currentDetailEntry.galleryPhotos = entry.galleryPhotos;
                    currentDetailEntry.galleryVideos = entry.galleryVideos;
                }
            } catch (_) {
                // Der verifizierte Datenbankeintrag ist maßgeblich.
            }
            return true;
        } catch (error) {
            console.error('[Android-Galerie] Dauerhafte Medienzuordnung fehlgeschlagen.', error);
            setStatus(panel, error.message || 'Medienauswahl konnte nicht dauerhaft gespeichert werden.', 'error');
            return false;
        }
    }

    function renderSavedMedia(panel, entry) {
        disconnectThumbnailObserver(panel);
        const savedMedia = getSavedMedia(entry);
        const count = panel.querySelector('.atg-count');
        const empty = panel.querySelector('.atg-display-empty');
        const grid = panel.querySelector('.atg-saved-grid');
        const manage = panel.querySelector('.atg-manage-btn');

        count.textContent = savedMedia.length + ' zugeordnet';
        manage.textContent = savedMedia.length ? 'Medien bearbeiten' : 'Medien hinzufügen';
        empty.hidden = savedMedia.length > 0;
        grid.hidden = savedMedia.length === 0;
        grid.replaceChildren();

        savedMedia.forEach(media => {
            grid.appendChild(createMediaCard(panel, media, false, false, null, savedMedia));
        });
    }

    function setPickerVisible(panel, visible) {
        panel.querySelector('.atg-display').hidden = visible;
        panel.querySelector('.atg-picker').hidden = !visible;
    }

    function updatePickerSelection(panel) {
        const state = panel._atgPickerState;
        if (!state) return;
        const count = panel.querySelector('.atg-picker-count');
        const apply = panel.querySelector('.atg-apply-btn');
        if (count) count.textContent = state.selected.size + ' ausgewählt';

        const savedUris = new Set(state.saved.map(media => media.uri));
        const changed = state.selected.size !== savedUris.size ||
            Array.from(state.selected).some(uri => !savedUris.has(uri));
        if (apply) apply.disabled = !changed || state.loading;
    }

    function renderSelectionGrid(panel, entry, result) {
        disconnectThumbnailObserver(panel);
        const saved = getSavedMedia(entry);
        const mediaMap = new Map();
        let responseItems = Array.isArray(result.media) ? result.media : [];

        if (!responseItems.length) {
            responseItems = (Array.isArray(result.photos) ? result.photos : [])
                .concat(Array.isArray(result.videos) ? result.videos : []);
        }

        responseItems.map(cleanMedia).filter(Boolean).forEach(media => {
            mediaMap.set(media.uri, media);
        });
        saved.forEach(media => {
            if (!mediaMap.has(media.uri)) mediaMap.set(media.uri, media);
        });

        const allMedia = Array.from(mediaMap.values()).sort(compareMedia);
        const selected = new Set(saved.map(media => media.uri));
        panel._atgPickerState = {
            saved: saved,
            media: allMedia,
            selected: selected,
            loading: false
        };

        const grid = panel.querySelector('.atg-picker-grid');
        grid.replaceChildren();

        if (result.status === 'partial_results') {
            setStatus(
                panel,
                (Number(result.count) || 0) + ' freigegebene Medien gefunden. Android zeigt nur Fotos und Videos, für die du Zugriff erteilt hast; Herkunft und Datumsbasis stehen unter jedem Eintrag.',
                'warning'
            );
        } else {
            setStatus(
                panel,
                (Number(result.count) || 0) + ' Fotos und Videos gefunden. WhatsApp- und andere indexierte Ordner sind eingeschlossen.',
                'info'
            );
        }

        if (result.truncated) {
            const note = document.createElement('div');
            note.className = 'atg-empty atg-result-note';
            note.textContent = 'Die Medienauswahl ist auf 500 Einträge begrenzt.';
            grid.appendChild(note);
        }

        if (allMedia.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'atg-empty';
            empty.textContent = 'Für dieses Datum wurden keine freigegebenen Fotos oder Videos gefunden.';
            grid.appendChild(empty);
        }

        allMedia.forEach(media => {
            const isSelected = selected.has(media.uri);
            const card = createMediaCard(
                panel,
                media,
                true,
                isSelected,
                (cardNode, button) => {
                    if (selected.has(media.uri)) selected.delete(media.uri);
                    else selected.add(media.uri);
                    const nowSelected = selected.has(media.uri);
                    cardNode.classList.toggle('is-selected', nowSelected);
                    button.classList.toggle('is-selected', nowSelected);
                    button.setAttribute('aria-pressed', nowSelected ? 'true' : 'false');
                    button.textContent = nowSelected ? '✓ Ausgewählt' : '+ Auswählen';
                    updatePickerSelection(panel);
                },
                allMedia
            );
            grid.appendChild(card);
        });

        updatePickerSelection(panel);
        panel.querySelector('.atg-access-btn').hidden = result.access !== 'partial';
        panel.querySelector('.atg-access-btn').textContent = 'Weitere Medien freigeben';
        panel.querySelector('.atg-refresh-btn').hidden = false;
    }

    function showSavedMediaInPicker(panel, entry, message, kind, showAccess) {
        renderSelectionGrid(panel, entry, {
            media: [],
            photos: [],
            videos: [],
            count: 0,
            status: 'ok',
            access: 'none',
            truncated: false
        });
        setStatus(panel, message, kind || 'warning');
        panel.querySelector('.atg-access-btn').hidden = !showAccess;
        panel.querySelector('.atg-access-btn').textContent = 'Medienzugriff erlauben';
        panel.querySelector('.atg-refresh-btn').hidden = !nativeBridgeAvailable;
    }

    async function openMediaPicker(panel, entry) {
        setPickerVisible(panel, true);
        disconnectThumbnailObserver(panel);
        const saved = getSavedMedia(entry);
        panel._atgPickerState = {
            saved: saved,
            media: [],
            selected: new Set(saved.map(media => media.uri)),
            loading: true
        };
        panel.querySelector('.atg-picker-grid').replaceChildren();
        panel.querySelector('.atg-access-btn').hidden = true;
        panel.querySelector('.atg-refresh-btn').hidden = false;
        panel.querySelector('.atg-refresh-btn').textContent = 'Erneut suchen';
        updatePickerSelection(panel);
        setStatus(panel, 'Verbindung zur Android-Mediengalerie wird geprüft …');
        await searchTourDate(panel, entry);
    }

    async function requestGalleryAccess(panel, entry) {
        const button = panel.querySelector('.atg-access-btn');
        button.disabled = true;
        button.textContent = 'Berechtigung wird geprüft …';
        try {
            const permission = await nativeRequest('gallery.permission.request');
            if (permission.access === 'none') {
                setStatus(
                    panel,
                    'Kein Medienzugriff erteilt. Du kannst die Berechtigung später in den Android-App-Einstellungen freigeben.',
                    'warning'
                );
                button.textContent = 'Medienzugriff erneut anfragen';
                return;
            }
            await searchTourDate(panel, entry);
        } catch (error) {
            setStatus(panel, error.message || 'Medienzugriff konnte nicht angefragt werden.', 'error');
            button.textContent = 'Medienzugriff erneut anfragen';
        } finally {
            button.disabled = false;
        }
    }

    async function searchTourDate(panel, entry) {
        const date = normalizeTourDate(entry.date);
        const refresh = panel.querySelector('.atg-refresh-btn');
        refresh.disabled = true;
        refresh.hidden = false;
        refresh.textContent = 'Suche läuft …';

        if (!date) {
            setStatus(panel, 'Für diese Tour ist kein gültiges Datum hinterlegt.', 'warning');
            refresh.disabled = false;
            refresh.textContent = 'Erneut suchen';
            return;
        }

        const state = panel._atgPickerState;
        if (state) {
            state.loading = true;
            updatePickerSelection(panel);
        }
        setStatus(panel, 'Suche nach dem Aufnahmedatum; falls es fehlt, zählt das Speicherdatum dieser Etappe …');

        try {
            const supported = await checkNativeGalleryBridge();
            if (!supported) {
                showSavedMediaInPicker(
                    panel,
                    entry,
                    nativeBridgeAvailable
                        ? 'Die Android-Mediengalerie antwortet gerade nicht. Bereits zugeordnete Medien bleiben bearbeitbar.'
                        : 'Die native Android-Mediengalerie wurde nicht erkannt. Bereits zugeordnete Medien bleiben bearbeitbar.',
                    'error',
                    false
                );
                return;
            }

            const permission = await nativeRequest('gallery.permission.get');
            if (permission.access === 'none') {
                showSavedMediaInPicker(
                    panel,
                    entry,
                    'Für neue Medien ist eine Galerie-Freigabe erforderlich. Bereits zugeordnete Fotos und Videos bleiben hier bearbeitbar.',
                    'warning',
                    true
                );
                return;
            }

            const action = nativeFeatures.has('gallery.mediaStore.v2')
                ? 'gallery.media.byDate' : 'gallery.photos.byDate';
            const result = await nativeRequest(action, { date: date }, 30000);
            if (activePanel !== panel || !panel.isConnected) return;

            if (result.status === 'permission_required' || result.status === 'permission_changed') {
                showSavedMediaInPicker(
                    panel,
                    entry,
                    'Der Galerie-Zugriff wurde nicht erteilt oder zwischenzeitlich geändert. Bereits zugeordnete Medien kannst du weiterhin bearbeiten.',
                    'warning',
                    true
                );
                return;
            }
            if (result.status === 'invalid_date') {
                setStatus(panel, 'Das Tourdatum ist ungültig und konnte nicht abgefragt werden.', 'error');
                return;
            }
            if (result.status !== 'ok' && result.status !== 'partial_results') {
                setStatus(panel, 'Fotos und Videos für dieses Datum konnten nicht durchsucht werden.', 'error');
                return;
            }

            renderSelectionGrid(panel, entry, result);
        } catch (error) {
            if (activePanel !== panel || !panel.isConnected) return;
            showSavedMediaInPicker(
                panel,
                entry,
                error.message || 'Die Mediengalerie konnte nicht durchsucht werden.',
                'error',
                false
            );
        } finally {
            if (panel.isConnected) {
                const currentState = panel._atgPickerState;
                if (currentState) {
                    currentState.loading = false;
                    updatePickerSelection(panel);
                }
                refresh.disabled = false;
                refresh.textContent = 'Erneut suchen';
            }
        }
    }

    function cancelMediaPicker(panel, entry) {
        disconnectThumbnailObserver(panel);
        panel._atgPickerState = null;
        setPickerVisible(panel, false);
        renderSavedMedia(panel, entry);
    }

    async function applyMediaSelection(panel, entry) {
        const state = panel._atgPickerState;
        if (!state || state.loading) return;
        const nextMedia = state.media.filter(media => state.selected.has(media.uri));
        const applyButton = panel.querySelector('.atg-apply-btn');
        state.loading = true;
        if (applyButton) {
            applyButton.disabled = true;
            applyButton.textContent = 'Speichere …';
        }

        try {
            const saved = await saveMediaSelection(entry, nextMedia, panel);
            if (!saved) return;
            panel._atgPickerState = null;
            setPickerVisible(panel, false);
            renderSavedMedia(panel, entry);
        } finally {
            if (panel.isConnected) {
                if (panel._atgPickerState === state) {
                    state.loading = false;
                    updatePickerSelection(panel);
                }
                if (applyButton) {
                    applyButton.textContent = 'Auswahl übernehmen';
                    applyButton.disabled = false;
                }
            }
        }
    }

    async function loadThumbnail(img) {
        if (!img || img.dataset.loading === '1' || img.dataset.loaded === '1') return;
        const uri = img.dataset.uri;
        if (!uri) return;
        img.dataset.loading = '1';
        try {
            const response = await nativeRequest('gallery.thumbnail', { uri: uri }, 22000);
            if (!img.isConnected) return;
            if (response.status === 'ok' && response.data) {
                img.src = 'data:' + (response.mimeType || 'image/jpeg') + ';base64,' + response.data;
                img.dataset.loaded = '1';
                img.closest('.atg-thumb-wrap')?.classList.add('has-image');
            } else {
                img.closest('.atg-thumb-wrap')?.classList.add('is-unavailable');
            }
        } catch (error) {
            if (img.isConnected) img.closest('.atg-thumb-wrap')?.classList.add('is-unavailable');
        } finally {
            delete img.dataset.loading;
        }
    }

    async function mountGalleryPanel(entry) {
        const latestEntry = getLatestStoredTour(entry) || entry;
        const tourId = String(latestEntry && latestEntry.id || '');
        if (activePanel && activePanel.isConnected &&
            activePanel.dataset.tourId === tourId) {
            return;
        }

        const body = document.getElementById('td-body');
        const modal = document.getElementById('tour-detail-modal');
        if (!body || !modal || modal.classList.contains('hidden')) return;

        if (activePanel) disconnectThumbnailObserver(activePanel);
        if (activePanel) activePanel.remove();
        activePanel = null;

        const panel = makePanel(latestEntry);
        activePanel = panel;
        insertPanel(panel, body);
        renderSavedMedia(panel, latestEntry);
    }

    function installTourDetailHook() {
        const originalOpen = window.openTourDetail;
        if (typeof originalOpen !== 'function' || originalOpen.__atgWrapped) return false;

        const wrappedOpen = async function(entry, options) {
            const result = await originalOpen.apply(this, arguments);
            if (entry && !entry._isMultidaySummary) {
                try {
                    await mountGalleryPanel(entry);
                } catch (error) {
                    console.error('[Android-Galerie] Touransicht konnte nicht ergänzt werden.', error);
                }
            }
            return result;
        };
        wrappedOpen.__atgWrapped = true;
        window.openTourDetail = wrappedOpen;
        return true;
    }

    function getCurrentSavedDetailEntry() {
        try {
            if (typeof currentDetailType !== 'undefined' && currentDetailType !== 'saved') {
                return null;
            }
            if (typeof currentDetailEntry !== 'undefined' && currentDetailEntry) {
                return currentDetailEntry;
            }
        } catch (_) {
            // Fallback auf die Window-Property, falls die App den Zustand dort ablegt.
        }
        return window.currentDetailEntry || null;
    }

    function installTourDetailObserver() {
        if (detailObserver) return;
        const modal = document.getElementById('tour-detail-modal');
        const body = document.getElementById('td-body');
        if (!modal || !body || typeof MutationObserver !== 'function') return;

        const syncPanel = () => {
            if (modal.classList.contains('hidden')) {
                closePhotoViewer();
                return;
            }

            const entry = getCurrentSavedDetailEntry();
            if (!entry || entry._isMultidaySummary || !entry.id) return;
            const existing = body.querySelector('#td-gallery-panel');
            if (existing && existing.dataset.tourId === String(entry.id)) return;

            mountGalleryPanel(entry).catch(error => {
                console.error('[Android-Galerie] Detailbeobachtung konnte den Medienbereich nicht einblenden.', error);
            });
        };

        detailObserver = new MutationObserver(syncPanel);
        detailObserver.observe(body, { childList: true });
        detailObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    function excludeDeviceReferencesFromBackup() {
        const originalBuild = window.buildAppDataPayload;
        if (typeof originalBuild !== 'function' || originalBuild.__atgWrapped) return;

        const wrappedBuild = async function() {
            const payload = await originalBuild.apply(this, arguments);
            if (Array.isArray(payload && payload.touren)) {
                payload.touren.forEach(tour => {
                    if (tour && typeof tour === 'object') {
                        delete tour.galleryPhotos;
                        delete tour.galleryVideos;
                    }
                });
            }
            return payload;
        };
        wrappedBuild.__atgWrapped = true;
        window.buildAppDataPayload = wrappedBuild;
    }

    installTourDetailHook();
    installTourDetailObserver();
    excludeDeviceReferencesFromBackup();

    document.addEventListener('DOMContentLoaded', () => {
        installTourDetailHook();
        installTourDetailObserver();
        excludeDeviceReferencesFromBackup();
    });
})();
