/* Einheitlicher Editor für das Premium-Alpine-Design.
   Eine globale Akzentfarbe und wenige gemeinsame Designregler ersetzen
   die vier früheren, voneinander getrennten Theme-Profile. */
(function () {
    'use strict';

    const SETTINGS_KEY = 'themeEditorUnifiedSettings_v1';
    const LEGACY_KEY = 'themeEditorSettings_v1';
    const FONT_KEY = 'themeEditorFont_v1';
    const FONT_SIZE_KEY = 'themeEditorFontSize_v1';
    const HAPTIC_KEY = 'hapticFeedbackEnabled_v1';
    const LEGACY_HAPTIC_KEY = 'bergTourenHaptics';
    const THEME_KEYS = ['light', 'dark', 'green', 'summit'];
    const DIRECTIONS = ['180deg', '90deg', '135deg', '45deg', 'radial'];
    const FONTS = ['system', 'inter', 'roboto-condensed', 'nunito-sans', 'righteous', 'mono', 'cursive'];
    const DEFAULT_ACCENT = '#ad7d12';
    const DEFAULT_ACCENT_2 = '#000000';
    const DEFAULTS = {
        accent: DEFAULT_ACCENT,
        accent2: DEFAULT_ACCENT_2,
        radius: 14,
        fontFamily: 'system',
        fontSize: 100,
        haptics: true,
        gradientDirection: '180deg',
        transition: 55,
        glassOpacity: 68,
        density: 'standard'
    };

    const originalGetThemeEditorSettings =
        typeof window.getThemeEditorSettings === 'function'
            ? window.getThemeEditorSettings
            : null;
    const originalInitStorage =
        typeof window.initStorage === 'function'
            ? window.initStorage
            : null;
    const originalGetChartTheme =
        typeof window.getChartTheme === 'function'
            ? window.getChartTheme
            : null;
    const originalGetWrappedThemeColors =
        typeof window.getWrappedThemeColors === 'function'
            ? window.getWrappedThemeColors
            : null;
    let storageReady = false;
    let draft = null;
    let editorInitialized = false;
    let updateScheduled = false;

    function parseStoredValue(value) {
        if (typeof value !== 'string') return value;
        try {
            return JSON.parse(value);
        } catch (_) {
            return value;
        }
    }

    function readLocal(key) {
        try {
            const value = localStorage.getItem(key);
            return value == null ? null : parseStoredValue(value);
        } catch (_) {
            return null;
        }
    }

    function readAppStorage(key) {
        try {
            if (typeof appStorage !== 'undefined' && appStorage &&
                typeof appStorage.get === 'function') {
                return appStorage.get(key);
            }
        } catch (_) {}
        return null;
    }

    function readStored(key) {
        if (storageReady) {
            const stored = readAppStorage(key);
            if (stored !== undefined && stored !== null) return stored;
        }
        const local = readLocal(key);
        if (local !== undefined && local !== null) return local;
        return storageReady ? readAppStorage(key) : null;
    }

    function writeStored(key, value) {
        try {
            if (typeof appStorage !== 'undefined' && appStorage &&
                typeof appStorage.set === 'function') {
                appStorage.set(key, value);
            }
        } catch (error) {
            console.warn('[Editor] App-Einstellungen konnten nicht im App-Speicher gesichert werden:', error);
        }

        try {
            localStorage.setItem(
                key,
                typeof value === 'string' ? value : JSON.stringify(value)
            );
        } catch (_) {}
    }

    // Das Editor-Häkchen steuert die tatsächlich verwendeten Vibrationsimpulse.
    // Android-WebView benötigt dafür zusätzlich android.permission.VIBRATE.
    const originalHapticFeedback =
        typeof window.hapticFeedback === 'function'
            ? window.hapticFeedback
            : null;

    if (originalHapticFeedback && !originalHapticFeedback.__themeEditorPreference) {
        const preferenceAwareHapticFeedback = function (duration) {
            const settings = readStored(SETTINGS_KEY);
            if (settings && typeof settings === 'object' &&
                typeof settings.haptics === 'boolean') {
                if (!settings.haptics) return;
            } else {
                const stored = readStored(HAPTIC_KEY);
                if (typeof stored === 'boolean') {
                    if (!stored) return;
                } else if (readStored(LEGACY_HAPTIC_KEY) === 'off') {
                    return;
                }
            }
            return originalHapticFeedback.apply(this, arguments);
        };
        preferenceAwareHapticFeedback.__themeEditorPreference = true;
        window.hapticFeedback = preferenceAwareHapticFeedback;
    }

    function validHex(value) {
        return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
    }

    function readCurrentPaletteAccent() {
        try {
            const styles = getComputedStyle(document.body);
            for (const name of ['--theme-palette-accent', '--accent', '--accent-color']) {
                const value = styles.getPropertyValue(name).trim();
                if (validHex(value)) return value;
            }
        } catch (_) {}
        return DEFAULT_ACCENT;
    }

    function clamp(value, min, max, fallback) {
        const numeric = Number(value);
        return Number.isFinite(numeric)
            ? Math.min(max, Math.max(min, numeric))
            : fallback;
    }

    const FONT_ALIASES = { android: 'system', rounded: 'nunito-sans', serif: 'inter', slab: 'inter', fantasy: 'righteous' };
    function normalizeFontFamily(value) { return FONTS.includes(value) ? value : (FONT_ALIASES[value] || DEFAULTS.fontFamily); }
    function normalizeSettings(value) {
        const settings = value && typeof value === 'object' ? value : {};
        return {
            accent: validHex(settings.accent) ? settings.accent : DEFAULT_ACCENT,
            accent2: validHex(settings.accent2) ? settings.accent2 : DEFAULT_ACCENT_2,
            radius: clamp(settings.radius, 0, 28, DEFAULTS.radius),
            fontFamily: normalizeFontFamily(settings.fontFamily),
            fontSize: clamp(settings.fontSize, 80, 130, DEFAULTS.fontSize),
            haptics: settings.haptics !== false,
            gradientDirection: DIRECTIONS.includes(settings.gradientDirection)
                ? settings.gradientDirection
                : DEFAULTS.gradientDirection,
            transition: clamp(settings.transition, 10, 90, DEFAULTS.transition),
            glassOpacity: clamp(settings.glassOpacity, 35, 78, DEFAULTS.glassOpacity),
            density: ['compact','standard','comfortable'].includes(settings.density) ? settings.density : DEFAULTS.density
        };
    }

    function getLegacyProfile() {
        const stored = readStored(LEGACY_KEY);
        const activeKey = typeof window.themeEditorGetActiveTheme === 'function'
            ? window.themeEditorGetActiveTheme()
            : 'light';
        const profile = stored && typeof stored === 'object'
            ? (stored[activeKey] || stored.light || stored.dark || {})
            : {};
        return { stored, activeKey, profile };
    }

    function migrateLegacySettings() {
        // Die bestehende App nutzt das frühere „light“-Profil bereits als
        // gemeinsame Gold-/Dunkelbasis. Deshalb genau dieses aktive Profil
        // übernehmen und keine veralteten Farben aus anderen Profilen wählen.
        const legacy = getLegacyProfile();
        const profile = legacy.profile || {};
        const oldDefaultAccent = '#ad7d12';

        const migratedAccent = validHex(profile.accent) &&
            profile.accent.toLowerCase() !== oldDefaultAccent
                ? profile.accent
                : readCurrentPaletteAccent();

        const oldFont = readStored(FONT_KEY);
        const oldFontSize = readStored(FONT_SIZE_KEY);
        const oldHaptics = readStored(HAPTIC_KEY);
        const legacyHaptics = readStored(LEGACY_HAPTIC_KEY);
        const migratedHaptics = typeof oldHaptics === 'boolean'
            ? oldHaptics
            : legacyHaptics === 'off' ? false : DEFAULTS.haptics;

        return normalizeSettings({
            accent: migratedAccent,
            radius: profile.radius,
            fontFamily: normalizeFontFamily(oldFont),
            fontSize: oldFontSize,
            haptics: migratedHaptics,
            gradientDirection: profile.gradientDirection,
            transition: profile.transition
        });
    }
    function ensureDraft() {
        if (draft) return draft;

        const stored = readStored(SETTINGS_KEY);
        if (stored && typeof stored === 'object') {
            draft = normalizeSettings(stored);
            return draft;
        }

        draft = migrateLegacySettings();
        if (storageReady) persistSettings(draft);
        return draft;
    }

    function persistSettings(settings) {
        const normalized = normalizeSettings(settings);
        writeStored(SETTINGS_KEY, normalized);
        writeStored(FONT_KEY, normalized.fontFamily);
        writeStored(FONT_SIZE_KEY, String(normalized.fontSize));
        writeStored(HAPTIC_KEY, normalized.haptics);
        writeStored(LEGACY_HAPTIC_KEY, normalized.haptics ? 'on' : 'off');
        draft = normalized;
        try {
            window.__syncAndroidYearStatsWidget?.();
        } catch (_) {}
        return normalized;
    }

    function persistSingleSetting(field, value) {
        const saved = readStored(SETTINGS_KEY);
        const next = normalizeSettings(
            saved && typeof saved === 'object' ? saved : migrateLegacySettings()
        );
        next[field] = value;
        const normalized = normalizeSettings(next);
        writeStored(SETTINGS_KEY, normalized);
        if (draft) draft[field] = normalized[field];
    }

    function hexToRgb(hex) {
        const clean = String(hex || '').replace('#', '');
        if (!/^[0-9a-f]{6}$/i.test(clean)) return [173, 125, 18];
        return [
            parseInt(clean.slice(0, 2), 16),
            parseInt(clean.slice(2, 4), 16),
            parseInt(clean.slice(4, 6), 16)
        ];
    }

    function blendHex(hexA, hexB, amountB) {
        const a = hexToRgb(hexA);
        const b = hexToRgb(hexB);
        const ratio = Math.min(1, Math.max(0, Number(amountB) || 0));
        const mixed = a.map((v, i) => Math.round(v * (1 - ratio) + b[i] * ratio));
        return '#' + mixed.map(v => v.toString(16).padStart(2, '0')).join('');
    }

    function luminance(hex) {
        const channels = hexToRgb(hex).map(value => {
            const c = value / 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    function rgba(hex, alpha) {
        const parts = hexToRgb(hex);
        return 'rgba(' + parts[0] + ',' + parts[1] + ',' + parts[2] + ',' +
            Math.max(0, Math.min(1, alpha)).toFixed(2) + ')';
    }

    function setImportant(target, property, value) {
        if (target && target.style) target.style.setProperty(property, value, 'important');
    }

    const BIG_SURFACES = [
        '.box', '.dash-section', '.filter-simple-card', '.stats-analysis-section',
        '.stats-structure-section', '.chart-card', '.compare-box', '.compare-period-card',
        '.compare-list-card', '.tour-compare-pick-card', '.tour-compare-result',
        '.backup-status-panel', '.backup-info-card', '.backup-file-status', '.mob-sel-sheet',
        '#chart-view .stats-section-switch',
        '#backup-view .backup-card', '#backup-view .backup-view-inner',
        '#wrapped-view .bergwelt-side-nav', '#theme-view .theme-editor-card',
        '#theme-view .dashboard-editor-section'
    ];

    const SOFT_SURFACES = [
        '.stats-list li:not(.highlight-rank-gold):not(.highlight-rank-silver):not(.highlight-rank-bronze)',
        '.peak-tour-list li:not(.highlight-rank-gold):not(.highlight-rank-silver):not(.highlight-rank-bronze)',
        '.tour-search-result', '.chart-stat-tile:not(.active)',
        '.dash-stat-tile', '.dash-milestone-tile', '.dash-tour-list li',
        '.tour-profile-summary-card', '.development-metric-card', '.best-form-card',
        '.activity-summary-card', '.peak-summary-card',
        '.stats-structure-typical-card', '.stats-structure-type-card',
        '.stats-structure-burden-card', '.tour-history-summary > div',
        '.activity-detail-stat-grid > div', '.backup-status-item',
        '#theme-view .theme-editor-option', '#theme-view .theme-editor-panel'
    ];

    const RADIUS_SURFACES = [
        '.box', '.box-header', '.box-content', '.dash-section', '.filter-simple-card',
        '[class*="-card"]', ':not(.leaflet-container *):not(.leaflet-tile)[class*="-tile"]', '[class*="-panel"]',
        '[class*="-section"]', '[class*="-btn"]', '[class*="-button"]',
        '[class*="-nav"]', '[class*="-list"] > li',
        '.dash-stat-tile', '.chart-stat-tile', '.dash-milestone-tile', '.chart-card', '.chart-tab',
        '.stats-analysis-section', '.stats-structure-section', '.compare-box',
        '.compare-period-card', '.compare-list-card', '.tour-compare-pick-card',
        '.tour-compare-result', '.tour-profile-summary-card', '.development-metric-card',
        '.best-form-card', '.activity-summary-card', '.peak-summary-card',
        '.stats-structure-typical-card', '.stats-structure-type-card',
        '.stats-structure-burden-card', '.tour-history-summary > div',
        '.activity-detail-stat-grid > div', '.backup-status-panel', '.backup-info-card',
        '.backup-file-status', '#backup-view .backup-card', '#backup-view .backup-view-inner',
        '#chart-view .stats-year-filter-wrap', '#chart-view .stats-section-switch',
        '#chart-view .stats-section-switch .stats-section-btn',
        '#chart-view .stats-year-filter-wrap > select', '#tour-map',
        '#wrapped-view .bergwelt-side-nav', '#wrapped-view .bergwelt-tab',
        '#theme-view .theme-editor-card', '#theme-view .theme-editor-option',
        '#theme-view .theme-editor-panel', '#theme-view details > summary:not(.stats-analysis-title)',
        '.modal-card', '.modal-content', '.mob-sel-sheet', '.mob-sel-hdr', '.mob-sel-opt',
        '.top-main-nav', '.top-main-nav button', '.more-menu-item',
        '.accordion-header', '.tour-form input[type="text"]',
        '.tour-form input[type="number"]', '.tour-form input[type="search"]',
        '.tour-form input[type="color"]', '.tour-form input[type="date"]',
        '.tour-form input[type="time"]', '.tour-form input[type="email"]',
        '.tour-form input[type="tel"]', '.tour-form input[type="range"]',
        '.tour-form select', '.tour-form textarea',
        '#filter-view input[type="text"]', '#filter-view input[type="number"]',
        '#filter-view input[type="search"]', '#filter-view input[type="date"]',
        '#filter-view input[type="time"]', '#filter-view input[type="email"]',
        '#filter-view input[type="tel"]', '#filter-view select', '#filter-view textarea',
        '#pdf-export-card select', '#pdf-export-card .pdf-book-options > summary',
        'button', 'input[type="color"]', 'input[type="range"]', 'select', 'textarea'
    ];

    function gradientFor(direction, transition, accent, accent2, soft, alpha = 1) {
        // Ein Generator für deckende Aktionsverläufe und transparente Flächentönungen.
        const t = clamp(transition, 10, 90, 55);
        const accentColor = validHex(accent) ? accent : DEFAULT_ACCENT;
        const end = validHex(accent2) ? accent2 : DEFAULT_ACCENT_2;
        const start = soft ? blendHex(accentColor, end, 0.32) : accentColor;
        const opacity = clamp(alpha, 0, 1, 1);
        const cssColor = color => opacity >= 0.999 ? color : rgba(color, opacity);

        if (direction === 'radial') {
            return 'radial-gradient(circle at 28% 18%, ' + cssColor(start) + ' 0%, ' +
                cssColor(start) + ' ' + t + '%, ' + cssColor(end) + ' 100%)';
        }
        return 'linear-gradient(' + direction + ', ' + cssColor(start) + ' 0%, ' +
            cssColor(start) + ' ' + t + '%, ' + cssColor(end) + ' 100%)';
    }

    function buildSurfaceGradient(settings, soft) {
        // Der Akzentverlauf liegt transparent über einer dunklen Glasfläche.
        // So bleiben die realen Alpenbilder sichtbar, ohne die Lesbarkeit zu verlieren.
        const tint = gradientFor(
            settings.gradientDirection,
            settings.transition,
            settings.accent,
            settings.accent2,
            soft,
            soft ? 0.10 : 0.16
        );
        // Glas-Deckkraft separat steuerbar; der Farbverlauf erstreckt sich weiterhin über die volle Achse.
        const strength=clamp(settings.glassOpacity,35,78,68)/100;
        const surfaceTop=soft?'rgba(25,30,39,'+Math.max(.30,strength-.10).toFixed(2)+')':'rgba(25,30,39,'+strength.toFixed(2)+')';
        const surfaceBottom=soft?'rgba(13,21,31,'+Math.max(.22,strength-.20).toFixed(2)+')':'rgba(13,21,31,'+Math.max(.25,strength-.10).toFixed(2)+')';
        const material = 'linear-gradient(145deg, ' + surfaceTop + ' 0%, ' +
            surfaceBottom + ' 100%)';
        return tint + ', ' + material;
    }

    function buildUnifiedLiveCss() {
        const settings = ensureDraft();
        const viewScope = ':is(body.gold) :is(#dashboard-view, #app-view, #chart-view, #tour-view, #map-view, #filter-view, #backup-view, #theme-view, #achievements-view, #wrapped-view, #more-menu)';
        const bigGradient = buildSurfaceGradient(settings, false);
        const softGradient = buildSurfaceGradient(settings, true);
        const navGradient = buildSurfaceGradient(settings, false);
        const radius = settings.radius + 'px';
        const selectors = (items) => items.map(item =>
            item.startsWith('#') ? 'body.gold ' + item : viewScope + ' ' + item
        ).join(',\n');
        const globalSelectors = (items) => items.map(item =>
            'body.gold ' + item
        ).join(',\n');

        const GLOBAL_BIG_SURFACES = [
            '.modal-card:not(.highlight-modal-gold):not(.highlight-modal-silver):not(.highlight-modal-bronze)',
            '.mob-sel-sheet',
            '#more-menu'
        ];
        const GLOBAL_SOFT_SURFACES = [
            '.mob-sel-hdr',
            '.mob-sel-opt:not(.selected)'
        ];
        const GLOBAL_RADIUS_SURFACES = [
            '.modal-card', '.modal-content', '.mob-sel-sheet', '.mob-sel-hdr', '.mob-sel-opt',
            '#more-menu', '.more-menu-item', '.top-main-nav', '.top-main-nav button',
            '.accordion-header', '#tour-map',
            '.modal-card :is(button, input, select, textarea)',
            '.mob-sel-sheet :is(button, input, select, textarea)'
        ];

        let css = '';
        css += selectors(BIG_SURFACES) + ' { background: ' + bigGradient +
            ' !important; border-radius: ' + radius + ' !important; }\n';
        css += selectors(SOFT_SURFACES) + ' { background: ' + softGradient +
            ' !important; border-radius: ' + radius + ' !important; }\n';
        css += globalSelectors(GLOBAL_BIG_SURFACES) + ' { background: ' + bigGradient +
            ' !important; border-color: var(--theme-palette-border, rgba(225,232,242,.12)) !important; }\n';
        css += globalSelectors(GLOBAL_SOFT_SURFACES) + ' { background: ' + softGradient +
            ' !important; }\n';
        css += selectors(RADIUS_SURFACES) + ' { border-radius: ' + radius + ' !important; }\n';
        css += globalSelectors(GLOBAL_RADIUS_SURFACES) + ' { border-radius: ' + radius + ' !important; }\n';
        css += 'body.gold :is(#dashboard-view, #app-view, #chart-view, #map-view, #tour-view, #backup-view, #wrapped-view, #achievements-view, #theme-view, #filter-view) :is([class*="-card"], [class*="-tile"]:not(.leaflet-tile), [class*="-panel"], [class*="-section"], [class*="-btn"], [class*="-button"], [class*="-nav"], [class*="-list"] > li, button, input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]), select, textarea, details > summary:not(.stats-analysis-title)):not(.leaflet-container):not(.leaflet-container *) { border-radius: ' + radius + ' !important; }\n';
        css += 'body.gold .top-main-nav { background: ' + navGradient +
            ' !important; background-image: ' + navGradient +
            ' !important; border-color: color-mix(in srgb, ' + settings.accent +
            ' 26%, rgba(225,232,242,.10)) !important; border-radius: ' + radius + ' !important; }\n';
        css += 'body.gold .top-main-nav :is(button, a, .top-main-nav-item) { color: var(--theme-palette-text, #f3f7fb) !important; }\n';
        css += 'body.gold #theme-view .theme-editor-card, body.gold #theme-view .dashboard-editor-section { border-radius: ' + radius + ' !important; }\n';
        return css;
    }

    function applyPalette(settings) {
        const accent = settings.accent;
        const accent2 = settings.accent2;
        const soft = rgba(accent, 0.24);
        const border = 'color-mix(in srgb, ' + accent + ' 38%, rgba(225,232,242,.14))';
        // Gleicher Verlaufsgenerator wie auf allen anderen großen Flächen:
        // Richtung, zweite Akzentfarbe und Übergangspunkt greifen hier direkt.
        const accentGradient = gradientFor(settings.gradientDirection, settings.transition, accent, accent2, false);
        const contrastRatio = (a, b) => {
            const la = luminance(a);
            const lb = luminance(b);
            return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        };
        const darkText = '#171209';
        const lightText = '#f8fafc';
        const darkTextContrast = Math.min(contrastRatio(accent, darkText), contrastRatio(accent2, darkText));
        const lightTextContrast = Math.min(contrastRatio(accent, lightText), contrastRatio(accent2, lightText));
        const accentText = darkTextContrast >= lightTextContrast ? darkText : lightText;
        const root = document.documentElement;
        const body = document.body;

        setImportant(root, '--app-radius', settings.radius + 'px');
        setImportant(root, '--ui-card-radius', settings.radius + 'px');
        setImportant(root, '--ui-section-radius', settings.radius + 'px');
        setImportant(root, '--editor-radius', settings.radius + 'px');

        setImportant(body, '--theme-palette-accent', accent);
        setImportant(body, '--theme-palette-accent-soft', soft);
        setImportant(body, '--theme-palette-accent-gradient', accentGradient);
        setImportant(body, '--theme-palette-accent-text', accentText);
        setImportant(body, '--theme-palette-border', border);
        setImportant(body, '--theme-palette-control-border', border);
        setImportant(body, '--accent', accent);
        setImportant(body, '--accent-color', accent);
        setImportant(body, '--accent-soft', soft);
        setImportant(body, '--accordion-glow', soft);
        setImportant(body, '--accent-gradient', accentGradient);
        setImportant(body, '--accent-text-color', accentText);
        body.dataset.appDensity=settings.density||'standard';
        setImportant(root,'--app-density-scale',settings.density==='compact'?'0.90':settings.density==='comfortable'?'1.10':'1');

        // Beide Akzentfarben sind global einstellbar; Richtung und Übergangspunkt
        // steuern den Verlauf konsistent auf Flächen und Hauptnavigation.
        const style = document.getElementById('theme-editor-live-style') ||
            document.createElement('style');
        style.id = 'theme-editor-live-style';
        style.textContent = buildUnifiedLiveCss();
        if (!style.parentNode) document.head.appendChild(style);

        // Bestehende Farb-/Formelrenderer nutzen weiterhin diese Funktionen.
    }

    function applyUnifiedSettings(refreshVisuals) {
        const settings = ensureDraft();
        if (!document.body || !document.documentElement) return;
        applyPalette(settings);

        if (refreshVisuals && !updateScheduled) {
            updateScheduled = true;
            window.requestAnimationFrame(() => {
                updateScheduled = false;
                try {
                    if (typeof window.updateCharts === 'function') window.updateCharts();
                    if (typeof window.redrawAllCanvases === 'function') window.redrawAllCanvases();
                } catch (error) {
                    console.warn('[Editor] Diagramm-Aktualisierung übersprungen:', error);
                }
            });
        }
    }

    function getUnifiedLegacySettings() {
        let legacy = {};
        try {
            if (originalGetThemeEditorSettings) legacy = originalGetThemeEditorSettings() || {};
        } catch (_) {}

        const settings = ensureDraft();
        const accentDark = settings.accent2;
        const chartStart = blendHex(settings.accent, settings.accent2, 0.78);
        const chartMid = blendHex(settings.accent, settings.accent2, 0.38);
        const result = {};
        const textMain = '#f3f7fb';
        const textSoft = '#cbd5df';

        THEME_KEYS.forEach(key => {
            result[key] = {
                ...(legacy[key] || {}),
                topColor: '#191e27',
                bottomColor: '#0d151f',
                transition: settings.transition,
                intensity: 88,
                textMain,
                textSoft,
                accent: settings.accent,
                accent2: accentDark,
                borderOpacity: 34,
                gradientDirection: settings.gradientDirection,
                midEnabled: false,
                midColor: accentDark,
                shadowIntensity: 50,
                bgBrightness: 50,
                appBrightness: 50,
                radius: settings.radius,
                blurIntensity: 10,
                navTopColor: settings.accent,
                navBottomColor: accentDark,
                chartColorStart: chartStart,
                chartColorMid: chartMid,
                chartColorEnd: settings.accent2
            };
        });

        return result;
    }

    function fillForm() {
        const settings = ensureDraft();
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = String(value);
        };
        setValue('te-unified-accent', settings.accent);
        setValue('te-unified-accent2', settings.accent2);
        setValue('te-unified-radius', settings.radius);
        setValue('te-font-family', settings.fontFamily);
        setValue('te-font-size', settings.fontSize);
        setValue('te-unified-direction', settings.gradientDirection);
        setValue('te-unified-transition', settings.transition);
        setValue('te-unified-glass-opacity', settings.glassOpacity);
        setValue('te-unified-density', settings.density);

        const radiusValue = document.getElementById('te-unified-radius-value');
        const transitionValue = document.getElementById('te-unified-transition-value');
        const fontSizeValue = document.getElementById('te-font-size-value');
        if (radiusValue) radiusValue.textContent = settings.radius + ' px';
        if (transitionValue) transitionValue.textContent = settings.transition + ' %';
        const glassValue=document.getElementById('te-unified-glass-opacity-value');if(glassValue)glassValue.textContent=settings.glassOpacity+' %';
        if (fontSizeValue) fontSizeValue.textContent = settings.fontSize + ' %';

        const haptics = document.getElementById('haptic-feedback-toggle');
        if (haptics) haptics.checked = settings.haptics;

        const hint = document.getElementById('theme-editor-hint');
        if (hint) hint.textContent = 'Änderungen werden sofort angezeigt. Mit „Speichern“ übernimmst du sie dauerhaft.';
    }

    function readForm() {
        const settings = { ...ensureDraft() };
        const value = id => document.getElementById(id);
        if (value('te-unified-accent')) settings.accent = value('te-unified-accent').value;
        if (value('te-unified-accent2')) settings.accent2 = value('te-unified-accent2').value;
        if (value('te-unified-radius')) settings.radius = Number(value('te-unified-radius').value);
        if (value('te-font-family')) settings.fontFamily = value('te-font-family').value;
        if (value('te-font-size')) settings.fontSize = Number(value('te-font-size').value);
        if (value('haptic-feedback-toggle')) settings.haptics = value('haptic-feedback-toggle').checked;
        if (value('te-unified-direction')) settings.gradientDirection = value('te-unified-direction').value;
        if (value('te-unified-transition')) settings.transition = Number(value('te-unified-transition').value);
        if(value('te-unified-glass-opacity'))settings.glassOpacity=Number(value('te-unified-glass-opacity').value);
        if(value('te-unified-density'))settings.density=value('te-unified-density').value;
        return normalizeSettings(settings);
    }

    function showToastSafe(message, type) {
        try {
            if (typeof window.showToast === 'function') {
                window.showToast(message, { type: type || 'success', duration: 2200 });
            }
        } catch (_) {}
    }

    function initUnifiedEditor() {
        const view = document.getElementById('theme-view');
        if (!view) return;
        if (editorInitialized) {
            fillForm();
            applyUnifiedSettings(false);
            return;
        }

        const controls = [
            'te-unified-accent', 'te-unified-accent2', 'te-unified-radius',
            'te-unified-direction', 'te-unified-transition', 'te-unified-glass-opacity', 'te-unified-density'
        ];

        controls.forEach(id => {
            const element = document.getElementById(id);
            if (!element || element.dataset.unifiedEditorBound === 'true') return;
            element.dataset.unifiedEditorBound = 'true';

            const update = () => {
                draft = readForm();
                const radiusValue = document.getElementById('te-unified-radius-value');
                const transitionValue=document.getElementById('te-unified-transition-value'),glassValue=document.getElementById('te-unified-glass-opacity-value');
                if(radiusValue)radiusValue.textContent=draft.radius+' px';if(transitionValue)transitionValue.textContent=draft.transition+' %';if(glassValue)glassValue.textContent=draft.glassOpacity+' %';
                if(id==='te-unified-density')document.body.dataset.appDensity=draft.density;
                applyUnifiedSettings(id==='te-unified-accent'||id==='te-unified-accent2');
            };
            element.addEventListener('input', update);
            element.addEventListener('change', update);
        });

        // Schriftart und -größe bleiben Entwürfe bis zum zentralen Speichern.
        const fontSelect=document.getElementById('te-font-family');
        if(fontSelect){window.applyThemeEditorFont?.(fontSelect.value||ensureDraft().fontFamily,false);if(fontSelect.dataset.unifiedEditorSync!=='true'){fontSelect.dataset.unifiedEditorSync='true';fontSelect.addEventListener('change',()=>{draft=readForm();window.applyThemeEditorFont?.(draft.fontFamily,false);applyUnifiedSettings(false);});}}
        const fontSize=document.getElementById('te-font-size');
        if(fontSize){window.applyThemeEditorFontSize?.(Number(fontSize.value||ensureDraft().fontSize),false);if(fontSize.dataset.unifiedEditorSync!=='true'){fontSize.dataset.unifiedEditorSync='true';fontSize.addEventListener('input',()=>{draft=readForm();window.applyThemeEditorFontSize?.(draft.fontSize,false);const o=document.getElementById('te-font-size-value');if(o)o.textContent=draft.fontSize+' %';});}}

        const haptics = document.getElementById('haptic-feedback-toggle');
        if (haptics && haptics.dataset.unifiedEditorBound !== 'true') {
            haptics.dataset.unifiedEditorBound = 'true';
            haptics.addEventListener('change', () => {
                draft = readForm();
                // Haptik wird gemeinsam mit den übrigen Einstellungen gespeichert.
                applyUnifiedSettings(false);
            });
        }

        document.getElementById('theme-editor-save')?.addEventListener('click', async () => {
            draft=readForm();try{const result=typeof window.__commitPremiumEditorSettings==='function'?await window.__commitPremiumEditorSettings():(draft=persistSettings(draft),null);applyUnifiedSettings(true);if(result?.widgetSync?.status==='failed')showToastSafe('Editor-Einstellungen gespeichert. Widget nicht aktualisiert: '+result.widgetSync.message,'warning');else showToastSafe('Alle Editor-Einstellungen gespeichert ✓','success');}
            catch(error){console.error('[Editor] Speichern fehlgeschlagen:',error);showToastSafe('Speichern fehlgeschlagen. Bitte erneut versuchen.','error');}
        });

        // Grundeinstellungen werden über ein Preset verwaltet.

        fillForm();
        applyUnifiedSettings(false);
        editorInitialized = true;
    }

    // Die bisherige API bleibt erreichbar, liefert aber für alle alten Theme-Keys
    // identische Werte. Damit bleiben Diagramme und PDF-Export kompatibel.
    window.getThemeEditorSettings=getUnifiedLegacySettings;
    window.getThemeEditorUnifiedSettings=()=>normalizeSettings(readForm());
    window.setThemeEditorUnifiedSettings=v=>{draft=normalizeSettings(v);fillForm();window.applyThemeEditorFont?.(draft.fontFamily,false);window.applyThemeEditorFontSize?.(draft.fontSize,false);document.body.dataset.appDensity=draft.density;applyUnifiedSettings(true);return{...draft};};
    window.persistThemeEditorUnifiedSettings=()=>{draft=persistSettings(readForm());document.body.dataset.appDensity=draft.density;applyUnifiedSettings(true);return{...draft};};
    window.buildThemeEditorLiveCss = buildUnifiedLiveCss;
    window.applyThemeEditorSettingsToDom = function () {
        applyUnifiedSettings(false);
        try {
            window.__syncAndroidYearStatsWidget?.();
        } catch (_) {}
    };
    window.invalidateThemeEditorDraft = function () {
        draft = null;
    };
    window.initThemeEditor = initUnifiedEditor;

    if (originalGetChartTheme) {
        window.getChartTheme = function () {
            const previous = originalGetChartTheme.apply(this, arguments) || {};
            const settings = ensureDraft();
            return {
                ...previous,
                textColor: '#f3f7fb',
                isDark: true,
                dotFill: '#121b26',
                gradientStops: [
                    [0, settings.accent],
                    [clamp(settings.transition, 10, 90, 55) / 100, settings.accent],
                    [1, settings.accent2]
                ]
            };
        };
    }

    if (originalGetWrappedThemeColors) {
        window.getWrappedThemeColors = function () {
            const settings = ensureDraft();
            return {
                bg1: '#191e27',
                bg2: '#0d151f',
                text: '#f3f7fb',
                accent: settings.accent,
                accent2: settings.accent2
            };
        };
    }

    window.hapticFeedback = function (duration) {
        const settings = ensureDraft();
        if (!settings.haptics || !('vibrate' in navigator)) return;
        try {
            navigator.vibrate(Number(duration) || 12);
        } catch (_) {}
    };

    // Beim ersten Start einheitliche Werte migrieren, sobald IndexedDB geladen ist.
    if (originalInitStorage) {
        window.initStorage = async function () {
            const result = await originalInitStorage.apply(this, arguments);
            storageReady = true;
            const saved = readStored(SETTINGS_KEY);
            draft = saved && typeof saved === 'object'
                ? normalizeSettings(saved)
                : migrateLegacySettings();
            if (!(saved && typeof saved === 'object')) persistSettings(draft);
            applyUnifiedSettings(false);
            return result;
        };
    }

    // Farben und Oberflächen sofort vereinheitlichen. Schriftart/-größe werden
    // nach dem vorhandenen Storage-Init und der Font-Observer-Initialisierung angewendet.
    applyUnifiedSettings(false);
})();