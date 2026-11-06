/* Alpine Premium Experience — native-aware interactions and startup handoff.
   Works with the single unified Editor configuration; legacy theme keys are not profiles. */
(function () {
    'use strict';

    const SETTINGS_KEY = 'themeEditorUnifiedSettings_v1';
    const HAPTIC_KEY = 'hapticFeedbackEnabled_v1';
    const LEGACY_HAPTIC_KEY = 'bergTourenHaptics';

    const MOTION_PROFILE = Object.freeze({
        control: 150,
        view: 360,
        secondary: 280,
        modalOpen: 320,
        modalClose: 480,
        achievement: 580,
        splashExit: 260
    });

    const PATTERNS = Object.freeze({
        selection: { native: 'selection', browser: 7 },
        navigation: { native: 'navigation', browser: 10 },
        tile: { native: 'tile', browser: 14 },
        milestone: { native: 'milestone', browser: [0, 18, 32, 22] },
        achievement: { native: 'achievement', browser: [0, 22, 38, 30, 48, 34] }
    });

    let lastSelectionAt = 0;
    let appReadySent = false;

    function readHapticsPreference() {
        try {
            const current = window.getThemeEditorUnifiedSettings?.();
            if (current && typeof current.haptics === 'boolean') {
                return current.haptics;
            }
        } catch (_) {}

        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const stored = JSON.parse(raw);
                if (stored && typeof stored.haptics === 'boolean') return stored.haptics;
            }
        } catch (_) {}

        try {
            const legacy = localStorage.getItem(HAPTIC_KEY);
            if (legacy === 'true' || legacy === 'false') return legacy === 'true';
            if (localStorage.getItem(LEGACY_HAPTIC_KEY) === 'off') return false;
        } catch (_) {}

        return true;
    }

    function resolvePattern(value) {
        if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(PATTERNS, value)) {
            return value;
        }
        if (Array.isArray(value)) {
            return Number(value[0]) >= 22 ? 'achievement' : 'milestone';
        }
        const duration = Number(value);
        if (!Number.isFinite(duration) || duration <= 8) return 'selection';
        if (duration <= 12) return 'navigation';
        if (duration <= 17) return 'tile';
        if (duration >= 22) return 'milestone';
        return 'navigation';
    }

    function sendNative(message) {
        try {
            const bridge = window.TourNative;
            if (!bridge || typeof bridge.postMessage !== 'function') return false;
            bridge.postMessage(JSON.stringify(message));
            return true;
        } catch (error) {
            console.debug('[Premium Experience] Native Bridge derzeit nicht verfügbar.', error);
            return false;
        }
    }

    function hapticFeedback(value = 12) {
        if (!readHapticsPreference()) return;

        const name = resolvePattern(value);
        const pattern = PATTERNS[name];
        const now = Date.now();

        // Doppelte, unmittelbar aufeinanderfolgende Auswahlimpulse vermeiden.
        if (name === 'selection' && now - lastSelectionAt < 55) return;
        if (name === 'selection') lastSelectionAt = now;

        if (sendNative({ type: 'haptics.trigger', pattern: pattern.native })) return;

        // Browser/PWA-Fallback: gleiche Abstufung über die Vibrations-API.
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate(pattern.browser);
            }
        } catch (_) {
            // Fehlende Hardware oder Browser-Unterstützung darf Aktionen nicht blockieren.
        }
    }

    function announceAppReady() {
        if (appReadySent) return;
        appReadySent = true;

        // Erst nach der Storage-Initialisierung und den synchronen Folgearbeiten
        // des App-Initializers freigeben, damit nicht ein leerer View aufblitzt.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('premium-app-ready'));
            sendNative({ type: 'app.ready' });
        }));
    }

    // Die bereits vorhandene initStorage-Pipeline bleibt vollständig erhalten.
    // Wir hängen nur einen Bereitschafts-Hinweis an ihr erfolgreiches Ende.
    if (typeof window.initStorage === 'function' &&
        !window.initStorage.__premiumExperienceWrapped) {
        const originalInitStorage = window.initStorage;
        const wrappedInitStorage = async function () {
            const result = await originalInitStorage.apply(this, arguments);
            announceAppReady();
            return result;
        };
        wrappedInitStorage.__premiumExperienceWrapped = true;
        window.initStorage = wrappedInitStorage;
    }

    // Einheitlicher globaler Einstieg: vorhandene Klick-/Achievement-Handler
    // behalten ihre bisherigen Zahlen bzw. Muster und erhalten nun native Stufen.
    window.hapticFeedback = hapticFeedback;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    function applyMotionProfile() {
        const root = document.documentElement;
        root.style.setProperty('--premium-motion-control-duration', MOTION_PROFILE.control + 'ms');
        root.style.setProperty('--premium-motion-view-duration', MOTION_PROFILE.view + 'ms');
        root.style.setProperty('--premium-motion-secondary-duration', MOTION_PROFILE.secondary + 'ms');
        root.style.setProperty('--premium-motion-modal-duration', MOTION_PROFILE.modalOpen + 'ms');
        root.style.setProperty('--premium-motion-achievement-duration', MOTION_PROFILE.achievement + 'ms');
        root.style.setProperty('--premium-motion-splash-exit-duration', MOTION_PROFILE.splashExit + 'ms');
    }
    function updateMotionPreference() {
        document.documentElement.classList.toggle(
            'premium-reduced-motion',
            Boolean(motionQuery?.matches)
        );
        applyMotionProfile();
    }
    updateMotionPreference();
    motionQuery?.addEventListener?.('change', updateMotionPreference);

    window.PremiumMotionController = Object.freeze({
        profile: MOTION_PROFILE,
        refresh: updateMotionPreference,
        get reducedMotion() { return Boolean(motionQuery?.matches); }
    });

    window.PremiumExperience = Object.freeze({
        haptic: hapticFeedback,
        announceReady: announceAppReady,
        motion: MOTION_PROFILE,
        get reducedMotion() { return Boolean(motionQuery?.matches); },
        patterns: Object.keys(PATTERNS)
    });
})();
