/* Alpine Premium App-Start – Editorsteuerung, lokale Bildablage und native Synchronisierung. */
(function () {
    'use strict';

    const SETTINGS_KEY = 'premiumAppStartSettings_v1';
    const DEFAULTS = Object.freeze({ background: 'standard', duration: 'auto', animation: 'premium' });

    let draft = null;
    let editorActive = false;
    let bound = false;
    let previewUrl = '';
    let originalCustomImageBlob = null;
    let pendingCustomImageBlob = null;
    let removeCustomImage = false;
    let lastNativeSyncMessage = '';

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

    function normalize(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            background: ['standard', 'editor', 'custom'].includes(source.background)
                ? source.background : DEFAULTS.background,
            duration: ['auto', '1500', '2000', '2500'].includes(String(source.duration))
                ? String(source.duration) : DEFAULTS.duration,
            animation: ['off', 'subtle', 'premium'].includes(source.animation)
                ? source.animation : DEFAULTS.animation
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
        if (!previewUrl) return;
        try { URL.revokeObjectURL(previewUrl); } catch (_) {}
        previewUrl = '';
    }

    function paintPreview(blob) {
        const image = byId('te-app-start-image-preview');
        const empty = byId('te-app-start-image-empty');
        const remove = byId('te-app-start-image-remove');
        if (!image || !empty) return;

        revokePreview();
        if (blob instanceof Blob && blob.type.startsWith('image/')) {
            previewUrl = URL.createObjectURL(blob);
            image.src = previewUrl;
            image.hidden = false;
            empty.hidden = true;
            if (remove) remove.hidden = false;
        } else {
            image.removeAttribute('src');
            image.hidden = true;
            empty.hidden = false;
            if (remove) remove.hidden = true;
        }
    }

    function fillControls(settings, imageBlob) {
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
        paintPreview(imageBlob);
        return value;
    }

    function readControls() {
        const value = normalize({
            background: byId('te-app-start-background')?.value,
            duration: byId('te-app-start-duration')?.value,
            animation: byId('te-app-start-animation')?.value
        });
        draft = value;
        const panel = byId('te-app-start-custom-panel');
        if (panel) panel.hidden = value.background !== 'custom';
        return { ...value };
    }

    function setAppStartSettingsSnapshot(value) {
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

    async function compressImageToPortrait(blob, backgroundSettings) {
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) {
            throw new TypeError('Die ausgewählte Bildquelle ist kein gültiges Bild.');
        }
        const loaded = await loadImage(blob);
        const image = loaded.image;
        const targetWidth = 1080;
        const targetHeight = 1920;
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight) {
            URL.revokeObjectURL(loaded.objectUrl);
            throw new Error('Das Startbild hat keine gültigen Bildabmessungen.');
        }

        const positionX = Math.max(0, Math.min(100, Number(backgroundSettings?.mobilePositionX ?? backgroundSettings?.positionX ?? 50)));
        const positionY = Math.max(0, Math.min(100, Number(backgroundSettings?.positionY ?? 50)));
        const zoom = Math.max(1, Math.min(1.6, Number(backgroundSettings?.zoom ?? 1)));
        const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight) * zoom;
        const drawWidth = sourceWidth * scale;
        const drawHeight = sourceHeight * scale;
        const drawX = -(drawWidth - targetWidth) * positionX / 100;
        const drawY = -(drawHeight - targetHeight) * positionY / 100;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
            URL.revokeObjectURL(loaded.objectUrl);
            throw new Error('Das Startbild konnte nicht für Android vorbereitet werden.');
        }
        context.fillStyle = '#101923';
        context.fillRect(0, 0, targetWidth, targetHeight);
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        URL.revokeObjectURL(loaded.objectUrl);

        const output = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
                if (result instanceof Blob) resolve(result);
                else reject(new Error('Das Startbild konnte nicht komprimiert werden.'));
            }, 'image/jpeg', 0.84);
        });
        if (!output.size || output.size > 5 * 1024 * 1024) {
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

    async function resolveBackgroundBlob(settings, customBlobOverride) {
        if (settings.background === 'custom') {
            const blob = customBlobOverride instanceof Blob
                ? customBlobOverride
                : await window.getAppStartCustomImageBlob?.();
            if (!(blob instanceof Blob)) {
                throw new Error('Bitte zuerst ein eigenes Startbild aus der Galerie auswählen.');
            }
            return { blob, crop: { positionX: 50, positionY: 50, zoom: 1 } };
        }

        if (settings.background === 'editor') {
            const asset = await window.getAppBackgroundSplashAsset?.();
            if (!asset || !(asset.blob instanceof Blob)) {
                throw new Error('Das aktuelle Editor-Hintergrundbild ist nicht verfügbar.');
            }
            return { blob: asset.blob, crop: asset.settings || {} };
        }

        return null;
    }

    async function syncNative(settings, customBlobOverride) {
        const nativeRequest = window.__androidNativeRequest;
        if (typeof nativeRequest !== 'function') return { status: 'not-native' };

        const ping = await nativeRequest('bridge.ping', {}, 10000);
        const features = Array.isArray(ping?.features) ? ping.features : [];
        if (!features.includes('splash.settings.v1') || !features.includes('splash.image.v1')) {
            throw new Error('Diese APK unterstützt die neuen App-Start-Einstellungen noch nicht.');
        }

        if (settings.background !== 'standard') {
            const source = await resolveBackgroundBlob(settings, customBlobOverride);
            const optimized = await compressImageToPortrait(source.blob, source.crop);
            await uploadNativeImage(optimized);
        }

        const response = await nativeRequest('splash.settings.save', {
            background: settings.background,
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
        const stored = normalize(readStored(SETTINGS_KEY) || DEFAULTS);
        fillControls(stored, originalCustomImageBlob);
        setStatus(lastNativeSyncMessage, Boolean(lastNativeSyncMessage));
        lastNativeSyncMessage = '';
        bindControls();
        return { ...stored };
    }

    function bindControls() {
        if (bound) return;
        const root = byId('theme-view');
        if (!root) return;
        bound = true;

        root.addEventListener('change', event => {
            if (event.target?.matches?.('#te-app-start-background,#te-app-start-duration,#te-app-start-animation')) {
                readControls();
                setStatus('', false);
            }
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
            setStatus('Startbild wird für das Hochformat optimiert …', false);
            try {
                pendingCustomImageBlob = await compressImageToPortrait(file, {});
                removeCustomImage = false;
                paintPreview(pendingCustomImageBlob);
                const background = byId('te-app-start-background');
                if (background) background.value = 'custom';
                draft = { ...currentDraft(), background: 'custom' };
                const panel = byId('te-app-start-custom-panel');
                if (panel) panel.hidden = false;
                setStatus('Eigenes Startbild ausgewählt. Mit „Änderungen speichern“ übernehmen.', false);
                root.dispatchEvent(new Event('input', { bubbles: true }));
            } catch (error) {
                console.error('[App-Start] Eigenes Startbild konnte nicht verarbeitet werden.', error);
                setStatus(error?.message || 'Das Startbild konnte nicht gespeichert werden.', true);
            }
        });

        byId('te-app-start-image-remove')?.addEventListener('click', async () => {
            pendingCustomImageBlob = null;
            removeCustomImage = true;
            paintPreview(null);
            const background = byId('te-app-start-background');
            if (background) background.value = 'standard';
            draft = { ...currentDraft(), background: 'standard' };
            const panel = byId('te-app-start-custom-panel');
            if (panel) panel.hidden = true;
            setStatus('Eigenes Startbild zum Entfernen vorgemerkt. Mit „Änderungen speichern“ übernehmen.', false);
            root.dispatchEvent(new Event('input', { bubbles: true }));
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
    }, { once: true });
})();