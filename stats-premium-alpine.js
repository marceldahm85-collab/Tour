/* Premium Alpine — passende Line-Art-Symbole für Statistik-Überschriften.
   Rein visuelle Ergänzung: Statistiken, Filter und Interaktionen bleiben unverändert. */
(function () {
    'use strict';

    /* Dieselben echten Alpenfotos wie bei den Dashboard-Meilensteinen. */
    const HIGHLIGHT_PANORAMAS = {
        'highlight-group-umfang': {
            key: 'dist',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d5/20-06-2020_-_Alps_panorama.jpg/1280px-20-06-2020_-_Alps_panorama.jpg'
        },
        'highlight-group-leistung': {
            key: 'asc',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg/1280px-Alpine_meadows_and_mountain_panorama_from_Mount_Rigi%2C_September_2026.jpg'
        },
        'highlight-group-gipfel': {
            key: 'peaks',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Dolomites.jpg/1280px-Dolomites.jpg'
        },
        'highlight-group-haeufigkeiten': {
            key: 'time',
            src: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Alpenpanorama_bei_Sonnenuntergang.jpg/1280px-Alpenpanorama_bei_Sonnenuntergang.jpg'
        }
    };

    const ICONS = {
        trail: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 20c2.2-3.8 4.8-5.7 7.1-5.1 2.2.6 2.7 1.4 4.4-.9 1-1.4 2.1-3.2 4.5-6"/><circle cx="4" cy="20" r="1.4"/><circle cx="20" cy="8" r="1.4"/><path d="m16.8 8.1 3.2-.1-.1-3.2"/><path d="M7 17.5h2.3M10.3 14.9l1.4 1.3M14.8 12l1.4 1.1"/></svg>',
        typical: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m2.5 19.5 6.1-9.4 3.1 4.2 3.4-7 6.4 12.2H2.5Z"/><path d="m13.5 10.2 1.6-2.9 1.6 3.1-1.2-.5-1 .9-.8-.6Z"/><path d="M5.2 19.5c1.7-1 2.8-1 4.1-.2 1.2.7 2.3.8 3.7.1"/></svg>',
        balance: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v17M7 21h10M5 6h14M12 3l-2 2M12 3l2 2"/><path d="m5 6-3 6h6L5 6ZM19 6l-3 6h6l-3-6Z"/><path d="M2.5 12c.3 1.7 1.1 2.5 2.5 2.5s2.2-.8 2.5-2.5M16.5 12c.3 1.7 1.1 2.5 2.5 2.5s2.2-.8 2.5-2.5"/></svg>',
        compare: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 5h7M3 5l2.5-2.5M3 5l2.5 2.5M21 19h-7M21 19l-2.5-2.5M21 19l-2.5 2.5"/><path d="M5 9v7M9 9v7M15 8v8M19 8v8"/><path d="M3 16h8M13 8h8"/></svg>',
        trend: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3v18h18"/><path d="m5.5 16 4.2-4.1 3.1 1.8 5.7-7.1"/><path d="M14.8 6.6h3.7v3.7"/><circle cx="9.7" cy="11.9" r=".8"/><circle cx="12.8" cy="13.7" r=".8"/></svg>',
        trophy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3h10v5.5a5 5 0 0 1-10 0V3ZM9 14v3h6v-3M7 20h10M12 17v3"/><path d="M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4"/><path d="m12 4 .8 1.7 1.8.2-1.3 1.2.4 1.8L12 8l-1.7.9.4-1.8-1.3-1.2 1.8-.2L12 4Z"/></svg>',
        calendarTrend: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 9h18M6.5 17l3-3 2.5 1.5 5-4"/><path d="M14.5 11.5H17v2.5"/></svg>',
        profile: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m2.5 18.5 5-7 3.1 3.7 4.5-8.1 6.4 11.4H2.5Z"/><path d="M4 20.5h16"/><path d="m7.5 13 3.1 2.2 4.5-8.1"/><circle cx="15.1" cy="7.1" r="1"/></svg>',
        calendarCheck: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 9h18"/><path d="m7 14 2 2 3.5-3.5M15 14h2M15 17h2"/></svg>',
        peaks: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m1.8 20 6.1-9.2 3 4 4.2-8.3 7.1 13.5H1.8Z"/><path d="m13.2 9.4 1.9-2.9 2 3.6-1.5-.5-1.1 1-.8-1.2Z"/><path d="M15.1 6.5V2.5h4"/><path d="m4.5 16 3.4-5.2 3 4 4.2-8.3"/></svg>',
        peakList: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21s7-6.6 7-12a7 7 0 0 0-14 0c0 5.4 7 12 7 12Z"/><path d="m7.5 12.5 2.5-3.7 1.5 2 1.8-3.3 3.2 5H7.5Z"/><circle cx="12" cy="6.8" r=".7"/></svg>',
        distance: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m4 17 13-13 4 4L8 21l-4-4Z"/><path d="m14 7 2 2M11.5 9.5l1.5 1.5M9 12l2 2M6.5 14.5 8 16M16.5 4.5 19 7"/></svg>',
        performance: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 18a9 9 0 1 1 18 0v2H3v-2Z"/><path d="m12 16 5-6"/><circle cx="12" cy="16" r="1.7"/><path d="m5.4 11.1-1.3-1M8.5 7.1l-.7-1.5M12 6V4.5M15.5 7.1l.7-1.5M18.6 11.1l1.3-1"/></svg>',
        frequency: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 9h18"/><circle cx="8" cy="13" r=".8"/><circle cx="12" cy="13" r=".8"/><circle cx="16" cy="13" r=".8"/><circle cx="8" cy="17" r=".8"/><circle cx="12" cy="17" r=".8"/></svg>',
        steps: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.5 3C5.8 3 4.8 4.5 5 6.3c.1 1.5 1 2.3 1.1 3.7.1 1.1.5 2 1.7 2.1 1.4.1 2.5-1 2.5-2.3 0-1.3-.7-2.3-.5-3.7C10.1 4.4 9.2 3 7.5 3ZM17.1 12c-1.6 0-2.7 1.5-2.5 3.3.1 1.4.9 2.3 1 3.5.1 1.1.5 2 1.7 2.1 1.4.1 2.4-1 2.4-2.4 0-1.2-.7-2.1-.4-3.5.2-1.7-.6-3-2.2-3Z"/><circle cx="6.6" cy="4.7" r=".45"/><circle cx="8" cy="4.4" r=".45"/><circle cx="9.2" cy="5.1" r=".45"/></svg>',
        time: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2M9 2.5h6M12 2.5V3.5"/><circle cx="12" cy="12" r=".8"/></svg>',
        speed: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 18a9 9 0 1 1 18 0v2H3v-2Z"/><path d="m12 16 5-6"/><circle cx="12" cy="16" r="1.5"/><path d="M5.5 11.5 4.2 10M8.5 7.5 7.8 6M12 6V4.5M15.5 7.5l.7-1.5M18.5 11.5l1.3-1.5"/></svg>',
        grade: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 20 20 4M3 20h18"/><path d="m15.8 4.5 4-.5-.5 4"/><path d="M6 17.2a5 5 0 0 0-1-2.1"/></svg>'
    };


    /* Zusätzliche Motive für Aktivitätsarten und Tourprofile. */
    Object.assign(ICONS, {
        hiking: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3.5h4.2v6.6l3.1 2.4 3.6 1.1a3 3 0 0 1 2.2 2.9V20H3.5v-2.7a2 2 0 0 1 2-2H8V3.5Z"/><path d="M8.2 15.3h2M12 17.2h2M4 20h16"/></svg>',
        climbing: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.1 3.5a4.6 4.6 0 0 0-4.6 4.6v7.1a5.3 5.3 0 0 0 5.3 5.3h4.4a5.3 5.3 0 0 0 5.3-5.3V9.8a4.6 4.6 0 0 0-4.6-4.6"/><path d="M9.2 3.5h5.6M7.1 10.1l3.1 2.7 2.2-2.1 3 2.6"/><path d="m9.1 16.7 2-1.8 2.2 1.8 1.8-1.4"/></svg>',
        ascentRate: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 20h18M5 17.5 10 12l3 2.5L20 5"/><path d="M15.5 5H20v4.5"/></svg>',
        cycling: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="5.2" cy="17.1" r="3.5"/><circle cx="18.7" cy="17.1" r="3.5"/><path d="m5.2 17.1 4.1-7.2 4.1 7.2H5.2ZM9.3 9.9h4.2l5.2 7.2M12.7 6.3h3.1M8.3 8.1l1-1.8"/></svg>',
        backpack: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 6V5a4 4 0 0 1 8 0v1"/><rect x="4.2" y="6" width="15.6" height="15" rx="3"/><path d="M7.5 10h9M7.2 14h9.6v4H7.2zM4.5 11H2.8v5h1.7M19.5 11h1.7v5h-1.7"/></svg>',
        compass: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z"/><path d="M12 3v2M21 12h-2M12 21v-2M3 12h2"/></svg>'
    });

    const TITLE_RULES = [
        [/aktivitätsmix/i, 'trail'],
        [/typische tour/i, 'typical'],
        [/belastungsverteilung/i, 'balance'],
        [/tourarten.?vergleich/i, 'compare'],
        [/persönliche bestform/i, 'trophy'],
        [/formtrend/i, 'trend'],
        [/langfristige entwicklung/i, 'calendarTrend'],
        [/aktivität\s*&\s*regelmäßigkeit/i, 'calendarCheck'],
        [/tourprofil/i, 'profile'],
        [/gipfelstatistik/i, 'peaks'],
        [/gipfelliste|top\s*10.*gipfel|höchster gipfel|höchste gipfel/i, 'peakList'],
        [/gipfel\s*&\s*touren|gipfel|summit/i, 'peaks'],
        [/umfang|längste strecke|strecke|distanz/i, 'distance'],
        [/leistung|belastung|schnellste tour|schnellster anstieg|leistungsindex|bestform/i, 'performance'],
        [/häufigkeiten|regelmäßigkeit|aktivität/i, 'frequency'],
        [/schritte|steps/i, 'steps'],
        [/gehzeit|dauer|zeit/i, 'time'],
        [/speed|tempo|geschwindigkeit/i, 'speed'],
        [/steigung|steil|gradient/i, 'grade'],
        [/typische tour|touren|tour\b/i, 'typical']
    ];

    const LEADING_EMOJI = /^\s*(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D\u20E3]+\s*)+/u;

    function cleanTitle(value) {
        return String(value || '').replace(LEADING_EMOJI, '').replace(/\s+/g, ' ').trim();
    }

    function getLabel(heading) {
        if (heading.matches('.stats-analysis-title')) {
            return Array.from(heading.children).find(child =>
                child.tagName === 'SPAN' &&
                !child.classList.contains('stats-structure-scope') &&
                !child.classList.contains('stats-premium-title-icon')
            ) || heading;
        }

        if (heading.matches('.chart-title')) {
            return Array.from(heading.children).find(child =>
                child.tagName === 'SPAN' &&
                !child.classList.contains('stats-premium-title-icon')
            ) || heading;
        }

        return heading;
    }

    function stripEmoji(label) {
        const textNode = Array.from(label.childNodes).find(node =>
            node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()
        );
        if (!textNode) return;
        const cleaned = textNode.nodeValue.replace(LEADING_EMOJI, '');
        if (cleaned !== textNode.nodeValue) textNode.nodeValue = cleaned;
    }

    function iconKeyFor(title) {
        const clean = cleanTitle(title);
        const match = TITLE_RULES.find(([pattern]) => pattern.test(clean));
        return match ? match[1] : 'peaks';
    }

    function enhanceTitle(heading) {
        const label = getLabel(heading);
        if (!label) return;

        const cleanText = cleanTitle(label.textContent);
        if (!cleanText) return;

        const iconKey = iconKeyFor(cleanText);
        stripEmoji(label);

        const current = label.querySelector(':scope > .stats-premium-title-icon');
        if (current && current.dataset.iconKey === iconKey) {
            heading.dataset.statsPremiumTitleIcon = iconKey;
            label.classList.add('stats-premium-title-label');
            return;
        }
        if (current) current.remove();

        const icon = document.createElement('span');
        icon.className = 'stats-premium-title-icon';
        icon.dataset.iconKey = iconKey;
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = ICONS[iconKey] || ICONS.peaks;

        label.insertBefore(icon, label.firstChild);
        label.classList.add('stats-premium-title-label');
        heading.dataset.statsPremiumTitleIcon = iconKey;
    }


    const STAT_TYPE_ICONS = {
        tours: 'trail',
        'hiking-tours': 'hiking',
        'climbing-tours': 'climbing',
        'cycling-tours': 'cycling',
        'hiking-distance': 'distance',
        'climbing-distance': 'distance',
        'cycling-distance': 'distance',
        'hiking-ascent': 'peaks',
        'climbing-ascent': 'peaks',
        'cycling-ascent': 'peaks',
        'hiking-time': 'time',
        'climbing-time': 'time',
        'cycling-time': 'time',
        'ascent-rate': 'ascentRate',
        steps: 'steps',
        'big-tours': 'backpack',
        peaks: 'peaks',
        performance: 'performance',
        speed: 'speed',
        gradient: 'grade'
    };

    function contentIconKeyForLabel(value) {
        const label = cleanTitle(value).replace(/\s+/g, ' ').trim().toLocaleLowerCase('de');

        if (/(klettersteig|klettern|hike\s*&\s*climb|climbing)/i.test(label)) return 'climbing';
        if (/(radtour|radfahren|bike\s*&\s*hike|cycling)/i.test(label)) return 'cycling';
        if (/(mehrtag|big\s*tour)/i.test(label)) return 'backpack';
        if (/(wandern|ausdauertour|hiking)/i.test(label)) return 'hiking';
        if (/region/i.test(label)) return 'compass';
        if (/schritt/i.test(label)) return 'steps';
        if (/(gehzeit|fahrzeit|dauer|\bzeit\b)/i.test(label)) return 'time';
        if (/(schnellster anstieg|anstieg.*h|hm\/h)/i.test(label)) return 'ascentRate';
        if (/(geschwindigkeit|schnell|tempo)/i.test(label)) return 'speed';
        if (/(leistungsindex|leistungsmerkmal|\bleistung\b|intensiv|bestform|rekord)/i.test(label)) return 'performance';
        if (/(steigung|steiltour|steil)/i.test(label)) return 'grade';
        if (/(strecke|distanz|umfang)/i.test(label)) return 'distance';
        if (/(höhenmeter|aufstieg|gipfel)/i.test(label)) return 'peaks';
        if (/(ausgewogen|belastungsverteilung)/i.test(label)) return 'balance';
        if (/(tourprofil|tourarten|art der tour|typische tour)/i.test(label)) return 'typical';
        if (/(häufigkeiten|aktivität|regelmäßigkeit|tourtage|touren)/i.test(label)) return 'frequency';
        return 'peaks';
    }

    function createContentIcon(iconKey) {
        const key = Object.prototype.hasOwnProperty.call(ICONS, iconKey) ? iconKey : 'peaks';
        const icon = document.createElement('span');
        icon.className = 'stats-premium-content-icon';
        icon.dataset.iconKey = key;
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = ICONS[key];
        return icon;
    }

    function replaceLeadingEmoji(element, iconKey) {
        if (!element) return false;

        const textNode = Array.from(element.childNodes).find(node =>
            node.nodeType === Node.TEXT_NODE && LEADING_EMOJI.test(node.nodeValue)
        );
        if (!textNode) return false;

        const cleaned = textNode.nodeValue.replace(LEADING_EMOJI, '');
        const icon = createContentIcon(iconKey);
        textNode.parentNode.insertBefore(icon, textNode);
        textNode.nodeValue = cleaned;
        element.dataset.statsPremiumContentIcon = iconKey;
        return true;
    }

    function replaceEmojiOnlyIcon(element, iconKey) {
        if (!element || !LEADING_EMOJI.test(element.textContent || '')) return false;
        element.replaceChildren(createContentIcon(iconKey));
        element.dataset.statsPremiumContentIcon = iconKey;
        return true;
    }

    function enhanceLegacyStatisticsLabels(root) {
        root.querySelectorAll('.stats-main-list > li[data-stat-type] .stats-label')
            .forEach(label => {
                if (label.querySelector(':scope > .stats-premium-content-icon')) return;
                const item = label.closest('li[data-stat-type]');
                const key = STAT_TYPE_ICONS[item?.dataset?.statType] ||
                    contentIconKeyForLabel(label.textContent);
                label.insertBefore(createContentIcon(key), label.firstChild);
            });
    }

    function enhanceContentIcons() {
        const statistics = document.getElementById('stats-statistics-page');
        if (statistics) {
            const structureSelectors = [
                '.stats-structure-mix-name',
                '.stats-structure-typical-card .stats-structure-card-label',
                '.stats-structure-burden-head strong',
                '.stats-structure-burden-name',
                '.stats-structure-type-head strong'
            ];
            structureSelectors.forEach(selector => {
                statistics.querySelectorAll(selector).forEach(element => {
                    const key = contentIconKeyForLabel(element.textContent);
                    replaceLeadingEmoji(element, key);
                });
            });
            enhanceLegacyStatisticsLabels(statistics);
        }

        const highlights = document.getElementById('stats-highlights-page');
        if (highlights) {
            highlights.querySelectorAll('.highlight-row-icon').forEach(element => {
                const label = element.closest('.highlight-row-label')
                    ?.querySelector('.highlight-row-text')?.textContent || element.textContent;
                replaceEmojiOnlyIcon(element, contentIconKeyForLabel(label));
            });
        }

        const development = document.getElementById('stats-development-page');
        if (development) {
            const developmentSelectors = [
                '.tour-profile-summary-value',
                '.tour-profile-summary-meta',
                '.tour-profile-row .tour-profile-name',
                '.tour-profile-feature-card > strong',
                '.tour-profile-detail-name',
                '.tour-profile-detail-trait'
            ];
            developmentSelectors.forEach(selector => {
                development.querySelectorAll(selector).forEach(element => {
                    const key = contentIconKeyForLabel(element.textContent);
                    replaceLeadingEmoji(element, key);
                });
            });
        }
    }

    function enhanceStatsModalTitle() {
        const titles = [
            document.getElementById('tl-title'),
            document.getElementById('ds-title')
        ].filter(Boolean);

        titles.forEach(title => {
            const raw = String(title.textContent || '').trim();
            if (!LEADING_EMOJI.test(raw)) return;

            const clean = cleanTitle(raw);
            if (!clean) return;

            const isCalendarDate = /^\\d{1,2}\\.\\d{1,2}\\.\\d{4}$/.test(clean);
            const key = isCalendarDate ? 'calendarCheck' : contentIconKeyForLabel(clean);
            title.replaceChildren(createContentIcon(key), document.createTextNode(clean));
            title.dataset.statsPremiumModalIconKey = key;
        });
    }

    function observeStatsModalTitle() {
        ['tl-title', 'ds-title'].forEach(id => {
            const title = document.getElementById(id);
            if (!title || title.dataset.statsPremiumModalObserver === 'true') return;

            title.dataset.statsPremiumModalObserver = 'true';
            new MutationObserver(enhanceStatsModalTitle).observe(title, {
                childList: true,
                characterData: true,
                subtree: true
            });
        });
    }

    function enhanceModalBodyIcons() {
        const bodies = [
            document.getElementById('tl-body'),
            document.getElementById('ds-body')
        ].filter(Boolean);

        const selectors = [
            '.stats-label',
            '.tour-group-meta span',
            '.tour-group-insight-label',
            '.tour-stat-label',
            '.tour-stat-item > span:first-child'
        ].join(', ');

        bodies.forEach(root => {
            root.querySelectorAll(selectors).forEach(element => {
                const raw = String(element.textContent || '').trim();
                if (!LEADING_EMOJI.test(raw)) return;

                const clean = cleanTitle(raw);
                const isCalendarDate = /^\\d{1,2}\\.\\d{1,2}\\.\\d{4}$/.test(clean);
                const isStageMeta = /etappe|mehrtag|gruppe/i.test(clean);
                const key = isCalendarDate
                    ? 'calendarCheck'
                    : (isStageMeta ? 'backpack' : contentIconKeyForLabel(clean));
                replaceLeadingEmoji(element, key);
            });
        });
    }
    function enhanceHighlightPanoramas() {
        const highlights = document.getElementById('stats-highlights-page');
        if (!highlights) return;

        Object.entries(HIGHLIGHT_PANORAMAS).forEach(([groupClass, asset]) => {
            highlights.querySelectorAll('#highlights-content .' + groupClass).forEach(group => {
                const current = group.querySelector(':scope > .highlight-panorama');
                if (current && current.dataset.photoKey === asset.key) return;
                if (current) current.remove();

                const panorama = document.createElement('span');
                panorama.className = 'highlight-panorama highlight-panorama--' + asset.key;
                panorama.dataset.photoKey = asset.key;
                panorama.setAttribute('aria-hidden', 'true');

                const image = document.createElement('img');
                image.src = asset.src;
                image.alt = '';
                image.setAttribute('aria-hidden', 'true');
                image.setAttribute('decoding', 'async');
                image.setAttribute('loading', 'lazy');
                image.draggable = false;

                panorama.appendChild(image);
                group.insertBefore(panorama, group.firstChild);
            });
        });
    }

    function enhanceAll() {
        enhanceHighlightPanoramas();
        document.querySelectorAll(
            '#chart-view .stats-analysis-title, ' +
            '#chart-view .chart-title, ' +
            '#chart-view .highlight-group-title'
        ).forEach(enhanceTitle);
        enhanceContentIcons();
        enhanceStatsModalTitle();
        enhanceModalBodyIcons();
    }

    function init() {
        enhanceAll();

        const target = document.getElementById('chart-view');
        if (!target || target.dataset.statsPremiumTitleObserver === 'true') return;

        target.dataset.statsPremiumTitleObserver = 'true';
        observeStatsModalTitle();
        const observer = new MutationObserver(enhanceAll);
        observer.observe(target, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();