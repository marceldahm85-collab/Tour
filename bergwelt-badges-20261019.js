(function () {
    'use strict';
    // Eigene Versionskennung verhindert, dass ein bereits geladenes älteres
    // Bergwelt-Modul die aktualisierten Abzeichen vorzeitig blockiert.
    if (window.__BERGWELT_BADGE_MODULE_VERSION__ === '20261102-bergwelt-experience-controls') return;
    window.__BERGWELT_BADGE_MODULE_VERSION__ = '20261102-bergwelt-experience-controls';
    window.__BERGWELT_MODULE_READY__ = true;

    const root = document.getElementById('wrapped-view');
    const tabs = document.getElementById('bergwelt-tabs');
    const panel = document.getElementById('bergwelt-panel');
    const tourbookPanel = document.getElementById('bergwelt-tourbuch-panel');
    const achievementsPanel = document.getElementById('bergwelt-achievements-panel');
    const tourbookCard = document.getElementById('pdf-export-card');
    if (!root || !tabs || !panel || !tourbookPanel || !achievementsPanel) return;
    root.classList.add('bergwelt-ready');
    if (tourbookCard && tourbookCard.parentNode !== tourbookPanel) {
        tourbookPanel.appendChild(tourbookCard);
    }

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
    let showOriginalStory = true;

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
        tourbookPanel.hidden = true;
        achievementsPanel.hidden = true;
        root.classList.remove('bergwelt-active-achievements', 'bergwelt-active-tourbuch');
        if (showOriginalStory) {
            panel.hidden = true;
            root.classList.remove('bergwelt-mode');
            root.classList.add('bergwelt-story-playing');
            return;
        }

        root.classList.remove('bergwelt-story-playing');
        root.classList.add('bergwelt-mode');
        panel.hidden = false;

        const entries = yearTours();
        const allEntries = getTours();
        const known = getter => entries.map(getter).filter(value => value !== null && value !== undefined && Number.isFinite(value));
        const totalDistance = sumKnown(entries, distanceValue);
        const totalAscent = sumKnown(entries, ascentValue);
        const totalMinutes = sumKnown(entries, minutesValue);
        const totalPeaks = sumKnown(entries, peaksValue);
        const bestAscent = entries.filter(entry => ascentValue(entry) !== null).sort((a, b) => ascent(b) - ascent(a))[0] || null;
        const longestTour = entries.filter(entry => distanceValue(entry) !== null).sort((a, b) => distance(b) - distance(a))[0] || null;
        const highestPeak = entries.reduce((best, entry) => {
            (Array.isArray(entry?.gipfelDetails) ? entry.gipfelDetails : []).forEach(peak => {
                if (!peak || (!peak.name && !peak.hoehe)) return;
                const height = parseFloat(String(peak.hoehe ?? '').replace(',', '.'));
                if (!Number.isFinite(height) || height <= 0) return;
                if (!best || height > best.height) {
                    best = { name: peak.name || 'Gipfel ohne Namen', height, entry };
                }
            });
            return best;
        }, null);
        // Gleiche Definition und Indexformel wie Stats → Highlights → Größte Big Tour:
        // Einzelne Tour/Etappe ab 10 km und 1.000 hm, mit derselben Zeitkorrektur.
        const biggestBigTour = entries.reduce((best, entry) => {
            const dist = distanceValue(entry) ?? 0;
            const hm = ascentValue(entry) ?? 0;
            if (dist < 10 || hm < 1000) return best;
            const baseIndex = 5 * dist + hm / 20;
            const minutesKnown = minutesValue(entry) ?? 0;
            let index = baseIndex;
            if (baseIndex > 0 && minutesKnown > 0) {
                const referenceHours = dist / 5 + hm / 600;
                const actualHours = minutesKnown / 60;
                if (referenceHours > 0 && actualHours > 0) {
                    const rawFactor = 1 + ((referenceHours / actualHours) - 1) * 0.5;
                    const timeFactor = Math.max(0.90, Math.min(1.10, rawFactor));
                    index = baseIndex * timeFactor;
                }
            }
            return !best || index > best.index ? { index, entry } : best;
        }, null);
        const mostPeaks = entries.filter(entry => peaksValue(entry) !== null).sort((a, b) => peaks(b) - peaks(a))[0] || null;
        const yearLabel = getYearLabel();
        const formatHours = value => value === null ? '–' : (value / 60).toLocaleString('de-AT', { maximumFractionDigits: 1 }) + ' h';
        const tourTitle = entry => escapeHTML(entry?.tourname || entry?.name || 'Tour ohne Titel');
        const tourMeta = entry => [entry?.region, entry?.date].filter(Boolean).map(escapeHTML).join(' · ');
        const icon = (name) => {
            const paths = {
                mountain: '<path d="m3 20 7-12 4 7 3-4 4 9H3Z"/><path d="m8 12 2 2 2-2"/>',
                route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h2a4 4 0 0 0 4-4v-1a4 4 0 0 1 4-4"/>',
                summit: '<path d="m3 20 7-13 4 6 3-4 4 11H3Z"/><path d="M10 7V3m-2 2h4"/>',
                time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
            };
            return '<svg class="bergwelt-cinematic-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.mountain) + '</svg>';
        };
        const metric = (label, value, unit, symbol) =>
            '<div class="bergwelt-cinematic-stat">' + icon(symbol) +
                '<span class="bergwelt-cinematic-stat-copy"><small>' + label + '</small><strong>' + value + '<i>' + unit + '</i></strong></span></div>';
        const highlightCard = (label, entry, value, unit, symbol, modifier) =>
            '<article class="bergwelt-cinematic-highlight ' + modifier + '">' +
                '<span class="bergwelt-cinematic-highlight-icon">' + icon(symbol) + '</span>' +
                '<span class="bergwelt-cinematic-highlight-label">' + label + '</span>' +
                '<strong>' + (entry ? tourTitle(entry) : 'Noch keine Daten') + '</strong>' +
                '<span class="bergwelt-cinematic-highlight-value">' + (entry ? fmt(value) + ' ' + unit : '–') + '</span>' +
                (entry && tourMeta(entry) ? '<span class="bergwelt-cinematic-highlight-meta">' + tourMeta(entry) + '</span>' : '') +
            '</article>';
        const highestPeakCard = peak => {
            const entry = peak?.entry;
            const meta = entry ? [entry.region, entry.date].filter(Boolean).map(escapeHTML).join(' · ') : '';
            return '<article class="bergwelt-cinematic-highlight is-peak">' +
                '<span class="bergwelt-cinematic-highlight-icon">' + icon('mountain') + '</span>' +
                '<span class="bergwelt-cinematic-highlight-label">HÖCHSTER GIPFEL</span>' +
                '<strong>' + (peak ? escapeHTML(peak.name) : 'Noch keine Daten') + '</strong>' +
                '<span class="bergwelt-cinematic-highlight-value">' + (peak ? fmt(peak.height) + ' m' : '–') + '</span>' +
                (meta ? '<span class="bergwelt-cinematic-highlight-meta">' + meta + '</span>' : '') +
            '</article>';
        };

        panel.innerHTML =
            '<section class="bergwelt-cinematic-hero" aria-labelledby="bergwelt-cinematic-title">' +
                '<div class="bergwelt-cinematic-hero-shade"></div>' +
                '<div class="bergwelt-cinematic-hero-content">' +
                    '<p class="bergwelt-cinematic-kicker"><span></span> DEIN ALPINES JAHR</p>' +
                    '<h2 id="bergwelt-cinematic-title">Deine<br><em>Bergwelt.</em></h2>' +
                    '<p class="bergwelt-cinematic-subtitle">' + yearLabel + ' · Deine Wege. Deine Gipfel. Deine Geschichte.</p>' +
                    '<div class="bergwelt-cinematic-stats">' +
                        metric('Touren', fmt(uniqueTourCount(entries)), '', 'route') +
                        metric('Strecke', fmtKnown(totalDistance), ' km', 'mountain') +
                        metric('Aufstieg', fmtKnown(totalAscent), ' hm', 'summit') +
                    '</div>' +
                '</div>' +
                '<div class="bergwelt-cinematic-image-caption">ALPINE MOMENTS <span>✦</span> ' + yearLabel.toUpperCase() + '</div>' +
            '</section>' +
            '<section class="bergwelt-cinematic-lower">' +
                '<div class="bergwelt-cinematic-section-heading"><div><p class="bergwelt-cinematic-kicker">DEINE HIGHLIGHTS</p><h3>Spuren im Gebirge</h3></div><span class="bergwelt-cinematic-section-mark">✦</span></div>' +
                '<div class="bergwelt-cinematic-highlight-grid">' +
                    highestPeakCard(highestPeak) +
                    highlightCard('LÄNGSTE STRECKE', longestTour, longestTour ? distance(longestTour) : 0, 'km', 'route', 'is-blue') +
                    highlightCard('GRÖSSTER AUFSTIEG', bestAscent, bestAscent ? ascent(bestAscent) : 0, 'hm', 'summit', 'is-ascent') +
                    highlightCard('GRÖSSTE BIG TOUR', biggestBigTour?.entry || null, biggestBigTour ? biggestBigTour.index : 0, 'Index', 'mountain', 'is-bigtour') +
                '</div>' +
                '<div class="bergwelt-cinematic-footer-stats">' +
                    '<span>' + icon('time') + '<span><small>Gehzeit</small><strong>' + formatHours(totalMinutes) + '</strong></span></span>' +
                    '<span>' + icon('mountain') + '<span><small>Gipfel</small><strong>' + fmtKnown(totalPeaks) + '</strong></span></span>' +
                '</div>' +
                (mostPeaks ? '<p class="bergwelt-cinematic-note">Deine gipfelreichste Tour: <strong>' + tourTitle(mostPeaks) + '</strong> · ' + fmt(peaks(mostPeaks)) + ' Gipfel</p>' : '') +
            '</section>';

        const bindTourDetail = (selector, entry, label) => {
            const card = panel.querySelector(selector);
            if (!card || !entry) return;

            card.classList.add('is-clickable');
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', 'Tourdetails öffnen: ' + String(entry.tourname || entry.name || label));
            card.title = 'Tourdetails öffnen';

            const openDetail = () => {
                if (typeof window.openTourDetail !== 'function') {
                    console.warn('[Bergwelt] Tourdetail-Funktion ist derzeit nicht verfügbar.');
                    return;
                }
                try {
                    const result = window.openTourDetail(entry);
                    if (result && typeof result.catch === 'function') {
                        result.catch(error => console.error('[Bergwelt] Tourdetail konnte nicht geöffnet werden:', error));
                    }
                } catch (error) {
                    console.error('[Bergwelt] Tourdetail konnte nicht geöffnet werden:', error);
                }
            };

            card.addEventListener('click', openDetail);
            card.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openDetail();
            });
        };

        bindTourDetail('.bergwelt-cinematic-highlight.is-peak', highestPeak?.entry, 'Höchster Gipfel');
        bindTourDetail('.bergwelt-cinematic-highlight.is-blue', longestTour, 'Längste Strecke');
        bindTourDetail('.bergwelt-cinematic-highlight.is-ascent', bestAscent, 'Größter Aufstieg');
        bindTourDetail('.bergwelt-cinematic-highlight.is-bigtour', biggestBigTour?.entry, 'Größte Big Tour');
    }
    function renderTourbuch() {
        panel.hidden = true;
        achievementsPanel.hidden = true;
        tourbookPanel.hidden = false;
        root.classList.add('bergwelt-mode');
        root.classList.remove('bergwelt-story-playing', 'bergwelt-active-achievements');
        if (!tourbookPanel.querySelector('.bergwelt-tourbook-hero')) {
            const hero = document.createElement('section');
            hero.className = 'bergwelt-tourbook-hero';
            hero.setAttribute('aria-labelledby', 'bergwelt-tourbook-heading');
            hero.innerHTML =
                '<div class="bergwelt-tourbook-hero-content">' +
                    '<p>DEIN PERSÖNLICHES TOURBUCH</p>' +
                    '<h2 id="bergwelt-tourbook-heading">Deine Touren. Deine Geschichte.</h2>' +
                    '<span>Stelle Zeitraum, Inhalte und Gestaltung zusammen und erstelle daraus dein persönliches Tourbuch als PDF.</span>' +
                '</div>';
            if (tourbookCard && tourbookCard.parentNode === tourbookPanel) {
                tourbookPanel.insertBefore(hero, tourbookCard);
            } else {
                tourbookPanel.prepend(hero);
            }
        }
    }
    function render() {
        if (window.__bergweltRequestedTab) {
            const requestedTab = window.__bergweltRequestedTab;
            if (['erlebnis', 'tourbuch', 'achievements'].includes(requestedTab)) {
                activeTab = requestedTab;
                window.__bergweltRequestedTab = null;
                showOriginalStory = activeTab === 'erlebnis';
                syncExperienceActions();
                tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
                    const active = tab.dataset.bergweltTab === activeTab;
                    tab.classList.toggle('is-active', active);
                    tab.setAttribute('aria-selected', String(active));
                });
            }
        }

        if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open');
        window.__bergweltActiveTab = activeTab;
        root.classList.toggle('bergwelt-active-tourbuch', activeTab === 'tourbuch');
        root.classList.toggle('bergwelt-active-achievements', activeTab === 'achievements');

        if (activeTab === 'erlebnis') {
            return renderMomente();
        }
        if (activeTab === 'tourbuch') {
            return renderTourbuch();
        }
        if (activeTab === 'achievements') {
            root.classList.remove('bergwelt-story-playing');
            root.classList.add('bergwelt-mode');
            panel.hidden = true;
            tourbookPanel.hidden = true;
            achievementsPanel.hidden = false;
            if (typeof populateAchievementsYearSelect === 'function') populateAchievementsYearSelect();
            if (typeof renderAchievementsView === 'function') renderAchievementsView();
        }
    }
    panel.addEventListener('click', event => {
        if (event.target.closest('[data-start-bergwelt-story]')) {
            showOriginalStory = true;
            renderMomente();
        }
    });
    tabs.addEventListener('click', event => {
        const button = event.target.closest('[data-bergwelt-tab]');
        if (!button) return;
        activeTab = button.dataset.bergweltTab;
        showOriginalStory = activeTab === 'erlebnis';
        syncExperienceActions();
        tabs.querySelectorAll('[data-bergwelt-tab]').forEach(tab => {
            const active = tab === button;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        render();
    });
    document.getElementById('wrapped-toggle')?.addEventListener('click', () => {
        activeTab = 'erlebnis';
        showOriginalStory = true;
        syncExperienceActions();
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