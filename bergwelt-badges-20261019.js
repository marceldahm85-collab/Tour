(function () {
    'use strict';
    // Eigene Versionskennung verhindert, dass ein bereits geladenes älteres
    // Bergwelt-Modul die aktualisierten Abzeichen vorzeitig blockiert.
    if (window.__BERGWELT_BADGE_MODULE_VERSION__ === '20261021-height-year-contribution-chart') return;
    window.__BERGWELT_BADGE_MODULE_VERSION__ = '20261021-height-year-contribution-chart';
    window.__BERGWELT_MODULE_READY__ = true;

    const root = document.getElementById('wrapped-view');
    const tabs = document.getElementById('bergwelt-tabs');
    const panel = document.getElementById('bergwelt-panel');
    const tourbookPanel = document.getElementById('bergwelt-tourbuch-panel');
    const tourbookCard = document.getElementById('pdf-export-card');
    if (!root || !tabs || !panel || !tourbookPanel) return;
    root.classList.add('bergwelt-ready');
    if (tourbookCard && tourbookCard.parentNode !== tourbookPanel) {
        tourbookPanel.appendChild(tourbookCard);
    }

    const tabNames = {
        erlebnis: 'Erlebnis',
        hoehenwelt: 'Höhenwelt',
        level: 'Level',
        tourbuch: 'Tourbuch'
    };
    let activeTab = 'erlebnis';

    // Teilen und Vollbild gehören ausschließlich zum Erlebnis-Bereich.
    const shareButton = document.getElementById('wrapped-share-btn');
    const fullscreenButton = document.getElementById('wrapped-fullscreen-btn');
    const syncExperienceActions = () => {
        const visible = activeTab === 'erlebnis';
        [shareButton, fullscreenButton].forEach(button => {
            if (!button) return;
            button.hidden = !visible;
            button.style.display = visible ? '' : 'none';
        });
    };
    syncExperienceActions();
    let selectedHeightMilestone = null;

    const getTours = () => {
        try {
            const value = window.__bergweltGetTours?.();
            return Array.isArray(value) ? value.filter(x => x && typeof x === 'object') : [];
        } catch (_) { return []; }
    };
    // Bevorzugt die gemeinsame Datenbasis aus app-core.js. Fallbacks halten
    // Bergwelt auch bei isolierten Tests oder abweichender Script-Reihenfolge funktionsfähig.
    const readMetric = value => typeof window.__tourDataRules?.readMetric === 'function'
        ? window.__tourDataRules.readMetric(value)
        : (() => {
            if (value === null || value === undefined || String(value).trim() === '') return null;
            const normalized = String(value).replace(/\s/g, '').replace(',', '.');
            if (!normalized) return null;
            const n = Number(normalized);
            return Number.isFinite(n) && n >= 0 ? n : null;
        })();
    const parseNumber = value => readMetric(value) ?? 0;
    const parseMinutes = value => typeof window.__tourDataRules?.parseMinutes === 'function'
        ? window.__tourDataRules.parseMinutes(value)
        : (() => {
            if (value === null || value === undefined || String(value).trim() === '') return null;
            const m = String(value).trim().match(/^(\d{1,4}):([0-5]?\d)$/);
            return m ? Number(m[1]) * 60 + Number(m[2]) : null;
        })();
    const parseTourDate = value => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
        if (match) {
            const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            return d.getFullYear() === Number(match[1]) && d.getMonth() === Number(match[2]) - 1 && d.getDate() === Number(match[3]) ? d : null;
        }
        match = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        if (match) {
            const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
            const d = new Date(year, month - 1, day);
            return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
        }
        const fallback = new Date(raw);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    };
    const dateYear = entry => typeof window.__tourDataRules?.yearFromDate === 'function' ? window.__tourDataRules.yearFromDate(entry?.date) : parseTourDate(entry?.date)?.getFullYear() ?? null;
    const fmt = (n, digits = 0) => Number(n || 0).toLocaleString('de-AT', { maximumFractionDigits: digits, minimumFractionDigits: digits });
    const escapeHTML = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[ch]));
    const getYear = () => {
        const selected = document.getElementById('wrapped-year-select')?.value;
        return selected === 'all' ? 'all' : (Number(selected) || new Date().getFullYear());
    };
    const getYearLabel = () => getYear() === 'all' ? 'Alle Jahre' : String(getYear());
    const yearTours = () => getYear() === 'all'
        ? getTours()
        : getTours().filter(e => dateYear(e) === getYear());
    const getSeasonHighlightForEntry = entry => {
        if (getYear() === 'all') return null;
        if (!entry || typeof window.buildWrappedSlideData !== 'function') return null;
        try {
            const slides = window.buildWrappedSlideData(getYear());
            const highlights = slides.find(slide => slide?.key === 'highlights')?.data?.highlights || [];
            return highlights.find(item => {
                const candidate = item?.entry;
                if (!candidate) return false;
                if (entry.id != null && candidate.id != null) {
                    return String(entry.id) === String(candidate.id);
                }
                return String(entry.date ?? '') === String(candidate.date ?? '') &&
                    String(entry.tourname ?? '') === String(candidate.tourname ?? '') &&
                    String(entry.region ?? '') === String(candidate.region ?? '') &&
                    String(entry.tourDay ?? '') === String(candidate.tourDay ?? '');
            }) || null;
        } catch (_) {
            return null;
        }
    };
    const ascentValue = e => readMetric(e?.aufstieg);
    const distanceValue = e => readMetric(e?.strecke);
    const minutesValue = e => parseMinutes(e?.zeit);
    const peaksValue = e => readMetric(e?.gipfel);
    const ascent = e => ascentValue(e) ?? 0;
    const distance = e => distanceValue(e) ?? 0;
    const minutes = e => minutesValue(e) ?? 0;
    const peaks = e => peaksValue(e) ?? 0;
    const tourIdentity = (entry, index = 0) => typeof window.__tourDataRules?.tourIdentity === 'function'
        ? window.__tourDataRules.tourIdentity(entry, index)
        : (() => {
            if (entry?.tourGroup !== undefined && entry?.tourGroup !== null && String(entry.tourGroup).trim()) return 'group:' + String(entry.tourGroup);
            if (entry?.id !== undefined && entry?.id !== null && String(entry.id).trim()) return 'id:' + String(entry.id);
            const fingerprint = [entry?.date, entry?.tourname, entry?.region, entry?.tourDay].map(v => String(v ?? '').trim()).join('|');
            return fingerprint.replace(/\|/g, '') ? 'entry:' + fingerprint : 'entry-index:' + index;
        })();
    const uniqueTourCount = entries => typeof window.__tourDataRules?.countDistinctTours === 'function'
        ? window.__tourDataRules.countDistinctTours(entries)
        : new Set(entries.map((entry, index) => tourIdentity(entry, index))).size;
    const sum = (entries, getter) => entries.reduce((acc, e) => acc + getter(e), 0);
    const sumKnown = (entries, getter) => {
        const values = entries.map(getter).filter(value => value !== null && value !== undefined && Number.isFinite(value));
        return values.length ? values.reduce((acc, value) => acc + value, 0) : null;
    };
    const maxKnown = (entries, getter) => {
        const values = entries.map(getter).filter(value => value !== null && value !== undefined && Number.isFinite(value));
        return values.length ? Math.max(...values) : null;
    };
    const fmtKnown = (value, digits = 0) => value === null || value === undefined || !Number.isFinite(value) ? '–' : fmt(value, digits);
    const statCard = (label, value, unit, progress = null) => `
        <article class="bergwelt-card">
            <div class="bergwelt-card-label">${label}</div>
            <div class="bergwelt-value">${value}<span class="bergwelt-unit">${unit}</span></div>
            ${progress === null ? '' : '<div class="bergwelt-track"><span style="width:' + Math.max(0, Math.min(100, progress)) + '%"></span></div>'}
        </article>`;
    const intro = (eyebrow, heading, copy) => `
        <header class="bergwelt-intro">
            ${eyebrow ? '<p class="bergwelt-eyebrow">' + eyebrow + '</p>' : ''}
            <h2 class="bergwelt-heading">${heading}</h2>
            ${copy ? '<p class="bergwelt-copy">' + copy + '</p>' : ''}
        </header>`;
    const empty = text => '<div class="bergwelt-empty">' + text + '</div>';
    // Verbindet den Jahresrückblick mit der Expedition zu einem klaren Erlebnisablauf.
    const experienceStoryRail = (chapter = 'expedition') => {
        const finale = chapter === 'finale';
        const expeditionClass = finale ? ' is-complete' : ' is-current';
        return '<nav class="bergwelt-story-rail' + (finale ? ' is-finale' : '') + '" aria-label="Dein Saisonerlebnis">' +
            '<button type="button" class="bergwelt-story-step is-complete" data-bergwelt-back-to-moments><span>01</span><strong>Momente</strong></button>' +
            '<span class="bergwelt-story-connector is-active" aria-hidden="true"></span>' +
            '<span class="bergwelt-story-step' + expeditionClass + '"' + (finale ? '' : ' aria-current="step"') + '><span>02</span><strong>Expedition</strong></span>' +
            '<span class="bergwelt-story-connector' + (finale ? ' is-active' : '') + '" aria-hidden="true"></span>' +
            '<span class="bergwelt-story-step' + (finale ? ' is-current' : '') + '"' + (finale ? ' aria-current="step"' : '') + '><span>03</span><strong>Gipfelmoment</strong></span>' +
        '</nav>';
    };

    function renderMomente() {
        panel.hidden = true;
        tourbookPanel.hidden = true;
        root.classList.remove('bergwelt-mode');
    }
    function renderTourbuch() {
        panel.hidden = true;
        tourbookPanel.hidden = false;
        root.classList.add('bergwelt-mode');
    }
    function renderHoehenwelt(openModal = false) {
        const selectedYear = getYear();
        const yearEntries = yearTours();
        const allEntries = getTours();
        const yearAscent = sumKnown(yearEntries, ascentValue);
        const careerAscent = sumKnown(allEntries, ascentValue);
        const yearShare = yearAscent === null || careerAscent === null || careerAscent <= 0
            ? null
            : Math.max(0, Math.min(100, yearAscent / careerAscent * 100));
        const yearLabel = selectedYear === 'all' ? 'Alle Jahre' : String(selectedYear);
        const total = careerAscent ?? 0;
        // Karriere-Höhenmarken: bekannte Gipfelhöhen plus langfristige Lebenszeitziele.
        // Bei 30.000–50.000 hm/Jahr sind 250.000 und 500.000 hm echte Mehrjahresziele.
        const milestones = [
            { name: 'Großglockner', height: 3798 },
            { name: 'Everest', height: 8848 },
            { name: 'Drei Everest-Höhen', height: 26544 },
            { name: '250.000 Höhenmeter', height: 250000 },
            { name: '500.000 Höhenmeter', height: 500000 }
        ];
        // Höhenwelt-Illustrationen mit eigenen Motiven, klar getrennt von Level.
        // Detailreichere Höhenwelt-SVGs: jeweils ein eigenes, vollfarbiges Motiv
        // auf einer weißen Kachel. Die Level-Spezialisierungen bleiben unverändert.
        const heightIcons = [
            // 1 · Großglockner: grauer Felsaufbau, Schneekappe, sichtbares Gipfelkreuz.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><defs><linearGradient id="hwGrossRock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#aeb8c0"/><stop offset="1" stop-color="#626f79"/></linearGradient><linearGradient id="hwGrossFront" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#87949d"/><stop offset="1" stop-color="#46535c"/></linearGradient></defs><rect width="64" height="64" rx="13" fill="#fff"/><circle cx="48" cy="16" r="6" fill="#fff5d3"/><path d="M5.5 51.5 16.4 37l5.2 3.6L35 15.8l6.7 11 4.4-5.2 12.5 30Z" fill="url(#hwGrossRock)" stroke="#495761" stroke-width="1.5" stroke-linejoin="round"/><path d="m28.4 27.4 6.7-11.6 6.6 10.9-5.2-2.7-2.9 3.4-2.2-1.8Z" fill="#f9fcff" stroke="#596772" stroke-width="1.1" stroke-linejoin="round"/><path d="m5.5 51.5 11-14.4 5.1 3.5L35 15.8l-1.1 20.5-7.2 15.2Z" fill="#aeb8c0" opacity=".74"/><path d="m19.8 51.5 5.5-11.1 5.2 4.6 4.5-8.7 5.3 4.9 5.7-7.4 11.8 19.1Z" fill="url(#hwGrossFront)" stroke="#46535c" stroke-width="1.2" stroke-linejoin="round"/><path d="m26.8 44 4.4 1-1.7 6.5m9.1-9.5 4.2 2.1-1.1 5.7m4.3-10.3 3.3 1.8" fill="none" stroke="#c6ced3" stroke-width="1.1" stroke-linecap="round"/><path d="M35.1 5.5v13.7m-4.5-9.5h9" fill="none" stroke="#bf8b2c" stroke-width="2.1" stroke-linecap="round"/><path d="M35.1 5.5v13.7" stroke="#f4cc61" stroke-width=".9" stroke-linecap="round"/><circle cx="35.1" cy="5.5" r="1.7" fill="#f7d46c" stroke="#a87522" stroke-width=".8"/><path d="M9 55h46" stroke="#d5dce0" stroke-width="1.2" stroke-linecap="round"/></svg>',
            // 2 · Everest: blauer Eisgipfel, Gletscherstaffelung und rote Gipfelflagge.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><defs><linearGradient id="hwEverestIce" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#effaff"/><stop offset="1" stop-color="#a8d2ed"/></linearGradient><linearGradient id="hwEverestBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9e6f7"/><stop offset="1" stop-color="#7db3d7"/></linearGradient></defs><rect width="64" height="64" rx="13" fill="#fff"/><circle cx="15" cy="15" r="5" fill="#fff5dc"/><path d="M5.5 51.5 15.7 37l6.1 4.5L38.1 13.6l7.4 14.1 4.2-4.2 9.2 28Z" fill="url(#hwEverestIce)" stroke="#477ca2" stroke-width="1.5" stroke-linejoin="round"/><path d="m29.4 27.1 8.7-13.5 7.4 14.1-6.2-4.2-3 3.1-2.7-1.7-2.1 2.2Z" fill="#fff" stroke="#477ca2" stroke-width="1.1" stroke-linejoin="round"/><path d="m5.5 51.5 10.2-14.4 6.1 4.4L38.1 13.6l-3.1 22.5-8.7 15.4Z" fill="#b5d9f0" opacity=".9"/><path d="m13 43.6 8.8 2.5 5-6.4 5.6 8.2 6.1-5.4 6.6 4.6 4.9-2.6 8.7 7H5.5Z" fill="url(#hwEverestBase)" stroke="#477ca2" stroke-width="1.25" stroke-linejoin="round"/><path d="m27 47.8 5.4-2.4 3.7 4.1 5.2-2.2m-21.5 1.4 2.4-1.4" fill="none" stroke="#f8fdff" stroke-width="1.25" stroke-linecap="round"/><path d="M38.2 13.8V5.5" fill="none" stroke="#4f6e87" stroke-width="1.4" stroke-linecap="round"/><path d="M38.5 5.9h12.1l-4.2 4.1 4.2 4.1H38.5Z" fill="#e66b57" stroke="#a9483c" stroke-width="1.1" stroke-linejoin="round"/><path d="M9 55h46" stroke="#c3ddea" stroke-width="1.2" stroke-linecap="round"/></svg>',
            // 3 · Drei Everest-Höhen: drei gestaffelte Bergsilhouetten und gut lesbare 3×-Marke.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><defs><linearGradient id="hwTripleBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d1e4c9"/><stop offset="1" stop-color="#93b99c"/></linearGradient><linearGradient id="hwTripleFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#91c3dc"/><stop offset="1" stop-color="#5c93b4"/></linearGradient></defs><rect width="64" height="64" rx="13" fill="#fff"/><circle cx="48" cy="15" r="5" fill="#fff2c9"/><path d="M5 49.5 14.3 35l5.7 5 7.2-10.2 10.2 19.7Z" fill="url(#hwTripleBack)" stroke="#608667" stroke-width="1.3" stroke-linejoin="round"/><path d="m25.5 49.5 10.1-16 5.1 5.5 8.2-15.8L59 49.5Z" fill="url(#hwTripleFront)" stroke="#477e9d" stroke-width="1.45" stroke-linejoin="round"/><path d="m14.3 35 5.7 5-4.4-1.1-2.2 2.6-1.5-1.9Zm21.2-1.5 5.2 5.5-4.7-2.1-2.3 2-2-1.5Zm13.4-10.3 8.7 15.1-7.4-5-3.1 2.1-2.2-2.8Z" fill="#fff" stroke="#477e9d" stroke-width="1.05" stroke-linejoin="round"/><path d="M7 51.5h50" stroke="#7ca98a" stroke-width="1.2" stroke-linecap="round"/><circle cx="15.5" cy="16.7" r="9.8" fill="#f6d36d" stroke="#b98c36" stroke-width="1.2"/><circle cx="15.5" cy="16.7" r="7.2" fill="#ffedab" stroke="#d0a13d" stroke-width=".9"/><text x="15.5" y="20.1" font-family="Arial,sans-serif" font-size="9.5" font-weight="800" text-anchor="middle" fill="#4b422b">3×</text><path d="M25.8 16.7h9.8" stroke="#b98c36" stroke-width="1.35" stroke-dasharray="2 2" stroke-linecap="round"/></svg>',
            // 4 · 250.000 hm: grüne Höhenlinien wie auf einer topografischen Karte plus Standortmarker.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><defs><linearGradient id="hwTopoField" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#d4e9cf"/><stop offset="1" stop-color="#a0c99d"/></linearGradient></defs><rect width="64" height="64" rx="13" fill="#fff"/><path d="M8 50V43c5-5 11-8 17-6 5 2 8 7 14 4 7-4 10-9 17-6v15Z" fill="url(#hwTopoField)" stroke="#4d8a5e" stroke-width="1.25" stroke-linejoin="round"/><path d="M8.5 42c6.5-6.9 13.6-10.6 20.4-6.3 5.9 3.8 9.6 4.1 15.5-.6 4.4-3.5 8-5.1 11.8-3.8M12.5 35.2c5.7-6.1 11.9-8.8 17.4-5.1 5.1 3.4 9 3.4 13.9-.7 3.3-2.7 6.1-3.8 9.5-3.1M18.2 28.4c4.7-4.3 8.9-6 12.8-3.5 3.9 2.4 6.4 2.5 10.6-.4M24.2 21.9c3.2-2.5 5.7-3.3 8.5-2" fill="none" stroke="#3d8054" stroke-width="1.55" stroke-linecap="round"/><path d="M33 7.5c-5.6 0-9.1 4.2-9.1 9.1 0 6.2 9.1 14.4 9.1 14.4s9.1-8.2 9.1-14.4c0-4.9-3.5-9.1-9.1-9.1Z" fill="#f0c65b" stroke="#a87a2d" stroke-width="1.4"/><circle cx="33" cy="16.3" r="3.1" fill="#fff8d9" stroke="#a87a2d" stroke-width="1.1"/><path d="M10 54h44" stroke="#b9d5b4" stroke-width="1.2" stroke-linecap="round"/></svg>',
            // 5 · 500.000 hm: hochwertige goldene Medaille mit zwei Bändern, Bergrelief und Sternen.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><defs><linearGradient id="hwMedalGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a7"/><stop offset=".47" stop-color="#edbe4b"/><stop offset="1" stop-color="#b67b24"/></linearGradient><linearGradient id="hwMedalFace" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#fff4c5"/><stop offset="1" stop-color="#f0cf70"/></linearGradient></defs><rect width="64" height="64" rx="13" fill="#fff"/><path d="M20 5.5h9.5l4 14.8-8.5 3.1Z" fill="#df7058" stroke="#a74b38" stroke-width="1.25" stroke-linejoin="round"/><path d="M35 20.3 39 5.5h9.2l-5.8 18.1Z" fill="#6f9fc8" stroke="#426e99" stroke-width="1.25" stroke-linejoin="round"/><path d="m22.8 17.9 4.1 4.9 4.2-1.5 1.9 3.5-7.8 2.7Z" fill="#f4a18b" opacity=".75"/><circle cx="32.2" cy="40" r="19.1" fill="url(#hwMedalGold)" stroke="#9f6d20" stroke-width="1.8"/><circle cx="32.2" cy="40" r="15.1" fill="url(#hwMedalFace)" stroke="#c28d2e" stroke-width="1.2"/><circle cx="32.2" cy="40" r="12.1" fill="none" stroke="#d6a23d" stroke-width=".9"/><path d="m17.8 44.9 7.7-10.6 4.8 4.6 5.9-8.5 10.9 14.5Z" fill="#8eacb9" stroke="#4d6b77" stroke-width="1.25" stroke-linejoin="round"/><path d="m25.5 34.3 4.8 4.6-4-.6-1.7 2-1.1-1.7Zm10.7-3.9 10.9 14.5-7.2-5.1-3 1.9-2.7-3.2Z" fill="#f9fcff" stroke="#4d6b77" stroke-width="1" stroke-linejoin="round"/><path d="m16.5 21.6 1.6 3.4 3.7.3-2.8 2.4.8 3.5-3.3-1.9-3.2 1.9.7-3.5-2.7-2.4 3.7-.3Z M49.7 18.9l1.1 2.3 2.5.2-1.9 1.6.5 2.4-2.2-1.3-2.2 1.3.5-2.4-1.9-1.6 2.5-.2Z" fill="#f3ce61" stroke="#a97924" stroke-width=".8" stroke-linejoin="round"/><path d="M20.5 56.5h23" stroke="#d4a13a" stroke-width="1.3" stroke-linecap="round"/></svg>'
        ];
        const selectedMilestone = milestones.find(m => m.height === selectedHeightMilestone) || null;
        const milestoneMoment = selectedMilestone ? (() => {
            const reached = careerAscent !== null && total >= selectedMilestone.height;
            const remaining = careerAscent === null ? null : Math.max(0, selectedMilestone.height - total);
            const targetProgress = careerAscent === null ? 0 : Math.max(0, Math.min(100, total / selectedMilestone.height * 100));
            return '<section class="bergwelt-height-moment ' + (reached ? 'is-achieved' : 'is-in-progress') + '">' +
                '<div class="bergwelt-height-moment-details">' +
                    '<div><span>DEIN AUFSTIEG</span><strong>' + fmtKnown(careerAscent) + '<small> hm</small></strong></div>' +
                    '<div><span>VERGLEICHSWERT</span><strong>' + fmt(selectedMilestone.height) + '<small> ' + (selectedMilestone.height <= 26544 ? 'm' : 'hm') + '</small></strong></div>' +
                    '<div><span>' + (reached ? 'DARÜBER' : 'NOCH OFFEN') + '</span><strong>' + (careerAscent === null ? '–' : reached ? '+' + fmt(total - selectedMilestone.height) : fmt(remaining)) + '<small> hm</small></strong></div>' +
                '</div>' +
                '<div class="bergwelt-height-moment-footer"><div class="bergwelt-height-gauge" style="--moment-progress:' + targetProgress + '%"><span>' + (careerAscent === null ? '–' : reached ? '✓' : fmt(targetProgress, 0) + '%') + '</span></div></div>' +
            '</section>';
        })() : '';
        panel.innerHTML = intro('', 'Höhenwelt', '') +
            '<section class="bergwelt-height-year-contribution" aria-label="Beitrag ' + escapeHTML(yearLabel) + ' zur Lebenszeit-Aufstiegssumme">' +
                '<div class="bergwelt-height-year-contribution-head">' +
                    '<div class="bergwelt-height-year-contribution-value"><span>' + (selectedYear === 'all' ? 'GESAMTER ZEITRAUM' : 'BEITRAG ' + selectedYear) + '</span><strong>' + fmtKnown(yearAscent) + '<small> hm</small></strong></div>' +
                    '<div class="bergwelt-height-year-contribution-share"><strong>' + (yearShare === null ? '–' : fmt(yearShare, 1) + ' %') + '</strong><span>der Lebenszeit-Aufstiegssumme</span></div>' +
                '</div>' +
                '<div class="bergwelt-height-year-contribution-track" role="progressbar" aria-label="Anteil des gewählten Zeitraums am Lebenszeit-Aufstieg" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (yearShare === null ? 0 : Math.round(yearShare)) + '"><span style="width:' + (yearShare === null ? 0 : yearShare) + '%"></span></div>' +
            '</section>' +
            (selectedYear === 'all' ? '' :
                '<section class="bergwelt-height-year-donut-section" aria-label="Anteil des Jahres ' + escapeHTML(yearLabel) + ' an deiner gesamten Aufstiegssumme">' +
                    '<div class="bergwelt-height-year-donut" role="img" aria-label="' + escapeHTML(yearLabel + ': ' + (yearShare === null ? 'Anteil nicht verfügbar' : fmt(yearShare, 1) + ' Prozent der gesamten Aufstiegssumme')) + '" style="--height-year-share:' + (yearShare === null ? 0 : yearShare) + '%">' +
                        '<div class="bergwelt-height-year-donut-hole"><strong>' + (yearShare === null ? '–' : fmt(yearShare, 1) + '<small>%</small>') + '</strong><span>im Jahr ' + escapeHTML(yearLabel) + '</span></div>' +
                    '</div>' +
                    '<div class="bergwelt-height-year-donut-legend">' +
                        '<div class="bergwelt-height-year-donut-legend-item"><span class="bergwelt-height-year-donut-dot is-selected-year"></span><div><strong>' + escapeHTML(yearLabel) + ' · ' + fmtKnown(yearAscent) + ' hm</strong><small>Aufstieg im gewählten Jahr</small></div></div>' +
                        '<div class="bergwelt-height-year-donut-legend-item"><span class="bergwelt-height-year-donut-dot"></span><div><strong>Übrige Tourhistorie</strong><small>' + (yearAscent === null || careerAscent === null ? 'Anteil nicht bestimmbar' : fmt(Math.max(0, careerAscent - yearAscent)) + ' hm') + '</small></div></div>' +
                    '</div>' +
                '</section>'
            ) +
            '<div class="bergwelt-height-milestones" aria-label="Interaktive Höhenmarken">' +
            milestones.map((m, i) => {
                const reached = careerAscent !== null && total >= m.height;
                const remaining = careerAscent === null ? null : Math.max(0, m.height - total);
                const targetProgress = careerAscent === null ? 0 : Math.max(0, Math.min(100, total / m.height * 100));
                const active = selectedHeightMilestone === m.height;
                return '<button type="button" class="bergwelt-height-milestone' + (reached ? ' is-reached' : '') + (active ? ' is-selected' : '') + '" data-bergwelt-height-milestone="' + m.height + '" aria-pressed="' + active + '" aria-haspopup="dialog" aria-controls="bergwelt-height-detail-modal">' +
                    '<span class="bergwelt-height-milestone-mark' + (reached ? ' is-reached' : '') + '" aria-hidden="true">' + heightIcons[i] + '</span>' +
                    '<span class="bergwelt-height-milestone-copy"><strong>' + escapeHTML(m.name) + '</strong><small>' + (reached ? 'Vergleichsmarke erreicht' : careerAscent === null ? 'Keine Aufstiegsdaten' : fmt(remaining) + ' hm bis zur Marke') + '</small></span>' +
                    '<span class="bergwelt-height-milestone-value"><strong>' + fmt(m.height) + '</strong><small>' + (m.height <= 26544 ? 'm' : 'hm') + '</small></span>' +
                    '<span class="bergwelt-height-milestone-bar" aria-hidden="true"><span style="width:' + targetProgress + '%"></span></span>' +
                    '<span class="bergwelt-height-milestone-chevron" aria-hidden="true">' + (active ? '⌃' : '›') + '</span>' +
                '</button>';
            }).join('') +
            '</div>';

        const staleHeightModal = document.getElementById('bergwelt-height-detail-modal');
        if (staleHeightModal) staleHeightModal.remove();
        if (openModal && selectedMilestone) {
            const modal = document.createElement('div');
            modal.id = 'bergwelt-height-detail-modal';
            modal.className = 'modal hidden';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-hidden', 'true');
            modal.setAttribute('aria-labelledby', 'bergwelt-height-detail-title');
            modal.innerHTML =
                '<div class="modal-backdrop" data-height-detail-close="backdrop"></div>' +
                '<div class="modal-card">' +
                    '<div class="modal-header">' +
                        '<div class="modal-title" id="bergwelt-height-detail-title">' + escapeHTML(selectedMilestone.name) + '</div>' +
                        '<button type="button" class="toggle-btn" data-height-detail-close="button" aria-label="Höhenmarke schließen">✕</button>' +
                    '</div>' +
                    '<div class="modal-body bergwelt-height-detail-body">' + milestoneMoment + '</div>' +
                '</div>';
            document.body.appendChild(modal);
            const trigger = panel.querySelector('[data-bergwelt-height-milestone="' + selectedMilestone.height + '"]');
            const closeHeightModal = () => {
                const card = modal.querySelector('.modal-card');
                const backdrop = modal.querySelector('.modal-backdrop');
                card?.classList.remove('is-dragging', 'is-closing');
                if (card) {
                    card.style.transform = '';
                    card.style.touchAction = '';
                }
                if (backdrop) backdrop.style.opacity = '';
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
                selectedHeightMilestone = null;
                panel.querySelectorAll('[data-bergwelt-height-milestone]').forEach(button => {
                    button.classList.remove('is-selected');
                    button.setAttribute('aria-pressed', 'false');
                });
                if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open');
                if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
            };
            if (typeof window.__tourAttachModalSwipeDown === 'function') {
                window.__tourAttachModalSwipeDown(modal, closeHeightModal);
            }
            modal.addEventListener('click', event => {
                if (event.target === modal.querySelector('[data-height-detail-close="backdrop"]') ||
                    event.target.closest('[data-height-detail-close="button"]')) closeHeightModal();
            });
            modal.addEventListener('keydown', event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeHeightModal();
                }
            });
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            modal.querySelector('[data-height-detail-close="button"]')?.focus({ preventScroll: true });
        }
    }
    function renderLevel() {
        const entries = yearTours();
        const asc = sumKnown(entries, ascentValue);
        const mins = sumKnown(entries, minutesValue);
        const peakCount = sumKnown(entries, peaksValue);

        // Exakt die hm/h-Logik der Stats/Highlights:
        // Aufstieg geteilt durch die zur Rundtour-Option passende Zeit.
        const ascentRateValue = entry => {
            const ascent = ascentValue(entry);
            const durationMinutes = minutesValue(entry);
            if (ascent === null || durationMinutes === null || durationMinutes <= 0) return null;
            const hours = durationMinutes / 60;
            const adjustedHours = entry.useFullDistanceForGradient ? hours : hours / 2;
            return adjustedHours > 0 ? ascent / adjustedHours : null;
        };
        const validAscentRates = entries
            .map(ascentRateValue)
            .filter(value => value !== null && Number.isFinite(value));
        const maxAscentRate = validAscentRates.length ? Math.max(...validAscentRates) : null;

        // Rangtouren werden chronologisch zugeordnet, damit jede erreichte Stufe
        // auf die Tour verweist, mit der sie erstmals freigeschaltet wurde.
        const chronologicalEntries = entries.map((entry, index) => ({ entry, index }))
            .sort((a, b) => {
                const dateA = parseTourDate(a.entry.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                const dateB = parseTourDate(b.entry.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                return dateA - dateB ||
                    (Number(a.entry.tourDay || 0) - Number(b.entry.tourDay || 0)) ||
                    (a.index - b.index);
            })
            .map(item => item.entry);
        const cumulativeTourFor = (getter, threshold) => {
            let total = 0;
            for (const entry of chronologicalEntries) {
                const value = getter(entry);
                if (value === null || value === undefined || !Number.isFinite(value)) continue;
                total += value;
                if (total >= threshold) return entry;
            }
            return null;
        };
        const steepTourFor = threshold => chronologicalEntries.find(entry => {
            const value = ascentRateValue(entry);
            return value !== null && Number.isFinite(value) && value >= threshold;
        }) || null;
        const activityTourFor = threshold => {
            const seenTypes = new Set();
            for (const entry of chronologicalEntries) {
                const type = String(entry.difficulty || '').trim().toLocaleLowerCase();
                if (type && type !== 'mehrtägig') seenTypes.add(type);
                if (seenTypes.size >= threshold) return entry;
            }
            return null;
        };

        // "difficulty" ist das tatsächliche Feld für die gespeicherte Tourart.
        // "Mehrtägig" beschreibt die Tourstruktur, keinen eigenen Aktivitätstyp.
        const activityTypes = new Set(entries
            .map(e => String(e.difficulty || '').trim().toLocaleLowerCase())
            .filter(type => type && type !== 'mehrtägig'));
        const activityCount = activityTypes.size ? activityTypes.size : null;

        // Schwellen sind transparent definiert; es werden keine fehlenden Werte geschätzt.
        const definitions = [
            {
                name: 'Höhenmeter-Spezialist', value: asc, unit: 'hm',
                tiers: [[5000, 'Höhenmeter-Sammler'], [10000, 'Bergauf unterwegs'], [15000, 'Höhenmeter-Spezialist'], [25000, 'Höhenprofi'], [35000, 'Höhenlegende']],
                rankTourFor: threshold => cumulativeTourFor(ascentValue, threshold),
                detail: 'Kumulierte Aufstiegshöhen im ausgewählten Jahr.'
            },
            {
                name: 'Gipfelsammler', value: peakCount, unit: 'Gipfel',
                tiers: [[5, 'Gipfel entdeckt'], [10, 'Gipfelsammler'], [15, 'Gipfeljäger'], [25, 'Gipfelkenner'], [35, 'Gipfellegende']],
                rankTourFor: threshold => cumulativeTourFor(peaksValue, threshold),
                detail: 'Summe der gespeicherten Gipfelangaben im ausgewählten Jahr.'
            },
            {
                name: 'Ausdauer-Alpinist', value: mins === null ? null : mins / 60, unit: 'h',
                tiers: [[25, 'Ausdauer-Einsteiger'], [50, 'Ausdauerstark'], [100, 'Ausdauer-Alpinist'], [150, 'Langstrecken-Profi'], [200, 'Ausdauerlegende']],
                rankTourFor: threshold => cumulativeTourFor(minutesValue, threshold * 60),
                detail: 'Gespeicherte Gehzeit im ausgewählten Jahr.'
            },
            {
                name: 'Steilheits-Profi', value: maxAscentRate, unit: 'hm/h',
                tiers: [[300, 'Vertikal unterwegs'], [350, 'Starker Aufstieg'], [400, 'Aufstiegs-Profi'], [500, 'Vertikal-Elite'], [600, 'Vertikallegende']],
                rankTourFor: threshold => steepTourFor(threshold),
                detail: 'Höchster Aufstieg pro Stunde bei einer einzelnen Tour – dieselbe Zeit- und Rundtour-Logik wie in Stats/Highlights (standardmäßig halbe Gehzeit; bei aktivierter Option volle Gehzeit).'
            },
            {
                name: 'Vielseitiger Wanderer', value: activityCount, unit: 'Typen',
                tiers: [[1, 'Erster Stil'], [2, 'Abwechslungsreich'], [3, 'Vielseitiger Wanderer'], [4, 'Allrounder'], [5, 'Bergwelt-Allrounder']],
                rankTourFor: threshold => activityTourFor(threshold),
                detail: 'Unterschiedliche Aktivitätstypen, die in den Tourdaten tatsächlich gespeichert sind.'
            }
        ];
        const levels = definitions.map(def => {
            const achieved = def.value === null ? [] : def.tiers.filter(tier => def.value >= tier[0]);
            const current = achieved.length ? achieved[achieved.length - 1] : null;
            const next = def.value === null ? null : (def.tiers.find(tier => def.value < tier[0]) || null);
            const previousThreshold = current ? current[0] : 0;
            const pct = def.value === null ? null : next
                ? Math.max(0, Math.min(100, (def.value - previousThreshold) / (next[0] - previousThreshold) * 100))
                : 100;
            const rankTours = def.tiers.map(tier => typeof def.rankTourFor === 'function' ? def.rankTourFor(tier[0]) : null);
            const { rankTourFor, ...levelDefinition } = def;
            return { ...levelDefinition, current, next, pct, rankTours };
        });
        const earnedCount = levels.filter(level => level.current).length;
        // Die fünf Original-Abzeichen: farbige, eigenständige Illustrationen
        // auf weißem, abgerundetem Quadrat – identisch in Galerie und Entwicklung.
        // Fünf bewusst klare Illustrationen: jede Geometrie hat eine erkennbare Funktion.
        const badgeIcons = [
            // Höhenmeter-Spezialist: gestaffelte Bergflanken, echte Schneekappen und Höhenlinien.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><circle cx="36" cy="36" r="25" fill="#c3e7e8" stroke="#355c68" stroke-width="2"/><path d="M12 42 23 26 31 34 43 17 59 39 59 49 13 49Z" fill="#709eaa" stroke="#244e5d" stroke-width="1.6" stroke-linejoin="round"/><path d="m17.5 34 5.5-8 5.2 6.8-4.1-1.7-2.6 2.1-1.4-1.3ZM35.3 28.5 43 17l6.6 9.2-5.4-3.1-2.6 3.1-2.4-1.4Z" fill="#f8ffff" stroke="#355c68" stroke-width="1.1" stroke-linejoin="round"/><path d="M12.5 43.5 23.5 35 32 49 39 37 59.5 45V51c-13.2 10.2-32.1 10.2-47 0Z" fill="#2e6e83" stroke="#244e5d" stroke-width="1.4" stroke-linejoin="round"/><path d="M13 49.5 22 44l8.8 12.3 7.8-7.9 8.8 5.2 5-3.4 6.1 3.8c-13.8 7.9-31.5 8-45.5.2Z" fill="#9eb844" stroke="#345d35" stroke-width="1.4" stroke-linejoin="round"/><path d="m18.8 49 5.4 1.9m4.8 1.6 5.1-2.7m8.5-.1 4.4 2.2m-17.7 2.2 2.3 2.9m7.8-8.6-.8 6.7" fill="none" stroke="#e8df82" stroke-width="1.2" stroke-linecap="round"/></svg>',
            // Gipfelsammler: drei klar unterscheidbare Gipfel und eine Flagge am höchsten Punkt.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><path d="M9 50 22 34 30 43 39 29 52 50Z" fill="#e7f2ff" stroke="#668bb7" stroke-width="1.45" stroke-linejoin="round"/><path d="M24 50 42 23 61 50Z" fill="#c8e2fb" stroke="#668bb7" stroke-width="1.5" stroke-linejoin="round"/><path d="m38.7 28 3.3-5 4 6-3.5-1.6-1.8 1.8Z" fill="#fff" stroke="#668bb7" stroke-width="1.05" stroke-linejoin="round"/><path d="m16 41.5 6-7.5 4.6 5.2-4-1.4-2.1 2.3-1.7-1.2Z" fill="#fff" stroke="#668bb7" stroke-width="1" stroke-linejoin="round"/><path d="M42 23V11" stroke="#567ca8" stroke-width="1.6" stroke-linecap="round"/><path d="M42.3 11.5H55l-4.1 3.8 4.1 3.8H42.3Z" fill="#7da7d4" stroke="#567ca8" stroke-width="1.2" stroke-linejoin="round"/><path d="M11 50h51" stroke="#668bb7" stroke-width="1.4" stroke-linecap="round"/></svg>',
            // Ausdauer-Alpinist: sauberer Kompassring; Bergsilhouette oben, Richtungsnadel im eigenen Zifferblatt.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><circle cx="36" cy="36" r="25" fill="#f8fcf8" stroke="#215b3d" stroke-width="1.9"/><circle cx="36" cy="36" r="20.5" fill="none" stroke="#5b916b" stroke-width="1.2"/><path d="M36 12v4m0 40v4M12 36h4m40 0h4M19 19l2.8 2.8m28.4 28.4L53 53M53 19l-2.8 2.8M21.8 50.2 19 53" fill="none" stroke="#215b3d" stroke-width="1.35" stroke-linecap="round"/><path d="M17.5 31.5 25 21.5 29.5 27 34 19.5 41 30 45 24.5 54.5 34" fill="#b5d2b5" stroke="#286344" stroke-width="1.35" stroke-linejoin="round"/><path d="M23 34 28 29.5 33 34.5 37 29.5 42 35" fill="none" stroke="#286344" stroke-width="1.1" stroke-linecap="round"/><circle cx="36" cy="43" r="11.3" fill="#e5f1e7" stroke="#286344" stroke-width="1.5"/><circle cx="36" cy="43" r="7.5" fill="none" stroke="#679875" stroke-width="1" stroke-dasharray="1.8 1.8"/><path d="m37.5 33.4-7.2 12.2 7.1-2.2 4.8-9.1-4.7-.9Z" fill="#2b805b" stroke="#215b3d" stroke-width="1.1" stroke-linejoin="round"/><path d="m37.5 33.4-.1 10 4.8-9.1Z" fill="#c5dfeb"/><circle cx="36" cy="43" r="1.7" fill="#fff" stroke="#215b3d" stroke-width="1"/></svg>',
            // Steilheits-Profi: steile, kantige Felswand und getrennt lesbarer gelber Blitz.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><circle cx="36" cy="36" r="26" fill="#ffd43b"/><path d="M12 56 15.5 45 22 42.5 23.5 34 30 35.8 33.4 25.5 39.2 29.5 42 19.8 47 25 50.6 22.6 52.2 34.3 57.4 38.2 60 56Z" fill="#292c2d" stroke="#181a1c" stroke-width="1.7" stroke-linejoin="round"/><path d="m17.3 54 3.3-8.1 5.6 1.5 2.5-9.2 4-1.7 3-7.1-1.2 10.4-4.4 5.1-1.4 9.1Z" fill="#53595b" stroke="#181a1c" stroke-width="1.1" stroke-linejoin="round"/><path d="m43 25.4-8.3 14.1h5.6l-4.1 14 12.6-19.2h-6.4l2.8-8.9Z" fill="#ffdf4f" stroke="#242628" stroke-width="1.5" stroke-linejoin="round"/><path d="m48.8 33.6 3.3 3.6 1.2 9.8" fill="none" stroke="#9b9fa0" stroke-width="1.2" stroke-linecap="round"/></svg>',
            // Vielseitiger Wanderer: ein gerader Wegweiserpfosten, drei getrennte Pfeile in verschiedene Richtungen.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><path d="M33.6 12h5.5v53h-5.5Z" fill="#f5c442" stroke="#25292d" stroke-width="1.8" stroke-linejoin="round"/><path d="M32.2 11.8h8.3" stroke="#25292d" stroke-width="2.1" stroke-linecap="round"/><circle cx="36.4" cy="8.2" r="3.2" fill="#f5c442" stroke="#25292d" stroke-width="1.6"/><path d="M34 18H17.5L8.7 25.4l8.8 7.4H34Z" fill="#5e9de3" stroke="#25292d" stroke-width="1.8" stroke-linejoin="round"/><path d="M39.1 29.3h16.2l8.7 7.3-8.7 7.5H39.1Z" fill="#ef795f" stroke="#25292d" stroke-width="1.8" stroke-linejoin="round"/><path d="M34 40.5H17.5l-8.8 7.4 8.8 7.4H34Z" fill="#f2a34f" stroke="#25292d" stroke-width="1.8" stroke-linejoin="round"/><path d="M27.5 25.5h-8.1m-2.3 0 2.4-2.1m-2.4 2.1 2.4 2.1m27 11.1h8m2.5 0-2.5-2.1m2.5 2.1-2.5 2.1m-29.7 9.2h-5.8m-2.3 0 2.4-2.1m-2.4 2.1 2.4 2.1" fill="none" stroke="#fff" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        ];

        const levelDigits = level => level.name === 'Ausdauer-Alpinist' || level.name === 'Steilheits-Profi' ? 1 : 0;

        const renderDevelopmentCard = (l, i) => {
            const currentIndex = l.current ? l.tiers.indexOf(l.current) : -1;
            const valueText = l.value === null ? '– ' + l.unit : fmt(l.value, levelDigits(l)) + ' ' + l.unit;
            const tierText = l.value === null ? 'Noch nicht bestimmbar' : l.current ? l.current[1] : 'Dein erster Rang wartet';
            const goalText = l.value === null
                ? 'Es fehlen gültige Daten für diese Spezialisierung.'
                : l.next
                    ? fmt(Math.max(0, l.next[0] - l.value), levelDigits(l)) + ' ' + l.unit + ' bis ' + l.next[1] + ' (' + fmt(l.next[0], levelDigits(l)) + ' ' + l.unit + ')'
                    : 'Alle fünf Rangstufen sind erreicht. Weitere Fortschritte werden weiterhin gezählt.';
            const nextIndex = l.next ? l.tiers.indexOf(l.next) : -1;
            const rankRows = l.tiers.map((tier, index) => {
                const reached = index <= currentIndex;
                const isNext = index === nextIndex;
                const rankTour = l.rankTours?.[index];
                const rankTourName = rankTour ? String(rankTour.tourname || rankTour.name || 'Tour ohne Titel').trim() : '';
                const parsedRankTourDate = rankTour ? parseTourDate(rankTour.date) : null;
                const rankTourDate = rankTour ? (parsedRankTourDate ? parsedRankTourDate.toLocaleDateString('de-AT') : String(rankTour.date || '').trim()) : '';
                const rankTourLabel = [rankTourName, rankTourDate].filter(Boolean).join(' · ');
                const tourButton = rankTour
                    ? '<button type="button" class="bergwelt-level-modal-rank-tour" data-level-tour-index="' + i + '" data-level-tier-index="' + index + '" aria-label="Tour ansehen: ' + escapeHTML(rankTourLabel) + '"><span>⛰ ' + escapeHTML(rankTourLabel) + '</span><span>Details ansehen ↗</span></button>'
                    : '';
                return '<li class="bergwelt-level-modal-rank-row' + (reached ? ' is-reached' : '') + (isNext ? ' is-next' : '') + '">' +
                    '<span class="bergwelt-level-modal-rank-number">' + (index + 1) + '</span>' +
                    '<span class="bergwelt-level-modal-rank-copy"><strong>' + escapeHTML(tier[1]) + '</strong><small>' + fmt(tier[0], levelDigits(l)) + ' ' + escapeHTML(l.unit) + '</small>' + tourButton + '</span>' +
                    '<span class="bergwelt-level-modal-rank-status">' + (reached ? 'Erreicht' : isNext ? 'Als Nächstes' : 'Offen') + '</span>' +
                '</li>';
            }).join('');
            return '<section class="bergwelt-level-modal-detail">' +
                '<div class="bergwelt-level-modal-hero"><div class="bergwelt-level-modal-icon" aria-hidden="true">' + badgeIcons[i] + '</div>' +
                    '<div class="bergwelt-level-modal-hero-copy"><span class="bergwelt-level-modal-kicker">SPEZIALISIERUNG</span><h3>' + escapeHTML(l.name) + '</h3><p>' + escapeHTML(tierText) + '</p></div></div>' +
                '<div class="bergwelt-level-modal-metrics">' +
                    '<div class="bergwelt-level-modal-metric"><span>Dein Wert</span><strong>' + valueText + '</strong></div>' +
                    '<div class="bergwelt-level-modal-metric"><span>Aktueller Rang</span><strong>' + (currentIndex >= 0 ? (currentIndex + 1) + ' von 5' : 'Noch offen') + '</strong></div>' +
                '</div>' +
                '<section class="bergwelt-level-modal-progress">' +
                    '<div class="bergwelt-level-modal-progress-head"><div><span>' + (l.next ? 'NÄCHSTER RANG' : l.value === null ? 'FORTSCHRITT' : 'RANGZIEL') + '</span><strong>' + escapeHTML(l.next ? l.next[1] : l.value === null ? 'Noch nicht bestimmbar' : 'Alle Rangstufen erreicht') + '</strong></div><b>' + (l.pct === null ? '–' : fmt(l.pct) + ' %') + '</b></div>' +
                    '<div class="bergwelt-level-modal-progress-track" role="progressbar" aria-label="Fortschritt für ' + escapeHTML(l.name) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + (l.pct === null ? 0 : Math.round(l.pct)) + '"><span style="width:' + (l.pct === null ? 0 : l.pct) + '%"></span></div>' +
                    '<p>' + escapeHTML(goalText) + '</p>' +
                '</section>' +
                '<section class="bergwelt-level-modal-ranks"><h4>Rangstufen</h4><ol>' + rankRows + '</ol></section>' +
            '</section>';
        };
        const developmentCards = levels.map(renderDevelopmentCard);

        panel.innerHTML = intro('Deine Erfolge · ' + getYearLabel(), 'Dein Bergsteiger-Level', '') +
            '<div class="bergwelt-level-badges">' +
            levels.map((l, i) => {
                const valueText = l.value === null ? '– ' + l.unit : fmt(l.value, levelDigits(l)) + ' ' + l.unit;
                const unlocked = Boolean(l.current);
                const badgeTitle = unlocked ? l.current[1] : l.next ? l.next[1] : 'Daten fehlen';
                const badgeStatus = unlocked
                    ? (l.next ? 'Nächster Rang: ' + l.next[1] : 'Höchster Rang erreicht')
                    : l.value === null ? 'Wartet auf Daten' : l.next ? 'Noch zu verdienen' : 'Noch kein Rang';
                return '<button type="button" class="bergwelt-level-badge' + (unlocked ? ' is-unlocked' : ' is-locked') + '" data-level-detail-index="' + i + '" aria-haspopup="dialog" aria-label="Entwicklung anzeigen: ' + escapeHTML(l.name) + '">' +
                    '<span class="bergwelt-level-badge-emblem" aria-hidden="true"><span class="bergwelt-badge-art">' + badgeIcons[i] + '</span></span>' +
                    '<span class="bergwelt-level-badge-body"><span class="bergwelt-level-badge-name">' + escapeHTML(l.name) + '</span><strong>' + escapeHTML(badgeTitle) + '</strong><small>' + escapeHTML(badgeStatus) + '</small>' +
                    (unlocked ? '<span class="bergwelt-level-badge-value">' + valueText + '</span>' : l.value === null ? '<span class="bergwelt-level-badge-value">Keine gültigen Werte</span>' : '<span class="bergwelt-level-badge-value">' + fmt(Math.max(0, l.next[0] - l.value), levelDigits(l)) + ' ' + l.unit + ' bis zum Rang</span>') +
                    '</span></button>';
            }).join('') +
            '</div>';

        const oldLevelModal = document.getElementById('bergwelt-level-detail-modal');
        if (oldLevelModal) oldLevelModal.remove();
        const modal = document.createElement('div');
        modal.id = 'bergwelt-level-detail-modal';
        modal.className = 'modal hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'true');
        modal.setAttribute('aria-labelledby', 'bergwelt-level-detail-title');
        modal.innerHTML =
            '<div class="modal-backdrop" data-level-detail-close="backdrop"></div>' +
            '<div class="modal-card">' +
                '<div class="modal-header">' +
                    '<div class="modal-title" id="bergwelt-level-detail-title">Deine Entwicklung</div>' +
                    '<button type="button" class="toggle-btn" data-level-detail-close="button" aria-label="Details schließen">✕</button>' +
                '</div>' +
                '<div class="modal-body bergwelt-level-detail-body"></div>' +
            '</div>';
        document.body.appendChild(modal);
        if (typeof window.__tourAttachModalSwipeDown === 'function') {
            window.__tourAttachModalSwipeDown(modal, () => closeLevelModal());
        }
        const modalBody = modal.querySelector('.bergwelt-level-detail-body');
        let lastTrigger = null;
        const closeLevelModal = (preserveForReturn = false) => {
            if (modal.classList.contains('hidden')) return;
            const card = modal.querySelector('.modal-card');
            const backdrop = modal.querySelector('.modal-backdrop');
            card?.classList.remove('is-dragging', 'is-closing');
            if (card) {
                card.style.transform = '';
                card.style.touchAction = '';
            }
            if (backdrop) backdrop.style.opacity = '';
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', preserveForReturn ? 'false' : 'true');
            if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open');
            if (!preserveForReturn && lastTrigger && lastTrigger.isConnected) lastTrigger.focus({ preventScroll: true });
        };
        const openLevelModal = (index, trigger) => {
            const level = levels[Number(index)];
            const detail = developmentCards[Number(index)];
            if (!detail || !level) return;
            lastTrigger = trigger;
            modal.querySelector('#bergwelt-level-detail-title').textContent = 'Deine Entwicklung';
            modalBody.innerHTML = detail;
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            modal.querySelector('[data-level-detail-close="button"]')?.focus({ preventScroll: true });
        };
        panel.querySelectorAll('[data-level-detail-index]').forEach(card => {
            card.addEventListener('click', () => openLevelModal(card.dataset.levelDetailIndex, card));
        });
        modal.addEventListener('click', event => {
            const tourButton = event.target.closest('[data-level-tour-index][data-level-tier-index]');
            if (tourButton) {
                const selectedLevel = levels[Number(tourButton.dataset.levelTourIndex)];
                const selectedTour = selectedLevel?.rankTours?.[Number(tourButton.dataset.levelTierIndex)];
                if (!selectedTour) return;
                closeLevelModal(true);
                if (typeof window.openTourDetail === 'function') {
                    window.openTourDetail(selectedTour, { returnModalId: 'bergwelt-level-detail-modal' });
                } else {
                    modal.classList.remove('hidden');
                    modal.setAttribute('aria-hidden', 'false');
                    document.body.classList.add('modal-open');
                }
                return;
            }
            if (event.target === modal.querySelector('[data-level-detail-close="backdrop"]') ||
                event.target.closest('[data-level-detail-close="button"]')) closeLevelModal();
        });
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeLevelModal();
            }
        });
    }
        function render() {
        const staleLevelModal = document.getElementById('bergwelt-level-detail-modal');
        const staleHeightModal = document.getElementById('bergwelt-height-detail-modal');
        if (staleLevelModal) staleLevelModal.remove();
        if (staleHeightModal) staleHeightModal.remove();
        if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open');
        if (activeTab === 'erlebnis') return renderMomente();
        root.classList.add('bergwelt-mode');
        tourbookPanel.hidden = true;
        panel.hidden = false;
        if (activeTab === 'hoehenwelt') renderHoehenwelt();
        else if (activeTab === 'level') renderLevel();
        else if (activeTab === 'tourbuch') renderTourbuch();
    }
    panel.addEventListener('click', event => {
        const milestoneButton = event.target.closest('[data-bergwelt-height-milestone]');
        if (!milestoneButton) return;
        const height = Number(milestoneButton.dataset.bergweltHeightMilestone);
        if (!Number.isFinite(height) || height <= 0) return;
        selectedHeightMilestone = height;
        renderHoehenwelt(true);
    });
    tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-bergwelt-tab]');
        if (!button) return;
        activeTab = button.dataset.bergweltTab;
        syncExperienceActions();
        selectedHeightMilestone = null;
        tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
            const active = tab === button;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        render();
    });
    document.getElementById('wrapped-year-select')?.addEventListener('change', () => {
        if (activeTab === 'level' || activeTab === 'hoehenwelt') render();
    });
    document.getElementById('wrapped-toggle')?.addEventListener('click', () => {
        activeTab = 'erlebnis';
        syncExperienceActions();
        selectedHeightMilestone = null;
        tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
            const active = tab.dataset.bergweltTab === 'erlebnis';
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        render();
    });
    window.__bergweltRender = render;
    render();
})();