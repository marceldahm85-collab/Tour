// Osttirol-Wrapped: persönlicher Fotohintergrund für die Grenzvergleichsfolie.
(() => {
    const originalDrawWrappedBackground = drawWrappedBackground;
    const background = new Image();
    let backgroundReady = false;

    background.decoding = 'async';
    background.onload = () => {
        backgroundReady = true;
        const currentSlide = wrappedSlides?.[wrappedSlideIndex];
        if (currentSlide?.key === 'osttirolLoop') {
            renderWrappedSlide(wrappedSlideIndex);
        }
    };
    background.onerror = () => {
        console.warn('[Jahresrückblick] Osttirol-Hintergrundfoto konnte nicht geladen werden.');
    };

    drawWrappedBackground = function(ctx, w, h, photoImg, slideKey, slideData) {
        if (slideKey !== 'osttirolLoop' || !backgroundReady) {
            return originalDrawWrappedBackground(ctx, w, h, photoImg, slideKey, slideData);
        }

        const colors = getWrappedThemeColors();
        drawWrappedCoverImage(ctx, background, w, h, true);

        // Dezente Abdunklung: das Foto bleibt erkennbar, Karte und Kennzahlen
        // behalten aber auch auf dem hellen Himmel einen klaren Kontrast.
        const overlay = ctx.createLinearGradient(0, 0, 0, h);
        overlay.addColorStop(0, 'rgba(2, 8, 14, 0.42)');
        overlay.addColorStop(0.34, 'rgba(2, 8, 14, 0.34)');
        overlay.addColorStop(0.68, 'rgba(2, 8, 14, 0.48)');
        overlay.addColorStop(1, 'rgba(2, 8, 14, 0.70)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, w, h);

        return colors;
    };

    background.src = './assets/osttirol-lienz-background.webp';
})();
