(function () {
    'use strict';
    // Eigene Versionskennung verhindert, dass ein bereits geladenes älteres
    // Bergwelt-Modul die aktualisierten Abzeichen vorzeitig blockiert.
    if (window.__BERGWELT_BADGE_MODULE_VERSION__ === '20261019-fix5') return;
    window.__BERGWELT_BADGE_MODULE_VERSION__ = '20261019-fix5';
    window.__BERGWELT_MODULE_READY__ = true;

    const root = document.getElementById('wrapped-view');
    const tabs = document.getElementById('bergwelt-tabs');
    const panel = document.getElementById('bergwelt-panel');
    if (!root || !tabs || !panel) return;
    root.classList.add('bergwelt-ready');

    const tabNames = {
        erlebnis: 'Erlebnis',
        hoehenwelt: 'Höhenwelt',
        level: 'Level',
        tour: 'Tour erleben'
    };
    let activeTab = 'erlebnis';
    let experienceMode = 'momente';
    let selectedTourId = '';
    let selectedHeightMilestone = null;
    let animationRun = 0;
    let activeTourCleanup = null;

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
    const getYear = () => Number(document.getElementById('wrapped-year-select')?.value) || new Date().getFullYear();
    const yearTours = () => getTours().filter(e => dateYear(e) === getYear());
    const getSeasonHighlightForEntry = entry => {
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
            <p class="bergwelt-eyebrow">${eyebrow}</p>
            <h2 class="bergwelt-heading">${heading}</h2>
            <p class="bergwelt-copy">${copy}</p>
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
        root.classList.remove('bergwelt-mode');
    }
    function renderHoehenwelt() {
        const entries = yearTours();
        const allEntries = getTours();
        const yearAscent = sumKnown(entries, ascentValue);
        const careerAscent = sumKnown(allEntries, ascentValue);
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
        const heightIcons = [
            // Großglockner: schroffer Felsgrat mit goldenem Gipfelkreuz.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><rect width="64" height="64" rx="13" fill="#fff"/><path d="M7 52 18 36l6 5 12-25 7 13 5-5 9 28Z" fill="#8c979f" stroke="#48565f" stroke-width="1.7" stroke-linejoin="round"/><path d="m26 29 10-13 5 10-5-3-3 4-2-2Z" fill="#f6fbff" stroke="#48565f" stroke-width="1.2" stroke-linejoin="round"/><path d="m15 47 9-6 5 5 7-7 7 6 7-3 7 7H10Z" fill="#657783" stroke="#48565f" stroke-width="1.4" stroke-linejoin="round"/><path d="M36 6v13m-4-9h8" fill="none" stroke="#d49a28" stroke-width="2.2" stroke-linecap="round"/><circle cx="36" cy="6" r="2.1" fill="#f5c84c"/></svg>',
            // Everest: Eisgipfel mit orange-roter Expeditionsflagge.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><rect width="64" height="64" rx="13" fill="#fff"/><path d="M7 52 17 39l7 3 14-27 8 14 4-4 8 27Z" fill="#b8d8ed" stroke="#477ca2" stroke-width="1.7" stroke-linejoin="round"/><path d="m30 24 8-9 5 9-5-3-3 3-2-2Z" fill="#fff" stroke="#477ca2" stroke-width="1.2" stroke-linejoin="round"/><path d="m15 43 9 2 5-8 8 10 8-9 10 7 3 7H7Z" fill="#e4f1fa" stroke="#477ca2" stroke-width="1.4" stroke-linejoin="round"/><path d="M39 15V6" stroke="#506a83" stroke-width="1.5" stroke-linecap="round"/><path d="M39 6h11l-4 4 4 4H39Z" fill="#ee765c" stroke="#9d4434" stroke-width="1.2" stroke-linejoin="round"/></svg>',
            // Drei Everest-Höhen: mehrlagige Berglandschaft mit 3×-Markierung.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><rect width="64" height="64" rx="13" fill="#fff"/><path d="M7 49 17 34l6 7 8-15 10 23Z" fill="#bdd3bc" stroke="#50785a" stroke-width="1.3" stroke-linejoin="round"/><path d="m27 49 11-21 5 6 6-11 9 26Z" fill="#88b3c4" stroke="#386d80" stroke-width="1.5" stroke-linejoin="round"/><path d="m32 36 6-8 3 6-4-2-2 2Z M46 29l3-6 5 8-4-3-2 1Z" fill="#fff" stroke="#386d80" stroke-width="1.1" stroke-linejoin="round"/><circle cx="15" cy="17" r="9" fill="#f3cc62" stroke="#987b35" stroke-width="1.2"/><text x="15" y="20.5" font-size="10" font-weight="800" text-anchor="middle" fill="#443b24">3×</text><path d="M24 16h12" stroke="#987b35" stroke-width="1.4" stroke-dasharray="2 2" stroke-linecap="round"/></svg>',
            // 250.000 hm: topografische Höhenlinien und goldener Höhenmarker.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><rect width="64" height="64" rx="13" fill="#fff"/><path d="M7 46c4-7 11-10 17-7 7 4 8 10 16 8s12-8 17-4v10H7Z" fill="#b7d9c0" stroke="#3e805b" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 41c7-9 14-13 21-9 7 4 9 9 15 5 4-3 8-5 13-3M15 32c7-7 13-9 18-5 5 4 8 5 13 1 3-2 6-3 9-2M21 24c5-4 9-5 13-2 4 2 6 2 9 0" fill="none" stroke="#3e805b" stroke-width="1.6" stroke-linecap="round"/><path d="M31 8v13" stroke="#bb8731" stroke-width="2" stroke-linecap="round"/><path d="M31 8c-4 4-4 7 0 9 4-2 4-5 0-9Z" fill="#f2c85b" stroke="#9e742f" stroke-width="1.2"/><circle cx="31" cy="21" r="2.2" fill="#f2c85b" stroke="#9e742f" stroke-width="1.2"/></svg>',
            // 500.000 hm: goldene Lebenszeitmedaille mit Bergrelief und Sternen.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false"><rect width="64" height="64" rx="13" fill="#fff"/><path d="M21 6h9l4 13-8 4Z" fill="#d76f4f" stroke="#a54d35" stroke-width="1.2" stroke-linejoin="round"/><path d="M34 19 38 6h8l-5 17Z" fill="#6b9cc6" stroke="#47789f" stroke-width="1.2" stroke-linejoin="round"/><circle cx="32" cy="38" r="19" fill="#f2c85b" stroke="#a77724" stroke-width="2"/><circle cx="32" cy="38" r="14.5" fill="#ffe9a0" stroke="#c08a2e" stroke-width="1.3"/><path d="M17 43 25 32l5 5 6-9 11 15Z" fill="#91b1bf" stroke="#4f6d77" stroke-width="1.4" stroke-linejoin="round"/><path d="m26 34 4 3 6-9 4 5-4-2-3 3-2-1Z" fill="#fff" stroke="#4f6d77" stroke-width="1"/><path d="m17 26 1.6 3.7 4 .3-3 2.6.9 3.9-3.5-2.1-3.4 2.1.8-3.9-3-2.6 4-.3Z M49 23l1.3 3 3.2.3-2.4 2.1.7 3.1-2.8-1.7-2.7 1.7.6-3.1-2.3-2.1 3.1-.3Z" fill="#e6ae36" stroke="#a77724" stroke-width=".8" stroke-linejoin="round"/></svg>'
        ];
        const next = careerAscent === null ? null : (milestones.find(m => m.height > total) || null);
        // Fortschritt bedeutet hier: gesammelte Höhenmeter im Verhältnis zum nächsten Ziel.
        // Dadurch stimmt der Wert mit den Prozentangaben in den einzelnen Höhenmarken überein.
        const progress = careerAscent === null ? 0 : next
            ? Math.max(0, Math.min(100, total / next.height * 100))
            : 100;
        const comparison = careerAscent === null ? 'Für deine gespeicherten Touren liegen keine gültigen Aufstiegswerte vor.' :
            total >= 500000 ? 'Du hast die Lebenszeitmarke von 500.000 Höhenmetern überschritten – ein außergewöhnlicher Langzeiterfolg.' :
            total >= 250000 ? 'Du hast bereits 250.000 Höhenmeter gesammelt. Die nächste Lebenszeitmarke liegt bei einer halben Million Höhenmetern.' :
            total >= 26544 ? 'Dein kumulierter Aufstieg entspricht mindestens drei Everest-Höhen.' :
            total >= 8848 ? 'Dein kumulierter Aufstieg entspricht mindestens einer Everest-Höhe.' :
            total >= 3798 ? 'Dein kumulierter Aufstieg übertrifft die Höhe des Großglockners.' :
            'Jeder gespeicherte Höhenmeter zählt. Deine persönliche Bergwelt wächst mit jeder Tour.';
        const selectedMilestone = milestones.find(m => m.height === selectedHeightMilestone) || null;
        const milestoneMoment = selectedMilestone ? (() => {
            const reached = careerAscent !== null && total >= selectedMilestone.height;
            const remaining = careerAscent === null ? null : Math.max(0, selectedMilestone.height - total);
            const targetProgress = careerAscent === null ? 0 : Math.max(0, Math.min(100, total / selectedMilestone.height * 100));
            const detailCopy = careerAscent === null
                ? 'Für diesen Vergleich fehlen gültige gespeicherte Aufstiegswerte. Sobald Werte vorhanden sind, wird der Fortschritt hier berechnet.'
                : reached
                    ? 'Deine gespeicherte Aufstiegssumme liegt bereits über diesem Vergleichswert. Das ist ein rechnerischer Höhenvergleich – keine Aussage über eine konkrete Besteigung.'
                    : 'Du hast bereits ' + fmt(targetProgress, 1) + ' % des Vergleichswerts gesammelt. Es fehlen noch ' + fmt(remaining) + ' hm. Jede weitere gespeicherte Tour lässt deinen Fortschritt wachsen.';
            return '<section class="bergwelt-height-moment ' + (reached ? 'is-achieved' : 'is-in-progress') + '" id="bergwelt-height-moment" aria-live="polite">' +
                '<div class="bergwelt-height-moment-top"><div><span class="bergwelt-height-moment-kicker">' + (reached ? '✦ DEIN GIPFELMOMENT' : 'DEIN NÄCHSTES ZIEL') + '</span><h3>' + escapeHTML(selectedMilestone.name) + '</h3></div>' +
                    '<button type="button" class="bergwelt-height-moment-close" data-bergwelt-height-milestone-close aria-label="Gipfelmoment schließen">×</button></div>' +
                '<p class="bergwelt-height-moment-copy">' + detailCopy + '</p>' +
                '<div class="bergwelt-height-moment-details">' +
                    '<div><span>DEIN AUFSTIEG</span><strong>' + fmtKnown(careerAscent) + '<small> hm</small></strong></div>' +
                    '<div><span>VERGLEICHSWERT</span><strong>' + fmt(selectedMilestone.height) + '<small> ' + (selectedMilestone.height <= 26544 ? 'm' : 'hm') + '</small></strong></div>' +
                    '<div><span>' + (reached ? 'DARÜBER' : 'NOCH OFFEN') + '</span><strong>' + (careerAscent === null ? '–' : reached ? '+' + fmt(total - selectedMilestone.height) : fmt(remaining)) + '<small> hm</small></strong></div>' +
                '</div>' +
                '<div class="bergwelt-height-moment-footer"><div class="bergwelt-height-gauge" style="--moment-progress:' + targetProgress + '%"><span>' + (careerAscent === null ? '–' : reached ? '✓' : fmt(targetProgress, 0) + '%') + '</span></div>' +
                    '<div><strong>' + (careerAscent === null ? 'Fortschritt offen' : reached ? 'Vergleichsmarke erreicht' : 'Weiter bergauf') + '</strong><small>' + (careerAscent === null ? 'Keine Schätzung bei fehlenden Daten' : reached ? fmt(total / selectedMilestone.height, 1) + '× des Vergleichswerts gesammelt' : fmt(remaining) + ' hm bis zum Ziel') + '</small></div></div>' +
            '</section>';
        })() : '';
        panel.innerHTML = intro('Dein persönlicher Berg · ' + getYear(), 'Höhenwelt', 'Nicht nur ein Jahreswert: Hier wächst deine persönliche Höhenwelt mit allen gespeicherten Touren. Die Jahresleistung bleibt separat sichtbar.') +
            '<div class="bergwelt-height-hero">' +
                '<div class="bergwelt-height-visual" role="img" aria-label="Symbolischer Berg mit Fortschritt zur nächsten Höhenmarke">' +
                    '<svg viewBox="0 0 600 230" class="bergwelt-height-mountain" aria-hidden="true">' +
                        '<defs><linearGradient id="bergwelt-mountain-fill" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="var(--accent-color, #4b8b75)" stop-opacity=".42"/><stop offset="100%" stop-color="var(--accent-color, #4b8b75)" stop-opacity=".04"/></linearGradient></defs>' +
                        '<path class="bergwelt-height-silhouette" d="M0 210 L85 155 L132 176 L230 58 L280 105 L350 28 L410 96 L456 66 L535 158 L600 128 L600 230 L0 230 Z"/>' +
                        '<path class="bergwelt-height-ridge" d="M85 155 L132 176 L230 58 L280 105 L350 28 L410 96 L456 66 L535 158"/>' +
                        '<path class="bergwelt-height-trail" style="stroke-dashoffset:' + (520 * (1 - progress / 100)) + '" d="M25 208 C100 198 125 175 155 164 S210 122 230 108 S285 100 305 79 S345 67 350 45"/>' +
                        '<circle class="bergwelt-height-summit" cx="350" cy="45" r="7"/>' +
                    '</svg>' +
                    '<div class="bergwelt-height-overlay"><span>Dein kumulierter Aufstieg</span><strong>' + fmtKnown(careerAscent) + ' <small>hm</small></strong></div>' +
                '</div>' +
                '<div class="bergwelt-height-progress"><div class="bergwelt-height-progress-label"><span>' + (careerAscent === null ? 'Fortschritt nicht verfügbar' : next ? 'Anteil der nächsten Höhenmarke · ' + next.name : 'Alle bisherigen Höhenmarken erreicht') + '</span><strong>' + (careerAscent === null ? '–' : fmt(progress, 0) + '%') + '</strong></div><div class="bergwelt-track"><span style="width:' + progress + '%"></span></div>' +
                    '<p class="bergwelt-footnote">' + (careerAscent === null ? 'Es fehlen gültige Aufstiegswerte.' : next ? 'Du hast ' + fmt(progress, 0) + ' % der nächsten Marke gesammelt. Noch ' + fmt(Math.max(0, next.height - total)) + ' hm bis ' + next.name + ' (' + fmt(next.height) + ' hm).' : 'Die nächste Vergleichsstufe ist erreicht. Deine persönliche Höhenwelt wächst weiter.') + '</p></div>' +
            '</div>' +
            '<div class="bergwelt-grid">' +
                statCard('Aufstieg im Jahr ' + getYear(), fmtKnown(yearAscent), 'hm') +
                statCard('Touren insgesamt', fmtKnown(allEntries.length ? uniqueTourCount(allEntries) : null), '') +
            '</div>' +
            '<div class="bergwelt-height-milestone-heading"><div><span>DEINE HÖHENMARKEN</span><h3>Wähle deinen Gipfelmoment</h3></div><p>Tippe eine Marke an, um deinen Fortschritt zu erleben.</p></div>' +
            '<div class="bergwelt-height-milestones" aria-label="Interaktive Höhenmarken">' +
            milestones.map((m, i) => {
                const reached = careerAscent !== null && total >= m.height;
                const remaining = careerAscent === null ? null : Math.max(0, m.height - total);
                const targetProgress = careerAscent === null ? 0 : Math.max(0, Math.min(100, total / m.height * 100));
                const active = selectedHeightMilestone === m.height;
                return '<button type="button" class="bergwelt-height-milestone' + (reached ? ' is-reached' : '') + (active ? ' is-selected' : '') + '" data-bergwelt-height-milestone="' + m.height + '" aria-expanded="' + active + '" aria-controls="bergwelt-height-moment">' +
                    '<span class="bergwelt-height-milestone-mark' + (reached ? ' is-reached' : '') + '" aria-hidden="true">' + heightIcons[i] + '</span>' +
                    '<span class="bergwelt-height-milestone-copy"><strong>' + escapeHTML(m.name) + '</strong><small>' + (reached ? 'Vergleichsmarke erreicht' : careerAscent === null ? 'Keine Aufstiegsdaten' : fmt(remaining) + ' hm bis zur Marke') + '</small></span>' +
                    '<span class="bergwelt-height-milestone-value"><strong>' + fmt(m.height) + '</strong><small>' + (m.height <= 26544 ? 'm' : 'hm') + '</small></span>' +
                    '<span class="bergwelt-height-milestone-bar" aria-hidden="true"><span style="width:' + targetProgress + '%"></span></span>' +
                    '<span class="bergwelt-height-milestone-chevron" aria-hidden="true">' + (active ? '⌃' : '›') + '</span>' +
                '</button>';
            }).join('') +
            '</div>' + milestoneMoment +
            '<p class="bergwelt-footnote">' + escapeHTML(comparison) + ' Alle Summen beruhen ausschließlich auf gespeicherten Aufstiegswerten. Die Höhenmarken sind Vergleichswerte; sie behaupten keine konkrete Besteigung.</p>';
    }
    function renderLevel() {
        const entries = yearTours();
        const dist = sumKnown(entries, distanceValue);
        const asc = sumKnown(entries, ascentValue);
        const mins = sumKnown(entries, minutesValue);
        const peakCount = sumKnown(entries, peaksValue);
        const maxAscent = maxKnown(entries, ascentValue);
        // Exakt wie Stats/Highlights: Aufstieg bleibt unverändert.
        // Standardmäßig zählt für hm/km nur die halbe Strecke; mit
        // useFullDistanceForGradient wird die volle Strecke verwendet.
        const steepnessValue = entry => {
            const ascent = ascentValue(entry);
            const fullDistance = distanceValue(entry);
            if (ascent === null || fullDistance === null || fullDistance <= 0) return null;
            const adjustedDistance = entry.useFullDistanceForGradient ? fullDistance : fullDistance / 2;
            return adjustedDistance > 0 ? ascent / adjustedDistance : null;
        };
        const validSteepness = entries
            .map(steepnessValue)
            .filter(value => value !== null && Number.isFinite(value));
        const maxSteepness = validSteepness.length ? Math.max(...validSteepness) : null;
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
                tiers: [[1000, 'Höhenmeter-Sammler'], [3000, 'Bergauf unterwegs'], [5000, 'Höhenmeter-Spezialist'], [10000, 'Höhenprofi'], [20000, 'Höhenlegende']],
                detail: 'Kumulierte Aufstiegshöhen im ausgewählten Jahr.'
            },
            {
                name: 'Gipfelsammler', value: peakCount, unit: 'Gipfel',
                tiers: [[1, 'Gipfel entdeckt'], [5, 'Gipfelsammler'], [10, 'Gipfeljäger'], [25, 'Gipfelkenner'], [50, 'Gipfellegende']],
                detail: 'Summe der gespeicherten Gipfelangaben im ausgewählten Jahr.'
            },
            {
                name: 'Ausdauer-Alpinist', value: mins === null ? null : mins / 60, unit: 'h',
                tiers: [[5, 'Ausdauer-Einsteiger'], [15, 'Ausdauerstark'], [25, 'Ausdauer-Alpinist'], [50, 'Langstrecken-Profi'], [100, 'Ausdauerlegende']],
                detail: 'Gespeicherte Gehzeit im ausgewählten Jahr.'
            },
            {
                name: 'Steilheits-Profi', value: maxSteepness, unit: 'hm/km',
                tiers: [[100, 'Steile Wege'], [150, 'Steilheits-Kenner'], [200, 'Steilheits-Profi'], [250, 'Extrem steil'], [300, 'Steilheitslegende']],
                detail: 'Höchste Steigung einer einzelnen Tour – nach derselben Rundtour-Logik wie in Stats/Highlights (standardmäßig halbe Strecke; bei aktivierter Option volle Strecke).'
            },
            {
                name: 'Vielseitiger Wanderer', value: activityCount, unit: 'Typen',
                tiers: [[1, 'Erster Stil'], [2, 'Abwechslungsreich'], [3, 'Vielseitiger Wanderer'], [4, 'Allrounder'], [5, 'Bergwelt-Allrounder']],
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
            return { ...def, current, next, pct };
        });
        const earnedCount = levels.filter(level => level.current).length;
        const overviewProgress = earnedCount / definitions.length * 100;
        // Die fünf Original-Abzeichen: farbige, eigenständige Illustrationen
        // auf weißem, abgerundetem Quadrat – identisch in Galerie und Entwicklung.
        const badgeIcons = [
            // Höhenmeter-Spezialist: gestaffelte Bergflanken, Schneekanten und Höhenlinien.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><circle cx="36" cy="36" r="25" fill="#bfe4e4" stroke="#355c68" stroke-width="2.2"/><path d="M12.8 37.5 25 21.8l8 9.3 8.6-14.2 17.5 23.6v7.9c-13.3 12.1-30.2 12.5-46.3 1.2Z" fill="#6c9eaa" stroke="#244e5d" stroke-width="1.8" stroke-linejoin="round"/><path d="m19 30 6-8.2 4 4.7-4.4-.9-2.5 3.8-1.2-2.5Z M34.2 29l7.4-12.1 6.2 8.4-5.9-3.3-3 3.8-2.3-1.6Z" fill="#f8ffff" stroke="#244e5d" stroke-width="1.3" stroke-linejoin="round"/><path d="M12.8 40.2 23.4 32l8.9 15.7 7.5-11.3 20.1 8.8v5c-13.3 12.1-30.2 12.5-46.3 1.2Z" fill="#2e6e83" stroke="#244e5d" stroke-width="1.7" stroke-linejoin="round"/><path d="M12.8 43.5 22 39l8.4 14.5 7.8-8.3 8.3 5.3 5.3-3.4 6.1 4.2c-13.4 9.1-30.4 9.2-45.1.1Z" fill="#9db53f" stroke="#345d35" stroke-width="1.7" stroke-linejoin="round"/><path d="m18 45 6.5 2.8 2.1 5.5m4.6-1.4 6.2-2.7 3.1 5.2m-1-12.1 5.8 2.4 2.2 4.3" fill="none" stroke="#31596a" stroke-width="1.2" stroke-linecap="round"/><path d="m24 44 3.8 9.6m11.7-8.2-1.3 11.1" fill="none" stroke="#e8df72" stroke-width="1.6" stroke-linecap="round"/></svg>',
            // Gipfelsammler: mehrere helle, blau umrandete Gipfel mit kleiner Gipfelflagge.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><path d="M10 49 22 34l7.1 8.7 11.8-17.4L61 49Z" fill="#e7f2ff" stroke="#668bb7" stroke-width="1.45" stroke-linejoin="round"/><path d="m22 34 4.2 5.2-4.5-1.2-3 3.9-1.5-1.7Z M40.9 25.3l6.3 8.8-5.9-3.1-3 3.4-2-1.2Z" fill="#fff" stroke="#668bb7" stroke-width="1.2" stroke-linejoin="round"/><path d="M31 49 42 32l5.5 7.2 5.1-7.7L63 49Z" fill="#c8e2fb" stroke="#668bb7" stroke-width="1.4" stroke-linejoin="round"/><path d="M47.8 33.1 52 27l3.9 5.2" fill="#fff" stroke="#668bb7" stroke-width="1.1" stroke-linejoin="round"/><path d="M49.1 29.1V11.8" stroke="#567ca8" stroke-width="1.6" stroke-linecap="round"/><path d="M49.3 12.4h8l-3.2 3.3 3.1 3.2h-7.9Z" fill="#7da7d4" stroke="#567ca8" stroke-width="1.2" stroke-linejoin="round"/><path d="M12 49h50" stroke="#668bb7" stroke-width="1.4" stroke-linecap="round"/></svg>',
            // Ausdauer-Alpinist: dunkelgrüner Kompassring, alpine Silhouette und dynamische Nadel.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><circle cx="36" cy="36" r="25" fill="#fff" stroke="#215b3d" stroke-width="1.8"/><circle cx="36" cy="36" r="20.7" fill="none" stroke="#538663" stroke-width="1.2"/><path d="M16.5 31.5 24 20.8l3.5 5.1 5.7-9.1 7.2 10.4 3.7-5.2 10.1 12.2" fill="none" stroke="#225b3d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m20 30 4-7.3 3.3 7.3m4.1-4.3 3.8-7.1 3.7 7.1m5.5-.2 3.7-4.7 5.1 8.1" fill="#a9c7a9" stroke="#225b3d" stroke-width="1.1" stroke-linejoin="round"/><path d="M27 30.4 22.6 23l-4.4 7.4m26.5 0-4.3-7.6-4.1 7.6" fill="none" stroke="#225b3d" stroke-width="1.3" stroke-linecap="round"/><circle cx="36" cy="40" r="14.5" fill="#e5f0e8" stroke="#225b3d" stroke-width="1.8"/><circle cx="36" cy="40" r="10.3" fill="none" stroke="#4a8a66" stroke-width="1.2" stroke-dasharray="2 2"/><path d="m37.9 29.7-7.2 12.2 8.9-2.2 2.5-9.2-4.2-.8Z" fill="#4c8a75" stroke="#215b3d" stroke-width="1.1" stroke-linejoin="round"/><path d="m37.9 29.7-1.7 10 6-9.2-4.3-.8Z" fill="#b7d6e8" stroke="#215b3d" stroke-width="1"/><path d="m30.7 41.9 6.1-1.6 2.8 7.8-8.9-6.2Z" fill="#f4faf3" stroke="#215b3d" stroke-width="1.1" stroke-linejoin="round"/><path d="M36 13v4m0 36v4m-23-21h4m38 0h4" stroke="#215b3d" stroke-width="1.4" stroke-linecap="round"/></svg>',
            // Steilheits-Profi: gelbe Sonnenscheibe, dunkle steile Felsflanke und Blitz.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><circle cx="36" cy="36" r="26" fill="#ffd43b"/><path d="M13 55.5 15.5 45l6.2-2.4 1.2-8.4 6.7 1.7 3.1-11.2 5.8 4.1 2.2-9.1 5.2 5.2 3.2-2.9 1.9 12.3 5.7 3.5 2.8 17.7Z" fill="#292c2d" stroke="#181a1c" stroke-width="1.8" stroke-linejoin="round"/><path d="m17 54 3.5-8.2 5.3 1.2 2.6-10.4 3.9-1.2 4.9-10.4 2.2 12.5-5.5 6.6-1.1 10.1Z" fill="#55595a" stroke="#181a1c" stroke-width="1.1" stroke-linejoin="round"/><path d="m42.5 25.5-8.2 14.2h5.4l-4.2 14.1 12.3-19.2h-6.1l2.9-9.1Z" fill="#ffdf4f" stroke="#272727" stroke-width="1.5" stroke-linejoin="round"/><path d="m47.6 33.3 4.9 3.2 1.6 13.7m-31.2-6.1 4.6-1.7" fill="none" stroke="#929596" stroke-width="1.4" stroke-linecap="round"/></svg>',
            // Vielseitiger Wanderer: gelber Wegweiserpfosten mit blauen, roten und orangefarbenen Routen.
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" focusable="false"><rect width="72" height="72" rx="15" fill="#fff"/><path d="M33.4 13h6.8v52h-6.8z" fill="#f7c342" stroke="#25292d" stroke-width="2" stroke-linejoin="round"/><path d="M31.8 8.5h10v5.1h-10z M32.8 4.5h8v4h-8z" fill="#f7c342" stroke="#25292d" stroke-width="1.8" stroke-linejoin="round"/><path d="M33.4 20.3H17l-8.4 7.5 8.4 7.6h16.4Z" fill="#5e9de3" stroke="#25292d" stroke-width="2" stroke-linejoin="round"/><path d="M39.9 31.7h16.3l8.3 7.6-8.3 7.5H39.9Z" fill="#f0785c" stroke="#25292d" stroke-width="2" stroke-linejoin="round"/><path d="M33.4 43.2H17.2l-8.4 7.4 8.4 7.5h16.2Z" fill="#f3a24f" stroke="#25292d" stroke-width="2" stroke-linejoin="round"/><path d="M27.5 27.8h-8.4m-2.7 0 2.8-2.7m-2.8 2.7 2.8 2.7m27.1 11.1h8.2m2.8 0-2.8-2.7m2.8 2.7-2.8 2.7m-22.8 7.9h-8.5m-2.7 0 2.7-2.7m-2.7 2.7 2.7 2.7" fill="none" stroke="#23292e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        ];

        const levelDigits = level => level.name === 'Ausdauer-Alpinist' || level.name === 'Steilheits-Profi' ? 1 : 0;
        panel.innerHTML = intro('Dein Bergprofil · ' + getYear(), 'Dein Bergsteiger-Level', 'Deine Touren formen fünf Spezialisierungen. Mit jedem erreichten Schwellenwert schaltest du einen neuen Rang frei – ausschließlich anhand deiner gespeicherten Daten.') +
            '<section class="bergwelt-level-overview">' +
                '<div class="bergwelt-level-overview-copy"><span class="bergwelt-level-kicker">DEIN PROFIL</span><h3>Jede Tour zählt.</h3><p>Fünf Wege, deinen persönlichen Bergstil zu entdecken.</p>' +
                    '<div class="bergwelt-level-overview-status"><strong>' + earnedCount + ' von 5</strong><span>Spezialisierungen mit Rang</span></div></div>' +
                '<div class="bergwelt-level-overview-ring" style="--level-overview-progress:' + overviewProgress + '%" role="img" aria-label="' + earnedCount + ' von 5 Spezialisierungen mit mindestens einem Rang"><div><strong>' + earnedCount + '<small>/5</small></strong><span>RÄNGE</span></div></div>' +
            '</section>' +
            '<div class="bergwelt-grid bergwelt-level-stats">' +
                statCard('Jahresstrecke', fmtKnown(dist, 1), 'km') +
                statCard('Stärkster Einzelaufstieg', fmtKnown(maxAscent), 'hm') +
                statCard('Gehzeit gesamt', mins === null ? '–' : fmt(mins / 60, 1), 'h') +
                statCard('Gespeicherte Gipfel', fmtKnown(peakCount), 'Gipfel') +
            '</div>' +
            '<div class="bergwelt-level-badge-heading"><div><span>DEINE ERFOLGE</span><h3>Abzeichen-Galerie</h3></div><span class="bergwelt-level-badge-count">' + earnedCount + ' / 5 freigeschaltet</span></div>' +
            '<div class="bergwelt-level-badges">' +
            levels.map((l, i) => {
                const currentIndex = l.current ? l.tiers.indexOf(l.current) : -1;
                const valueText = l.value === null ? '– ' + l.unit : fmt(l.value, levelDigits(l)) + ' ' + l.unit;
                const unlocked = Boolean(l.current);
                const badgeTitle = unlocked ? l.current[1] : l.next ? l.next[1] : 'Daten fehlen';
                const badgeStatus = unlocked
                    ? (l.next ? 'Nächster Rang: ' + l.next[1] : 'Höchster Rang erreicht')
                    : l.value === null ? 'Wartet auf Daten' : l.next ? 'Noch zu verdienen' : 'Noch kein Rang';
                return '<article class="bergwelt-level-badge' + (unlocked ? ' is-unlocked' : ' is-locked') + '">' +
                    '<div class="bergwelt-level-badge-emblem" aria-hidden="true"><span class="bergwelt-badge-art">' + badgeIcons[i] + '</span></div>' +
                    '<div class="bergwelt-level-badge-body"><span class="bergwelt-level-badge-name">' + escapeHTML(l.name) + '</span><strong>' + escapeHTML(badgeTitle) + '</strong><small>' + escapeHTML(badgeStatus) + '</small>' +
                    (unlocked ? '<span class="bergwelt-level-badge-value">' + valueText + '</span>' : l.value === null ? '<span class="bergwelt-level-badge-value">Keine gültigen Werte</span>' : '<span class="bergwelt-level-badge-value">' + fmt(Math.max(0, l.next[0] - l.value), levelDigits(l)) + ' ' + l.unit + ' bis zum Rang</span>') +
                    '</div></article>';
            }).join('') +
            '</div>' +
            '<div class="bergwelt-level-specialization-heading"><span>DEINE ENTWICKLUNG</span><h3>Fortschritt je Spezialisierung</h3><p>Die Balken zeigen deinen Fortschritt von der letzten erreichten bis zur nächsten Stufe.</p></div>' +
            levels.map((l, i) => {
                const valueText = l.value === null ? '– ' + l.unit : fmt(l.value, levelDigits(l)) + ' ' + l.unit;
                const currentIndex = l.current ? l.tiers.indexOf(l.current) : -1;
                const tierText = l.value === null ? 'Noch nicht bestimmbar' : l.current ? l.current[1] : 'Dein erster Rang wartet';
                const goalText = l.value === null
                    ? 'Es fehlen gültige Daten für diese Spezialisierung.'
                    : l.next
                        ? fmt(Math.max(0, l.next[0] - l.value), levelDigits(l)) + ' ' + l.unit + ' bis ' + l.next[1] + ' (' + fmt(l.next[0], levelDigits(l)) + ' ' + l.unit + ')'
                        : 'Höchster definierter Rang freigeschaltet – weitere Fortschritte werden weiterhin gezählt.';
                const rankSteps = l.tiers.map((tier, index) => {
                    const reached = index <= currentIndex;
                    const nextStep = l.next && index === l.tiers.indexOf(l.next);
                    return '<span class="bergwelt-level-rank-step' + (reached ? ' is-reached' : '') + (nextStep ? ' is-next' : '') + '" title="' + escapeHTML(tier[1]) + '" aria-label="Rang ' + (index + 1) + ': ' + escapeHTML(tier[1]) + '"></span>';
                }).join('');
                return '<article class="bergwelt-level bergwelt-level-card' + (l.value === null ? ' has-no-data' : '') + (l.current ? ' has-rank' : '') + '">' +
                    '<div class="bergwelt-level-top"><div class="bergwelt-level-title-wrap"><span class="bergwelt-level-emblem" aria-hidden="true">' + badgeIcons[i] + '</span><div><strong>' + escapeHTML(l.name) + '</strong><small>' + escapeHTML(tierText) + '</small></div></div><div class="bergwelt-level-value-wrap"><strong>' + valueText + '</strong><span>' + (currentIndex >= 0 ? 'RANG ' + (currentIndex + 1) + ' / 5' : l.value === null ? 'DATEN FEHLEN' : 'NOCH OFFEN') + '</span></div></div>' +
                    '<div class="bergwelt-level-rank-steps" aria-label="' + (currentIndex + 1) + ' von 5 Rängen erreicht">' + rankSteps + '</div>' +
                    (l.pct === null ? '<p class="bergwelt-level-goal">' + goalText + '</p>' : '<div class="bergwelt-track bergwelt-level-progress-track" role="progressbar" aria-label="Fortschritt zur nächsten Stufe für ' + escapeHTML(l.name) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(l.pct) + '"><span style="width:' + l.pct + '%"></span></div><div class="bergwelt-level-progress-meta"><span>' + (l.next ? 'Fortschritt zur nächsten Stufe' : 'Alle Stufen abgeschlossen') + '</span><strong>' + fmt(l.pct) + ' %</strong></div><p class="bergwelt-level-goal">' + goalText + '</p>') +
                    '<p class="bergwelt-level-detail">' + escapeHTML(l.detail) + '</p></article>';
            }).join('') +
            '<p class="bergwelt-footnote">Die Höhenmeter-, Gipfel- und Gehzeitstufen beziehen sich auf das ausgewählte Jahr. Steilheit wird nur aus Touren mit gültiger Strecke und gültigem Aufstieg berechnet. Aktivitätstypen werden nur gezählt, wenn sie in den gespeicherten Daten vorhanden sind.</p>';
    }
        function renderTour() {
        if (activeTourCleanup) {
            activeTourCleanup();
            activeTourCleanup = null;
        }
        const entries = yearTours().slice().sort((a, b) => {
            const dateDiff = (parseTourDate(b.date)?.getTime() || 0) - (parseTourDate(a.date)?.getTime() || 0);
            return dateDiff || Number(a.tourDay || 0) - Number(b.tourDay || 0);
        });
        if (!entries.length) {
            panel.innerHTML = experienceStoryRail() +
                intro('Deine Erinnerung · ' + getYear(), 'Tour erleben', 'Der Jahresrückblick bleibt dein Einstieg. Hier beginnt die Expedition durch deine gespeicherten Touren.') +
                empty('Für ' + getYear() + ' sind keine Touren gespeichert.');
            return;
        }
        if (!entries.some((e, i) => String(e.id ?? i) === selectedTourId)) selectedTourId = String(entries[0].id ?? 0);
        const index = Math.max(0, entries.findIndex((e, i) => String(e.id ?? i) === selectedTourId));
        const e = entries[index];
        const title = e.tourname || e.region || 'Unbenannte Tour';
        const tourDistance = distanceValue(e);
        const tourAscent = ascentValue(e);
        const adjustedDistance = tourDistance !== null && tourDistance > 0
            ? (e.useFullDistanceForGradient ? tourDistance : tourDistance / 2)
            : null;
        const steepness = tourAscent !== null && adjustedDistance !== null && adjustedDistance > 0
            ? tourAscent / adjustedDistance : null;
        const dateLabel = e.date || 'Datum nicht gespeichert';
        const stageLabel = e.tourDay && e.tourDayCount ? ' · Etappe ' + e.tourDay + '/' + e.tourDayCount : '';
        const groupLabel = e.tourGroup ? ' · Mehrtagestour' : '';
        const duration = minutesValue(e);
        const peakCount = peaksValue(e);
        const seasonHighlight = getSeasonHighlightForEntry(e);
        const seasonHighlightMarkup = seasonHighlight
            ? '<p class="bergwelt-tour-finale-highlight"><span>DEIN SAISONREKORD</span><strong>' +
                escapeHTML(seasonHighlight.label) + '</strong><b>' +
                escapeHTML(seasonHighlight.value) + '</b></p>'
            : '';
        const peakDetails = (Array.isArray(e.gipfelDetails) ? e.gipfelDetails : [])
            .map(peak => ({
                name: String(peak?.name ?? '').trim(),
                height: readMetric(peak?.hoehe)
            }))
            .filter(peak => peak.name || peak.height !== null);
        const peakDetailsMarkup = peakDetails.length
            ? peakDetails.map(peak =>
                '<span class="bergwelt-tour-summit-peak"><strong>' +
                escapeHTML(peak.name || 'Name nicht gespeichert') +
                '</strong><small>' +
                (peak.height !== null ? fmt(peak.height) + ' m' : 'Höhe nicht gespeichert') +
                '</small></span>'
            ).join('')
            : '<span class="bergwelt-tour-summit-peak bergwelt-tour-summit-peak-missing">Gipfelname und Höhe nicht gespeichert</span>';
        const steps = [
            { title: 'Aufbruch', value: dateLabel + stageLabel + groupLabel },
            { title: 'Strecke', value: tourDistance === null ? 'Keine Streckenangabe gespeichert' : fmt(tourDistance, 1) + ' km' },
            { title: 'Anstieg', value: tourAscent === null ? 'Kein Aufstiegswert gespeichert' : fmt(tourAscent) + ' hm' }
        ];
        if (peakCount !== null && peakCount > 0) steps.push({ title: 'Gipfelmoment', value: fmt(peakCount) + (peakCount === 1 ? ' gespeicherter Gipfel' : ' gespeicherte Gipfel') });
        steps.push({ title: 'Ankommen', value: duration === null ? 'Keine Gehzeit gespeichert' : fmt(duration / 60, 1) + ' h Gehzeit' });
        const stepCount = steps.length;
        const stepMarkup = steps.map((step, i) =>
            '<button type="button" class="bergwelt-tour-step' + (i === 0 ? ' is-current is-revealed' : '') + '" data-tour-step="' + i + '" aria-pressed="' + (i === 0) + '">' +
                '<span class="bergwelt-tour-step-number">' + String(i + 1).padStart(2, '0') + '</span>' +
                '<span class="bergwelt-tour-step-copy"><strong>' + escapeHTML(step.title) + '</strong><small>' + escapeHTML(step.value) + '</small></span>' +
                '<span class="bergwelt-tour-step-state" aria-hidden="true">' + (i === 0 ? '●' : '○') + '</span>' +
            '</button>'
        ).join('');
        const summitIndex = steps.findIndex(step => step.title === 'Gipfelmoment');
        const summitReveal = peakCount !== null && peakCount > 0
            ? '<div class="bergwelt-tour-summit-reveal" aria-hidden="true">' +
                '<span class="bergwelt-tour-summit-kicker">DEIN GIPFELMOMENT</span>' +
                '<span class="bergwelt-tour-summit-peaks">' + peakDetailsMarkup + '</span>' +
                '<span class="bergwelt-tour-summit-facts">' + (tourAscent !== null ? fmt(tourAscent) + ' hm Aufstieg' : 'Deine gespeicherten Gipfel') + (tourDistance !== null ? ' · ' + fmt(tourDistance, 1) + ' km' : '') + '</span>' +
            '</div>'
            : '';

        panel.innerHTML = experienceStoryRail() +
            intro('Dein Bergabenteuer · ' + getYear(), 'Tour erleben', 'Aus den Momenten deiner Saison wird eine persönliche Expedition. Wähle eine gespeicherte Tour; Etappen und Kennzahlen stammen ausschließlich aus deinen Tourdaten.') +
            '<div class="bergwelt-tour-row"><select class="bergwelt-select" id="bergwelt-tour-select" aria-label="Gespeicherte Tour auswählen">' +
            entries.map((item, i) => {
                const stage = item.tourDay && item.tourDayCount ? ' · Etappe ' + item.tourDay + '/' + item.tourDayCount : '';
                const group = item.tourGroup ? ' · Mehrtagestour' : '';
                const itemId = String(item.id ?? i);
                return '<option value="' + escapeHTML(itemId) + '"' + (itemId === selectedTourId ? ' selected' : '') + '>' + escapeHTML(item.date || '') + ' · ' + escapeHTML(item.tourname || item.region || 'Unbenannte Tour') + escapeHTML(stage + group) + '</option>';
            }).join('') +
            '</select></div>' +
            '<section class="bergwelt-animation bergwelt-tour-expedition" id="bergwelt-animation" data-stage="0">' +
                '<div class="bergwelt-tour-cinematic">' +
                    '<img class="bergwelt-tour-original-photo" id="bergwelt-tour-original-photo" alt="Originalfoto der ausgewählten Tour" hidden>' +
                    '<div class="bergwelt-tour-cinematic-meta"><span id="bergwelt-tour-chapter">EXPEDITION · ETAPPE 01</span><span class="bergwelt-tour-live-status" id="bergwelt-tour-live-status">BEREIT</span></div>' +
                    '<svg class="bergwelt-tour-landscape" viewBox="0 0 760 310" role="img" aria-label="Atmosphärische, symbolische Berglandschaft. Die Linie ist keine aufgezeichnete Route oder Höhenprofil." preserveAspectRatio="xMidYMid slice">' +
                        '<defs>' +
                            '<linearGradient id="bw-tour-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent-color, #5da88d)" stop-opacity=".30"/><stop offset="66%" stop-color="var(--accent-color, #5da88d)" stop-opacity=".08"/><stop offset="100%" stop-color="var(--ui-card-bg, #18221f)" stop-opacity=".10"/></linearGradient>' +
                            '<linearGradient id="bw-tour-rear" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent-color, #5da88d)" stop-opacity=".30"/><stop offset="100%" stop-color="var(--ui-card-bg, #18221f)" stop-opacity=".45"/></linearGradient>' +
                            '<linearGradient id="bw-tour-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent-color, #5da88d)" stop-opacity=".58"/><stop offset="100%" stop-color="var(--ui-card-bg, #18221f)" stop-opacity=".95"/></linearGradient>' +
                            '<filter id="bw-tour-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
                        '</defs>' +
                        '<rect width="760" height="310" fill="url(#bw-tour-sky)"/>' +
                        '<circle class="bergwelt-tour-sun" cx="595" cy="62" r="27"/><circle class="bergwelt-tour-sun-halo" cx="595" cy="62" r="47"/>' +
                        '<g class="bergwelt-tour-cloud cloud-one"><path d="M65 83 C52 83 50 67 62 62 C65 46 88 44 95 58 C110 54 122 64 117 76 C113 84 103 83 97 83 Z"/></g>' +
                        '<g class="bergwelt-tour-cloud cloud-two"><path d="M430 113 C418 113 414 101 423 94 C426 79 447 79 453 91 C468 87 481 97 476 107 C472 114 461 113 455 113 Z"/></g>' +
                        '<g class="bergwelt-tour-stars" aria-hidden="true"><circle cx="170" cy="40" r="1.7"/><circle cx="260" cy="72" r="1.2"/><circle cx="344" cy="34" r="1.5"/><circle cx="505" cy="36" r="1.4"/><circle cx="690" cy="97" r="1.5"/></g>' +
                        '<path class="bergwelt-tour-ridge-back" d="M0 205 L57 145 L95 171 L185 63 L242 132 L296 32 L355 111 L411 69 L487 154 L545 107 L614 172 L674 120 L760 182 L760 310 L0 310 Z"/>' +
                        '<path class="bergwelt-tour-snow" d="M185 63 L165 103 L185 94 L201 115 L222 106 L242 132 L220 91 L202 86 L195 73 Z M296 32 L270 80 L294 70 L309 91 L328 81 L355 111 L325 67 L308 60 Z M411 69 L393 104 L412 94 L430 115 L449 108 L487 154 L450 91 L430 85 Z M674 120 L655 150 L674 144 L692 159 L711 151 L728 163 Z"/>' +
                        '<path class="bergwelt-tour-ridge-mid" d="M0 242 L83 190 L130 220 L226 141 L278 194 L344 133 L399 193 L467 143 L529 220 L593 166 L649 211 L711 174 L760 212 L760 310 L0 310 Z"/>' +
                        '<path class="bergwelt-tour-ridge-front" d="M0 282 L66 246 L126 265 L206 217 L265 245 L330 213 L393 241 L461 200 L512 232 L576 190 L635 222 L701 185 L760 226 L760 310 L0 310 Z"/>' +
                        '<path class="bergwelt-tour-route-bed" id="bergwelt-tour-route-bed" d="M34 279 C92 269 104 239 156 244 S231 222 278 207 S336 233 385 203 S443 184 477 160 S543 173 587 141 S648 128 714 91"/>' +
                        '<path class="bergwelt-tour-route" id="bergwelt-tour-progress-path" d="M34 279 C92 269 104 239 156 244 S231 222 278 207 S336 233 385 203 S443 184 477 160 S543 173 587 141 S648 128 714 91"/>' +
                        '<g class="bergwelt-hiker" id="bergwelt-hiker" transform="translate(34 279)" aria-hidden="true"><ellipse class="bergwelt-hiker-shadow" cx="0" cy="2" rx="11" ry="3.5"/><path class="bergwelt-hiker-pole" d="M7 -7 L12 11"/><rect class="bergwelt-hiker-pack" x="-7" y="-12" width="6" height="11" rx="2"/><circle class="bergwelt-hiker-head" cx="0" cy="-15" r="4.5"/><path class="bergwelt-hiker-body" d="M0 -10 L1 1 M0 -7 L-7 -2 M0 -7 L7 -4 M1 1 L-6 10 M1 1 L8 8"/></g>' +
                        '<path class="bergwelt-tour-summit-flag" d="M714 91 V58 L740 66 L714 75"/><circle class="bergwelt-tour-summit-point" cx="714" cy="91" r="4"/>' +
                    '</svg>' +
                    '<div class="bergwelt-tour-scene-vignette"></div>' +
                    '<div class="bergwelt-tour-scene-caption"><span class="bergwelt-tour-scene-kicker" id="bergwelt-tour-scene-kicker">ETAPPE 01 / ' + String(stepCount).padStart(2, '0') + '</span><h3 id="bergwelt-tour-scene-title">Aufbruch</h3><p id="bergwelt-tour-scene-copy">' + escapeHTML(steps[0].value) + '</p></div>' +
                    summitReveal +
                    '<span class="bergwelt-tour-symbolic-note">KULISSE SYMBOLISCH · KEINE GPS-ROUTE</span>' +
                '</div>' +
                '<div class="bergwelt-tour-progress" role="progressbar" aria-label="Fortschritt der Expedition" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="bergwelt-tour-progress-fill"></span></div>' +
                '<div class="bergwelt-tour-progress-meta"><span id="bergwelt-tour-progress-label">Bereit zum Aufbruch</span><strong id="bergwelt-tour-progress-percent">0 %</strong></div>' +
                '<div class="bergwelt-tour-transport">' +
                    '<button type="button" class="bergwelt-tour-transport-secondary" id="bergwelt-tour-prev" aria-label="Vorherige Etappe">‹ <span>Zurück</span></button>' +
                    '<button type="button" class="bergwelt-tour-transport-primary" id="bergwelt-tour-toggle">▶ Expedition starten</button>' +
                    '<button type="button" class="bergwelt-tour-transport-secondary" id="bergwelt-tour-next" aria-label="Nächste Etappe"><span>Weiter</span> ›</button>' +
                    '<button type="button" class="bergwelt-tour-transport-restart" id="bergwelt-tour-restart" aria-label="Expedition neu starten">↻ Neu starten</button>' +
                '</div>' +
                '<p class="bergwelt-tour-stage-hint">Du kannst die Etappen direkt auswählen oder die Expedition abspielen, pausieren und fortsetzen.</p>' +
                '<div class="bergwelt-tour-steps" id="bergwelt-tour-steps" aria-label="Tour-Etappen">' + stepMarkup + '</div>' +
            '</section>' +
            '<section class="bergwelt-tour-finale" id="bergwelt-tour-finale" hidden aria-live="polite">' +
                '<p class="bergwelt-tour-finale-kicker">EXPEDITION ABGESCHLOSSEN</p>' +
                '<h3>Dieser Gipfel gehört zu deiner Geschichte.</h3>' +
                '<p>' + escapeHTML(title) + ' · ' + (tourAscent !== null ? fmt(tourAscent) + ' hm Aufstieg' : 'Dein Bergabenteuer') + (tourDistance !== null ? ' · ' + fmt(tourDistance, 1) + ' km' : '') + '</p>' +
                seasonHighlightMarkup +
                '<button type="button" class="bergwelt-tour-finale-return" data-bergwelt-back-to-moments>Meine Saisonmomente ansehen →</button>' +
            '</section>' +
            '<h3 class="bergwelt-section-title">' + escapeHTML(title) + '</h3><div class="bergwelt-grid">' +
            statCard('Strecke', fmtKnown(tourDistance, 1), 'km') + statCard('Aufstieg', fmtKnown(tourAscent), 'hm') +
            statCard('Gehzeit', duration === null ? '–' : fmt(duration / 60, 1), 'h') +
            statCard('Steilheit', fmtKnown(steepness), 'hm/km') +
            '</div><p class="bergwelt-footnote">Die Berglandschaft und der Wanderweg sind symbolisch, kein aufgezeichnetes Höhenprofil und keine echte Route. Es werden keine Streckenverläufe oder Gipfelnamen erfunden. Steilheit wird wie in Stats/Highlights berechnet.</p>';

        const originalPhoto = document.getElementById('bergwelt-tour-original-photo');
        const applyOriginalPhoto = imageData => {
            if (!originalPhoto || !imageData || !String(imageData).startsWith('data:image/')) return;
            originalPhoto.src = imageData;
            originalPhoto.hidden = false;
            originalPhoto.classList.add('is-loaded');
        };
        if (e.imageData) {
            applyOriginalPhoto(e.imageData);
        } else if (e.hasImage && e.id && typeof window.loadTourImagesForEntries === 'function') {
            const photoTourId = String(e.id);
            window.loadTourImagesForEntries([{ ...e }]).then(loadedEntries => {
                const loaded = loadedEntries?.[0];
                const currentSelect = document.getElementById('bergwelt-tour-select');
                if (currentSelect?.value === photoTourId && loaded?.imageData) applyOriginalPhoto(loaded.imageData);
            }).catch(error => console.warn('[Bergwelt] Originalfoto konnte nicht geladen werden:', error));
        }

        const scene = document.getElementById('bergwelt-animation');
        const path = document.getElementById('bergwelt-tour-route-bed');
        const progressPath = document.getElementById('bergwelt-tour-progress-path');
        const hiker = document.getElementById('bergwelt-hiker');
        const fill = document.getElementById('bergwelt-tour-progress-fill');
        const progressTrack = panel.querySelector('.bergwelt-tour-progress[role="progressbar"]');
        const finale = document.getElementById('bergwelt-tour-finale');
        const toggleButton = document.getElementById('bergwelt-tour-toggle');
        const restartButton = document.getElementById('bergwelt-tour-restart');
        const prevButton = document.getElementById('bergwelt-tour-prev');
        const nextButton = document.getElementById('bergwelt-tour-next');
        const liveStatus = document.getElementById('bergwelt-tour-live-status');
        const chapter = document.getElementById('bergwelt-tour-chapter');
        const sceneKicker = document.getElementById('bergwelt-tour-scene-kicker');
        const sceneTitle = document.getElementById('bergwelt-tour-scene-title');
        const sceneCopy = document.getElementById('bergwelt-tour-scene-copy');
        const progressLabel = document.getElementById('bergwelt-tour-progress-label');
        const progressPercent = document.getElementById('bergwelt-tour-progress-percent');
        if (!scene || !path || !progressPath || !hiker || !toggleButton) return;

        const runId = ++animationRun;
        const pathLength = path.getTotalLength();
        progressPath.style.strokeDasharray = String(pathLength);
        progressPath.style.strokeDashoffset = String(pathLength);
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const durationMs = reduceMotion ? 650 : Math.max(7200, stepCount * 1650);
        let tourProgress = 0;
        let playing = false;
        let frameId = 0;
        let playFromProgress = 0;
        let playFromTime = 0;

        const stepButtons = Array.from(scene.querySelectorAll('[data-tour-step]'));
        const stepStates = stepButtons.map(button => button.querySelector('.bergwelt-tour-step-state'));
        let storyRail = panel.querySelector('.bergwelt-story-rail');
        let lastRenderedStageIndex = -1;
        let lastPercent = -1;
        let lastProgressLabel = '';
        let lastLiveStatus = '';
        let lastToggleLabel = '';
        let lastPlayingState = null;
        let lastCompleteState = false;
        let lastSummitState = null;

        const getStageIndex = progress => progress >= 1
            ? stepCount - 1
            : Math.max(0, Math.min(stepCount - 1, Math.floor(progress * stepCount)));

        const updateView = progress => {
            const previousProgress = tourProgress;
            tourProgress = Math.max(0, Math.min(1, progress));
            const stageIndex = getStageIndex(tourProgress);
            const percent = Math.round(tourProgress * 100);
            const isComplete = tourProgress >= 1;
            const point = path.getPointAtLength(pathLength * tourProgress);
            hiker.setAttribute('transform', 'translate(' + point.x + ' ' + point.y + ')');
            progressPath.style.strokeDashoffset = String(pathLength * (1 - tourProgress));
            if (fill) fill.style.width = (tourProgress * 100) + '%';
            if (percent !== lastPercent) {
                if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percent));
                if (progressPercent) progressPercent.textContent = fmt(percent) + ' %';
                lastPercent = percent;
            }

            if (stageIndex !== lastRenderedStageIndex) {
                if (chapter) chapter.textContent = 'EXPEDITION · ETAPPE ' + String(stageIndex + 1).padStart(2, '0');
                if (sceneKicker) sceneKicker.textContent = 'ETAPPE ' + String(stageIndex + 1).padStart(2, '0') + ' / ' + String(stepCount).padStart(2, '0');
                if (sceneTitle) sceneTitle.textContent = steps[stageIndex].title;
                if (sceneCopy) sceneCopy.textContent = steps[stageIndex].value;
                scene.setAttribute('data-stage', String(stageIndex));
                stepButtons.forEach((stepButton, i) => {
                    stepButton.classList.toggle('is-revealed', i <= stageIndex);
                    stepButton.classList.toggle('is-current', i === stageIndex);
                    stepButton.setAttribute('aria-pressed', String(i === stageIndex));
                    if (stepStates[i]) stepStates[i].textContent = i < stageIndex ? '✓' : i === stageIndex ? '●' : '○';
                });
                if (prevButton) prevButton.disabled = stageIndex <= 0 && tourProgress <= 0;
                if (nextButton) nextButton.disabled = stageIndex >= stepCount - 1;
                lastRenderedStageIndex = stageIndex;
            }

            const progressText = playing ? 'Du bist unterwegs' : isComplete ? 'Expedition abgeschlossen' : tourProgress > 0 ? 'Expedition pausiert' : 'Bereit zum Aufbruch';
            const statusText = playing ? 'UNTERWEGS' : isComplete ? 'ABGESCHLOSSEN' : tourProgress > 0 ? 'PAUSIERT' : 'BEREIT';
            if (progressLabel && progressText !== lastProgressLabel) {
                progressLabel.textContent = progressText;
                lastProgressLabel = progressText;
            }
            if (liveStatus && statusText !== lastLiveStatus) {
                liveStatus.textContent = statusText;
                lastLiveStatus = statusText;
            }
            if (playing !== lastPlayingState) {
                scene.classList.toggle('is-running', playing);
                lastPlayingState = playing;
            }
            if (isComplete !== lastCompleteState) {
                scene.classList.toggle('is-complete', isComplete);
                if (finale) finale.hidden = !isComplete;
                if (storyRail) {
                    storyRail.outerHTML = experienceStoryRail(isComplete ? 'finale' : 'expedition');
                    storyRail = panel.querySelector('.bergwelt-story-rail');
                }
                if (isComplete && previousProgress < 1 && finale) {
                    finale.scrollIntoView({
                        behavior: reduceMotion ? 'auto' : 'smooth',
                        block: 'nearest'
                    });
                }
                lastCompleteState = isComplete;
            }
            const isSummitMoment = summitIndex >= 0 && stageIndex === summitIndex;
            if (isSummitMoment !== lastSummitState) {
                scene.classList.toggle('is-summit-moment', isSummitMoment);
                lastSummitState = isSummitMoment;
            }
            const toggleLabel = playing ? 'Ⅱ Pause' : isComplete ? '↻ Noch einmal erleben' : tourProgress > 0 ? '▶ Weiter' : '▶ Expedition starten';
            if (toggleButton && toggleLabel !== lastToggleLabel) {
                toggleButton.textContent = toggleLabel;
                lastToggleLabel = toggleLabel;
            }
        };

        const stopAnimation = () => {
            playing = false;
            if (frameId) window.cancelAnimationFrame(frameId);
            frameId = 0;
        };
        activeTourCleanup = () => {
            stopAnimation();
            animationRun++;
        };

        const animateFrame = now => {
            if (runId !== animationRun || !scene.isConnected || !playing) return;
            const elapsed = now - playFromTime;
            const progress = playFromProgress + (elapsed / durationMs) * (1 - playFromProgress);
            if (progress >= 1) {
                playing = false;
                frameId = 0;
                updateView(1);
                return;
            }
            updateView(progress);
            frameId = window.requestAnimationFrame(animateFrame);
        };

        const startAnimation = () => {
            if (playing) return;
            if (tourProgress >= 1) updateView(0);
            playing = true;
            playFromProgress = tourProgress;
            playFromTime = performance.now();
            updateView(tourProgress);
            frameId = window.requestAnimationFrame(animateFrame);
        };

        const chooseStage = stageIndex => {
            stopAnimation();
            const nextIndex = Math.max(0, Math.min(stepCount - 1, stageIndex));
            updateView(Math.min(0.999, (nextIndex + 0.2) / stepCount));
        };

        document.getElementById('bergwelt-tour-select')?.addEventListener('change', ev => {
            stopAnimation();
            selectedTourId = ev.target.value;
            renderTour();
        });
        toggleButton.addEventListener('click', () => {
            if (playing) {
                stopAnimation();
                updateView(tourProgress);
            } else {
                startAnimation();
            }
        });
        restartButton?.addEventListener('click', () => {
            stopAnimation();
            updateView(0);
            startAnimation();
        });
        prevButton?.addEventListener('click', () => chooseStage(getStageIndex(tourProgress) - 1));
        nextButton?.addEventListener('click', () => chooseStage(getStageIndex(tourProgress) + 1));
        stepButtons.forEach(stepButton => {
            stepButton.addEventListener('click', () => chooseStage(Number(stepButton.dataset.tourStep)));
        });
        updateView(0);
    }
    function render() {
        if (!(activeTab === 'erlebnis' && experienceMode === 'tour') && activeTourCleanup) {
            activeTourCleanup();
            activeTourCleanup = null;
        }
        if (activeTab === 'erlebnis' && experienceMode === 'momente') return renderMomente();
        root.classList.add('bergwelt-mode');
        panel.hidden = false;
        if (activeTab === 'hoehenwelt') renderHoehenwelt();
        else if (activeTab === 'level') renderLevel();
        else if (activeTab === 'erlebnis' && experienceMode === 'tour') renderTour();
    }
    panel.addEventListener('click', event => {
        const backToMoments = event.target.closest('[data-bergwelt-back-to-moments]');
        if (backToMoments) {
            experienceMode = 'momente';
            render();
            return;
        }
        const closeButton = event.target.closest('[data-bergwelt-height-milestone-close]');
        if (closeButton) {
            selectedHeightMilestone = null;
            renderHoehenwelt();
            return;
        }
        const milestoneButton = event.target.closest('[data-bergwelt-height-milestone]');
        if (!milestoneButton) return;
        const height = Number(milestoneButton.dataset.bergweltHeightMilestone);
        if (!Number.isFinite(height) || height <= 0) return;
        selectedHeightMilestone = selectedHeightMilestone === height ? null : height;
        renderHoehenwelt();
    });
    document.getElementById('wrapped-open-tour-btn')?.addEventListener('click', () => {
        activeTab = 'erlebnis';
        experienceMode = 'tour';
        tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
            const active = tab.dataset.bergweltTab === 'erlebnis';
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        render();
    });
    tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-bergwelt-tab]');
        if (!button) return;
        activeTab = button.dataset.bergweltTab;
        experienceMode = 'momente';
        tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
            const active = tab === button;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        render();
    });
    document.getElementById('wrapped-year-select')?.addEventListener('change', () => {
        if (activeTab !== 'erlebnis' || experienceMode === 'tour') render();
    });
    document.getElementById('wrapped-toggle')?.addEventListener('click', () => {
        activeTab = 'erlebnis';
        experienceMode = 'momente';
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