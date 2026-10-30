/* Optionale Fotozuordnung für gespeicherte Touren in der nativen Android-App.
 * Beim Öffnen werden ausschließlich bereits zugeordnete Fotos angezeigt.
 * Die Suche nach Tagesfotos startet erst nach ausdrücklichem Antippen.
 * Originalbilder bleiben in der Samsung-Galerie; gespeichert werden nur URI und Metadaten.
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

    // Außerhalb der nativen Android-WebView bleibt die normale PWA unverändert.
    if (!nativeBridgeAvailable && !isAndroidWebView) return;

    const pendingRequests = new Map();
    let requestCounter = 0;
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
            return Promise.reject(new Error('Die native Android-Galerie-Schnittstelle ist in dieser App-Sitzung nicht verfügbar.'));
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

    async function checkNativeGalleryBridge() {
        try {
            const reply = await nativeRequest('bridge.ping', {}, 8000);
            const features = Array.isArray(reply.features) ? reply.features : [];
            return features.includes('gallery.mediaStore.v1') &&
                features.includes('gallery.thumbnail.v1');
        } catch (error) {
            console.warn('[Android-Galerie] Native Galerie-Bridge antwortet nicht.', error);
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

    function cleanPhoto(photo) {
        if (!photo || typeof photo.uri !== 'string' ||
            !photo.uri.startsWith('content://media/')) {
            return null;
        }

        return {
            uri: photo.uri,
            displayName: String(photo.displayName || 'Foto'),
            dateTaken: Number(photo.dateTaken) || 0,
            dateAdded: Number(photo.dateAdded) || 0,
            dateBasis: photo.dateBasis === 'capture' || photo.dateBasis === 'added'
                ? photo.dateBasis : '',
            relativePath: String(photo.relativePath || '').replace(/\\/g, '/'),
            mimeType: String(photo.mimeType || 'image/*'),
            width: Number(photo.width) || 0,
            height: Number(photo.height) || 0,
            sizeBytes: Number(photo.sizeBytes) || 0
        };
    }

    function getPhotoSourceLabel(photo) {
        const path = String(photo && photo.relativePath || '').toLowerCase();
        if (path.includes('whatsapp')) return 'WhatsApp';
        if (/(^|\\/)dcim\\/camera(\\/|$)/.test(path)) return 'Kamera';
        if (path.includes('screenshot')) return 'Screenshots';
        if (path.includes('download')) return 'Downloads';
        return path ? 'Weitere Bilder' : 'Galerie';
    }

    function getPhotoMetaLabel(photo) {
        const source = getPhotoSourceLabel(photo);
        const basis = photo && photo.dateBasis === 'added'
            ? 'Speicherdatum'
            : photo && photo.dateBasis === 'capture'
                ? 'Aufnahmedatum'
                : '';
        return basis ? source + ' · ' + basis : source;
    }

    function getSavedPhotos(entry) {
        return Array.isArray(entry.galleryPhotos)
            ? entry.galleryPhotos.map(cleanPhoto).filter(Boolean)
            : [];
    }

    function setStatus(panel, text, kind) {
        const node = panel.querySelector('.atg-status');
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

    function createPhotoCard(panel, photo, selectable, selected, onToggle) {
        const card = document.createElement('article');
        card.className = 'atg-photo-card';
        card.classList.toggle('is-selected', !!selected);

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'atg-thumb-wrap';

        const placeholder = document.createElement('div');
        placeholder.className = 'atg-thumb-placeholder';
        placeholder.textContent = '⛰';
        thumbWrap.appendChild(placeholder);

        const image = document.createElement('img');
        image.className = 'atg-thumb';
        image.alt = photo.displayName || 'Tourfoto';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.dataset.uri = photo.uri;
        thumbWrap.appendChild(image);

        const name = document.createElement('div');
        name.className = 'atg-photo-name';
        name.textContent = photo.displayName || 'Foto';

        const meta = document.createElement('div');
        meta.className = 'atg-photo-meta';
        meta.textContent = getPhotoMetaLabel(photo);

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
        panel.innerHTML = [
            '<div class="atg-heading">',
              '<div class="atg-heading-copy">',
                '<div class="atg-title">Tourfotos</div>',
                '<div class="atg-subtitle"></div>',
              '</div>',
              '<span class="atg-count">0 zugeordnet</span>',
            '</div>',
            '<div class="atg-display">',
              '<div class="atg-empty atg-display-empty">Noch keine Fotos zugeordnet.</div>',
              '<div class="atg-grid atg-saved-grid" aria-label="Der Tour zugeordnete Fotos" hidden></div>',
              '<div class="atg-actions atg-display-actions">',
                '<button type="button" class="atg-manage-btn">Fotos hinzufügen</button>',
              '</div>',
            '</div>',
            '<div class="atg-picker" hidden>',
              '<div class="atg-status" role="status" aria-live="polite">Galerie wird vorbereitet …</div>',
              '<div class="atg-actions atg-picker-top-actions">',
                '<button type="button" class="atg-access-btn" hidden>Galeriezugriff erlauben</button>',
                '<button type="button" class="atg-refresh-btn" hidden>Erneut suchen</button>',
              '</div>',
              '<div class="atg-grid atg-picker-grid" aria-label="Fotos vom Tourtag"></div>',
              '<div class="atg-picker-footer">',
                '<span class="atg-picker-count">0 ausgewählt</span>',
                '<div class="atg-actions atg-picker-footer-actions">',
                  '<button type="button" class="atg-cancel-btn">Abbrechen</button>',
                  '<button type="button" class="atg-apply-btn" disabled>Auswahl übernehmen</button>',
                '</div>',
              '</div>',
            '</div>',
            '<div class="atg-footnote">Die Originalfotos bleiben in deiner Samsung-Galerie. Die App speichert nur lokale Bildverweise, keine Bildkopien.</div>'
        ].join('');

        const date = normalizeTourDate(entry.date);
        panel.querySelector('.atg-subtitle').textContent = date
            ? new Date(date + 'T12:00:00').toLocaleDateString('de-AT', {
                weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
            })
            : 'Kein gültiges Tourdatum';

        panel.querySelector('.atg-manage-btn').addEventListener('click', () => {
            openPhotoPicker(panel, entry);
        });
        panel.querySelector('.atg-access-btn').addEventListener('click', () => {
            requestGalleryAccess(panel, entry);
        });
        panel.querySelector('.atg-refresh-btn').addEventListener('click', () => {
            searchTourDate(panel, entry);
        });
        panel.querySelector('.atg-cancel-btn').addEventListener('click', () => {
            cancelPhotoPicker(panel, entry);
        });
        panel.querySelector('.atg-apply-btn').addEventListener('click', () => {
            applyPhotoSelection(panel, entry);
        });

        return panel;
    }

    function insertPanel(panel, body) {
        // Die Fotogalerie gehört bewusst ans Ende – nach sämtlichen Tourinformationen.
        body.appendChild(panel);
    }

    async function waitForTourStorageCommit() {
        // appStorage.set aktualisiert den synchronen Cache sofort, persistiert
        // IndexedDB aber über eine interne Schreibwarteschlange. Auf alle aktuell
        // eingereihten Schreibvorgänge warten, bevor die Auswahl als gespeichert gilt.
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

    async function saveSelection(entry, selectedPhotos, panel) {
        try {
            if (typeof appStorage === 'undefined' || !appStorage) {
                throw new Error('Der Tourenspeicher ist nicht verfügbar.');
            }

            const tourId = String(entry.id || '');
            if (!tourId) throw new Error('Der Tour fehlt eine eindeutige Kennung.');

            // Immer vom aktuellen Tourenbestand ausgehen, nicht von einem möglicherweise
            // veralteten Objekt aus der geöffneten Listenansicht.
            const allTours = (appStorage.get('touren') || []).slice();
            const index = allTours.findIndex(item => String(item && item.id || '') === tourId);
            if (index < 0) throw new Error('Die Tour wurde im Speicher nicht gefunden.');

            const metadata = selectedPhotos.map(cleanPhoto).filter(Boolean);
            allTours[index] = Object.assign({}, allTours[index], {
                galleryPhotos: metadata
            });

            appStorage.set('touren', allTours);

            // Erst nach erfolgreichem IndexedDB-Schreiben und Rücklesen bestätigen.
            const persistedTours = await waitForTourStorageCommit();
            const persistedEntry = persistedTours.find(
                item => String(item && item.id || '') === tourId
            );
            const persistedPhotos = Array.isArray(persistedEntry && persistedEntry.galleryPhotos)
                ? persistedEntry.galleryPhotos.map(cleanPhoto).filter(Boolean)
                : [];

            const expectedUris = metadata.map(photo => photo.uri).sort();
            const actualUris = persistedPhotos.map(photo => photo.uri).sort();
            if (expectedUris.length !== actualUris.length ||
                expectedUris.some((uri, index) => uri !== actualUris[index])) {
                throw new Error('Die Fotoauswahl wurde nicht dauerhaft gespeichert. Bitte versuche es erneut.');
            }

            // Veraltete Detail-/Listenobjekte für die laufende Ansicht synchronisieren.
            entry.galleryPhotos = persistedPhotos;
            try {
                if (typeof currentDetailEntry !== 'undefined' &&
                    currentDetailEntry &&
                    String(currentDetailEntry.id || '') === tourId) {
                    currentDetailEntry.galleryPhotos = persistedPhotos;
                }
            } catch (_) {
                // Der Datenbankeintrag ist bereits verifiziert; Detailzustand ist nur Komfort.
            }

            return true;
        } catch (error) {
            console.error('[Android-Galerie] Dauerhafte Fotozuordnung fehlgeschlagen.', error);
            setStatus(panel, error.message || 'Fotoauswahl konnte nicht dauerhaft gespeichert werden.', 'error');
            return false;
        }
    }

    function renderSavedPhotos(panel, entry) {
        disconnectThumbnailObserver(panel);

        const savedPhotos = getSavedPhotos(entry);
        const count = panel.querySelector('.atg-count');
        const empty = panel.querySelector('.atg-display-empty');
        const grid = panel.querySelector('.atg-saved-grid');
        const manage = panel.querySelector('.atg-manage-btn');

        count.textContent = savedPhotos.length + ' zugeordnet';
        manage.textContent = savedPhotos.length ? 'Fotos bearbeiten' : 'Fotos hinzufügen';
        empty.hidden = savedPhotos.length > 0;
        grid.hidden = savedPhotos.length === 0;
        grid.replaceChildren();

        savedPhotos.forEach(photo => {
            grid.appendChild(createPhotoCard(panel, photo, false, false, null));
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

        const savedUris = new Set(state.saved.map(photo => photo.uri));
        const changed = state.selected.size !== savedUris.size ||
            Array.from(state.selected).some(uri => !savedUris.has(uri));
        if (apply) apply.disabled = !changed || state.loading;
    }

    function renderSelectionGrid(panel, entry, result) {
        disconnectThumbnailObserver(panel);

        const saved = getSavedPhotos(entry);
        const photoMap = new Map();

        (Array.isArray(result.photos) ? result.photos : [])
            .map(cleanPhoto)
            .filter(Boolean)
            .forEach(photo => photoMap.set(photo.uri, photo));

        // Zugeordnete Bilder bleiben bearbeitbar, auch wenn Android sie nicht mehr
        // in der aktuellen Tagesabfrage zurückliefert.
        saved.forEach(photo => {
            if (!photoMap.has(photo.uri)) photoMap.set(photo.uri, photo);
        });

        const allPhotos = Array.from(photoMap.values());
        const selected = new Set(saved.map(photo => photo.uri));
        panel._atgPickerState = {
            saved: saved,
            photos: allPhotos,
            selected: selected,
            loading: false
        };

        const grid = panel.querySelector('.atg-picker-grid');
        grid.replaceChildren();

        if (result.status === 'partial_results') {
            setStatus(
                panel,
                (Number(result.count) || 0) + ' freigegebene Fotos gefunden. Android zeigt nur Bilder, für die du Zugriff erteilt hast; Herkunft und Datumsbasis stehen unter jedem Bild.',
                'warning'
            );
        } else {
            setStatus(
                panel,
                (Number(result.count) || 0) + ' Fotos gefunden. WhatsApp- und andere indexierte Ordner sind eingeschlossen; Herkunft und Datumsbasis stehen unter jedem Bild.',
                'info'
            );
        }

        if (result.truncated) {
            const note = document.createElement('div');
            note.className = 'atg-empty atg-result-note';
            note.textContent = 'Die Galerieauswahl ist auf 500 Fotos begrenzt.';
            grid.appendChild(note);
        }

        if (allPhotos.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'atg-empty';
            empty.textContent = 'Für dieses Datum wurden keine freigegebenen Fotos gefunden.';
            grid.appendChild(empty);
        }

        allPhotos.forEach(photo => {
            const isSelected = selected.has(photo.uri);
            const card = createPhotoCard(
                panel,
                photo,
                true,
                isSelected,
                (cardNode, button) => {
                    if (selected.has(photo.uri)) selected.delete(photo.uri);
                    else selected.add(photo.uri);

                    const nowSelected = selected.has(photo.uri);
                    cardNode.classList.toggle('is-selected', nowSelected);
                    button.classList.toggle('is-selected', nowSelected);
                    button.setAttribute('aria-pressed', nowSelected ? 'true' : 'false');
                    button.textContent = nowSelected ? '✓ Ausgewählt' : '+ Auswählen';
                    updatePickerSelection(panel);
                }
            );
            grid.appendChild(card);
        });

        updatePickerSelection(panel);
        panel.querySelector('.atg-access-btn').hidden = result.access !== 'partial';
        panel.querySelector('.atg-access-btn').textContent = 'Weitere Fotos freigeben';
        panel.querySelector('.atg-refresh-btn').hidden = false;
    }

    function showSavedPhotosInPicker(panel, entry, message, kind, showAccess) {
        renderSelectionGrid(panel, entry, {
            photos: [],
            count: 0,
            status: 'ok',
            access: 'none',
            truncated: false
        });
        setStatus(panel, message, kind || 'warning');
        panel.querySelector('.atg-access-btn').hidden = !showAccess;
        panel.querySelector('.atg-access-btn').textContent = 'Galeriezugriff erlauben';
        panel.querySelector('.atg-refresh-btn').hidden = !nativeBridgeAvailable;
    }

    async function openPhotoPicker(panel, entry) {
        setPickerVisible(panel, true);
        disconnectThumbnailObserver(panel);

        panel._atgPickerState = {
            saved: getSavedPhotos(entry),
            photos: [],
            selected: new Set(getSavedPhotos(entry).map(photo => photo.uri)),
            loading: true
        };
        panel.querySelector('.atg-picker-grid').replaceChildren();
        panel.querySelector('.atg-access-btn').hidden = true;
        panel.querySelector('.atg-refresh-btn').hidden = false;
        panel.querySelector('.atg-refresh-btn').textContent = 'Erneut suchen';
        updatePickerSelection(panel);
        setStatus(panel, 'Verbindung zur Android-Galerie wird geprüft …');

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
                showSavedPhotosInPicker(
                    panel,
                    entry,
                    nativeBridgeAvailable
                        ? 'Die Android-Galerie antwortet gerade nicht. Du kannst bereits zugeordnete Fotos trotzdem abwählen oder die Verbindung erneut versuchen.'
                        : 'Die native Android-Galerie-Schnittstelle wurde nicht erkannt. Bereits zugeordnete Fotos kannst du weiterhin aus der Tour entfernen.',
                    'error',
                    false
                );
                return;
            }

            const permission = await nativeRequest('gallery.permission.get');
            if (permission.access === 'none') {
                showSavedPhotosInPicker(
                    panel,
                    entry,
                    'Für neue Fotos ist eine Galerie-Freigabe erforderlich. Bereits zugeordnete Fotos bleiben hier bearbeitbar.',
                    'warning',
                    true
                );
                return;
            }

            const result = await nativeRequest('gallery.photos.byDate', { date: date }, 26000);
            if (activePanel !== panel || !panel.isConnected) return;

            if (result.status === 'permission_required' || result.status === 'permission_changed') {
                showSavedPhotosInPicker(
                    panel,
                    entry,
                    'Der Galerie-Zugriff wurde nicht erteilt oder zwischenzeitlich geändert. Bereits zugeordnete Fotos kannst du weiterhin bearbeiten.',
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
                setStatus(panel, 'Die Fotos für dieses Datum konnten nicht durchsucht werden.', 'error');
                return;
            }

            renderSelectionGrid(panel, entry, result);
        } catch (error) {
            if (activePanel !== panel || !panel.isConnected) return;
            showSavedPhotosInPicker(
                panel,
                entry,
                error.message || 'Die Galerie konnte nicht durchsucht werden.',
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

    function cancelPhotoPicker(panel, entry) {
        disconnectThumbnailObserver(panel);
        panel._atgPickerState = null;
        setPickerVisible(panel, false);
        renderSavedPhotos(panel, entry);
    }

    async function applyPhotoSelection(panel, entry) {
        const state = panel._atgPickerState;
        if (!state || state.loading) return;

        const nextPhotos = state.photos.filter(photo => state.selected.has(photo.uri));
        const applyButton = panel.querySelector('.atg-apply-btn');
        state.loading = true;
        if (applyButton) {
            applyButton.disabled = true;
            applyButton.textContent = 'Speichere …';
        }

        try {
            const saved = await saveSelection(entry, nextPhotos, panel);
            if (!saved) return;

            panel._atgPickerState = null;
            setPickerVisible(panel, false);
            renderSavedPhotos(panel, entry);
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
        renderSavedPhotos(panel, latestEntry);
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
