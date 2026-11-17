/* Synchronisiert das aktive Oberflächen-Theme mit den nativen Android-Systemleisten. */
(() => {
    'use strict';

    const bridge = window.TourNative;
    if (!bridge || typeof bridge.postMessage !== 'function') return;

    let lastTheme = '';

    function getActiveTheme() {
        const body = document.body;
        if (!body) return 'light';
        if (body.classList.contains('dark')) return 'dark';
        if (body.classList.contains('green')) return 'green';
        if (body.classList.contains('summit')) return 'summit';
        return 'light';
    }

    function syncSystemBars() {
        const theme = getActiveTheme();
        if (theme === lastTheme) return;
        lastTheme = theme;

        try {
            bridge.postMessage(JSON.stringify({
                type: 'systemBars.update',
                theme
            }));
        } catch (error) {
            lastTheme = '';
            console.warn('[Android] Theme der Systemleisten konnte nicht übertragen werden.', error);
        }
    }

    function observeTheme() {
        if (!document.body || document.body.dataset.nativeSystemBarsObserved === 'true') return;
        document.body.dataset.nativeSystemBarsObserved = 'true';

        const observer = new MutationObserver(syncSystemBars);
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        syncSystemBars();
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
