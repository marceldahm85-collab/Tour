/* Exklusives Aufklappen und Scroll-Ausrichtung für den Editor. */
(() => {
    'use strict';

    const MOBILE_SCROLL_QUERY = '(max-width: 1024px) and (pointer: coarse)';

    function scrollOpenedSectionToTop(scrollRoot, section) {
        if (!scrollRoot || !section || !window.matchMedia(MOBILE_SCROLL_QUERY).matches) return;

        function getTargetTop() {
            const rootRect = scrollRoot.getBoundingClientRect();
            const sectionRect = section.getBoundingClientRect();
            return scrollRoot.scrollTop + sectionRect.top - rootRect.top;
        }

        function scrollNow() {
            if (!scrollRoot.isConnected || !section.isConnected) return;
            scrollRoot.scrollTo({
                top: Math.max(0, getTargetTop()),
                behavior: 'smooth'
            });
        }

        requestAnimationFrame(() => {
            scrollNow();
            window.setTimeout(scrollNow, 180);
            window.setTimeout(scrollNow, 420);
            window.setTimeout(scrollNow, 700);
        });
    }

    function syncDetailsSummary(details) {
        const summary = details.querySelector(':scope > summary');
        if (summary) summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
    }

    function initEditorAccordions() {
        const view = document.getElementById('theme-view');
        const scrollRoot = view?.querySelector(':scope > .theme-editor-inner');
        if (!view || !scrollRoot || view.dataset.exclusiveAccordionsBound === 'true') return;
        view.dataset.exclusiveAccordionsBound = 'true';

        view.querySelectorAll('details.theme-editor-section-card, details.theme-editor-subgroup')
            .forEach(syncDetailsSummary);

        view.addEventListener('click', event => {
            const summary = event.target.closest('details.theme-editor-section-card > summary, details.theme-editor-subgroup > summary');
            if (!summary || !view.contains(summary)) return;

            const details = summary.parentElement;
            if (!details || details.tagName !== 'DETAILS') return;

            // Das native Details-Toggling und vorhandene Einzel-Listener ersetzen,
            // damit Öffnen, Schließen und Exklusivität genau einmal ausgeführt werden.
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const opening = !details.open;
            if (opening) {
                const isSubgroup = details.classList.contains('theme-editor-subgroup');
                const siblingSelector = isSubgroup
                    ? ':scope > details.theme-editor-subgroup'
                    : ':scope > details.theme-editor-section-card';

                Array.from(details.parentElement.querySelectorAll(siblingSelector)).forEach(other => {
                    if (other !== details && other.open) {
                        other.open = false;
                        syncDetailsSummary(other);
                    }
                });
            }

            details.open = opening;
            syncDetailsSummary(details);

            if (opening) scrollOpenedSectionToTop(scrollRoot, details);
        }, true);

        view.addEventListener('toggle', event => {
            const details = event.target;
            if (details instanceof HTMLDetailsElement &&
                (details.classList.contains('theme-editor-section-card') ||
                 details.classList.contains('theme-editor-subgroup'))) {
                syncDetailsSummary(details);
            }
        }, true);
    }

    function init() {
        initEditorAccordions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
