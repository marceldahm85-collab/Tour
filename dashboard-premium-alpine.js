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

    /* Dashboard-Kacheln: zehn reduzierte Alpine-Line-Art-Symbole.
       Einheitliche Kontur; Farbe und Größe kommen ausschließlich aus dem Premium-CSS. */
    const DASH_STAT_MARKS = {
        touren: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3.5v6.7c0 1.5-.8 2.6-2.3 3.1l-1.8.6A3.1 3.1 0 0 0 1.8 17v.2c0 1.3 1 2.3 2.3 2.3h14.6c1.2 0 2.1-.9 2.1-2v-1.1c0-.7-.5-1.3-1.2-1.5l-4.4-1.4c-2-.6-3.2-2.4-3.2-4.5V3.5H8Z"/><path d="M8 6.8h3.3M8 9.3h3.5M8 11.7h4M3.2 17.2h17.5"/></svg>',
        steps: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.1 3.5c-1.4-.1-2.5 2-2.3 4.3.1 1.6.9 2.6 1.9 2.5 1.4-.1 2.4-2.3 2.2-4.4-.1-1.4-.9-2.4-1.8-2.4Z"/><path d="M16.5 12.3c-1.4-.1-2.5 2-2.3 4.3.1 1.6.9 2.6 1.9 2.5 1.4-.1 2.4-2.3 2.2-4.4-.1-1.4-.9-2.4-1.8-2.4Z"/></svg>',
        gipfel: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.2 19.5 8.8 8.3l3.4 5 3.1-6 6.5 12.2H2.2Z"/><path d="m6.5 12.2 2.3 1.5 1.7-1.2M13.8 10.4l1.5 2.8 1.9-1.1"/></svg>',
        bigTours: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="9.5" r="6.4"/><path d="m7.8 14.5-.9 6 4-2.1 2.2 2.1 1.1-5.8"/><path d="m7.8 11.8 2.5-3.5 1.8 2.1 1.6-2.7 2.7 4.1H7.8Z"/></svg>',
        strecke: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19.4c2.4-1.6 1.6-4.5 4.2-5.7s4.1 1.6 6.2.1c2.2-1.6 1.2-4.4 3.7-6.1"/><circle cx="5" cy="19.2" r="2"/><path d="M19.1 3.7c-1.5 0-2.7 1.2-2.7 2.7s2.7 4 2.7 4 2.7-2.5 2.7-4-1.2-2.7-2.7-2.7Z"/><circle cx="19.1" cy="6.4" r=".7"/></svg>',
        aufstieg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 19.5 8.2 9.8l3.1 4.1 2.3-3.2 5 8.8H2.5Z"/><path d="M18.7 12.2V3.8M15.8 6.7l2.9-2.9 2.9 2.9"/></svg>',
        gehzeit: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="13.2" r="7.6"/><path d="M12 3.1v2.5M9.5 3.1h5M17.7 7.1l1.7-1.7M12 8.7v4.6l3.1 1.8"/></svg>',
        speed: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 17.8a8.7 8.7 0 1 1 17 0M3 18.2h18"/><path d="m12 14 4-4.3M6.5 12.3l1.2.7M17.4 12.3l-1.2.7M12 7.1v1.4"/><circle cx="12" cy="14" r="1.2"/></svg>',
        steigung: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 19.5h16V5.7L4 19.5Z"/><path d="M7.8 19.4a4 4 0 0 1 3.1-3.8M8.6 16l1.5 1.1"/></svg>',
        anstieg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m3.5 19.5 5-5 3.1 2.3 4.1-5.2"/><path d="M18.8 14.3V4.5M15.5 7.8l3.3-3.3 3.3 3.3"/></svg>'
    };


    function enhanceDashboardStatIcons() {
        const dashboard = document.querySelector('#dashboard-view');
        if (!dashboard) return;

        dashboard.querySelectorAll('.dash-stat-tile[data-tile-type]').forEach(tile => {
            const type = tile.dataset.tileType;
            const icon = tile.querySelector('.dash-stat-icon');
            const svg = DASH_STAT_MARKS[type];
            if (!icon || !svg || icon.dataset.premiumAlpineStatIcon === type) return;

            icon.innerHTML = svg;
            icon.dataset.premiumAlpineStatIcon = type;
            icon.setAttribute('aria-hidden', 'true');
        });
    }

    function observeDashboardStatIcons() {
        const dashboard = document.querySelector('#dashboard-view');
        if (!dashboard || dashboard.dataset.premiumAlpineStatIconObserver === 'true') return;

        const targets = [
            dashboard.querySelector('#dash-stat-grid'),
            dashboard.querySelector('.dash-year-filter-wrap')
        ].filter(Boolean);
        if (!targets.length) return;

        dashboard.dataset.premiumAlpineStatIconObserver = 'true';
        const observer = new MutationObserver(enhanceDashboardStatIcons);
        targets.forEach(target => observer.observe(target, { childList: true, subtree: true }));
        enhanceDashboardStatIcons();
    }

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
        observeDashboardStatIcons();
        enhanceDashboardStatIcons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
