/* Hintergrundbild-Auswahl für Premium Alpine – Presets, Galerie und Position.
   Eigene Fotos werden lokal verkleinert und separat in IndexedDB gespeichert. */
(function () {
    'use strict';

    const grid = document.getElementById('background-image-presets');
    const status = document.getElementById('background-image-selected-label');
    const credits = document.getElementById('background-image-credits-list');
    const fileInput = document.getElementById('background-image-file-input');
    const chooseButton = document.getElementById('background-image-choose-file');
    const uploadStatus = document.getElementById('background-image-upload-status');
    const customPanel = document.getElementById('background-image-custom-panel');
    const customPreview = document.getElementById('background-image-custom-preview');
    const customName = document.getElementById('background-image-custom-name');
    const customMeta = document.getElementById('background-image-custom-meta');
    const activateCustomButton = document.getElementById('background-image-activate-custom');
    const removeCustomButton = document.getElementById('background-image-remove-custom');
    const positionPanel = document.getElementById('background-image-position-panel');
    const positionX = document.getElementById('background-image-position-x');
    const positionY = document.getElementById('background-image-position-y');
    const positionXValue = document.getElementById('background-image-position-x-value');
    const positionYValue = document.getElementById('background-image-position-y-value');
    const centerButton = document.getElementById('background-image-center-position');
    const profileButtons = Array.from(document.querySelectorAll('[data-background-profile]'));

    if (!grid) return;

    const MAX_SOURCE_FILE_SIZE = 40 * 1024 * 1024;
    const MAX_STORED_IMAGE_SIZE = 15 * 1024 * 1024;
    const MAX_IMAGE_EDGE = 1920;
    let activeProfile = 'portrait';
    let customPreviewObjectUrl = '';
    let customPreviewRequest = 0;
    let uploadBusy = false;

    const PROFILE_FIELDS = {
        portrait: 'mobilePositionX',
        landscape: 'landscapePositionX',
        desktop: 'positionX'
    };

    function getCatalog() {
        try {
            return typeof window.getAppBackgroundPresetCatalog === 'function'
                ? window.getAppBackgroundPresetCatalog()
                : [];
        } catch (error) {
            console.warn('[Hintergrund] Preset-Katalog konnte nicht gelesen werden:', error);
            return [];
        }
    }

    function getSettings() {
        try {
            return typeof window.getAppBackgroundSettings === 'function'
                ? window.getAppBackgroundSettings()
                : { mode: 'preset', presetId: 'alpine-classic' };
        } catch (_) {
            return { mode: 'preset', presetId: 'alpine-classic' };
        }
    }

    function showToast(message, type) {
        try {
            if (typeof window.showToast === 'function') {
                window.showToast(message, { type: type || 'success', duration: 2600 });
            }
        } catch (_) {}
    }

    function setUploadStatus(message, isError) {
        if (!uploadStatus) return;
        uploadStatus.textContent = message || '';
        uploadStatus.classList.toggle('is-error', Boolean(isError));
        uploadStatus.hidden = !message;
    }

    function setUploadBusy(busy) {
        uploadBusy = Boolean(busy);
        if (chooseButton) {
            chooseButton.disabled = uploadBusy;
            chooseButton.textContent = uploadBusy
                ? 'Bild wird vorbereitet …'
                : 'Bild aus Galerie auswählen';
        }
        if (fileInput) fileInput.disabled = uploadBusy;
    }

    function createPresetCard(preset, selected) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'background-preset-card' + (selected ? ' is-selected' : '');
        button.dataset.presetId = preset.id;
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.setAttribute(
            'aria-label',
            preset.name + (selected ? ', aktuell ausgewählt' : ', als Hintergrund auswählen')
        );

        const imageWrap = document.createElement('span');
        imageWrap.className = 'background-preset-image-wrap';

        const image = document.createElement('img');
        image.className = 'background-preset-image';
        image.src = preset.preview;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
            imageWrap.classList.add('image-unavailable');
            image.hidden = true;
        }, { once: true });

        const check = document.createElement('span');
        check.className = 'background-preset-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';

        imageWrap.append(image, check);

        const textWrap = document.createElement('span');
        textWrap.className = 'background-preset-copy';

        const title = document.createElement('strong');
        title.className = 'background-preset-title';
        title.textContent = preset.name;

        const description = document.createElement('span');
        description.className = 'background-preset-description';
        description.textContent = preset.description || '';

        textWrap.append(title, description);
        button.append(imageWrap, textWrap);

        button.addEventListener('click', () => {
            try {
                if (typeof window.setAppBackgroundPreset !== 'function') {
                    throw new Error('Die Hintergrundverwaltung ist nicht verfügbar.');
                }

                const applied = window.setAppBackgroundPreset(preset.id);
                if (!applied) {
                    throw new Error('Dieses Hintergrundmotiv konnte nicht ausgewählt werden.');
                }

                render();
                syncPositionControls();
                showToast('Hintergrundbild „' + preset.name + '“ übernommen ✓');
            } catch (error) {
                console.error('[Hintergrund] Preset konnte nicht übernommen werden:', error);
                showToast(error.message || 'Hintergrundbild konnte nicht übernommen werden.', 'error');
            }
        });

        return button;
    }

    function renderCredits(catalog) {
        if (!credits) return;
        credits.replaceChildren();

        catalog.filter(preset => preset.sourceUrl && preset.credit).forEach(preset => {
            const item = document.createElement('li');
            const source = document.createElement('a');
            source.href = preset.sourceUrl;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = preset.name + ' – ' + preset.credit;
            item.appendChild(source);

            if (preset.licenseUrl && preset.licenseLabel) {
                const license = document.createElement('a');
                license.href = preset.licenseUrl;
                license.target = '_blank';
                license.rel = 'noopener noreferrer';
                license.textContent = 'Lizenz';
                license.setAttribute('aria-label', preset.licenseLabel + ' Lizenz für ' + preset.name);
                item.append(' · ', license);
            }

            credits.appendChild(item);
        });
    }

    function render() {
        const catalog = getCatalog();
        const settings = getSettings();
        if (!catalog.length) {
            grid.textContent = 'Die Hintergrundmotive konnten nicht geladen werden.';
            return;
        }

        const activePresetId = settings.mode === 'custom' ? '' : settings.presetId;
        grid.replaceChildren();

        catalog.forEach(preset => {
            grid.appendChild(createPresetCard(preset, preset.id === activePresetId));
        });

        const activePreset = catalog.find(preset => preset.id === activePresetId);
        if (status) {
            status.textContent = settings.mode === 'custom'
                ? 'Aktiv: eigenes Foto'
                : 'Aktiv: ' + (activePreset ? activePreset.name : 'Alpenpanorama');
        }

        renderCredits(catalog);
        syncPositionControls();
    }

    function revokeCustomPreviewUrl() {
        if (!customPreviewObjectUrl) return;
        try {
            URL.revokeObjectURL(customPreviewObjectUrl);
        } catch (_) {}
        customPreviewObjectUrl = '';
    }

    function formatFileSize(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '';
        return bytes >= 1024 * 1024
            ? (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB'
            : Math.max(1, Math.round(bytes / 1024)) + ' KB';
    }

    async function refreshCustomPreview() {
        const requestId = ++customPreviewRequest;
        if (!customPanel || typeof window.getAppBackgroundCustomImageBlob !== 'function') return;

        let blob = null;
        try {
            blob = await window.getAppBackgroundCustomImageBlob();
        } catch (error) {
            console.warn('[Hintergrund] Eigenes Foto konnte nicht gelesen werden:', error);
        }

        if (requestId !== customPreviewRequest) return;

        const settings = getSettings();
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) {
            revokeCustomPreviewUrl();
            customPanel.hidden = true;
            if (positionPanel) positionPanel.hidden = settings.mode !== 'custom';
            return;
        }

        revokeCustomPreviewUrl();
        customPreviewObjectUrl = URL.createObjectURL(blob);

        if (customPreview) {
            customPreview.src = customPreviewObjectUrl;
            customPreview.hidden = false;
        }
        if (customName) {
            customName.textContent = settings.customImageName || 'Eigenes Hintergrundbild';
        }
        if (customMeta) {
            customMeta.textContent = formatFileSize(blob.size) + ' · optimiert · lokal gespeichert';
        }
        if (activateCustomButton) {
            activateCustomButton.hidden = settings.mode === 'custom';
            activateCustomButton.disabled = settings.mode === 'custom';
        }
        if (removeCustomButton) removeCustomButton.hidden = false;
        customPanel.hidden = false;
        if (positionPanel) positionPanel.hidden = false;
    }

    function getActiveHorizontalField(settings) {
        return PROFILE_FIELDS[activeProfile] || 'mobilePositionX';
    }

    function syncPositionControls() {
        if (!positionPanel || !positionX || !positionY) return;

        const settings = getSettings();
        const field = getActiveHorizontalField(settings);
        const x = Number(settings[field]);
        const y = Number(settings.positionY);
        positionX.value = String(Number.isFinite(x) ? x : 50);
        positionY.value = String(Number.isFinite(y) ? y : 50);
        if (positionXValue) positionXValue.textContent = positionX.value + ' %';
        if (positionYValue) positionYValue.textContent = positionY.value + ' %';

        profileButtons.forEach(button => {
            const selected = button.dataset.backgroundProfile === activeProfile;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });

        positionPanel.hidden = false;
    }

    function updatePositionFromControls() {
        if (typeof window.setAppBackgroundImagePosition !== 'function') return;

        const settings = getSettings();
        const field = getActiveHorizontalField(settings);
        const values = {
            [field]: Number(positionX.value),
            positionY: Number(positionY.value)
        };

        try {
            window.setAppBackgroundImagePosition(values);
            if (positionXValue) positionXValue.textContent = positionX.value + ' %';
            if (positionYValue) positionYValue.textContent = positionY.value + ' %';
        } catch (error) {
            console.error('[Hintergrund] Bildposition konnte nicht gespeichert werden:', error);
            showToast('Bildposition konnte nicht gespeichert werden.', 'error');
        }
    }

    function decodeWithImageElement(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => resolve({
                source: image,
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height,
                cleanup: () => URL.revokeObjectURL(objectUrl)
            });
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Das Bildformat kann von diesem Browser nicht gelesen werden.'));
            };
            image.src = objectUrl;
        });
    }

    async function decodeImageFile(file) {
        if (typeof window.createImageBitmap === 'function') {
            try {
                const bitmap = await window.createImageBitmap(file, {
                    imageOrientation: 'from-image'
                });
                return {
                    source: bitmap,
                    width: bitmap.width,
                    height: bitmap.height,
                    cleanup: () => {
                        if (typeof bitmap.close === 'function') bitmap.close();
                    }
                };
            } catch (error) {
                console.info('[Hintergrund] createImageBitmap nicht verfügbar; nutze Bilddecoder:', error);
            }
        }
        return decodeWithImageElement(file);
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(resolve => {
            try {
                canvas.toBlob(blob => resolve(blob || null), type, quality);
            } catch (_) {
                resolve(null);
            }
        });
    }

    async function encodeOptimizedImage(decoded) {
        const maxDimension = Math.max(decoded.width, decoded.height);
        if (!decoded.width || !decoded.height || !Number.isFinite(maxDimension)) {
            throw new Error('Die Bildabmessungen konnten nicht erkannt werden.');
        }

        const scale = Math.min(1, MAX_IMAGE_EDGE / maxDimension);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(decoded.width * scale));
        canvas.height = Math.max(1, Math.round(decoded.height * scale));

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Die Bildoptimierung wird von diesem Browser nicht unterstützt.');

        context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

        let blob = await canvasToBlob(canvas, 'image/webp', 0.84);
        if (!blob || blob.type !== 'image/webp') {
            // Ältere Browser können WebP beim Canvas-Export nicht anbieten.
            blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
        }

        if (!blob) throw new Error('Das Foto konnte nicht optimiert werden.');

        if (blob.size > MAX_STORED_IMAGE_SIZE) {
            const smallerScale = Math.min(1, 1600 / maxDimension);
            canvas.width = Math.max(1, Math.round(decoded.width * smallerScale));
            canvas.height = Math.max(1, Math.round(decoded.height * smallerScale));
            const smallerContext = canvas.getContext('2d', { alpha: false });
            if (!smallerContext) throw new Error('Die Bildoptimierung ist fehlgeschlagen.');
            smallerContext.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
            blob = await canvasToBlob(canvas, 'image/webp', 0.72);
            if (!blob || blob.type !== 'image/webp') {
                blob = await canvasToBlob(canvas, 'image/jpeg', 0.76);
            }
        }

        if (!blob || blob.size <= 0 || blob.size > MAX_STORED_IMAGE_SIZE) {
            throw new Error('Das optimierte Bild ist noch zu groß. Bitte ein anderes Foto wählen.');
        }

        return blob;
    }

    async function processSelectedFile(file) {
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
            throw new Error('Bitte eine Bilddatei auswählen.');
        }
        if (file.size <= 0) throw new Error('Die ausgewählte Datei ist leer.');
        if (file.size > MAX_SOURCE_FILE_SIZE) {
            throw new Error('Das Originalfoto ist größer als 40 MB. Bitte ein kleineres Foto wählen.');
        }

        const decoded = await decodeImageFile(file);
        try {
            const optimizedBlob = await encodeOptimizedImage(decoded);
            if (typeof window.setAppBackgroundCustomImage !== 'function') {
                throw new Error('Die lokale Hintergrundbild-Verwaltung ist nicht verfügbar.');
            }

            await window.setAppBackgroundCustomImage(optimizedBlob, {
                fileName: file.name || 'Eigenes Hintergrundbild'
            });
        } finally {
            try {
                decoded.cleanup();
            } catch (_) {}
        }

        render();
        await refreshCustomPreview();
        showToast('Eigenes Hintergrundbild übernommen ✓');
    }

    if (chooseButton && fileInput) {
        chooseButton.addEventListener('click', () => {
            if (!uploadBusy) fileInput.click();
        });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;

            setUploadBusy(true);
            setUploadStatus('Foto wird geprüft und auf maximal 1920 Pixel optimiert …');
            try {
                await processSelectedFile(file);
                setUploadStatus('Eigenes Foto ist aktiv und lokal gespeichert.');
            } catch (error) {
                console.error('[Hintergrund] Fotoimport fehlgeschlagen:', error);
                setUploadStatus(error.message || 'Das Foto konnte nicht übernommen werden.', true);
                showToast(error.message || 'Das Foto konnte nicht übernommen werden.', 'error');
            } finally {
                setUploadBusy(false);
                // Dasselbe Foto kann später erneut ausgewählt werden.
                fileInput.value = '';
            }
        });
    }

    if (activateCustomButton) {
        activateCustomButton.addEventListener('click', async () => {
            try {
                const blob = await window.getAppBackgroundCustomImageBlob();
                if (!(blob instanceof Blob)) throw new Error('Es ist kein eigenes Foto gespeichert.');
                await window.setAppBackgroundCustomImage(blob, {
                    fileName: getSettings().customImageName || 'Eigenes Hintergrundbild'
                });
                render();
                await refreshCustomPreview();
                showToast('Eigenes Foto wieder aktiviert ✓');
            } catch (error) {
                showToast(error.message || 'Eigenes Foto konnte nicht aktiviert werden.', 'error');
            }
        });
    }

    if (removeCustomButton) {
        removeCustomButton.addEventListener('click', async () => {
            const settings = getSettings();
            const confirmed = typeof window.confirm === 'function'
                ? window.confirm('Das gespeicherte eigene Hintergrundbild wirklich löschen?')
                : true;
            if (!confirmed) return;

            try {
                await window.clearAppBackgroundCustomImage();
                revokeCustomPreviewUrl();
                render();
                await refreshCustomPreview();
                showToast('Eigenes Hintergrundbild gelöscht.', 'success');
            } catch (error) {
                showToast('Eigenes Hintergrundbild konnte nicht gelöscht werden.', 'error');
            }
        });
    }

    profileButtons.forEach(button => {
        button.addEventListener('click', () => {
            const profile = button.dataset.backgroundProfile;
            if (!PROFILE_FIELDS[profile]) return;
            activeProfile = profile;
            syncPositionControls();
        });
    });

    positionX?.addEventListener('input', updatePositionFromControls);
    positionY?.addEventListener('input', updatePositionFromControls);

    centerButton?.addEventListener('click', () => {
        if (typeof window.setAppBackgroundImagePosition !== 'function') return;
        try {
            window.setAppBackgroundImagePosition({
                positionX: 50,
                positionY: 50,
                mobilePositionX: 50,
                landscapePositionX: 50
            });
            syncPositionControls();
            showToast('Bildposition zentriert.');
        } catch (error) {
            showToast('Bildposition konnte nicht zurückgesetzt werden.', 'error');
        }
    });

    // Beim ersten Rendern nur die Presets anzeigen. Nach IndexedDB-Init wird
    // das gespeicherte eigene Foto samt aktiver Position wiederhergestellt.
    render();
    refreshCustomPreview().catch(error => {
        console.warn('[Hintergrund] Vorschau des eigenen Fotos konnte nicht geladen werden:', error);
    });

    const originalInitStorage = window.initStorage;
    if (typeof originalInitStorage === 'function') {
        window.initStorage = async function (...args) {
            const result = await originalInitStorage.apply(this, args);
            render();
            await refreshCustomPreview();
            return result;
        };
    }

    window.addEventListener('beforeunload', revokeCustomPreviewUrl);
})();