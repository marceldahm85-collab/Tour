/* Exklusives Aufklappen und Scroll-Ausrichtung für Suche & Vergleich sowie Editor. */
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

    function setFilterPanelCollapsed(panel, collapsed) {
        const title = panel.querySelector(':scope > .filter-simple-title');
        if (!title) return;

        panel.classList.toggle('is-collapsed', collapsed);
        title.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    function initFilterAccordions() {
        const root = document.querySelector('#filter-view > .filter-simple-inner');
        if (!root) return;

        const panels = Array.from(root.querySelectorAll(':scope > .filter-section-panel'));
        if (!panels.length) return;

        panels.forEach(panel => {
            const title = panel.querySelector(':scope > .filter-simple-title');
            if (!title || title.dataset.filterAccordionBound === 'true') return;

            title.dataset.filterAccordionBound = 'true';
            title.setAttribute('role', 'button');
            title.setAttribute('tabindex', '0');
            setFilterPanelCollapsed(panel, true);

            // Direkt am Header binden: kein übergeordneter View-Listener,
            // der durch andere Ereignis-Handler abgefangen werden kann.
            function togglePanel() {
                const opening = panel.classList.contains('is-collapsed');

                if (opening) {
                    panels.forEach(other => {
                        if (other !== panel && !other.classList.contains('is-collapsed')) {
                            setFilterPanelCollapsed(other, true);
                        }
                    });
                }

                setFilterPanelCollapsed(panel, !opening);
                if (opening) scrollOpenedSectionToTop(root, panel);
            }

            title.addEventListener('click', togglePanel);
            title.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                togglePanel();
            });
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
        initFilterAccordions();
        initEditorAccordions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
