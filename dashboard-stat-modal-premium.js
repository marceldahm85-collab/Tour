/* Premium Alpine — einheitliche Vorlage für sämtliche Dashboard-Kachelmodale.
   Die vorhandenen Statistikzeilen und ihre Klick-Listener werden nur gruppiert, nie neu erzeugt. */
(function () {
    'use strict';

    function init() {
        const modal = document.getElementById('dash-stat-modal');
        const card = modal?.querySelector(':scope > .modal-card');
        const title = document.getElementById('ds-title');
        const body = document.getElementById('ds-body');
        if (!modal || !card || !title || !body ||
            modal.dataset.dashboardModalPremiumInit === 'true') return;

        modal.dataset.dashboardModalPremiumInit = 'true';

        const SVG_NS = 'http://www.w3.org/2000/svg';
        const HERO_GRADIENT_ID = 'dashboard-stat-modal-symbol-gradient';
        let activeType = null;

        const TYPE_RULES = [
            { type: 'strecke', pattern: /strecke|distanz|umfang/i, icon: 'distance' },
            { type: 'steps', pattern: /schritte/i, icon: 'steps' },
            { type: 'gipfel', pattern: /gipfel/i, icon: 'peaks' },
            { type: 'bigTours', pattern: /big\s*tours/i, icon: 'bigTour' },
            { type: 'touren', pattern: /alle\s*touren|touren/i, icon: 'hiking' },
            { type: 'aufstieg', pattern: /aufstieg|höhenmeter/i, icon: 'peaks' },
            { type: 'gehzeit', pattern: /gehzeit/i, icon: 'time' },
            { type: 'speed', pattern: /geschwindigkeit|speed/i, icon: 'speed' },
            { type: 'steigung', pattern: /steigung|steilheit/i, icon: 'grade' },
            { type: 'anstieg', pattern: /anstieg/i, icon: 'ascent' }
        ];

        function getEditorSettings() {
            try {
                return typeof window.getThemeEditorUnifiedSettings === 'function'
                    ? window.getThemeEditorUnifiedSettings() || {}
                    : {};
            } catch (_) {
                return {};
            }
        }

        function clamp(value, min, max, fallback) {
            const number = Number(value);
            return Number.isFinite(number)
                ? Math.min(max, Math.max(min, number))
                : fallback;
        }

        function getPalette() {
            const settings = getEditorSettings();
            const computedAccent = getComputedStyle(document.body)
                .getPropertyValue('--theme-palette-accent').trim();
            return {
                accent: /^#[0-9a-f]{6}$/i.test(settings.accent || '')
                    ? settings.accent
                    : (/^#[0-9a-f]{6}$/i.test(computedAccent) ? computedAccent : '#ad7d12'),
                accent2: /^#[0-9a-f]{6}$/i.test(settings.accent2 || '')
                    ? settings.accent2 : '#000000',
                direction: ['180deg', '90deg', '135deg', '45deg', 'radial'].includes(settings.gradientDirection)
                    ? settings.gradientDirection : '180deg',
                transition: clamp(settings.transition, 10, 90, 55)
            };
        }

        function buildReversedModalBackground(palette) {
            if (palette.direction === 'radial') {
                return 'radial-gradient(circle at 72% 82%, ' +
                    palette.accent + ' 0%, ' + palette.accent + ' ' +
                    palette.transition + '%, ' + palette.accent2 + ' 100%)';
            }

            const reversedTransition = 100 - palette.transition;
            return 'linear-gradient(' + palette.direction + ', ' +
                palette.accent2 + ' 0%, ' + palette.accent2 + ' ' +
                reversedTransition + '%, ' + palette.accent + ' 100%)';
        }

        function resolveType() {
            const label = String(title.textContent || '').trim();
            const matched = TYPE_RULES.find(rule => rule.pattern.test(label));
            if (matched) activeType = matched.type;
            return activeType;
        }

        function createHeaderIcon(iconKey) {
            const markup = window.PremiumAlpineIcons?.html?.(iconKey);
            if (markup) {
                const holder = document.createElement('span');
                holder.innerHTML = markup;
                return holder.firstElementChild;
            }
            return null;
        }

        function getHeaderIcon(type) {
            let holder = title.querySelector(
                ':scope > .stats-premium-content-icon, ' +
                ':scope > .premium-alpine-inline-icon, ' +
                ':scope > .stats-premium-title-icon'
            );

            if (holder) {
                holder.dataset.iconKey = holder.dataset.iconKey ||
                    holder.dataset.premiumAlpineIcon ||
                    TYPE_RULES.find(rule => rule.type === type)?.icon ||
                    'peaks';
                holder.classList.add('premium-dashboard-header-icon');
                return holder;
            }

            const raw = String(title.textContent || '').trim();
            const tokenMatch = raw.match(/^\s*[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D\u20E3]+\s*/u);
            if (tokenMatch) title.textContent = raw.slice(tokenMatch[0].length).trim();

            const key = TYPE_RULES.find(rule => rule.type === type)?.icon || 'peaks';
            holder = createHeaderIcon(key);
            if (!holder) return null;

            holder.dataset.iconKey = key;
            holder.classList.add('premium-dashboard-header-icon');
            title.insertBefore(holder, title.firstChild);
            return holder;
        }

        function applyNormalSymbolGradient(svg, palette) {
            let gradient;

            if (palette.direction === 'radial') {
                gradient = document.createElementNS(SVG_NS, 'radialGradient');
                gradient.setAttribute('cx', '28%');
                gradient.setAttribute('cy', '18%');
                gradient.setAttribute('fx', '28%');
                gradient.setAttribute('fy', '18%');
                gradient.setAttribute('r', '88%');
            } else {
                const degrees = Number.parseFloat(palette.direction) || 180;
                const radians = degrees * Math.PI / 180;
                const dx = Math.sin(radians);
                const dy = -Math.cos(radians);

                gradient = document.createElementNS(SVG_NS, 'linearGradient');
                gradient.setAttribute('x1', (50 - dx * 50) + '%');
                gradient.setAttribute('y1', (50 - dy * 50) + '%');
                gradient.setAttribute('x2', (50 + dx * 50) + '%');
                gradient.setAttribute('y2', (50 + dy * 50) + '%');
            }

            [
                { offset: '0%', color: palette.accent },
                { offset: palette.transition + '%', color: palette.accent },
                { offset: '100%', color: palette.accent2 }
            ].forEach(item => {
                const stop = document.createElementNS(SVG_NS, 'stop');
                stop.setAttribute('offset', item.offset);
                stop.setAttribute('stop-color', item.color);
                gradient.appendChild(stop);
            });

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
                element.setAttribute('stroke', 'none');
            });
        }

        function ensureHeroIcon(type, palette) {
            const holder = getHeaderIcon(type);
            const source = holder?.querySelector('svg');
            if (!source) return;

            const iconKey = holder.dataset.iconKey || 'peaks';
            const signature = [
                iconKey, palette.accent, palette.accent2,
                palette.direction, palette.transition
            ].join('|');

            let hero = card.querySelector(':scope > .dashboard-stat-hero-icon');
            if (hero?.dataset.signature === signature && hero.firstElementChild) return;

            if (!hero) {
                hero = document.createElement('div');
                hero.className = 'dashboard-stat-hero-icon';
                hero.setAttribute('aria-hidden', 'true');
                card.insertBefore(hero, card.firstChild);
            }

            const svg = source.cloneNode(true);
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            applyNormalSymbolGradient(svg, palette);
            hero.dataset.iconKey = iconKey;
            hero.dataset.signature = signature;
            hero.replaceChildren(svg);
        }

        function enhanceDashboardOverview() {
            if (!activeType || body.querySelector('#ds-back')) return;
            if (body.querySelector(':scope > .dashboard-stat-overview')) return;

            const sourceLists = Array.from(body.children).filter(element =>
                element.matches?.(':scope.stats-list, .stats-list')
            );
            if (!sourceLists.length) return;

            const allRows = sourceLists.flatMap(list =>
                Array.from(list.children).filter(element => element.matches('li'))
            );
            if (!allRows.length) return;

            const monthRows = allRows.filter(row => row.hasAttribute('data-month-idx'));
            const overviewRows = allRows.filter(row => !row.hasAttribute('data-month-idx'));

            const sections = [];

            if (overviewRows.length) {
                const overview = document.createElement('section');
                overview.className = 'dashboard-stat-overview';
                overview.setAttribute('aria-label', 'Übersicht');

                const overviewList = document.createElement('ul');
                overviewList.className = 'stats-list dashboard-stat-overview-list';
                overviewRows.forEach(row => overviewList.appendChild(row));
                overview.appendChild(overviewList);
                sections.push(overview);
            }

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

            if (!sections.length) return;
            body.replaceChildren(...sections);
        }

        function syncModal() {
            const type = resolveType();
            if (!type) {
                delete modal.dataset.dashboardStatType;
                card.style.removeProperty('--dashboard-stat-background-gradient');
                card.querySelector(':scope > .dashboard-stat-hero-icon')?.remove();
                return;
            }

            modal.dataset.dashboardStatType = type;

            const palette = getPalette();
            card.style.setProperty(
                '--dashboard-stat-background-gradient',
                buildReversedModalBackground(palette)
            );

            ensureHeroIcon(type, palette);
            enhanceDashboardOverview();
        }

        const titleObserver = new MutationObserver(syncModal);
        titleObserver.observe(title, {
            childList: true,
            characterData: true,
            subtree: true
        });

        const bodyObserver = new MutationObserver(enhanceDashboardOverview);
        bodyObserver.observe(body, { childList: true });

        const modalObserver = new MutationObserver(() => {
            if (!modal.classList.contains('hidden')) syncModal();
        });
        modalObserver.observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });

        syncModal();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
