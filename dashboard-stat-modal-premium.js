/* Premium Alpine — behutsame Strukturierung des Dashboardkachel-Modals Strecke.
   Bestehende Werte, Zeilen, Listener und Drilldowns werden unverändert übernommen. */
(function () {
    'use strict';

    function init() {
        const modal = document.getElementById('dash-stat-modal');
        const title = document.getElementById('ds-title');
        const body = document.getElementById('ds-body');
        const modalCard = modal?.querySelector('.modal-card');
        if (!modal || !title || !body || !modalCard || modal.dataset.premiumDistanceModalInit === 'true') return;

        modal.dataset.premiumDistanceModalInit = 'true';

        const SVG_NS = 'http://www.w3.org/2000/svg';
        const HERO_GRADIENT_ID = 'dashboard-stat-distance-reverse-gradient';

        function getEditorSettings() {
            try {
                return typeof window.getThemeEditorUnifiedSettings === 'function'
                    ? window.getThemeEditorUnifiedSettings()
                    : {};
            } catch (_) {
                return {};
            }
        }

        function clamp(value, min, max, fallback) {
            const number = Number(value);
            return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
        }

        function makeSvgGradient(svg) {
            const settings = getEditorSettings();
            const accent = /^#[0-9a-f]{6}$/i.test(settings.accent || '')
                ? settings.accent : getComputedStyle(document.body).getPropertyValue('--theme-palette-accent').trim() || '#ad7d12';
            const accent2 = /^#[0-9a-f]{6}$/i.test(settings.accent2 || '')
                ? settings.accent2 : '#000000';
            const transition = clamp(settings.transition, 10, 90, 55);
            const direction = settings.gradientDirection || '180deg';
            let gradient;

            if (direction === 'radial') {
                gradient = document.createElementNS(SVG_NS, 'radialGradient');
                gradient.setAttribute('cx', '28%');
                gradient.setAttribute('cy', '18%');
                gradient.setAttribute('fx', '28%');
                gradient.setAttribute('fy', '18%');
                gradient.setAttribute('r', '88%');

                const stopA = document.createElementNS(SVG_NS, 'stop');
                stopA.setAttribute('offset', '0%');
                stopA.setAttribute('stop-color', accent2);
                const stopB = document.createElementNS(SVG_NS, 'stop');
                stopB.setAttribute('offset', (100 - transition) + '%');
                stopB.setAttribute('stop-color', accent2);
                const stopC = document.createElementNS(SVG_NS, 'stop');
                stopC.setAttribute('offset', '100%');
                stopC.setAttribute('stop-color', accent);
                gradient.append(stopA, stopB, stopC);
            } else {
                const degrees = Number.parseFloat(direction) || 180;
                const radians = degrees * Math.PI / 180;
                const dx = Math.sin(radians);
                const dy = -Math.cos(radians);
                const x1 = 50 + dx * 50;
                const y1 = 50 + dy * 50;
                const x2 = 50 - dx * 50;
                const y2 = 50 - dy * 50;

                gradient = document.createElementNS(SVG_NS, 'linearGradient');
                gradient.setAttribute('x1', x1 + '%');
                gradient.setAttribute('y1', y1 + '%');
                gradient.setAttribute('x2', x2 + '%');
                gradient.setAttribute('y2', y2 + '%');

                const stopA = document.createElementNS(SVG_NS, 'stop');
                stopA.setAttribute('offset', '0%');
                stopA.setAttribute('stop-color', accent);
                const stopB = document.createElementNS(SVG_NS, 'stop');
                stopB.setAttribute('offset', transition + '%');
                stopB.setAttribute('stop-color', accent);
                const stopC = document.createElementNS(SVG_NS, 'stop');
                stopC.setAttribute('offset', '100%');
                stopC.setAttribute('stop-color', accent2);
                gradient.append(stopA, stopB, stopC);
            }

            gradient.setAttribute('id', HERO_GRADIENT_ID);
            const defs = document.createElementNS(SVG_NS, 'defs');
            defs.appendChild(gradient);
            svg.insertBefore(defs, svg.firstChild);
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'url(#' + HERO_GRADIENT_ID + ')');
            svg.setAttribute('stroke-width', '1.15');
            svg.querySelectorAll('.premium-alpine-accent-fill').forEach(element => {
                element.classList.remove('premium-alpine-accent-fill');
                element.setAttribute('fill', 'url(#' + HERO_GRADIENT_ID + ')');
            });
        }

        function ensureHeroIcon() {
            if (modal.dataset.dashboardStatType !== 'strecke') {
                modalCard.querySelector('.dashboard-stat-hero-icon')?.remove();
                return;
            }

            const source = title.querySelector('.stats-premium-content-icon svg');
            if (!source) return;

            let hero = modalCard.querySelector('.dashboard-stat-hero-icon');
            if (!hero) {
                hero = document.createElement('div');
                hero.className = 'dashboard-stat-hero-icon';
                hero.setAttribute('aria-hidden', 'true');
                modalCard.insertBefore(hero, modalCard.firstChild);
            }

            const svg = source.cloneNode(true);
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            makeSvgGradient(svg);
            hero.replaceChildren(svg);
        }

        function syncModalType() {
            const label = String(title.textContent || '').trim().toLocaleLowerCase('de');
            if (label.includes('strecke')) {
                modal.dataset.dashboardStatType = 'strecke';
            } else {
                delete modal.dataset.dashboardStatType;
            }
            enhanceDistanceOverview();
            ensureHeroIcon();
        }

        function enhanceDistanceOverview() {
            if (modal.dataset.dashboardStatType !== 'strecke') return;

            // Drilldown-Ansichten besitzen einen eigenen Zurück-Button und bleiben Listenansichten.
            if (body.querySelector('#ds-back')) return;

            // Bereits gruppiert: MutationObserver nicht erneut auf denselben Inhalt anwenden.
            if (body.querySelector(':scope > .dashboard-stat-overview')) return;

            const sourceList = Array.from(body.children).find(
                element => element.matches?.('.stats-list')
            );
            if (!sourceList) return;

            const totalRow = sourceList.querySelector(':scope > #ds-total-row');
            const averageRow = totalRow?.nextElementSibling;
            if (!totalRow || !averageRow?.matches('li.stats-sub')) return;

            const monthRows = Array.from(sourceList.children).filter(
                element => element !== totalRow && element !== averageRow
            );
            if (monthRows.some(row => !row.matches('li[data-month-idx]'))) return;

            const overview = document.createElement('section');
            overview.className = 'dashboard-stat-overview';
            overview.setAttribute('aria-label', 'Streckenübersicht');

            const overviewList = document.createElement('ul');
            overviewList.className = 'stats-list dashboard-stat-overview-list';
            overviewList.append(totalRow, averageRow);
            overview.append(overviewList);

            const sections = [overview];

            if (monthRows.length) {
                const months = document.createElement('section');
                months.className = 'dashboard-stat-months';

                const heading = document.createElement('div');
                heading.className = 'dashboard-stat-month-heading';
                heading.textContent = 'NACH MONAT';

                const monthList = document.createElement('ul');
                monthList.className = 'stats-list dashboard-stat-month-list';
                monthRows.forEach(row => monthList.appendChild(row));

                months.append(heading, monthList);
                sections.push(months);
            }

            body.replaceChildren(...sections);
        }

        const titleObserver = new MutationObserver(syncModalType);
        titleObserver.observe(title, {
            childList: true,
            characterData: true,
            subtree: true
        });

        const bodyObserver = new MutationObserver(() => {
            enhanceDistanceOverview();
            ensureHeroIcon();
        });
        bodyObserver.observe(body, { childList: true });

        const paletteObserver = new MutationObserver(() => {
            if (modal.dataset.dashboardStatType === 'strecke') ensureHeroIcon();
        });
        if (document.body) paletteObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['style']
        });

        const modalStateObserver = new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) syncModalType();
        });
        modalStateObserver.observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });

        syncModalType();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
