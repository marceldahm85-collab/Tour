/* Native Android start overlay: signal readiness after IndexedDB initialization. */
(() => {
    'use strict';

    const originalInitStorage = window.initStorage;
    if (typeof originalInitStorage !== 'function' || originalInitStorage.__nativeReadyWrapped) {
        return;
    }

    const wrappedInitStorage = async function (...args) {
        const result = await originalInitStorage.apply(this, args);

        // The native splash overlay uses this one-way signal to apply the
        // Editor's minimum display duration. Browser/PWA mode stays unchanged.
        try {
            const bridge = window.TourNative;
            if (bridge && typeof bridge.postMessage === 'function' &&
                !window.__nativeAppReadySent) {
                bridge.postMessage(JSON.stringify({ type: 'app.ready' }));
                window.__nativeAppReadySent = true;
            }
        } catch (error) {
            console.warn('[Android] App-Bereitschaft konnte nicht gemeldet werden.', error);
        }

        return result;
    };

    wrappedInitStorage.__nativeReadyWrapped = true;
    window.initStorage = wrappedInitStorage;
})();
