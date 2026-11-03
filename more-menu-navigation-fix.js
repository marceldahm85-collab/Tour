// Hauptnavigation: Mehr-Menü bei Interaktionen außerhalb zuverlässig schließen.
(() => {
    'use strict';

    if (window.__moreMenuOutsideDismissInitialized) return;

    const wrapper = document.querySelector('.top-nav-more-wrap');
    const menu = document.getElementById('more-menu');
    const toggle = document.getElementById('more-toggle');
    if (!wrapper || !menu || !toggle) return;

    window.__moreMenuOutsideDismissInitialized = true;

    const isInsideMenuArea = event => {
        if (typeof event.composedPath === 'function' && event.composedPath().includes(wrapper)) {
            return true;
        }
        const target = event.target;
        return target instanceof Element && wrapper.contains(target);
    };

    const closeMenu = () => {
        if (menu.classList.contains('hidden')) return;
        menu.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
    };

    // Capture-Phase: funktioniert auch dann, wenn andere App-Handler
    // das spätere Click-Bubbling unterbrechen.
    document.addEventListener('pointerdown', event => {
        if (!isInsideMenuArea(event)) closeMenu();
    }, true);

    // Fallback für programmatische/keyboard-ausgelöste Klicks ohne Pointerdown.
    document.addEventListener('click', event => {
        if (!isInsideMenuArea(event)) closeMenu();
    }, true);

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeMenu();
    });
})();
