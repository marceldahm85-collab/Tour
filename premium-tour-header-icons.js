/* Premium Alpine — eigenständige SVG-Familie für den Einzeltour-Header. */
(function () {
    'use strict';

    const CATEGORY_KEYS = Object.freeze({
        'Längste Strecke': 'distance',
        'Größter Aufstieg': 'ascent',
        'Längste Gehzeit': 'duration',
        'Meiste Schritte': 'steps',
        'Größte Big Tour': 'big-tour-category',
        'Schnellste Tour': 'speed',
        'Steilste Tour': 'slope',
        'Schnellster Anstieg': 'ascent-rate',
        'Bester Leistungsindex': 'performance',
        'Höchster Gipfel': 'summit'
    });

    const PATHS = Object.freeze({
        distance: '<path d="M4 18.5c2.4-4.1 4.7-5.8 7-4.5 2.1 1.3 3.4 2.2 5.2-.2L20 8.5"/><path d="M16.2 8.5H20v3.8"/><circle cx="4" cy="18.5" r="2.1"/><circle cx="20" cy="8.5" r="2.1"/>',
        ascent: '<path d="m3 20 7.1-11 3.3 4.5L17 6l4 14H3Z"/><path d="M17.5 18V2.8m-3 3 3-3 3 3"/><path class="tour-header-accent" d="m10.1 9 2.1 2.8 4.8-5.8"/>',
        duration: '<circle cx="12" cy="13" r="8.2"/><path d="M12 8.2V13l3.5 2.1M9 2.5h6M12 2.5v2.2"/><path class="tour-header-accent" d="M5.2 7.2A9.1 9.1 0 0 1 12 4.8"/>',
        steps: '<path d="M7.2 3.1c-1.8-.2-2.8 1.4-2.7 3.2.1 1.4.9 2.5 1 3.8.1 1.2.5 2.1 1.7 2.2 1.4.2 2.6-.9 2.7-2.3.1-1.3-.6-2.3-.4-3.8.2-1.8-.6-2.9-2.3-3.1Z"/><path d="M17.3 11.6c-1.7-.2-2.9 1.3-2.8 3.1.1 1.3.9 2.3 1 3.6.1 1.1.5 2 1.7 2.2 1.4.2 2.5-1 2.5-2.4 0-1.3-.7-2.2-.5-3.6.2-1.7-.4-2.8-1.9-2.9Z"/><circle class="tour-header-accent-fill" cx="5.8" cy="4.5" r=".55"/><circle class="tour-header-accent-fill" cx="7.4" cy="4" r=".55"/><circle class="tour-header-accent-fill" cx="8.8" cy="4.7" r=".55"/><circle class="tour-header-accent-fill" cx="16" cy="13.4" r=".55"/><circle class="tour-header-accent-fill" cx="17.5" cy="12.9" r=".55"/>',
        'big-tour-category': '<path d="m3 20 6.2-10 3.1 4 3.5-6 5.2 12H3Z"/><path d="M8.2 8.2V6.8a3.8 3.8 0 0 1 7.6 0v1.4"/><rect x="6.8" y="8.2" width="10.5" height="11" rx="2.1"/><path d="M9.2 11.3h5.7v4.1H9.2z"/><path class="tour-header-accent" d="M9.2 11.3h5.7"/>',
        speed: '<path d="M3.3 18.8a8.7 8.7 0 1 1 17.4 0v1H3.3v-1Z"/><path d="m12 17.4 5.2-7.1"/><circle cx="12" cy="17.4" r="1.8"/><path d="m5.4 12.5-1.3-1.1m4.2-3.7-.7-1.6m4.4.1V4.5m4.2 3.2.8-1.6m2.1 6.4 1.3-1.1"/>',
        slope: '<path d="M3 19.5h18L3 4.5v15Z"/><path d="M3 19.5 19.7 5.6"/><path class="tour-header-accent" d="M8.4 19.5a5.4 5.4 0 0 0-1.6-3.8"/><circle cx="3" cy="19.5" r="1.1"/><circle cx="19.7" cy="5.6" r="1.1"/>',
        'ascent-rate': '<circle cx="10.5" cy="14" r="7.2"/><path d="M8.1 3.2h4.8m-2.4 0v3.5m-5.6-.8 1.7 1.7m5.9 4.1V14l2.4 1.5"/><path d="M19 21V8.2m-2.8 2.9L19 8.2l2.8 2.9"/><path class="tour-header-accent" d="M19 21V8.2"/>',
        performance: '<path d="M3.2 18.8a8.8 8.8 0 1 1 17.6 0v1H3.2v-1Z"/><path d="m12 17.5 5.4-7.2"/><circle cx="12" cy="17.5" r="1.7"/><path class="tour-header-accent" d="m12 5.2 1.2 2.4 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4Z"/>',
        summit: '<path d="m2.5 20 6.3-10 3.1 4.1L17 4l4.5 16h-19Z"/><path d="M17 4V1.8m0 0h4.2l-1.3 1.6 1.3 1.6H17"/><path class="tour-header-accent" d="m17 4 1.2 1.4 1.1-1.4"/>'
    });

    function svg(paths) {
        return '<svg class="tour-header-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths + '</svg>';
    }

    function emblem() {
        return '<span class="tour-header-emblem" aria-hidden="true">' +
            '<svg viewBox="0 0 32 36" focusable="false">' +
            '<path class="tour-emblem-shield" d="M16 1.8 29 6.5v10.1c0 8.1-5.2 13.9-13 17.7C8.2 30.5 3 24.7 3 16.6V6.5L16 1.8Z"/>' +
            '<path d="m6.8 21.8 7.3-11.2 4.2 5.5 3.2-8 4.1 13.7H6.8Z"/>' +
            '<path class="tour-header-accent" d="M9.2 25.2c4.2-1.3 6.3-4.4 8.6-7.8 1.2-1.8 2.2-3.8 3.8-6m-1.5.8 1.8-.4-.1 1.9"/>' +
            '<path class="tour-header-accent-fill" d="m16 4.7 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3Z"/>' +
            '</svg></span>';
    }

    function category(name) {
        const paths = PATHS[CATEGORY_KEYS[name]];
        return paths ? svg(paths) : '';
    }

    function indicator(key, label) {
        const paths = key === 'big-tour'
            ? '<path d="m3 20 6.5-11 3.5 4.6L17 5l4 15H3Z"/><path d="M17 5V2m0 0h4.1l-1.3 1.5 1.3 1.5H17"/><path class="tour-header-accent" d="M8 17.5h9"/>'
            : '<path d="M2.5 19.5h19"/><path d="m3.5 16.8 4-2.1 3.5-5.5 3.3 3.4 5.8-8"/><circle cx="3.5" cy="16.8" r="1.4"/><circle cx="20.1" cy="4.6" r="1.4"/><path class="tour-header-accent" d="M3.5 16.8 7.5 14.7 11 9.2 14.3 12.6 20.1 4.6"/>';

        return '<span class="tour-header-indicator" role="img" aria-label="' + label + '" title="' + label + '">' +
            svg(paths) + '</span>';
    }

    window.PremiumTourHeaderIcons = Object.freeze({
        emblem,
        category,
        bigTour: () => indicator('big-tour', 'Big Tour'),
        fullDistance: () => indicator('full-distance', 'Steigung mit voller Strecke')
    });
})();