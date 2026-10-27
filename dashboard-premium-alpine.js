/* Premium Alpine: Bergmotive für die fünf bestehenden Dashboard-Meilensteine.
   Nur Darstellung. Messwerte, Fortschritt, Klickverhalten und Reihenfolge bleiben unverändert. */
(function () {
    'use strict';

    const SECTION_SELECTOR = '#dash-milestones-section';
    /* Doppelte Kante: dunkler Reliefsaum und feine, akzentfarbene Gipfellinie. */
    const FRAME = '<path d="M18 2.1 30.2 9.2v14.2L18 30.5 5.8 23.4V9.2Z" transform="translate(0 1)" fill="none" stroke="#020807" stroke-width="2" opacity=".72" stroke-linejoin="round"/><path d="M18 2.1 30.2 9.2v14.2L18 30.5 5.8 23.4V9.2Z" fill="none" stroke="currentColor" stroke-width="1.05" opacity=".94" stroke-linejoin="round"/><path d="m6.7 9.7 11.3-6.5 11.3 6.5" fill="none" stroke="#fff" stroke-width=".65" opacity=".5" stroke-linecap="round" stroke-linejoin="round"/>';

    /* Eigenständige Mini-Illustrationen: jede Kategorie erhält ein erkennbares Alpenmotiv. */
    const ICON_DETAILS = {
        dist: '<path d="M7.6 23.2c2.4-1.2 2.1-5.5 5.2-5.1 2.4.3 2.7 3.1 5.2 1.8 1.8-.9 2.7-5.2 6.5-7.4" fill="none" stroke="#07110f" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.6 23.2c2.4-1.2 2.1-5.5 5.2-5.1 2.4.3 2.7 3.1 5.2 1.8 1.8-.9 2.7-5.2 6.5-7.4" fill="none" stroke="#f3fff9" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7.6" cy="23.2" r="2" fill="currentColor" stroke="#f3fff9" stroke-width=".6"/><circle cx="24.5" cy="12.5" r="2" fill="currentColor" stroke="#f3fff9" stroke-width=".6"/><path d="m21.8 12.8 2.8-.6-.2 2.8" fill="none" stroke="#f3fff9" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>',
        asc: '<path d="m7.8 23.6 6-10.1 3.3 4.9 4.1-7.1 3.8 12.3Z" fill="#091310" fill-opacity=".72" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/><path d="m13.8 13.5 3.3 4.9 4.1-7.1-1.1 7.3-3.3 3.2-2.8-4.7Z" fill="#f3fff9" fill-opacity=".35" stroke="#f3fff9" stroke-width=".55" stroke-linejoin="round"/><path d="M8.5 24.4c3.9-1.6 4-6.1 7.3-6.8 2.4-.5 3.3-2.4 5.1-5.1" fill="none" stroke="#f3fff9" stroke-width="1.05" stroke-linecap="round"/><path d="m17.8 13.7 3.1-2.5.2 3.8" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>',
        time: '<circle cx="18" cy="14.4" r="7" fill="#07110f" fill-opacity=".82" stroke="currentColor" stroke-width="1.15"/><circle cx="18" cy="14.4" r="5.4" fill="currentColor" fill-opacity=".12" stroke="#f3fff9" stroke-opacity=".55" stroke-width=".55"/><path d="M18 10.2v4.4l3.1 1.7" fill="none" stroke="#f3fff9" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 6.5V7.7M25 14.4h-1.2M18 21.4v-1.2M11 14.4h1.2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="m8 24 4.1-5.5 2.4 2 2.4-2.3" fill="none" stroke="#f3fff9" stroke-width=".85" opacity=".8" stroke-linecap="round" stroke-linejoin="round"/>',
        peaks: '<path d="m5.9 23.8 6.5-10.3 3.5 5.1 4.8-9.1 6.4 14.3Z" fill="#091310" fill-opacity=".82" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="m12.4 13.5 3.5 5.1 4.8-9.1-1.4 9.6-3.4 4.7-3.5-5.2Z" fill="#f3fff9" fill-opacity=".44" stroke="#f3fff9" stroke-width=".5" stroke-linejoin="round"/><path d="M21.2 9.6V4.8" stroke="#f3fff9" stroke-width=".85" stroke-linecap="round"/><path d="m21.3 5 4 .9-4 1.4Z" fill="currentColor" stroke="#f3fff9" stroke-width=".45" stroke-linejoin="round"/><path d="m10.1 21.2 2.2-3.4 2 2.6" fill="none" stroke="#f3fff9" stroke-opacity=".65" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/>',
        steps: '<g transform="rotate(-22 12 17)"><path d="M10.2 12.2c-1.5 0-2.4 1.5-2.3 3.7.1 1.8.8 3.2 2.2 3.4 1.5.2 2.5-1.1 2.7-2.8.2-2-1-4.3-2.6-4.3Z" fill="currentColor" fill-opacity=".92" stroke="#f3fff9" stroke-width=".65"/><ellipse cx="8.4" cy="10.8" rx=".9" ry="1.2" fill="#f3fff9" fill-opacity=".85"/><ellipse cx="10.3" cy="10.2" rx=".8" ry="1.1" fill="#f3fff9" fill-opacity=".85"/><ellipse cx="12.1" cy="10.7" rx=".7" ry="1" fill="#f3fff9" fill-opacity=".8"/></g><g transform="rotate(22 21 19)"><path d="M21.4 15c-1.5 0-2.4 1.5-2.3 3.7.1 1.8.8 3.2 2.2 3.4 1.5.2 2.5-1.1 2.7-2.8.2-2-1-4.3-2.6-4.3Z" fill="currentColor" fill-opacity=".92" stroke="#f3fff9" stroke-width=".65"/><ellipse cx="19.6" cy="13.6" rx=".9" ry="1.2" fill="#f3fff9" fill-opacity=".85"/><ellipse cx="21.5" cy="13" rx=".8" ry="1.1" fill="#f3fff9" fill-opacity=".85"/><ellipse cx="23.3" cy="13.5" rx=".7" ry="1" fill="#f3fff9" fill-opacity=".8"/></g>'
    };

    const TITLE_MARK = '<svg viewBox="0 0 34 24" role="presentation" focusable="false"><path d="M1.5 21 10.5 8.3l4.2 5.1L22 2.5l10.5 18.5H1.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m7.3 21 3.2-4.5 2.3 2.1M18 9.4l4 4.9 2.2-2.2 4.1 7.2" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/></svg>';

    /* Mehrere Alpengrate geben der Wasserzeichen-Silhouette Tiefe, ohne die Kachel zu dominieren. */
    const WATERMARK = '<svg viewBox="0 0 260 90" preserveAspectRatio="xMaxYMid meet" focusable="false">' +
        '<path d="M0 75 18 64 34 69 51 51 65 62 82 42 97 57 113 49 130 65 147 55 165 66 184 39 202 55 220 45 241 61 260 53V90H0Z" fill="currentColor" opacity=".10"/>' +
        '<path d="M0 78 23 63 39 68 58 43 73 55 92 22 108 44 122 36 141 58 158 47 174 57 195 25 214 47 231 39 260 59V90H0Z" fill="currentColor" opacity=".15"/>' +
        '<path d="M0 85 27 75 47 80 67 68 90 75 112 61 130 69 151 58 174 73 193 65 216 76 238 64 260 71V90H0Z" fill="currentColor" opacity=".23"/>' +
        '<path d="M0 75 18 64 34 69 51 51 65 62 82 42 97 57 113 49 130 65 147 55 165 66 184 39 202 55 220 45 241 61 260 53" fill="none" stroke="currentColor" stroke-width="1" opacity=".46" stroke-linejoin="round"/>' +
        '<path d="M0 78 23 63 39 68 58 43 73 55 92 22 108 44 122 36 141 58 158 47 174 57 195 25 214 47 231 39 260 59" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<path d="m51 51 7-8 7 7m20-8 7-20 8 11m35 24 7-7 7 10m39-22 7-13 8 11m20 3 8-8 6 10" fill="none" stroke="currentColor" stroke-width="1.05" opacity=".78" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M0 84c36-9 58-4 89-10s54-1 85-8 52 0 86-7M44 89c27-6 45-5 69-9m49 3c21-5 48-4 71-9" fill="none" stroke="currentColor" stroke-width=".85" opacity=".52" stroke-linecap="round"/>' +
        '</svg>';

    let iconSequence = 0;

    function buildIcon(type) {
        const artId = 'dash-ms-art-' + (++iconSequence);
        const clipId = artId + '-clip';
        const skyId = artId + '-sky';
        const haloId = artId + '-halo';
        const ridgeId = artId + '-ridge';
        const detail = ICON_DETAILS[type] || ICON_DETAILS.asc;

        return '<svg class="dash-ms-symbol-svg" viewBox="0 0 36 36" aria-hidden="true" focusable="false">' +
            '<defs>' +
                '<clipPath id="' + clipId + '"><path d="M18 2.1 30.2 9.2v14.2L18 30.5 5.8 23.4V9.2Z"/></clipPath>' +
                '<linearGradient id="' + skyId + '" x1="0" y1="0" x2="0.9" y2="1">' +
                    '<stop offset="0" stop-color="#0a1715"/><stop offset=".55" stop-color="#102b25"/><stop offset="1" stop-color="#07100f"/>' +
                '</linearGradient>' +
                '<radialGradient id="' + haloId + '" cx=".72" cy=".22" r=".72">' +
                    '<stop offset="0" stop-color="currentColor" stop-opacity=".8"/><stop offset=".42" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/>' +
                '</radialGradient>' +
                '<linearGradient id="' + ridgeId + '" x1="0" y1="0" x2=".8" y2="1">' +
                    '<stop offset="0" stop-color="currentColor" stop-opacity=".72"/><stop offset="1" stop-color="#07100f" stop-opacity=".95"/>' +
                '</linearGradient>' +
            '</defs>' +
            '<g clip-path="url(#' + clipId + ')">' +
                '<rect x="4.5" y="1.5" width="27" height="30" fill="url(#' + skyId + ')"/>' +
                '<rect x="4.5" y="1.5" width="27" height="30" fill="url(#' + haloId + ')"/>' +
                '<circle cx="23" cy="8.2" r="2.1" fill="#f8ffe9" opacity=".86"/>' +
                '<circle cx="23" cy="8.2" r="4.7" fill="url(#' + haloId + ')" opacity=".76"/>' +
                '<path d="M4.8 21.5 9 16.5 12 19 17.2 11 21 16 24.3 13.2 31.2 21.8V31H4.8Z" fill="#18332c" opacity=".92"/>' +
                '<path d="m9 16.5 3 2.5 5.2-8 3.8 5 3.3-2.8" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width=".55" stroke-linejoin="round"/>' +
                '<path d="M4.8 24.1 10.1 19l3.1 2.3 4.8-7.4 4 4.8 3.5-3 5.7 7.2V31H4.8Z" fill="url(#' + ridgeId + ')"/>' +
                '<path d="m10.1 19 3.1 2.3 4.8-7.4 4 4.8 3.5-3" fill="none" stroke="#f3fff9" stroke-opacity=".46" stroke-width=".65" stroke-linejoin="round"/>' +
                '<path d="m15.2 17.3 2.8-3.4 1.8 2.5-2-.8-1.1 2.2Z" fill="#f3fff9" fill-opacity=".62"/>' +
                '<path d="M5.8 26.2c4-1.9 6.8-1.1 9.6-2.5s6.7-1 9.4-2.6 4.2-.7 5.4-1.4M8 28.3c3.6-1.1 5.9-.4 8.2-1.5m4.3 1.1c2.3-.9 4-.8 6.7-1.8" fill="none" stroke="currentColor" stroke-opacity=".26" stroke-width=".45" stroke-linecap="round"/>' +
                detail +
            '</g>' +
            FRAME +
        '</svg>';
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
