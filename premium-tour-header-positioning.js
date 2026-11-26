/* Premium Alpine — mobile-sichere TOP-3-Pfeilpositionierung.
   Rechnet Anker und Hinweis-Pfeil ausschließlich im lokalen Koordinatensystem
   der Modal-Karte. Dadurch können WebView-Transforms keine Mischkoordinaten
   zwischen Viewport und absolut positioniertem Hinweis erzeugen. */
(function () {
    'use strict';

    const anchors = new WeakMap();
    const cardSelector = '#tour-detail-modal .modal-card';
    const buttonSelector = '#tour-detail-modal [data-highlight-info-idx]';

    function alignArrow(card, button) {
        if (!card || !button || !button.isConnected) return;

        const toast = card.querySelector('.highlight-info-toast');
        if (!toast || !toast.classList.contains('show')) return;

        const cardRect = card.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        const cardStyle = window.getComputedStyle(card);
        const toastStyle = window.getComputedStyle(toast);

        const cardWidth = card.offsetWidth;
        const scaleX = cardWidth > 0 ? cardRect.width / cardWidth : 1;
        if (!Number.isFinite(scaleX) || scaleX <= 0) return;

        const cardBorderLeft = parseFloat(cardStyle.borderLeftWidth) || 0;
        const toastBorderLeft = parseFloat(toastStyle.borderLeftWidth) || 0;
        const anchorCenterX =
            (buttonRect.left + buttonRect.width / 2 - cardRect.left) / scaleX
            - cardBorderLeft
            + card.scrollLeft;

        const toastCenterX = parseFloat(toast.style.left || toastStyle.left);
        const toastWidth = toast.offsetWidth;
        if (!Number.isFinite(anchorCenterX) || !Number.isFinite(toastCenterX) || toastWidth <= 0) return;

        const toastBorderBoxLeft = toastCenterX - toastWidth / 2;
        const rawArrowLeft = anchorCenterX - toastBorderBoxLeft - toastBorderLeft;
        const minArrowLeft = 4;
        const maxArrowLeft = Math.max(minArrowLeft, toast.clientWidth - 4);
        const arrowLeft = Math.max(minArrowLeft, Math.min(maxArrowLeft, rawArrowLeft));

        toast.style.setProperty('--highlight-toast-arrow-left', arrowLeft + 'px');
    }

    function scheduleAlign(card, button) {
        if (!card || !button) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => alignArrow(card, button));
        });
    }

    document.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const button = target?.closest(buttonSelector);
        if (!button) return;

        const card = button.closest(cardSelector);
        if (!card) return;

        anchors.set(card, button);
        scheduleAlign(card, button);
    }, true);

    document.addEventListener('scroll', event => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        const card = target?.closest(cardSelector);
        if (card) scheduleAlign(card, anchors.get(card));
    }, true);

    window.addEventListener('resize', () => {
        const card = document.querySelector(cardSelector);
        if (card) scheduleAlign(card, anchors.get(card));
    }, { passive: true });
})();
