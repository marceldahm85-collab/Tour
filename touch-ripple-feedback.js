/* Bestehendes Touch-Ripple-Feedback für normale Bedienelemente.
   Die zwölf Stats-Diagramm-Canvas erhalten ihr eigenes, gezieltes Tap-Highlight-CSS. */
(() => {
    'use strict';

    const RIPPLE_SELECTOR = [
        'button.save-btn', '.toggle-btn', '#theme-toggle', '.delete-btn', '.edit-btn', '.load-btn',
        '.chart-tab', '.quick-filter-btn', '.yc-metric-btn', '.yc-year-toggle-btn', '.map-mode-btn',
        '.compare-mode-btn', '.checklist-mode-btn', '.chart-stat-tile',
        '.dash-stat-tile', '.dash-milestone-tile', '.tour-page-btn', '.mob-sel-opt', '.checklist-item',
        '.highlight-clickable', '.peak-tour-list li', '.dash-tour-list li',
        '#saved-tours-list .tour-list li', '#planned-tours-list .tour-list li', '.box-header',
        '.map-popup-btn', '.dash-year-arrow-btn'
    ].join(',');

    function spawnRipple(target, x, y) {
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.8;
        const span = document.createElement('span');
        span.className = 'ripple-el';
        span.style.width = span.style.height = size + 'px';
        span.style.left = (x - rect.left - size / 2) + 'px';
        span.style.top = (y - rect.top - size / 2) + 'px';
        target.appendChild(span);
        requestAnimationFrame(() => span.classList.add('ripple-animate'));
        span.addEventListener('animationend', () => span.remove());
        setTimeout(() => { if (span.parentNode) span.remove(); }, 700);
    }

    function handleTouchStart(event) {
        const target = event.target.closest(RIPPLE_SELECTOR);
        if (!target || target.disabled) return;
        const point = event.touches ? event.touches[0] : event;
        spawnRipple(target, point.clientX, point.clientY);
    }

    if (window.matchMedia('(hover: none)').matches) {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
    }
})();
