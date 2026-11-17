/* Synchronisiert die Android-Systemleisten mit der ersten Akzentfarbe des Editors. */
(() => {
    'use strict';
    const DEFAULT_ACCENT = '#ad7d12';
    let lastColor = '';
    let pendingColor = '';
    let retryCount = 0;
    let retryScheduled = false;

    function normalizeColor(value) {
        return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
            ? value.trim().toLowerCase()
            : null;
    }
    function readActiveAccent() {
        try {
            const body = document.body;
            if (body) {
                const cssAccent = normalizeColor(getComputedStyle(body).getPropertyValue('--theme-palette-accent').trim());
                if (cssAccent) return cssAccent;
            }
        } catch (_) {}
        try {
            const saved = JSON.parse(localStorage.getItem('themeEditorUnifiedSettings_v1') || 'null');
            const savedAccent = normalizeColor(saved && saved.accent);
            if (savedAccent) return savedAccent;
        } catch (_) {}
        return DEFAULT_ACCENT;
    }
    function updateBrowserThemeColor(color) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta && meta.getAttribute('content') !== color) meta.setAttribute('content', color);
    }
    function scheduleBridgeRetry() {
        if (retryScheduled || retryCount >= 40) return;
        retryScheduled = true;
        retryCount += 1;
        window.setTimeout(() => {
            retryScheduled = false;
            sendColor(pendingColor || readActiveAccent());
        }, 250);
    }
    function sendColor(value) {
        const color = normalizeColor(value) || DEFAULT_ACCENT;
        pendingColor = color;
        updateBrowserThemeColor(color);
        const bridge = window.TourNative;
        if (!bridge || typeof bridge.postMessage !== 'function') {
            scheduleBridgeRetry();
            return false;
        }
        if (color === lastColor) {
            pendingColor = '';
            return true;
        }
        try {
            bridge.postMessage(JSON.stringify({ type: 'systemBars.update', color }));
            lastColor = color;
            pendingColor = '';
            retryCount = 0;
            return true;
        } catch (error) {
            lastColor = '';
            console.warn('[Android] Akzentfarbe der Systemleisten konnte nicht übertragen werden.', error);
            scheduleBridgeRetry();
            return false;
        }
    }
    window.syncNativeSystemBarsColor = sendColor;
    function syncSystemBars() { sendColor(readActiveAccent()); }
    function observeAccent() {
        if (!document.body) return;
        if (document.body.dataset.nativeSystemBarsAccentObserved !== 'true') {
            document.body.dataset.nativeSystemBarsAccentObserved = 'true';
            const observer = new MutationObserver(syncSystemBars);
            observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
        }
        syncSystemBars();
        window.addEventListener('load', syncSystemBars);
        window.addEventListener('pageshow', syncSystemBars);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSystemBars(); });
    }
    if (document.body) observeAccent();
    else document.addEventListener('DOMContentLoaded', observeAccent, { once: true });
})();