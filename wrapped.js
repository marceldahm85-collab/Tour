/*
 * Diese Funktionen messen wir
 * in der ersten Runde.
 */
if (APP_PERF_ENABLED) {

    [
        'initStorage',

        'loadData',
        'getFilteredData',

        'getStatsFilteredData',
        'populateStatsYearSelect',

        'updateStats',
        'updateHighlights',

        'updateCharts',
        'drawActiveChart',

        'renderDashboard',

        'syncMobileTourListFromTable',

        'populateCompareOptions',

        'loadPlannedTours',
        'updatePlannedPeaks',

        'calculatePerformanceIndex',

        'isBigTourCountable',
        'getBigTourIndex'

    ].forEach(
        appPerfWrap
    );
}


/* =========================================================
   Mobile Querformat – nach dem Drehen nur Karten/Diagramme
   neu vermessen. Das aktive Theme wird dabei NICHT verändert.
   ========================================================= */
(function initLandscapeLayoutRefresh() {
    let landscapeRefreshTimer = null;

    const refresh = () => {
        clearTimeout(landscapeRefreshTimer);
        landscapeRefreshTimer = setTimeout(() => {
            requestAnimationFrame(() => {
                if (typeof tourMap !== 'undefined' && tourMap) {
                    tourMap.invalidateSize();
                }

                if (typeof redrawChartViewIfNeeded === 'function') {
                    redrawChartViewIfNeeded();
                }
            });
        }, 160);
    };

    /*
     * Das Theme wird beim Drehen nicht mehr neu gesetzt.
     * Der aktive Theme-Zustand bleibt dadurch unverändert.
     * Bei einem echten Reload greift weiterhin der Theme-Bootstrap
     * am Anfang des Dokuments.
     */
    window.addEventListener('orientationchange', refresh, { passive: true });

    window.addEventListener('resize', () => {
        if (window.matchMedia('(orientation: landscape) and (pointer: coarse)').matches) {
            refresh();
        }
    }, { passive: true });
})();

function showWrappedReminderBanner(year) {
    const banner = document.getElementById('wrapped-reminder-banner');
    const text = document.getElementById('wrapped-reminder-text');
    const openBtn = document.getElementById('wrapped-reminder-open');
    const closeBtn = document.getElementById('wrapped-reminder-dismiss');

    text.textContent = `Dein Jahresrückblick ${year} ist bereit!`;
    banner.hidden = false;

    const hide = () => { banner.hidden = true; };

    openBtn.onclick = () => {
        hide();
        openWrappedView(year);
    };
    closeBtn.onclick = hide;
}

const ACHIEVEMENTS_WEEKLY_BANNER_KEY = 'achievementsWeeklyBannerShown_v1';

function getCurrentMondayDateString() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sonntag, 1 = Montag, ...
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
}

function getRecentlyUnlockedAchievements(days = 7) {
    const unlocked = appStorage.get(ACHIEVEMENTS_KEY) || {};
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return Object.entries(unlocked)
        .filter(([id, info]) => info?.unlockedAt && new Date(info.unlockedAt).getTime() >= cutoff)
        .map(([id, info]) => ({ id, ...info }));
}

function showAchievementsWeeklyBanner(count) {
    const banner = document.getElementById('achievements-weekly-banner');
    const text = document.getElementById('achievements-weekly-text');
    const openBtn = document.getElementById('achievements-weekly-open');
    const closeBtn = document.getElementById('achievements-weekly-dismiss');

    if (!banner || !text || !openBtn || !closeBtn) return;

    text.textContent = count === 1
        ? 'Diese Woche erreicht: 1 neues Abzeichen!'
        : `Diese Woche erreicht: ${count} neue Abzeichen!`;

    banner.hidden = false;

    const hide = () => { banner.hidden = true; };

    openBtn.onclick = () => {
        hide();
        goToView('achievements');
    };
    closeBtn.onclick = hide;
}

function checkAchievementsWeeklyBanner() {
    // Falls der Wrapped-Januar-Banner gerade sichtbar ist, nicht überlagern –
    // stattdessen einfach bis zur nächsten Woche warten.
    const wrappedBanner = document.getElementById('wrapped-reminder-banner');
    if (wrappedBanner && !wrappedBanner.hidden) return;

    const currentMonday = getCurrentMondayDateString();
    const lastShownMonday = appStorage.get(ACHIEVEMENTS_WEEKLY_BANNER_KEY);

    if (lastShownMonday === currentMonday) return;

    const recent = getRecentlyUnlockedAchievements(7);
    if (!recent.length) return;

    appStorage.set(ACHIEVEMENTS_WEEKLY_BANNER_KEY, currentMonday);
    showAchievementsWeeklyBanner(recent.length);
}

/* =========================================================
   Jahresrückblick – zentrale Schriftsteuerung
   ========================================================= */

function getWrappedFontFamily() {
    if (
        typeof getThemeEditorFontName === 'function' &&
        typeof THEME_EDITOR_FONT_PRESETS !== 'undefined'
    ) {
        const fontName = getThemeEditorFontName();

        return THEME_EDITOR_FONT_PRESETS[fontName]
            || THEME_EDITOR_FONT_PRESETS.android;
    }

    return 'Roboto, "Noto Sans", system-ui, sans-serif';
}

function getWrappedFontScale() {
    let appScale = 1;

    if (typeof getThemeEditorFontSizeScale === 'function') {
        appScale =
            Number(getThemeEditorFontSizeScale()) / 100;
    }

    /*
     * Begrenzung verhindert, dass das Canvas-Layout
     * bei sehr großen globalen Schriftgrößen zerbricht.
     */
    return Math.max(
        0.86,
        Math.min(1.18, appScale)
    );
}

function setWrappedFont(
    ctx,
    size,
    weight = 'normal',
    style = 'normal'
) {
    const scaledSize = Math.round(
        Number(size) * getWrappedFontScale()
    );

    ctx.font =
        `${style} ${weight} ${scaledSize}px ${getWrappedFontFamily()}`;
}

function renderWrappedSlideToCanvas(slide, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const colors = drawWrappedBackground(ctx, width, height, slide.photoImg || null);

    switch (slide.key) {
        case 'intro': renderWrappedIntroSlide(ctx, width, height, colors, slide.data); break;
        case 'distance': renderWrappedDistanceSlide(ctx, width, height, colors, slide.data); break;
        case 'ascent': renderWrappedAscentSlide(ctx, width, height, colors, slide.data); break;
        case 'time': renderWrappedTimeSlide(ctx, width, height, colors, slide.data); break;
        case 'activeMonth': renderWrappedActiveMonthSlide(ctx, width, height, colors, slide.data); break;
        case 'bestTour': renderWrappedBestTourSlide(ctx, width, height, colors, slide.data); break;
        case 'highestPeak': renderWrappedHighestPeakSlide(ctx, width, height, colors, slide.data); break;
        case 'topRegion': renderWrappedTopRegionSlide(ctx, width, height, colors, slide.data); break;
        case 'highlights': renderWrappedHighlightsSlide(ctx, width, height, colors, slide.data); break;
        case 'yearCompare': renderWrappedYearCompareSlide(ctx, width, height, colors, slide.data); break;
        case 'top3': renderWrappedTop3Slide(ctx, width, height, colors, slide.data); break;
        case 'topCompanion': renderWrappedTopCompanionSlide(ctx, width, height, colors, slide.data); break;
        case 'outro': renderWrappedOutroSlide(ctx, width, height, colors, slide.data); break;
    }

    drawWrappedFooter(ctx, width, height, wrappedCurrentYear);
    return canvas;
}

function canvasToBlobAsync(canvas) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

async function shareAllWrappedSlides(year) {
    if (!wrappedSlides.length) return;

    showToast?.('Bilder werden vorbereitet…', { type: 'info', duration: 2000 });

    const refCanvas = document.getElementById('wrapped-canvas');
    const width = refCanvas.width;
    const height = refCanvas.height;

    const files = [];

    for (let i = 0; i < wrappedSlides.length; i++) {
        const slide = wrappedSlides[i];
        const canvas = renderWrappedSlideToCanvas(slide, width, height);
        const blob = await canvasToBlobAsync(canvas);
        if (!blob) continue;
        const filename = `jahresrueckblick-${year}-${String(i + 1).padStart(2, '0')}-${slide.key}.png`;
        files.push(new File([blob], filename, { type: 'image/png' }));
    }

    if (!files.length) return;

    const canUseShare = navigator.canShare && navigator.canShare({ files });

    if (canUseShare) {
        try {
            await navigator.share({
                files,
                title: `Jahresrückblick ${year}`,
                text: `Mein Bergtour-Jahresrückblick ${year} 🏔️`
            });
            return;
        } catch (err) {
            if (err.name === 'AbortError') return;
        }
    }

    for (const file of files) {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(r => setTimeout(r, 300));
        URL.revokeObjectURL(url);
    }

    showToast?.('Bilder wurden einzeln heruntergeladen (dein Browser unterstützt kein Teilen mehrerer Bilder auf einmal).', { type: 'info', duration: 4000 });
}

async function openWrappedView(year) {
    wrappedCurrentYear = year;
    wrappedSlides = buildWrappedSlideData(year);
    wrappedSlideIndex = 0;

    // Rückblick startet grundsätzlich pausiert.
    wrappedPaused = true;
    clearWrappedAutoAdvance();

    populateWrappedYearSelect();
    renderWrappedProgressBar();
    updateWrappedProgressSegments();

    goToView('wrapped');
    renderWrappedSlide(0);
    updateWrappedPauseButtonLabel();

    await attachWrappedPhotos(wrappedSlides, year);
    renderWrappedSlide(wrappedSlideIndex);
}

function populateWrappedYearSelect() {
    const select =
        document.getElementById('wrapped-year-select');

    if (!select) return;

    const years =
        getWrappedAvailableYears();

    select.innerHTML = years.map(year =>
        `<option value="${year}" ${
            year === wrappedCurrentYear
                ? 'selected'
                : ''
        }>${year}</option>`
    ).join('');

    select.value = String(wrappedCurrentYear);
}

function renderWrappedProgressBar() {
    const bar = document.getElementById('wrapped-progress-bar');
    bar.innerHTML = wrappedSlides.map(() =>
        '<div class="wrapped-progress-segment"><div class="wrapped-progress-fill"></div></div>'
    ).join('');
}

function updateWrappedProgressSegments() {
    const segments = document.querySelectorAll('.wrapped-progress-fill');
    segments.forEach((seg, i) => {
        seg.style.transition = 'none';
        seg.style.width = i < wrappedSlideIndex ? '100%' : '0%';
    });
}

function startWrappedAutoAdvance() {
    clearWrappedAutoAdvance();
    const slide = wrappedSlides[wrappedSlideIndex];
    if (!slide) return;

    wrappedAutoAdvanceRemaining = slide.duration;
    wrappedAutoAdvanceStart = Date.now();
    animateWrappedCurrentSegment(wrappedAutoAdvanceRemaining);

    wrappedAutoAdvanceTimer = setTimeout(() => {
        goToWrappedSlide(wrappedSlideIndex + 1);
    }, wrappedAutoAdvanceRemaining);
}

function animateWrappedCurrentSegment(duration) {
    const segments = document.querySelectorAll('.wrapped-progress-fill');
    const current = segments[wrappedSlideIndex];
    if (!current) return;

    current.style.transition = 'none';
    current.style.width = '0%';

    requestAnimationFrame(() => {
        current.style.transition = `width ${duration}ms linear`;
        current.style.width = '100%';
    });
}

function pauseWrappedAutoAdvance() {
    if (wrappedPaused) return;
    wrappedPaused = true;
    clearTimeout(wrappedAutoAdvanceTimer);

    const elapsed = Date.now() - wrappedAutoAdvanceStart;
    wrappedAutoAdvanceRemaining = Math.max(0, wrappedAutoAdvanceRemaining - elapsed);

    const segments = document.querySelectorAll('.wrapped-progress-fill');
    const current = segments[wrappedSlideIndex];
    if (current) {
        const computedWidth = getComputedStyle(current).width;
        current.style.transition = 'none';
        current.style.width = computedWidth;
    }

    updateWrappedPauseButtonLabel();
}

function resumeWrappedAutoAdvance() {
    if (!wrappedPaused) return;
    wrappedPaused = false;

    wrappedAutoAdvanceStart = Date.now();
    animateWrappedCurrentSegment(wrappedAutoAdvanceRemaining);

    wrappedAutoAdvanceTimer = setTimeout(() => {
        goToWrappedSlide(wrappedSlideIndex + 1);
    }, wrappedAutoAdvanceRemaining);

    updateWrappedPauseButtonLabel();
}

function updateWrappedPauseButtonLabel() {
    const btn = document.getElementById('wrapped-pause-btn');
    if (!btn) return;
    btn.textContent = wrappedPaused ? '▶ Fortsetzen' : '⏸ Pause';
}

function clearWrappedAutoAdvance() {
    clearTimeout(wrappedAutoAdvanceTimer);
    wrappedAutoAdvanceTimer = null;
}

function goToWrappedSlide(index) {
    if (index < 0) return;

    if (index >= wrappedSlides.length) {
        clearWrappedAutoAdvance();
        wrappedPaused = true;
        updateWrappedPauseButtonLabel();
        return;
    }

    wrappedSlideIndex = index;

    updateWrappedProgressSegments();
    renderWrappedSlide(wrappedSlideIndex);

    /*
     * Beim manuellen Durchblättern bleibt der Rückblick pausiert,
     * sofern er vorher pausiert war.
     */
    if (!wrappedPaused) {
        startWrappedAutoAdvance();
    } else {
        clearWrappedAutoAdvance();
        updateWrappedPauseButtonLabel();
    }
}

function initWrappedControls() {
    const left = document.getElementById('wrapped-tap-left');
    const right = document.getElementById('wrapped-tap-right');
    const stage = document.getElementById('wrapped-stage');

    left.addEventListener('click', () => goToWrappedSlide(wrappedSlideIndex - 1));
    right.addEventListener('click', () => goToWrappedSlide(wrappedSlideIndex + 1));

    let holdTimer = null;
let holdTriggered = false;

const startHold = () => {
    holdTriggered = false;

    holdTimer = setTimeout(() => {
        holdTriggered = true;
        pauseWrappedAutoAdvance();
    }, 180);
};

const endHold = () => {
    clearTimeout(holdTimer);
    holdTimer = null;

    /*
     * Nur ein echtes Gedrückthalten setzt die Wiedergabe fort.
     * Ein normaler Klick auf das Slide startet nichts.
     */
    if (holdTriggered) {
        resumeWrappedAutoAdvance();
    }

    holdTriggered = false;
};

    stage.addEventListener('pointerdown', startHold);
    stage.addEventListener('pointerup', endHold);
    stage.addEventListener('pointerleave', endHold);
    stage.addEventListener('pointercancel', endHold);

    let touchStartX = 0;
    stage.addEventListener('touchstart', e => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });

    stage.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) {
            dx < 0 ? goToWrappedSlide(wrappedSlideIndex + 1) : goToWrappedSlide(wrappedSlideIndex - 1);
        }
    }, { passive: true });

    document.getElementById('wrapped-stop-btn').addEventListener('click', () => {
    clearWrappedAutoAdvance();
    wrappedPaused = true;
    wrappedSlideIndex = 0;
    updateWrappedProgressSegments();
    renderWrappedSlide(0);
    updateWrappedPauseButtonLabel();
    });

  document.getElementById('wrapped-pause-btn').addEventListener('click', () => {
    if (wrappedPaused) {
        resumeWrappedAutoAdvance();
    } else {
        pauseWrappedAutoAdvance();
    }
    });

    document.getElementById('wrapped-back-btn').addEventListener('click', () => {
    clearWrappedAutoAdvance();
    exitWrappedFullscreenIfActive();
    goToView('dashboard');
});

    document.getElementById('wrapped-year-select').addEventListener('change', e => {
        openWrappedView(Number(e.target.value));
    });

    document.getElementById('wrapped-share-btn').addEventListener('click', () => {
        shareAllWrappedSlides(wrappedCurrentYear);
    });

    document.getElementById('wrapped-toggle').addEventListener('click', () => {
        const years = getWrappedAvailableYears();
        if (!years.length) return;
        closeMoreMenu?.();
        openWrappedView(years[0]);
    });

    document.getElementById('wrapped-fullscreen-btn')?.addEventListener('click', toggleWrappedFullscreen);
}

function getWrappedThemeColors() {
    const theme = themeEditorGetActiveTheme(); // ← statt document.body.dataset.theme
    const palettes = {
        light:  { bg1: '#4facfe', bg2: '#43e97b', text: '#0b2447', accent: '#ffffff' },
        dark:   { bg1: '#8e0e00', bg2: '#1f1c2c', text: '#ffffff', accent: '#ff6b6b' },
        green:  { bg1: '#11998e', bg2: '#0f0f0f', text: '#ffffff', accent: '#38ef7d' },
        summit: { bg1: '#2980b9', bg2: '#2c3e50', text: '#ffffff', accent: '#f5f5f5' }
    };
    return palettes[theme] || palettes.light;
}

function drawWrappedBackground(ctx, w, h, photoImg) {
    const colors = getWrappedThemeColors();

    if (photoImg) {
        drawWrappedCoverImage(ctx, photoImg, w, h);

        const overlay = ctx.createLinearGradient(0, 0, 0, h);
        overlay.addColorStop(0, 'rgba(0,0,0,0.55)');
        overlay.addColorStop(0.5, 'rgba(0,0,0,0.30)');
        overlay.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, w, h);
    } else {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, colors.bg1);
        gradient.addColorStop(1, colors.bg2);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    return colors;
}

function drawWrappedCoverImage(ctx, img, w, h) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx, sy, sw, sh;

    if (imgRatio > boxRatio) {
        sh = img.height;
        sw = sh * boxRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else {
        sw = img.width;
        sh = sw / boxRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
    }

    ctx.filter = 'blur(2px) brightness(0.9)';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    ctx.filter = 'none';
}

function wrapWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(' ');
    let line = '';
    let currentY = y;

    words.forEach(word => {
        const testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth && line !== '') {
            ctx.fillText(line.trim(), x, currentY);
            line = word + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    });

    ctx.fillText(line.trim(), x, currentY);
    return currentY;
}

function drawWrappedCenteredTitle(ctx, text, y, fontSize, color, w) {
    const scale = getWrappedFontScale();

    ctx.fillStyle = color;
    setWrappedFont(ctx, fontSize, 'bold');
    ctx.textAlign = 'center';

    wrapWrappedText(
        ctx,
        text,
        w / 2,
        y,
        w - 120,
        fontSize * scale * 1.2
    );
}

function drawWrappedBigNumber(ctx, value, unit, y, color, w) {
    const scale = getWrappedFontScale();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';

    setWrappedFont(ctx, 150, 'bold');
    ctx.fillText(String(value), w / 2, y);

    setWrappedFont(ctx, 46, 'normal');
    ctx.fillText(
        unit,
        w / 2,
        y + Math.round(70 * scale)
    );
}

function drawWrappedFooter(ctx, w, h, year) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    setWrappedFont(ctx, 30, 'normal');
    ctx.textAlign = 'center';

    ctx.fillText(
        `Jahresrückblick ${year}`,
        w / 2,
        h - 60
    );
}

function getWrappedDistanceComparison(km) {
    const refKm = 860;
    const factor = (km / refKm).toFixed(1);
    return `Das ist wie ${factor}× Lienz → Düsseldorf!`;
}

function getWrappedElevationComparison(meters) {
    const grossglockner = 3798;
    const factor = (meters / grossglockner).toFixed(1);
    return `Das ist wie ${factor}× auf den Großglockner!`;
}

function renderWrappedSlide(index) {
    const canvas = document.getElementById('wrapped-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const slide = wrappedSlides[index];
    if (!slide) return;

    const colors = drawWrappedBackground(ctx, w, h, slide.photoImg || null);

    switch (slide.key) {
        case 'intro': renderWrappedIntroSlide(ctx, w, h, colors, slide.data); break;
        case 'distance': renderWrappedDistanceSlide(ctx, w, h, colors, slide.data); break;
        case 'ascent': renderWrappedAscentSlide(ctx, w, h, colors, slide.data); break;
        case 'time': renderWrappedTimeSlide(ctx, w, h, colors, slide.data); break;
        case 'activeMonth': renderWrappedActiveMonthSlide(ctx, w, h, colors, slide.data); break;
        case 'bestTour': renderWrappedBestTourSlide(ctx, w, h, colors, slide.data); break;
        case 'highestPeak': renderWrappedHighestPeakSlide(ctx, w, h, colors, slide.data); break;
        case 'topRegion': renderWrappedTopRegionSlide(ctx, w, h, colors, slide.data); break;
        case 'highlights': renderWrappedHighlightsSlide(ctx, w, h, colors, slide.data); break;
        case 'yearCompare': renderWrappedYearCompareSlide(ctx, w, h, colors, slide.data); break;
        case 'top3': renderWrappedTop3Slide(ctx, w, h, colors, slide.data); break;
        case 'topCompanion': renderWrappedTopCompanionSlide(ctx, w, h, colors, slide.data); break;
        case 'outro': renderWrappedOutroSlide(ctx, w, h, colors, slide.data); break;
    }

    drawWrappedFooter(ctx, w, h, wrappedCurrentYear);
}

function renderWrappedIntroSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, `Dein Jahr ${data.year}`, 400, 90, colors.text, w);
    drawWrappedBigNumber(ctx, data.tourCount, 'Touren', 900, colors.text, w);
    setWrappedFont(ctx, 42);
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.fillText('Stolzer Blick zurück... 🏔️', w / 2, 1050);
}

function renderWrappedDistanceSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Deine Strecke', 350, 70, colors.text, w);
    drawWrappedBigNumber(ctx, data.distance.toFixed(1), 'km', 800, colors.text, w);
    setWrappedFont(ctx, 38);
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    wrapWrappedText(ctx, getWrappedDistanceComparison(data.distance), w / 2, 1000, w - 160, 50);
}

function renderWrappedAscentSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Deine Höhenmeter', 350, 70, colors.text, w);
    drawWrappedBigNumber(ctx, Math.round(data.ascent).toLocaleString('de-DE'), 'Hm', 800, colors.text, w);
    setWrappedFont(ctx, 38);
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    wrapWrappedText(ctx, getWrappedElevationComparison(data.ascent), w / 2, 1000, w - 160, 50);
}

function renderWrappedTimeSlide(ctx, w, h, colors, data) {
    const hours = Math.floor(data.minutes / 60);
    const days = (hours / 24).toFixed(1);
    drawWrappedCenteredTitle(ctx, 'Zeit unterwegs', 350, 70, colors.text, w);
    drawWrappedBigNumber(ctx, hours.toLocaleString('de-DE'), 'Stunden', 800, colors.text, w);
    setWrappedFont(ctx, 38);
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    ctx.fillText(`Das sind ${days} Tage am Berg! ⏱️`, w / 2, 1000);
}

function renderWrappedActiveMonthSlide(ctx, w, h, colors, data) {
    const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    drawWrappedCenteredTitle(ctx, 'Dein aktivster Monat', 300, 70, colors.text, w);

    setWrappedFont(ctx, 100, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    ctx.fillText(monthNames[data.activeMonthIndex], w / 2, 500);

    const chartX = 100, chartY = 650, chartW = w - 200, chartH = 500, barGap = 12;
    const barW = (chartW - barGap * 11) / 12;
    const maxVal = Math.max(...data.monthlyTours, 1);

    data.monthlyTours.forEach((count, i) => {
        const barH = (count / maxVal) * chartH;
        const x = chartX + i * (barW + barGap);
        const y = chartY + chartH - barH;
        ctx.fillStyle = i === data.activeMonthIndex ? colors.accent : 'rgba(255,255,255,0.4)';
        ctx.fillRect(x, y, barW, barH);

        ctx.fillStyle = colors.text;
        setWrappedFont(ctx, 24);
        ctx.textAlign = 'center';
        ctx.fillText(monthNames[i], x + barW / 2, chartY + chartH + 40);
    });

    setWrappedFont(ctx, 42);
    ctx.fillStyle = colors.text;
    ctx.fillText(`${data.monthlyTours[data.activeMonthIndex]} Touren`, w / 2, chartY - 30);
}

function renderWrappedBestTourSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Deine leistungsbeste Tour', 300, 70, colors.text, w);
    setWrappedFont(ctx, 54, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    wrapWrappedText(ctx, data.entry.tourname || data.entry.region || 'Unbenannte Tour', w / 2, 500, w - 160, 65);

    setWrappedFont(ctx, 36);
    ctx.fillStyle = colors.text;
    ctx.fillText(data.entry.date || '', w / 2, 650);

    drawWrappedBigNumber(ctx, data.score.toFixed(0), 'Leistungsindex', 1000, colors.text, w);
}

function renderWrappedHighestPeakSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Dein höchster Gipfel', 350, 70, colors.text, w);
    setWrappedFont(ctx, 64, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    wrapWrappedText(ctx, data.peak.name, w / 2, 650, w - 160, 75);

    drawWrappedBigNumber(ctx, data.peak.height.toLocaleString('de-DE'), 'Meter', 1000, colors.text, w);
}

function renderWrappedTopRegionSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Deine Lieblingsregion', 400, 70, colors.text, w);
    setWrappedFont(ctx, 72, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    wrapWrappedText(ctx, data.region.label, w / 2, 700, w - 160, 85);

    setWrappedFont(ctx, 42);
    ctx.fillStyle = colors.text;
    ctx.fillText(`${data.region.count} Touren hier! 📍`, w / 2, 900);
}

function renderWrappedTopCompanionSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Dein Wanderbuddy des Jahres', 400, 64, colors.text, w);

    setWrappedFont(ctx, 72, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    wrapWrappedText(ctx, data.companion.name, w / 2, 700, w - 160, 85);

    setWrappedFont(ctx, 42);
    ctx.fillStyle = colors.text;
    ctx.fillText(
        `${data.companion.count} ${data.companion.count === 1 ? 'gemeinsame Tour' : 'gemeinsame Touren'} 🤝`,
        w / 2,
        900
    );
}

function formatWrappedCompareValue(kind, value) {
    const n = Number(value) || 0;

    switch (kind) {
        case 'tourCount':
            return Math.round(n).toLocaleString('de-DE');
        case 'distance':
            return n.toFixed(1).replace('.', ',') + ' km';
        case 'ascent':
            return Math.round(n).toLocaleString('de-DE') + ' hm';
        case 'minutes':
            return formatWrappedMinutes(n);
        case 'steps':
            return Math.round(n).toLocaleString('de-DE');
        case 'peaks':
            return Math.round(n).toLocaleString('de-DE');
        default:
            return String(value ?? '');
    }
}

function formatWrappedCompareDelta(kind, previous, current) {
    const prev = Number(previous) || 0;
    const curr = Number(current) || 0;
    const diff = curr - prev;
    const absolute = Math.abs(diff);

    let absoluteText = '';
    switch (kind) {
        case 'tourCount':
            absoluteText = Math.round(absolute).toLocaleString('de-DE');
            break;
        case 'distance':
            absoluteText = absolute.toFixed(1).replace('.', ',') + ' km';
            break;
        case 'ascent':
            absoluteText = Math.round(absolute).toLocaleString('de-DE') + ' hm';
            break;
        case 'minutes':
            absoluteText = formatWrappedMinutes(absolute);
            break;
        case 'steps':
            absoluteText = Math.round(absolute).toLocaleString('de-DE');
            break;
        case 'peaks':
            absoluteText = Math.round(absolute).toLocaleString('de-DE');
            break;
        default:
            absoluteText = String(Math.round(absolute));
    }

    let percent = null;
    if (prev !== 0) {
        percent = (diff / Math.abs(prev)) * 100;
    }

    return {
        diff,
        percent,
        absoluteText
    };
}

function renderWrappedYearCompareSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Dein Jahr im Vergleich', 170, 58, colors.text, w);

    setWrappedFont(ctx, 25, 'normal');
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.textAlign = 'center';
    ctx.fillText(String(data.previousYear) + '  →  ' + String(wrappedCurrentYear), w / 2, 245);

    const rows = [
        { label: 'Touren', kind: 'tourCount', prev: data.previous.tourCount, curr: data.current.tourCount },
        { label: 'Strecke', kind: 'distance', prev: data.previous.distance, curr: data.current.distance },
        { label: 'Aufstieg', kind: 'ascent', prev: data.previous.ascent, curr: data.current.ascent },
        { label: 'Gehzeit', kind: 'minutes', prev: data.previous.minutes, curr: data.current.minutes },
        { label: 'Schritte', kind: 'steps', prev: data.previous.steps, curr: data.current.steps },
        { label: 'Gipfel', kind: 'peaks', prev: data.previous.peaks, curr: data.current.peaks }
    ];

    const cardW = 450;
    const cardH = 325;
    const gapX = 40;
    const gapY = 38;
    const startX = (w - (cardW * 2 + gapX)) / 2;
    const startY = 315;

    rows.forEach((row, i) => {
        const col = i % 2;
        const line = Math.floor(i / 2);
        const x = startX + col * (cardW + gapX);
        const y = startY + line * (cardH + gapY);
        const delta = formatWrappedCompareDelta(row.kind, row.prev, row.curr);

        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 30);
        ctx.fill();

        setWrappedFont(ctx, 24, 'bold');
        ctx.fillStyle = colors.text;
        ctx.textAlign = 'left';
        ctx.fillText(row.label, x + 28, y + 52);

        setWrappedFont(ctx, 19, 'normal');
        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.fillText(String(data.previousYear), x + 28, y + 94);

        setWrappedFont(ctx, 35, 'bold');
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.fillText(formatWrappedCompareValue(row.kind, row.prev), x + 28, y + 137);

        setWrappedFont(ctx, 19, 'normal');
        ctx.fillStyle = 'rgba(255,255,255,0.58)';
        ctx.fillText(String(wrappedCurrentYear), x + 28, y + 185);

        setWrappedFont(ctx, 39, 'bold');
        ctx.fillStyle = colors.accent;
        ctx.fillText(formatWrappedCompareValue(row.kind, row.curr), x + 28, y + 233);

        if (delta) {
            const positive = delta.diff >= 0;
            const sign = delta.diff === 0 ? '±' : (positive ? '+' : '−');
            const percentText = delta.percent === null
                ? ''
                : ' · ' + Math.abs(delta.percent).toFixed(0) + ' %';

            const badge = sign + delta.absoluteText + percentText;
            const badgeW = 180;
            const badgeH = 46;
            const bx = x + cardW - badgeW - 24;
            const by = y + cardH - badgeH - 22;

            ctx.fillStyle = positive ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.07)';
            ctx.beginPath();
            ctx.roundRect(bx, by, badgeW, badgeH, 23);
            ctx.fill();

            setWrappedFont(ctx, 18, 'bold');
            ctx.fillStyle = positive ? colors.accent : 'rgba(255,255,255,0.78)';
            ctx.textAlign = 'center';
            ctx.fillText(badge, bx + badgeW / 2, by + 30);
        }
    });

    const tourDiff = (Number(data.current.tourCount) || 0) - (Number(data.previous.tourCount) || 0);
    const distanceDiff = (Number(data.current.distance) || 0) - (Number(data.previous.distance) || 0);

    setWrappedFont(ctx, 30, 'bold');
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';

    let summary = 'Eine andere Saison – mit neuen Schwerpunkten.';
    if (tourDiff > 0 && distanceDiff > 0) {
        summary = 'Mehr Touren. Mehr Strecke.';
    } else if (tourDiff < 0 && distanceDiff < 0) {
        summary = 'Weniger Touren. Ruhigeres Jahr.';
    } else if (tourDiff > 0) {
        summary = 'Mehr Touren – dein Jahr war voller Aktivitäten.';
    } else if (distanceDiff > 0) {
        summary = 'Mehr Strecke – du warst weiter unterwegs.';
    }

    ctx.fillText(summary, w / 2, 1575);
}

function formatWrappedMinutes(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return hours + ':' + String(mins).padStart(2, '0') + ' h';
}

function drawWrappedContainedImage(ctx, img, x, y, width, height, radius) {
    ctx.save();
    const r = radius || 24;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x, y, width, height);

    if (img) {
        const scale = Math.min(width / img.width, height / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
    }

    ctx.restore();
}

function renderWrappedHighlightsSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Deine Highlights', 230, 58, colors.text, w);

    const items = data.highlights || [];
    const cardW = 450;
    const cardH = 360;
    const gapX = 50;
    const gapY = 55;
    const startX = (w - (cardW * 2 + gapX)) / 2;
    const startY = 390;

    items.slice(0, 6).forEach((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 32);
        ctx.fill();

        setWrappedFont(ctx, 52, 'bold');
        ctx.fillStyle = colors.accent;
        ctx.textAlign = 'left';
        ctx.fillText(item.icon, x + 28, y + 70);

        setWrappedFont(ctx, 25, 'bold');
        ctx.fillStyle = colors.text;
        ctx.fillText(item.label, x + 28, y + 115);

        setWrappedFont(ctx, 56, 'bold');
        ctx.fillStyle = colors.accent;
        wrapWrappedText(ctx, item.value, x + 28, y + 205, cardW - 56, 68);

        setWrappedFont(ctx, 22, 'normal');
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        wrapWrappedText(ctx, item.entry?.tourname || item.entry?.region || 'Tour', x + 28, y + 295, cardW - 56, 30);
    });
}

function renderWrappedTop3Slide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, 'Top 3 der Saison', 190, 58, colors.text, w);

    const medals = ['🥇', '🥈', '🥉'];
    const cardX = 70;
    const cardW = w - 140;
    const cardH = 435;
    const gap = 38;
    const startY = 315;

    (data.top3 || []).slice(0, 3).forEach((item, i) => {
        const y = startY + i * (cardH + gap);

        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.beginPath();
        ctx.roundRect(cardX, y, cardW, cardH, 34);
        ctx.fill();

        const imageX = cardX + 24;
        const imageY = y + 24;
        const imageW = 300;
        const imageH = 300;
        drawWrappedContainedImage(ctx, item.photoImg || null, imageX, imageY, imageW, imageH, 26);

        setWrappedFont(ctx, 45, 'bold');
        ctx.fillStyle = colors.accent;
        ctx.textAlign = 'left';
        ctx.fillText(medals[i], cardX + 350, y + 68);

        setWrappedFont(ctx, 31, 'bold');
        ctx.fillStyle = colors.text;
        wrapWrappedText(ctx, item.entry?.tourname || item.entry?.region || 'Tour', cardX + 410, y + 62, cardW - 435, 38);

        setWrappedFont(ctx, 21, 'normal');
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        const meta = [item.entry?.date || '', item.entry?.region || ''].filter(Boolean).join(' · ');
        wrapWrappedText(ctx, meta, cardX + 350, y + 145, cardW - 385, 28);

        const m = item.metrics || {};
        setWrappedFont(ctx, 23, 'bold');
        ctx.fillStyle = colors.text;
        ctx.fillText(`${Number(m.distance || 0).toFixed(1).replace('.', ',')} km · ${Math.round(m.ascent || 0).toLocaleString('de-DE')} hm`, cardX + 350, y + 198);
        ctx.fillText(`${formatWrappedMinutes(m.minutes)} · ${m.peaks || 0} Gipfel`, cardX + 350, y + 238);

        if (m.steps > 0) {
            setWrappedFont(ctx, 21, 'normal');
            ctx.fillStyle = 'rgba(255,255,255,0.78)';
            ctx.fillText(`${Math.round(m.steps).toLocaleString('de-DE')} Schritte`, cardX + 350, y + 275);
        }

        if (m.score !== null && m.score !== undefined) {
            setWrappedFont(ctx, 26, 'bold');
            ctx.fillStyle = colors.accent;
            ctx.fillText(`Leistungsindex ${Math.round(m.score)} / 100`, cardX + 350, y + 315);
        }

        const topReasons = (item.info?.highlights || []).slice(0, 4);
        if (topReasons.length) {
            setWrappedFont(ctx, 17, 'normal');
            ctx.fillStyle = colors.text;
            wrapWrappedText(ctx, 'Top 3: ' + topReasons.map(x => x.name).join(' · '), cardX + 350, y + 370, cardW - 385, 25);
        }
    });
}

function renderWrappedOutroSlide(ctx, w, h, colors, data) {
    drawWrappedCenteredTitle(ctx, `${data.tourCount} Touren.`, 700, 90, colors.text, w);
    setWrappedFont(ctx, 90, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.textAlign = 'center';
    ctx.fillText('Unzählige neue', w / 2, 800);
    ctx.fillText('Erinnerungen', w / 2, 900);
    ctx.fillText('geschaffen', w / 2, 1000);

    setWrappedFont(ctx, 48);
    ctx.fillStyle = colors.text;
    ctx.fillText('...volle Kraft nach vorn! 🏔️⛰️', w / 2, 1100);
}

function toggleWrappedFullscreen() {
    const el = document.getElementById('wrapped-view');
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (!isFullscreen) {
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function exitWrappedFullscreenIfActive() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

function updateWrappedFullscreenState() {
    const el = document.getElementById('wrapped-view');
    const btn = document.getElementById('wrapped-fullscreen-btn');
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

    el.classList.toggle('wrapped-is-fullscreen', isFullscreen);
    if (btn) btn.textContent = isFullscreen ? '✕' : '⛶';
}

document.addEventListener('fullscreenchange', updateWrappedFullscreenState);
document.addEventListener('webkitfullscreenchange', updateWrappedFullscreenState);
