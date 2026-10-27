/* Premium Alpine: Bergmotive für die fünf bestehenden Dashboard-Meilensteine.
   Nur Darstellung. Messwerte, Fortschritt, Klickverhalten und Reihenfolge bleiben unverändert. */
(function () {
    'use strict';

    const SECTION_SELECTOR = '#dash-milestones-section';
    /* Individuelle, bildbasierte Alpenmotive. */
    const ICON_ASSETS = {
        asc: './assets/milestones/milestone-asc.svg?v=2',
        dist: './assets/milestones/milestone-dist.svg?v=2',
        peaks: './assets/milestones/milestone-peaks.svg?v=2',
        steps: './assets/milestones/milestone-steps.svg?v=2',
        time: './assets/milestones/milestone-time.svg?v=2'
    };
    const BACKDROP_ASSET = './assets/milestones/alpine-backdrop.svg?v=2';

    const TITLE_MARK = '<svg viewBox="0 0 34 24" role="presentation" focusable="false"><path d="M1.5 21 10.5 8.3l4.2 5.1L22 2.5l10.5 18.5H1.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m7.3 21 3.2-4.5 2.3 2.1M18 9.4l4 4.9 2.2-2.2 4.1 7.2" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/></svg>';


    function buildIcon(type) {
        const src = ICON_ASSETS[type] || ICON_ASSETS.asc;
        return '<img class="dash-ms-symbol-svg dash-ms-art-image" src="' + src +
            '" alt="" aria-hidden="true" decoding="async" draggable="false">';
    }

    function enhanceTitle(section) {
        const title = section.querySelector('.dash-section-title');
        if (!title || title.querySelector('.dash-section-mountain-mark')) return;

        const textNode = Array.from(title.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.nodeValue = textNode.nodeValue.replace(/^\s*🏅\s*/, '');

        const mark = document.createElement('span');
        mark.className = 'dash-section-mountain-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.innerHTML = TITLE_MARK;
        title.insertBefore(mark, title.firstChild);
    }

    function enhanceTile(tile) {
        const type = tile.dataset.msType || 'asc';
        const icon = tile.querySelector('.dash-ms-icon');
        if (icon && icon.dataset.premiumAlpineIcon !== type) {
            icon.innerHTML = buildIcon(type);
            icon.dataset.premiumAlpineIcon = type;
            icon.setAttribute('aria-hidden', 'true');
        }

        if (!tile.querySelector('.dash-ms-watermark')) {
            const watermark = document.createElement('span');
            watermark.className = 'dash-ms-watermark';
            watermark.setAttribute('aria-hidden', 'true');
            watermark.innerHTML = '<img src="' + BACKDROP_ASSET +
                '" alt="" aria-hidden="true" decoding="async" draggable="false">';
            tile.insertBefore(watermark, tile.firstChild);
        }
    }

    function enhanceDashboardMilestones() {
        const section = document.querySelector(SECTION_SELECTOR);
        if (!section) return;
        enhanceTitle(section);
        section.querySelectorAll('.dash-milestone-tile').forEach(enhanceTile);
    }

    function init() {
        const section = document.querySelector(SECTION_SELECTOR);
        if (!section || section.dataset.premiumAlpineObserver === 'true') {
            enhanceDashboardMilestones();
            return;
        }

        section.dataset.premiumAlpineObserver = 'true';
        const observer = new MutationObserver(enhanceDashboardMilestones);
        observer.observe(section, { childList: true, subtree: true });
        enhanceDashboardMilestones();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
