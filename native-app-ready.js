/* Coordinated native Android start: wait for the complete WebView startup and the splash intro. */
(() => {
    'use strict';

    const BOOT_STARTED_AT = performance.now();
    const INTRO_MINIMUM_MS = Object.freeze({
        off: 0,
        subtle: 550,
        premium: 1900
    });

    let readyScheduled = false;

    const delay = milliseconds => new Promise(resolve => {
        window.setTimeout(resolve, Math.max(0, milliseconds));
    });

    function getStoredAnimation() {
        try {
            const stored = typeof appStorage !== 'undefined' && appStorage
                ? appStorage.get('premiumAppStartSettings_v1')
                : null;
            const animation = stored && typeof stored.animation === 'string'
                ? stored.animation
                : 'premium';
            return Object.prototype.hasOwnProperty.call(INTRO_MINIMUM_MS, animation)
                ? animation
                : 'premium';
        } catch (_) {
            return 'premium';
        }
    }

    async function finishNativeStartup() {
        // initStorage is awaited by the main DOMContentLoaded handler. The timer
        // lets that handler continue through its synchronous UI/data setup first.
        await delay(0);

        try {
            if (typeof window.syncAppStartNativeSettings === 'function') {
                const result = await window.syncAppStartNativeSettings();
                if (result?.status === 'failed') {
                    console.warn(
                        '[Android] Gespeicherte App-Start-Einstellungen konnten nicht abgeglichen werden:',
                        result.error
                    );
                }
            }
        } catch (error) {
            console.warn('[Android] Native App-Start-Synchronisierung fehlgeschlagen.', error);
        }

        // The premium emblem and light sweep take about 1.75 seconds. Readiness
        // must not fade the overlay out before this entrance has completed.
        const introMinimum = INTRO_MINIMUM_MS[getStoredAnimation()];
        const elapsed = performance.now() - BOOT_STARTED_AT;
        await delay(Math.max(0, introMinimum - elapsed));

        // Die Bridge kann bei einzelnen WebView-Versionen etwas später
        // verfügbar sein. Mehrfach versuchen statt den Splash dauerhaft stehen
        // zu lassen; zusätzlich existiert ein nativer 15-Sekunden-Fallback.
        for (let attempt = 0; attempt < 20 && !window.__nativeAppReadySent; attempt += 1) {
            try {
                const bridge = window.TourNative;
                if (bridge && typeof bridge.postMessage === 'function') {
                    bridge.postMessage(JSON.stringify({ type: 'app.ready' }));
                    window.__nativeAppReadySent = true;
                    break;
                }
            } catch (error) {
                console.warn('[Android] App-Bereitschaft konnte noch nicht gemeldet werden.', error);
            }
            await delay(250);
        }

        if (!window.__nativeAppReadySent) {
            console.warn('[Android] Native Bridge blieb beim Start nicht erreichbar; der native Sicherheitsfallback übernimmt.');
        }
    }

    const originalInitStorage = window.initStorage;
    if (typeof originalInitStorage !== 'function' || originalInitStorage.__nativeReadyWrapped) {
        return;
    }

    const wrappedInitStorage = function (...args) {
        const initialization = originalInitStorage.apply(this, args);

        return Promise.resolve(initialization).then(result => {
            if (!readyScheduled) {
                readyScheduled = true;
                // Do not await this task here: the main app's own
                // "await initStorage()" continuation must finish first.
                // finishNativeStartup retries the bridge if necessary.
                window.setTimeout(() => {
                    finishNativeStartup().catch(error => {
                        console.warn('[Android] Startsequenz konnte nicht abgeschlossen werden.', error);
                    });
                }, 0);
            }
            return result;
        });
    };

    wrappedInitStorage.__nativeReadyWrapped = true;
    window.initStorage = wrappedInitStorage;
})();
