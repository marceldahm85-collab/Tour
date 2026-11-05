/* Premium Alpine — einheitliche Editor-Verlaufsflächen für reguläre Informationsmodale.
   Sonderfälle mit eigener Bildsprache (Tourdetail und Meilenstein) bleiben bewusst außen vor.
   Titel, Aktionen, Daten, Listener und Modalnavigation werden nicht ersetzt. */
(function () {
    'use strict';

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const LEADING_EMOJI = /^\s*(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\uFE0E\uFE0F\u200D\u20E3]+\s*)+/u;

    const MODALS = [
        { modalId: 'achievement-category-modal', titleId: 'achievement-category-title', bodyId: 'achievement-category-badges', fallbackIcon: 'trophy' },
        { modalId: 'compare-modal', titleId: 'compare-modal-title', bodyId: 'compare-modal-body', fallbackIcon: 'compare' },
        { modalId: 'month-stats-modal', titleId: 'ms-title', bodyId: 'ms-body', fallbackIcon: 'calendar' },
        { modalId: 'stats-chart-modal', titleId: 'stats-chart-modal-title', bodyId: 'stats-chart-modal-body', fallbackIcon: 'chart' },
        { modalId: 'tour-list-modal', titleId: 'tl-title', bodyId: 'tl-body', fallbackIcon: 'tour' },
    ];

    function clamp(value, min, max, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
    }

    function getSettings() {
        let settings = {};
        try {
            settings = typeof window.getThemeEditorUnifiedSettings === 'function'
                ? window.getThemeEditorUnifiedSettings() || {}
                : {};
        } catch (_) {}

        const computedAccent = getComputedStyle(document.body)
            .getPropertyValue('--theme-palette-accent').trim();

        const accent = /^#[0-9a-f]{6}$/i.test(settings.accent || '')
            ? settings.accent
            : (/^#[0-9a-f]{6}$/i.test(computedAccent) ? computedAccent : '#ad7d12');
        const accent2 = /^#[0-9a-f]{6}$/i.test(settings.accent2 || '')
            ? settings.accent2
            : '#000000';

        return {
            accent,
            accent2,
            direction: ['180deg', '90deg', '135deg', '45deg', 'radial'].includes(settings.gradientDirection)
                ? settings.gradientDirection
                : '180deg',
            transition: clamp(settings.transition, 10, 90, 55)
        };
    }

    function buildReversedBackground(settings) {
        if (settings.direction === 'radial') {
            // 180°-Drehung: Der radiale Ursprung wandert auf die Gegenseite.
            return 'radial-gradient(circle at 72% 82%, ' +
                settings.accent + ' 0%, ' + settings.accent + ' ' +
                settings.transition + '%, ' + settings.accent2 + ' 100%)';
        }

        // Linear: Farben tauschen und den Übergangspunkt spiegeln.
        const transition = 100 - settings.transition;
        return 'linear-gradient(' + settings.direction + ', ' +
            settings.accent2 + ' 0%, ' + settings.accent2 + ' ' +
            transition + '%, ' + settings.accent + ' 100%)';
    }

    function iconKeyForText(text, token, fallback) {
        if (token && window.PremiumAlpineIcons?.keyForToken) {
            const key = window.PremiumAlpineIcons.keyForToken(token);
            if (key) return key;
        }

        const value = String(text || '').toLocaleLowerCase('de');
        if (/vergleich|compare/.test(value)) return 'compare';
        if (/monat|jänner|januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember/.test(value)) return 'calendar';
        if (/strecke|distanz|umfang/.test(value)) return 'distance';
        if (/aufstieg|höhenmeter|gipfel|höhe/.test(value)) return 'peaks';
        if (/gehzeit|dauer|zeit/.test(value)) return 'time';
        if (/geschwindigkeit|tempo|speed/.test(value)) return 'speed';
        if (/steil|steigung|gradient/.test(value)) return 'grade';
        if (/leistung|belastung|formtrend|bestform/.test(value)) return 'performance';
        if (/tour|wanderung|aktivität/.test(value)) return 'hiking';
        if (/statistik|diagramm|entwicklung|verteilung|chart/.test(value)) return 'chart';
        return fallback || 'peaks';
    }

    function createTitleIcon(key) {
        const markup = window.PremiumAlpineIcons?.html?.(key);
        if (markup) {
            const holder = document.createElement('span');
            holder.innerHTML = markup;
            const icon = holder.firstElementChild;
            if (icon) return icon;
        }

        const icon = document.createElement('span');
        icon.className = 'premium-alpine-inline-icon';
        icon.dataset.premiumAlpineIcon = key;
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path d="m1.8 20 6.1-9.2 3 4 4.2-8.3 7.1 13.5H1.8Z"/>' +
            '<path d="m13.2 9.4 1.9-2.9 2 3.6-1.5-.5-1.1 1-.8-1.2Z"/>' +
            '</svg>';
        return icon;
    }

    function ensureTitleIcon(config, title) {
        if (!String(title.textContent || '').trim() && !title.querySelector('svg')) return null;

        let holder = Array.from(title.children).find(element =>
            element.matches('.stats-premium-content-icon, .premium-alpine-inline-icon, .stats-premium-title-icon')
        );

        if (!holder) {
            const raw = String(title.textContent || '').trim();
            const match = raw.match(LEADING_EMOJI);
            const token = match ? match[0].trim() : '';
            const clean = match ? raw.slice(match[0].length).trim() : raw;
            const key = iconKeyForText(clean, token, config.fallbackIcon);

            if (match) title.textContent = clean;
            holder = createTitleIcon(key);
            title.insertBefore(holder, title.firstChild);
            holder.dataset.iconKey = key;
        }

        holder.classList.add('premium-modal-header-icon');
        return holder;
    }

    function setGradientOnIcon(svg, settings, gradientId) {
        let gradient;
        if (settings.direction === 'radial') {
            gradient = document.createElementNS(SVG_NS, 'radialGradient');
            gradient.setAttribute('cx', '28%');
            gradient.setAttribute('cy', '18%');
            gradient.setAttribute('fx', '28%');
            gradient.setAttribute('fy', '18%');
            gradient.setAttribute('r', '88%');
        } else {
            const degrees = Number.parseFloat(settings.direction) || 180;
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
            { offset: '0%', color: settings.accent },
            { offset: settings.transition + '%', color: settings.accent },
            { offset: '100%', color: settings.accent2 }
        ].forEach(stopData => {
            const stop = document.createElementNS(SVG_NS, 'stop');
            stop.setAttribute('offset', stopData.offset);
            stop.setAttribute('stop-color', stopData.color);
            gradient.appendChild(stop);
        });

        gradient.setAttribute('id', gradientId);
        const defs = document.createElementNS(SVG_NS, 'defs');
        defs.appendChild(gradient);
        svg.insertBefore(defs, svg.firstChild);
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'url(#' + gradientId + ')');
        svg.setAttribute('stroke-width', '1.25');

        svg.querySelectorAll('.premium-alpine-accent-fill').forEach(element => {
            element.classList.remove('premium-alpine-accent-fill');
            element.setAttribute('fill', 'url(#' + gradientId + ')');
            element.setAttribute('stroke', 'none');
        });
    }

    function syncModal(config) {
        const modal = document.getElementById(config.modalId);
        const card = modal?.querySelector(':scope > .modal-card');
        const title = document.getElementById(config.titleId);
        if (!modal || !card || !title) return;

        const settings = getSettings();
        card.style.setProperty('--premium-modal-background-gradient', buildReversedBackground(settings));
        modal.dataset.premiumModalSurface = 'true';

        const iconHolder = ensureTitleIcon(config, title);
        const source = iconHolder?.querySelector('svg');
        if (!source) return;

        const key = iconHolder.dataset.iconKey ||
            iconHolder.dataset.premiumAlpineIcon ||
            iconHolder.dataset.iconKey ||
            config.fallbackIcon;
        const signature = [
            key, settings.accent, settings.accent2, settings.direction, settings.transition
        ].join('|');

        let hero = card.querySelector(':scope > .premium-modal-hero-icon');
        if (hero?.dataset.gradientSignature === signature && hero.firstElementChild) return;

        if (!hero) {
            hero = document.createElement('div');
            hero.className = 'premium-modal-hero-icon';
            hero.setAttribute('aria-hidden', 'true');
            card.insertBefore(hero, card.firstChild);
        }

        const svg = source.cloneNode(true);
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        setGradientOnIcon(svg, settings, config.modalId + '-symbol-gradient');
        hero.dataset.iconKey = key;
        hero.dataset.gradientSignature = signature;
        hero.replaceChildren(svg);
    }

    function initModal(config) {
        const modal = document.getElementById(config.modalId);
        const title = document.getElementById(config.titleId);
        if (!modal || !title || modal.dataset.premiumModalSurfaceInit === 'true') return;

        modal.dataset.premiumModalSurfaceInit = 'true';
        const refresh = () => syncModal(config);

        const titleObserver = new MutationObserver(refresh);
        titleObserver.observe(title, { childList: true, characterData: true, subtree: true });

        const modalObserver = new MutationObserver(refresh);
        modalObserver.observe(modal, {
            attributes: true,
            attributeFilter: ['class', 'data-dashboard-stat-type']
        });

        refresh();
    }

    function init() {
        MODALS.forEach(initModal);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
