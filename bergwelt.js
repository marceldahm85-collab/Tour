(function () {
    'use strict';
    if (window.__BERGWELT_MODULE_READY__) return;
    window.__BERGWELT_MODULE_READY__ = true;

    const root = document.getElementById('wrapped-view');
    const tabs = document.getElementById('bergwelt-tabs');
    const panel = document.getElementById('bergwelt-panel');
    if (!root || !tabs || !panel) return;

    const tabNames = {
        momente: 'Momente',
        hoehenwelt: 'Höhenwelt',
        level: 'Level',
        tour: 'Tour erleben'
    };
    let activeTab = 'momente';
    let selectedTourId = '';
    let animationRun = 0;

    const getTours = () => {
        try {
            const value = window.__bergweltGetTours?.();
            return Array.isArray(value) ? value.filter(x => x && typeof x === 'object') : [];
        } catch (_) { return []; }
    };
    const parseNumber = value => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const n = Number.parseFloat(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : 0;
    };
    const parseMinutes = value => {
        const m = String(value || '').match(/^(\d{1,3}):(\d{1,2})$/);
        return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
    };
    const dateYear = entry => {
        const raw = String(entry?.date || '');
        const match = raw.match(/^(\d{4})[-/.]/);
        if (match) return Number(match[1]);
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d.getFullYear();
    };
    const fmt = (n, digits = 0) => Number(n || 0).toLocaleString('de-AT', { maximumFractionDigits: digits, minimumFractionDigits: digits });
    const escapeHTML = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const getYear = () => Number(document.getElementById('wrapped-year-select')?.value) || new Date().getFullYear();
    const yearTours = () => getTours().filter(e => dateYear(e) === getYear());
    const ascent = e => Math.max(0, parseNumber(e.aufstieg));
    const distance = e => Math.max(0, parseNumber(e.strecke));
    const minutes = e => parseMinutes(e.zeit);
    const peaks = e => Math.max(0, parseNumber(e.gipfel));
    const uniqueTourCount = entries => {
        const ids = new Set();
        entries.forEach((e, i) => ids.add(e.tourGroup ? 'group:' + e.tourGroup : (e.id ? 'id:' + e.id : 'entry:' + i + ':' + String(e.date || '') + ':' + String(e.tourname || ''))));
        return ids.size;
    };
    const sum = (entries, getter) => entries.reduce((acc, e) => acc + getter(e), 0);
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
        const total = sum(entries, ascent);
        const metres = [3798, 8848, 26544];
        const next = metres.find(v => v > total) || null;
        const comparison = total >= 26544 ? 'Dein kumulierter Aufstieg entspricht mindestens drei Everest-Höhen.' :
            total >= 8848 ? 'Das entspricht mindestens einer Everest-Höhe an kumuliertem Aufstieg.' :
            total >= 3798 ? 'Dein kumulierter Aufstieg übertrifft die Höhe des Großglockners.' :
            'Jeder gespeicherte Höhenmeter zählt – Schritt für Schritt wächst deine Höhenwelt.';
        const markerCards = [
            { name: 'Großglockner', height: 3798 },
            { name: 'Everest', height: 8848 },
            { name: 'Drei Everest-Höhen', height: 26544 }
        ];
        panel.innerHTML = intro('Dein Höhenkonto · ' + getYear(), 'Höhenwelt', 'Dein gespeicherter Aufstieg als persönliche Höhenmarke – symbolisch verglichen, nicht geografisch dargestellt.') +
            '<div class="bergwelt-grid">' +
            statCard('Aufstieg im Jahr', fmt(total), 'hm') +
            statCard('Noch bis 3.000 hm', fmt(Math.max(0, 3000 - total)), 'hm', Math.min(100, total / 3000 * 100)) +
            '</div><h3 class="bergwelt-section-title">Bergmarken zum Vergleich</h3><div class="bergwelt-grid">' +
            markerCards.map(m => statCard(m.name, fmt(m.height), 'm', Math.min(100, total / m.height * 100))).join('') +
            '</div><p class="bergwelt-footnote">' + escapeHTML(comparison) + (next ? ' Nächste persönliche Vergleichsmarke: ' + fmt(next) + ' hm.' : '') + ' Es werden nur gespeicherte Aufstiegswerte addiert.</p>';
    }
    function renderLevel() {
        const entries = yearTours();
        const dist = sum(entries, distance);
        const asc = sum(entries, ascent);
        const mins = sum(entries, minutes);
        const peakCount = sum(entries, peaks);
        const maxAscent = Math.max(0, ...entries.map(ascent));
        const maxSteepness = Math.max(0, ...entries.map(e => distance(e) > 0 ? ascent(e) / distance(e) : 0));
        const maxSteps = Math.max(0, ...entries.map(e => parseNumber(e.schritte || e.steps)));
        const definitions = [
            ['Höhenmeter-Spezialist', asc, 5000, '5.000 hm Jahresaufstieg'],
            ['Gipfelsammler', peakCount, 10, '10 gespeicherte Gipfel'],
            ['Ausdauer-Alpinist', mins / 60, 25, '25 Stunden Gehzeit'],
            ['Steilheits-Profi', maxSteepness, 200, '200 hm/km bei einer Tour'],
            ['Vielseitiger Wanderer', new Set(entries.map(e => String(e.aktivitaet || e.tourart || e.typ || '').trim()).filter(Boolean)).size, 3, '3 gespeicherte Aktivitätstypen']
        ];
        const levels = definitions.map(([name, value, target, detail]) => ({ name, value, target, detail, pct: Math.min(100, value / target * 100) }));
        panel.innerHTML = intro('Dein Profil · ' + getYear(), 'Dein Bergsteiger-Level', 'Fünf nachvollziehbare Spezialisierungen auf Basis deiner gespeicherten Touren. Die Zielwerte sind Orientierung, keine Wertung.') +
            '<div class="bergwelt-grid">' +
            statCard('Jahresstrecke', fmt(dist, 1), 'km') +
            statCard('Stärkster Einzelaufstieg', fmt(maxAscent), 'hm') +
            statCard('Gehzeit gesamt', fmt(mins / 60, 1), 'h') +
            statCard('Gespeicherte Gipfel', fmt(peakCount), 'Gipfel') +
            '</div><h3 class="bergwelt-section-title">Spezialisierungen</h3>' +
            levels.map(l => '<div class="bergwelt-level"><div class="bergwelt-level-top"><strong>' + l.name + '</strong><span>' + fmt(l.value, l.name === 'Ausdauer-Alpinist' ? 1 : 0) + ' / ' + fmt(l.target) + '</span></div><div class="bergwelt-track"><span style="width:' + l.pct + '%"></span></div><p class="bergwelt-footnote">' + l.detail + '</p></div>').join('') +
            '<p class="bergwelt-footnote">Steilheit = gespeicherter Aufstieg ÷ gespeicherte Strecke. Schritte werden nur ausgewertet, wenn sie direkt in den Tourdaten vorliegen.</p>';
    }
    function renderTour() {
        const entries = yearTours().slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        if (!entries.length) {
            panel.innerHTML = intro('Deine Erinnerung', 'Tour erleben', 'Wähle eine gespeicherte Tour aus und lass ihre Kennzahlen nacheinander erscheinen.') + empty('Für ' + getYear() + ' sind keine Touren gespeichert.');
            return;
        }
        if (!entries.some((e, i) => String(e.id || i) === selectedTourId)) selectedTourId = String(entries[0].id || 0);
        const index = Math.max(0, entries.findIndex((e, i) => String(e.id || i) === selectedTourId));
        const e = entries[index];
        const title = e.tourname || e.region || 'Unbenannte Tour';
        panel.innerHTML = intro('Tour in Erinnerung · ' + getYear(), 'Tour erleben', 'Eine kleine Inszenierung deiner gespeicherten Tourdaten – ohne erfundene GPS-Route oder Höhenprofil.') +
            '<div class="bergwelt-tour-row"><select class="bergwelt-select" id="bergwelt-tour-select" aria-label="Gespeicherte Tour auswählen">' +
            entries.map((item, i) => '<option value="' + escapeHTML(String(item.id || i)) + '"' + (String(item.id || i) === selectedTourId ? ' selected' : '') + '>' + escapeHTML(item.date || '') + ' · ' + escapeHTML(item.tourname || item.region || 'Unbenannte Tour') + '</option>').join('') +
            '</select><button type="button" class="bergwelt-action" id="bergwelt-play-tour">▶ Erleben</button></div>' +
            '<div class="bergwelt-animation" id="bergwelt-animation"><svg class="bergwelt-mountain" viewBox="0 0 600 130" role="img" aria-label="Symbolische Berglinie, kein aufgezeichnetes Höhenprofil"><path d="M12 112 L92 88 L145 101 L226 34 L282 74 L335 58 L405 14 L465 66 L512 48 L588 106"/></svg></div>' +
            '<h3 class="bergwelt-section-title">' + escapeHTML(title) + '</h3><div class="bergwelt-grid">' +
            statCard('Strecke', fmt(distance(e), 1), 'km') + statCard('Aufstieg', fmt(ascent(e)), 'hm') +
            statCard('Gehzeit', fmt(minutes(e) / 60, 1), 'h') + statCard('Steilheit', fmt(distance(e) ? ascent(e) / distance(e) : 0), 'hm/km') +
            '</div><p class="bergwelt-footnote">Die Berglinie ist eine dekorative Animation und stellt keine tatsächliche Tourengeometrie dar. Es werden keine fehlenden Messwerte ergänzt.</p>';
        document.getElementById('bergwelt-tour-select')?.addEventListener('change', ev => {
            selectedTourId = ev.target.value;
            renderTour();
        });
        document.getElementById('bergwelt-play-tour')?.addEventListener('click', () => {
            const mountain = document.getElementById('bergwelt-animation');
            if (!mountain) return;
            mountain.classList.remove('is-running');
            void mountain.offsetWidth;
            mountain.classList.add('is-running');
            animationRun++;
            const button = document.getElementById('bergwelt-play-tour');
            if (button) {
                button.textContent = '⛰️ Unterwegs …';
                window.setTimeout(() => { if (button.isConnected) button.textContent = '↻ Nochmal erleben'; }, 1900);
            }
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