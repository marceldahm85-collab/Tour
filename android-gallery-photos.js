/* Android-Galeriezuordnung für gespeicherte Touren.
 * Läuft nur in der nativen Android-WebView mit unterstützter TourNative-Bridge.
 * Browser-PWA und bestehende Tourbildfunktion bleiben unverändert.
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

    // Außerhalb der nativen Android-WebView bleibt die normale PWA vollständig unverändert.
    if (!nativeBridgeAvailable && !isAndroidWebView) return;

    if (!nativeBridgeAvailable) {
        console.error('[Android-Galerie] Die native TourNative-Bridge wurde in dieser WebView nicht bereitgestellt. Der Fotobereich zeigt den Verbindungsfehler in der Tourdetailansicht an.');
    }

    const pendingRequests = new Map();
    let requestCounter = 0;
    let openSequence = 0;
    let activePanel = null;
    let detailObserver = null;

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
            return Promise.reject(new Error('Die native Android-Galerie-Bridge ist in dieser App-Sitzung nicht verfügbar.'));
        }

        return new Promise((resolve, reject) => {
            const requestId = nextRequestId();
            const timeout = window.setTimeout(() => {
                pendingRequests.delete(requestId);
                reject(new Error('Die Android-Fotofunktion antwortet gerade nicht.'));
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

    const bridgeReady = nativeBridgeAvailable
        ? nativeRequest('bridge.ping', {}, 8000)
            .then(reply => {
                const features = Array.isArray(reply.features) ? reply.features : [];
                return features.includes('gallery.mediaStore.v1') &&
                    features.includes('gallery.thumbnail.v1');
            })
            .catch(error => {
                console.warn('[Android-Galerie] Native Galerie-Bridge nicht bereit.', error);
                return false;
            })
        : Promise.resolve(false);

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

    function cleanPhoto(photo) {
        if (!photo || typeof photo.uri !== 'string' ||
            !photo.uri.startsWith('content://media/')) {
            return null;
        }

        return {
            uri: photo.uri,
            displayName: String(photo.displayName || 'Foto'),
            dateTaken: Number(photo.dateTaken) || 0,
            mimeType: String(photo.mimeType || 'image/*'),
            width: Number(photo.width) || 0,
            height: Number(photo.height) || 0,
            sizeBytes: Number(photo.sizeBytes) || 0
        };
    }

    function setStatus(panel, text, kind) {
        const node = panel.querySelector('.atg-status');
        if (!node) return;
        node.textContent = text;
        node.dataset.kind = kind || 'info';
    }

    function updateSelectedCount(panel, selected) {
        const node = panel.querySelector('.atg-count');
        if (node) node.textContent = selected.size + ' zugeordnet';
    }

    function makePanel(entry) {
        const panel = document.createElement('section');
        panel.className = 'atg-panel';
        panel.id = 'td-gallery-panel';
        panel.dataset.tourId = String(entry.id || '');
        panel.innerHTML = [
            '<div class="atg-heading">',
              '<div class="atg-heading-copy">',
                '<div class="atg-title">Fotos vom Tourtag</div>',
                '<div class="atg-subtitle"></div>',
              '</div>',
              '<span class="atg-count">0 zugeordnet</span>',
            '</div>',
            '<div class="atg-status" role="status" aria-live="polite">Galerie wird vorbereitet …</div>',
            '<div class="atg-actions">',
              '<button type="button" class="atg-access-btn">Galeriezugriff erlauben</button>',
              '<button type="button" class="atg-refresh-btn">Erneut suchen</button>',
            '</div>',
            '<div class="atg-grid" aria-label="Fotos vom Tourtag"></div>',
            '<div class="atg-footnote">Ausgewählte Fotos bleiben in deiner Samsung-Galerie. Die App speichert nur lokale Bildverweise, keine Bildkopien.</div>'
        ].join('');

        const date = normalizeTourDate(entry.date);
        panel.querySelector('.atg-subtitle').textContent = date
            ? new Date(date + 'T12:00:00').toLocaleDateString('de-AT', {
                weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
            })
            : 'Kein gültiges Tourdatum';

        panel.querySelector('.atg-access-btn').addEventListener('click', () => {
            requestGalleryAccess(panel, entry);
        });
        panel.querySelector('.atg-refresh-btn').addEventListener('click', () => {
            searchTourDate(panel, entry);
        });

        return panel;
    }

    function insertPanel(panel, body) {
        const anchor = body.querySelector('.tour-detail-image-wrap') ||
            body.querySelector('.modal-detail-grid');
        if (anchor) anchor.insertAdjacentElement('afterend', panel);
        else body.appendChild(panel);
    }

    function getSavedPhotos(entry) {
        return Array.isArray(entry.galleryPhotos)
            ? entry.galleryPhotos.map(cleanPhoto).filter(Boolean)
            : [];
    }

    function saveSelection(entry, selectedPhotos, panel) {
        try {
            if (typeof appStorage === 'undefined' || !appStorage) {
                throw new Error('Der Tourenspeicher ist nicht verfügbar.');
            }

            const tourId = String(entry.id || '');
            if (!tourId) throw new Error('Der Tour fehlt eine eindeutige Kennung.');

            const allTours = appStorage.get('touren') || [];
            const index = allTours.findIndex(item => String(item && item.id || '') === tourId);
            if (index < 0) throw new Error('Die Tour wurde im Speicher nicht gefunden.');

            const metadata = selectedPhotos.map(cleanPhoto).filter(Boolean);
            allTours[index] = Object.assign({}, allTours[index], {
                galleryPhotos: metadata
            });
            appStorage.set('touren', allTours);

            entry.galleryPhotos = metadata;
            try {
                if (typeof currentDetailEntry !== 'undefined' &&
                    currentDetailEntry &&
                    String(currentDetailEntry.id || '') === tourId) {
                    currentDetailEntry.galleryPhotos = metadata;
                }
            } catch (_) {
                // Die Detailansicht bleibt auch ohne globales currentDetailEntry nutzbar.
            }

            setStatus(
                panel,
                metadata.length + ' Foto' + (metadata.length === 1 ? '' : 's') + ' dieser Etappe gespeichert.',
                'success'
            );
            return true;
        } catch (error) {
            console.error('[Android-Galerie] Zuordnung konnte nicht gespeichert werden.', error);
            setStatus(panel, error.message || 'Fotoauswahl konnte nicht gespeichert werden.', 'error');
            return false;
        }
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
                    'Kein Galerie-Zugriff erteilt. Du kannst die Berechtigung später in den Android-App-Einstellungen freigeben.',
                    'warning'
                );
                button.textContent = 'Galeriezugriff erneut anfragen';
                return;
            }
            await searchTourDate(panel, entry);
        } catch (error) {
            setStatus(panel, error.message || 'Galeriezugriff konnte nicht angefragt werden.', 'error');
            button.textContent = 'Galeriezugriff erneut anfragen';
        } finally {
            button.disabled = false;
        }
    }

    async function searchTourDate(panel, entry) {
        const date = normalizeTourDate(entry.date);
        if (!date) {
            setStatus(panel, 'Für diese Tour ist kein gültiges Datum hinterlegt.', 'warning');
            return;
        }

        const refresh = panel.querySelector('.atg-refresh-btn');
        refresh.disabled = true;
        refresh.textContent = 'Suche läuft …';
        setStatus(panel, 'Suche nach Fotos mit dem Aufnahmedatum dieser Etappe …');

        try {
            const permission = await nativeRequest('gallery.permission.get');
            if (permission.access === 'none') {
                panel.querySelector('.atg-access-btn').hidden = false;
                panel.querySelector('.atg-refresh-btn').hidden = true;
                setStatus(
                    panel,
                    'Für den automatischen Fotoabgleich ist eine einmalige Galerie-Freigabe erforderlich.',
                    'warning'
                );
                return;
            }

            const result = await nativeRequest('gallery.photos.byDate', { date: date }, 26000);
            if (activePanel !== panel || !panel.isConnected) return;

            if (result.status === 'permission_required' || result.status === 'permission_changed') {
                panel.querySelector('.atg-access-btn').hidden = false;
                panel.querySelector('.atg-refresh-btn').hidden = true;
                setStatus(panel, 'Der Galerie-Zugriff wurde nicht erteilt oder zwischenzeitlich geändert.', 'warning');
                return;
            }
            if (result.status === 'invalid_date') {
                setStatus(panel, 'Das Tourdatum ist ungültig und konnte nicht abgefragt werden.', 'error');
                return;
            }
            if (result.status !== 'ok' && result.status !== 'partial_results') {
                setStatus(panel, 'Die Fotos für dieses Datum konnten nicht durchsucht werden.', 'error');
                return;
            }

            panel.querySelector('.atg-access-btn').hidden = result.access !== 'partial';
            panel.querySelector('.atg-refresh-btn').hidden = false;
            renderPhotos(panel, entry, result);
        } catch (error) {
            if (activePanel !== panel || !panel.isConnected) return;
            setStatus(panel, error.message || 'Die Galerie konnte nicht durchsucht werden.', 'error');
        } finally {
            refresh.disabled = false;
            refresh.textContent = 'Erneut suchen';
        }
    }

    function renderPhotos(panel, entry, result) {
        const grid = panel.querySelector('.atg-grid');
        grid.replaceChildren();

        const selectedPhotos = getSavedPhotos(entry);
        const photoMap = new Map();

        (Array.isArray(result.photos) ? result.photos : [])
            .map(cleanPhoto)
            .filter(Boolean)
            .forEach(photo => photoMap.set(photo.uri, photo));

        // Bereits zugeordnete Fotos bleiben sichtbar, auch wenn Aufnahmedatum
        // oder Android-Freigabe später verändert wurden.
        selectedPhotos.forEach(photo => {
            if (!photoMap.has(photo.uri)) photoMap.set(photo.uri, photo);
        });

        const allPhotos = Array.from(photoMap.values());
        const selected = new Set(selectedPhotos.map(photo => photo.uri));
        updateSelectedCount(panel, selected);

        const infoParts = [];
        const count = Number(result.count) || 0;
        infoParts.push(count + ' Foto' + (count === 1 ? '' : 's') + ' am Tourdatum gefunden');
        if (result.status === 'partial_results') {
            infoParts.push('Es werden nur die in Android freigegebenen Fotos berücksichtigt.');
        }
        if (result.truncated) infoParts.push('Die Anzeige ist auf 500 Fotos begrenzt.');
        if (selectedPhotos.length > 0) infoParts.push(selectedPhotos.length + ' bereits zugeordnet');
        setStatus(panel, infoParts.join(' '), result.status === 'partial_results' ? 'warning' : 'info');

        if (allPhotos.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'atg-empty';
            empty.textContent = 'Für dieses Datum wurden keine freigegebenen Fotos gefunden.';
            grid.appendChild(empty);
            return;
        }

        const thumbnailObserver = 'IntersectionObserver' in window
            ? new IntersectionObserver(entries => {
                entries.forEach(item => {
                    if (!item.isIntersecting) return;
                    thumbnailObserver.unobserve(item.target);
                    loadThumbnail(item.target);
                });
            }, { rootMargin: '260px 0px' })
            : null;
        panel._atgObserver = thumbnailObserver;

        allPhotos.forEach(photo => {
            const card = document.createElement('article');
            card.className = 'atg-photo-card';
            card.classList.toggle('is-selected', selected.has(photo.uri));

            const thumbWrap = document.createElement('div');
            thumbWrap.className = 'atg-thumb-wrap';

            const placeholder = document.createElement('div');
            placeholder.className = 'atg-thumb-placeholder';
            placeholder.textContent = '⛰';
            thumbWrap.appendChild(placeholder);

            const img = document.createElement('img');
            img.className = 'atg-thumb';
            img.alt = photo.displayName || 'Tourfoto';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.dataset.uri = photo.uri;
            thumbWrap.appendChild(img);

            const name = document.createElement('div');
            name.className = 'atg-photo-name';
            name.textContent = photo.displayName || 'Foto';

            const choose = document.createElement('button');
            choose.type = 'button';
            choose.className = 'atg-select-btn';
            choose.setAttribute('aria-pressed', selected.has(photo.uri) ? 'true' : 'false');
            choose.textContent = selected.has(photo.uri) ? '✓ Zugeordnet' : '+ Zur Tour';

            choose.addEventListener('click', () => {
                const wasSelected = selected.has(photo.uri);
                if (wasSelected) selected.delete(photo.uri);
                else selected.add(photo.uri);

                const nextPhotos = allPhotos.filter(item => selected.has(item.uri));
                if (!saveSelection(entry, nextPhotos, panel)) {
                    if (wasSelected) selected.add(photo.uri);
                    else selected.delete(photo.uri);
                    return;
                }

                card.classList.toggle('is-selected', selected.has(photo.uri));
                choose.classList.toggle('is-selected', selected.has(photo.uri));
                choose.setAttribute('aria-pressed', selected.has(photo.uri) ? 'true' : 'false');
                choose.textContent = selected.has(photo.uri) ? '✓ Zugeordnet' : '+ Zur Tour';
                updateSelectedCount(panel, selected);
            });

            card.append(thumbWrap, name, choose);
            grid.appendChild(card);

            if (thumbnailObserver) thumbnailObserver.observe(img);
            else loadThumbnail(img);
        });
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
        const tourId = String(entry && entry.id || '');
        if (activePanel && activePanel.isConnected &&
            activePanel.dataset.tourId === tourId) {
            return;
        }

        const sequence = ++openSequence;
        const body = document.getElementById('td-body');
        const modal = document.getElementById('tour-detail-modal');
        if (!body || !modal || modal.classList.contains('hidden')) return;

        if (activePanel && activePanel._atgObserver) activePanel._atgObserver.disconnect();
        if (activePanel) activePanel.remove();
        activePanel = null;

        const panel = makePanel(entry);
        activePanel = panel;
        insertPanel(panel, body);

        const accessButton = panel.querySelector('.atg-access-btn');
        panel.querySelector('.atg-refresh-btn').hidden = true;

        if (!entry.id) {
            accessButton.hidden = true;
            setStatus(panel, 'Diese Tour besitzt keine eindeutige Kennung. Fotos können deshalb nicht sicher zugeordnet werden.', 'error');
            return;
        }

        const supported = await bridgeReady;
        if (sequence !== openSequence || activePanel !== panel || !panel.isConnected) return;
        if (!supported) {
            accessButton.hidden = true;
            setStatus(
                panel,
                nativeBridgeAvailable
                    ? 'Die Android-Galerie ist in der App vorhanden, antwortet aber nicht. Bitte schließe die Fototest-App vollständig und öffne sie erneut. Der Fotobereich bleibt zur Diagnose sichtbar.'
                    : 'Die native Android-Galerie-Schnittstelle wurde nicht erkannt. Diese App-Sitzung kann deshalb noch nicht auf die Galerie zugreifen. Bitte schließe die Fototest-App vollständig und öffne sie erneut.',
                'error'
            );
            return;
        }

        try {
            const permission = await nativeRequest('gallery.permission.get');
            if (sequence !== openSequence || activePanel !== panel || !panel.isConnected) return;
            if (permission.access === 'none') {
                accessButton.hidden = false;
                setStatus(
                    panel,
                    'Die App sucht automatisch nach Fotos dieses Tourtags. Beim ersten Mal musst du dafür den Galerie-Zugriff freigeben.',
                    'warning'
                );
                return;
            }
            await searchTourDate(panel, entry);
        } catch (error) {
            if (sequence === openSequence && panel.isConnected) {
                setStatus(panel, error.message || 'Galerie-Status konnte nicht abgefragt werden.', 'error');
            }
        }
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
            if (modal.classList.contains('hidden')) return;

            const entry = getCurrentSavedDetailEntry();
            if (!entry || entry._isMultidaySummary || !entry.id) return;

            const existing = body.querySelector('#td-gallery-panel');
            if (existing && existing.dataset.tourId === String(entry.id)) return;

            mountGalleryPanel(entry).catch(error => {
                console.error('[Android-Galerie] Detailbeobachtung konnte den Fotobereich nicht einblenden.', error);
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
                    if (tour && typeof tour === 'object') delete tour.galleryPhotos;
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
