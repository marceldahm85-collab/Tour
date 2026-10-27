/* Premium Alpine: Bergmotive für die fünf bestehenden Dashboard-Meilensteine.
   Nur Darstellung. Messwerte, Fortschritt, Klickverhalten und Reihenfolge bleiben unverändert. */
(function () {
    'use strict';

    const SECTION_SELECTOR = '#dash-milestones-section';
    /* Individuelle, bildbasierte Alpenmotive. */
    const ICON_ASSETS = {
        asc: './assets/milestones/milestone-asc.svg?v=3',
        dist: './assets/milestones/milestone-dist.svg?v=3',
        peaks: './assets/milestones/milestone-peaks.svg?v=3',
        steps: './assets/milestones/milestone-steps.svg?v=3',
        time: './assets/milestones/milestone-time.svg?v=3'
    };
    /* Jedes Dashboard-Ziel bekommt ein eigenes Panorama. */
    const BACKDROP_ASSETS = {
        asc: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg/1280px-Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg',
        dist: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/20-06-2020_-_Alps_panorama.jpg/1280px-20-06-2020_-_Alps_panorama.jpg',
        peaks: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Dolomites.jpg/1280px-Dolomites.jpg',
        steps: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Tyrol_-_hiking_trail.jpg/1280px-Tyrol_-_hiking_trail.jpg',
        time: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Alpenpanorama_bei_Sonnenuntergang.jpg/1280px-Alpenpanorama_bei_Sonnenuntergang.jpg'
    };

    const TITLE_MARK = '<svg viewBox="0 0 34 24" role="presentation" focusable="false"><path d="M1.5 21 10.5 8.3l4.2 5.1L22 2.5l10.5 18.5H1.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m7.3 21 3.2-4.5 2.3 2.1M18 9.4l4 4.9 2.2-2.2 4.1 7.2" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/></svg>';
    const TOUR_HISTORY_MARK = '<svg viewBox="4.5 0 25 24" role="presentation" focusable="false"><path d="M26.46 14.54 A9.8 9.8 0 0 1 17 21.8 A9.8 9.8 0 0 1 7.2 12 A9.8 9.8 0 0 1 17 2.2 A9.8 9.8 0 0 1 23.93 5.07" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.59 3.74 23.93 5.07 22.6 1.73" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 6.35V12l4.13 2.48" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="12" r="1.06" fill="currentColor"/></svg>';


    function buildIcon(type) {
        const src = ICON_ASSETS[type] || ICON_ASSETS.asc;
        return '<img class="dash-ms-symbol-svg dash-ms-art-image" src="' + src +
            '" alt="" aria-hidden="true" decoding="async" draggable="false">';
    }

    function enhanceTitle(section) {
        const title = section.querySelector('.dash-section-title');
        if (!title || title.querySelector('.dash-section-mountain-mark')) return;

        const textNode = Array.from(title.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.nodeValue = textNode.nodeValue.replace(/^\s*(?:🏅|🕐)\s*/, '');

        const isRecentTours = section.id === 'dash-recent-section';
        const mark = document.createElement('span');
        mark.className = 'dash-section-mountain-mark' + (isRecentTours ? ' dash-section-tour-history-mark' : '');
        mark.setAttribute('aria-hidden', 'true');
        mark.innerHTML = isRecentTours ? TOUR_HISTORY_MARK : TITLE_MARK;
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

        /* Der Fortschrittsbalken sitzt im Textbereich rechts neben dem Motiv.
           Die vorhandene Leiste und ihr berechneter Wert bleiben dieselben DOM-Elemente. */
        const info = tile.querySelector('.dash-ms-info');
        const progressWrap = tile.querySelector('.dash-ms-progress-wrap');
        if (info && progressWrap && progressWrap.parentElement !== info) {
            info.appendChild(progressWrap);
        }

        if (!tile.querySelector('.dash-ms-watermark')) {
            const watermark = document.createElement('span');
            watermark.className = 'dash-ms-watermark dash-ms-watermark--' + (BACKDROP_ASSETS[type] ? type : 'asc');
            watermark.setAttribute('aria-hidden', 'true');
            const backdropSrc = BACKDROP_ASSETS[type] || BACKDROP_ASSETS.asc;
            watermark.innerHTML = '<img src="' + backdropSrc +
                '" alt="" aria-hidden="true" decoding="async" draggable="false">';
            tile.insertBefore(watermark, tile.firstChild);
        }
    }

    function trimRecentTours(section) {
        if (!section) return;
        const list = section.querySelector('.dash-tour-list');
        if (!list) return;

        const items = list.querySelectorAll(':scope > .dash-recent-item');
        items.forEach((item, index) => {
            if (index >= 3) item.remove();
        });
    }

    function enhanceRecentTours() {
        const section = document.querySelector('#dash-recent-section');
        if (!section) return;

        enhanceTitle(section);
        trimRecentTours(section);
        if (section.dataset.premiumAlpineRecentObserver === 'true') return;

        section.dataset.premiumAlpineRecentObserver = 'true';
        const observer = new MutationObserver(() => {
            enhanceTitle(section);
            trimRecentTours(section);
        });
        observer.observe(section, { childList: true, subtree: true });
    }

    function enhanceDashboardMilestones() {
        const section = document.querySelector(SECTION_SELECTOR);
        if (!section) return;
        enhanceTitle(section);
        section.querySelectorAll('.dash-milestone-tile').forEach(enhanceTile);
    }

    function init() {
        const section = document.querySelector(SECTION_SELECTOR);
        if (section && section.dataset.premiumAlpineObserver !== 'true') {
            section.dataset.premiumAlpineObserver = 'true';
            const observer = new MutationObserver(enhanceDashboardMilestones);
            observer.observe(section, { childList: true, subtree: true });
        }
        enhanceDashboardMilestones();
        enhanceRecentTours();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
