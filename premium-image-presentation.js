/* Premium Alpine — load-aware photo crossfades and high-quality canvas defaults.
   This module observes existing images only; it does not fetch new media. */
(function () {
    'use strict';

    const IMAGE_SELECTOR = [
        '#tour-detail-modal .tour-detail-image',
        '#image-lightbox-img',
        '#atg-photo-viewer .atg-viewer-image'
    ].join(',');

    const observedImages = new WeakSet();

    function markReady(image) {
        image.classList.remove('premium-photo-pending', 'premium-photo-error');
        image.classList.add('premium-photo-ready');
    }

    function markError(image) {
        image.classList.remove('premium-photo-pending', 'premium-photo-ready');
        image.classList.add('premium-photo-error');
    }

    function watchImage(image) {
        if (!(image instanceof HTMLImageElement) || observedImages.has(image)) return;
        if (!image.matches(IMAGE_SELECTOR)) return;

        observedImages.add(image);
        image.decoding = 'async';

        image.addEventListener('load', () => markReady(image));
        image.addEventListener('error', () => markError(image));

        if (image.getAttribute('src')) {
            image.classList.add('premium-photo-pending');
            if (image.complete) {
                if (image.naturalWidth > 0) markReady(image);
                else markError(image);
            }
        }
    }

    function scanNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        if (node instanceof HTMLImageElement) watchImage(node);
        node.querySelectorAll?.('img').forEach(watchImage);
    }

    function tuneWrappedCanvas() {
        const canvas = document.getElementById('wrapped-canvas');
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
    }

    function init() {
        document.querySelectorAll(IMAGE_SELECTOR).forEach(watchImage);
        tuneWrappedCanvas();

        const observer = new MutationObserver(records => {
            for (const record of records) {
                if (record.type === 'attributes' && record.attributeName === 'src') {
                    const image = record.target;
                    if (!(image instanceof HTMLImageElement)) continue;
                    image.classList.remove('premium-photo-ready', 'premium-photo-error');
                    image.classList.add('premium-photo-pending');
                    if (image.complete && image.getAttribute('src')) {
                        if (image.naturalWidth > 0) markReady(image);
                        else markError(image);
                    }
                    continue;
                }
                record.addedNodes.forEach(scanNode);
            }
            tuneWrappedCanvas();
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['src']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
