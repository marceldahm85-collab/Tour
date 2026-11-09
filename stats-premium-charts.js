/* Premium Alpine Performance Cockpit — Diagrammrenderer für Stats.
   Lädt nach app-main-20261019.js und ersetzt ausschließlich die sichtbaren
   Stats-Diagramm-Zeichner. Datenberechnung und Tourmodal-Ziele bleiben erhalten. */
(() => {
    'use strict';

    const MONTHS = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
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
        let theme = {}, settings = {};
        try {
            theme = typeof getChartTheme === 'function' ? getChartTheme() : {};
            if (typeof getThemeEditorSettings === 'function' && typeof themeEditorGetActiveTheme === 'function') {
                settings = getThemeEditorSettings()[themeEditorGetActiveTheme()] || {};
            }
        } catch (_) {}
        const stops = Array.isArray(theme.gradientStops) && theme.gradientStops.length
            ? theme.gradientStops : [[0, '#9B7945'], [.5, '#D4B36F'], [1, '#F1DDAA']];
        return {
            text: theme.textColor || '#F3F5F7',
            muted: theme.isDark === false ? 'rgba(34,46,56,.78)' : 'rgba(225,232,239,.72)',
            primary: settings.accent || stops[stops.length - 1][1],
            secondary: settings.accent2 || stops[Math.min(1, stops.length - 1)][1] || '#A9B7C6',
            stops,
            dark: theme.isDark !== false,
            direction: settings.gradientDirection || '180deg',
            transition: Number(settings.transition) || 55,
            glassOpacity: Number(settings.glassOpacity) || 68,
            radius: Number(settings.radius) || 14
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

    const selectedMonths = {
        bigTours: null, steps: null, peaks: null, performanceIndex: null,
        speed: null, gradient: null, ascentRate: null, avgSteps: null
    };
    const animatedGaugeValues = { performanceIndex: null, speed: null };
    const gaugeAnimationFrames = { performanceIndex: null, speed: null };

    function activeMonthValue(values, month) {
        return month !== null && month >= 0 && month < 12 ? (Number(values[month]) || 0) : null;
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

    function drawHeader(ctx, canvas, title, total, subtitle) {
        const width = logicalSize(canvas).width;
        const palette = chartPalette();
        ctx.save();
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        ctx.fillStyle = palette.text;
        ctx.font = editorFont(12, 800);
        ctx.fillText(title, 22, 25, Math.max(120, width * .62));
        ctx.textAlign = 'right';
        ctx.fillStyle = palette.primary;
        ctx.font = editorFont(12, 800);
        ctx.fillText(total || '–', width - 22, 25, Math.max(75, width * .30));
        if (subtitle) {
            ctx.textAlign = 'left';
            ctx.fillStyle = palette.muted;
            ctx.font = editorFont(8, 650);
            ctx.fillText(subtitle, 22, 39, width - 44);
        }
        ctx.restore();
    }

    function drawTopographicRelief(ctx, plot, palette, strength) {
        const alpha = Number.isFinite(strength) ? strength : 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(plot.left, plot.top, plot.width, plot.height);
        ctx.clip();
        const terrain = [
            { x: .72, y: .36, phase: .48, sx: .075, sy: .12, lean: .035 },
            { x: .23, y: .74, phase: 2.12, sx: .065, sy: .10, lean: -.04 }
        ];
        terrain.forEach(landform => {
            const cx = plot.left + plot.width * landform.x;
            const cy = plot.top + plot.height * landform.y;
            for (let ring = 0; ring < 8; ring++) {
                const rx = plot.width * (landform.sx + ring * .025);
                const ry = plot.height * (landform.sy + ring * .038);
                const phase = landform.phase + ring * .21;
                ctx.beginPath();
                for (let i = 0; i <= 100; i++) {
                    const a = i / 100 * Math.PI * 2;
                    const shape = 1 + Math.sin(a * 3 + phase) * .09 +
                        Math.cos(a * 5 - phase) * .05 + Math.sin(a * 7 + phase) * .025;
                    const x = cx + Math.cos(a) * rx * shape + Math.sin(a * 2 + phase) * rx * landform.lean;
                    const y = cy + Math.sin(a) * ry * shape + Math.cos(a * 3 - phase) * ry * .035;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                const index = ring === 0 || ring === 4 || ring === 7;
                ctx.strokeStyle = colourWithAlpha(index ? palette.secondary : palette.primary,
                    (index ? .16 : .075) * alpha);
                ctx.lineWidth = index ? 1.05 : .65;
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    function drawInstrumentSurface(ctx, width, height, palette) {
        const inset = 8, y = 7, h = height - 14;
        roundedPath(ctx, inset, y, width - inset * 2, h, Math.max(5, palette.radius - 3));
        const bg = ctx.createLinearGradient(8, 8, width - 8, height - 8);
        bg.addColorStop(0, 'rgba(38,52,66,.94)');
        bg.addColorStop(.46, 'rgba(13,22,32,.97)');
        bg.addColorStop(1, 'rgba(5,11,18,.98)');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = 'rgba(220,231,241,.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.save();
        roundedPath(ctx, inset + 1, y + 1, width - inset * 2 - 2, h - 2, Math.max(5, palette.radius - 4));
        ctx.clip();
        const sheen = ctx.createLinearGradient(0, y, 0, y + 76);
        sheen.addColorStop(0, 'rgba(255,255,255,.075)');
        sheen.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(inset, y, width - inset * 2, 76);
        ctx.restore();
    }

    function baseChart(canvas, ctx, title, total, options) {
        const size = logicalSize(canvas), palette = chartPalette();
        ctx.clearRect(0, 0, size.width, size.height);
        drawInstrumentSurface(ctx, size.width, size.height, palette);
        drawHeader(ctx, canvas, title, total, options && options.subtitle);
        const plot = {
            left: 44, right: size.width - 18,
            top: options && options.subtitle ? 68 : 53,
            bottom: size.height - 42
        };
        plot.width = Math.max(40, plot.right - plot.left);
        plot.height = Math.max(40, plot.bottom - plot.top);
        drawTopographicRelief(ctx, plot, palette, options && options.reliefStrength);
        return { width: size.width, height: size.height, plot, palette };
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

    function drawAxes(ctx, plot, maxValue, palette, unit) {
        ctx.save();
        ctx.font = editorFont(8.5, 550);
        ctx.fillStyle = palette.muted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
            const ratio = i / 4;
            const y = plot.bottom - plot.height * ratio;
            ctx.beginPath();
            ctx.moveTo(plot.left, y);
            ctx.lineTo(plot.right, y);
            ctx.strokeStyle = i === 0 ? 'rgba(230,238,245,.25)' : 'rgba(230,238,245,.075)';
            ctx.lineWidth = i === 0 ? 1.05 : .65;
            ctx.stroke();
            const label = yAxisLabel(maxValue * ratio, maxValue);
            ctx.fillText(unit ? label + ' ' + unit : label, plot.left - 6, y);
        }
        ctx.restore();
    }

    function monthX(index, plot) {
        return plot.left + (plot.width / 12) * (index + .5);
    }

    function drawMonthLabels(ctx, plot, height, palette) {
        ctx.save();
        ctx.font = editorFont(8.5, 650);
        ctx.fillStyle = palette.muted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        MONTHS.forEach((month, index) => ctx.fillText(month, monthX(index, plot), height - 14));
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
        const base = baseChart(canvas, ctx, title, total, { reliefStrength: config.style === 'area' ? .95 : .45 });
        const { plot, palette, height, width } = base;
        const valid = values.filter(value => Number.isFinite(value) && value > 0);
        const maxValue = Math.max(1, ...valid) * 1.16;
        drawAxes(ctx, plot, maxValue, palette, config.axisUnit || '');

        const points = values.map((value, index) => ({
            x: monthX(index, plot),
            y: plot.bottom - (Math.max(0, Number(value) || 0) / maxValue) * plot.height,
            value: Number(value) || 0, index
        }));
        const visible = config.showZeroMonths ? points : points.filter(point => point.value > 0);

        if (!valid.length) {
            drawMonthLabels(ctx, plot, height, palette);
            ctx.save();
            ctx.fillStyle = palette.muted;
            ctx.font = editorFont(11, 600);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Noch keine Werte im gewählten Zeitraum', width / 2, plot.top + plot.height / 2);
            ctx.restore();
            canvas.__premiumChartData = { values, unit: config.unit || '', formatter: config.valueLabel, key: config.selectionKey };
            return;
        }

        if (config.style === 'lollipop') {
            points.forEach(point => {
                if (point.value <= 0) return;
                const stem = ctx.createLinearGradient(0, point.y, 0, plot.bottom);
                stem.addColorStop(0, colourWithAlpha(palette.primary, .95));
                stem.addColorStop(.65, colourWithAlpha(palette.secondary, .28));
                stem.addColorStop(1, colourWithAlpha(palette.secondary, .05));
                ctx.beginPath();
                ctx.moveTo(point.x, point.y + 4);
                ctx.lineTo(point.x, plot.bottom);
                ctx.strokeStyle = stem;
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        } else if (visible.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(visible[0].x, plot.bottom);
            smoothStroke(ctx, visible);
            ctx.lineTo(visible[visible.length - 1].x, plot.bottom);
            ctx.closePath();
            const area = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
            area.addColorStop(0, colourWithAlpha(palette.primary, .28));
            area.addColorStop(1, colourWithAlpha(palette.primary, .012));
            ctx.fillStyle = area;
            ctx.fill();
            ctx.restore();

            ctx.save();
            smoothStroke(ctx, visible);
            ctx.strokeStyle = colourWithAlpha(palette.primary, .20);
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
            ctx.save();
            smoothStroke(ctx, visible);
            ctx.strokeStyle = applyGradient(ctx, plot.left, 0, plot.right, 0, palette.stops);
            ctx.lineWidth = 2.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.shadowColor = colourWithAlpha(palette.primary, .32);
            ctx.shadowBlur = 7;
            ctx.stroke();
            ctx.restore();
        }

        visible.forEach(point => {
            if (config.style === 'lollipop') {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4.3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(7,14,22,.98)';
                ctx.fill();
                drawMetalMarker(ctx, point.x, point.y, palette, 3.1);
            } else if (point.value > 0) {
                drawMetalMarker(ctx, point.x, point.y, palette, 4);
                if (config.style === 'area') {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fill();
                }
            } else {
                ctx.beginPath();
                ctx.arc(point.x, point.y, 2.2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(225,235,245,.26)';
                ctx.fill();
            }
        });

        const selected = selectedMonths[config.selectionKey || ''];
        if (selected !== null && selected !== undefined && points[selected]) {
            const p = points[selected];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8.2, 0, Math.PI * 2);
            ctx.strokeStyle = palette.primary;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = palette.primary;
            ctx.shadowBlur = 8;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        const maximumPoint = points.reduce((best, point) => point.value > best.value ? point : best, points[0]);
        if (maximumPoint && maximumPoint.value > 0) {
            ctx.save();
            ctx.fillStyle = palette.text;
            ctx.font = editorFont(8.5, 800);
            ctx.textAlign = maximumPoint.x > width * .78 ? 'right' : maximumPoint.x < width * .22 ? 'left' : 'center';
            const x = maximumPoint.x > width * .78 ? maximumPoint.x - 5 : maximumPoint.x < width * .22 ? maximumPoint.x + 5 : maximumPoint.x;
            ctx.fillText(config.valueLabel ? config.valueLabel(maximumPoint.value) : Math.round(maximumPoint.value).toLocaleString('de-AT'),
                x, Math.max(plot.top + 10, maximumPoint.y - 12));
            ctx.restore();
        }
        drawMonthLabels(ctx, plot, height, palette);
        canvas.__premiumChartData = { values, unit: config.unit || '', formatter: config.valueLabel, key: config.selectionKey };
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
            if (month !== null) sums[month] += Number(calculateEntrySteps(entry)) || 0;
        });
        const total = sums.reduce((sum, value) => sum + value, 0);
        drawMonthlyProfile(canvasById('steps-canvas'), 'Schritte · Monatssumme',
            Math.round(total).toLocaleString('de-AT'), sums, {
                style: 'area', showZeroMonths: true, selectionKey: 'steps',
                unit: 'Schritte', valueLabel: value => Math.round(value).toLocaleString('de-AT') + ' Schritte'
            });
    }

    function drawPeaksDiagram() {
        const canvas = canvasById('peaks-canvas');
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const base = baseChart(canvas, ctx, 'Gipfel · Alpine Gipfellinie', '', { reliefStrength: .3 });
        const { width, height, plot, palette } = base;
        const data = getFilteredTours();
        const counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month !== null) counts[month] += parseInt(entry.gipfel, 10) || 0;
        });
        const max = Math.max(1, ...counts);
        const segment = plot.width / 12;
        const baseline = plot.bottom - 8;
        ctx.beginPath();
        ctx.moveTo(plot.left, baseline);
        ctx.lineTo(plot.right, baseline);
        ctx.strokeStyle = 'rgba(224,235,244,.24)';
        ctx.lineWidth = 1;
        ctx.stroke();

        counts.forEach((count, index) => {
            const x0 = plot.left + index * segment, cx = x0 + segment * .5;
            const h = count > 0 ? 20 + (count / max) * plot.height * .58 : 7;
            const top = baseline - h;
            const shoulderL = x0 + segment * .10, shoulderR = x0 + segment * .90;
            const sideY = baseline - h * (.43 + ((index * 7) % 4) * .055);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x0 + segment * .03, baseline);
            ctx.lineTo(shoulderL, sideY);
            ctx.lineTo(cx - segment * .12, top + h * .17);
            ctx.lineTo(cx, top);
            ctx.lineTo(cx + segment * .16, top + h * .22);
            ctx.lineTo(shoulderR, sideY);
            ctx.lineTo(x0 + segment * .97, baseline);
            ctx.closePath();
            const mountain = ctx.createLinearGradient(0, top, 0, baseline);
            mountain.addColorStop(0, colourWithAlpha(palette.primary, .78));
            mountain.addColorStop(.5, colourWithAlpha(palette.secondary, .25));
            mountain.addColorStop(1, 'rgba(8,15,24,.12)');
            ctx.fillStyle = mountain;
            ctx.fill();
            ctx.strokeStyle = colourWithAlpha(palette.secondary, .62);
            ctx.lineWidth = .9;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - segment * .12, top + h * .17);
            ctx.lineTo(cx, top);
            ctx.lineTo(cx + segment * .16, top + h * .22);
            ctx.lineTo(cx + segment * .035, top + h * .15);
            ctx.closePath();
            ctx.fillStyle = 'rgba(245,249,252,.43)';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(cx, top);
            ctx.lineTo(cx + segment * .16, top + h * .22);
            ctx.lineTo(shoulderR, sideY);
            ctx.lineTo(cx + segment * .05, baseline - h * .22);
            ctx.closePath();
            ctx.fillStyle = colourWithAlpha(palette.secondary, .15);
            ctx.fill();

            const markerY = top - 6;
            drawMetalMarker(ctx, cx, markerY, palette, 4);
            ctx.fillStyle = palette.text;
            ctx.font = editorFont(8, 850);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(String(count), cx, markerY - 6, segment + 2);
            if (selectedMonths.peaks === index) {
                ctx.beginPath();
                ctx.arc(cx, markerY, 8, 0, Math.PI * 2);
                ctx.strokeStyle = palette.primary;
                ctx.lineWidth = 1.4;
                ctx.shadowColor = palette.primary;
                ctx.shadowBlur = 8;
                ctx.stroke();
            }
            ctx.restore();
        });
        drawMonthLabels(ctx, plot, height, palette);
        canvas.__premiumChartData = { values: counts, unit: 'Gipfel', key: 'peaks',
            formatter: value => Math.round(value) + ' Gipfel' };
    }

    function drawSpeedDiagram() {
        const data = getFilteredTours();
        const distance = Array(12).fill(0), minutes = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            distance[month] += parseFloat(String(entry.strecke || '').replace(',', '.')) || 0;
            if (entry.zeit && String(entry.zeit).includes(':')) {
                const parts = String(entry.zeit).split(':').map(Number);
                if (Number.isFinite(parts[0]) && Number.isFinite(parts[1])) minutes[month] += parts[0] * 60 + parts[1];
            }
        });
        const values = distance.map((value, index) => minutes[index] > 0 ? value / (minutes[index] / 60) : 0);
        const totalDistance = distance.reduce((sum, value) => sum + value, 0);
        const totalMinutes = minutes.reduce((sum, value) => sum + value, 0);
        const overall = totalMinutes > 0 ? totalDistance / (totalMinutes / 60) : 0;
        drawSpeedometer(canvasById('speed-canvas'), values, overall);
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
            values, { style: 'lollipop', axisUnit: 'hm/km', unit: 'hm/km', selectionKey: 'gradient', valueLabel: value => Math.round(value) + ' hm/km' });
    }

    function drawAscentRateDiagram() {
        const data = getFilteredTours();
        const sums = Array(12).fill(0), counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            const ascent = getAdjustedAscent(entry), hours = getAdjustedTimeHours(entry);
            if (ascent > 0 && hours > 0) { sums[month] += ascent / hours; counts[month]++; }
        });
        const values = sums.map((sum, index) => counts[index] ? sum / counts[index] : 0);
        const valid = values.filter(value => value > 0);
        const average = typeof getBoundedAverage === 'function' ? getBoundedAverage(valid) || 0 :
            (valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0);
        const canvas = canvasById('ascent-rate-canvas');
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const base = baseChart(canvas, ctx, 'Aufstiegsgeschwindigkeit · Höhenmesser',
            average > 0 ? 'Ø ' + Math.round(average) + ' hm/h' : '–', { reliefStrength: .2 });
        const { plot, palette, height } = base;
        const max = Math.max(100, ...valid) * 1.18;
        drawAxes(ctx, plot, max, palette, 'hm/h');

        for (let i = 0; i <= 6; i++) {
            const y = plot.bottom - plot.height * i / 6;
            ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.right, y);
            ctx.strokeStyle = i === 0 ? 'rgba(226,237,246,.24)' : 'rgba(226,237,246,.045)';
            ctx.lineWidth = .6; ctx.stroke();
        }
        values.forEach((value, index) => {
            const x = monthX(index, plot), y = plot.bottom - value / max * plot.height;
            if (value > 0) {
                const trace = ctx.createLinearGradient(0, y, 0, plot.bottom);
                trace.addColorStop(0, colourWithAlpha(palette.primary, .96));
                trace.addColorStop(.5, colourWithAlpha(palette.secondary, .26));
                trace.addColorStop(1, 'rgba(229,238,246,.04)');
                ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, plot.bottom);
                ctx.strokeStyle = trace; ctx.lineWidth = 2.2; ctx.stroke();
                ctx.beginPath(); ctx.arc(x, y, 6.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(6,13,21,.96)'; ctx.fill();
                drawMetalMarker(ctx, x, y, palette, 3.4);
                ctx.fillStyle = palette.text; ctx.font = editorFont(8, 750);
                ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText(String(Math.round(value)), x, y - 9, 29);
            } else {
                ctx.beginPath(); ctx.arc(x, plot.bottom, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(225,235,245,.24)'; ctx.fill();
            }
            if (selectedMonths.ascentRate === index && value > 0) {
                ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
                ctx.strokeStyle = palette.primary; ctx.lineWidth = 1.5;
                ctx.shadowColor = palette.primary; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
            }
        });
        drawMonthLabels(ctx, plot, height, palette);
        canvas.__premiumChartData = { values, unit: 'hm/h', key: 'ascentRate',
            formatter: value => Math.round(value) + ' hm/h' };
    }

    function drawAverageStepsDiagram() {
        const data = getFilteredTours();
        const sums = Array(12).fill(0), counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month === null) return;
            const steps = Number(calculateEntrySteps(entry)) || 0;
            if (steps > 0) { sums[month] += steps; counts[month]++; }
        });
        const values = sums.map((sum, index) => counts[index] ? sum / counts[index] : 0);
        const valid = values.filter(value => value > 0);
        const average = typeof getBoundedAverage === 'function' ? getBoundedAverage(valid) || 0 :
            (valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0);
        const canvas = canvasById('avg-steps-canvas');
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const base = baseChart(canvas, ctx, 'Durchschnittliche Schritte · je Tour',
            average > 0 ? Math.round(average).toLocaleString('de-AT') : '–', { reliefStrength: .3 });
        const { width, height, palette } = base;
        const max = Math.max(1, ...valid), left = 14, cols = 6, cellW = (width - 28) / cols;
        const rowY = [height * .39, height * .74];

        values.forEach((value, index) => {
            const row = Math.floor(index / cols), col = index % cols;
            const cx = left + cellW * (col + .5), cy = rowY[row];
            const ratio = value > 0 ? value / max : 0;
            const radius = 12 + ratio * 6.5;
            ctx.save();
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = palette.muted; ctx.font = editorFont(8, 700);
            ctx.fillText(MONTHS[index], cx, cy - 28);

            const glass = ctx.createRadialGradient(cx - radius * .35, cy - radius * .45, 1, cx, cy, radius * 1.35);
            glass.addColorStop(0, 'rgba(255,255,255,' + (.20 + ratio * .14) + ')');
            glass.addColorStop(.28, colourWithAlpha(palette.primary, .22 + ratio * .48));
            glass.addColorStop(.72, colourWithAlpha(palette.secondary, .10 + ratio * .24));
            glass.addColorStop(1, 'rgba(4,10,17,.98)');
            ctx.shadowColor = colourWithAlpha(palette.primary, .18 + ratio * .22);
            ctx.shadowBlur = 7 + ratio * 5;
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = glass; ctx.fill(); ctx.shadowBlur = 0;
            ctx.strokeStyle = colourWithAlpha(palette.secondary, .3 + ratio * .36);
            ctx.lineWidth = 1; ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx - radius * .22, cy - radius * .25, radius * .62, Math.PI * 1.12, Math.PI * 1.78);
            ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 1.2; ctx.stroke();

            ctx.fillStyle = palette.text; ctx.font = editorFont(7.5, 800);
            ctx.fillText(value > 0 ? Math.round(value).toLocaleString('de-AT') : '–',
                cx, cy + radius + 13, cellW - 2);
            if (selectedMonths.avgSteps === index) {
                ctx.beginPath(); ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = palette.primary; ctx.lineWidth = 1.5;
                ctx.shadowColor = palette.primary; ctx.shadowBlur = 8; ctx.stroke();
            }
            ctx.restore();
        });
        canvas.__premiumChartData = { values, unit: 'Schritte/Tour', key: 'avgSteps',
            formatter: value => Math.round(value).toLocaleString('de-AT') + ' Schritte/Tour' };
    }

    function drawBigToursDiagram() {
        const canvas = canvasById('big-tours-canvas');
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const data = getFilteredTours(), counts = Array(12).fill(0);
        data.forEach(entry => {
            const month = monthOf(entry);
            if (month !== null && isBigTourCountable(entry, data)) counts[month]++;
        });
        const total = counts.reduce((sum, value) => sum + value, 0);
        const base = baseChart(canvas, ctx, 'Große Touren · Alpine Kristallsäulen', total + ' Touren', {
            subtitle: 'Definition: mindestens 10 km und mindestens 1.000 Höhenmeter',
            reliefStrength: .18
        });
        const { height, plot, palette } = base;
        const max = Math.max(1, ...counts), step = plot.width / 12, baseline = plot.bottom - 5;

        ctx.beginPath(); ctx.moveTo(plot.left, baseline); ctx.lineTo(plot.right, baseline);
        ctx.strokeStyle = 'rgba(225,236,245,.28)'; ctx.lineWidth = 1.1; ctx.stroke();

        counts.forEach((count, index) => {
            const center = monthX(index, plot), w = Math.min(17, step * .72);
            const h = count > 0 ? Math.max(11, count / max * plot.height * .72) : 3;
            const top = baseline - h, half = w / 2, cut = Math.min(4, w * .22);
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(center - half + cut, top);
            ctx.lineTo(center + half - cut, top);
            ctx.lineTo(center + half, top + cut);
            ctx.lineTo(center + half, baseline - cut);
            ctx.lineTo(center, baseline);
            ctx.lineTo(center - half, baseline - cut);
            ctx.lineTo(center - half, top + cut);
            ctx.closePath();
            const body = ctx.createLinearGradient(center - half, top, center + half, baseline);
            body.addColorStop(0, '#F4F8FB');
            body.addColorStop(.18, palette.secondary);
            body.addColorStop(.48, palette.primary);
            body.addColorStop(.78, colourWithAlpha(palette.primary, .70));
            body.addColorStop(1, '#101A25');
            ctx.fillStyle = body;
            ctx.shadowColor = colourWithAlpha(palette.primary, .30); ctx.shadowBlur = 8;
            ctx.fill(); ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(245,249,252,.66)'; ctx.lineWidth = .8; ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(center - half + cut + 1, top + 1);
            ctx.lineTo(center, top + Math.min(h * .32, 14));
            ctx.lineTo(center, baseline - 1);
            ctx.lineTo(center - half + 1, baseline - cut);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,.19)'; ctx.fill();

            ctx.beginPath();
            ctx.moveTo(center + half - cut, top + 1);
            ctx.lineTo(center + half - 1, top + cut);
            ctx.lineTo(center + half - 1, baseline - cut);
            ctx.lineTo(center, baseline - 1);
            ctx.lineTo(center, top + Math.min(h * .32, 14));
            ctx.closePath();
            ctx.fillStyle = 'rgba(3,9,16,.30)'; ctx.fill();

            ctx.beginPath();
            ctx.moveTo(center - half + cut + 1, top + 2);
            ctx.lineTo(center - 1, top + Math.min(h * .32, 14));
            ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = .8; ctx.stroke();

            ctx.fillStyle = palette.text; ctx.font = editorFont(8, 850);
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(String(count), center, top - 5, step + 2);
            if (selectedMonths.bigTours === index) {
                ctx.beginPath(); ctx.ellipse(center, baseline - h / 2, half + 4, h / 2 + 5, 0, 0, Math.PI * 2);
                ctx.strokeStyle = palette.primary; ctx.lineWidth = 1.25;
                ctx.shadowColor = palette.primary; ctx.shadowBlur = 8; ctx.stroke();
            }
            ctx.restore();
        });
        drawMonthLabels(ctx, plot, height, palette);
        canvas.__premiumChartData = { values: counts, unit: 'große Touren', key: 'bigTours',
            formatter: value => value + ' große Touren' };
    }

    function drawGaugeNeedle(ctx, cx, cy, radius, angle, palette, redGold) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.shadowColor = 'rgba(0,0,0,.72)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        ctx.beginPath();
        ctx.moveTo(0, -radius * .76);
        ctx.lineTo(radius * .075, 4);
        ctx.lineTo(0, radius * .20);
        ctx.lineTo(-radius * .075, 4);
        ctx.closePath();
        const needle = redGold
            ? [[0, '#FFF4DA'], [.20, '#E8B85D'], [.46, '#C93635'], [.74, '#781F27'], [1, '#E5B75D']]
            : [[0, '#FFF4DA'], [.32, palette.primary], [.68, palette.secondary], [1, '#344452']];
        ctx.fillStyle = applyGradient(ctx, -radius * .08, -radius * .76, radius * .08, radius * .20, needle);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(0, -radius * .72);
        ctx.lineTo(0, radius * .14);
        ctx.lineTo(-radius * .075, 4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,.25)';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-radius * .018, -radius * .60);
        ctx.lineTo(-radius * .018, -radius * .04);
        ctx.strokeStyle = 'rgba(255,255,255,.76)';
        ctx.lineWidth = .8;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fillStyle = applyGradient(ctx, cx - 8, cy - 8, cx + 8, cy + 8,
            [[0, '#FFFFFF'], [.36, palette.secondary], [.72, palette.primary], [1, '#25313C']]);
        ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = redGold ? '#C83D37' : palette.primary; ctx.fill();
    }

    function drawTrendStrip(ctx, canvas, values, palette, selectedMonth) {
        const size = logicalSize(canvas), left = 28, right = size.width - 28;
        const top = size.height - 66, bottom = size.height - 35;
        const max = Math.max(1, ...values.filter(value => value > 0)) * 1.08;
        ctx.save();
        ctx.fillStyle = palette.muted; ctx.font = editorFont(7.5, 750);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText('MONATSENTWICKLUNG', left, top - 8);
        ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom);
        ctx.strokeStyle = 'rgba(225,236,245,.22)'; ctx.lineWidth = 1; ctx.stroke();

        const points = values.map((value, index) => ({
            x: left + (right - left) * index / 11,
            y: bottom - (value > 0 ? value / max : 0) * (bottom - top),
            value, index
        }));
        const groups = [];
        points.filter(point => point.value > 0).forEach(point => {
            const current = groups[groups.length - 1];
            if (!current || point.index !== current[current.length - 1].index + 1) groups.push([point]);
            else current.push(point);
        });
        groups.forEach(group => {
            if (group.length < 2) return;
            ctx.save(); smoothStroke(ctx, group);
            ctx.strokeStyle = colourWithAlpha(palette.primary, .20);
            ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
            ctx.save(); smoothStroke(ctx, group);
            ctx.strokeStyle = applyGradient(ctx, left, 0, right, 0, palette.stops);
            ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
        });
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, point.index === selectedMonth ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = point.value > 0 ? palette.secondary : 'rgba(225,235,245,.22)';
            ctx.fill();
            if (point.value > 0) {
                ctx.beginPath(); ctx.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
                ctx.fillStyle = '#FFFFFF'; ctx.fill();
            }
            if (point.index === selectedMonth) {
                ctx.beginPath(); ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
                ctx.strokeStyle = palette.primary; ctx.lineWidth = 1.4; ctx.stroke();
            }
        });
        ctx.font = editorFont(7.5, 650); ctx.fillStyle = palette.muted;
        ctx.textAlign = 'center';
        MONTHS.forEach((month, index) => {
            ctx.fillText(month, left + (right - left) * index / 11, size.height - 14);
        });
        ctx.restore();
        canvas.__premiumTrendGeometry = { left, right, top, bottom, points };
    }

    function renderCompassFrame(canvas, overall, values, selectedMonth, angleValue) {
        const ctx = canvas.getContext('2d'), size = logicalSize(canvas), palette = chartPalette();
        ctx.clearRect(0, 0, size.width, size.height);
        drawInstrumentSurface(ctx, size.width, size.height, palette);
        drawHeader(ctx, canvas, 'Leistungsindex · Präzisionskompass',
            Math.round(selectedMonth === null ? overall : (values[selectedMonth] || 0)) + ' / 100');

        const cx = size.width / 2, cy = Math.min(size.height * .46, 190);
        const radius = Math.min(105, size.width * .285, (size.height - 128) * .50);
        const start = Math.PI * .75, sweep = Math.PI * 1.5;
        ctx.save(); ctx.translate(cx, cy);

        const bezel = ctx.createRadialGradient(-radius * .32, -radius * .4, radius * .08, 0, 0, radius * 1.24);
        bezel.addColorStop(0, '#FFFFFF'); bezel.addColorStop(.18, palette.secondary);
        bezel.addColorStop(.43, '#586674'); bezel.addColorStop(.62, palette.primary);
        bezel.addColorStop(.83, '#253341'); bezel.addColorStop(1, '#050B12');
        ctx.beginPath(); ctx.arc(0, 0, radius + 9, 0, Math.PI * 2);
        ctx.fillStyle = bezel; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;

        const glass = ctx.createRadialGradient(-radius * .35, -radius * .45, 1, 0, 0, radius + 2);
        glass.addColorStop(0, 'rgba(42,59,75,.96)'); glass.addColorStop(.7, 'rgba(10,20,31,.98)');
        glass.addColorStop(1, 'rgba(4,10,17,1)');
        ctx.beginPath(); ctx.arc(0, 0, radius + 1, 0, Math.PI * 2); ctx.fillStyle = glass; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, radius + 5.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.1; ctx.stroke();

        for (let i = 0; i <= 100; i += 2) {
            const a = start + sweep * i / 100, major = i % 10 === 0;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (radius - (major ? 14 : 7)), Math.sin(a) * (radius - (major ? 14 : 7)));
            ctx.lineTo(Math.cos(a) * (radius - 2), Math.sin(a) * (radius - 2));
            ctx.strokeStyle = major ? colourWithAlpha(palette.secondary, .94) : 'rgba(235,242,247,.40)';
            ctx.lineWidth = major ? 1.45 : .65; ctx.stroke();
        }
        [0, 25, 50, 75, 100].forEach(value => {
            const a = start + sweep * value / 100, r = radius - 30;
            ctx.fillStyle = palette.text; ctx.font = editorFont(8.5, 750);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(value), Math.cos(a) * r, Math.sin(a) * r);
        });

        [['N', -Math.PI / 2], ['O', 0], ['S', Math.PI / 2], ['W', Math.PI]].forEach(([label, a]) => {
            ctx.fillStyle = label === 'N' ? palette.primary : 'rgba(239,245,249,.9)';
            ctx.font = editorFont(9, 850); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(label, Math.cos(a) * (radius + 18), Math.sin(a) * (radius + 18));
        });

        // Eight-point compass rose, purely ornamental around the performance scale.
        for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + i * Math.PI / 4, len = i % 2 === 0 ? radius * .36 : radius * .23;
            const w = i % 2 === 0 ? 5.2 : 3.2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * len, Math.sin(a) * len);
            ctx.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w);
            ctx.lineTo(-Math.cos(a) * len * .22, -Math.sin(a) * len * .22);
            ctx.lineTo(-Math.cos(a + Math.PI / 2) * w, -Math.sin(a + Math.PI / 2) * w);
            ctx.closePath();
            ctx.fillStyle = i % 2 === 0 ? colourWithAlpha(palette.primary, .68) : 'rgba(223,234,243,.52)';
            ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.36)'; ctx.lineWidth = .6; ctx.stroke();
        }
        const needleAngle = start + sweep * Math.max(0, Math.min(100, angleValue)) / 100;
        drawGaugeNeedle(ctx, 0, 0, radius * .88, needleAngle, palette, true);
        const shown = selectedMonth === null ? overall : (values[selectedMonth] || 0);
        ctx.fillStyle = '#FFF8E8'; ctx.font = editorFont(23, 850);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(Math.round(shown)), 0, radius * .47);
        ctx.fillStyle = 'rgba(231,239,245,.68)'; ctx.font = editorFont(7.5, 750);
        ctx.fillText('LEISTUNGSINDEX · 0–100', 0, radius * .70);
        ctx.restore();
        drawTrendStrip(ctx, canvas, values, palette, selectedMonth);
    }

    function renderSpeedometerFrame(canvas, overall, values, selectedMonth, angleValue) {
        const ctx = canvas.getContext('2d'), size = logicalSize(canvas), palette = chartPalette();
        ctx.clearRect(0, 0, size.width, size.height);
        drawInstrumentSurface(ctx, size.width, size.height, palette);
        const shown = selectedMonth === null ? overall : (values[selectedMonth] || 0);
        drawHeader(ctx, canvas, 'Geschwindigkeit · Tachometer',
            shown > 0 ? formatDecimalAT(shown, 1) + ' km/h' : '–');

        const cx = size.width / 2, cy = Math.min(size.height * .60, 235);
        const radius = Math.min(112, size.width * .30, (size.height - 135) * .68);
        const max = Math.max(6, Math.ceil(Math.max(overall, ...values) * 1.18 / 2) * 2);
        const start = Math.PI, sweep = Math.PI;

        ctx.beginPath(); ctx.arc(cx, cy, radius + 9, start - .04, start + sweep + .04);
        ctx.strokeStyle = '#263442'; ctx.lineWidth = 13; ctx.stroke();
        const rim = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + 3);
        rim.addColorStop(0, '#FFF2D4'); rim.addColorStop(.25, palette.secondary);
        rim.addColorStop(.52, palette.primary); rim.addColorStop(.78, '#5B6874'); rim.addColorStop(1, '#111B25');
        ctx.beginPath(); ctx.arc(cx, cy, radius + 8, start, start + sweep);
        ctx.strokeStyle = rim; ctx.lineWidth = 8; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, radius + 2, start, start + sweep);
        ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 1; ctx.stroke();

        for (let i = 0; i <= 40; i++) {
            const value = max * i / 40, a = start + sweep * i / 40, major = i % 5 === 0;
            const r1 = radius - (major ? 15 : 7);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
            ctx.lineTo(cx + Math.cos(a) * (radius - 1), cy + Math.sin(a) * (radius - 1));
            ctx.strokeStyle = major ? palette.secondary : 'rgba(236,243,248,.43)';
            ctx.lineWidth = major ? 1.55 : .7; ctx.stroke();
            if (major) {
                ctx.fillStyle = palette.text; ctx.font = editorFont(8, 750);
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(String(Math.round(value)), cx + Math.cos(a) * (radius - 28), cy + Math.sin(a) * (radius - 28));
            }
        }
        ctx.beginPath(); ctx.arc(cx, cy, radius - 4, start + sweep * .82, start + sweep);
        ctx.strokeStyle = 'rgba(197,54,49,.72)'; ctx.lineWidth = 3; ctx.stroke();
        const angle = start + sweep * Math.max(0, Math.min(max, angleValue)) / max;
        drawGaugeNeedle(ctx, cx, cy, radius * .82, angle, palette, true);

        ctx.fillStyle = palette.text; ctx.font = editorFont(24, 850);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(shown > 0 ? formatDecimalAT(shown, 1) : '–', cx, cy + 32);
        ctx.fillStyle = palette.muted; ctx.font = editorFont(9, 750);
        ctx.fillText('km/h · MONATSMITTEL', cx, cy + 52);
        drawTrendStrip(ctx, canvas, values, palette, selectedMonth);
    }

    function animateGauge(type, target, drawFrame) {
        const previous = Number.isFinite(animatedGaugeValues[type]) ? animatedGaugeValues[type] : target;
        if (!window.requestAnimationFrame || Math.abs(previous - target) < .2) {
            animatedGaugeValues[type] = target; drawFrame(target); return;
        }
        if (gaugeAnimationFrames[type] && window.cancelAnimationFrame) window.cancelAnimationFrame(gaugeAnimationFrames[type]);
        const started = performance.now(), duration = 520, from = previous;
        const step = now => {
            const t = Math.min(1, (now - started) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            drawFrame(from + (target - from) * eased);
            if (t < 1) gaugeAnimationFrames[type] = window.requestAnimationFrame(step);
            else { gaugeAnimationFrames[type] = null; animatedGaugeValues[type] = target; }
        };
        gaugeAnimationFrames[type] = window.requestAnimationFrame(step);
    }

    function drawPerformanceIndexDiagram() {
        const sums = Array(12).fill(0), counts = Array(12).fill(0);
        let total = 0, n = 0;
        getFilteredTours().forEach(entry => {
            const month = monthOf(entry); if (month === null) return;
            const result = calculatePerformanceIndex(entry);
            if (!result || !Number.isFinite(result.score)) return;
            const score = Math.max(0, Math.min(100, result.score));
            sums[month] += score; counts[month]++; total += score; n++;
        });
        const values = sums.map((sum, i) => counts[i] ? sum / counts[i] : 0);
        const overall = n ? total / n : 0, selected = selectedMonths.performanceIndex;
        const selectedValue = activeMonthValue(values, selected);
        const target = selectedValue === null ? overall : selectedValue;
        const canvas = canvasById('performance-index-canvas');
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        resizeCanvasToDisplaySize(canvas);
        canvas.__premiumChartData = { values, unit: 'Punkte', key: 'performanceIndex',
            formatter: value => Math.round(value) + ' / 100' };
        animateGauge('performanceIndex', target,
            angle => renderCompassFrame(canvas, overall, values, selected, angle));
    }

    function drawSpeedometer(canvas, values, overall) {
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        resizeCanvasToDisplaySize(canvas);
        const selected = selectedMonths.speed, selectedValue = activeMonthValue(values, selected);
        const target = selectedValue === null ? overall : selectedValue;
        canvas.__premiumChartData = { values, unit: 'km/h', key: 'speed',
            formatter: value => formatDecimalAT(value, 1) + ' km/h' };
        animateGauge('speed', target,
            angle => renderSpeedometerFrame(canvas, overall, values, selected, angle));
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

    function formatMilestoneNumber(type, value) {
        if (type === 'time') {
            const totalMinutes = Math.round(value * 60);
            return Math.floor(totalMinutes / 60) + ':' + String(totalMinutes % 60).padStart(2, '0');
        }
        if (type === 'dist') return Number(value).toLocaleString('de-AT', { maximumFractionDigits: 1 });
        return Math.round(value).toLocaleString('de-AT');
    }

    function drawMetalPlaque(ctx, x, y, label, palette, achieved) {
        const w = Math.max(19, Math.min(32, label.length * 5.2 + 10)), h = 17;
        ctx.save(); ctx.translate(x, y);
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 3, -h / 2); ctx.lineTo(w / 2 - 3, -h / 2);
        ctx.lineTo(w / 2, -h / 2 + 4); ctx.lineTo(w / 2, h / 2 - 4);
        ctx.lineTo(w / 2 - 3, h / 2); ctx.lineTo(-w / 2 + 3, h / 2);
        ctx.lineTo(-w / 2, h / 2 - 4); ctx.lineTo(-w / 2, -h / 2 + 4); ctx.closePath();
        const metal = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        metal.addColorStop(0, achieved ? '#FFF8E8' : 'rgba(226,236,244,.38)');
        metal.addColorStop(.24, achieved ? palette.secondary : 'rgba(120,137,151,.32)');
        metal.addColorStop(.56, achieved ? palette.primary : 'rgba(40,53,66,.5)');
        metal.addColorStop(1, achieved ? '#596775' : 'rgba(14,24,34,.7)');
        ctx.fillStyle = metal; ctx.shadowColor = achieved ? 'rgba(0,0,0,.5)' : 'transparent';
        ctx.shadowBlur = achieved ? 6 : 0; ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = achieved ? 'rgba(255,255,255,.72)' : 'rgba(225,236,245,.25)';
        ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = achieved ? '#101923' : 'rgba(230,238,245,.72)';
        ctx.font = editorFont(6.5, 850); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, .5, w - 3);
        ctx.restore();
    }

    function drawMilestoneChartPremium(type) {
        const ids = { dist: 'ms-dist-canvas', asc: 'ms-asc-canvas', time: 'ms-time-canvas', peaks: 'ms-peaks-canvas' };
        const canvas = canvasById(ids[type]);
        if (!canvas || typeof resizeCanvasToDisplaySize !== 'function') return;
        const ctx = resizeCanvasToDisplaySize(canvas);
        if (!ctx) return;
        const width = logicalSize(canvas).width, height = logicalSize(canvas).height;
        const palette = chartPalette();
        ctx.clearRect(0, 0, width, height);
        drawInstrumentSurface(ctx, width, height, palette);
        msDotHitTargets[type] = [];

        const names = { dist: 'Distanz', asc: 'Höhenmeter', time: 'Zeit', peaks: 'Gipfel' };
        const units = { dist: 'km', asc: 'hm', time: 'h', peaks: 'Gipfel' };
        const milestones = (typeof MILESTONE_DEFS !== 'undefined' && MILESTONE_DEFS[type]) || [];
        const allData = getFilteredTours().filter(entry => entry && entry.date);
        const yearSet = new Set();
        allData.forEach(entry => {
            const date = new Date(entry.date);
            if (!Number.isNaN(date.getTime())) yearSet.add(date.getFullYear());
        });
        const timelineYears = Array.from(yearSet).sort((a, b) => a - b);
        const aggregate = typeof statsYearFilter !== 'undefined' &&
            (statsYearFilter === 'all' || statsYearFilter === 'past');
        const keyAll = '__total__';
        const years = aggregate ? [keyAll] : timelineYears.slice();
        const bucketCount = aggregate ? timelineYears.length : 12;
        const labels = aggregate ? timelineYears.map(String) :
            ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

        const empty = () => {
            ctx.fillStyle = palette.muted; ctx.font = editorFont(11, 650);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('Keine Daten · Jahr oder Filter ändern', width / 2, height / 2);
        };
        if (!milestones.length || !years.length || !allData.length || !bucketCount) {
            drawHeader(ctx, canvas, 'Meilensteine · ' + names[type], '–'); empty(); return;
        }

        const getValue = entry => {
            if (type === 'dist') return parseFloat(String(entry.strecke || '').replace(',', '.')) || 0;
            if (type === 'asc') return parseFloat(String(entry.aufstieg || '').replace(',', '.')) || 0;
            if (type === 'peaks') return parseInt(entry.gipfel, 10) || 0;
            if (type === 'time') {
                if (!entry.zeit || !String(entry.zeit).includes(':')) return 0;
                const parts = String(entry.zeit).split(':').map(Number);
                return Number.isFinite(parts[0]) && Number.isFinite(parts[1]) ? (parts[0] * 60 + parts[1]) / 60 : 0;
            }
            return 0;
        };

        const sums = {}, entries = {};
        years.forEach(year => { sums[year] = Array(bucketCount).fill(0); entries[year] = []; });
        allData.forEach(entry => {
            const date = new Date(entry.date);
            if (Number.isNaN(date.getTime())) return;
            const series = aggregate ? keyAll : date.getFullYear();
            if (!sums[series]) return;
            const bucket = aggregate ? timelineYears.indexOf(date.getFullYear()) : date.getMonth();
            if (bucket < 0) return;
            const value = getValue(entry);
            sums[series][bucket] += value;
            entries[series].push({ entry, date, value });
        });

        const cumulative = {}, tourCumulative = {}, lastActive = {};
        years.forEach(year => {
            let running = 0;
            cumulative[year] = sums[year].map(value => { running += value; return running; });
            running = 0;
            tourCumulative[year] = entries[year].slice()
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map(item => { running += item.value; return { cumVal: running, entry: item.entry }; });
            let last = -1;
            sums[year].forEach((value, index) => { if (value > 0) last = index; });
            lastActive[year] = last;
        });

        const yearsWithData = years.filter(year => lastActive[year] >= 0);
        if (!yearsWithData.length) { drawHeader(ctx, canvas, 'Meilensteine · ' + names[type], '–'); empty(); return; }
        const actualMax = Math.max(...yearsWithData.map(year => cumulative[year][lastActive[year]]));
        const reached = milestones.filter(value => value <= actualMax);
        const next = milestones.find(value => value > actualMax);
        const visibleTargets = next === undefined ? reached : reached.concat([next]);
        const maxValue = Math.max(actualMax, visibleTargets[visibleTargets.length - 1] || milestones[0] || 1, 1);

        const mobile = width < 430;
        const plot = {
            left: mobile ? 39 : 49,
            right: width - (mobile ? 16 : 20),
            top: years.length > 1 && !aggregate ? 54 : 44,
            bottom: height - 43
        };
        plot.width = Math.max(40, plot.right - plot.left);
        plot.height = Math.max(40, plot.bottom - plot.top);
        drawHeader(ctx, canvas, 'Meilensteine · ' + names[type],
            formatMilestoneNumber(type, actualMax) + ' ' + units[type]);

        // A shared line system, with a distinct material cue per milestone category.
        drawTopographicRelief(ctx, plot, palette, type === 'asc' ? 1 : type === 'peaks' ? .48 : .20);
        if (type === 'time') {
            for (let i = 0; i < 24; i++) {
                const x = plot.left + plot.width * i / 23;
                ctx.beginPath(); ctx.moveTo(x, plot.bottom - (i % 2 === 0 ? 7 : 3)); ctx.lineTo(x, plot.bottom);
                ctx.strokeStyle = 'rgba(229,238,245,.16)'; ctx.lineWidth = .7; ctx.stroke();
            }
        }
        if (type === 'peaks') {
            ctx.beginPath(); ctx.moveTo(plot.left, plot.bottom);
            for (let i = 0; i <= 32; i++) {
                const x = plot.left + plot.width * i / 32;
                const y = plot.bottom - 7 - Math.abs(Math.sin(i * .83)) * 7 - Math.abs(Math.cos(i * .31)) * 4;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(plot.right, plot.bottom); ctx.closePath();
            ctx.fillStyle = colourWithAlpha(palette.secondary, .075); ctx.fill();
        }

        const stepX = plot.width / bucketCount;
        const xFor = index => bucketCount === 1 ? plot.left + plot.width / 2 : plot.left + (index + 1) * stepX;
        const xPrevious = index => index === 0 ? plot.left : xFor(index - 1);
        const yFor = value => plot.bottom - value / maxValue * plot.height;

        for (let i = 0; i <= 4; i++) {
            const ratio = i / 4, value = maxValue * ratio, y = yFor(value);
            ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.right, y);
            ctx.strokeStyle = i === 0 ? 'rgba(235,243,248,.26)' : 'rgba(235,243,248,.065)';
            ctx.lineWidth = i === 0 ? 1.05 : .7; ctx.stroke();
            ctx.fillStyle = palette.muted; ctx.font = editorFont(8, 600);
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText(type === 'time' ? formatMilestoneNumber(type, value) : Math.round(value).toLocaleString('de-AT'),
                plot.left - 6, y);
        }

        visibleTargets.forEach(target => {
            const y = yFor(target);
            ctx.beginPath(); ctx.moveTo(plot.left, y); ctx.lineTo(plot.right, y);
            ctx.setLineDash([3, 5]);
            ctx.strokeStyle = reached.includes(target)
                ? colourWithAlpha(palette.secondary, .10)
                : colourWithAlpha(palette.primary, .28);
            ctx.lineWidth = reached.includes(target) ? .65 : 1;
            ctx.stroke(); ctx.setLineDash([]);
        });
        if (next !== undefined) {
            drawMetalPlaque(ctx, plot.right - 20, yFor(next) - 10,
                formatMilestoneNumber(type, next), palette, false);
        }

        if (years.length > 1 && !aggregate) {
            const itemWidth = 56;
            let x = Math.max(plot.left, (width - years.length * itemWidth) / 2);
            years.forEach(year => {
                const stops = getYearCompareGradientStops(year, years);
                ctx.beginPath(); ctx.moveTo(x, 38); ctx.lineTo(x + 15, 38);
                ctx.strokeStyle = applyGradient(ctx, x, 0, x + 15, 0, stops);
                ctx.lineWidth = 2.5; ctx.stroke();
                ctx.fillStyle = palette.text; ctx.font = editorFont(8, 650);
                ctx.textAlign = 'left'; ctx.fillText(String(year), x + 20, 41);
                x += itemWidth;
            });
        }

        yearsWithData.forEach(year => {
            const last = lastActive[year], values = cumulative[year];
            const stops = years.length === 1 ? palette.stops : getYearCompareGradientStops(year, years);
            const line = ctx.createLinearGradient(plot.left, 0, plot.right, 0);
            stops.forEach(([at, colour]) => line.addColorStop(at, colour));

            ctx.beginPath(); ctx.moveTo(plot.left, yFor(0));
            for (let index = 0; index <= last; index++) ctx.lineTo(xFor(index), yFor(values[index]));
            ctx.lineTo(xFor(last), plot.bottom); ctx.lineTo(plot.left, plot.bottom); ctx.closePath();
            const area = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
            area.addColorStop(0, colourWithAlpha(stops[stops.length - 1][1], .20));
            area.addColorStop(1, colourWithAlpha(stops[0][1], .015));
            ctx.fillStyle = area; ctx.fill();

            ctx.beginPath(); ctx.moveTo(plot.left, yFor(0));
            for (let index = 0; index <= last; index++) ctx.lineTo(xFor(index), yFor(values[index]));
            ctx.strokeStyle = line; ctx.lineWidth = 3.0;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            ctx.shadowColor = colourWithAlpha(stops[stops.length - 1][1], .32);
            ctx.shadowBlur = 7; ctx.stroke(); ctx.shadowBlur = 0;

            for (let index = 0; index <= last; index++) {
                drawMetalMarker(ctx, xFor(index), yFor(values[index]), palette, 2.6);
            }

            visibleTargets.forEach(target => {
                if (values[last] < target) return;
                let crossing = null;
                for (let index = 0; index <= last; index++) {
                    const previous = index === 0 ? 0 : values[index - 1];
                    const current = values[index];
                    if (current >= target && previous < target) {
                        const portion = current === previous ? 1 : Math.max(0, Math.min(1, (target - previous) / (current - previous)));
                        crossing = xPrevious(index) + portion * (xFor(index) - xPrevious(index));
                        break;
                    }
                }
                if (crossing === null) return;
                const y = yFor(target);
                const milestoneTour = (tourCumulative[year] || []).find(item => item.cumVal >= target);
                const entry = milestoneTour ? milestoneTour.entry : null;
                msDotHitTargets[type].push({ x: crossing, y, entry, milestone: target, year });

                // Raised metal plaque anchors each threshold directly to the cumulative line.
                ctx.beginPath(); ctx.moveTo(crossing, y - 10); ctx.lineTo(crossing, y - 4);
                ctx.strokeStyle = colourWithAlpha(palette.secondary, .78); ctx.lineWidth = 1; ctx.stroke();
                drawMetalPlaque(ctx, crossing, y - 18, formatMilestoneNumber(type, target), palette, true);
                drawMetalMarker(ctx, crossing, y, palette, 4.2);
            });
        });

        // Years in the all-years view stay horizontal and compact rather than rotated.
        labels.forEach((label, index) => {
            const x = xFor(index);
            ctx.fillStyle = palette.muted; ctx.font = editorFont(aggregate ? 8 : 8.5, 650);
            ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText(label, x, height - 15, stepX ? stepX - 2 : 42);
        });
        canvas.__premiumMilestoneType = type;
    }

    window.drawMilestoneChartView = drawMilestoneChartPremium;

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

    function formatChartValue(canvas, value) {
        const data = canvas.__premiumChartData || {};
        if (typeof data.formatter === 'function') return data.formatter(value);
        return Math.round(value).toLocaleString('de-AT') + (data.unit ? ' ' + data.unit : '');
    }

    function showChartTooltip(canvas, monthIndex, value) {
        const stage = canvas.closest('.chart-canvas-stage');
        if (!stage) return;
        let tooltip = stage.querySelector('.chart-premium-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'chart-premium-tooltip';
            tooltip.setAttribute('role', 'status');
            tooltip.setAttribute('aria-live', 'polite');
            stage.appendChild(tooltip);
        }
        tooltip.textContent = MONTH_NAMES[monthIndex] + ' · ' + formatChartValue(canvas, value);
        tooltip.classList.add('is-visible');
        if (tooltip.__hideTimer) clearTimeout(tooltip.__hideTimer);
        tooltip.__hideTimer = setTimeout(() => tooltip.classList.remove('is-visible'), 3200);
    }

    function selectMonthlyValue(canvas, category, monthIndex) {
        const values = canvas.__premiumChartData && canvas.__premiumChartData.values;
        if (!Array.isArray(values)) return;
        selectedMonths[category] = monthIndex;
        if (typeof window.drawActiveChart === 'function') window.drawActiveChart();
        else if (category === 'performanceIndex') drawPerformanceIndexDiagram();
        else if (category === 'speed') drawSpeedDiagram();
        showChartTooltip(canvas, monthIndex, Number(values[monthIndex]) || 0);
        adaptiveHaptic('selection');
        if (typeof openMonthCategoryModal === 'function') openMonthCategoryModal(category, monthIndex);
    }

    function installCanvasInteractions() {
        const monthlyCategories = {
            'big-tours-canvas': 'bigTours',
            'steps-canvas': 'steps',
            'peaks-canvas': 'peaks',
            'gradient-canvas': 'gradient',
            'ascent-rate-canvas': 'ascentRate',
            'avg-steps-canvas': 'avgSteps'
        };
        Object.entries(monthlyCategories).forEach(([id, category]) => {
            const canvas = canvasById(id);
            if (!canvas || canvas.dataset.premiumExactTap === 'true') return;
            canvas.dataset.premiumExactTap = 'true';
            canvas.addEventListener('click', event => {
                if (!canvas.classList.contains('active-chart-canvas') || !event.isTrusted) return;
                event.stopImmediatePropagation();
                const rect = canvas.getBoundingClientRect(), size = logicalSize(canvas);
                const x = (event.clientX - rect.left) * size.width / rect.width;
                const y = (event.clientY - rect.top) * size.height / rect.height;
                let index;
                if (category === 'avgSteps') {
                    const col = Math.max(0, Math.min(5, Math.floor((x - 14) / ((size.width - 28) / 6))));
                    const row = y < size.height * .56 ? 0 : 1;
                    index = row * 6 + col;
                } else {
                    const left = category === 'bigTours' ? 26 : 34;
                    const right = size.width - 18;
                    index = Math.floor((x - left) / Math.max(1, right - left) * 12);
                    index = Math.max(0, Math.min(11, index));
                }
                if (y < 48 || y > size.height - 18) return;
                selectMonthlyValue(canvas, category, index);
            }, true);
        });

        const compass = canvasById('performance-index-canvas');
        if (compass && compass.dataset.premiumCompassTap !== 'true') {
            compass.dataset.premiumCompassTap = 'true';
            compass.addEventListener('click', event => {
                if (!compass.classList.contains('active-chart-canvas') || !event.isTrusted) return;
                event.stopImmediatePropagation();
                const rect = compass.getBoundingClientRect(), size = logicalSize(compass);
                const x = (event.clientX - rect.left) * size.width / rect.width;
                const y = (event.clientY - rect.top) * size.height / rect.height;
                const geometry = compass.__premiumTrendGeometry;
                if (!geometry || y < geometry.top - 8 || y > geometry.bottom + 12) {
                    selectedMonths.performanceIndex = null;
                    drawPerformanceIndexDiagram();
                    return;
                }
                const index = Math.max(0, Math.min(11,
                    Math.round((x - geometry.left) / Math.max(1, geometry.right - geometry.left) * 11)));
                selectMonthlyValue(compass, 'performanceIndex', index);
            }, true);
        }

        const speed = canvasById('speed-canvas');
        if (speed && speed.dataset.premiumSpeedSelection !== 'true') {
            speed.dataset.premiumSpeedSelection = 'true';
            speed.addEventListener('click', event => {
                if (!speed.classList.contains('active-chart-canvas') || !event.isTrusted) return;
                const rect = speed.getBoundingClientRect(), size = logicalSize(speed);
                const x = (event.clientX - rect.left) * size.width / rect.width;
                const y = (event.clientY - rect.top) * size.height / rect.height;
                const geometry = speed.__premiumTrendGeometry;
                if (!geometry || y < geometry.top - 8 || y > size.height - 24 ||
                    x < geometry.left - 6 || x > geometry.right + 6) return;
                event.stopImmediatePropagation();
                const index = Math.max(0, Math.min(11,
                    Math.round((x - geometry.left) / Math.max(1, geometry.right - geometry.left) * 11)));
                selectMonthlyValue(speed, 'speed', index);
            }, true);
        }
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
