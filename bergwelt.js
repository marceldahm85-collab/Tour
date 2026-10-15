(function () {
    'use strict';
    if (window.__BERGWELT_MODULE_READY__) return;
    window.__BERGWELT_MODULE_READY__ = true;

    const root = document.getElementById('wrapped-view');
    const tabs = document.getElementById('bergwelt-tabs');
    const panel = document.getElementById('bergwelt-panel');
    if (!root || !tabs || !panel) return;
    root.classList.add('bergwelt-ready');

    const tabNames = {
        momente: 'Momente',
        hoehenwelt: 'Höhenwelt',
        level: 'Level',
        tour: 'Tour erleben'
    };
    let activeTab = 'momente';
    let selectedTourId = '';
    let selectedHeightMilestone = null;
    let animationRun = 0;

    const getTours = () => {
        try {
            const value = window.__bergweltGetTours?.();
            return Array.isArray(value) ? value.filter(x => x && typeof x === 'object') : [];
        } catch (_) { return []; }
    };
    // Gemeinsame Leser: fehlende Messwerte bleiben intern null.
    // Erst Summen/Anzeigen wandeln fehlende Werte bewusst in 0 um.
    const readMetric = value => {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
        const normalized = String(value).replace(/\s/g, '').replace(',', '.');
        if (!normalized) return null;
        const n = Number(normalized);
        return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const parseNumber = value => readMetric(value) ?? 0;
    const parseMinutes = value => {
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const m = String(value).trim().match(/^(\d{1,4}):([0-5]?\d)$/);
        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
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
    const dateYear = entry => parseTourDate(entry?.date)?.getFullYear() ?? null;
    const fmt = (n, digits = 0) => Number(n || 0).toLocaleString('de-AT', { maximumFractionDigits: digits, minimumFractionDigits: digits });
    const escapeHTML = value => String(value ?? '').replace(/[&<>\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[ch]));
    const getYear = () => Number(document.getElementById('wrapped-year-select')?.value) || new Date().getFullYear();
    const yearTours = () => getTours().filter(e => dateYear(e) === getYear());
    const ascentValue = e => readMetric(e?.aufstieg);
    const distanceValue = e => readMetric(e?.strecke);
    const minutesValue = e => parseMinutes(e?.zeit);
    const peaksValue = e => readMetric(e?.gipfel);
    const ascent = e => ascentValue(e) ?? 0;
    const distance = e => distanceValue(e) ?? 0;
    const minutes = e => minutesValue(e) ?? 0;
    const peaks = e => peaksValue(e) ?? 0;
    const tourIdentity = (entry, index = 0) => {
        if (entry?.tourGroup !== undefined && entry?.tourGroup !== null && String(entry.tourGroup).trim()) return 'group:' + String(entry.tourGroup);
        if (entry?.id !== undefined && entry?.id !== null && String(entry.id).trim()) return 'id:' + String(entry.id);
        const fingerprint = [entry?.date, entry?.tourname, entry?.region, entry?.tourDay].map(v => String(v ?? '').trim()).join('|');
        return fingerprint.replace(/\|/g, '') ? 'entry:' + fingerprint : 'entry-index:' + index;
    };
    const uniqueTourCount = entries => new Set(entries.map((entry, index) => tourIdentity(entry, index))).size;
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
        const milestones = [
            { name: 'Großglockner', height: 3798 },
            { name: 'Everest', height: 8848 },
            { name: 'Drei Everest-Höhen', height: 26544 },
            { name: '50.000 Höhenmeter', height: 50000 },
            { name: '100.000 Höhenmeter', height: 100000 }
        ];
        const next = careerAscent === null ? null : (milestones.find(m => m.height > total) || null);
        // Fortschritt bedeutet hier: gesammelte Höhenmeter im Verhältnis zum nächsten Ziel.
        // Dadurch stimmt der Wert mit den Prozentangaben in den einzelnen Höhenmarken überein.
        const progress = careerAscent === null ? 0 : next
            ? Math.max(0, Math.min(100, total / next.height * 100))
            : 100;
        const comparison = careerAscent === null ? 'Für deine gespeicherten Touren liegen keine gültigen Aufstiegswerte vor.' :
            total >= 100000 ? 'Du hast die Marke von 100.000 Höhenmetern überschritten – eine außergewöhnliche persönliche Leistung.' :
            total >= 50000 ? 'Du hast bereits mehr als 50.000 Höhenmeter gesammelt. Die nächste große Marke wartet.' :
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
                    '<span class="bergwelt-height-milestone-mark" aria-hidden="true">' + (reached ? '✦' : String(i + 1).padStart(2, '0')) + '</span>' +
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
        panel.innerHTML = intro('Dein Profil · ' + getYear(), 'Dein Bergsteiger-Level', 'Fünf Spezialisierungen mit klaren Schwellen. Jede Stufe basiert auf gespeicherten Tourdaten; fehlende Werte bleiben unbekannt.') +
            '<div class="bergwelt-grid">' +
            statCard('Jahresstrecke', fmtKnown(dist, 1), 'km') +
            statCard('Stärkster Einzelaufstieg', fmtKnown(maxAscent), 'hm') +
            statCard('Gehzeit gesamt', mins === null ? '–' : fmt(mins / 60, 1), 'h') +
            statCard('Gespeicherte Gipfel', fmtKnown(peakCount), 'Gipfel') +
            '</div><h3 class="bergwelt-section-title">Deine Spezialisierungen</h3>' +
            levels.map(l => {
                const valueText = l.value === null ? '– ' + l.unit : fmt(l.value, l.name === 'Ausdauer-Alpinist' ? 1 : (l.name === 'Steilheits-Profi' ? 0 : 0)) + ' ' + l.unit;
                const tierText = l.value === null
                    ? 'Noch nicht bestimmbar'
                    : l.current
                        ? l.current[1]
                        : 'Noch keine Stufe erreicht';
                const goalText = l.value === null
                    ? 'Es fehlen gültige Daten für diese Spezialisierung.'
                    : l.next
                        ? fmt(Math.max(0, l.next[0] - l.value), l.name === 'Ausdauer-Alpinist' || l.name === 'Steilheits-Profi' ? 1 : 0) + ' ' + l.unit + ' bis ' + l.next[1] + ' (' + fmt(l.next[0]) + ' ' + l.unit + ')'
                        : 'Höchste definierte Stufe erreicht – weitere Fortschritte werden weiterhin gezählt.';
                return '<div class="bergwelt-level"><div class="bergwelt-level-top"><strong>' + l.name + '</strong><span>' + valueText + '</span></div>' +
                    '<div class="bergwelt-level-tier">' + tierText + '</div>' +
                    (l.pct === null ? '<p class="bergwelt-footnote">' + goalText + '</p>' : '<div class="bergwelt-track"><span style="width:' + l.pct + '%"></span></div><p class="bergwelt-footnote">' + goalText + '</p>') +
                    '<p class="bergwelt-footnote">' + l.detail + '</p></div>';
            }).join('') +
            '<p class="bergwelt-footnote">Die Höhenmeter-, Gipfel- und Gehzeitstufen beziehen sich auf das ausgewählte Jahr. Steilheit wird nur aus Touren mit gültiger Strecke und gültigem Aufstieg berechnet. Aktivitätstypen werden nur gezählt, wenn sie in den gespeicherten Daten vorhanden sind.</p>';
    }
        function renderTour() {
        const entries = yearTours().slice().sort((a, b) => {
            const dateDiff = (parseTourDate(b.date)?.getTime() || 0) - (parseTourDate(a.date)?.getTime() || 0);
            return dateDiff || Number(a.tourDay || 0) - Number(b.tourDay || 0);
        });
        if (!entries.length) {
            panel.innerHTML = intro('Deine Erinnerung', 'Tour erleben', 'Wähle eine gespeicherte Tour aus und lass ihre Kennzahlen nacheinander erscheinen.') + empty('Für ' + getYear() + ' sind keine Touren gespeichert.');
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
        const steps = [
            { title: 'Aufbruch', value: dateLabel + stageLabel + groupLabel },
            { title: 'Strecke', value: tourDistance === null ? 'Keine Streckenangabe gespeichert' : fmt(tourDistance, 1) + ' km' },
            { title: 'Anstieg', value: tourAscent === null ? 'Kein Aufstiegswert gespeichert' : fmt(tourAscent) + ' hm' }
        ];
        if (peakCount !== null && peakCount > 0) steps.push({ title: 'Gipfelmoment', value: fmt(peakCount) + (peakCount === 1 ? ' gespeicherter Gipfel' : ' gespeicherte Gipfel') });
        steps.push({ title: 'Ankommen', value: duration === null ? 'Keine Gehzeit gespeichert' : fmt(duration / 60, 1) + ' h Gehzeit' });
        panel.innerHTML = intro('Tour in Erinnerung · ' + getYear(), 'Tour erleben', 'Starte deine Expedition. Die Etappen werden nacheinander freigeschaltet; verwendet werden nur die zu dieser Tour gespeicherten Angaben.') +
            '<div class="bergwelt-tour-row"><select class="bergwelt-select" id="bergwelt-tour-select" aria-label="Gespeicherte Tour auswählen">' +
            entries.map((item, i) => {
                const stage = item.tourDay && item.tourDayCount ? ' · Etappe ' + item.tourDay + '/' + item.tourDayCount : '';
                const group = item.tourGroup ? ' · Mehrtagestour' : '';
                const itemId = String(item.id ?? i);
                return '<option value="' + escapeHTML(itemId) + '"' + (itemId === selectedTourId ? ' selected' : '') + '>' + escapeHTML(item.date || '') + ' · ' + escapeHTML(item.tourname || item.region || 'Unbenannte Tour') + escapeHTML(stage + group) + '</option>';
            }).join('') +
            '</select><button type="button" class="bergwelt-action" id="bergwelt-play-tour">▶ Expedition starten</button></div>' +
            '<div class="bergwelt-animation" id="bergwelt-animation">' +
                '<div class="bergwelt-tour-scene">' +
                    '<svg class="bergwelt-mountain" viewBox="0 0 600 130" role="img" aria-label="Symbolische Berglinie, kein aufgezeichnetes Höhenprofil">' +
                        '<path id="bergwelt-tour-path" d="M12 112 L92 88 L145 101 L226 34 L282 74 L335 58 L405 14 L465 66 L512 48 L588 106"/>' +
                        '<circle class="bergwelt-hiker" id="bergwelt-hiker" r="7" cx="12" cy="112"/>' +
                    '</svg>' +
                    '<div class="bergwelt-tour-progress" aria-hidden="true"><span id="bergwelt-tour-progress-fill"></span></div>' +
                    '<div class="bergwelt-tour-progress-label" id="bergwelt-tour-progress-label">Bereit zum Aufbruch</div>' +
                '</div>' +
                '<div class="bergwelt-tour-steps" aria-live="polite">' +
                    steps.map((step, i) => '<div class="bergwelt-tour-step" data-step="' + i + '"><span>' + String(i + 1).padStart(2, '0') + '</span><div><strong>' + escapeHTML(step.title) + '</strong><small>' + escapeHTML(step.value) + '</small></div></div>').join('') +
                '</div>' +
            '</div>' +
            '<h3 class="bergwelt-section-title">' + escapeHTML(title) + '</h3><div class="bergwelt-grid">' +
            statCard('Strecke', fmtKnown(tourDistance, 1), 'km') + statCard('Aufstieg', fmtKnown(tourAscent), 'hm') +
            statCard('Gehzeit', duration === null ? '–' : fmt(duration / 60, 1), 'h') +
            statCard('Steilheit', fmtKnown(steepness), 'hm/km') +
            '</div><p class="bergwelt-footnote">Die Berglinie ist symbolisch und kein aufgezeichnetes Höhenprofil. Es werden keine GPS-Route, Höhenverläufe oder Gipfelnamen erfunden. Steilheit wird wie in Stats/Highlights berechnet.</p>';
        document.getElementById('bergwelt-tour-select')?.addEventListener('change', ev => {
            selectedTourId = ev.target.value;
            animationRun++;
            renderTour();
        });
        document.getElementById('bergwelt-play-tour')?.addEventListener('click', () => {
            const scene = document.getElementById('bergwelt-animation');
            const path = document.getElementById('bergwelt-tour-path');
            const hiker = document.getElementById('bergwelt-hiker');
            const button = document.getElementById('bergwelt-play-tour');
            const fill = document.getElementById('bergwelt-tour-progress-fill');
            const label = document.getElementById('bergwelt-tour-progress-label');
            if (!scene || !path || !hiker || !button) return;
            const runId = ++animationRun;
            scene.classList.remove('is-running', 'is-complete');
            scene.querySelectorAll('.bergwelt-tour-step').forEach(step => step.classList.remove('is-revealed'));
            if (fill) fill.style.width = '0%';
            if (label) label.textContent = 'Aufbruch';
            const totalLength = path.getTotalLength();
            const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            button.disabled = true;
            button.textContent = '⛰️ Expedition läuft …';
            scene.classList.add('is-running');
            const durationMs = reduceMotion ? 100 : 5200;
            const startTime = performance.now();
            const revealCount = scene.querySelectorAll('.bergwelt-tour-step').length;
            const labels = ['Aufbruch', 'Strecke erkunden', 'Anstieg bewältigen', 'Gipfelmoment', 'Ankommen'];
            const frame = now => {
                if (runId !== animationRun || !scene.isConnected) return;
                const progress = Math.min(1, (now - startTime) / durationMs);
                const point = path.getPointAtLength(totalLength * progress);
                hiker.setAttribute('cx', String(point.x));
                hiker.setAttribute('cy', String(point.y));
                if (fill) fill.style.width = (progress * 100) + '%';
                const revealed = Math.min(revealCount, Math.floor(progress * revealCount) + 1);
                scene.querySelectorAll('.bergwelt-tour-step').forEach((step, i) => step.classList.toggle('is-revealed', i < revealed));
                if (label) label.textContent = progress >= 1 ? 'Tour abgeschlossen' : (labels[Math.min(labels.length - 1, revealed - 1)] || 'Unterwegs');
                if (progress < 1) {
                    window.requestAnimationFrame(frame);
                } else {
                    scene.classList.add('is-complete');
                    button.disabled = false;
                    button.textContent = '↻ Expedition erneut erleben';
                }
            };
            hiker.style.display = reduceMotion ? 'none' : '';
            window.requestAnimationFrame(frame);
        });
    }
    function render() {
        if (activeTab === 'momente') return renderMomente();
        root.classList.add('bergwelt-mode');
        panel.hidden = false;
        if (activeTab === 'hoehenwelt') renderHoehenwelt();
        else if (activeTab === 'level') renderLevel();
        else if (activeTab === 'tour') renderTour();
    }
    panel.addEventListener('click', event => {
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
    tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-bergwelt-tab]');
        if (!button) return;
        activeTab = button.dataset.bergweltTab;
        tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
            const active = tab === button;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        render();
    });
    document.getElementById('wrapped-year-select')?.addEventListener('change', () => {
        if (activeTab !== 'momente') render();
    });
    document.getElementById('wrapped-toggle')?.addEventListener('click', () => {
        activeTab = 'momente';
        tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
            const active = tab.dataset.bergweltTab === 'momente';
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        render();
    });
    window.__bergweltRender = render;
    render();
})();