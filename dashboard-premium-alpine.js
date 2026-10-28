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

    /* Zehn eigenständige Premium-Line-Art-Symbole für die Dashboard-Statistik.
       Alpine Formen, feine Binnenlinien und kleine Flächenakzente statt generischer Piktogramme.
       Die Akzentfarbe bleibt vollständig im CSS/Theme-Editor definiert. */
    const DASH_STAT_MARKS = {
        touren: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6.2 8.5 4l7 2 5.5-2v13.8l-5.5 2-7-2L3 20V6.2Z"/><path d="M8.5 4v13.8M15.5 6v13.8"/><path d="M4.5 9.2c1-.5 2-.6 3-.2M10 8.3c1.2.7 2.3.7 3.4.2M16.5 10.4l2.7-.9M10.4 15.6c1.2-1.9 2.4-2.4 3.3-4.2"/><path d="M13.7 10.6c0-1.1.8-1.9 1.8-1.9s1.8.8 1.8 1.9c0 1.2-1.8 3.4-1.8 3.4s-1.8-2.2-1.8-3.4Z"/><circle cx="15.5" cy="10.6" r=".55" class="icon-accent-fill"/></svg>',
        steps: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.3 2.5C5.5 2.3 4.4 4 4.5 6c.1 1.5 1 2.7 1.1 4.1.1 1.2.4 2.2 1.7 2.4 1.5.2 2.8-1 2.9-2.5.1-1.4-.7-2.5-.4-4.1.3-1.9-.6-3.2-2.5-3.4Z"/><path d="M18 11.6c-1.8-.2-3.1 1.5-3 3.5.1 1.5 1 2.5 1.1 3.8.1 1.2.5 2.2 1.8 2.4 1.5.2 2.7-1.1 2.7-2.6 0-1.4-.8-2.4-.5-3.9.3-1.8-.4-3-2.1-3.2Z"/><path d="M6.2 6.6c.4.7.8 1.4.8 2.2M16.5 15.7c.5.7.8 1.3.8 2.1"/><circle cx="5.7" cy="4.3" r=".48" class="icon-accent-fill"/><circle cx="7.2" cy="3.7" r=".48" class="icon-accent-fill"/><circle cx="8.6" cy="4.5" r=".48" class="icon-accent-fill"/><circle cx="16.4" cy="13.6" r=".48" class="icon-accent-fill"/><circle cx="17.8" cy="12.9" r=".48" class="icon-accent-fill"/><circle cx="19.1" cy="13.7" r=".48" class="icon-accent-fill"/></svg>',
        gipfel: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m1.8 19.8 5.1-7.3 2.4 2.6L14.1 5l8.1 14.8H1.8Z"/><path d="m11.5 9.9 2.6-4.9 2 3.7-1.5-.7-1.1 1.4-1-.5Z" class="icon-accent-fill"/><path d="m4.8 15.5 2.1-3 2.4 2.6 4.8-8.8M14.1 5l2 3.7-1.5-.7-1.1 1.4"/><path d="M5 19.8c1.8-1 3.1-1 4.7-.2 1.4.6 2.8.5 4.2-.2s2.7-.7 4.2 0"/><path d="m14.1 5-1.1 2.1 1.3-.3 1.2 1.5"/></svg>',
        bigTours: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.4 14.1 4l2.7-.2 1.1 2.4 2.4 1.3-.2 2.7 1.5 2.1-1.5 2.2.2 2.6-2.4 1.3-1.1 2.4-2.7-.2-2.1 1.6-2.1-1.6-2.7.2-1.1-2.4-2.4-1.3.2-2.6L2.4 12l1.5-2.1-.2-2.7 2.4-1.3 1.1-2.4 2.7.2L12 2.4Z"/><path d="m5.7 14.6 3-4.6 2 2.1 2.7-4.6 5.1 7.1H5.7Z"/><path d="m10.7 10.2 1-1.7 1.1 1.8-.8-.4-.7.6-.6-.3Z" class="icon-accent-fill"/><path d="m7.2 17.7-.4 4 3.5-1.9 1.7 1.6 1.7-1.6 3.5 1.9-.4-4"/><path d="m9.2 11.2 1.5 1.5 2.7-4.6"/></svg>',
        strecke: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.2 19.8c1.6-3.3 2.7-4.7 5.1-5.1 2.2-.4 3.1 1.1 4.8.2 1.8-1 1.5-3.4 3.2-4.9"/><path d="M4.2 17.2c-1.3 0-2.3 1-2.3 2.2 0 1 2.3 3 2.3 3s2.3-2 2.3-3c0-1.2-1-2.2-2.3-2.2Z"/><path d="M18.1 2.4c-1.5 0-2.7 1.2-2.7 2.7 0 1.6 2.7 4.1 2.7 4.1s2.7-2.5 2.7-4.1c0-1.5-1.2-2.7-2.7-2.7Z"/><circle cx="4.2" cy="19.4" r=".65" class="icon-accent-fill"/><circle cx="18.1" cy="5.1" r=".7" class="icon-accent-fill"/><circle cx="9.4" cy="14.7" r=".7"/><circle cx="13.8" cy="14.3" r=".7"/><path d="M8.1 11.2 9.4 14.7 13.8 14.3 17.3 10" stroke-dasharray="1.2 1.7"/></svg>',
        aufstieg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m1.8 19.8 5.4-8.9 2.7 3.2L14.1 7l7.8 12.8H1.8Z"/><path d="m11.6 11.4 2.5-4.4 2.6 4.3-1.5-.7-1.1 1.3-1.1-.9-1.4.4Z" class="icon-accent-fill"/><path d="M18.4 14.5V3.3M15.6 6.2l2.8-2.9 2.8 2.9"/><path d="M4.3 19.8c1.4-1.1 2.7-1.1 4.1-.4 1.5.7 2.6.7 4.2-.2"/></svg>',
        gehzeit: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 2.2h6l.8 3.1H8.2L9 2.2ZM8.2 18.7h7.6l-.8 3.1H9l-.8-3.1Z"/><circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="5.6"/><path d="M12 7.9v4.4l3.1 1.8M12 5.3v1M18.7 12h-1M6.3 12h-1"/><circle cx="12" cy="12" r=".8" class="icon-accent-fill"/><path d="M19.4 13.8h1.8v2.4h-1.8"/></svg>',
        speed: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 18.8a9 9 0 1 1 18 0v1H3v-1Z"/><path d="M5.2 13.3 3.8 12M8.1 8.1 7.2 6.5M12 6.4V4.8M15.9 8.1l.9-1.6M18.8 13.3l1.4-1.3"/><path d="M12 16.5 16.7 9.7"/><circle cx="12" cy="16.5" r="1.8"/><path d="M6.4 17.7h1.2M16.4 17.7h1.2"/><circle cx="12" cy="16.5" r=".55" class="icon-accent-fill"/></svg>',
        steigung: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 19.8 20.5 5.2M3 19.8h18"/><path d="m16.8 5.5 3.7-.4-.4 3.7"/><path d="M7.4 19.8a4.4 4.4 0 0 0-1.1-2.9"/><circle cx="3.3" cy="19.5" r=".65" class="icon-accent-fill"/><circle cx="20.4" cy="5.3" r=".65" class="icon-accent-fill"/></svg>',
        anstieg: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 19.8V4.2M2.5 19.8h19"/><path d="m4.5 17.2 4-3.8 3 1.6 3.7-5 2.1 1.3 3.1-5.1"/><path d="M16.9 6.2h3.5v3.5"/><circle cx="8.5" cy="13.4" r=".9" class="icon-accent-fill"/><circle cx="11.5" cy="15" r=".9" class="icon-accent-fill"/><circle cx="15.2" cy="10" r=".9" class="icon-accent-fill"/><path d="M4.4 7.4h2.1M4.4 10.2h1.4" stroke-dasharray="1 1.6"/></svg>',

        timeAscent: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="6.6" cy="12.5" r="4.2"/><path d="M6.6 10.1v2.6l1.8 1.1"/><path d="M12 19.8 16.4 9.2 18.6 13l1.6-2.3 2.5 9.1H12Z"/><path d="m14.9 12.8 1.5 2 1.2-1.4 1.2 2.1"/><path d="m16.4 9.2-.8 2.2 1.2-.2 1.3 1.8" class="icon-accent-fill"/><circle cx="6.6" cy="12.5" r=".55" class="icon-accent-fill"/></svg>',
        timeDistance: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="7.2" cy="7.2" r="4.3"/><path d="M7.2 4.8v2.6l1.7 1"/><path d="M2.5 21h19"/><path d="M3.5 17.8 8 15.7l3.4.8 5.1-5.1 3.7-1.7"/><path d="m17.6 9.3 2.8.2-.1 2.8"/><circle cx="3.5" cy="17.8" r=".7" class="icon-accent-fill"/><circle cx="11.4" cy="16.5" r=".65" class="icon-accent-fill"/><circle cx="16.5" cy="11.4" r=".65" class="icon-accent-fill"/></svg>'
    };


    /* Wiederverwendung derselben Premium-Line-Art in den Diagramm-Kacheln.
       Die Meilenstein-Diagramme verwenden bewusst die identischen Rundgrafiken
       wie die fünf Dashboard-Meilensteine. */
    const CHART_TAB_STAT_MARKS = {
        bigTours: 'bigTours',
        steps: 'steps',
        peaks: 'gipfel',
        performanceIndex: 'anstieg',
        speed: 'speed',
        gradient: 'steigung',
        ascentRate: 'aufstieg',
        avgSteps: 'steps',
        scatterDistanceAscent: 'strecke',
        scatterTimeAscent: 'timeAscent',
        scatterTimeDistance: 'timeDistance',
        regions: 'touren'
    };
    const CHART_TAB_MILESTONE_ICONS = {
        msDistance: ICON_ASSETS.dist,
        msAscent: ICON_ASSETS.asc,
        msTime: ICON_ASSETS.time,
        msPeaks: ICON_ASSETS.peaks
    };

    function enhanceChartTabIcons() {
        const chartView = document.querySelector('#chart-view');
        if (!chartView) return;

        chartView.querySelectorAll('#chart-tabs .chart-tab[data-chart]').forEach(tile => {
            const type = tile.dataset.chart;
            const icon = tile.querySelector('.chart-tab-icon');
            if (!icon || icon.dataset.premiumAlpineChartIcon === type) return;

            const milestoneSrc = CHART_TAB_MILESTONE_ICONS[type];
            if (milestoneSrc) {
                icon.innerHTML = '<img class="chart-tab-ms-art" src="' + milestoneSrc +
                    '" alt="" aria-hidden="true" decoding="async" draggable="false">';
            } else {
                const markKey = CHART_TAB_STAT_MARKS[type];
                const svg = DASH_STAT_MARKS[markKey];
                if (!svg) return;
                icon.innerHTML = svg;
            }

            icon.dataset.premiumAlpineChartIcon = type;
            icon.setAttribute('aria-hidden', 'true');
        });
    }


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

    function getMilestoneModalType() {
        const title = document.getElementById('milestone-modal-title');
        const label = String(title?.textContent || '').toLocaleLowerCase('de');
        if (label.includes('strecke')) return 'dist';
        if (label.includes('aufstieg')) return 'asc';
        if (label.includes('gehzeit')) return 'time';
        if (label.includes('gipfel')) return 'peaks';
        if (label.includes('schritte')) return 'steps';
        return null;
    }

    function enhanceMilestoneModalBackground() {
        const modal = document.getElementById('milestone-modal');
        const card = modal?.querySelector('.modal-card');
        const type = getMilestoneModalType();
        if (!modal || !card || !type) return;

        let watermark = card.querySelector(':scope > .milestone-modal-watermark');
        if (!watermark) {
            watermark = document.createElement('img');
            watermark.className = 'milestone-modal-watermark';
            watermark.alt = '';
            watermark.setAttribute('aria-hidden', 'true');
            watermark.setAttribute('draggable', 'false');
            watermark.setAttribute('decoding', 'async');
            card.insertBefore(watermark, card.firstChild);
        }

        const source = ICON_ASSETS[type] || ICON_ASSETS.asc;
        if (watermark.dataset.milestoneType !== type) {
            watermark.src = source;
            watermark.dataset.milestoneType = type;
            modal.dataset.milestoneModalType = type;
        }
    }

    function observeMilestoneModalBackground() {
        const title = document.getElementById('milestone-modal-title');
        if (!title || title.dataset.milestoneBackgroundObserver === 'true') return;

        title.dataset.milestoneBackgroundObserver = 'true';
        new MutationObserver(enhanceMilestoneModalBackground).observe(title, {
            childList: true,
            characterData: true,
            subtree: true
        });
        enhanceMilestoneModalBackground();
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

        /* Die Spur bleibt in der horizontalen Kopfzeile: links bündig mit dem Text
           rechts neben dem Symbol, rechts bündig mit der gesamten Kachel-Innenkante.
           Absolute Positionierung verhindert, dass Textlängen die Track-Breite bestimmen. */
        const top = tile.querySelector('.dash-ms-top');
        const progressWrap = tile.querySelector('.dash-ms-progress-wrap');
        if (top && progressWrap && progressWrap.parentElement !== top) {
            top.appendChild(progressWrap);
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

        /* Die Datenquelle rendert bis zu fünf Touren. Nicht auf drei kürzen,
           denn das Hoch-/Querformat wird rein per CSS gesteuert. */
        const items = list.querySelectorAll(':scope > .dash-recent-item');
        items.forEach((item, index) => {
            if (index >= 5) item.remove();
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
        enhanceChartTabIcons();
        observeMilestoneModalBackground();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
