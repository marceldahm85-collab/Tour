/* Robuste Synchronisierung des App-Themes mit den nativen Android-Systemleisten. */
(() => {
    'use strict';

    let lastTheme = '';
    let bridgeRetryCount = 0;
    let retryScheduled = false;

    function getActiveTheme() {
        const body = document.body;
        const root = document.documentElement;
        const has = name => !!(
            (body && body.classList.contains(name)) ||
            (root && root.classList.contains(name))
        );

        if (has('dark')) return 'dark';
        if (has('green')) return 'green';
        if (has('summit')) return 'summit';
        // Die aktuelle einheitliche Oberfläche verwendet Gold als Basis.
        return 'light';
    }

    function scheduleBridgeRetry() {
        if (retryScheduled || bridgeRetryCount >= 20) return;
        retryScheduled = true;
        bridgeRetryCount += 1;
        window.setTimeout(() => {
            retryScheduled = false;
            syncSystemBars();
        }, 250);
    }

    function syncSystemBars() {
        // Die Bridge bewusst bei jedem Aufruf neu lesen. So führt ein später
        // verfügbarer WebMessageListener nicht zu einem dauerhaft toten Sync.
        const bridge = window.TourNative;
        if (!bridge || typeof bridge.postMessage !== 'function') {
            scheduleBridgeRetry();
            return;
        }

        const theme = getActiveTheme();
        if (theme === lastTheme) return;

        try {
            bridge.postMessage(JSON.stringify({
                type: 'systemBars.update',
                theme
            }));
            lastTheme = theme;
            bridgeRetryCount = 0;
        } catch (error) {
            lastTheme = '';
            console.warn('[Android] Theme der Systemleisten konnte nicht übertragen werden.', error);
            scheduleBridgeRetry();
        }
    }

    function observeTheme() {
        if (!document.body) {
            scheduleBridgeRetry();
            return;
        }

        if (document.body.dataset.nativeSystemBarsObserved !== 'true') {
            document.body.dataset.nativeSystemBarsObserved = 'true';
            const observer = new MutationObserver(syncSystemBars);
            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['class']
            });

            if (document.documentElement) {
                observer.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class']
                });
            }
        }

        syncSystemBars();
        window.addEventListener('load', syncSystemBars);
        window.addEventListener('pageshow', syncSystemBars);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) syncSystemBars();
        });
    }

    if (document.body) {
        observeTheme();
    } else {
        document.addEventListener('DOMContentLoaded', observeTheme, { once: true });
    }
})();