/* Premium Alpine Performance Cockpit — Diagrammrenderer für Stats.
   Lädt nach app-main-20261019.js und ersetzt ausschließlich die sichtbaren
   Stats-Diagramm-Zeichner. Datenberechnung und Tourmodal-Ziele bleiben erhalten. */
(() => {
    'use strict';

    const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const MONTH_NAMES = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

    function canvasById(id) {
        return document.getElementById(id);
    }

    function logicalSize(canvas) {
        return {
            width: typeof getCanvasLogicalWidth === 'function'
                ? getCanvasLogicalWidth(canvas) : canvas.clientWidth,
            height: typeof getCanvasLogicalHeight === 'function'
                ? getCanvasLogicalHeight(canvas) : canvas.clientHeight
        };
    }

    function editorFont(size, weight) {
        try {
            if (typeof getThemeEditorCanvasFont === 'function') {
                return getThemeEditorCanvasFont(size, weight);
            }
        } catch (_) {}
        return String(weight || 500) + ' ' + String(size || 12) + 'px sans-serif';
    }

    function chartPalette() {
        let theme = {};
        let settings = {};
        try {
            theme = typeof getChartTheme === 'function' ? getChartTheme() : {};
            if (typeof getThemeEditorSettings === 'function' &&
                typeof themeEditorGetActiveTheme === 'function') {
                settings = getThemeEditorSettings()[themeEditorGetActiveTheme()] || {};
            }
        } catch (_) {}

        const stops = Array.isArray(theme.gradientStops) && theme.gradientStops.length
            ? theme.gradientStops : [[0, '#9B7945'], [0.5, '#D4B36F'], [1, '#F1DDAA']];
        const primary = settings.accent || stops[stops.length - 1][1] || '#D5A64C';
        const secondary = settings.accent2 || '#A9B7C6';
        return {
            text: theme.textColor || '#F3F5F7',
            muted: theme.isDark === false ? 'rgba(34,46,56,.72)' : 'rgba(225,232,239,.68)',
            primary,
            secondary,
            stops,
            dark: theme.isDark !== false
        };
    }

    function colourWithAlpha(colour, alpha) {
        if (typeof colour !== 'string') return 'rgba(213,166,76,' + alpha + ')';
        let hex = colour.trim();
        if (/^#[0-9a-f]{3}$/i.test(hex)) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        if (/^#[0-9a-f]{6}$/i.test(hex)) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        }
        return colour;
    }

    function applyGradient(ctx, x1, y1, x2, y2, stops) {
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        stops.forEach(([position, colour]) => {
            try { gradient.addColorStop(position, colour); } catch (_) {}
        });
        return gradient;
    }

    function roundedPath(ctx, x, y, width, height, radius) {
        const r = Math.max(0, Math.min(radius, width / 2, height / 2));
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawHeader(ctx, canvas, title, total) {
        const size = logicalSize(canvas);
        const palette = chartPalette();
        const width = size.width;
        ctx.save();
        ctx.fillStyle = palette.text;
        ctx.font = editorFont(12, 700);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(title, 24, 25, Math.max(110, width * 0.57));
        ctx.font = editorFont(12, 800);
        ctx.textAlign = 'right';
        ctx.fillStyle = palette.primary;
        ctx.fillText(total || '–', width - 24, 25, Math.max(90, width * 0.38));
        ctx.restore();
    }

    function drawTopographicRelief(ctx, plot, palette) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(plot.left, plot.top, plot.width, plot.height);
        ctx.clip();

        // Organische Höhenlinien mit unregelmäßigen Kuppen und Talformen.
        // Keine konzentrischen Ellipsen und kein zusätzliches horizontales Raster.
        const terrain = [
            { x: 0.74, y: 0.31, phase: 0.55, scaleX: 0.10, scaleY: 0.10, lean: 0.035 },
            { x: 0.27, y: 0.73, phase: 2.15, scaleX: 0.095, scaleY: 0.105, lean: -0.045 }
        ];

        terrain.forEach((landform, groupIndex) => {
            const centerX = plot.left + plot.width * landform.x;
            const centerY = plot.top + plot.height * landform.y;

            for (let level = 0; level < 9; level++) {
                const rx = plot.width * (landform.scaleX + level * 0.032);
                const ry = plot.height * (landform.scaleY + level * 0.043);
                const phase = landform.phase + level * 0.17;

                ctx.beginPath();
                for (let step = 0; step <= 96; step++) {
                    const angle = Math.PI * 2 * step / 96;
                    const shape =
                        1 +
                        Math.sin(angle * 3 + phase) * 0.082 +
                        Math.cos(angle * 5 - phase * 1.35) * 0.048 +
                        Math.sin(angle * 7 + phase * 0.72) * 0.022;
                    const x = centerX +
                        Math.cos(angle) * rx * shape +
                        Math.sin(angle * 2 + phase) * rx * landform.lean;
                    const y = centerY +
                        Math.sin(angle) * ry * shape +
                        Math.cos(angle * 3 - phase) * ry * 0.026;

                    if (step === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();

                const indexContour = level === 0 || level === 4 || level === 8;
                const contourColour = indexContour ? palette.secondary : palette.primary;
                const opacity = indexContour ? 0.13 : 0.065;
                ctx.strokeStyle = colourWithAlpha(contourColour, opacity);
                ctx.lineWidth = indexContour ? 1.05 : 0.68;
                ctx.stroke();
            }
        });

        // Einzelne feine Höhenzüge verbinden die beiden Reliefbereiche dezent.
        ctx.beginPath();
        ctx.moveTo(plot.left + plot.width * 0.39, plot.top + plot.height * 0.08);
        ctx.bezierCurveTo(
            plot.left + plot.width * 0.48, plot.top + plot.height * 0.20,
            plot.left + plot.width * 0.37, plot.top + plot.height * 0.36,
            plot.left + plot.width * 0.49, plot.top + plot.height * 0.48
        );
        ctx.strokeStyle = colourWithAlpha(palette.secondary, 0.055);
        ctx.lineWidth = 0.75;
        ctx.stroke();

        ctx.restore();
    }

    function baseChart(canvas, ctx, title, total) {
        const size = logicalSize(canvas);
        const palette = chartPalette();
        const width = size.width;
        const height = size.height;
        ctx.clearRect(0, 0, width, height);
        drawHeader(ctx, canvas, title, total);
        const plot = {
            left: 43,
            right: width - 24,
            top: 56,
            bottom: height - 39
        };
        plot.width = Math.max(40, plot.right - plot.left);
        plot.height = Math.max(40, plot.bottom - plot.top);
        drawTopographicRelief(ctx, plot, palette);
        return { width, height, plot, palette };
    }

    function yAxisLabel(value, maxValue) {
        if (!Number.isFinite(value)) return '0';
        if (Math.abs(maxValue) >= 100000) {
            return Math.round(value / 1000).toLocaleString('de-AT') + 'k';
        }
        if (Math.abs(maxValue) >= 10000) {
            return Math.round(value / 1000).toLocaleString('de-AT') + 'k';
        }
        if (Math.abs(maxValue) >= 1000) {
            return Math.round(value).toLocaleString('de-AT');
        }
        return (Math.round(value * 10) / 10).toLocaleString('de-AT');
    }

    function drawAxes(ctx, plot, maxValue, palette) {
        ctx.save();
        ctx.font = editorFont(9, 500);
        ctx.fillStyle = palette.muted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
            const ratio = i / 4;
            const y = plot.bottom - plot.height * ratio;
            ctx.beginPath();
            ctx.moveTo(plot.left, y);
            ctx.lineTo(plot.right, y);
            ctx.strokeStyle = i === 0 ? 'rgba(230,238,245,.20)' : 'rgba(230,238,245,.075)';
            ctx.lineWidth = i === 0 ? 1.1 : 0.7;
            ctx.stroke();
            ctx.fillText(yAxisLabel(maxValue * ratio, maxValue), plot.left - 7, y);
        }
        ctx.restore();
    }

    function monthX(index, plot) {
        const step = plot.width / 12;
        return plot.left + step * (index + 0.5);
    }

    function drawMonthLabels(ctx, plot, height, palette) {
        ctx.save();
        ctx.font = editorFont(10, 600);
        ctx.fillStyle = palette.muted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        MONTHS.forEach((month, index) => {
            ctx.fillText(month, monthX(index, plot), height - 16);
        });
        ctx.restore();
    }

    function smoothStroke(ctx, points) {
        if (!points.length) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
    }

    function drawMetalMarker(ctx, x, y, palette, radius) {
        const r = radius || 4.4;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = 7;
        ctx.shadowOffsetY = 2;
        const outer = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, 0, x, y, r * 1.65);
        outer.addColorStop(0, '#FFFFFF');
        outer.addColorStop(0.3, palette.secondary);
        outer.addColorStop(0.66, palette.primary);
        outer.addColorStop(1, 'rgba(16,24,33,.98)');
        ctx.fillStyle = outer;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = applyGradient(ctx, x - r, y - r, x + r, y + r, [
            [0, '#FFFFFF'],
            [0.42, palette.primary],
            [1, palette.secondary]
        ]);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawAverageReference(ctx, plot, value, maxValue, palette) {
        if (!(value > 0)) return;
        const y = plot.bottom - (value / maxValue) * plot.height;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(plot.left, y);
        ctx.lineTo(plot.right, y);
        ctx.strokeStyle = colourWithAlpha(palette.secondary, 0.7);
        ctx.lineWidth = 1.05;
        ctx.setLineDash([4, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    function drawMonthlyProfile(canvas, title, total, values, options) {
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const config = options || {};
        const base = baseChart(canvas, ctx, title, total);
        const plot = base.plot;
        const palette = base.palette;
        const valid = values.filter(value => Number.isFinite(value) && value > 0);
        if (!valid.length) {
            drawMonthLabels(ctx, plot, base.height, palette);
            ctx.save();
            ctx.fillStyle = palette.muted;
            ctx.font = editorFont(12, 600);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Noch keine Werte im gewählten Zeitraum', base.width / 2, plot.top + plot.height / 2);
            ctx.restore();
            return;
        }

        const maxValue = Math.max(1, ...valid) * 1.18;
        drawAxes(ctx, plot, maxValue, palette);
        drawAverageReference(ctx, plot, valid.reduce((sum, value) => sum + value, 0) / valid.length, maxValue, palette);
        const points = values.map((value, index) => ({
            x: monthX(index, plot),
            y: plot.bottom - (Math.max(0, value || 0) / maxValue) * plot.height,
            value: Number(value) || 0,
            index
        })).filter(point => point.value > 0);

        // Monatslücken bleiben echte Lücken: Linien verbinden nur direkt
        // aufeinanderfolgende Monate und erfinden keine Zwischenverläufe.
        const runs = [];
        points.forEach(point => {
            const current = runs[runs.length - 1];
            if (!current || point.index !== current[current.length - 1].index + 1) {
                runs.push([point]);
            } else {
                current.push(point);
            }
        });

        if (config.style === 'lollipop') {
            points.forEach(point => {
                const stem = ctx.createLinearGradient(0, point.y, 0, plot.bottom);
                stem.addColorStop(0, colourWithAlpha(palette.primary, 0.94));
                stem.addColorStop(0.58, colourWithAlpha(palette.secondary, 0.38));
                stem.addColorStop(1, colourWithAlpha(palette.secondary, 0.08));
                ctx.save();
                ctx.strokeStyle = stem;
                ctx.lineWidth = 2.35;
                ctx.beginPath();
                ctx.moveTo(point.x, point.y + 3);
                ctx.lineTo(point.x, plot.bottom);
                ctx.stroke();
                ctx.restore();
            });
        }

        runs.forEach(run => {
            if (run.length < 2) return;

            if (config.style !== 'lollipop' && config.style !== 'line') {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(run[0].x, plot.bottom);
                smoothStroke(ctx, run);
                ctx.lineTo(run[run.length - 1].x, plot.bottom);
                ctx.closePath();
                const area = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
                const areaStrength = config.style === 'average' ? 0.105 : 0.26;
                area.addColorStop(0, colourWithAlpha(palette.primary, areaStrength));
                area.addColorStop(1, colourWithAlpha(palette.primary, 0.012));
                ctx.fillStyle = area;
                ctx.fill();
                ctx.restore();
            }

            ctx.save();
            smoothStroke(ctx, run);
            ctx.strokeStyle = colourWithAlpha(palette.primary,
                config.style === 'line' ? 0.18 : 0.22);
            ctx.lineWidth = config.style === 'lollipop' ? 5
                : config.style === 'line' ? 4
                : config.style === 'average' ? 5.4 : 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.restore();

            const stroke = applyGradient(ctx, plot.left, 0, plot.right, 0, palette.stops);
            ctx.save();
            smoothStroke(ctx, run);
            ctx.strokeStyle = stroke;
            ctx.lineWidth = config.style === 'ridge' ? 3.5
                : config.style === 'lollipop' ? 2.25
                : config.style === 'line' ? 2.3
                : config.style === 'average' ? 2.45 : 2.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = colourWithAlpha(palette.primary, 0.32);
            ctx.shadowBlur = config.style === 'line' ? 5 : 8;
            ctx.stroke();
            ctx.restore();
        });

        points.forEach(point => {
            const markerRadius = config.style === 'ridge' ? 4.8
                : config.style === 'line' ? 3.25
                : config.style === 'average' ? 3.35 : 3.8;
            drawMetalMarker(ctx, point.x, point.y, palette, markerRadius);
        });

        if (config.style === 'ridge') {
            const top = [...points].sort((a, b) => b.value - a.value).slice(0, 3);
            top.forEach(point => {
                ctx.save();
                ctx.translate(point.x, point.y - 11);
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(6, 4);
                ctx.lineTo(-6, 4);
                ctx.closePath();
                ctx.fillStyle = applyGradient(ctx, -6, -5, 6, 5, [
                    [0, '#FFFFFF'], [0.45, palette.primary], [1, palette.secondary]
                ]);
                ctx.shadowColor = 'rgba(0,0,0,.5)';
                ctx.shadowBlur = 5;
                ctx.fill();
                ctx.restore();
            });
        }

        const maximumPoint = points.reduce((best, point) => point.value > best.value ? point : best, points[0]);
        ctx.save();
        ctx.fillStyle = palette.text;
        ctx.font = editorFont(9, 800);
        ctx.textAlign = maximumPoint.x > base.width * 0.78 ? 'right'
            : maximumPoint.x < base.width * 0.22 ? 'left' : 'center';
        const labelX = maximumPoint.x > base.width * 0.78 ? maximumPoint.x - 7
            : maximumPoint.x < base.width * 0.22 ? maximumPoint.x + 7 : maximumPoint.x;
        ctx.fillText(
            config.valueLabel ? config.valueLabel(maximumPoint.value) : Math.round(maximumPoint.value).toLocaleString('de-AT'),
            labelX,
            Math.max(plot.top + 10, maximumPoint.y - 12)
        );
        ctx.restore();
        drawMonthLabels(ctx, plot, base.height, palette);
    }

    function getFilteredTours() {
        return typeof getDiagramFilteredTours === 'function' ? getDiagramFilteredTours() : [];
    }

    function monthOf(entry) {
        if (!entry || !entry.date) return null;
        const date = new Date(entry.date);
        return Number.isNaN(date.getTime()) ? null : date.getMonth();
    }

    function drawStepsDiagram() {
        const data = getFilteredTours();
        const sums = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            sums[month] += Number(calculateEntrySteps(entry)) || 0;
        });
        const total = sums.reduce((sum, value) => sum + value, 0);
        drawMonthlyProfile(canvasById('steps-canvas'), 'Schritte · Monatsverlauf',
            Math.round(total).toLocaleString('de-AT'), sums, {
                style: 'area',
                valueLabel: value => Math.round(value).toLocaleString('de-AT')
            });
    }

    function drawPeaksDiagram() {
        const data = getFilteredTours();
        const sums = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            sums[month] += parseInt(entry.gipfel, 10) || 0;
        });
        const total = sums.reduce((sum, value) => sum + value, 0);
        drawMonthlyProfile(canvasById('peaks-canvas'), 'Gipfel · Monatsprofil',
            total + ' Gipfel', sums, { style: 'ridge' });
    }

    function drawSpeedDiagram() {
        const data = getFilteredTours();
        const distance = Array(12).fill(0);
        const minutes = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            distance[month] += parseFloat(String(entry.strecke || '').replace(',', '.')) || 0;
            if (entry.zeit && String(entry.zeit).includes(':')) {
                const parts = String(entry.zeit).split(':').map(Number);
                if (Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
                    minutes[month] += parts[0] * 60 + parts[1];
                }
            }
        });
        const values = distance.map((value, index) => minutes[index] > 0
            ? value / (minutes[index] / 60) : 0);
        const totalDistance = distance.reduce((sum, value) => sum + value, 0);
        const totalMinutes = minutes.reduce((sum, value) => sum + value, 0);
        const average = totalMinutes > 0 ? totalDistance / (totalMinutes / 60) : 0;
        drawMonthlyProfile(canvasById('speed-canvas'), 'Ø Geschwindigkeit',
            average > 0 ? 'Ø ' + formatDecimalAT(average) + ' km/h' : '–',
            values, { style: 'line', valueLabel: value => formatDecimalAT(value, 1) + ' km/h' });
    }

    function drawGradientDiagram() {
        const data = getFilteredTours();
        const sums = Array(12).fill(0);
        const counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            const ascent = getAdjustedAscent(entry);
            const distance = getAdjustedDistance(entry);
            if (ascent > 0 && distance > 0) {
                sums[month] += ascent / distance;
                counts[month]++;
            }
        });
        const values = sums.map((sum, index) => counts[index] > 0 ? sum / counts[index] : 0);
        const average = typeof getBoundedAverage === 'function'
            ? getBoundedAverage(values.filter(value => value > 0)) || 0
            : values.filter(value => value > 0).reduce((sum, value, _, all) => sum + value / all.length, 0);
        drawMonthlyProfile(canvasById('gradient-canvas'), 'Ø Steigung · hm pro km',
            average > 0 ? 'Ø ' + Math.round(average) + ' hm/km' : '–',
            values, { style: 'lollipop', valueLabel: value => Math.round(value) + ' hm/km' });
    }

    function drawAscentRateDiagram() {
        const data = getFilteredTours();
        const sums = Array(12).fill(0);
        const counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            const ascent = getAdjustedAscent(entry);
            const hours = getAdjustedTimeHours(entry);
            if (ascent > 0 && hours > 0) {
                sums[month] += ascent / hours;
                counts[month]++;
            }
        });
        const values = sums.map((sum, index) => counts[index] > 0 ? sum / counts[index] : 0);
        const average = typeof getBoundedAverage === 'function'
            ? getBoundedAverage(values.filter(value => value > 0)) || 0
            : values.filter(value => value > 0).reduce((sum, value, _, all) => sum + value / all.length, 0);
        drawMonthlyProfile(canvasById('ascent-rate-canvas'), 'Ø Anstieg · Höhenmeter pro Stunde',
            average > 0 ? 'Ø ' + Math.round(average) + ' hm/h' : '–',
            values, { style: 'area', valueLabel: value => Math.round(value) + ' hm/h' });
    }

    function drawAverageStepsDiagram() {
        const data = getFilteredTours();
        const sums = Array(12).fill(0);
        const counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            const steps = Number(calculateEntrySteps(entry)) || 0;
            if (steps <= 0) return;
            sums[month] += steps;
            counts[month]++;
        });
        const values = sums.map((sum, index) => counts[index] > 0 ? sum / counts[index] : 0);
        const average = typeof getBoundedAverage === 'function'
            ? getBoundedAverage(values.filter(value => value > 0)) || 0
            : values.filter(value => value > 0).reduce((sum, value, _, all) => sum + value / all.length, 0);
        drawMonthlyProfile(canvasById('avg-steps-canvas'), 'Ø Schritte pro Tour',
            average > 0 ? Math.round(average).toLocaleString('de-AT') : '–',
            values, { style: 'average', valueLabel: value => Math.round(value).toLocaleString('de-AT') });
    }

    function cellRectangles(width, height) {
        const left = 25;
        const right = width - 25;
        const top = 62;
        const bottom = height - 17;
        const gapX = 8;
        const gapY = 8;
        const cellWidth = (right - left - gapX * 3) / 4;
        const cellHeight = (bottom - top - gapY * 2) / 3;
        return MONTHS.map((_, index) => {
            const column = index % 4;
            const row = Math.floor(index / 4);
            return {
                x: left + column * (cellWidth + gapX),
                y: top + row * (cellHeight + gapY),
                width: cellWidth,
                height: cellHeight
            };
        });
    }

    function drawBigToursDiagram() {
        const canvas = canvasById('big-tours-canvas');
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const size = logicalSize(canvas);
        const palette = chartPalette();
        const data = getFilteredTours();
        const counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month !== null && isBigTourCountable(entry, data)) counts[month]++;
        });
        const total = counts.reduce((sum, value) => sum + value, 0);
        ctx.clearRect(0, 0, size.width, size.height);
        drawHeader(ctx, canvas, 'Big Tours · ≥10 km und ≥1.000 hm', String(total) + ' Touren');
        const cells = cellRectangles(size.width, size.height);
        const maximum = Math.max(1, ...counts);
        cells.forEach((cell, index) => {
            const intensity = counts[index] / maximum;
            roundedPath(ctx, cell.x, cell.y, cell.width, cell.height, 12);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,.42)';
            ctx.shadowBlur = 9;
            ctx.shadowOffsetY = 3;
            const gradient = ctx.createLinearGradient(cell.x, cell.y, cell.x, cell.y + cell.height);
            gradient.addColorStop(0, colourWithAlpha(palette.primary, 0.10 + intensity * 0.42));
            gradient.addColorStop(0.48, colourWithAlpha(palette.primary, 0.06 + intensity * 0.28));
            gradient.addColorStop(1, 'rgba(8,15,23,.74)');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.restore();

            roundedPath(ctx, cell.x, cell.y, cell.width, cell.height, 12);
            ctx.strokeStyle = colourWithAlpha(palette.secondary, 0.20 + intensity * 0.28);
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cell.x + 8, cell.y + 1);
            ctx.lineTo(cell.x + cell.width - 8, cell.y + 1);
            ctx.strokeStyle = 'rgba(255,255,255,.24)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = palette.muted;
            ctx.font = editorFont(10, 700);
            ctx.fillText(MONTH_NAMES[index], cell.x + 9, cell.y + 8, cell.width - 18);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = palette.text;
            ctx.font = editorFont(Math.min(23, Math.max(16, cell.height * 0.34)), 800);
            ctx.fillText(String(counts[index]), cell.x + cell.width / 2, cell.y + cell.height * 0.62);
            ctx.restore();

            if (counts[index] > 0) {
                const barWidth = (cell.width - 18) * intensity;
                roundedPath(ctx, cell.x + 9, cell.y + cell.height - 8, Math.max(2, barWidth), 3, 2);
                ctx.fillStyle = applyGradient(ctx, cell.x + 9, 0, cell.x + cell.width - 9, 0, palette.stops);
                ctx.fill();
            }
        });
    }

    function drawCompassTick(ctx, radius, angle, major, palette) {
        const inner = radius - (major ? 11 : 5);
        const outer = radius - 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.strokeStyle = major ? colourWithAlpha(palette.secondary, 0.88) : 'rgba(231,239,246,.42)';
        ctx.lineWidth = major ? 1.7 : 0.8;
        ctx.stroke();
    }

    function drawPerformanceIndexDiagram() {
        const canvas = canvasById('performance-index-canvas');
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const size = logicalSize(canvas);
        const palette = chartPalette();
        const data = getFilteredTours();
        const sums = Array(12).fill(0);
        const counts = Array(12).fill(0);
        let totalScore = 0;
        let totalCount = 0;

        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            const performance = calculatePerformanceIndex(entry);
            if (!performance || !Number.isFinite(performance.score)) return;
            const score = Math.max(0, Math.min(100, performance.score));
            sums[month] += score;
            counts[month]++;
            totalScore += score;
            totalCount++;
        });

        const monthAverages = sums.map((sum, index) => counts[index] ? sum / counts[index] : 0);
        const overall = totalCount ? totalScore / totalCount : 0;
        ctx.clearRect(0, 0, size.width, size.height);
        drawHeader(ctx, canvas, 'Leistungsindex', totalCount ? Math.round(overall) + ' / 100' : '–');

        const cx = size.width / 2;
        const cy = Math.max(120, Math.min(size.height * 0.49, size.height - 110));
        const radius = Math.min(94, size.width * 0.235, Math.max(42, (size.height - 130) * 0.42));
        const startAngle = Math.PI * 0.75;
        const sweep = Math.PI * 1.5;

        ctx.save();
        ctx.translate(cx, cy);

        // Präzisionsgehäuse mit metallischem Außenring und innerer Glasfläche.
        const outerMetal = ctx.createRadialGradient(-radius * 0.35, -radius * 0.45, radius * 0.12, 0, 0, radius * 1.35);
        outerMetal.addColorStop(0, '#FFF9E8');
        outerMetal.addColorStop(0.24, palette.secondary);
        outerMetal.addColorStop(0.52, '#5A6570');
        outerMetal.addColorStop(0.72, palette.primary);
        outerMetal.addColorStop(1, '#17212B');
        ctx.fillStyle = outerMetal;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
        ctx.fill();

        const innerGlass = ctx.createRadialGradient(-radius * 0.35, -radius * 0.48, 1, 0, 0, radius + 1);
        innerGlass.addColorStop(0, 'rgba(45,61,76,.96)');
        innerGlass.addColorStop(0.6, 'rgba(14,24,35,.98)');
        innerGlass.addColorStop(1, 'rgba(5,11,18,1)');
        ctx.fillStyle = innerGlass;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, radius + 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.58)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 0–100 wird auf dem Instrument abgetragen; Himmelsrichtungen sind nur Kompass-Anmutung.
        for (let tick = 0; tick <= 60; tick++) {
            const angle = startAngle + sweep * tick / 60;
            drawCompassTick(ctx, radius - 3, angle, tick % 5 === 0, palette);
        }

        [0, 25, 50, 75, 100].forEach(value => {
            const angle = startAngle + sweep * value / 100;
            const labelRadius = radius - 22;
            ctx.save();
            ctx.translate(Math.cos(angle) * labelRadius, Math.sin(angle) * labelRadius);
            ctx.fillStyle = palette.text;
            ctx.font = editorFont(9, 700);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(value), 0, 0);
            ctx.restore();
        });

        const directions = [
            ['N', -Math.PI / 2],
            ['O', 0],
            ['S', Math.PI / 2],
            ['W', Math.PI]
        ];
        directions.forEach(([label, angle]) => {
            ctx.save();
            ctx.translate(Math.cos(angle) * (radius + 18), Math.sin(angle) * (radius + 18));
            ctx.fillStyle = label === 'N' ? palette.primary : 'rgba(229,236,243,.82)';
            ctx.font = editorFont(9, 800);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 0);
            ctx.restore();
        });

        if (totalCount) {
            const needleAngle = startAngle + sweep * overall / 100;
            const nx = Math.cos(needleAngle);
            const ny = Math.sin(needleAngle);
            ctx.save();
            ctx.rotate(needleAngle + Math.PI / 2);
            ctx.shadowColor = 'rgba(0,0,0,.7)';
            ctx.shadowBlur = 9;
            ctx.shadowOffsetY = 3;
            ctx.beginPath();
            ctx.moveTo(0, -radius * 0.72);
            ctx.lineTo(radius * 0.105, 2);
            ctx.lineTo(0, radius * 0.19);
            ctx.lineTo(-radius * 0.105, 2);
            ctx.closePath();
            ctx.fillStyle = applyGradient(ctx, -radius * 0.105, -radius * 0.72, radius * 0.105, radius * 0.19, [
                [0, '#FFF9E8'], [0.30, palette.primary], [0.68, palette.secondary], [1, '#53616E']
            ]);
            ctx.fill();

            // Seitliche Facette und Lichtkante erzeugen die sichtbare Metalltiefe.
            ctx.beginPath();
            ctx.moveTo(0, -radius * 0.72);
            ctx.lineTo(0, radius * 0.15);
            ctx.lineTo(-radius * 0.105, 2);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,.25)';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-radius * 0.025, -radius * 0.60);
            ctx.lineTo(-radius * 0.025, -radius * 0.04);
            ctx.strokeStyle = 'rgba(255,255,255,.72)';
            ctx.lineWidth = 0.9;
            ctx.stroke();
            ctx.restore();

            // Gegengewicht und zentrale Lagerkappe.
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fillStyle = applyGradient(ctx, -8, -8, 8, 8, [
                [0, '#FFFFFF'], [0.36, palette.secondary], [1, '#384451']
            ]);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fillStyle = palette.primary;
            ctx.fill();

            ctx.fillStyle = palette.text;
            ctx.font = editorFont(25, 800);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(Math.round(overall)), 0, radius * 0.35);
            ctx.fillStyle = 'rgba(229,236,243,.64)';
            ctx.font = editorFont(8, 700);
            ctx.fillText('LEISTUNGSINDEX', 0, radius * 0.60);
        } else {
            ctx.fillStyle = palette.text;
            ctx.font = editorFont(13, 700);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Noch keine Werte', 0, 0);
        }
        ctx.restore();

        // Monatsverlauf als eigenständige, gut lesbare Instrumentenskala.
        const trendLeft = 34;
        const trendRight = size.width - 34;
        const trendTop = size.height - 49;
        const trendBottom = size.height - 29;
        ctx.save();
        ctx.fillStyle = palette.muted;
        ctx.font = editorFont(8, 700);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('MONATSVERLAUF', trendLeft, trendTop - 8);
        ctx.beginPath();
        ctx.moveTo(trendLeft, trendBottom);
        ctx.lineTo(trendRight, trendBottom);
        ctx.strokeStyle = 'rgba(229,236,243,.18)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const trendPoints = monthAverages.map((value, index) => ({
            x: trendLeft + (trendRight - trendLeft) * index / 11,
            y: trendBottom - (Math.max(0, value) / 100) * (trendBottom - trendTop),
            value,
            index
        })).filter(point => point.value > 0);
        const trendRuns = [];
        trendPoints.forEach(point => {
            const current = trendRuns[trendRuns.length - 1];
            if (!current || point.index !== current[current.length - 1].index + 1) {
                trendRuns.push([point]);
            } else {
                current.push(point);
            }
        });

        trendRuns.forEach(run => {
            if (run.length < 2) return;
            ctx.save();
            smoothStroke(ctx, run);
            ctx.strokeStyle = colourWithAlpha(palette.primary, 0.20);
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.restore();

            ctx.save();
            smoothStroke(ctx, run);
            ctx.strokeStyle = applyGradient(ctx, trendLeft, 0, trendRight, 0, palette.stops);
            ctx.lineWidth = 2.1;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
        });

        trendPoints.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3.0, 0, Math.PI * 2);
            ctx.fillStyle = palette.secondary;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(point.x, point.y, 1.55, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
        });

        ctx.font = editorFont(8, 650);
        ctx.fillStyle = palette.muted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        MONTHS.forEach((month, index) => {
            const monthX = trendLeft + (trendRight - trendLeft) * index / 11;
            ctx.fillText(month, monthX, size.height - 11);
        });
        ctx.restore();
    }

    function enhanceMilestoneMarkers(type) {
        const ids = {
            dist: 'ms-dist-canvas',
            asc: 'ms-asc-canvas',
            time: 'ms-time-canvas',
            peaks: 'ms-peaks-canvas'
        };
        const canvas = canvasById(ids[type]);
        if (!canvas) return;
        const hits = typeof msDotHitTargets !== 'undefined' ? msDotHitTargets[type] : [];
        if (!hits || !hits.length) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const palette = chartPalette();
        ctx.save();
        hits.forEach(hit => {
            ctx.save();
            ctx.shadowColor = colourWithAlpha(palette.primary, 0.8);
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(hit.x, hit.y, 8.8, 0, Math.PI * 2);
            ctx.strokeStyle = applyGradient(ctx, hit.x - 9, hit.y - 9, hit.x + 9, hit.y + 9, [
                [0, '#FFF6DF'], [0.42, palette.secondary], [0.76, palette.primary], [1, '#3E4D5B']
            ]);
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(hit.x - 2.2, hit.y - 2.2, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,.88)';
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }

    const originalMilestoneRenderer = window.drawMilestoneChartView;
    if (typeof originalMilestoneRenderer === 'function') {
        window.drawMilestoneChartView = function (type) {
            originalMilestoneRenderer.apply(this, arguments);
            enhanceMilestoneMarkers(type);
        };
    }

    function hapticEnabled() {
        try {
            return typeof isHapticFeedbackEnabled !== 'function' || isHapticFeedbackEnabled();
        } catch (_) {
            return true;
        }
    }

    function adaptiveHaptic(pattern) {
        if (!hapticEnabled()) return;
        const bridge = window.TourNative;
        if (bridge && typeof bridge.postMessage === 'function') {
            try {
                bridge.postMessage(JSON.stringify({
                    type: 'haptics.trigger',
                    pattern: pattern || 'selection'
                }));
                return;
            } catch (_) {}
        }
        if (typeof hapticFeedback === 'function') {
            hapticFeedback(pattern === 'milestone' ? 18 : 10);
        }
    }

    function installCanvasInteractions() {
        const heatmap = canvasById('big-tours-canvas');
        if (heatmap && heatmap.dataset.premiumHeatmapTap !== 'true') {
            heatmap.dataset.premiumHeatmapTap = 'true';
            heatmap.addEventListener('click', event => {
                if (!heatmap.classList.contains('active-chart-canvas') || !event.isTrusted) return;
                event.stopImmediatePropagation();
                const rect = heatmap.getBoundingClientRect();
                const size = logicalSize(heatmap);
                const x = (event.clientX - rect.left) * size.width / rect.width;
                const y = (event.clientY - rect.top) * size.height / rect.height;
                const cells = cellRectangles(size.width, size.height);
                const index = cells.findIndex(cell =>
                    x >= cell.x && x <= cell.x + cell.width &&
                    y >= cell.y && y <= cell.y + cell.height
                );
                if (index >= 0) {
                    adaptiveHaptic('selection');
                    if (typeof openMonthCategoryModal === 'function') {
                        openMonthCategoryModal('bigTours', index);
                    }
                }
            }, true);
        }

        const compass = canvasById('performance-index-canvas');
        if (compass && compass.dataset.premiumCompassTap !== 'true') {
            compass.dataset.premiumCompassTap = 'true';
            compass.addEventListener('click', event => {
                if (!compass.classList.contains('active-chart-canvas') || !event.isTrusted) return;
                event.stopImmediatePropagation();
                const rect = compass.getBoundingClientRect();
                const size = logicalSize(compass);
                const x = (event.clientX - rect.left) * size.width / rect.width;
                const y = (event.clientY - rect.top) * size.height / rect.height;
                if (y < size.height - 49 || y > size.height - 26 || x < 24 || x > size.width - 24) return;
                const monthIndex = Math.max(0, Math.min(11,
                    Math.round((x - 34) / Math.max(1, size.width - 68) * 11)));
                adaptiveHaptic('selection');
                if (typeof openMonthCategoryModal === 'function') {
                    openMonthCategoryModal('performanceIndex', monthIndex);
                }
            }, true);
        }

        const monthlyCategories = {
            'steps-canvas': 'steps',
            'peaks-canvas': 'peaks',
            'speed-canvas': 'speed',
            'gradient-canvas': 'gradient',
            'ascent-rate-canvas': 'ascentRate',
            'avg-steps-canvas': 'avgSteps'
        };
        Object.entries(monthlyCategories).forEach(([id, category]) => {
            const canvas = canvasById(id);
            if (!canvas || canvas.dataset.premiumChartMonthTap === 'true') return;
            canvas.dataset.premiumChartMonthTap = 'true';
            canvas.addEventListener('click', event => {
                if (!canvas.classList.contains('active-chart-canvas')) return;
                event.stopImmediatePropagation();
                if (!event.isTrusted) return;
                const rect = canvas.getBoundingClientRect();
                const width = logicalSize(canvas).width;
                const x = (event.clientX - rect.left) * width / rect.width;
                const padding = typeof getChartHorizontalPadding === 'function'
                    ? getChartHorizontalPadding() : 40;
                const plotWidth = Math.max(1, width - padding * 2);
                const monthIndex = Math.floor((x - padding) / plotWidth * 12);
                if (monthIndex < 0 || monthIndex > 11) return;
                adaptiveHaptic('selection');
                if (typeof openMonthCategoryModal === 'function') {
                    openMonthCategoryModal(category, monthIndex);
                }
            }, true);
        });
    }

    const originalInitCanvasBarClicks = window.initCanvasBarClicks;
    if (typeof originalInitCanvasBarClicks === 'function') {
        window.initCanvasBarClicks = function () {
            originalInitCanvasBarClicks.apply(this, arguments);
            installCanvasInteractions();
        };
    }

    const originalInitMilestoneCanvasClicks = window.initMilestoneCanvasClicks;
    if (typeof originalInitMilestoneCanvasClicks === 'function') {
        window.initMilestoneCanvasClicks = function () {
            originalInitMilestoneCanvasClicks.apply(this, arguments);
            ['dist', 'asc', 'time', 'peaks'].forEach(type => {
                const ids = {
                    dist: 'ms-dist-canvas',
                    asc: 'ms-asc-canvas',
                    time: 'ms-time-canvas',
                    peaks: 'ms-peaks-canvas'
                };
                const canvas = canvasById(ids[type]);
                if (!canvas || canvas.dataset.premiumMilestoneHaptic === 'true') return;
                canvas.dataset.premiumMilestoneHaptic = 'true';
                canvas.addEventListener('click', event => {
                    if (!canvas.classList.contains('active-chart-canvas') || !event.isTrusted) return;
                    const rect = canvas.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;
                    const hits = typeof msDotHitTargets !== 'undefined' ? msDotHitTargets[type] : [];
                    const nearMarker = (hits || []).some(hit => Math.hypot(x - hit.x, y - hit.y) <= 20);
                    if (nearMarker) adaptiveHaptic('milestone');
                }, true);
            });
        };
    }

    window.drawStepsDiagram = drawStepsDiagram;
    window.drawPeaksDiagram = drawPeaksDiagram;
    window.drawSpeedDiagram = drawSpeedDiagram;
    window.drawGradientDiagram = drawGradientDiagram;
    window.drawAscentRateDiagram = drawAscentRateDiagram;
    window.drawBigToursDiagram = drawBigToursDiagram;
    window.drawPerformanceIndexDiagram = drawPerformanceIndexDiagram;
    window.drawAverageStepsDiagram = drawAverageStepsDiagram;

    // Falls die Stats-Ansicht bereits offen ist, wird der aktive Chart nachgezogen.
    function refreshVisibleStatsChart() {
        const page = document.getElementById('stats-diagrams-page');
        if (!page || !page.classList.contains('active')) return;
        if (typeof drawActiveChart === 'function') {
            requestAnimationFrame(() => {
                try { drawActiveChart(); } catch (error) {
                    console.warn('[Stats Premium] Diagramm konnte nicht neu gezeichnet werden.', error);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            installCanvasInteractions();
            refreshVisibleStatsChart();
        }, { once: true });
    } else {
        installCanvasInteractions();
        refreshVisibleStatsChart();
    }
})();
