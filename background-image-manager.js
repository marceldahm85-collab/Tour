/* Hintergrundbild-Verwaltung für Premium Alpine.
   Schritt 2: Vorgegebene Alpenmotive zentral registrieren; die Speicher-APIs
   bleiben für spätere Galerie- und Backup-Funktionen erhalten. */
(function () {
    'use strict';

    const SETTINGS_KEY = 'appBackgroundSettings_v1';
    const CUSTOM_IMAGE_STORAGE_KEY = '~backgroundImage:custom-active';
    const CURRENT_PRESET_ID = 'alpine-classic';
    const CURRENT_IMAGE_URL =
        'https://images.unsplash.com/photo-1694968537484-d4e1733301b5?auto=format&fit=crop&w=1400&q=85';

    const PRESETS = Object.freeze([
        Object.freeze({
            id: CURRENT_PRESET_ID,
            name: 'Alpenpanorama',
            description: 'Bisheriges App-Hintergrundbild',
            src: CURRENT_IMAGE_URL,
            preview: CURRENT_IMAGE_URL,
            positionX: 56,
            positionY: 50,
            mobilePositionX: 59,
            landscapePositionX: 56,
            fit: 'cover',
            credit: 'Bisheriges App-Motiv',
            sourceUrl: '',
            licenseLabel: '',
            licenseUrl: ''
        }),
        Object.freeze({
            id: 'dolomites',
            name: 'Dolomiten',
            description: 'Markante Felsgipfel und alpine Bergflanken',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Dolomites.jpg/1280px-Dolomites.jpg',
            preview: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Dolomites.jpg/1280px-Dolomites.jpg',
            positionX: 52,
            positionY: 50,
            mobilePositionX: 54,
            landscapePositionX: 50,
            fit: 'cover',
            credit: 'Mona Hassan Abo-Abda · CC BY-SA 4.0',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dolomites.jpg',
            licenseLabel: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
        }),
        Object.freeze({
            id: 'alpine-lake-reflection',
            name: 'Bergsee',
            description: 'Schneebedeckte Gipfel spiegeln sich im stillen See',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Mountain_Reflection_on_Alpine_Lake.jpg/1280px-Mountain_Reflection_on_Alpine_Lake.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
            preview: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Mountain_Reflection_on_Alpine_Lake.jpg/1280px-Mountain_Reflection_on_Alpine_Lake.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
            positionX: 50,
            positionY: 50,
            mobilePositionX: 50,
            landscapePositionX: 50,
            fit: 'cover',
            credit: 'Sabrina Schreiber · CC BY-SA 4.0',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Mountain_Reflection_on_Alpine_Lake.jpg',
            licenseLabel: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
        }),
        Object.freeze({
            id: 'lake-landro',
            name: 'See & Dolomiten',
            description: 'Türkiser Bergsee vor den hellen Dolomitengipfeln',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Dolomites_and_Lake_Landro%2C_Italy.jpg/1280px-Dolomites_and_Lake_Landro%2C_Italy.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
            preview: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Dolomites_and_Lake_Landro%2C_Italy.jpg/1280px-Dolomites_and_Lake_Landro%2C_Italy.jpg?utm_campaign=index&utm_content=thumbnail&utm_source=commons.wikimedia.org',
            positionX: 50,
            positionY: 50,
            mobilePositionX: 50,
            landscapePositionX: 50,
            fit: 'cover',
            credit: 'Francesca.z73 · CC BY-SA 4.0',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Dolomites_and_Lake_Landro,_Italy.jpg',
            licenseLabel: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
        }),
        Object.freeze({
            id: 'alpine-meadows',
            name: 'Almwiesen',
            description: 'Grüne Bergwiesen, Wälder und weiter Alpenblick',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg/1280px-Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg',
            preview: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg/1280px-Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg',
            positionX: 54,
            positionY: 50,
            mobilePositionX: 58,
            landscapePositionX: 54,
            fit: 'cover',
            credit: 'Ddayzzz · CC BY 4.0',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alpine_meadows_and_mountain_panorama_from_Mount_Rigi,_September_2026.jpg',
            licenseLabel: 'CC BY 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'
        }),
        Object.freeze({
            id: 'alpine-sunset',
            name: 'Abendglühen',
            description: 'Warme Abendsonne über den Berner Alpen',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Alpenpanorama_bei_Sonnenuntergang.jpg/1280px-Alpenpanorama_bei_Sonnenuntergang.jpg',
            preview: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Alpenpanorama_bei_Sonnenuntergang.jpg/1280px-Alpenpanorama_bei_Sonnenuntergang.jpg',
            positionX: 56,
            positionY: 48,
            mobilePositionX: 59,
            landscapePositionX: 56,
            fit: 'cover',
            credit: 'MBudget · CC BY-SA 4.0',
            sourceUrl: 'https://commons.wikimedia.org/wiki/File:Alpenpanorama_bei_Sonnenuntergang.jpg',
            licenseLabel: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
        })
    ]);

    const DEFAULT_SETTINGS = Object.freeze({
        version: 1,
        mode: 'preset',
        presetId: CURRENT_PRESET_ID,
        customImageName: '',
        positionX: 56,
        positionY: 50,
        mobilePositionX: 59,
        landscapePositionX: 56,
        zoom: 1,
        fit: 'cover'
    });

    let currentSettings = null;
    let customImageObjectUrl = '';
    let initializationPromise = null;
    let sizingImage = null;
    let sizingImageUrl = '';
    let sizingImageToken = 0;
    let resizeListenerBound = false;

    function clamp(value, min, max, fallback) {
        const number = Number(value);
        return Number.isFinite(number)
            ? Math.min(max, Math.max(min, number))
            : fallback;
    }

    function findPreset(id) {
        return PRESETS.find(preset => preset.id === id) || PRESETS[0];
    }

    function normalizeSettings(value) {
        const source = value && typeof value === 'object' ? value : {};
        const preset = findPreset(source.presetId);

        return {
            version: 1,
            mode: source.mode === 'custom' ? 'custom' : 'preset',
            presetId: preset.id,
            customImageName: typeof source.customImageName === 'string'
                ? source.customImageName.slice(0, 180)
                : '',
            positionX: clamp(source.positionX, 0, 100, DEFAULT_SETTINGS.positionX),
            positionY: clamp(source.positionY, 0, 100, DEFAULT_SETTINGS.positionY),
            mobilePositionX: clamp(
                source.mobilePositionX, 0, 100, DEFAULT_SETTINGS.mobilePositionX
            ),
            landscapePositionX: clamp(
                source.landscapePositionX, 0, 100, DEFAULT_SETTINGS.landscapePositionX
            ),
            zoom: clamp(source.zoom, 1, 1.6, DEFAULT_SETTINGS.zoom),
            fit: 'cover'
        };
    }

    function getSettingsSnapshot() {
        return { ...(currentSettings || DEFAULT_SETTINGS) };
    }

    function applySettingsToDom() {
        const parallax = document.querySelector('.parallax');
        if (!parallax) return false;

        const settings = currentSettings || DEFAULT_SETTINGS;
        const preset = findPreset(settings.presetId);
        const imageUrl = settings.mode === 'custom' && customImageObjectUrl
            ? customImageObjectUrl
            : preset.src;

        parallax.style.setProperty(
            '--app-background-image',
            'url("' + imageUrl.replace(/["\\\\]/g, '') + '")'
        );
        parallax.style.setProperty(
            '--app-background-position',
            settings.positionX + '% ' + settings.positionY + '%'
        );
        parallax.style.setProperty(
            '--app-background-position-mobile',
            settings.mobilePositionX + '% ' + settings.positionY + '%'
        );
        parallax.style.setProperty(
            '--app-background-position-landscape',
            settings.landscapePositionX + '% ' + settings.positionY + '%'
        );

        document.documentElement.dataset.appBackgroundPreset =
            settings.mode === 'custom' ? 'custom' : preset.id;

        applyZoomSize();
        if (!resizeListenerBound && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', applyZoomSize, { passive: true });
            resizeListenerBound = true;
        }

        return true;
    }

    function applyZoomSize() {
        const parallax = document.querySelector('.parallax');
        if (!parallax) return;

        const settings = currentSettings || DEFAULT_SETTINGS;
        const preset = findPreset(settings.presetId);
        const imageUrl = settings.mode === 'custom' && customImageObjectUrl
            ? customImageObjectUrl
            : preset.src;
        if (!imageUrl) {
            parallax.style.setProperty('background-size', 'cover', 'important');
            return;
        }

        const zoom = clamp(settings.zoom, 1, 1.6, 1);
        // Bei der Standardgröße bleibt das ursprüngliche Cover-Verhalten aktiv;
        // dafür muss das Bild nicht zusätzlich zur CSS-Hintergrundebene geladen werden.
        if (zoom <= 1.001) {
            parallax.style.setProperty('background-size', 'cover', 'important');
            return;
        }

        const applyDimensions = () => {
            if (!sizingImage || !sizingImage.naturalWidth || !sizingImage.naturalHeight) {
                parallax.style.setProperty('background-size', 'cover', 'important');
                return;
            }

            const zoom = clamp(settings.zoom, 1, 1.6, 1);
            if (zoom <= 1.001) {
                parallax.style.setProperty('background-size', 'cover', 'important');
                return;
            }

            const width = parallax.clientWidth || window.innerWidth || 1;
            const height = parallax.clientHeight || window.innerHeight || 1;
            const coverScale = Math.max(
                width / sizingImage.naturalWidth,
                height / sizingImage.naturalHeight
            );
            const scaledWidth = Math.ceil(sizingImage.naturalWidth * coverScale * zoom);
            const scaledHeight = Math.ceil(sizingImage.naturalHeight * coverScale * zoom);

            // Explizite Pixelmaße skalieren das Cover-Ergebnis proportional,
            // ohne das Foto durch zwei unabhängige Prozentwerte zu verzerren.
            parallax.style.setProperty(
                'background-size',
                scaledWidth + 'px ' + scaledHeight + 'px',
                'important'
            );
        };

        if (sizingImage && sizingImageUrl === imageUrl && sizingImage.complete &&
            sizingImage.naturalWidth && sizingImage.naturalHeight) {
            applyDimensions();
            return;
        }

        const token = ++sizingImageToken;
        const image = new Image();
        sizingImage = image;
        sizingImageUrl = imageUrl;
        image.onload = () => {
            if (token !== sizingImageToken) return;
            applyDimensions();
        };
        image.onerror = () => {
            if (token !== sizingImageToken) return;
            parallax.style.setProperty('--app-background-size', 'cover');
        };
        image.src = imageUrl;
        if (image.complete && image.naturalWidth) applyDimensions();
    }

    function persistSettings() {
        if (typeof appStorage !== 'undefined' &&
            appStorage && typeof appStorage.set === 'function') {
            appStorage.set(SETTINGS_KEY, getSettingsSnapshot());
        }
    }

    function revokeCustomObjectUrl() {
        if (!customImageObjectUrl) return;
        try {
            URL.revokeObjectURL(customImageObjectUrl);
        } catch (_) {}
        customImageObjectUrl = '';
    }

    async function initialize() {
        if (initializationPromise) return initializationPromise;

        initializationPromise = (async () => {
            const stored = typeof appStorage !== 'undefined' &&
                appStorage && typeof appStorage.get === 'function'
                ? appStorage.get(SETTINGS_KEY)
                : null;

            currentSettings = normalizeSettings(stored || DEFAULT_SETTINGS);

            if (currentSettings.mode === 'custom') {
                try {
                    const blob = await _idbGet(CUSTOM_IMAGE_STORAGE_KEY);
                    if (blob instanceof Blob && blob.type.startsWith('image/')) {
                        revokeCustomObjectUrl();
                        customImageObjectUrl = URL.createObjectURL(blob);
                    } else {
                        currentSettings = normalizeSettings({
                            ...currentSettings,
                            mode: 'preset',
                            customImageName: ''
                        });
                        persistSettings();
                    }
                } catch (error) {
                    console.warn(
                        '[Hintergrund] Eigenes Hintergrundbild konnte nicht geladen werden:',
                        error
                    );
                    currentSettings = normalizeSettings({
                        ...currentSettings,
                        mode: 'preset',
                        customImageName: ''
                    });
                    persistSettings();
                }
            }

            if (!stored) persistSettings();
            applySettingsToDom();
            return getSettingsSnapshot();
        })().finally(() => {
            initializationPromise = null;
        });

        return initializationPromise;
    }

    function setPreset(id) {
        const preset = PRESETS.find(item => item.id === id);
        if (!preset) return false;

        revokeCustomObjectUrl();
        currentSettings = normalizeSettings({
            ...(currentSettings || DEFAULT_SETTINGS),
            mode: 'preset',
            presetId: preset.id,
            customImageName: '',
            positionX: preset.positionX,
            positionY: preset.positionY,
            mobilePositionX: preset.mobilePositionX,
            landscapePositionX: preset.landscapePositionX,
            zoom: 1
        });

        persistSettings();
        applySettingsToDom();
        return true;
    }

    function setImagePosition(values) {
        const input = values && typeof values === 'object' ? values : {};
        currentSettings = normalizeSettings({
            ...(currentSettings || DEFAULT_SETTINGS),
            positionX: input.positionX ?? currentSettings?.positionX,
            positionY: input.positionY ?? currentSettings?.positionY,
            mobilePositionX: input.mobilePositionX ?? currentSettings?.mobilePositionX,
            landscapePositionX: input.landscapePositionX ?? currentSettings?.landscapePositionX,
            zoom: input.zoom ?? currentSettings?.zoom
        });
        persistSettings();
        applySettingsToDom();
        return getSettingsSnapshot();
    }

    async function setCustomImage(blob, options) {
        if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) {
            throw new TypeError('Bitte eine gültige Bilddatei auswählen.');
        }
        if (blob.size <= 0 || blob.size > 15 * 1024 * 1024) {
            throw new RangeError('Das Hintergrundbild muss kleiner als 15 MB sein.');
        }
        if (typeof _idbSet !== 'function') {
            throw new Error('Der lokale Bildspeicher ist nicht verfügbar.');
        }

        if (!currentSettings) await initialize();
        const settings = currentSettings || DEFAULT_SETTINGS;
        const fileName = typeof options?.fileName === 'string'
            ? options.fileName.slice(0, 180)
            : '';

        // Das optimierte Bild wird getrennt von den kleinen Einstellungen gespeichert.
        // Erst nach erfolgreichem IndexedDB-Schreiben wird es zur aktiven Auswahl.
        await _idbSet(CUSTOM_IMAGE_STORAGE_KEY, blob);

        revokeCustomObjectUrl();
        customImageObjectUrl = URL.createObjectURL(blob);
        currentSettings = normalizeSettings({
            ...settings,
            mode: 'custom',
            customImageName: fileName,
            // Ein neu gewähltes Foto startet mittig; danach kann jede Ansicht
            // unabhängig horizontal und alle gemeinsam vertikal justiert werden.
            positionX: 50,
            positionY: 50,
            mobilePositionX: 50,
            landscapePositionX: 50,
            zoom: 1
        });

        persistSettings();
        applySettingsToDom();
        return getSettingsSnapshot();
    }

    async function getCustomImageBlob() {
        if (typeof _idbGet !== 'function') return null;
        const blob = await _idbGet(CUSTOM_IMAGE_STORAGE_KEY);
        return blob instanceof Blob ? blob : null;
    }

    async function clearCustomImage() {
        if (typeof _idbDel === 'function') {
            await _idbDel(CUSTOM_IMAGE_STORAGE_KEY);
        }
        revokeCustomObjectUrl();
        const existing = currentSettings || DEFAULT_SETTINGS;
        const preset = findPreset(existing.presetId || CURRENT_PRESET_ID);
        currentSettings = normalizeSettings({
            ...existing,
            mode: 'preset',
            presetId: preset.id,
            customImageName: '',
            positionX: preset.positionX,
            positionY: preset.positionY,
            mobilePositionX: preset.mobilePositionX,
            landscapePositionX: preset.landscapePositionX,
            zoom: 1
        });
        persistSettings();
        applySettingsToDom();
        return getSettingsSnapshot();
    }

    async function restoreBackupData(data) {
        if (!data || typeof data !== 'object' || !data.settings ||
            typeof data.settings !== 'object') {
            throw new TypeError('Die Hintergrunddaten in der Sicherungsdatei sind ungültig.');
        }
        if (typeof _idbSet !== 'function' || typeof _idbDel !== 'function') {
            throw new Error('Der lokale Hintergrundspeicher ist nicht verfügbar.');
        }

        const next = normalizeSettings(data.settings);
        let blob = data.customImageBlob instanceof Blob ? data.customImageBlob : null;

        // JSON-Sicherungen übertragen das eigene Hintergrundbild als Data-URL,
        // damit PWA und eigenständige Android-WebView denselben Editorzustand nutzen.
        if (!blob && typeof data.customImageDataUrl === 'string' && data.customImageDataUrl) {
            const encoded = data.customImageDataUrl;
            const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(encoded);
            const maxEncodedLength = Math.ceil((15 * 1024 * 1024) * 4 / 3) + 128;
            if (!match || encoded.length > maxEncodedLength) {
                throw new TypeError('Das Hintergrundbild in der Sicherungsdatei ist ungültig oder zu groß.');
            }
            const binary = atob(match[2]);
            if (binary.length > 15 * 1024 * 1024) {
                throw new RangeError('Das Hintergrundbild in der Sicherungsdatei ist größer als 15 MB.');
            }
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index++) {
                bytes[index] = binary.charCodeAt(index);
            }
            blob = new Blob([bytes], { type: match[1] });
        }

        const validBlob = Boolean(
            blob &&
            blob.type.startsWith('image/') &&
            blob.size > 0 &&
            blob.size <= 15 * 1024 * 1024
        );

        if (blob && !validBlob) {
            throw new RangeError('Das Hintergrundbild in der Sicherungsdatei ist ungültig oder zu groß.');
        }

        if (validBlob) {
            // Bild und Metadaten getrennt speichern; das Bild bleibt vom normalen
            // App-Startcache ausgeschlossen und wird nur bei Bedarf geladen.
            await _idbSet(CUSTOM_IMAGE_STORAGE_KEY, blob);
            revokeCustomObjectUrl();
            customImageObjectUrl = URL.createObjectURL(blob);
        } else {
            await _idbDel(CUSTOM_IMAGE_STORAGE_KEY);
            revokeCustomObjectUrl();
        }

        let restoredSettings = next;
        if (next.mode === 'custom' && !validBlob) {
            const fallbackPreset = findPreset(next.presetId || CURRENT_PRESET_ID);
            restoredSettings = normalizeSettings({
                mode: 'preset',
                presetId: fallbackPreset.id,
                customImageName: '',
                positionX: fallbackPreset.positionX,
                positionY: fallbackPreset.positionY,
                mobilePositionX: fallbackPreset.mobilePositionX,
                landscapePositionX: fallbackPreset.landscapePositionX,
                zoom: 1
            });
        }

        currentSettings = restoredSettings;
        persistSettings();
        applySettingsToDom();
        return getSettingsSnapshot();
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') resolve(reader.result);
                else reject(new Error('Das Hintergrundbild konnte nicht für die Sicherung vorbereitet werden.'));
            };
            reader.onerror = () => reject(reader.error || new Error('Das Hintergrundbild konnte nicht gelesen werden.'));
            reader.readAsDataURL(blob);
        });
    }

    async function createBackupData() {
        await initialize();
        const settings = getSettingsSnapshot();
        let customImageDataUrl = '';

        if (settings.mode === 'custom') {
            const blob = await getCustomImageBlob();
            if (!(blob instanceof Blob) || !blob.type.startsWith('image/') ||
                blob.size <= 0 || blob.size > 15 * 1024 * 1024) {
                throw new Error('Das eigene Hintergrundbild konnte nicht vollständig gesichert werden.');
            }
            customImageDataUrl = await blobToDataUrl(blob);
        }

        return {
            version: 1,
            settings,
            customImageDataUrl
        };
    }

    function installEditorBackupIntegration() {
        const originalBuild = window.buildAppDataPayload;
        if (typeof originalBuild === 'function' && !originalBuild.__appBackgroundBackup) {
            const wrappedBuild = async function () {
                const payload = await originalBuild.apply(this, arguments);
                if (!payload || typeof payload !== 'object') return payload;

                const meta = payload.meta && typeof payload.meta === 'object'
                    ? payload.meta
                    : {};

                try {
                    const unifiedSettings = typeof appStorage !== 'undefined' &&
                        appStorage && typeof appStorage.get === 'function'
                        ? appStorage.get('themeEditorUnifiedSettings_v1')
                        : null;
                    if (unifiedSettings && typeof unifiedSettings === 'object') {
                        meta.themeEditorUnifiedSettings = unifiedSettings;
                    }
                    meta.appBackground = await createBackupData();
                    payload.meta = meta;
                    return payload;
                } catch (error) {
                    console.error('[Editor-Sicherung] Editor-Einstellungen konnten nicht vollständig exportiert werden.', error);
                    throw error;
                }
            };
            wrappedBuild.__appBackgroundBackup = true;
            window.buildAppDataPayload = wrappedBuild;
        }

        const originalApply = window.applyAppDataPayload;
        if (typeof originalApply === 'function' && !originalApply.__appBackgroundBackup) {
            const wrappedApply = function (payload) {
                const result = originalApply.apply(this, arguments);
                const meta = payload && typeof payload === 'object' &&
                    payload.meta && typeof payload.meta === 'object'
                    ? payload.meta
                    : {};

                if (meta.themeEditorUnifiedSettings &&
                    typeof meta.themeEditorUnifiedSettings === 'object' &&
                    typeof appStorage !== 'undefined' &&
                    appStorage && typeof appStorage.set === 'function') {
                    appStorage.set('themeEditorUnifiedSettings_v1', meta.themeEditorUnifiedSettings);
                    try {
                        localStorage.setItem(
                            'themeEditorUnifiedSettings_v1',
                            JSON.stringify(meta.themeEditorUnifiedSettings)
                        );
                    } catch (_) {}
                    if (typeof window.invalidateThemeEditorDraft === 'function') {
                        window.invalidateThemeEditorDraft();
                    }
                    if (typeof window.applyThemeEditorSettingsToDom === 'function') {
                        window.applyThemeEditorSettingsToDom();
                    }
                }

                if (meta.appBackground && typeof meta.appBackground === 'object') {
                    restoreBackupData(meta.appBackground)
                        .then(() => {
                            if (typeof window.refreshAppBackgroundPicker === 'function') {
                                return window.refreshAppBackgroundPicker();
                            }
                            return null;
                        })
                        .catch(error => {
                            console.error('[Editor-Sicherung] Hintergrundbild konnte nicht wiederhergestellt werden.', error);
                            if (typeof window.showToast === 'function') {
                                window.showToast('Hintergrundbild konnte nicht aus der Sicherung übernommen werden.', {
                                    type: 'error',
                                    duration: 3500
                                });
                            }
                        });
                }

                return result;
            };
            wrappedApply.__appBackgroundBackup = true;
            window.applyAppDataPayload = wrappedApply;
        }
    }

    window.getAppBackgroundPresetCatalog = function () {
        return PRESETS.map(preset => ({
            id: preset.id,
            name: preset.name,
            description: preset.description,
            preview: preset.preview,
            credit: preset.credit || '',
            sourceUrl: preset.sourceUrl || '',
            licenseLabel: preset.licenseLabel || '',
            licenseUrl: preset.licenseUrl || ''
        }));
    };
    window.getAppBackgroundSettings = getSettingsSnapshot;
    window.applyAppBackgroundSettingsToDom = applySettingsToDom;
    window.setAppBackgroundPreset = setPreset;
    window.setAppBackgroundImagePosition = setImagePosition;
    window.setAppBackgroundCustomImage = setCustomImage;
    window.getAppBackgroundCustomImageBlob = getCustomImageBlob;
    window.clearAppBackgroundCustomImage = clearCustomImage;
    window.restoreAppBackgroundBackupData = restoreBackupData;
    window.getAppBackgroundBackupData = createBackupData;
    window.refreshAppBackgroundFromStorage = initialize;

    installEditorBackupIntegration();

    // Nach erfolgreicher IndexedDB-Initialisierung laden.
    const originalInitStorage = window.initStorage;
    if (typeof originalInitStorage === 'function') {
        window.initStorage = async function (...args) {
            const result = await originalInitStorage.apply(this, args);
            await initialize();
            return result;
        };
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }
})();
