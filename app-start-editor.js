/* Alpine Premium App-Start – eigenständige Bildquelle, Zuschnitt und native Synchronisierung. */
(function () {
    'use strict';

    const SETTINGS_KEY = 'premiumAppStartSettings_v1';
    const STANDARD_IMAGE_URL = './android/app/src/main/res/drawable-nodpi/splash_alpine_panorama.webp';
    const DEFAULTS = Object.freeze({
        background: 'standard',
        duration: 'auto',
        animation: 'premium',
        cropX: 50,
        cropY: 50,
        cropZoom: 1
    });

    let draft = null;
    let editorActive = false;
    let bound = false;
    let originalCustomImageBlob = null;
    let pendingCustomImageBlob = null;
    let removeCustomImage = false;
    let lastNativeSyncMessage = '';
    let previewUrl = '';
    let previewImage = null;
    let previewSequence = 0;
    const sourceBlobCache = new Map();

    const byId = id => document.getElementById(id);
    const appStore = () => {
        try { return typeof appStorage !== 'undefined' && appStorage ? appStorage : null; }
        catch (_) { return null; }
    };

    function readStored(key) {
        try {
            const value = appStore()?.get(key);
            if (value !== undefined && value !== null) return value;
        } catch (_) {}
        try {
            const raw = localStorage.getItem(key);
            return raw == null ? null : JSON.parse(raw);
        } catch (_) { return null; }
    }

    function writeStored(key, value) {
        try { appStore()?.set(key, value); }
        catch (error) { console.warn('[App-Start] Lokaler App-Speicher konnte nicht aktualisiert werden.', error); }
        if (key === SETTINGS_KEY) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
        }
    }

    function getPresetCatalog() {
        try {
            const catalog = window.getAppBackgroundPresetCatalog?.();
            return Array.isArray(catalog) ? catalog.filter(item =>
                item && typeof item.id === 'string' &&
                /^[a-zA-Z0-9_-]{1,80}$/.test(item.id) &&
                typeof (item.preview || item.sourceUrl) === 'string'
            ) : [];
        } catch (_) { return []; }
    }

    function normalize(value) {
        const source = value && typeof value === 'object' ? value : {};
        const backgroundValue = typeof source.background === 'string' ? source.background : DEFAULTS.background;
        const validPreset = backgroundValue.startsWith('preset:') &&
            getPresetCatalog().some(item => item.id === backgroundValue.slice(7));
        const background = ['standard', 'editor', 'custom'].includes(backgroundValue) || validPreset
            ? backgroundValue : DEFAULTS.background;
        const clamp = (number, min, max, fallback) => {
            const parsed = Number(number);
            return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
        };
        return {
            background,
            duration: ['auto', '1500', '2000', '2500'].includes(String(source.duration))
                ? String(source.duration) : DEFAULTS.duration,
            animation: ['off', 'subtle', 'premium'].includes(source.animation)
                ? source.animation : DEFAULTS.animation,
            cropX: clamp(source.cropX, 0, 100, DEFAULTS.cropX),
            cropY: clamp(source.cropY, 0, 100, DEFAULTS.cropY),
            cropZoom: clamp(source.cropZoom, 0.8, 1.8, DEFAULTS.cropZoom)
        };
    }

    function currentDraft() {
        if (!draft) draft = normalize(readStored(SETTINGS_KEY) || DEFAULTS);
        return { ...draft };
    }

    function setStatus(message, isError) {
        const status = byId('te-app-start-save-status');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.state = isError ? 'error' : 'success';
    }

    function revokePreview() {
        if (previewUrl) {
            try { URL.revokeObjectURL(previewUrl); } catch (_) {}
        }
        previewUrl = '';
        previewImage = null;
    }

    function sourceLabel(settings) {
        if (settings.background === 'standard') return 'Standard-Alpenpanorama';
        if (settings.background === 'editor') return 'Aktuelles Editor-Hintergrundbild';
        if (settings.background === 'custom') return 'Eigenes Startbild';
        const id = settings.background.slice(7);
        return getPresetCatalog().find(item => item.id === id)?.name || 'Alpenmotiv';
    }

    function renderPresetOptions() {
        const group = byId('te-app-start-presets');
        if (!group) return;
        group.replaceChildren();
        getPresetCatalog().forEach(preset => {
            const option = document.createElement('option');
            option.value = 'preset:' + preset.id;
            option.textContent = preset.name;
            group.appendChild(option);
        });
    }

    function fillCropControls(settings) {
        const value = normalize(settings);
        const controls = [
            ['te-app-start-crop-x', 'te-app-start-crop-x-value', value.cropX, '%'],
            ['te-app-start-crop-y', 'te-app-start-crop-y-value', value.cropY, '%'],
            ['te-app-start-crop-zoom', 'te-app-start-crop-zoom-value', Math.round(value.cropZoom * 100), '%']
        ];
        controls.forEach(([inputId, outputId, number, suffix]) => {
            const input = byId(inputId);
            const output = byId(outputId);
            if (input) input.value = String(number);
            if (output) output.textContent = String(number) + ' ' + suffix;
        });
    }

    function readControls() {
        const value = normalize({
            background: byId('te-app-start-background')?.value,
            duration: byId('te-app-start-duration')?.value,
            animation: byId('te-app-start-animation')?.value,
            cropX: byId('te-app-start-crop-x')?.value,
            cropY: byId('te-app-start-crop-y')?.value,
            cropZoom: Number(byId('te-app-start-crop-zoom')?.value || 100) / 100
        });
        draft = value;
        const panel = byId('te-app-start-custom-panel');
        if (panel) panel.hidden = value.background !== 'custom';
        fillCropControls(value);
        return { ...value };
    }

    function cropParameters(settings) {
        const value = normalize(settings);
        return {
            x: value.cropX,
            y: value.cropY,
            zoom: value.cropZoom
        };
    }

    function drawCrop(context, image, width, height, crop) {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight) return;
        const positionX = Math.max(0, Math.min(100, Number(crop?.x ?? 50)));
        const positionY = Math.max(0, Math.min(100, Number(crop?.y ?? 50)));
        const zoom = Math.max(0.8, Math.min(1.8, Number(crop?.zoom ?? 1)));
        const scale = Math.max(width / sourceWidth, height / sourceHeight) * zoom;
        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;
        const drawX = -(drawWidth - width) * positionX / 100;
        const drawY = -(drawHeight - height) * positionY / 100;
        context.fillStyle = '#101923';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    function drawCurrentCropPreview() {
        const canvas = byId('te-app-start-crop-preview');
        if (!canvas) return;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;
        if (!previewImage) {
            context.fillStyle = '#101923';
            context.fillRect(0, 0, canvas.width, canvas.height);
            return;
        }
        drawCrop(context, previewImage, canvas.width, canvas.height, cropParameters(readControls()));
    }

    async function fetchImageBlob(url, message) {
        const response = await fetch(url, {
            mode: 'cors',
            credentials: 'omit',
            cache: 'force-cache'
        });
        if (!response.ok) throw new Error(message);
        const blob = await response.blob();
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/') || !blob.size) {
            throw new Error(message);
        }
        return blob;
    }

    async function resolveBackgroundBlob(settings, customBlobOverride) {
        if (settings.background === 'custom') {
            const blob = customBlobOverride instanceof Blob
                ? customBlobOverride
                : await window.getAppStartCustomImageBlob?.();
            if (!(blob instanceof Blob)) {
                throw new Error('Bitte zuerst ein eigenes Startbild aus der Galerie auswählen.');
            }
            return blob;
        }

        if (settings.background === 'editor') {
            const source = await window.getAppBackgroundSplashSource?.();
            if (source?.blob instanceof Blob) return source.blob;
            if (typeof source?.url === 'string' && source.url) {
                return fetchImageBlob(source.url, 'Das aktuelle Editor-Hintergrundbild konnte nicht geladen werden.');
            }
            const asset = await window.getAppBackgroundSplashAsset?.();
            if (asset?.blob instanceof Blob) return asset.blob;
            throw new Error('Das aktuelle Editor-Hintergrundbild ist nicht verfügbar.');
        }

        if (settings.background.startsWith('preset:')) {
            const id = settings.background.slice(7);
            const preset = getPresetCatalog().find(item => item.id === id);
            if (!preset) throw new Error('Das gewählte Alpenmotiv ist nicht mehr verfügbar.');
            const url = preset.preview || preset.sourceUrl;
            if (!sourceBlobCache.has(url)) {
                sourceBlobCache.set(url, fetchImageBlob(url, 'Das gewählte Alpenmotiv konnte nicht geladen werden.'));
            }
            return sourceBlobCache.get(url);
        }

        if (!sourceBlobCache.has('standard')) {
            sourceBlobCache.set('standard', fetchImageBlob(
                STANDARD_IMAGE_URL,
                'Das Standard-Alpenpanorama konnte nicht geladen werden.'
            ));
        }
        return sourceBlobCache.get('standard');
    }

    async function resolveBackgroundPreviewSource(settings, customBlobOverride) {
        if (settings.background === 'custom') {
            const blob = customBlobOverride instanceof Blob
                ? customBlobOverride
                : await window.getAppStartCustomImageBlob?.();
            if (!(blob instanceof Blob)) {
                throw new Error('Bitte zuerst ein eigenes Startbild aus der Galerie auswählen.');
            }
            return { blob };
        }

        if (settings.background === 'editor') {
            const source = await window.getAppBackgroundSplashSource?.();
            if (source?.blob instanceof Blob) return { blob: source.blob };
            if (typeof source?.url === 'string' && source.url) return { url: source.url };
            const asset = await window.getAppBackgroundSplashAsset?.();
            if (asset?.blob instanceof Blob) return { blob: asset.blob };
            throw new Error('Das aktuelle Editor-Hintergrundbild ist nicht verfügbar.');
        }

        if (settings.background.startsWith('preset:')) {
            const preset = getPresetCatalog().find(item => item.id === settings.background.slice(7));
            if (!preset) throw new Error('Das gewählte Alpenmotiv ist nicht mehr verfügbar.');
            return { url: preset.preview || preset.sourceUrl };
        }

        return { url: STANDARD_IMAGE_URL };
    }

    async function updateCropPreview(settingsOverride) {
        const settings = normalize(settingsOverride || readControls());
        const token = ++previewSequence;
        let objectUrl = '';
        try {
            const source = await resolveBackgroundPreviewSource(
                settings,
                settings.background === 'custom'
                    ? (pendingCustomImageBlob || (removeCustomImage ? null : originalCustomImageBlob))
                    : null
            );
            if (token !== previewSequence) return;

            // Eine Bildvorschau muss die Quelldatei nur darstellen, nicht auslesen.
            // Deshalb wird eine URL direkt als img.src geladen und nicht per fetch()
            // in einen Blob umgewandelt. So funktionieren auch die bestehenden
            // Wikimedia-/Unsplash-Presets ohne unnötige CORS-Abhängigkeit.
            if (source.blob instanceof Blob) {
                objectUrl = URL.createObjectURL(source.blob);
            } else if (typeof source.url === 'string' && source.url) {
                objectUrl = source.url;
            } else {
                throw new Error('Für diese Bildquelle ist keine Vorschau verfügbar.');
            }

            const image = new Image();
            image.decoding = 'async';
            image.onload = () => {
                if (token !== previewSequence) {
                    if (source.blob instanceof Blob) URL.revokeObjectURL(objectUrl);
                    return;
                }
                revokePreview();
                previewUrl = source.blob instanceof Blob ? objectUrl : '';
                previewImage = image;
                drawCurrentCropPreview();
                setStatus('', false);
            };
            image.onerror = () => {
                if (source.blob instanceof Blob) URL.revokeObjectURL(objectUrl);
                if (token === previewSequence) {
                    revokePreview();
                    drawCurrentCropPreview();
                    setStatus('Das ausgewählte Alpenmotiv konnte nicht geladen werden. Bitte Internetverbindung prüfen.', true);
                }
            };
            image.src = objectUrl;
        } catch (error) {
            if (token !== previewSequence) return;
            revokePreview();
            drawCurrentCropPreview();
            setStatus(error?.message || ('Bildquelle nicht verfügbar: ' + sourceLabel(settings)), true);
        }
    }

    function fillControls(settings, customImageBlob) {
        const value = normalize(settings);
        draft = value;
        const background = byId('te-app-start-background');
        const duration = byId('te-app-start-duration');
        const animation = byId('te-app-start-animation');
        if (background) background.value = value.background;
        if (duration) duration.value = value.duration;
        if (animation) animation.value = value.animation;
        const panel = byId('te-app-start-custom-panel');
        if (panel) panel.hidden = value.background !== 'custom';
        fillCropControls(value);
        if (customImageBlob instanceof Blob) {
            pendingCustomImageBlob = pendingCustomImageBlob || null;
        }
        updateCropPreview(value).catch(error => {
            console.warn('[App-Start] Bildvorschau konnte nicht aktualisiert werden.', error);
        });
        return value;
    }

    async function setAppStartSettingsSnapshot(value) {
        draft = normalize(value);
        if (editorActive) {
            const imageBlob = removeCustomImage ? null : (pendingCustomImageBlob || originalCustomImageBlob);
            fillControls(draft, imageBlob);
        } else {
            writeStored(SETTINGS_KEY, draft);
        }
        return { ...draft };
    }

    function getAppStartSettings() {
        return currentDraft();
    }

    async function loadImage(blob) {
        const objectUrl = URL.createObjectURL(blob);
        try {
            return await new Promise((resolve, reject) => {
                const element = new Image();
                element.onload = () => resolve({ image: element, objectUrl });
                element.onerror = () => reject(new Error('Das Startbild konnte nicht geöffnet werden.'));
                element.src = objectUrl;
            });
        } catch (error) {
            URL.revokeObjectURL(objectUrl);
            throw error;
        }
    }

    async function blobToJpeg(blob, width, height, quality) {
        const loaded = await loadImage(blob);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('Das Bild konnte nicht verarbeitet werden.');
            context.fillStyle = '#101923';
            context.fillRect(0, 0, width, height);
            context.drawImage(loaded.image, 0, 0, width, height);
            return await new Promise((resolve, reject) => {
                canvas.toBlob(result => {
                    if (result instanceof Blob && result.size) resolve(result);
                    else reject(new Error('Das Bild konnte nicht komprimiert werden.'));
                }, 'image/jpeg', quality);
            });
        } finally {
            URL.revokeObjectURL(loaded.objectUrl);
        }
    }

    async function optimizeSourceImage(blob) {
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) {
            throw new TypeError('Die ausgewählte Bildquelle ist kein gültiges Bild.');
        }
        const loaded = await loadImage(blob);
        const sourceWidth = loaded.image.naturalWidth || loaded.image.width;
        const sourceHeight = loaded.image.naturalHeight || loaded.image.height;
        URL.revokeObjectURL(loaded.objectUrl);
        if (!sourceWidth || !sourceHeight) throw new Error('Das Bild hat keine gültigen Bildabmessungen.');

        let scale = Math.min(1, 3200 / Math.max(sourceWidth, sourceHeight));
        for (let attempt = 0; attempt < 7; attempt++) {
            const width = Math.max(1, Math.round(sourceWidth * scale));
            const height = Math.max(1, Math.round(sourceHeight * scale));
            const quality = [0.9, 0.86, 0.82, 0.78][Math.min(attempt, 3)];
            const optimized = await blobToJpeg(blob, width, height, quality);
            if (optimized.size <= 5 * 1024 * 1024) return optimized;
            scale *= 0.86;
        }
        throw new RangeError('Das optimierte Startbild überschreitet die erlaubten 5 MB.');
    }

    async function compressImageToPortrait(blob, crop) {
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) {
            throw new TypeError('Die ausgewählte Bildquelle ist kein gültiges Bild.');
        }
        const loaded = await loadImage(blob);
        const targetWidth = 1080;
        const targetHeight = 2340;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
            URL.revokeObjectURL(loaded.objectUrl);
            throw new Error('Das Startbild konnte nicht für Android vorbereitet werden.');
        }
        drawCrop(context, loaded.image, targetWidth, targetHeight, crop);
        URL.revokeObjectURL(loaded.objectUrl);

        const output = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
                if (result instanceof Blob && result.size) resolve(result);
                else reject(new Error('Das Startbild konnte nicht für Android komprimiert werden.'));
            }, 'image/jpeg', 0.84);
        });
        if (output.size > 5 * 1024 * 1024) {
            throw new RangeError('Das optimierte Startbild überschreitet die erlaubten 5 MB.');
        }
        return output;
    }

    function bytesToBase64(bytes) {
        let binary = '';
        const blockSize = 0x6000;
        for (let offset = 0; offset < bytes.length; offset += blockSize) {
            const block = bytes.subarray(offset, Math.min(bytes.length, offset + blockSize));
            binary += String.fromCharCode(...block);
        }
        return window.btoa(binary);
    }

    async function uploadNativeImage(blob) {
        const nativeRequest = window.__androidNativeRequest;
        if (typeof nativeRequest !== 'function') {
            throw new Error('Die Android-Nachrichtenverbindung ist nicht verfügbar.');
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
            throw new RangeError('Das Startbild ist leer oder größer als 5 MB.');
        }

        const transferId = 'splash-' + Date.now().toString(36) + '-' +
            Math.random().toString(36).slice(2, 9);
        const chunkSize = 30 * 1024;
        const totalChunks = Math.ceil(bytes.length / chunkSize);

        try {
            const ready = await nativeRequest('splash.image.start', {
                transferId,
                totalBytes: bytes.length,
                totalChunks,
                mimeType: 'image/jpeg'
            }, 30000);
            if (!ready || ready.type !== 'splash.image.ready' || ready.ok !== true) {
                throw new Error(ready?.error || 'Android konnte das Startbild nicht vorbereiten.');
            }

            for (let index = 0; index < totalChunks; index++) {
                const start = index * chunkSize;
                const end = Math.min(bytes.length, start + chunkSize);
                const response = await nativeRequest('splash.image.chunk', {
                    transferId,
                    index,
                    data: bytesToBase64(bytes.subarray(start, end))
                }, 30000);
                if (!response || response.type !== 'splash.image.chunk.ack' || response.ok !== true) {
                    throw new Error(response?.error || 'Ein Teil des Startbildes konnte nicht übertragen werden.');
                }
            }

            const complete = await nativeRequest('splash.image.finish', { transferId }, 60000);
            if (!complete || complete.type !== 'splash.image.complete' || complete.ok !== true) {
                throw new Error(complete?.error || 'Android konnte das Startbild nicht dauerhaft speichern.');
            }
        } catch (error) {
            nativeRequest('splash.image.abort', { transferId }, 5000).catch(() => {});
            throw error;
        }
    }

    async function syncNative(settings, customBlobOverride) {
        const nativeRequest = window.__androidNativeRequest;
        if (typeof nativeRequest !== 'function') return { status: 'not-native' };

        const ping = await nativeRequest('bridge.ping', {}, 10000);
        const features = Array.isArray(ping?.features) ? ping.features : [];
        if (!features.includes('splash.settings.v1') || !features.includes('splash.image.v1')) {
            throw new Error('Diese APK unterstützt die neuen App-Start-Einstellungen noch nicht.');
        }

        const sourceBlob = await resolveBackgroundBlob(settings, customBlobOverride);
        const optimized = await compressImageToPortrait(sourceBlob, cropParameters(settings));
        await uploadNativeImage(optimized);

        // Android braucht nur noch den Hinweis, dass ein lokal gespeichertes,
        // bereits passend zugeschnittenes Startbild verwendet werden soll.
        const response = await nativeRequest('splash.settings.save', {
            background: 'custom',
            durationMs: settings.duration === 'auto' ? 0 : Number(settings.duration),
            animation: settings.animation
        }, 20000);
        if (!response || response.type !== 'splash.settings.result' || response.ok !== true) {
            throw new Error(response?.error || 'Android hat die App-Start-Einstellungen nicht bestätigt.');
        }
        return { status: 'synced' };
    }

    async function beginDraft() {
        editorActive = true;
        try {
            originalCustomImageBlob = await window.getAppStartCustomImageBlob?.() || null;
        } catch (error) {
            console.warn('[App-Start] Gespeichertes Startbild konnte nicht gelesen werden.', error);
            originalCustomImageBlob = null;
        }
        pendingCustomImageBlob = null;
        removeCustomImage = false;
        renderPresetOptions();
        const stored = normalize(readStored(SETTINGS_KEY) || DEFAULTS);
        fillControls(stored, originalCustomImageBlob);
        setStatus(lastNativeSyncMessage, Boolean(lastNativeSyncMessage));
        lastNativeSyncMessage = '';
        bindControls();
        return { ...stored };
    }

    function markEditorDirty(target) {
        const trigger = target || byId('te-app-start-background');
        if (!trigger) return;
        trigger.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function bindControls() {
        if (bound) return;
        const root = byId('theme-view');
        if (!root) return;
        bound = true;

        root.addEventListener('change', event => {
            if (event.target?.matches?.('#te-app-start-background,#te-app-start-duration,#te-app-start-animation')) {
                const settings = readControls();
                setStatus('', false);
                if (event.target.matches('#te-app-start-background')) {
                    updateCropPreview(settings);
                }
            }
        });

        root.addEventListener('input', event => {
            if (event.target?.matches?.('#te-app-start-crop-x,#te-app-start-crop-y,#te-app-start-crop-zoom')) {
                const settings = readControls();
                drawCurrentCropPreview();
                setStatus('', false);
            }
        });

        byId('te-app-start-crop-reset')?.addEventListener('click', () => {
            const x = byId('te-app-start-crop-x');
            const y = byId('te-app-start-crop-y');
            const zoom = byId('te-app-start-crop-zoom');
            if (x) x.value = '50';
            if (y) y.value = '50';
            if (zoom) zoom.value = '100';
            const settings = readControls();
            drawCurrentCropPreview();
            setStatus('', false);
            markEditorDirty(x);
        });

        byId('te-app-start-image-choose')?.addEventListener('click', () => {
            byId('te-app-start-image-file')?.click();
        });

        byId('te-app-start-image-file')?.addEventListener('change', async event => {
            const file = event.target?.files?.[0];
            event.target.value = '';
            if (!file) return;
            if (!file.type.startsWith('image/') || file.size <= 0 || file.size > 15 * 1024 * 1024) {
                setStatus('Bitte ein Bild unter 15 MB auswählen.', true);
                return;
            }
            setStatus('Startbild wird vorbereitet …', false);
            try {
                pendingCustomImageBlob = await optimizeSourceImage(file);
                removeCustomImage = false;
                const background = byId('te-app-start-background');
                if (background) background.value = 'custom';
                draft = { ...readControls(), background: 'custom' };
                const panel = byId('te-app-start-custom-panel');
                if (panel) panel.hidden = false;
                await updateCropPreview(draft);
                setStatus('Eigenes Startbild ausgewählt.', false);
                markEditorDirty(byId('te-app-start-image-choose'));
            } catch (error) {
                console.error('[App-Start] Eigenes Startbild konnte nicht verarbeitet werden.', error);
                setStatus(error?.message || 'Das Startbild konnte nicht vorbereitet werden.', true);
            }
        });

        byId('te-app-start-image-remove')?.addEventListener('click', async () => {
            pendingCustomImageBlob = null;
            removeCustomImage = true;
            const background = byId('te-app-start-background');
            if (background) background.value = 'standard';
            draft = { ...readControls(), background: 'standard' };
            const panel = byId('te-app-start-custom-panel');
            if (panel) panel.hidden = true;
            await updateCropPreview(draft);
            setStatus('Eigenes Startbild entfernt.', false);
            markEditorDirty(byId('te-app-start-image-remove'));
        });
    }

    async function commitDraft() {
        const settings = readControls();
        const existingImage = removeCustomImage
            ? null
            : (pendingCustomImageBlob || originalCustomImageBlob);

        if (settings.background === 'custom' && !(existingImage instanceof Blob)) {
            settings.background = 'standard';
            draft = settings;
            const background = byId('te-app-start-background');
            if (background) background.value = 'standard';
            setStatus('Es ist kein eigenes Bild gespeichert. Der Standard wurde beibehalten.', true);
        }

        if (removeCustomImage) {
            await window.clearAppStartCustomImageBlob?.();
        } else if (pendingCustomImageBlob instanceof Blob) {
            await window.setAppStartCustomImageBlob?.(pendingCustomImageBlob);
        }

        writeStored(SETTINGS_KEY, settings);
        editorActive = false;
        originalCustomImageBlob = pendingCustomImageBlob || (removeCustomImage ? null : originalCustomImageBlob);

        try {
            const result = await syncNative(settings, pendingCustomImageBlob || existingImage);
            lastNativeSyncMessage = result.status === 'synced'
                ? 'App-Start gespeichert und mit Android synchronisiert.'
                : 'App-Start-Einstellungen gespeichert.';
            setStatus(lastNativeSyncMessage, false);
        } catch (error) {
            console.error('[App-Start] Android konnte die Start-Einstellungen nicht übernehmen.', error);
            lastNativeSyncMessage = 'Lokal gespeichert · Android konnte nicht aktualisiert werden: ' +
                (error?.message || 'Unbekannter Fehler');
            setStatus(lastNativeSyncMessage, true);
            const bar = byId('theme-editor-savebar-status');
            if (bar) bar.textContent = 'Editor gespeichert · App-Start in Android nicht aktualisiert';
        }

        pendingCustomImageBlob = null;
        removeCustomImage = false;
        return { ...settings };
    }

    async function discardDraft() {
        editorActive = false;
        pendingCustomImageBlob = null;
        removeCustomImage = false;
        const stored = normalize(readStored(SETTINGS_KEY) || DEFAULTS);
        originalCustomImageBlob = await window.getAppStartCustomImageBlob?.() || null;
        renderPresetOptions();
        fillControls(stored, originalCustomImageBlob);
        setStatus('', false);
    }

    async function syncAppStartNativeSettings() {
        const stored = readStored(SETTINGS_KEY);
        if (!stored || typeof stored !== 'object') return { status: 'no-settings' };
        try {
            const result = await syncNative(normalize(stored));
            return result;
        } catch (error) {
            console.warn('[App-Start] Wiederhergestellte Einstellungen konnten nicht an Android übertragen werden.', error);
            return { status: 'failed', error: error?.message || 'Unbekannter Fehler' };
        }
    }

    window.getAppStartSettings = getAppStartSettings;
    window.setAppStartSettingsSnapshot = setAppStartSettingsSnapshot;
    window.__beginAppStartEditorDraft = beginDraft;
    window.__commitAppStartEditorDraft = commitDraft;
    window.__discardAppStartEditorDraft = discardDraft;
    window.syncAppStartNativeSettings = syncAppStartNativeSettings;

    document.addEventListener('DOMContentLoaded', () => {
        if (!draft) draft = normalize(readStored(SETTINGS_KEY) || DEFAULTS);
        const canvas = byId('te-app-start-crop-preview');
        if (canvas) {
            const context = canvas.getContext('2d', { alpha: false });
            if (context) {
                context.fillStyle = '#101923';
                context.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }, { once: true });
})();