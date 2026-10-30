/* Hintergrundbild-Verwaltung für Premium Alpine.
   Schritt 1: Bestehendes Motiv als Preset registrieren und stabile Speicher-APIs
   für spätere Galerie- und Preset-Auswahl bereitstellen. */
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
            fit: 'cover'
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
        fit: 'cover'
    });

    let currentSettings = null;
    let customImageObjectUrl = '';
    let initializationPromise = null;

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

        return true;
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
            landscapePositionX: preset.landscapePositionX
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
            landscapePositionX: input.landscapePositionX ?? currentSettings?.landscapePositionX
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

        const settings = currentSettings || DEFAULT_SETTINGS;
        const fileName = typeof options?.fileName === 'string'
            ? options.fileName.slice(0, 180)
            : '';

        await _idbSet(CUSTOM_IMAGE_STORAGE_KEY, blob);

        revokeCustomObjectUrl();
        customImageObjectUrl = URL.createObjectURL(blob);
        currentSettings = normalizeSettings({
            ...settings,
            mode: 'custom',
            customImageName: fileName
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
        const preset = findPreset(CURRENT_PRESET_ID);
        currentSettings = normalizeSettings({
            ...(currentSettings || DEFAULT_SETTINGS),
            mode: 'preset',
            presetId: CURRENT_PRESET_ID,
            customImageName: '',
            positionX: preset.positionX,
            positionY: preset.positionY,
            mobilePositionX: preset.mobilePositionX,
            landscapePositionX: preset.landscapePositionX
        });
        persistSettings();
        applySettingsToDom();
        return getSettingsSnapshot();
    }

    window.getAppBackgroundPresetCatalog = function () {
        return PRESETS.map(preset => ({
            id: preset.id,
            name: preset.name,
            description: preset.description,
            preview: preset.preview
        }));
    };
    window.getAppBackgroundSettings = getSettingsSnapshot;
    window.applyAppBackgroundSettingsToDom = applySettingsToDom;
    window.setAppBackgroundPreset = setPreset;
    window.setAppBackgroundImagePosition = setImagePosition;
    window.setAppBackgroundCustomImage = setCustomImage;
    window.getAppBackgroundCustomImageBlob = getCustomImageBlob;
    window.clearAppBackgroundCustomImage = clearCustomImage;
    window.refreshAppBackgroundFromStorage = initialize;

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
