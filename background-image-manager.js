/* Hintergrundbild-Verwaltung für Premium Alpine.
   Schritt 2: Vorgegebene Alpenmotive zentral registrieren; die Speicher-APIs
   bleiben für spätere Galerie- und Backup-Funktionen erhalten. */
(function () {
    'use strict';

    const SETTINGS_KEY = 'appBackgroundSettings_v1';
    const CUSTOM_IMAGE_STORAGE_KEY = '~backgroundImage:custom-active';
    const CUSTOM_IMAGE_ASSET_PREFIX = '~backgroundImage:asset:';
    const LEGACY_CUSTOM_IMAGE_ID = 'legacy';
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
        customImageId: '',
        positionX: 56,
        positionY: 50,
        mobilePositionX: 59,
        landscapePositionX: 56,
        zoom: 1,
        fit: 'cover'
    });

    let currentSettings=null,customImageObjectUrl='';
    let editorDraftActive=false,editorOriginalSettings=null,editorOriginalBlob=null;
    let pendingCustomBlob=null,pendingCustomImageId='';
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

    function customImageStorageKey(id) {
        const safeId = typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? id : LEGACY_CUSTOM_IMAGE_ID;
        return safeId === LEGACY_CUSTOM_IMAGE_ID ? CUSTOM_IMAGE_STORAGE_KEY : CUSTOM_IMAGE_ASSET_PREFIX + safeId;
    }

    function createCustomImageId() {
        try {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return 'img-' + window.crypto.randomUUID();
            }
        } catch (_) {}
        return 'img-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    }

    function normalizeSettings(value) {
        const source = value && typeof value === 'object' ? value : {};
        const preset = findPreset(source.presetId);
        const mode = source.mode === 'custom' ? 'custom' : 'preset';
        const imageId = typeof source.customImageId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(source.customImageId)
            ? source.customImageId
            : LEGACY_CUSTOM_IMAGE_ID;

        return {
            version: 1,
            mode,
            presetId: preset.id,
            customImageName: typeof source.customImageName === 'string'
                ? source.customImageName.slice(0, 180)
                : '',
            customImageId: mode === 'custom' ? imageId : '',
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

    function persistSettings(){if(editorDraftActive)return;if(typeof appStorage!=='undefined'&&appStorage?.set)appStorage.set(SETTINGS_KEY,getSettingsSnapshot());}
    async function beginEditorDraft(){if(!currentSettings)await initialize();if(editorDraftActive)return getSettingsSnapshot();editorOriginalSettings=getSettingsSnapshot();editorOriginalBlob=await getCustomImageBlob();pendingCustomBlob=null;pendingCustomImageId='';editorDraftActive=true;return getSettingsSnapshot();}
    async function persistDraftAsset(){if(!(pendingCustomBlob instanceof Blob)||!pendingCustomImageId)return false;await _idbSet(customImageStorageKey(pendingCustomImageId),pendingCustomBlob);pendingCustomBlob=null;pendingCustomImageId='';return true;}
    async function commitEditorDraft(){if(!editorDraftActive)return getSettingsSnapshot();await persistDraftAsset();if(typeof appStorage!=='undefined'&&appStorage?.set)appStorage.set(SETTINGS_KEY,getSettingsSnapshot());editorDraftActive=false;editorOriginalSettings=null;editorOriginalBlob=null;pendingCustomBlob=null;pendingCustomImageId='';return getSettingsSnapshot();}
    async function discardEditorDraft(){if(!editorDraftActive)return getSettingsSnapshot();revokeCustomObjectUrl();currentSettings=normalizeSettings(editorOriginalSettings||DEFAULT_SETTINGS);if(currentSettings.mode==='custom'&&editorOriginalBlob instanceof Blob)customImageObjectUrl=URL.createObjectURL(editorOriginalBlob);editorDraftActive=false;editorOriginalSettings=null;editorOriginalBlob=null;pendingCustomBlob=null;pendingCustomImageId='';applySettingsToDom();return getSettingsSnapshot();}
    async function setSettingsSnapshot(v){currentSettings=normalizeSettings(v);revokeCustomObjectUrl();if(currentSettings.mode==='custom'){const blob=await getCustomImageBlob();if(blob instanceof Blob)customImageObjectUrl=URL.createObjectURL(blob);}applySettingsToDom();persistSettings();return getSettingsSnapshot();}

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
                    const blob = await _idbGet(customImageStorageKey(currentSettings.customImageId));
                    if (blob instanceof Blob && blob.type.startsWith('image/')) {
                        revokeCustomObjectUrl();
                        customImageObjectUrl = URL.createObjectURL(blob);
                    } else {
                        currentSettings = normalizeSettings({
                            ...currentSettings,
                            mode: 'preset',
                            customImageName: '',
                            customImageId: ''
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
                        customImageName: '',
                        customImageId: ''
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
            customImageId: '',
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

        // Jedes importierte Motiv erhält eine eigene ID. Presets verweisen auf
        // dieselbe IndexedDB-Datei, statt das Foto pro Preset zu duplizieren.
        const customImageId = createCustomImageId();
        if(editorDraftActive){pendingCustomBlob=blob;pendingCustomImageId=customImageId;}
        else await _idbSet(customImageStorageKey(customImageId),blob);
        revokeCustomObjectUrl();
        customImageObjectUrl = URL.createObjectURL(blob);
        currentSettings = normalizeSettings({
            ...settings,
            mode: 'custom',
            customImageName: fileName,
            customImageId,
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

    async function getCustomImageBlob(){
        if(!currentSettings||currentSettings.mode!=='custom')return null;
        const id=currentSettings.customImageId||LEGACY_CUSTOM_IMAGE_ID;
        if(pendingCustomBlob instanceof Blob && pendingCustomImageId===id)return pendingCustomBlob;
        if(typeof _idbGet!=='function')return null;
        const blob=await _idbGet(customImageStorageKey(id));
        return blob instanceof Blob?blob:null;
    }

    async function clearCustomImage() {
        // Das Bild bleibt gespeichert, falls ein Design-Preset darauf verweist.
        if(pendingCustomBlob instanceof Blob && pendingCustomImageId===currentSettings?.customImageId){pendingCustomBlob=null;pendingCustomImageId='';}
        revokeCustomObjectUrl();
        const existing = currentSettings || DEFAULT_SETTINGS;
        const preset = findPreset(existing.presetId || CURRENT_PRESET_ID);
        currentSettings = normalizeSettings({
            ...existing,
            mode: 'preset',
            presetId: preset.id,
            customImageName: '',
            customImageId: '',
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
        const decodeDataUrl = encoded => {
            if (typeof encoded !== 'string' || !encoded) {
                throw new TypeError('Ein Hintergrundbild in der Sicherungsdatei fehlt.');
            }
            const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(encoded);
            const maxEncodedLength = Math.ceil((15 * 1024 * 1024) * 4 / 3) + 128;
            if (!match || encoded.length > maxEncodedLength) {
                throw new TypeError('Ein Hintergrundbild in der Sicherungsdatei ist ungültig oder zu groß.');
            }
            const binary = atob(match[2]);
            if (binary.length > 15 * 1024 * 1024) {
                throw new RangeError('Ein Hintergrundbild in der Sicherungsdatei ist größer als 15 MB.');
            }
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index++) {
                bytes[index] = binary.charCodeAt(index);
            }
            return new Blob([bytes], { type: match[1] });
        };

        let blob = data.customImageBlob instanceof Blob ? data.customImageBlob : null;

        const customImages = [];
        if (Array.isArray(data.customImages)) {
            if (data.customImages.length > 100) {
                throw new RangeError('Die Sicherungsdatei enthält zu viele Editor-Hintergrundbilder.');
            }
            const seenImageIds = new Set();
            for (const image of data.customImages) {
                const id = typeof image?.id === 'string' ? image.id : '';
                if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || seenImageIds.has(id)) {
                    throw new TypeError('Ein Editor-Hintergrundbild in der Sicherungsdatei hat eine ungültige Kennung.');
                }
                seenImageIds.add(id);
                const imageBlob = decodeDataUrl(image.dataUrl);
                if (Number.isFinite(Number(image.size)) && Number(image.size) !== imageBlob.size) {
                    throw new Error('Die Größe eines Editor-Hintergrundbildes stimmt nicht mit den Sicherungsdaten überein.');
                }
                customImages.push({ id, blob: imageBlob });
            }
        }

        if (!blob && typeof data.customImageDataUrl === 'string' && data.customImageDataUrl) {
            blob = decodeDataUrl(data.customImageDataUrl);
        }
        if (!blob && next.mode === 'custom') {
            const activeAsset = customImages.find(image => image.id === next.customImageId);
            if (activeAsset) blob = activeAsset.blob;
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

        // Zuerst die von gespeicherten Editor-Presets referenzierten Assets
        // unter ihren bisherigen IDs wiederherstellen.
        for (const image of customImages) {
            await _idbSet(customImageStorageKey(image.id), image.blob);
        }

        let restoredSettings = next;
        if (validBlob && next.mode === 'custom') {
            const importedActiveAssetExists = customImages.some(
                image => image.id === next.customImageId
            );
            if (importedActiveAssetExists) {
                // Die vollständige Sicherung bringt die ursprüngliche Asset-ID mit,
                // auf die auch gespeicherte Editor-Presets verweisen.
                revokeCustomObjectUrl();
                customImageObjectUrl = URL.createObjectURL(blob);
                restoredSettings = next;
            } else {
                // Alte Sicherungen ohne Asset-Liste bekommen eine neue ID, damit
                // vorhandene lokale Preset-Verknüpfungen nicht überschrieben werden.
                const restoredImageId = createCustomImageId();
                await _idbSet(customImageStorageKey(restoredImageId), blob);
                revokeCustomObjectUrl();
                customImageObjectUrl = URL.createObjectURL(blob);
                restoredSettings = normalizeSettings({ ...next, customImageId: restoredImageId });
            }
        } else if (!validBlob) {
            revokeCustomObjectUrl();
        }
        if (next.mode === 'custom' && !validBlob) {
            const fallbackPreset = findPreset(next.presetId || CURRENT_PRESET_ID);
            restoredSettings = normalizeSettings({
                mode: 'preset',
                presetId: fallbackPreset.id,
                customImageName: '',
                customImageId: '',
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

        // Das aktive Bild wird genau einmal unter dem bisherigen Feld gesichert,
        // damit ältere App-Versionen es weiterhin wiederherstellen können.
        if (settings.mode === 'custom') {
            const blob = await getCustomImageBlob();
            if (!(blob instanceof Blob) || !blob.type.startsWith('image/') ||
                blob.size <= 0 || blob.size > 15 * 1024 * 1024) {
                throw new Error('Das eigene Hintergrundbild konnte nicht vollständig gesichert werden.');
            }
            customImageDataUrl = await blobToDataUrl(blob);
        }

        // Zusätzliche Bilder werden nur aufgenommen, wenn ein gespeichertes
        // Editor-Preset tatsächlich auf sie verweist.
        const imageIds = new Set();
        const addPresetImageId = backgroundSettings => {
            if (!backgroundSettings || backgroundSettings.mode !== 'custom') return;
            const id = backgroundSettings.customImageId;
            if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
                throw new Error('Ein eigenes Hintergrundbild in einem Editor-Preset hat keine gültige Kennung. Die Sicherung wurde nicht erstellt.');
            }
            imageIds.add(id);
        };

        const editorPresets = typeof appStorage !== 'undefined' && appStorage
            ? appStorage.get('themeEditorPresets_v1')
            : null;
        if (editorPresets && typeof editorPresets === 'object' && !Array.isArray(editorPresets)) {
            Object.values(editorPresets).forEach(preset => addPresetImageId(preset?.background));
        }

        const customImages = [];
        for (const id of imageIds) {
            const imageBlob = await _idbGet(customImageStorageKey(id));
            if (!(imageBlob instanceof Blob) || !imageBlob.type.startsWith('image/') ||
                imageBlob.size <= 0 || imageBlob.size > 15 * 1024 * 1024) {
                throw new Error('Ein eigenes Hintergrundbild eines gespeicherten Editor-Presets fehlt oder ist ungültig. Die Sicherung wurde nicht erstellt.');
            }
            customImages.push({
                id,
                size: imageBlob.size,
                dataUrl: await blobToDataUrl(imageBlob)
            });
        }

        return {
            version: 2,
            settings,
            customImageDataUrl,
            customImages
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
            const wrappedApply = async function (payload) {
                const result = await originalApply.apply(this, arguments);
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
                    if (typeof meta.themeEditorUnifiedSettings.haptics === 'boolean' &&
                        typeof appStorage.set === 'function') {
                        appStorage.set('hapticFeedbackEnabled_v1', meta.themeEditorUnifiedSettings.haptics);
                        appStorage.set('bergTourenHaptics', meta.themeEditorUnifiedSettings.haptics ? 'on' : 'off');
                        try {
                            localStorage.setItem('hapticFeedbackEnabled_v1', JSON.stringify(meta.themeEditorUnifiedSettings.haptics));
                            localStorage.setItem('bergTourenHaptics', meta.themeEditorUnifiedSettings.haptics ? 'on' : 'off');
                        } catch (_) {}
                    }
                    if (typeof window.applyThemeEditorSettingsToDom === 'function') {
                        window.applyThemeEditorSettingsToDom();
                    }
                }

                if (meta.appBackground && typeof meta.appBackground === 'object') {
                    try {
                        await restoreBackupData(meta.appBackground);
                        if (typeof window.refreshAppBackgroundPicker === 'function') {
                            await window.refreshAppBackgroundPicker();
                        }
                    } catch (error) {
                        console.error('[Editor-Sicherung] Hintergrundbilder konnten nicht vollständig wiederhergestellt werden.', error);
                        if (typeof window.showToast === 'function') {
                            window.showToast('Hintergrundbilder der Editor-Presets konnten nicht vollständig wiederhergestellt werden.', {
                                type: 'error',
                                duration: 4500
                            });
                        }
                        throw error;
                    }
                }

                if (typeof appStorage?.flush === 'function') {
                    await appStorage.flush();
                }
                if (payload && payload.appState) {
                    window.setTimeout(() => window.location.reload(), 3200);
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
    window.getAppBackgroundSettings=getSettingsSnapshot;
    window.beginAppBackgroundEditorDraft=beginEditorDraft;
    window.persistAppBackgroundDraftAsset=persistDraftAsset;
    window.commitAppBackgroundEditorDraft=commitEditorDraft;
    window.discardAppBackgroundEditorDraft=discardEditorDraft;
    window.setAppBackgroundSettingsSnapshot=setSettingsSnapshot;
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
