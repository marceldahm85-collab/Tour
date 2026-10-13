// =========================================================
// Stats – Entwicklung / Gipfel / Jahreszeiten
// =========================================================

let statsPeakPage = 1;
let statsPeakRowsCache = [];

const STATS_PEAK_PAGE_SIZE = 15;
const DEVELOPMENT_FORM_WINDOW = 10;

let developmentHistoryMetric = 'performance';
let developmentHistoryRange = '12';
let developmentTrendMetric = 'performance';
let developmentPointPopupTimer = null;
let tourProfileDetailMode = 'distribution';
let activityDetailMode = 'tourDays';

const DEVELOPMENT_HISTORY_METRICS = [
    { key: 'performance', label: 'Ø Leistungsindex', axis: '' },
    { key: 'distance', label: 'Ø Strecke / Tour (km)', axis: '' },
    { key: 'time', label: 'Ø Gehzeit / Tour (Std.)', axis: '' },
    { key: 'ascent', label: 'Ø Aufstieg / Tour (hm)', axis: '' },
    { key: 'speed', label: 'Ø Geschwindigkeit (km/h)', axis: '' },
    { key: 'ascentRate', label: 'Ø Anstieg / h (hm/h)', axis: '' },
    { key: 'tourCount', label: 'Anzahl Touren', axis: '' },
    { key: 'totalAscent', label: 'Gesamtaufstieg (hm)', axis: '' }
];

function parseStatsCalendarDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    let date;

    if (iso) {
        date = new Date(
            Number(iso[1]),
            Number(iso[2]) - 1,
            Number(iso[3])
        );
    } else {
        date = new Date(raw);
    }

    return Number.isFinite(date.getTime())
        ? date
        : null;
}

function formatStatsHistoryDate(value) {
    const date = parseStatsCalendarDate(value);

    if (!date) {
        return String(value || '–');
    }

    return date.toLocaleDateString('de-AT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function getCalendarDayNumber(date) {
    return Math.floor(
        Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        ) / 86400000
    );
}

function getStatsDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
    ].join('-');
}

function getEntryMinutesForDevelopment(entry) {
    const raw = String(entry?.zeit || '').trim();
    const match = raw.match(/^(\d+):(\d{1,2})$/);

    if (!match) return 0;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes)
    ) {
        return 0;
    }

    return Math.max(0, hours * 60 + minutes);
}

function getDevelopmentMetrics(entry) {
    const adjustedDistance = Number(getAdjustedDistance(entry)) || 0;
    const ascent = Number(getAdjustedAscent(entry)) || 0;
    const adjustedHours = Number(getAdjustedTimeHours(entry)) || 0;

    const tourDistance = entry?.strecke
        ? parseFloat(String(entry.strecke).replace(',', '.'))
        : 0;

    const tourMinutes = getEntryMinutesForDevelopment(entry);

    const performance = calculatePerformanceIndex(entry);
    const performanceScore =
        performance && Number.isFinite(performance.score)
            ? Number(performance.score)
            : null;

    return {
        performance: performanceScore,
        speed:
            adjustedDistance > 0 && adjustedHours > 0
                ? adjustedDistance / adjustedHours
                : null,
        ascentRate:
            ascent > 0 && adjustedHours > 0
                ? ascent / adjustedHours
                : null,
        ascent:
            ascent > 0
                ? ascent
                : null,
        distance:
            Number.isFinite(tourDistance) && tourDistance > 0
                ? tourDistance
                : null,
        time:
            tourMinutes > 0
                ? tourMinutes
                : null
    };
}

function averageDevelopmentMetric(entries, key) {
    const values = entries
        .map(entry => getDevelopmentMetrics(entry)[key])
        .filter(value => Number.isFinite(value));

    if (!values.length) return null;

    return getBoundedAverage(values);
}

function formatDevelopmentMetric(value, key) {
    if (!Number.isFinite(value)) return '–';

    switch (key) {
        case 'performance':
            return `${Math.round(value)} / 100`;
        case 'speed':
            return `${formatDecimalAT(value)} km/h`;
        case 'ascentRate':
            return `${Math.round(value).toLocaleString('de-AT')} hm/h`;
        case 'ascent':
            return `${Math.round(value).toLocaleString('de-AT')} hm`;
        case 'distance':
            return `${formatDecimalAT(value)} km`;
        case 'time': {
            const totalMinutes = Math.round(value);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours}:${String(minutes).padStart(2, '0')} Std.`;
        }
        default:
            return String(value);
    }
}

function formatDevelopmentDelta(value, key) {
    if (!Number.isFinite(value)) return '–';

    const sign = value > 0 ? '+' : value < 0 ? '−' : '±';
    const absolute = Math.abs(value);

    switch (key) {
        case 'performance':
            return `${sign}${Math.round(absolute)} ${Math.round(absolute) === 1 ? 'Punkt' : 'Punkte'}`;
        case 'speed':
            return `${sign}${formatDecimalAT(absolute)} km/h`;
        case 'ascentRate':
            return `${sign}${Math.round(absolute).toLocaleString('de-AT')} hm/h`;
        case 'ascent':
            return `${sign}${Math.round(absolute).toLocaleString('de-AT')} hm`;
        case 'distance':
            return `${sign}${formatDecimalAT(absolute)} km`;
        case 'time': {
            const totalMinutes = Math.round(absolute);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${sign}${hours}:${String(minutes).padStart(2, '0')} Std.`;
        }
        default:
            return `${sign}${absolute}`;
    }
}

function renderDevelopmentMetricCard(label, key, recent, previous) {
    const currentValue = averageDevelopmentMetric(recent, key);
    const previousValue = averageDevelopmentMetric(previous, key);

    let deltaHtml = '<span class="development-trend neutral">–</span>';

    if (
        Number.isFinite(currentValue) &&
        Number.isFinite(previousValue)
    ) {
        const absoluteDelta = currentValue - previousValue;

        let percent = null;
        if (Math.abs(previousValue) > 0.000001) {
            percent = (absoluteDelta / Math.abs(previousValue)) * 100;
        }

        const cls =
            Math.abs(absoluteDelta) < 0.000001
                ? 'neutral'
                : absoluteDelta > 0
                    ? 'positive'
                    : 'negative';

        const arrow =
            cls === 'positive'
                ? '↑'
                : cls === 'negative'
                    ? '↓'
                    : '→';

        const percentText = Number.isFinite(percent)
            ? `${Math.abs(percent).toFixed(1).replace('.', ',')} % · `
            : '';

        deltaHtml = `
            <span class="development-trend ${cls}">
                ${arrow} ${percentText}${formatDevelopmentDelta(absoluteDelta, key)}
            </span>
        `;
    }

    const active = developmentTrendMetric === key;

    return `
        <button
            type="button"
            class="development-metric-card ${active ? 'active' : ''}"
            data-development-trend-metric="${key}"
            aria-pressed="${active ? 'true' : 'false'}">
            <span class="development-metric-label">${escapeHtml(label)}</span>
            <span class="development-metric-value">
                ${formatDevelopmentMetric(currentValue, key)}
            </span>
            <div class="development-metric-compare">
                ${deltaHtml}
            </div>
        </button>
    `;
}

function buildDevelopmentSparkline(entries, key = developmentTrendMetric) {
    const definition = getDevelopmentHistoryMetricDefinition(key);

    const chronological = [...entries]
        .map(entry => ({
            entry,
            date: parseStatsCalendarDate(entry?.date),
            value: getDevelopmentMetrics(entry)[key]
        }))
        .filter(item => item.date && Number.isFinite(item.value))
        .sort((a, b) => a.date - b.date);

    if (!chronological.length) {
        return `
            <div class="stats-empty-state">
                Für den Formtrend „${escapeHtml(definition.label)}“ sind im gewählten Zeitraum keine auswertbaren Touren vorhanden.
            </div>
        `;
    }

    /*
     * Jeder sichtbare Punkt steht für genau eine Tour.
     * Ab der zehnten Tour liegt zusätzlich der gleitende
     * 10-Touren-Durchschnitt als ruhige Trendlinie darüber.
     */
    const series = chronological.map((item, index) => {
        let trend = null;

        if (index >= DEVELOPMENT_FORM_WINDOW - 1) {
            const windowItems = chronological.slice(
                index - DEVELOPMENT_FORM_WINDOW + 1,
                index + 1
            );
            trend = windowItems.reduce((sum, current) => sum + current.value, 0) /
                windowItems.length;
        }

        return {
            ...item,
            trend
        };
    });

    const points = series.slice(-20);

    const width = 340;
    const height = 100;
    const paddingLeft = 42;
    const paddingRight = 8;
    const paddingY = 10;

    const scaleValues = points.flatMap(point =>
        Number.isFinite(point.trend)
            ? [point.value, point.trend]
            : [point.value]
    );

    let min = Math.min(...scaleValues);
    let max = Math.max(...scaleValues);

    if (Math.abs(max - min) < 0.000001) {
        const pad = Math.max(1, Math.abs(max) * 0.08);
        min = Math.max(0, min - pad);
        max += pad;
    } else {
        const spread = Math.max(0.000001, max - min);
        min = Math.max(0, min - spread * 0.08);
        max += spread * 0.08;
    }

    if (key === 'performance') {
        max = Math.min(100, max);
    }

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingY * 2;

    const yForValue = value =>
        height - paddingY -
        ((value - min) / Math.max(0.000001, max - min)) * plotHeight;

    const xForIndex = index =>
        points.length === 1
            ? paddingLeft + plotWidth / 2
            : paddingLeft + (index / (points.length - 1)) * plotWidth;

    const coords = points.map((point, index) => ({
        ...point,
        x: xForIndex(index),
        y: yForValue(point.value),
        trendY: Number.isFinite(point.trend)
            ? yForValue(point.trend)
            : null
    }));

    const polyline = coords
        .map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
        .join(' ');

    const trendCoords = coords
        .filter(point => Number.isFinite(point.trendY))
        .map(point => ({ x: point.x, y: point.trendY }));

    const buildSmoothPath = pathPoints => {
        if (pathPoints.length < 2) return '';

        let path = `M ${pathPoints[0].x.toFixed(2)} ${pathPoints[0].y.toFixed(2)}`;

        for (let i = 0; i < pathPoints.length - 1; i++) {
            const p0 = pathPoints[i - 1] || pathPoints[i];
            const p1 = pathPoints[i];
            const p2 = pathPoints[i + 1];
            const p3 = pathPoints[i + 2] || p2;

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
        }

        return path;
    };

    const trendPath = buildSmoothPath(trendCoords);
    const tickValues = [max, (max + min) / 2, min];

    const yAxis = tickValues
        .map(value => {
            const y = yForValue(value);
            return `
                <line
                    class="spark-grid"
                    x1="${paddingLeft}"
                    y1="${y.toFixed(1)}"
                    x2="${(width - paddingRight).toFixed(1)}"
                    y2="${y.toFixed(1)}">
                </line>
                <text
                    class="spark-y-label"
                    x="${paddingLeft - 5}"
                    y="${(y + 2.5).toFixed(1)}"
                    text-anchor="end">
                    ${formatDevelopmentHistoryValue(value, key, true)}
                </text>
            `;
        })
        .join('');

    const caption = points.length === 1
        ? `<span>${formatStatsHistoryDate(points[0].entry.date)}</span>`
        : (() => {
            const middlePoint = points[Math.floor((points.length - 1) / 2)];
            return `
                <span>${formatStatsHistoryDate(points[0].entry.date)}</span>
                <span>${formatStatsHistoryDate(middlePoint.entry.date)}</span>
                <span>${formatStatsHistoryDate(points[points.length - 1].entry.date)}</span>
            `;
        })();

    return `
        <div class="development-sparkline-wrap">
            <svg
                class="development-sparkline"
                viewBox="0 0 ${width} ${height}"
                role="img"
                aria-label="${escapeHtml(definition.label)}: einzelne Touren mit geglättetem ${DEVELOPMENT_FORM_WINDOW}-Touren-Trend">
                <text
                    class="spark-y-title"
                    x="4"
                    y="8">
                    ${escapeHtml(definition.axis)}
                </text>
                ${yAxis}
                ${coords.length > 1 ? `<polyline class="spark-line" points="${polyline}"></polyline>` : ''}
                ${trendPath ? `<path class="spark-trend-line" d="${trendPath}"></path>` : ''}
                ${coords.map(point => `
                    <g
                        class="spark-point"
                        data-development-point="1"
                        data-tour-name="${escapeHtmlAttribute(point.entry?.tourname || 'Tour')}"
                        data-tour-date="${escapeHtmlAttribute(formatStatsHistoryDate(point.entry?.date))}"
                        data-tour-value="${escapeHtmlAttribute(formatDevelopmentMetric(point.value, key))}"
                        data-tour-trend="${escapeHtmlAttribute(Number.isFinite(point.trend) ? formatDevelopmentMetric(point.trend, key) : 'noch nicht verfügbar')}"
                        tabindex="0"
                        role="button"
                        aria-label="${escapeHtmlAttribute(`${point.entry?.tourname || 'Tour'} am ${formatStatsHistoryDate(point.entry?.date)}: ${formatDevelopmentMetric(point.value, key)}`)}">
                        <circle
                            class="spark-dot-hit"
                            cx="${point.x.toFixed(2)}"
                            cy="${point.y.toFixed(2)}"
                            r="7">
                        </circle>
                        <circle
                            class="spark-dot spark-dot-core"
                            cx="${point.x.toFixed(2)}"
                            cy="${point.y.toFixed(2)}"
                            r="2.4">
                        </circle>
                    </g>
                `).join('')}
            </svg>
            <div class="development-point-popup" hidden></div>
            <div class="development-sparkline-legend" aria-hidden="true">
                <span><i class="raw"></i>Einzeltour</span>
                <span><i class="trend"></i>${DEVELOPMENT_FORM_WINDOW}-Touren-Trend</span>
            </div>
            <div class="sparkline-caption ${points.length === 1 ? 'single' : ''}">
                ${caption}
            </div>
        </div>
    `;
}

function initDevelopmentTrendControls(container) {
    container?.querySelectorAll('[data-development-trend-metric]')
        .forEach(button => {
            button.addEventListener('click', () => {
                developmentTrendMetric = button.dataset.developmentTrendMetric || 'performance';
                clearTimeout(developmentPointPopupTimer);
                updateDevelopmentStatsPage();
            });
        });
}

function initDevelopmentSparklineInteractions(container) {
    const wrap = container?.querySelector('.development-sparkline-wrap');
    const popup = wrap?.querySelector('.development-point-popup');
    if (!wrap || !popup) return;

    const hidePopup = () => {
        popup.classList.remove('visible');
        clearTimeout(developmentPointPopupTimer);
        developmentPointPopupTimer = setTimeout(() => {
            if (!popup.classList.contains('visible')) {
                popup.hidden = true;
            }
        }, 160);
    };

    const showPoint = point => {
        const name = point.dataset.tourName || 'Tour';
        const date = point.dataset.tourDate || '–';
        const value = point.dataset.tourValue || '–';
        const trend = point.dataset.tourTrend || 'noch nicht verfügbar';
        const definition = getDevelopmentHistoryMetricDefinition(developmentTrendMetric);

        popup.innerHTML = `
            <div class="development-point-popup-head">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(date)}</span>
            </div>
            <div class="development-point-popup-row">
                <span>${escapeHtml(definition.label)}</span>
                <b>${escapeHtml(value)}</b>
            </div>
            <div class="development-point-popup-row">
                <span>${DEVELOPMENT_FORM_WINDOW}-Touren-Trend</span>
                <b>${escapeHtml(trend)}</b>
            </div>
        `;

        clearTimeout(developmentPointPopupTimer);
        popup.hidden = false;
        popup.classList.remove('visible');

        requestAnimationFrame(() => {
            const wrapRect = wrap.getBoundingClientRect();
            const pointRect = point.getBoundingClientRect();
            const centerX = pointRect.left - wrapRect.left + pointRect.width / 2;
            const halfWidth = Math.min(110, Math.max(80, popup.offsetWidth / 2));
            const clampedX = Math.max(halfWidth + 8, Math.min(wrapRect.width - halfWidth - 8, centerX));

            popup.style.left = `${clampedX}px`;
            popup.style.top = '7px';
            popup.classList.add('visible');
        });

        developmentPointPopupTimer = setTimeout(hidePopup, 2000);
    };

    wrap.querySelectorAll('[data-development-point]')
        .forEach(point => {
            point.addEventListener('click', event => {
                event.preventDefault();
                showPoint(point);
            });

            point.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    showPoint(point);
                }
            });
        });
}

function getDevelopmentPerformanceSeries(entries) {
    return [...entries]
        .map(entry => ({
            entry,
            date: parseStatsCalendarDate(entry?.date),
            score: getDevelopmentMetrics(entry).performance
        }))
        .filter(item => item.date && Number.isFinite(item.score))
        .sort((a, b) => a.date - b.date);
}

function calculatePersonalBestForm(entries, windowSize = DEVELOPMENT_FORM_WINDOW) {
    const series = getDevelopmentPerformanceSeries(entries);

    if (series.length < windowSize) {
        return {
            ready: false,
            count: series.length,
            windowSize
        };
    }

    let runningSum = 0;
    let best = null;

    for (let i = 0; i < series.length; i++) {
        runningSum += series[i].score;

        if (i >= windowSize) {
            runningSum -= series[i - windowSize].score;
        }

        if (i < windowSize - 1) continue;

        const value = runningSum / windowSize;
        const startIndex = i - windowSize + 1;
        const candidate = {
            value,
            startDate: series[startIndex].date,
            endDate: series[i].date
        };

        if (!best || candidate.value > best.value) {
            best = candidate;
        }
    }

    const currentWindow = series.slice(-windowSize);
    const current = {
        value:
            currentWindow.reduce((sum, item) => sum + item.score, 0) /
            currentWindow.length,
        startDate: currentWindow[0].date,
        endDate: currentWindow[currentWindow.length - 1].date
    };

    const gapPoints = current.value - best.value;
    const gapPercent = best.value > 0
        ? (gapPoints / best.value) * 100
        : null;

    return {
        ready: true,
        count: series.length,
        windowSize,
        current,
        best,
        gapPoints,
        gapPercent,
        percentOfBest:
            best.value > 0
                ? (current.value / best.value) * 100
                : null
    };
}

function formatDevelopmentShortDate(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
        return '–';
    }

    return date.toLocaleDateString('de-AT', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    });
}

function formatDevelopmentDateRange(startDate, endDate) {
    if (!startDate || !endDate) return '–';

    return `${formatDevelopmentShortDate(startDate)} – ${formatDevelopmentShortDate(endDate)}`;
}

function renderPersonalBestForm(entries) {
    const form = calculatePersonalBestForm(entries);

    if (!form.ready) {
        return `
            <div class="stats-empty-state">
                Für die Bestform werden mindestens ${form.windowSize} Touren mit Leistungsindex benötigt (${form.count}/${form.windowSize}).
            </div>
        `;
    }

    const gapPoints = Math.abs(form.gapPoints);
    const gapSign = form.gapPoints < -0.05 ? '−' : form.gapPoints > 0.05 ? '+' : '±';
    const gapClass = Math.abs(form.gapPoints) < 0.05 ? 'neutral' : 'negative';

    return `
        <div class="best-form-grid">
            <div class="best-form-card">
                <span class="best-form-label">Aktuelle Form</span>
                <span class="best-form-value">${Math.round(form.current.value)} / 100</span>
                <span class="best-form-meta">letzte ${form.windowSize} Touren</span>
            </div>

            <div class="best-form-card">
                <span class="best-form-label">Persönliche Bestform</span>
                <span class="best-form-value">${Math.round(form.best.value)} / 100</span>
                <span class="best-form-meta">bester ${form.windowSize}-Touren-Schnitt</span>
            </div>

            <div class="best-form-card">
                <span class="best-form-label">Abstand zur Bestform</span>
                <span class="best-form-value development-trend ${gapClass}">
                    ${gapSign}${gapPoints.toFixed(1).replace('.', ',')} Punkte
                </span>
                <span class="best-form-meta">
                    ${Number.isFinite(form.percentOfBest) ? `${form.percentOfBest.toFixed(1).replace('.', ',')} % der Bestform` : '–'}
                </span>
            </div>

            <div class="best-form-card">
                <span class="best-form-label">Bestform-Zeitraum</span>
                <span class="best-form-value">${formatDevelopmentDateRange(form.best.startDate, form.best.endDate)}</span>
                <span class="best-form-meta">${form.windowSize} auswertbare Touren</span>
            </div>
        </div>
    `;
}

const TOUR_PROFILE_DEFINITIONS = [
    { key: 'endurance', label: 'Ausdauertour', icon: '🥾' },
    { key: 'elevation', label: 'Höhenmetertour', icon: '⛰️' },
    { key: 'steep', label: 'Steiltour', icon: '📐' },
    { key: 'compact', label: 'Kompakte Intensivtour', icon: '⚡' },
    { key: 'balanced', label: 'Ausgewogene Tour', icon: '⚖️' }
];

function getTourProfileDefinition(key) {
    return TOUR_PROFILE_DEFINITIONS.find(item => item.key === key) ||
        TOUR_PROFILE_DEFINITIONS[TOUR_PROFILE_DEFINITIONS.length - 1];
}

function parseTourProfileNumber(value) {
    const number = parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : null;
}

function getTourProfileBaseMetrics(entry) {
    const distance = parseTourProfileNumber(entry?.strecke);
    const ascent = parseTourProfileNumber(entry?.aufstieg);
    const minutes = getEntryMinutesForDevelopment(entry);
    const adjustedDistance = Number(getAdjustedDistance(entry)) || 0;
    const development = getDevelopmentMetrics(entry);

    if (
        !Number.isFinite(distance) ||
        distance <= 0 ||
        !Number.isFinite(ascent) ||
        ascent < 0 ||
        !Number.isFinite(minutes) ||
        minutes <= 0 ||
        adjustedDistance <= 0
    ) {
        return null;
    }

    return {
        distance,
        ascent,
        minutes,
        steepness: ascent / adjustedDistance,
        speed: development.speed,
        ascentRate: development.ascentRate,
        performance: development.performance,
        comparisonGroup: getPerformanceGroup(entry)
    };
}

function getTourProfilePercentile(values, value) {
    if (!Number.isFinite(value)) return null;

    const valid = values
        .filter(Number.isFinite)
        .sort((a, b) => a - b);

    if (!valid.length) return null;
    if (valid.length === 1) return 50;

    let lower = 0;
    let equal = 0;

    valid.forEach(candidate => {
        if (candidate < value) lower += 1;
        else if (Math.abs(candidate - value) < 0.000001) equal += 1;
    });

    return ((lower + equal * 0.5) / valid.length) * 100;
}

function classifyTourProfile(percentiles, groupSize) {
    if (!percentiles || groupSize < 4) {
        return 'balanced';
    }

    const distance = percentiles.distance ?? 50;
    const ascent = percentiles.ascent ?? 50;
    const time = percentiles.minutes ?? 50;
    const steepness = percentiles.steepness ?? 50;
    const performance = percentiles.performance ?? 50;
    const ascentRate = percentiles.ascentRate ?? 50;

    const compact =
        distance <= 35 &&
        time <= 45 &&
        (ascent >= 70 || steepness >= 75) &&
        (
            performance >= 70 ||
            ascentRate >= 70 ||
            ascent >= 85 ||
            steepness >= 85
        );

    if (compact) {
        return 'compact';
    }

    const endurance =
        (distance >= 85 || time >= 85) &&
        steepness < 75;

    if (endurance) {
        return 'endurance';
    }

    const steep =
        steepness >= 80 &&
        (ascent >= 55 || steepness >= 90);

    if (steep) {
        return 'steep';
    }

    if (ascent >= 80) {
        return 'elevation';
    }

    if (
        distance >= 75 &&
        time >= 70 &&
        steepness < 70
    ) {
        return 'endurance';
    }

    return 'balanced';
}

function buildTourProfileAnalysis(entries) {
    const base = [...entries]
        .map(entry => ({
            entry,
            metrics: getTourProfileBaseMetrics(entry)
        }))
        .filter(item => item.metrics);

    const grouped = new Map();

    base.forEach(item => {
        const group = item.metrics.comparisonGroup || 'hiking';
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push(item);
    });

    const analyzed = [];

    grouped.forEach(groupItems => {
        const metricKeys = [
            'distance',
            'ascent',
            'minutes',
            'steepness',
            'speed',
            'ascentRate',
            'performance'
        ];

        const distributions = Object.fromEntries(
            metricKeys.map(key => [
                key,
                groupItems
                    .map(item => item.metrics[key])
                    .filter(Number.isFinite)
            ])
        );

        groupItems.forEach(item => {
            const percentiles = Object.fromEntries(
                metricKeys.map(key => [
                    key,
                    getTourProfilePercentile(
                        distributions[key],
                        item.metrics[key]
                    )
                ])
            );

            const profileKey = classifyTourProfile(
                percentiles,
                groupItems.length
            );

            analyzed.push({
                ...item,
                percentiles,
                profileKey,
                traits: {
                    fast:
                        Number.isFinite(percentiles.speed) &&
                        percentiles.speed >= 75,
                    highAscentRate:
                        Number.isFinite(percentiles.ascentRate) &&
                        percentiles.ascentRate >= 75,
                    highPerformance:
                        Number.isFinite(percentiles.performance) &&
                        percentiles.performance >= 75
                }
            });
        });
    });

    const profileRows = TOUR_PROFILE_DEFINITIONS.map((definition, order) => {
        const items = analyzed.filter(item => item.profileKey === definition.key);
        const performanceValues = items
            .map(item => item.metrics.performance)
            .filter(Number.isFinite);

        return {
            ...definition,
            order,
            items,
            count: items.length,
            share: analyzed.length
                ? (items.length / analyzed.length) * 100
                : 0,
            avgPerformance: getBoundedAverage(performanceValues),
            performanceCount: performanceValues.length
        };
    });

    const rankedProfiles = [...profileRows]
        .sort((a, b) => b.count - a.count || a.order - b.order);

    const mostCommon = rankedProfiles.find(row => row.count > 0) || null;

    const allPerformance = analyzed
        .map(item => item.metrics.performance)
        .filter(Number.isFinite);

    const overallPerformance = getBoundedAverage(allPerformance);

    const performanceProfiles = profileRows
        .filter(row => row.performanceCount > 0)
        .sort((a, b) => b.avgPerformance - a.avgPerformance || b.count - a.count);

    const strongest = performanceProfiles[0] || null;

    const strongestDeltaPercent =
        strongest &&
        Number.isFinite(strongest.avgPerformance) &&
        Number.isFinite(overallPerformance) &&
        Math.abs(overallPerformance) > 0.000001
            ? ((strongest.avgPerformance - overallPerformance) /
                Math.abs(overallPerformance)) * 100
            : null;

    const featureDefinitions = [
        { key: 'fast', label: 'Schnell', icon: '⚡', metric: 'speed' },
        { key: 'highAscentRate', label: 'Hoher Anstieg/h', icon: '↗️', metric: 'ascentRate' },
        { key: 'highPerformance', label: 'Hoher Leistungsindex', icon: '🔥', metric: 'performance' }
    ];

    const quantile = (values, q) => {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return null;
        if (sorted.length === 1) return sorted[0];

        const position = (sorted.length - 1) * q;
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        if (lower === upper) return sorted[lower];

        const weight = position - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    const groupLabel = key => key === 'cycling' ? 'Rad' : 'Berg/Wandern';

    const features = featureDefinitions.map(feature => {
        const eligible = analyzed.filter(item =>
            Number.isFinite(item.metrics[feature.metric])
        );
        const count = eligible.filter(item => item.traits[feature.key]).length;

        const benchmarks = Array.from(grouped.entries())
            .map(([groupKey, groupItems]) => {
                const values = groupItems
                    .map(item => item.metrics[feature.metric])
                    .filter(Number.isFinite);

                return {
                    groupKey,
                    label: groupLabel(groupKey),
                    eligible: values.length,
                    threshold: quantile(values, 0.75),
                    best: values.length ? Math.max(...values) : null
                };
            })
            .filter(benchmark => benchmark.eligible > 0);

        return {
            ...feature,
            count,
            eligible: eligible.length,
            share: eligible.length
                ? (count / eligible.length) * 100
                : 0,
            benchmarks
        };
    });

    return {
        analyzed,
        profileRows,
        rankedProfiles,
        mostCommon,
        strongest,
        strongestDeltaPercent,
        overallPerformance,
        features,
        totalEntries: entries.length
    };
}

function getTourProfileDetailReason(item) {
    if (!item) return '';

    const p = item.percentiles || {};
    const percentile = value =>
        Number.isFinite(value)
            ? Math.max(0, Math.min(99, Math.round(value)))
            : null;

    const higherThan = (label, value) => {
        const rank = percentile(value);
        return rank === null
            ? ''
            : `${label} höher als bei ${rank} % deiner vergleichbaren Touren`;
    };

    const longerThan = (label, value) => {
        const rank = percentile(value);
        return rank === null
            ? ''
            : `${label} länger als bei ${rank} % deiner vergleichbaren Touren`;
    };

    const shorterThan = (label, value) => {
        const rank = percentile(value);
        return rank === null
            ? ''
            : `${label} kürzer als bei ${Math.max(0, 100 - rank)} % deiner vergleichbaren Touren`;
    };

    switch (item.profileKey) {
        case 'endurance':
            return (p.distance ?? 0) >= (p.minutes ?? 0)
                ? longerThan('Strecke', p.distance)
                : longerThan('Gehzeit', p.minutes);

        case 'elevation':
            return higherThan('Aufstieg', p.ascent);

        case 'steep':
            return higherThan('Steigung', p.steepness);

        case 'compact': {
            const compactPart = (p.distance ?? 50) <= (p.minutes ?? 50)
                ? shorterThan('Strecke', p.distance)
                : shorterThan('Gehzeit', p.minutes);

            const intensityPart = (p.steepness ?? 0) >= (p.ascent ?? 0)
                ? higherThan('Steigung', p.steepness)
                : higherThan('Aufstieg', p.ascent);

            return [compactPart, intensityPart]
                .filter(Boolean)
                .join(' · ');
        }

        default:
            return 'Strecke, Aufstieg und Steigung liegen überwiegend in deinem persönlichen Mittelfeld.';
    }
}

function renderTourProfileDetail(entry) {
    if (!entry) return '';

    const savedTours = appStorage.get('touren') || [];
    const analysis = buildTourProfileAnalysis(savedTours);
    const entryId = String(entry.id || '').trim();

    let item = entryId
        ? analysis.analyzed.find(candidate =>
            String(candidate.entry?.id || '').trim() === entryId
        )
        : null;

    if (!item) {
        const signature = value => String(value ?? '').trim();
        item = analysis.analyzed.find(candidate =>
            signature(candidate.entry?.tourname) === signature(entry.tourname) &&
            signature(candidate.entry?.date) === signature(entry.date) &&
            signature(candidate.entry?.strecke) === signature(entry.strecke) &&
            signature(candidate.entry?.aufstieg) === signature(entry.aufstieg) &&
            signature(candidate.entry?.zeit) === signature(entry.zeit)
        ) || null;
    }

    if (!item) return '';

    const definition = getTourProfileDefinition(item.profileKey);
    const groupItems = analysis.analyzed.filter(candidate =>
        candidate.metrics?.comparisonGroup === item.metrics?.comparisonGroup
    );

    const comparisonLabel =
        item.metrics?.comparisonGroup === 'cycling'
            ? 'Radtouren'
            : 'Berg-/Wandertouren';

    const traits = [
        item.traits?.fast
            ? { icon: '⚡', label: 'Schnell' }
            : null,
        item.traits?.highAscentRate
            ? { icon: '↗️', label: 'Hoher Anstieg/h' }
            : null,
        item.traits?.highPerformance
            ? { icon: '🔥', label: 'Hoher Leistungsindex' }
            : null
    ].filter(Boolean);

    const reason = groupItems.length < 4
        ? 'Noch zu wenig vergleichbare Touren für eine belastbare Extrem-Einordnung.'
        : getTourProfileDetailReason(item);

    const visibleTraits = groupItems.length < 4 ? [] : traits;

    return `
        <div class="tour-profile-detail-card">
            <span class="tour-profile-detail-kicker">Tourprofil</span>
            <span class="tour-profile-detail-name">
                ${definition.icon} ${escapeHtml(definition.label)}
            </span>
            ${reason ? `
                <div class="tour-profile-detail-reason">
                    ${escapeHtml(reason)}
                </div>
            ` : ''}
            <div class="tour-profile-detail-meta">
                Vergleichsbasis: ${groupItems.length} ${comparisonLabel}
            </div>
            ${visibleTraits.length ? `
                <div class="tour-profile-detail-traits">
                    ${visibleTraits.map(trait => `
                        <span class="tour-profile-detail-trait">
                            ${trait.icon} ${escapeHtml(trait.label)}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function formatTourProfileBenchmarkValue(value, metric) {
    if (!Number.isFinite(value)) return '–';

    if (metric === 'speed') return `${formatDecimalAT(value, 2)} km/h`;
    if (metric === 'ascentRate') return `${Math.round(value).toLocaleString('de-AT')} hm/h`;
    if (metric === 'performance') return `${Math.round(value)} / 100`;
    return formatDecimalAT(value, 1);
}

function getTourProfileDetailRows(analysis, mode) {
    if (mode === 'performance') {
        return analysis.profileRows
            .filter(row => row.performanceCount > 0)
            .sort((a, b) => b.avgPerformance - a.avgPerformance || b.count - a.count)
            .map(row => ({
                name: `${row.icon} ${row.label}`,
                width: Math.max(0, Math.min(100, row.avgPerformance)),
                value: `${Math.round(row.avgPerformance)} / 100`
            }));
    }

    if (mode === 'strongest') {
        const rows = analysis.profileRows
            .filter(row => row.performanceCount > 0)
            .map(row => {
                const delta = Number.isFinite(analysis.overallPerformance) && Math.abs(analysis.overallPerformance) > 0.000001
                    ? ((row.avgPerformance - analysis.overallPerformance) / Math.abs(analysis.overallPerformance)) * 100
                    : 0;
                return { row, delta };
            })
            .sort((a, b) => b.delta - a.delta || b.row.count - a.row.count);

        const maxAbs = Math.max(1, ...rows.map(item => Math.abs(item.delta)));

        return rows.map(({ row, delta }) => ({
            name: `${row.icon} ${row.label}`,
            width: Math.max(5, Math.min(100, (Math.abs(delta) / maxAbs) * 100)),
            value: `${delta > 0.05 ? '+' : delta < -0.05 ? '−' : '±'}${Math.abs(delta).toFixed(1).replace('.', ',')} %`
        }));
    }

    if (mode === 'coverage') {
        const analyzed = analysis.analyzed.length;
        const missing = Math.max(0, analysis.totalEntries - analyzed);
        const total = Math.max(1, analysis.totalEntries);

        return [
            {
                name: '✓ Analysierbar',
                width: (analyzed / total) * 100,
                value: `${analyzed} · ${formatDecimalAT((analyzed / total) * 100, 1)} %`
            },
            {
                name: '– Nicht analysierbar',
                width: (missing / total) * 100,
                value: `${missing} · ${formatDecimalAT((missing / total) * 100, 1)} %`
            }
        ];
    }

    return analysis.rankedProfiles
        .filter(row => row.count > 0)
        .map(row => ({
            name: `${row.icon} ${row.label}`,
            width: row.share,
            value: `${row.count} · ${formatDecimalAT(row.share, 1)} %`
        }));
}

function getTourProfileDetailTitle(mode) {
    switch (mode) {
        case 'performance': return 'Ø Leistungsindex nach Profil';
        case 'strongest': return 'Abweichung vom Leistungs-Gesamtschnitt';
        case 'coverage': return 'Datenbasis der Profilanalyse';
        default: return 'Verteilung der Tourprofile';
    }
}

function renderTourProfileAnalysis(entries) {
    const analysis = buildTourProfileAnalysis(entries);

    if (!analysis.analyzed.length) {
        return `
            <div class="stats-empty-state">
                Für die Tourprofil-Analyse werden Strecke, Aufstieg und Gehzeit benötigt.
            </div>
        `;
    }

    if (!['distribution', 'performance', 'strongest'].includes(tourProfileDetailMode)) {
        tourProfileDetailMode = 'distribution';
    }

    const mostCommon = analysis.mostCommon;
    const strongest = analysis.strongest;

    const strongestPerformance =
        strongest && Number.isFinite(strongest.avgPerformance)
            ? `${Math.round(strongest.avgPerformance)} / 100`
            : '–';

    let strongestDeltaValue = '–';
    if (Number.isFinite(analysis.strongestDeltaPercent)) {
        const delta = analysis.strongestDeltaPercent;
        const sign = delta > 0.05 ? '+' : delta < -0.05 ? '−' : '±';
        strongestDeltaValue = `${sign}${Math.abs(delta).toFixed(1).replace('.', ',')} %`;
    }

    const modes = [
        {
            key: 'distribution',
            label: 'Häufigstes Profil',
            value: mostCommon ? `${mostCommon.icon} ${escapeHtml(mostCommon.label)}` : '–',
            meta: mostCommon ? `${formatDecimalAT(mostCommon.share, 1)} % der analysierten Touren` : '–'
        },
        {
            key: 'performance',
            label: 'Bester Ø Leistungsindex',
            value: strongestPerformance,
            meta: strongest ? `${strongest.icon} ${escapeHtml(strongest.label)}` : '–'
        },
        {
            key: 'strongest',
            label: 'Leistungsvorsprung',
            value: strongestDeltaValue,
            meta: strongest ? `${strongest.icon} ${escapeHtml(strongest.label)} · zum Gesamtschnitt` : '–'
        }
    ];

    const detailRows = getTourProfileDetailRows(analysis, tourProfileDetailMode);

    return `
        <div class="tour-profile-summary-grid">
            ${modes.map(card => {
                const active = tourProfileDetailMode === card.key;
                return `
                    <button
                        type="button"
                        class="tour-profile-summary-card ${active ? 'active' : ''}"
                        data-tour-profile-mode="${card.key}"
                        aria-pressed="${active ? 'true' : 'false'}">
                        <span class="tour-profile-summary-label">${card.label}</span>
                        <span class="tour-profile-summary-value">${card.value}</span>
                        <span class="tour-profile-summary-meta">${card.meta}</span>
                    </button>
                `;
            }).join('')}
        </div>

        <div class="tour-profile-analysis-count">
            ${analysis.analyzed.length} von ${analysis.totalEntries} Touren analysiert
        </div>

        <div class="tour-profile-detail-title">${escapeHtml(getTourProfileDetailTitle(tourProfileDetailMode))}</div>
        <ul class="tour-profile-list">
            ${detailRows.map(row => `
                <li class="tour-profile-row">
                    <span class="tour-profile-name">${escapeHtml(row.name)}</span>
                    <span class="tour-profile-bar" aria-hidden="true">
                        <span style="width:${Math.max(0, Math.min(100, row.width)).toFixed(1)}%;"></span>
                    </span>
                    <span class="tour-profile-share">${escapeHtml(row.value)}</span>
                </li>
            `).join('')}
        </ul>

        <div class="tour-profile-feature-title">Leistungsmerkmale · persönliche Top-25%-Schwellen</div>
        <div class="tour-profile-feature-grid">
            ${analysis.features.map(feature => `
                <div class="tour-profile-feature-card">
                    <strong>${feature.icon} ${escapeHtml(feature.label)}</strong>
                    <span>${feature.count} von ${feature.eligible} auswertbaren Touren im oberen Viertel</span>
                    ${feature.benchmarks.map(benchmark => `
                        <span class="tour-profile-feature-benchmark">
                            ${escapeHtml(benchmark.label)}: ab ${formatTourProfileBenchmarkValue(benchmark.threshold, feature.metric)} · Bestwert ${formatTourProfileBenchmarkValue(benchmark.best, feature.metric)}
                        </span>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

function initTourProfileControls(container) {
    container?.querySelectorAll('[data-tour-profile-mode]')
        .forEach(button => {
            button.addEventListener('click', () => {
                tourProfileDetailMode = button.dataset.tourProfileMode || 'distribution';
                updateDevelopmentStatsPage();
            });
        });
}

function getDevelopmentHistoryMetricDefinition(key) {
    return DEVELOPMENT_HISTORY_METRICS.find(metric => metric.key === key) ||
        DEVELOPMENT_HISTORY_METRICS[0];
}

function getDevelopmentHistoryValue(entries, key) {
    if (key === 'tourCount') {
        return entries.length;
    }

    if (key === 'totalAscent') {
        const values = entries
            .map(entry => Number(getAdjustedAscent(entry)))
            .filter(value => Number.isFinite(value) && value >= 0);

        return values.length
            ? values.reduce((sum, value) => sum + value, 0)
            : null;
    }

    return averageDevelopmentMetric(entries, key);
}

function getDevelopmentMonthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDevelopmentMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function buildDevelopmentMonthlySeries(entries, range) {
    const dated = [...entries]
        .map(entry => ({
            entry,
            date: parseStatsCalendarDate(entry?.date)
        }))
        .filter(item => item.date)
        .sort((a, b) => a.date - b.date);

    if (!dated.length) return [];

    /*
     * Der laufende Kalendermonat bleibt bewusst außen vor,
     * damit ein noch unvollständiger Monat den Trend nicht verzerrt.
     */
    const currentMonth = getDevelopmentMonthStart(new Date());
    const lastMonth = addDevelopmentMonths(currentMonth, -1);
    const monthCount = Math.max(1, Number(range) || 12);
    const startMonth = addDevelopmentMonths(lastMonth, -(monthCount - 1));

    const groups = new Map();
    dated.forEach(({ entry, date }) => {
        const month = getDevelopmentMonthStart(date);
        if (month < startMonth || month > lastMonth) return;

        const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    });

    const result = [];
    for (
        let cursor = new Date(startMonth);
        cursor <= lastMonth;
        cursor = addDevelopmentMonths(cursor, 1)
    ) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const monthEntries = groups.get(key) || [];

        result.push({
            key,
            date: new Date(cursor),
            entries: monthEntries,
            value: monthEntries.length
                ? getDevelopmentHistoryValue(monthEntries, developmentHistoryMetric)
                : ['tourCount', 'totalAscent'].includes(developmentHistoryMetric)
                    ? 0
                    : null
        });
    }

    return result;
}

function formatDevelopmentHistoryValue(value, key, compact = false) {
    if (!Number.isFinite(value)) return '–';

    if (key === 'tourCount') {
        return `${Math.round(value)}${compact ? '' : Math.round(value) === 1 ? ' Tour' : ' Touren'}`;
    }

    if (key === 'totalAscent') {
        return `${Math.round(value).toLocaleString('de-AT')}${compact ? '' : ' hm'}`;
    }

    if (key === 'time') {
        const totalMinutes = Math.round(value);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}:${String(minutes).padStart(2, '0')}${compact ? '' : ' Std.'}`;
    }

    if (key === 'performance') {
        return `${Math.round(value)}${compact ? '' : ' / 100'}`;
    }

    if (key === 'distance') {
        return `${formatDecimalAT(value, 1)}${compact ? '' : ' km'}`;
    }

    if (key === 'speed') {
        return `${formatDecimalAT(value, 2)}${compact ? '' : ' km/h'}`;
    }

    if (key === 'ascentRate') {
        return `${Math.round(value).toLocaleString('de-AT')}${compact ? '' : ' hm/h'}`;
    }

    if (key === 'ascent') {
        return `${Math.round(value).toLocaleString('de-AT')}${compact ? '' : ' hm'}`;
    }

    return String(value);
}

function formatDevelopmentHistoryMonth(date, withYear = true) {
    if (!(date instanceof Date)) return '–';

    return date.toLocaleDateString('de-AT', {
        month: 'short',
        ...(withYear ? { year: '2-digit' } : {})
    }).replace('.', '');
}

function renderLongTermDevelopment(entries) {
    const metric = getDevelopmentHistoryMetricDefinition(developmentHistoryMetric);
    const series = buildDevelopmentMonthlySeries(entries, developmentHistoryRange);
    const valid = series.filter(point => Number.isFinite(point.value));

    const options = DEVELOPMENT_HISTORY_METRICS.map(item => `
        <option value="${item.key}" ${item.key === developmentHistoryMetric ? 'selected' : ''}>
            ${item.label}
        </option>
    `).join('');

    const controls = `
        <div class="development-history-controls">
            <div>
                <label class="development-history-control-label" for="development-history-metric">
                    Kennzahl
                </label>
                <select id="development-history-metric" class="development-history-select">
                    ${options}
                </select>
            </div>

            <div>
                <span class="development-history-control-label">Zeitraum</span>
                <div class="development-history-range">
                    ${[
                        ['12', '12 Mon.'],
                        ['24', '24 Mon.']
                    ].map(([value, label]) => `
                        <button
                            type="button"
                            class="development-history-range-btn ${developmentHistoryRange === value ? 'active' : ''}"
                            data-development-history-range="${value}">
                            ${label}
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    if (!series.length || !valid.length) {
        return `
            ${controls}
            <div class="stats-empty-state">
                Für diese Kennzahl gibt es im gewählten Zeitraum noch keine auswertbaren Monatswerte. Wähle eine andere Kennzahl oder einen größeren Zeitraum.
            </div>
        `;
    }

    const width = 620;
    const height = 148;
    const paddingLeft = 68;
    const paddingRight = 10;
    const paddingTop = 11;
    const paddingBottom = 25;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    const values = valid.map(point => point.value);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (metric.key === 'tourCount' || metric.key === 'totalAscent') {
        min = 0;
    }

    if (Math.abs(max - min) < 0.000001) {
        const pad = Math.max(1, Math.abs(max) * 0.08);
        min = Math.max(0, min - pad);
        max += pad;
    } else {
        const spread = max - min;
        min = Math.max(0, min - spread * 0.08);
        max += spread * 0.08;
    }

    const xForIndex = index =>
        series.length <= 1
            ? paddingLeft + plotWidth / 2
            : paddingLeft + (index / (series.length - 1)) * plotWidth;

    const yForValue = value =>
        paddingTop +
        (1 - (value - min) / Math.max(0.000001, max - min)) * plotHeight;

    const segments = [];
    let currentSegment = [];

    series.forEach((point, index) => {
        if (Number.isFinite(point.value)) {
            currentSegment.push({
                ...point,
                index,
                x: xForIndex(index),
                y: yForValue(point.value)
            });
        } else if (currentSegment.length) {
            segments.push(currentSegment);
            currentSegment = [];
        }
    });

    if (currentSegment.length) segments.push(currentSegment);

    const coords = segments.flat();
    const tickValues = [max, (max + min) / 2, min];

    const yAxis = tickValues.map(value => {
        const y = yForValue(value);
        return `
            <line
                class="history-grid"
                x1="${paddingLeft}"
                y1="${y.toFixed(1)}"
                x2="${(width - paddingRight).toFixed(1)}"
                y2="${y.toFixed(1)}">
            </line>
            <text
                class="history-y-label"
                x="${paddingLeft - 5}"
                y="${(y + 2.5).toFixed(1)}"
                text-anchor="end">
                ${formatDevelopmentHistoryValue(value, metric.key, true)}
            </text>
        `;
    }).join('');

    const desiredLabels = Math.min(6, series.length);
    const labelIndexes = new Set();
    if (series.length === 1) {
        labelIndexes.add(0);
    } else {
        for (let i = 0; i < desiredLabels; i++) {
            labelIndexes.add(
                Math.round((i / Math.max(1, desiredLabels - 1)) * (series.length - 1))
            );
        }
    }

    const xAxis = [...labelIndexes]
        .sort((a, b) => a - b)
        .map(index => `
            <text
                class="history-x-label"
                x="${xForIndex(index).toFixed(1)}"
                y="${height - 6}"
                text-anchor="middle">
                ${formatDevelopmentHistoryMonth(series[index].date, true)}
            </text>
        `).join('');

    const lines = segments
        .filter(segment => segment.length >= 2)
        .map(segment => `
            <polyline
                class="history-line"
                points="${segment.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')}">
            </polyline>
        `).join('');

    const dots = coords.map(point => `
        <circle
            class="history-dot"
            cx="${point.x.toFixed(2)}"
            cy="${point.y.toFixed(2)}"
            r="2.4">
            <title>${formatDevelopmentHistoryMonth(point.date, true)} · ${formatDevelopmentHistoryValue(point.value, metric.key)}</title>
        </circle>
    `).join('');

    const first = valid[0];
    const last = valid[valid.length - 1];
    const delta = last.value - first.value;
    const deltaPercent = Math.abs(first.value) > 0.000001
        ? (delta / Math.abs(first.value)) * 100
        : null;
    const deltaClass = Math.abs(delta) < 0.000001
        ? 'neutral'
        : delta > 0
            ? 'positive'
            : 'negative';
    const arrow = deltaClass === 'positive' ? '↑' : deltaClass === 'negative' ? '↓' : '→';

    return `
        ${controls}

        <div class="development-history-chart-wrap">
            <svg
                class="development-history-chart"
                viewBox="0 0 ${width} ${height}"
                role="img"
                aria-label="Monatlicher Entwicklungsverlauf: ${escapeHtml(metric.label)}">
                ${yAxis}
                ${lines}
                ${dots}
                ${xAxis}
            </svg>
        </div>

        <div class="development-history-summary">
            <div>
                <small>Start · ${formatDevelopmentHistoryMonth(first.date, true)}</small>
                <strong>${formatDevelopmentHistoryValue(first.value, metric.key)}</strong>
            </div>
            <div>
                <small>Aktuell · ${formatDevelopmentHistoryMonth(last.date, true)}</small>
                <strong>${formatDevelopmentHistoryValue(last.value, metric.key)}</strong>
            </div>
            <div>
                <small>Veränderung</small>
                <strong class="development-trend ${deltaClass}">
                    ${arrow} ${Number.isFinite(deltaPercent) ? `${Math.abs(deltaPercent).toFixed(1).replace('.', ',')} %` : '–'}
                </strong>
            </div>
        </div>
    `;
}

function initDevelopmentHistoryControls(container) {
    const metricSelect = container?.querySelector('#development-history-metric');

    if (metricSelect) {
        metricSelect.addEventListener('change', () => {
            developmentHistoryMetric = metricSelect.value;
            updateDevelopmentStatsPage();
        });
    }

    container?.querySelectorAll('[data-development-history-range]')
        .forEach(button => {
            button.addEventListener('click', () => {
                developmentHistoryRange = button.dataset.developmentHistoryRange || '12';
                updateDevelopmentStatsPage();
            });
        });
}

function getActivityCalendarYear(entries) {
    if (/^\d{4}$/.test(String(statsYearFilter))) {
        return Number(statsYearFilter);
    }

    const years = entries
        .map(entry => parseStatsCalendarDate(entry?.date)?.getFullYear())
        .filter(Number.isFinite);

    return years.length
        ? Math.max(...years)
        : new Date().getFullYear();
}

function getActivityStatistics(entries) {
    const validEntries = entries
        .map(entry => ({
            entry,
            date: parseStatsCalendarDate(entry?.date)
        }))
        .filter(item => item.date);

    const dayMap = new Map();
    const monthCounts = Array(12).fill(0);
    const monthDaySets = Array.from({ length: 12 }, () => new Set());
    const weekdayCounts = Array(7).fill(0);

    validEntries.forEach(({ date }) => {
        const key = getStatsDateKey(date);
        dayMap.set(key, (dayMap.get(key) || 0) + 1);
        monthCounts[date.getMonth()]++;
        monthDaySets[date.getMonth()].add(key);
        weekdayCounts[date.getDay()]++;
    });

    const monthDayCounts = monthDaySets.map(set => set.size);

    const uniqueDates = Array.from(dayMap.keys())
        .map(key => parseStatsCalendarDate(key))
        .filter(Boolean)
        .sort((a, b) => a - b);

    const gaps = [];
    const gapDetails = [];
    for (let i = 1; i < uniqueDates.length; i++) {
        const gap =
            getCalendarDayNumber(uniqueDates[i]) -
            getCalendarDayNumber(uniqueDates[i - 1]);
        gaps.push(gap);
        gapDetails.push({
            days: gap,
            from: uniqueDates[i - 1],
            to: uniqueDates[i]
        });
    }

    const longestPauseDetail = gapDetails.length
        ? [...gapDetails].sort((a, b) => b.days - a.days)[0]
        : null;

    const longestPause = longestPauseDetail?.days ?? null;
    const averagePause = gaps.length
        ? getBoundedAverage(gaps)
        : null;

    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const medianPause = sortedGaps.length
        ? sortedGaps.length % 2
            ? sortedGaps[(sortedGaps.length - 1) / 2]
            : (sortedGaps[sortedGaps.length / 2 - 1] + sortedGaps[sortedGaps.length / 2]) / 2
        : null;

    const minPause = gaps.length ? Math.min(...gaps) : null;
    const maxPause = gaps.length ? Math.max(...gaps) : null;

    const weekStarts = Array.from(new Set(
        uniqueDates.map(date => {
            const dayNumber = getCalendarDayNumber(date);
            const mondayOffset = (date.getDay() + 6) % 7;
            return dayNumber - mondayOffset;
        })
    )).sort((a, b) => a - b);

    let longestWeekStreak = weekStarts.length ? 1 : 0;
    let currentWeekStreak = weekStarts.length ? 1 : 0;
    let currentStartIndex = 0;
    let bestStartIndex = 0;
    let bestEndIndex = weekStarts.length ? 0 : -1;

    for (let i = 1; i < weekStarts.length; i++) {
        if (weekStarts[i] - weekStarts[i - 1] === 7) {
            currentWeekStreak++;
        } else {
            currentWeekStreak = 1;
            currentStartIndex = i;
        }

        if (currentWeekStreak > longestWeekStreak) {
            longestWeekStreak = currentWeekStreak;
            bestStartIndex = currentStartIndex;
            bestEndIndex = i;
        }
    }

    const dateFromDayNumber = dayNumber => {
        if (!Number.isFinite(dayNumber)) return null;
        const utc = new Date(dayNumber * 86400000);
        return new Date(
            utc.getUTCFullYear(),
            utc.getUTCMonth(),
            utc.getUTCDate()
        );
    };

    const longestWeekStreakStart = bestEndIndex >= 0
        ? dateFromDayNumber(weekStarts[bestStartIndex])
        : null;
    const longestWeekStreakEnd = bestEndIndex >= 0
        ? dateFromDayNumber(weekStarts[bestEndIndex] + 6)
        : null;

    const monthIndex = monthCounts.indexOf(Math.max(...monthCounts));
    const weekdayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));

    const weekdayNames = [
        'Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
        'Donnerstag', 'Freitag', 'Samstag'
    ];

    return {
        dayMap,
        uniqueDates,
        monthCounts,
        monthDayCounts,
        weekdayCounts,
        weekdayNames,
        activeMonthIndex: Math.max(...monthCounts, 0) > 0 ? monthIndex : null,
        activeWeekdayIndex: Math.max(...weekdayCounts, 0) > 0 ? weekdayIndex : null,
        tourDays: dayMap.size,
        activeMonth:
            Math.max(...monthCounts, 0) > 0
                ? `${COMPARE_MONTH_NAMES[monthIndex]} · ${monthCounts[monthIndex]}`
                : '–',
        activeWeekday:
            Math.max(...weekdayCounts, 0) > 0
                ? `${weekdayNames[weekdayIndex]} · ${weekdayCounts[weekdayIndex]}`
                : '–',
        longestPause,
        longestPauseDetail,
        averagePause,
        medianPause,
        minPause,
        maxPause,
        longestWeekStreak,
        longestWeekStreakStart,
        longestWeekStreakEnd
    };
}

function renderActivityDistributionRows(labels, values, suffix = '') {
    const maxValue = Math.max(1, ...values);

    return `
        <ul class="activity-detail-list">
            ${labels.map((label, index) => {
                const value = Number(values[index]) || 0;
                return `
                    <li class="activity-detail-row">
                        <span>${escapeHtml(label)}</span>
                        <span class="activity-detail-bar" aria-hidden="true">
                            <span style="width:${((value / maxValue) * 100).toFixed(1)}%;"></span>
                        </span>
                        <strong>${value}${suffix}</strong>
                    </li>
                `;
            }).join('')}
        </ul>
    `;
}

function renderActivityDetail(entries, activity, year, mode) {
    switch (mode) {
        case 'activeMonth': {
            if (!Number.isInteger(activity.activeMonthIndex)) {
                return '<div class="stats-empty-state">Keine Monatsdaten vorhanden. Wähle ein anderes Jahr oder einen Zeitraum mit gespeicherten Touren.</div>';
            }

            const monthIndex = activity.activeMonthIndex;
            const monthTours = entries
                .filter(entry => {
                    const date = parseStatsCalendarDate(entry?.date);
                    return date && date.getMonth() === monthIndex;
                })
                .sort((a, b) =>
                    (parseStatsCalendarDate(b.date)?.getTime() || 0) -
                    (parseStatsCalendarDate(a.date)?.getTime() || 0)
                );

            return `
                <div class="activity-detail-summary">
                    <strong>${COMPARE_MONTH_NAMES[monthIndex]}${/^\d{4}$/.test(String(statsYearFilter)) ? ' ' + year : ''}</strong>
                    <span>${monthTours.length} ${monthTours.length === 1 ? 'Tour' : 'Touren'} an ${activity.monthDayCounts[monthIndex]} Tourtagen</span>
                </div>
                <ul class="activity-detail-tour-list">
                    ${monthTours.map(entry => `
                        <li>${escapeHtml(entry.date || '–')} · ${escapeHtml(entry.tourname || 'Unbekannt')}</li>
                    `).join('')}
                </ul>
            `;
        }

        case 'activeWeekday': {
            const mondayFirstLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
            const mondayFirstValues = [1,2,3,4,5,6,0].map(index => activity.weekdayCounts[index] || 0);
            return renderActivityDistributionRows(mondayFirstLabels, mondayFirstValues, '');
        }

        case 'weekStreak': {
            const start = activity.longestWeekStreakStart;
            const end = activity.longestWeekStreakEnd;
            const streakTours = start && end
                ? entries.filter(entry => {
                    const date = parseStatsCalendarDate(entry?.date);
                    return date && date >= start && date <= end;
                }).length
                : 0;

            return `
                <div class="activity-detail-stat-grid">
                    <div><small>Zeitraum</small><strong>${start && end ? `${formatDevelopmentShortDate(start)} – ${formatDevelopmentShortDate(end)}` : '–'}</strong></div>
                    <div><small>Wochen in Folge</small><strong>${activity.longestWeekStreak}</strong></div>
                    <div><small>Touren darin</small><strong>${streakTours}</strong></div>
                </div>
            `;
        }

        case 'longestPause': {
            const pause = activity.longestPauseDetail;
            return `
                <div class="activity-detail-stat-grid">
                    <div><small>Pause</small><strong>${pause ? Math.round(pause.days) + ' Tage' : '–'}</strong></div>
                    <div><small>Letzte Tour davor</small><strong>${pause ? formatDevelopmentShortDate(pause.from) : '–'}</strong></div>
                    <div><small>Nächste Tour</small><strong>${pause ? formatDevelopmentShortDate(pause.to) : '–'}</strong></div>
                </div>
            `;
        }

        case 'averagePause':
            return `
                <div class="activity-detail-stat-grid four">
                    <div><small>Kürzester Abstand</small><strong>${Number.isFinite(activity.minPause) ? formatDecimalAT(activity.minPause, 1) + ' Tage' : '–'}</strong></div>
                    <div><small>Median</small><strong>${Number.isFinite(activity.medianPause) ? formatDecimalAT(activity.medianPause, 1) + ' Tage' : '–'}</strong></div>
                    <div><small>Durchschnitt</small><strong>${Number.isFinite(activity.averagePause) ? formatDecimalAT(activity.averagePause, 1) + ' Tage' : '–'}</strong></div>
                    <div><small>Maximum</small><strong>${Number.isFinite(activity.maxPause) ? formatDecimalAT(activity.maxPause, 1) + ' Tage' : '–'}</strong></div>
                </div>
            `;

        case 'tourDays':
        default:
            return renderActivityDistributionRows(
                COMPARE_MONTH_NAMES.map(name => name.slice(0, 3)),
                activity.monthDayCounts,
                ''
            );
    }
}

function getActivityDetailTitle(mode) {
    switch (mode) {
        case 'activeMonth': return 'Details zum aktivsten Monat';
        case 'activeWeekday': return 'Touren nach Wochentag';
        case 'weekStreak': return 'Details zur längsten Wochenserie';
        case 'longestPause': return 'Details zur längsten Pause';
        case 'averagePause': return 'Abstände zwischen Tourtagen';
        default: return 'Tourtage nach Monat';
    }
}

function renderActivityCalendar(entries, year) {
    const tourDays = new Map();

    entries.forEach(entry => {
        const date = parseStatsCalendarDate(entry?.date);
        if (!date || date.getFullYear() !== year) return;

        const key = getStatsDateKey(date);
        if (!tourDays.has(key)) tourDays.set(key, []);
        tourDays.get(key).push(entry);
    });

    const axisLabels = Array.from({ length: 31 }, (_, index) => {
        const day = index + 1;
        const show = [1, 5, 10, 15, 20, 25, 30].includes(day);

        return `
            <span class="activity-calendar-axis-day">
                ${show ? day : ''}
            </span>
        `;
    }).join('');

    const monthRows = COMPARE_MONTH_NAMES.map((name, monthIndex) => {
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

        const cells = Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            const periodStart = [6, 11, 16, 21, 26].includes(day);

            if (day > daysInMonth) {
                return `<span class="activity-day outside ${periodStart ? 'period-start' : ''}"></span>`;
            }

            const date = new Date(year, monthIndex, day);
            const key = getStatsDateKey(date);
            const dayEntries = tourDays.get(key) || [];
            const hasTour = dayEntries.length > 0;

            return `
                <span
                    class="activity-day ${hasTour ? 'active' : ''} ${periodStart ? 'period-start' : ''}"
                    ${hasTour ? `data-activity-date="${key}" role="button" tabindex="0"` : ''}
                    title="${day}. ${name} ${year}: ${hasTour ? dayEntries.length + (dayEntries.length === 1 ? ' Tour' : ' Touren') : 'keine Tour'}"
                    aria-label="${day}. ${name} ${year}: ${hasTour ? dayEntries.length + (dayEntries.length === 1 ? ' Tour' : ' Touren') : 'keine Tour'}">
                </span>
            `;
        }).join('');

        return `
            <div class="activity-month-row">
                <span class="activity-month-label">${name.slice(0, 3)}</span>
                <div class="activity-month-days">${cells}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="activity-calendar">
            ${monthRows}
            <div class="activity-calendar-axis" aria-hidden="true">
                <span></span>
                <div class="activity-calendar-axis-days">${axisLabels}</div>
            </div>
        </div>
    `;
}

function openActivityDayTours(dateKey, entries) {
    const dayEntries = entries
        .filter(entry => {
            const date = parseStatsCalendarDate(entry?.date);
            return date && getStatsDateKey(date) === dateKey;
        })
        .sort((a, b) => String(a.tourname || '').localeCompare(String(b.tourname || ''), 'de'));

    if (!dayEntries.length) return;

    if (dayEntries.length === 1) {
        openTourDetail(dayEntries[0]);
        return;
    }

    const tlTitle = document.getElementById('tl-title');
    const tlBody = document.getElementById('tl-body');
    const modal = document.getElementById('tour-list-modal');
    if (!tlTitle || !tlBody || !modal) return;

    tlTitle.textContent = `🗓️ ${formatStatsHistoryDate(dateKey)}`;
    tlBody.innerHTML = `
        <ul class="stats-list">
            ${dayEntries.map((entry, index) => `
                <li class="highlight-clickable" data-activity-tour-idx="${index}">
                    <span class="stats-label">${escapeHtml(entry.tourname || 'Unbekannt')}</span>
                    <span class="stats-value">${entry.strecke ? formatDecimalAT(entry.strecke) + ' km' : '–'}</span>
                </li>
            `).join('')}
        </ul>
    `;

    tlBody.querySelectorAll('[data-activity-tour-idx]').forEach(el => {
        const entry = dayEntries[Number(el.dataset.activityTourIdx)];
        if (!entry) return;
        el.addEventListener('click', () => {
            closeTourListModal();
            openTourDetail(entry, { returnModalId: 'tour-list-modal' });
        });
    });

    attachModalSwipeDown(modal, closeTourListModal);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function initActivityControls(container, entries) {
    container?.querySelectorAll('[data-activity-detail-mode]')
        .forEach(button => {
            button.addEventListener('click', () => {
                activityDetailMode = button.dataset.activityDetailMode || 'tourDays';
                updateDevelopmentStatsPage();
            });
        });

    const activateDay = element => {
        const dateKey = element?.dataset?.activityDate;
        if (dateKey) openActivityDayTours(dateKey, entries);
    };

    container?.querySelectorAll('[data-activity-date]')
        .forEach(day => {
            day.addEventListener('click', () => activateDay(day));
            day.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activateDay(day);
                }
            });
        });
}

function updateDevelopmentStatsPage() {
    const container = document.getElementById('stats-development-content');
    if (!container) return;

    const data = [...getStatsFilteredData()]
        .filter(entry => parseStatsCalendarDate(entry?.date))
        .sort((a, b) =>
            parseStatsCalendarDate(b.date) -
            parseStatsCalendarDate(a.date)
        );

    const formTrendData = data.filter(entry =>
        String(entry?.difficulty || '').trim().toLowerCase() !== 'radtour'
    );

    const recent = formTrendData.slice(0, 10);
    const previous = formTrendData.slice(10, 20);

    const activity = getActivityStatistics(data);
    const calendarYear = getActivityCalendarYear(data);

    const allDevelopmentData = [...(appStorage.get('touren') || [])]
        .filter(entry => parseStatsCalendarDate(entry?.date));

    const calendarScopeHint =
        /^\d{4}$/.test(String(statsYearFilter))
            ? ''
            : ` · jüngstes Jahr im Filter`;

    const developmentScopeLabel =
        statsYearFilter === 'all'
            ? 'Alle Jahre'
            : statsYearFilter === 'past'
                ? 'Vergangene Jahre'
                : String(statsYearFilter);

    const sectionTrend = `
        <section class="stats-analysis-section">
            <div class="stats-analysis-title">
                <span>📈 Formtrend</span>
            </div>
            <div class="development-metric-grid">
                ${renderDevelopmentMetricCard('Ø Leistungsindex', 'performance', recent, previous)}
                ${renderDevelopmentMetricCard('Ø Strecke / Tour', 'distance', recent, previous)}
                ${renderDevelopmentMetricCard('Ø Gehzeit / Tour', 'time', recent, previous)}
                ${renderDevelopmentMetricCard('Ø Aufstieg / Tour', 'ascent', recent, previous)}
                ${renderDevelopmentMetricCard('Ø Geschwindigkeit', 'speed', recent, previous)}
                ${renderDevelopmentMetricCard('Ø Anstieg / h', 'ascentRate', recent, previous)}
            </div>

            <div style="margin-top:9px;">
                ${buildDevelopmentSparkline(formTrendData, developmentTrendMetric)}
            </div>
        </section>
    `;

    const sectionBest = `
        <section class="stats-analysis-section">
            <div class="stats-analysis-title">
                <span>🏆 Persönliche Bestform</span>
                <span style="font-size:9px; opacity:.7;">${escapeHtml(developmentScopeLabel)}</span>
            </div>
            ${renderPersonalBestForm(data)}
        </section>
    `;

    const sectionHistory = `
        <section class="stats-analysis-section">
            <div class="stats-analysis-title">
                <span>📊 Langfristige Entwicklung</span>
                <span style="font-size:9px; opacity:.7;">Abgeschlossene Monate · alle Touren</span>
            </div>
            ${renderLongTermDevelopment(allDevelopmentData)}
        </section>
    `;

    const sectionProfile = `
        <section class="stats-analysis-section">
            <div class="stats-analysis-title">
                <span>🧭 Tourprofil</span>
                <span style="font-size:9px; opacity:.7;">${escapeHtml(developmentScopeLabel)}</span>
            </div>
            ${renderTourProfileAnalysis(data)}
        </section>
    `;

    const sectionActivity = `
        <section class="stats-analysis-section">
            <div class="stats-analysis-title">
                <span>🗓️ Aktivität & Regelmäßigkeit</span>
                <span style="font-size:9px; opacity:.7;">${calendarYear}${calendarScopeHint}</span>
            </div>

            <div class="activity-summary-grid">
                ${[
                    ['tourDays', 'Tourtage', activity.tourDays],
                    ['activeMonth', 'Aktivster Monat', escapeHtml(activity.activeMonth)],
                    ['activeWeekday', 'Aktivster Wochentag', escapeHtml(activity.activeWeekday)],
                    ['weekStreak', 'Längste Wochenserie', `${activity.longestWeekStreak} ${activity.longestWeekStreak === 1 ? 'Woche' : 'Wochen'}`],
                    ['longestPause', 'Längste Pause', Number.isFinite(activity.longestPause) ? Math.round(activity.longestPause) + ' Tage' : '–'],
                    ['averagePause', 'Ø Abstand zwischen Tourtagen', Number.isFinite(activity.averagePause) ? formatDecimalAT(activity.averagePause, 1) + ' Tage' : '–']
                ].map(([mode, label, value]) => {
                    const active = activityDetailMode === mode;
                    return `
                        <button
                            type="button"
                            class="activity-summary-card ${active ? 'active' : ''}"
                            data-activity-detail-mode="${mode}"
                            aria-pressed="${active ? 'true' : 'false'}">
                            <span class="activity-summary-label">${label}</span>
                            <span class="activity-summary-value">${value}</span>
                        </button>
                    `;
                }).join('')}
            </div>

            <div class="activity-detail-panel">
                <div class="activity-detail-title">${escapeHtml(getActivityDetailTitle(activityDetailMode))}</div>
                ${renderActivityDetail(data, activity, calendarYear, activityDetailMode)}
            </div>

            <div style="margin-top:10px;">
                ${renderActivityCalendar(data, calendarYear)}
            </div>
        </section>
    `;

    /*
     * Querformat: zwei unabhängige Spalten statt einer
     * einfachen Abfolge. Dadurch bestimmt die rechte Spalte
     * (Tourprofil → Aktivität) ausschließlich ihre eigene
     * Höhe und wartet nicht auf die linke Spalte.
     *
     * Hochformat: komplett unverändert – dieselbe Reihenfolge
     * wie bisher, ohne zusätzliche Spalten-Wrapper.
     */
    const isLandscapeMobileLayout =
        window.matchMedia(
            '(max-width: 1024px) and (orientation: landscape) and (pointer: coarse)'
        ).matches;

    if (isLandscapeMobileLayout) {
        container.innerHTML = `
            <div class="development-col development-col-left">
                ${sectionTrend}
                ${sectionBest}
                ${sectionHistory}
            </div>
            <div class="development-col development-col-right">
                ${sectionProfile}
                ${sectionActivity}
            </div>
        `;
    } else {
        container.innerHTML = `
            ${sectionTrend}
            ${sectionBest}
            ${sectionHistory}
            ${sectionProfile}
            ${sectionActivity}
        `;
    }

    initDevelopmentHistoryControls(container);
    initDevelopmentTrendControls(container);
    initDevelopmentSparklineInteractions(container);
    initTourProfileControls(container);
    initActivityControls(container, data);
}

function buildStatsPeakOccurrences(entries) {
    const occurrences = [];

    entries.forEach(entry => {
        const details = Array.isArray(entry?.gipfelDetails)
            ? entry.gipfelDetails
            : [];

        details.forEach(peak => {
            if (!peak?.name && !peak?.hoehe) return;

            occurrences.push({
                name: String(peak.name || '–').trim() || '–',
                rawHoehe: parsePeakHeight(peak.hoehe),
                entry
            });
        });
    });

    return occurrences;
}

function getStatsPeakKey(peak) {
    const name = String(peak?.name || '–').trim() || '–';

    if (name !== '–') {
        return typeof normalizeTourSearchText === 'function'
            ? `name:${normalizeTourSearchText(name)}`
            : `name:${name.toLocaleLowerCase('de')}`;
    }

    const firstEntry = peak?.entries?.[0] || peak?.entry;
    return `unnamed:${peak?.rawHoehe || 0}:${getPeakTourKey(firstEntry)}`;
}

function buildStatsPeakGroups(entries) {
    return groupPeakOccurrences(
        buildStatsPeakOccurrences(entries)
    );
}

function peakDateRange(group) {
    const dates = (group?.entries || [])
        .map(entry => parseStatsCalendarDate(entry?.date))
        .filter(Boolean)
        .sort((a, b) => a - b);

    return {
        first: dates[0] || null,
        last: dates[dates.length - 1] || null
    };
}

function countNewPeaksForStatsFilter(allGroups) {
    return allGroups.filter(group => {
        if (group.name === '–') return false;

        const first = peakDateRange(group).first;
        if (!first) return false;

        if (statsYearFilter === 'all') {
            return true;
        }

        if (statsYearFilter === 'past') {
            return first.getFullYear() !== new Date().getFullYear();
        }

        return first.getFullYear() === Number(statsYearFilter);
    }).length;
}

function updatePeakStatsPage() {
    const container = document.getElementById('stats-peaks-content');
    if (!container) return;

    const filteredTours = getStatsFilteredData();
    const allTours = appStorage.get('touren') || [];

    const selectedGroups = buildStatsPeakGroups(filteredTours);
    const allGroups = buildStatsPeakGroups(allTours);

    const allGroupMap = new Map(
        allGroups.map(group => [getStatsPeakKey(group), group])
    );

    statsPeakRowsCache = selectedGroups
        .map(selectedGroup => {
            const key = getStatsPeakKey(selectedGroup);
            return {
                key,
                selectedGroup,
                fullGroup: allGroupMap.get(key) || selectedGroup
            };
        })
        .sort((a, b) => {
            const lastA = peakDateRange(a.selectedGroup).last?.getTime() || 0;
            const lastB = peakDateRange(b.selectedGroup).last?.getTime() || 0;

            if (lastB !== lastA) return lastB - lastA;

            const heightDiff =
                Number(b.selectedGroup.rawHoehe || 0) -
                Number(a.selectedGroup.rawHoehe || 0);

            if (heightDiff !== 0) return heightDiff;

            return String(a.selectedGroup.name || '').localeCompare(
                String(b.selectedGroup.name || ''),
                'de',
                { sensitivity: 'base' }
            );
        });

    const totalPeakAscents = filteredTours.reduce((sum, entry) => {
        const detailCount = Array.isArray(entry?.gipfelDetails)
            ? entry.gipfelDetails.filter(peak => peak?.name || peak?.hoehe).length
            : 0;

        const storedCount = Math.max(0, parseInt(entry?.gipfel, 10) || 0);
        return sum + Math.max(detailCount, storedCount);
    }, 0);

    const differentNamedPeaks = selectedGroups
        .filter(group => group.name !== '–')
        .length;

    const tourCount = countDistinctTours(filteredTours);
    const peaksPerTour = tourCount > 0
        ? totalPeakAscents / tourCount
        : 0;

    const peakHeightValues = buildStatsPeakOccurrences(filteredTours)
        .map(peak => Number(peak.rawHoehe))
        .filter(height => Number.isFinite(height) && height > 0);

    const averagePeakHeight = getBoundedAverage(peakHeightValues);

    const peakTours = filteredTours.filter(entry => {
        const detailCount = Array.isArray(entry?.gipfelDetails)
            ? entry.gipfelDetails.filter(peak => peak?.name || peak?.hoehe).length
            : 0;

        const storedCount = Math.max(0, parseInt(entry?.gipfel, 10) || 0);
        return Math.max(detailCount, storedCount) > 0;
    });

    const peakTourCount = countDistinctTours(peakTours);
    const peakTourShare = tourCount > 0
        ? (peakTourCount / tourCount) * 100
        : 0;

    const newPeaks = countNewPeaksForStatsFilter(allGroups);

    const totalPages = Math.max(
        1,
        Math.ceil(statsPeakRowsCache.length / STATS_PEAK_PAGE_SIZE)
    );

    statsPeakPage = Math.min(
        Math.max(1, statsPeakPage),
        totalPages
    );

    const start = (statsPeakPage - 1) * STATS_PEAK_PAGE_SIZE;
    const visibleRows = statsPeakRowsCache.slice(
        start,
        start + STATS_PEAK_PAGE_SIZE
    );

    const newPeakLabel =
        /^\d{4}$/.test(String(statsYearFilter))
            ? `Neue Gipfel ${statsYearFilter}`
            : statsYearFilter === 'past'
                ? 'Erstbesteigungen früher'
                : 'Erstbesteigungen gesamt';

    const paginationHtml = totalPages > 1 ? `
        <div class="stats-inline-pagination is-top">
            <button
                type="button"
                data-stats-peak-page="prev"
                ${statsPeakPage <= 1 ? 'disabled' : ''}>
                ◀
            </button>
            <span>${statsPeakPage} / ${totalPages}</span>
            <button
                type="button"
                data-stats-peak-page="next"
                ${statsPeakPage >= totalPages ? 'disabled' : ''}>
                ▶
            </button>
        </div>
    ` : '';

    container.innerHTML = `
        <section class="stats-analysis-section">
            <div class="stats-analysis-title">
                <span>🏔️ Gipfelstatistik</span>
            </div>

            <div class="peak-summary-grid">
                <div class="peak-summary-card">
                    <span class="peak-summary-label">Gipfel gesamt</span>
                    <span class="peak-summary-value">${totalPeakAscents}</span>
                </div>
                <div class="peak-summary-card">
                    <span class="peak-summary-label">Verschiedene Gipfel</span>
                    <span class="peak-summary-value">${differentNamedPeaks}</span>
                </div>
                <div class="peak-summary-card">
                    <span class="peak-summary-label">${escapeHtml(newPeakLabel)}</span>
                    <span class="peak-summary-value">${newPeaks}</span>
                </div>
                <div class="peak-summary-card">
                    <span class="peak-summary-label">Ø Gipfel / Tour</span>
                    <span class="peak-summary-value">${formatDecimalAT(peaksPerTour, 1)}</span>
                </div>
                <div class="peak-summary-card">
                    <span class="peak-summary-label">Ø Gipfelhöhe</span>
                    <span class="peak-summary-value">${Number.isFinite(averagePeakHeight) ? Math.round(averagePeakHeight).toLocaleString('de-AT') + ' m' : '–'}</span>
                </div>
                <div class="peak-summary-card">
                    <span class="peak-summary-label">Anteil Gipfeltouren</span>
                    <span class="peak-summary-value">${formatDecimalAT(peakTourShare, 1)} %</span>
                </div>
            </div>
        </section>

        <section class="stats-analysis-section">
            <div class="stats-analysis-title">
                <span>⛰️ Gipfelliste</span>
                <span style="font-size:9px; opacity:.7;">${statsPeakRowsCache.length}</span>
            </div>

            ${paginationHtml}

            ${visibleRows.length ? `
                <ul class="stats-peak-history-list">
                    ${visibleRows.map((row, offset) => {
                        const index = start + offset;
                        const selected = row.selectedGroup;
                        const full = row.fullGroup;
                        const totalCount = Number(full.count || full.entries?.length || 0);
                        const selectedCount = Number(selected.count || selected.entries?.length || 0);

                        const countSelectedText = `${selectedCount}×`;

const countTotalText =
    statsYearFilter === 'all'
        ? ''
        : ` · ${totalCount}× gesamt`;

                        return `
                            <li
                                class="stats-peak-history-item ${getPeakTierClass(selected.rawHoehe)}"
                                data-stats-peak-index="${index}"
                                role="button"
                                tabindex="0">
                                <div class="stats-peak-history-head">
                                    <span class="stats-peak-history-name">
                                        ${escapeHtml(selected.name)}
                                        ${selected.rawHoehe > 0 ? ` · ${Math.round(selected.rawHoehe)} m` : ''}
                                    </span>
                                    <span class="stats-peak-history-count">
    <span class="peak-count-selected">
        ${countSelectedText}
    </span>
    <span class="peak-count-total">
        ${countTotalText}
    </span>
</span>
                                </div>
                            </li>
                        `;
                    }).join('')}
                </ul>
            ` : `
                <div class="stats-empty-state">
                    Im gewählten Zeitraum sind keine benannten Gipfeldetails gespeichert.
                </div>
            `}
        </section>
    `;
}

function openStatsPeakHistory(row) {
    if (!row) return;

    const group = row.fullGroup || row.selectedGroup || row;
    const tours = [...(group.entries || [])]
        .filter(Boolean)
        .sort((a, b) =>
            (parseStatsCalendarDate(b?.date)?.getTime() || 0) -
            (parseStatsCalendarDate(a?.date)?.getTime() || 0)
        );

    if (!tours.length) return;

    const titleEl = document.getElementById('tl-title');
    const bodyEl = document.getElementById('tl-body');
    const modal = document.getElementById('tour-list-modal');

    if (!titleEl || !bodyEl || !modal) return;

    const range = peakDateRange(group);

    titleEl.textContent =
        `🏔️ ${group.name}${group.rawHoehe > 0 ? ` · ${Math.round(group.rawHoehe)} m` : ''}`;

    bodyEl.innerHTML = `
        <div class="tour-history-summary">
            <div>
                <small>Besteigungen</small>
                <strong>${tours.length}</strong>
            </div>
            <div>
                <small>Erstmals</small>
                <strong>${range.first ? formatStatsHistoryDate(getStatsDateKey(range.first)) : '–'}</strong>
            </div>
            <div>
                <small>Zuletzt</small>
                <strong>${range.last ? formatStatsHistoryDate(getStatsDateKey(range.last)) : '–'}</strong>
            </div>
            <div>
                <small>Höhe</small>
                <strong>${group.rawHoehe > 0 ? Math.round(group.rawHoehe) + ' m' : '–'}</strong>
            </div>
        </div>

        <ul class="stats-list">
            ${tours.map((entry, index) => `
                <li
                    class="highlight-clickable"
                    data-stats-peak-tour-index="${index}">
                    <div class="tour-history-row-grid">
                        <span>${formatStatsHistoryDate(entry.date)}</span>
                        <div class="history-main">
                            <div class="history-title">${escapeHtml(entry.tourname || 'Tour')}</div>
                            <div class="history-meta">
                                ${entry.strecke ? formatDecimalAT(entry.strecke) + ' km' : '–'}
                                · ${entry.aufstieg ? Math.round(Number(String(entry.aufstieg).replace(',', '.')) || 0) + ' hm' : '–'}
                                · ${entry.zeit ? escapeHtml(String(entry.zeit)) + ' h' : '–'}
                            </div>
                        </div>
                    </div>
                </li>
            `).join('')}
        </ul>
    `;

    bodyEl.querySelectorAll('[data-stats-peak-tour-index]')
        .forEach(element => {
            element.addEventListener('click', () => {
                const entry = tours[Number(element.dataset.statsPeakTourIndex)];
                if (!entry) return;

                closeTourListModal();
                openTourDetail(entry, {
                    returnModalId: 'tour-list-modal'
                });
            });
        });

    attachModalSwipeDown(modal, closeTourListModal);
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function initStatsPeaksInteractions() {
    const container = document.getElementById('stats-peaks-content');
    if (!container || container.dataset.delegated === '1') return;

    container.dataset.delegated = '1';

    const activate = target => {
        const item = target.closest('[data-stats-peak-index]');
        if (!item || !container.contains(item)) return false;

        const row = statsPeakRowsCache[
            Number(item.dataset.statsPeakIndex)
        ];

        if (row) {
            openStatsPeakHistory(row);
        }

        return true;
    };

    container.addEventListener('click', event => {
        if (activate(event.target)) return;

        const button = event.target.closest('[data-stats-peak-page]');
        if (!button || button.disabled) return;

        statsPeakPage +=
            button.dataset.statsPeakPage === 'next'
                ? 1
                : -1;

        updatePeakStatsPage();
    });

    container.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        if (event.target.closest('[data-stats-peak-index]')) {
            event.preventDefault();
            activate(event.target);
        }
    });
}

function entryMatchesCompareSeason(entry, season, seasonYear) {
    const date = parseStatsCalendarDate(entry?.date);
    if (!date || !Number.isFinite(seasonYear)) return false;

    const year = date.getFullYear();
    const month = date.getMonth();

    switch (season) {
        case 'winter':
            return (
                (year === seasonYear - 1 && month === 11) ||
                (year === seasonYear && (month === 0 || month === 1))
            );

        case 'spring':
            return year === seasonYear && month >= 2 && month <= 4;

        case 'summer':
            return year === seasonYear && month >= 5 && month <= 7;

        case 'autumn':
            return year === seasonYear && month >= 8 && month <= 10;

        default:
            return false;
    }
}
