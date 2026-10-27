/* Premium Alpine: Bergmotive für die fünf bestehenden Dashboard-Meilensteine.
   Nur Darstellung. Messwerte, Fortschritt, Klickverhalten und Reihenfolge bleiben unverändert. */
(function () {
    'use strict';

    const SECTION_SELECTOR = '#dash-milestones-section';
    const FRAME = '<path d="M16 2.7 27 9v13L16 28.3 5 22V9Z" fill="none" stroke="currentColor" stroke-width="1.15" opacity=".78" stroke-linejoin="round"/>';

    const ICON_DETAILS = {
        dist: '<path d="M8.5 22.2 13 16.5l3.7 3.1L23.7 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.5" cy="22.2" r="1.5" fill="currentColor"/><circle cx="23.7" cy="11" r="1.5" fill="currentColor"/><path d="M8.5 25h15" fill="none" stroke="currentColor" stroke-width="1" opacity=".45" stroke-linecap="round"/>',
        asc: '<path d="M7.8 23 13 14.2l3.4 5.1 4.2-7.2L25 23Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m11.2 21.5 7-7m-3.1.1h3.2v3.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        time: '<path d="M7.7 24 12 18.5l3 2.4 5.1-6.5 4.8 9.6Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><circle cx="16.1" cy="12.1" r="5.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M16.1 9.1v3.2l2.1 1.3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
        peaks: '<path d="M6.8 23.2 12.4 14l3.2 5 4.8-8 5 12.2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.4 11V6.8l4.2 1.5-4.2 1.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
        steps: '<path d="M10.2 10.2c-1.6.1-2.6 2.1-2.2 4.2.3 1.7 1.3 2.8 2.6 2.5 1.5-.3 2.2-2.1 1.8-4.1-.3-1.6-1.1-2.7-2.2-2.6Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 18.1c-1.2 1-1.3 2.5-.6 4l2.4 1.4 2.3-1.4c.7-1.1.2-2.9-1.1-3.9Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M20.4 14.2c-1.6.1-2.5 2.1-2.2 4.2.3 1.7 1.3 2.8 2.6 2.5 1.5-.3 2.2-2.1 1.8-4.1-.3-1.6-1.1-2.7-2.2-2.6Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m18.7 22.1 1.1-1.1 2.3.6.9 2.1" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
    };

    const TITLE_MARK = '<svg viewBox="0 0 34 24" role="presentation" focusable="false"><path d="M1.5 21 10.5 8.3l4.2 5.1L22 2.5l10.5 18.5H1.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m7.3 21 3.2-4.5 2.3 2.1M18 9.4l4 4.9 2.2-2.2 4.1 7.2" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/></svg>';

    const WATERMARK = '<svg viewBox="0 0 260 90" preserveAspectRatio="xMaxYMid meet" focusable="false"><path d="M0 77 23 63 39 68 58 43 73 55 92 22 108 44 122 36 141 58 158 47 174 57 195 25 214 47 231 39 260 59V90H0Z" fill="currentColor" opacity=".12"/><path d="M0 77 23 63 39 68 58 43 73 55 92 22 108 44 122 36 141 58 158 47 174 57 195 25 214 47 231 39 260 59" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><path d="m47 57 11-14 8 7m18-9 8-19 8 11m23 10 7-7 11 18m38-3 16-26 8 11" fill="none" stroke="currentColor" stroke-width="1" opacity=".62" stroke-linecap="round" stroke-linejoin="round"/><path d="M0 84c36-9 58-4 89-10s54-1 85-8 52 0 86-7M44 89c27-6 45-5 69-9m49 3c21-5 48-4 71-9" fill="none" stroke="currentColor" stroke-width=".85" opacity=".5" stroke-linecap="round"/></svg>';

    function buildIcon(type) {
        return '<svg class="dash-ms-symbol-svg" viewBox="0 0 32 31" aria-hidden="true" focusable="false">' +
            FRAME + (ICON_DETAILS[type] || ICON_DETAILS.asc) + '</svg>';
    }

    function enhanceTitle(section) {
        const title = section.querySelector('.dash-section-title');
        if (!title || title.querySelector('.dash-section-mountain-mark')) return;

        const textNode = Array.from(title.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.nodeValue = textNode.nodeValue.replace(/^\s*🏅\s*/, '');

        const mark = document.createElement('span');
        mark.className = 'dash-section-mountain-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.innerHTML = TITLE_MARK;
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

        if (!tile.querySelector('.dash-ms-watermark')) {
            const watermark = document.createElement('span');
            watermark.className = 'dash-ms-watermark';
            watermark.setAttribute('aria-hidden', 'true');
            watermark.innerHTML = WATERMARK;
            tile.insertBefore(watermark, tile.firstChild);
        }
    }

    function enhanceDashboardMilestones() {
        const section = document.querySelector(SECTION_SELECTOR);
        if (!section) return;
        enhanceTitle(section);
        section.querySelectorAll('.dash-milestone-tile').forEach(enhanceTile);
    }

    function init() {
        const section = document.querySelector(SECTION_SELECTOR);
        if (!section || section.dataset.premiumAlpineObserver === 'true') {
            enhanceDashboardMilestones();
            return;
        }

        section.dataset.premiumAlpineObserver = 'true';
        const observer = new MutationObserver(enhanceDashboardMilestones);
        observer.observe(section, { childList: true, subtree: true });
        enhanceDashboardMilestones();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
