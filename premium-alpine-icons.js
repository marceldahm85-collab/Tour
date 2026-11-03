/* Premium Alpine Icons — einheitliche Kontur-Symbole für die gesamte App.
   Ersetzt ausschließlich UI-Piktogramme in Textknoten. Freie Tourtexte und Eingabefelder bleiben erhalten. */
(function () {
    'use strict';

    const PATHS = Object.freeze({
        tour: '<path d="M3 6.2 8.5 4l7 2 5.5-2v13.8l-5.5 2-7-2L3 20V6.2Z"/><path d="M8.5 4v13.8M15.5 6v13.8"/><path d="M4.5 9.2c1-.5 2-.6 3-.2M10 8.3c1.2.7 2.3.7 3.4.2M16.5 10.4l2.7-.9M10.4 15.6c1.2-1.9 2.4-2.4 3.3-4.2"/>',
        distance: '<path d="M4.2 19.8c1.6-3.3 2.7-4.7 5.1-5.1 2.2-.4 3.1 1.1 4.8.2 1.8-1 1.5-3.4 3.2-4.9"/><path d="M4.2 17.2c-1.3 0-2.3 1-2.3 2.2 0 1 2.3 3 2.3 3s2.3-2 2.3-3c0-1.2-1-2.2-2.3-2.2ZM18.1 2.4c-1.5 0-2.7 1.2-2.7 2.7 0 1.6 2.7 4.1 2.7 4.1s2.7-2.5 2.7-4.1c0-1.5-1.2-2.7-2.7-2.7Z"/><circle cx="4.2" cy="19.4" r=".65" class="premium-alpine-accent-fill"/><circle cx="18.1" cy="5.1" r=".7" class="premium-alpine-accent-fill"/><path d="M8.1 11.2 9.4 14.7 13.8 14.3 17.3 10" stroke-dasharray="1.2 1.7"/>',
        ascent: '<path d="m1.8 19.8 5.4-8.9 2.7 3.2L14.1 7l7.8 12.8H1.8Z"/><path d="m11.6 11.4 2.5-4.4 2.6 4.3-1.5-.7-1.1 1.3-1.1-.9-1.4.4Z" class="premium-alpine-accent-fill"/><path d="M18.4 14.5V3.3M15.6 6.2l2.8-2.9 2.8 2.9M4.3 19.8c1.4-1.1 2.7-1.1 4.1-.4 1.5.7 2.6.7 4.2-.2"/>',
        peaks: '<path d="m1.8 19.8 5.1-7.3 2.4 2.6L14.1 5l8.1 14.8H1.8Z"/><path d="m11.5 9.9 2.6-4.9 2 3.7-1.5-.7-1.1 1.4-1-.5Z" class="premium-alpine-accent-fill"/><path d="m4.8 15.5 2.1-3 2.4 2.6 4.8-8.8M5 19.8c1.8-1 3.1-1 4.7-.2 1.4.6 2.8.5 4.2-.2s2.7-.7 4.2 0"/>',
        steps: '<path d="M7.3 2.5C5.5 2.3 4.4 4 4.5 6c.1 1.5 1 2.7 1.1 4.1.1 1.2.4 2.2 1.7 2.4 1.5.2 2.8-1 2.9-2.5.1-1.4-.7-2.5-.4-4.1.3-1.9-.6-3.2-2.5-3.4ZM18 11.6c-1.8-.2-3.1 1.5-3 3.5.1 1.5 1 2.5 1.1 3.8.1 1.2.5 2.2 1.8 2.4 1.5.2 2.7-1.1 2.7-2.6 0-1.4-.8-2.4-.5-3.9.3-1.8-.4-3-2.1-3.2Z"/><circle cx="5.7" cy="4.3" r=".48" class="premium-alpine-accent-fill"/><circle cx="7.2" cy="3.7" r=".48" class="premium-alpine-accent-fill"/><circle cx="8.6" cy="4.5" r=".48" class="premium-alpine-accent-fill"/><circle cx="16.4" cy="13.6" r=".48" class="premium-alpine-accent-fill"/><circle cx="17.8" cy="12.9" r=".48" class="premium-alpine-accent-fill"/>',
        bigTour: '<path d="M12 2.4 14.1 4l2.7-.2 1.1 2.4 2.4 1.3-.2 2.7 1.5 2.1-1.5 2.2.2 2.6-2.4 1.3-1.1 2.4-2.7-.2-2.1 1.6-2.1-1.6-2.7.2-1.1-2.4-2.4-1.3.2-2.6L2.4 12l1.5-2.1-.2-2.7 2.4-1.3 1.1-2.4 2.7.2L12 2.4Z"/><path d="m5.7 14.6 3-4.6 2 2.1 2.7-4.6 5.1 7.1H5.7Z"/><path d="m10.7 10.2 1-1.7 1.1 1.8-.8-.4-.7.6-.6-.3Z" class="premium-alpine-accent-fill"/><path d="m7.2 17.7-.4 4 3.5-1.9 1.7 1.6 1.7-1.6 3.5 1.9-.4-4"/>',
        time: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2M9 2.5h6M12 2.5V3.5"/><circle cx="12" cy="12" r=".8" class="premium-alpine-accent-fill"/>',
        speed: '<path d="M3 18.8a9 9 0 1 1 18 0v1H3v-1Z"/><path d="M5.2 13.3 3.8 12M8.1 8.1 7.2 6.5M12 6.4V4.8M15.9 8.1l.9-1.6M18.8 13.3l1.4-1.3M12 16.5 16.7 9.7"/><circle cx="12" cy="16.5" r="1.8"/><circle cx="12" cy="16.5" r=".55" class="premium-alpine-accent-fill"/>',
        slope: '<path d="M3 19.8 20.5 5.2M3 19.8h18"/><path d="m16.8 5.5 3.7-.4-.4 3.7M7.4 19.8a4.4 4.4 0 0 0-1.1-2.9"/><circle cx="3.3" cy="19.5" r=".65" class="premium-alpine-accent-fill"/><circle cx="20.4" cy="5.3" r=".65" class="premium-alpine-accent-fill"/>',
        trend: '<path d="M3 3v18h18M5.5 16l4.2-4.1 3.1 1.8 5.7-7.1"/><path d="M14.8 6.6h3.7v3.7"/><circle cx="9.7" cy="11.9" r=".8" class="premium-alpine-accent-fill"/>',
        pin: '<path d="M12 21s7-6.6 7-12a7 7 0 0 0-14 0c0 5.4 7 12 7 12Z"/><path d="m7.5 12.5 2.5-3.7 1.5 2 1.8-3.3 3.2 5H7.5Z"/><circle cx="12" cy="6.8" r=".7" class="premium-alpine-accent-fill"/>',
        hiking: '<path d="M12 3.2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2ZM10.8 8l-2.3 4.1-3.1 2.3M10.1 9.3l3.1 2.2 2.3 4.1M8.5 12.1l-2.1 7.2M13.1 11.5l-.4 4.7 3.1 4M8.1 20.2l-3 .5M15.7 20.2l3.1.5"/>',
        climbing: '<path d="M5.5 20 8 14.8l3.5-2.2 1.3-4.3 3.2-2.8M12.6 5.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM8 14.8l-3-1.4-2 2.2M11.5 12.6l3.2 2.5 3.2-.6 2.2 2.1M8.3 15l1.4 5.1M17.9 5.5l2.5-2.5M17.2 9.5l3.5.1"/>',
        cycling: '<circle cx="5.2" cy="17.1" r="3.5"/><circle cx="18.7" cy="17.1" r="3.5"/><path d="m5.2 17.1 4.1-7.2 4.1 7.2H5.2ZM9.3 9.9h4.2l5.2 7.2M12.7 6.3h3.1M8.3 8.1l1-1.8"/>',
        backpack: '<path d="M8 6V5a4 4 0 0 1 8 0v1"/><rect x="4.2" y="6" width="15.6" height="15" rx="3"/><path d="M7.5 10h9M7.2 14h9.6v4H7.2zM4.5 11H2.8v5h1.7M19.5 11h1.7v5h-1.7"/>',
        compass: '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z"/><path d="M12 3v2M21 12h-2M12 21v-2M3 12h2"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 9h18M6.5 17l3-3 2.5 1.5 5-4M14.5 11.5H17V14"/>',
        chart: '<path d="M3 20.5h18M4.5 18V10h4v8M10 18V5h4v13M15.5 18v-6h4v6"/><path d="m5.5 7 4-3 4 1 5-3M15.8 2h2.7v2.7"/>',
        balance: '<path d="M12 3v17M7 21h10M5 6h14M12 3l-2 2M12 3l2 2"/><path d="m5 6-3 6h6L5 6ZM19 6l-3 6h6l-3-6Z"/><path d="M2.5 12c.3 1.7 1.1 2.5 2.5 2.5s2.2-.8 2.5-2.5M16.5 12c.3 1.7 1.1 2.5 2.5 2.5s2.2-.8 2.5-2.5"/>',
        compare: '<path d="M3 5h7M3 5l2.5-2.5M3 5l2.5 2.5M21 19h-7M21 19l-2.5-2.5M21 19l-2.5 2.5"/><path d="M5 9v7M9 9v7M15 8v8M19 8v8M3 16h8M13 8h8"/>',
        search: '<circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 5 5M8.1 10.8h5.4M10.8 8.1v5.4"/>',
        download: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 19h16v2H4z"/>',
        upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 18h16v3H4z"/>',
        save: '<path d="M4 3h13l3 3v15H4V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7M10 5h4"/>',
        book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"/><path d="M4 5v17M8 6h8M8 10h8M8 14h5"/>',
        file: '<path d="M6 2.5h8l5 5V21H6V2.5Z"/><path d="M14 2.5V8h5M9 12h7M9 16h7"/>',
        settings: '<circle cx="12" cy="12" r="3.2"/><path d="m19.4 13.5 1.1.9-1.5 2.6-1.4-.5a7.7 7.7 0 0 1-1.8 1l-.2 1.5h-3l-.3-1.5a7.7 7.7 0 0 1-1.8-1l-1.4.5-1.5-2.6 1.1-.9a7.1 7.1 0 0 1 0-2l-1.1-.9 1.5-2.6 1.4.5a7.7 7.7 0 0 1 1.8-1l.3-1.5h3l.2 1.5a7.7 7.7 0 0 1 1.8 1l1.4-.5 1.5 2.6-1.1.9a7.1 7.1 0 0 1 0 2Z"/>',
        palette: '<path d="M12 3a9 9 0 1 0 0 18h1.3a2 2 0 0 0 1.7-3c-.5-.8 0-1.8 1-1.8h1.3A3.7 3.7 0 0 0 21 12.5 9.5 9.5 0 0 0 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="11" cy="7.2" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="7.8" cy="14.5" r="1"/>',
        archive: '<path d="M3 4h18v4H3zM5 8v13h14V8M9 12h6M9 16h6"/>',
        link: '<path d="m9.5 14.5 5-5M7.4 16.6l-1.1 1.1a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M16.6 7.4l1.1-1.1a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/>',
        trophy: '<path d="M7 3h10v5.5a5 5 0 0 1-10 0V3ZM9 14v3h6v-3M7 20h10M12 17v3M7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4"/>',
        medal: '<circle cx="12" cy="9" r="6"/><path d="m8 14-1 8 5-2.8 5 2.8-1-8"/><path d="m12 5.5 1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3 1-2Z" class="premium-alpine-accent-fill"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.8" class="premium-alpine-accent-fill"/><path d="m15 9 5-5M16 4h4v4"/>',
        warning: '<path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5M12 17.5v.2"/>',
        success: '<circle cx="12" cy="12" r="9"/><path d="m7.5 12.2 3 3 6-6.5"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7.2v.2"/>',
        delete: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
        lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
        gift: '<rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M2 6h20v3H2zM12 6v15M12 6H8.5a2.5 2.5 0 1 1 2.5-2.5V6ZM12 6h3.5A2.5 2.5 0 1 0 13 3.5V6Z"/>',
        activity: '<path d="M3 12h4l2.2-6 4.1 12 2.1-6H21"/><circle cx="9.2" cy="6" r=".7" class="premium-alpine-accent-fill"/>',
        flag: '<path d="M5 21V3M5 4h13l-2.5 4L18 12H5"/><circle cx="5" cy="3" r=".8" class="premium-alpine-accent-fill"/>',
        map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15M11 11l2-2 2 2-2 3-2-3Z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M19.8 15.2A8.5 8.5 0 0 1 8.8 4.2 8.8 8.8 0 1 0 19.8 15.2Z"/><path d="m16.5 3 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" class="premium-alpine-accent-fill"/>',
        leaf: '<path d="M20.5 3.5C11 3.5 4 5.5 4 13a7 7 0 0 0 7 7c7.5 0 9.5-7 9.5-16.5Z"/><path d="M4 20c3-5 7-8 13-11"/>',
        share: '<path d="M12 16V3M7.5 7.5 12 3l4.5 4.5M5 13v8h14v-8"/>',
        stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
        pause: '<path d="M8 5v14M16 5v14"/>',
        play: '<path d="m8 4 12 8-12 8V4Z"/>',
        chevronLeft: '<path d="m15 4-8 8 8 8"/>',
        chevronRight: '<path d="m9 4 8 8-8 8"/>',
        performance: '<path d="m12 2 2.1 6.1L20 10l-5.9 2.1L12 18l-2.1-5.9L4 10l5.9-1.9L12 2Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" class="premium-alpine-accent-fill"/>',
        slow: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2M5 3l2 2M19 3l-2 2"/>',
        error: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>'
    });

    const TOKEN_TO_ICON = Object.freeze({
        '⏳': 'time', '🟡': 'sun', '🌙': 'moon', '🌿': 'leaf',
        '⛰️': 'peaks', '⛰': 'peaks', '🏔️': 'peaks', '🗻': 'peaks', '🌄': 'peaks',
        '⚠️': 'warning', '🗑️': 'delete', 'ℹ️': 'info',
        '📏': 'distance', '⏱️': 'time', '⏱': 'time', '🕐': 'time', '👣': 'steps',
        '🏅': 'medal', '📐': 'slope', '⬆️': 'ascent', '↗️': 'ascent', '↗': 'ascent',
        '💨': 'speed', '🎯': 'target', '💪🏼': 'bigTour', '💪': 'bigTour',
        '🥇': 'medal', '🥈': 'medal', '🥉': 'medal', '🔗': 'link',
        '📅': 'calendar', '🗓️': 'calendar', '🥾': 'hiking', '🧗‍♂️': 'climbing',
        '🧗': 'climbing', '🚵': 'cycling', '🚴': 'cycling', '🎒': 'backpack',
        '🧭': 'compass', '⚡': 'performance', '🧩': 'activity', '⚖️': 'balance',
        '🔬': 'compare', '🛤️': 'distance', '🛤': 'distance', '🏆': 'trophy',
        '📍': 'pin', '✅': 'success', '🚩': 'flag', '🗺️': 'map', '🎭': 'activity',
        '🎊': 'gift', '🔒': 'lock', '🎉': 'gift', '❌': 'error', '🗂': 'archive',
        '🐢': 'slow', '🐌': 'slow', '🔥': 'performance', '📈': 'trend', '📊': 'chart',
        '🔎': 'search', '💾': 'save', '📥': 'download', '📤': 'upload', '📖': 'book',
        '⚙️': 'settings', '📄': 'file', '🎨': 'palette', '🎁': 'gift', '⤴': 'share',
        '⏹': 'stop', '⏸': 'pause', 'Ⅱ': 'pause', '▶': 'play', '◀': 'chevronLeft',
        '✓': 'success'
    });

    const TOKENS = Object.keys(TOKEN_TO_ICON).sort((a, b) => b.length - a.length);
    const TOKEN_PATTERN = new RegExp(TOKENS.join('|'), 'gu');
    const PRESERVE_SELECTOR = [
        'script', 'style', 'svg', 'textarea', 'input', 'select', 'option', 'code', 'pre',
        '[contenteditable="true"]', '[data-user-content]', '[data-preserve-emoji]',
        '.tour-name', '.tour-title', '.tour-description', '.tour-notes', '.tour-comment',
        '.tour-card-title', '.tour-stage-name', '.planned-tour-name', '.planned-tour-description',
        '.tour-region-name', '.region-name', '.tour-detail-name', '#td-title'
    ].join(',');

    const STYLE = [
        '.premium-alpine-inline-icon{display:inline-flex;width:1.08em;height:1.08em;margin:0 .16em 0 0;align-items:center;justify-content:center;vertical-align:-.18em;color:inherit;flex:0 0 auto;line-height:1}',
        '.premium-alpine-inline-icon svg{display:block;width:100%;height:100%;overflow:visible;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}',
        '.premium-alpine-inline-icon .premium-alpine-accent-fill{fill:var(--accent,#D5A64C);stroke:none}',
        '.premium-alpine-inline-icon--rank-gold{color:#d8ad51}',
        '.premium-alpine-inline-icon--rank-silver{color:#c3ccd3}',
        '.premium-alpine-inline-icon--rank-bronze{color:#bd865c}',
        'button>.premium-alpine-inline-icon,.bergwelt-tab>.premium-alpine-inline-icon,.nav-item>.premium-alpine-inline-icon{margin-right:.24em}'
    ].join('');

    function rankClass(token) {
        if (token === '🥇') return ' premium-alpine-inline-icon--rank-gold';
        if (token === '🥈') return ' premium-alpine-inline-icon--rank-silver';
        if (token === '🥉') return ' premium-alpine-inline-icon--rank-bronze';
        return '';
    }

    function html(key, token = '') {
        const path = PATHS[key] || PATHS.peaks;
        return '<span class="premium-alpine-inline-icon' + rankClass(token) +
            '" data-premium-alpine-icon="' + key + '" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" focusable="false">' + path + '</svg></span>';
    }

    function isPreservedTextNode(node) {
        const parent = node.parentElement;
        if (!parent) return true;
        if (!parent.closest(PRESERVE_SELECTOR)) return false;
        // In Tournamen bleiben Emojis als Bestandteil des frei eingegebenen Namens erhalten.
        // Separat erzeugte Status-/Rang-Badges innerhalb derselben Zeile werden dennoch ersetzt.
        if (parent.closest('.big-tour-flag,.highlight-title-flag,.gradient-flag,.tour-group-badge')) return false;
        return true;
    }

    function replaceTextNode(node) {
        if (!node || node.nodeType !== 3 || isPreservedTextNode(node)) return;
        const value = node.nodeValue || '';
        const pattern = new RegExp(TOKEN_PATTERN.source, 'gu');
        if (!pattern.test(value)) return;
        pattern.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let cursor = 0;
        let match;
        while ((match = pattern.exec(value))) {
            const token = match[0];
            const key = TOKEN_TO_ICON[token];
            if (!key) continue;
            if (match.index > cursor) {
                fragment.appendChild(document.createTextNode(value.slice(cursor, match.index)));
            }
            const holder = document.createElement('span');
            holder.innerHTML = html(key, token);
            fragment.appendChild(holder.firstElementChild);
            cursor = match.index + token.length;
        }
        if (cursor === 0) return;
        if (cursor < value.length) {
            fragment.appendChild(document.createTextNode(value.slice(cursor)));
        }
        node.parentNode?.replaceChild(fragment, node);
    }

    function scan(root) {
        if (!root) return;
        if (root.nodeType === 3) {
            replaceTextNode(root);
            return;
        }
        if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(replaceTextNode);
    }

    function init() {
        if (!document.getElementById('premium-alpine-icon-style')) {
            const style = document.createElement('style');
            style.id = 'premium-alpine-icon-style';
            style.textContent = STYLE;
            document.head.appendChild(style);
        }

        scan(document.body || document.documentElement);
        const observer = new MutationObserver(records => {
            records.forEach(record => {
                if (record.type === 'characterData') {
                    replaceTextNode(record.target);
                    return;
                }
                record.addedNodes.forEach(scan);
            });
        });
        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true
        });

        window.PremiumAlpineIcons = Object.freeze({
            html,
            keyForToken: token => TOKEN_TO_ICON[token] || 'peaks',
            refresh: root => scan(root || document.body)
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();