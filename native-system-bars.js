/* Native Android-Systemleisten mit dem tatsächlich aktiven App-Theme synchronisieren. */
(() => {
    'use strict';
    let lastTheme = '';
    let pendingTheme = null;
    let retries = 0;
    let retryScheduled = false;

    function normalizeTheme(theme) {
        return ['dark', 'green', 'summit'].includes(theme) ? theme : 'light';
    }
    function getActiveTheme() {
        const body = document.body;
        const root = document.documentElement;
        const has = name => !!((body && body.classList.contains(name)) || (root && root.classList.contains(name)));
        if (has('dark')) return 'dark';
        if (has('green')) return 'green';
        if (has('summit')) return 'summit';
        return 'light';
    }
    function scheduleRetry() {
        if (retryScheduled || retries >= 40) return;
        retryScheduled = true;
        retries += 1;
        window.setTimeout(() => {
            retryScheduled = false;
            sendTheme(pendingTheme || getActiveTheme());
        }, 250);
    }
    function sendTheme(theme) {
        const normalized = normalizeTheme(theme);
        pendingTheme = normalized;
        const bridge = window.TourNative;
        if (!bridge || typeof bridge.postMessage !== 'function') {
            scheduleRetry();
            return false;
        }
        if (normalized === lastTheme) {
            pendingTheme = null;
            return true;
        }
        try {
            bridge.postMessage(JSON.stringify({ type: 'systemBars.update', theme: normalized }));
            lastTheme = normalized;
            pendingTheme = null;
            retries = 0;
            return true;
        } catch (error) {
            lastTheme = '';
            console.warn('[Android] Theme der Systemleisten konnte nicht übertragen werden.', error);
            scheduleRetry();
            return false;
        }
    }

    // Direkter Aufruf aus der zentralen Theme-Funktion; Observer bleibt Fallback.
    window.syncNativeSystemBarsTheme = sendTheme;

    function syncSystemBars() { sendTheme(getActiveTheme()); }
    function observeTheme() {
        if (!document.body) return;
        if (document.body.dataset.nativeSystemBarsObserved !== 'true') {
            document.body.dataset.nativeSystemBarsObserved = 'true';
            const observer = new MutationObserver(syncSystemBars);
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            if (document.documentElement) {
                observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            }
        }
        syncSystemBars();
        window.addEventListener('load', syncSystemBars);
        window.addEventListener('pageshow', syncSystemBars);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSystemBars(); });
    }
    if (document.body) observeTheme();
    else document.addEventListener('DOMContentLoaded', observeTheme, { once: true });
})();