/* pdf-magazine.js - adaptive magazine PDF renderer */
(function () {
    'use strict';

    var pdfLibrariesPromise = null;

    function loadPdfDependency(src, key) {
        return new Promise(function(resolve, reject) {
            var script = document.querySelector('script[data-pdf-dependency="' + key + '"]');

            if (script && script.dataset.failed === 'true') {
                script.remove();
                script = null;
            }

            if (script) {
                if (script.dataset.loaded === 'true') {
                    resolve();
                    return;
                }
                script.addEventListener('load', function() {
                    script.dataset.loaded = 'true';
                    resolve();
                }, { once: true });
                script.addEventListener('error', function() {
                    script.dataset.failed = 'true';
                    reject(new Error('PDF-Bibliothek konnte nicht geladen werden: ' + src));
                }, { once: true });
                return;
            }

            script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.pdfDependency = key;
            script.addEventListener('load', function() {
                script.dataset.loaded = 'true';
                resolve();
            }, { once: true });
            script.addEventListener('error', function() {
                script.dataset.failed = 'true';
                reject(new Error('PDF-Bibliothek konnte nicht geladen werden: ' + src));
            }, { once: true });
            document.head.appendChild(script);
        });
    }

    function ensurePdfLibraries() {
        if (!pdfLibrariesPromise) {
            pdfLibrariesPromise = (async function() {
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    await loadPdfDependency('./libs/jspdf.umd.min.js', 'jspdf');
                }
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    throw new Error('jsPDF wurde nach dem Laden nicht verfügbar.');
                }
                if (
                    !window.jspdf.jsPDF.API ||
                    typeof window.jspdf.jsPDF.API.autoTable !== 'function'
                ) {
                    await loadPdfDependency('./libs/jspdf.plugin.autotable.min.js', 'jspdf-autotable');
                }
            })().catch(function(error) {
                pdfLibrariesPromise = null;
                throw error;
            });
        }
        return pdfLibrariesPromise;
    }

    var A4 = { w: 297, h: 210 };
    var M = 12;
    var CW = A4.w - M * 2;
    var SAFE_BOTTOM = A4.h - 15;
    var GAP = 3;
    var photoPageIndexes = new Set();

    function st(v) {
        if (typeof window.sanitizePdfText === 'function') return window.sanitizePdfText(v);
        return String(v == null ? '' : v).replace(/\s{2,}/g, ' ').trim();
    }
    function n(v, d) {
        var x = Number(v);
        return Number.isFinite(x) ? x : (d || 0);
    }
    function f1(v) { return n(v).toFixed(1).replace('.', ','); }
    function fi(v) { return Math.round(n(v)).toLocaleString('de-AT'); }
    function tc() {
        try {
            if (typeof window.getPdfThemeColors === 'function') return window.getPdfThemeColors();
        } catch (_) {}
        return { top: [55,75,65], bottom:[105,120,100], accent:[111,75,47], accent2:[205,160,85], topHex:'#374b41', bottomHex:'#697864' };
    }
    function crop(url, w, h, q) {
        return new Promise(function(resolve, reject) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                var ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('Canvas-Kontext nicht verfügbar')); return; }

                ctx.fillStyle = '#f8f7f3';
                ctx.fillRect(0, 0, w, h);

                var scale = Math.min(w / img.width, h / img.height);
                var dw = img.width * scale;
                var dh = img.height * scale;
                var dx = (w - dw) / 2;
                var dy = (h - dh) / 2;

                /*
                 * Kein aggressiver Beschnitt mehr:
                 * Das komplette Foto bleibt sichtbar und wird proportional
                 * in die vorhandene Bildfläche eingepasst.
                 */
                ctx.drawImage(img, dx, dy, dw, dh);
                resolve(canvas.toDataURL('image/jpeg', q || 0.84));
            };
            img.onerror = reject;
            img.src = url;
        });
    }
    async function cropFullBleed(url, w, h, q) {
        return new Promise(function(resolve, reject) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                var ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('Canvas-Kontext nicht verfügbar')); return; }
                var scale = Math.max(w / img.width, h / img.height);
                var sw = w / scale, sh = h / scale;
                var sx = Math.max(0, (img.width - sw) / 2);
                var sy = Math.max(0, (img.height - sh) / 2);
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
                var gradient = ctx.createLinearGradient(0, h * 0.48, 0, h);
                gradient.addColorStop(0, 'rgba(0,0,0,0)');
                gradient.addColorStop(0.48, 'rgba(0,0,0,0.28)');
                gradient.addColorStop(1, 'rgba(0,0,0,0.78)');
                ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', q || 0.9));
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    function fill(doc, c) { doc.setFillColor(c[0], c[1], c[2]); }
    function draw(doc, c) { doc.setDrawColor(c[0], c[1], c[2]); }
    function text(doc, c) { doc.setTextColor(c[0], c[1], c[2]); }
    function rule(doc, x, y, w, c, h) {
        fill(doc, c); doc.roundedRect(x, y, w, h || 1, (h || 1) / 2, (h || 1) / 2, 'F');
    }
    function wrap(doc, value, width, size, style) {
        doc.setFont(undefined, style || 'normal');
        doc.setFontSize(size);
        return doc.splitTextToSize(st(value), width);
    }
    function addWrap(doc, value, x, y, width, size, style, color, lh) {
        var lines = wrap(doc, value, width, size, style);
        text(doc, color || [50,50,48]);
        doc.text(lines, x, y, { lineHeightFactor: (lh || size * 0.40) / size });
        return y + lines.length * (lh || size * 0.40);
    }
    function difficulty(e) {
        try {
            if (typeof window.getTourCompareDifficultyLabel === 'function') return window.getTourCompareDifficultyLabel(e.difficulty);
        } catch (_) {}
        return e.difficulty || 'Tour';
    }
    function big(e) {
        try { return typeof window.isBigTour === 'function' && window.isBigTour(e); } catch (_) { return false; }
    }
    function metrics(e, profile) {
        try {
            if (typeof window.getTourCompareMetrics === 'function') return window.getTourCompareMetrics(e, profile) || {};
        } catch (_) {}
        return {};
    }
    function perf(e) {
        try {
            if (typeof window.calculatePerformanceIndex === 'function') {
                var p = window.calculatePerformanceIndex(e);
                return p && Number.isFinite(Number(p.score)) ? p : null;
            }
        } catch (_) {}
        return null;
    }
    function cats(e) {
        try {
            if (typeof window.getHighlightCategoryDetails === 'function') return window.getHighlightCategoryDetails(e) || [];
        } catch (_) {}
        return [];
    }
    function getExportOptions() {
        function checked(name, fallback) {
            var el = document.getElementById('pdf-book-opt-' + name);
            return el ? !!el.checked : fallback;
        }
        function selected(name, allowed, fallback) {
            var el = document.getElementById('pdf-book-opt-' + name);
            return el && allowed.indexOf(el.value) >= 0 ? el.value : fallback;
        }
        return {
            photos: checked('photos', true),
            coverPhoto: checked('cover-photo', true),
            galleryPhotos: checked('gallery-photos', true),
            summitPhotos: checked('summit-photos', true),
            peaks: checked('peaks', true),
            performance: checked('performance', true),
            secondary: checked('secondary', true),
            startProfile: checked('start-profile', true),
            notes: checked('notes', true),
            extras: checked('extras', true),
            milestones: checked('milestones', true),
            monthly: checked('monthly', false),
            peakOverview: checked('peak-overview', false),
            closing: checked('closing', true),
            profile: selected('profile', ['premium', 'chronicle', 'documentation'], 'premium'),
            format: selected('format', ['landscape', 'portrait', 'square'], 'landscape'),
            layout: selected('profile', ['premium', 'chronicle', 'documentation'], 'premium'),
            style: selected('style', ['theme', 'alpine', 'mono'], 'alpine')
        };
    }

    function configurePage(format) {
        if (format === 'portrait') A4 = { w: 210, h: 297 };
        else if (format === 'square') A4 = { w: 210, h: 210 };
        else A4 = { w: 297, h: 210 };
        CW = A4.w - M * 2;
        SAFE_BOTTOM = A4.h - 15;
        measureDoc = null;
        photoPageIndexes = new Set();
    }

    function colorsForExport(base, style) {
        if (style === 'alpine') {
            return {
                top: [35, 65, 48],
                bottom: [132, 157, 122],
                accent: [61, 101, 68],
                accent2: [188, 139, 74],
                topHex: '#234130',
                bottomHex: '#849d7a'
            };
        }
        if (style === 'mono') {
            return {
                top: [39, 43, 45],
                bottom: [113, 118, 120],
                accent: [63, 70, 72],
                accent2: [125, 129, 130],
                topHex: '#272b2d',
                bottomHex: '#717678'
            };
        }
        return base;
    }

    function dataFor(e, profile, options) {
        options = options || getExportOptions();
        var m = metrics(e, profile), p = options.performance ? perf(e) : null, cs = cats(e), extras = [];
        var stats = [
            e.strecke ? [f1(e.strecke) + ' km', 'Strecke'] : null,
            e.aufstieg ? [fi(e.aufstieg) + ' hm', 'Aufstieg'] : null,
            e.zeit ? [st(e.zeit) + ' h', 'Gehzeit'] : null,
            m.steps ? [fi(m.steps) + ' Schritte', 'Schritte'] : null
        ].filter(Boolean);
        var secondary = options.secondary ? [
            m.speed != null ? f1(m.speed) + ' km/h Ø Speed' : null,
            m.gradient != null ? fi(m.gradient) + ' hm/km Ø Steigung' : null,
            m.ascentRate != null ? fi(m.ascentRate) + ' hm/h Ø Anstieg' : null
        ].filter(Boolean) : [];
        var peaks = options.peaks && Array.isArray(e.gipfelDetails) ? e.gipfelDetails.filter(function (g) {
            return g && (g.name || g.hoehe);
        }).map(function (g) {
            return (g.name || 'Unbenannt') + ' · ' + (g.hoehe || '–') + ' m';
        }) : [];

        if (options.extras && (e.ferrataStrecke || e.ferrataHm || e.ferrataZeit)) extras.push([
            'Klettersteig',
            [
                e.ferrataStrecke ? f1(e.ferrataStrecke) + ' km' : null,
                e.ferrataHm ? fi(e.ferrataHm) + ' hm' : null,
                e.ferrataZeit ? st(e.ferrataZeit) + ' h' : null
            ].filter(Boolean).join(' · ')
        ]);
        if (options.extras && (e.bikeStrecke || e.bikeHm || e.bikeZeit)) extras.push([
            'Rad',
            [
                e.bikeStrecke ? f1(e.bikeStrecke) + ' km' : null,
                e.bikeHm ? fi(e.bikeHm) + ' hm' : null,
                e.bikeZeit ? st(e.bikeZeit) + ' h' : null
            ].filter(Boolean).join(' · ')
        ]);
        var startingPoint = options.startProfile ? (e.ausgangspunkt || '') : '';
        if (options.extras && e.tourGroup) extras.push([
            'Begleitung / Tourgruppe',
            e.tourGroup + (e.tourDay && e.tourDayCount ? ' · Tag ' + e.tourDay + '/' + e.tourDayCount : '')
        ]);

        var pText = '';
        if (p) {
            var comp = '';
            if (p.comparisonCount >= 5) {
                comp = p.overallPercentile >= 100 ? 'beste vergleichbare Tour' : 'besser als ' + p.overallPercentile + ' %';
            } else {
                comp = 'Vergleich mit ' + p.comparisonCount + ' ' + (p.comparisonCount === 1 ? 'Tour' : 'Touren');
            }
            pText = st(p.score) + ' / 100 · ' + comp;
        }

        var complexity = stats.length + secondary.length * 0.7 + Math.min(peaks.length, 8) * 0.9 +
            extras.length * 0.8 + (startingPoint ? 0.8 : 0) + (e.notes ? 2 : 0) + (p ? 1.4 : 0) + (big(e) ? 1.5 : 0);

        return {
            e: e,
            m: m,
            p: p,
            cs: cs,
            stats: stats,
            secondary: secondary,
            peaks: peaks,
            extras: extras,
            startingPoint: startingPoint,
            pText: pText,
            complexity: complexity,
            photo: options.photos && !!e.imageData,
            layout: options.layout || 'magazine',
            title: e.tourname || 'Unbenannte Tour',
            date: typeof window.pdfExportFormatDate === 'function' ? window.pdfExportFormatDate(e.date) : (e.date || '–'),
            difficulty: difficulty(e),
            region: e.region || '–',
            isBig: big(e),
            fullGradient: !!e.useFullDistanceForGradient,
            profile: options.startProfile && m.profile && m.profile !== '–' ? m.profile : '',
            notes: options.notes ? (e.notes || '') : ''
        };
    }

    function measure(doc, d, w, kind) {
        var inner = w - 8;
        var h = 5;
        h += kind === 'feature' ? 9 : 7;
        h += 4;

        if (d.fullGradient) h += 3.3;

        if (d.cs.length) {
            h += wrap(
                doc,
                d.cs.map(function (c) { return c.name + ' · ' + c.rank; }).join(' / '),
                inner,
                6.7,
                'italic'
            ).length * 2.8 + 2;
        }

        if (kind === 'feature' && d.photo) {
            h += 53;
        } else if (kind === 'split' && d.photo) {
            // Im Kompaktlayout sinkt die Bildhöhe, so passen mehr Karten auf eine Seite.
            h += d.layout === 'compact' ? 34 : 45;
        } else {
            h += wrap(
                doc,
                d.stats.map(function (s) { return s[0]; }).join('   ·   '),
                inner,
                kind === 'feature' ? 9.5 : 8.6,
                'bold'
            ).length * 3.4 + 2;
        }

        if (d.secondary.length) {
            h += wrap(doc, d.secondary.join(' · '), inner, 6.9, 'normal').length * 2.8 + 3;
        }

        if (d.peaks.length) {
            if (d.peaks.length >= 5) {
                var peakColW = (inner - 5) / 2;
                var peakLeft = d.peaks.filter(function (_, i) { return i % 2 === 0; });
                var peakRight = d.peaks.filter(function (_, i) { return i % 2 === 1; });
                var peakLeftH = peakLeft.reduce(function (sum, p) {
                    return sum + wrap(doc, '• ' + p, peakColW, 6.7, 'normal').length * 3.6;
                }, 0);
                var peakRightH = peakRight.reduce(function (sum, p) {
                    return sum + wrap(doc, '• ' + p, peakColW, 6.7, 'normal').length * 3.6;
                }, 0);
                h += 9.2 + Math.max(peakLeftH, peakRightH);
            } else {
                h += 9.2 + d.peaks.reduce(function (sum, p) {
                    return sum + wrap(doc, '• ' + p, inner, 6.7, 'normal').length * 3.6;
                }, 0);
            }
        }

        if (d.extras.length) {
            h += 4;
            d.extras.forEach(function (ex) {
                h += 5.3 + wrap(doc, ex[1], inner - 10, 6.9, 'normal').length * 2.8;
            });
        }

        if (d.startingPoint && d.profile) {
            var halfInner = (inner - 6) / 2;
            h += 8 +
                Math.max(
                    wrap(doc, d.startingPoint, halfInner, 6.9, 'normal').length,
                    wrap(doc, d.profile, halfInner, 6.9, 'normal').length
                ) * 2.8;
        } else {
            if (d.startingPoint) h += 8 + wrap(doc, d.startingPoint, inner, 6.9, 'normal').length * 2.8;
            if (d.profile) h += 8 + wrap(doc, d.profile, inner, 7.0, 'normal').length * 2.8;
        }

        if (d.p) h += 14;

        if (d.notes) {
            h += 4 + wrap(doc, d.notes, inner, 7.0, 'italic').length * 2.7;
        }

        // Sicherheitsreserve gleicht kleine Abweichungen zwischen der Vorabmessung
        // und dem tatsächlich gezeichneten Inhalt aus (Schriftmetriken, Zeilenumbrüche,
        // Trennlinien und Innenabstände). Bei langen Karten wächst sie proportional.
        var bottomPad = (kind === 'feature' && d.photo) ? 4.0 : 2.5;
        var safety = Math.max(3.5, h * 0.06);
        return Math.max(40, h + bottomPad + safety);
    }

    var measureDoc = null;

    function getMeasureDoc() {
        if (!measureDoc) {
            if (!window.jspdf || !window.jspdf.jsPDF) {
                throw new Error('PDF-Bibliothek ist noch nicht geladen.');
            }
            measureDoc = new window.jspdf.jsPDF({ unit: 'mm', format: [A4.w, A4.h] });
        }
        return measureDoc;
    }

    function statGrid(doc, d, x, y, w, cols, colors) {
        cols = cols || 3;
        var gap = 2.5, cw = (w - gap * (cols - 1)) / cols, ch = 9.5;
        d.stats.slice(0, cols * 2).forEach(function (it, i) {
            var row = Math.floor(i / cols), col = i % cols;
            var px = x + col * (cw + gap), py = y + row * (ch + 1.5);
            fill(doc, [248,248,244]); draw(doc, [225,225,220]); doc.setLineWidth(0.25);
            doc.roundedRect(px, py, cw, ch, 1.8, 1.8, 'FD');
            text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(8.8); doc.text(st(it[0]), px + 2.5, py + 4.4);
            text(doc, [120,120,115]); doc.setFont(undefined, 'normal'); doc.setFontSize(5.8); doc.text(st(it[1]), px + 2.5, py + 7.6);
        });
        return y + Math.ceil(Math.min(d.stats.length, cols * 2) / cols) * 11;
    }

    function peaksBlock(doc, d, x, y, max, colors, w) {
        if (!d.peaks.length) return y;
        text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(6.5); doc.text('GIPFEL', x, y); y += 4;
        text(doc, [70,70,66]); doc.setFont(undefined, 'normal'); doc.setFontSize(6.7);
        if (d.peaks.length >= 5) {
            var gap = 5, colW = (w - gap) / 2;
            var left = d.peaks.filter(function (_, i) { return i % 2 === 0; });
            var right = d.peaks.filter(function (_, i) { return i % 2 === 1; });
            function drawColumn(items, colX) {
                var cy = y;
                items.forEach(function (p) {
                    var lines = wrap(doc, '• ' + p, colW, 6.7, 'normal');
                    doc.text(lines, colX, cy);
                    cy += lines.length * 3.6;
                });
                return cy;
            }
            return Math.max(drawColumn(left, x), drawColumn(right, x + colW + gap));
        }
        var cy = y;
        d.peaks.forEach(function (p) {
            var lines = wrap(doc, '• ' + p, w, 6.7, 'normal');
            doc.text(lines, x, cy);
            cy += lines.length * 3.6;
        });
        return cy;
    }

    function drawPerf(doc, d, x, y, w, colors) {
        if (!d.p) return y;

        var barX = x + Math.min(68, w * 0.43);
        var barW = Math.max(28, w - (barX - x));
        var description = d.pText.replace(/^\d+\s*\/\s*100\s*·\s*/, '');

        text(doc, colors.accent);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(6.6);
        doc.text('LEISTUNGSINDEX', x, y);

        text(doc, [45,45,42]);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(12.5);
        doc.text(st(d.p.score), x, y + 6);

        text(doc, [120,120,115]);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(6.0);
        doc.text(st(description), x + 14, y + 5.5);

        fill(doc, [232,232,228]);
        doc.roundedRect(barX, y + 3.1, barW, 2.2, 1.1, 1.1, 'F');

        fill(doc, colors.accent);
        doc.roundedRect(
            barX,
            y + 3.1,
            Math.max(2, Math.min(100, n(d.p.score)) / 100 * barW),
            2.2,
            1.1,
            1.1,
            'F'
        );

        return y + 10;
    }

    async function drawTour(doc, d, x, y, w, kind, colors) {
        var h = measure(getMeasureDoc(), d, w, kind), pad = 4, inner = w - 8, cursor = y + pad + 1;
        fill(doc, kind === 'feature' ? [249,248,244] : [252,251,248]);
        doc.roundedRect(x, y, w, h, 3, 3, 'F');
        rule(doc, x, y, Math.min(w, d.isBig ? 28 : 16), colors.accent, d.isBig ? 1.6 : 1);

        text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(kind === 'feature' ? 15 : 10.8);
        doc.text(st(d.title), x + pad, cursor + (kind === 'feature' ? 4 : 3.3));
        cursor += kind === 'feature' ? 9 : 7;
        text(doc, [112,112,108]); doc.setFont(undefined, 'normal'); doc.setFontSize(6.8);
        doc.text(st(d.date), x + pad, cursor);
        doc.text(st(d.difficulty + ' · ' + d.region), x + pad + 25, cursor);
        if (d.isBig) { text(doc, colors.accent2); doc.setFont(undefined, 'bold'); doc.text('BIG TOUR', x + w - pad, cursor, {align:'right'}); }
        cursor += 4.0;

        if (d.fullGradient) {
            text(doc, [135,105,80]); doc.setFontSize(6.6); doc.text('Berechnung mit voller Strecke', x + pad, cursor); cursor += 3.3;
        }
        if (d.cs.length) {
            text(doc, colors.accent2); doc.setFont(undefined, 'italic'); doc.setFontSize(6.7);
            cursor = addWrap(doc, d.cs.map(function(c){ return c.name + ' · ' + c.rank; }).join('   /   '), x + pad, cursor, inner, 6.7, 'italic', colors.accent2, 2.8) + 2;
        }

        if (kind === 'feature' && d.photo) {
            try {
                doc.addImage(await crop(d.e.imageData, 1200, Math.max(1, Math.round(1200 * 50 / inner)), 0.84), 'JPEG', x + pad, cursor, inner, 50, undefined, 'FAST');
                cursor += 53;
            } catch (_) {}
        } else if (kind === 'split' && d.photo) {
            var pw = Math.min(50, w * 0.34);
            var photoH = d.layout === 'compact' ? 31 : 43;
            try { doc.addImage(await crop(d.e.imageData, 700, Math.max(1, Math.round(700 * photoH / pw)), 0.84), 'JPEG', x + pad, cursor, pw, photoH, undefined, 'FAST'); } catch (_) {}
            statGrid(doc, d, x + pw + pad * 2, cursor, w - pw - pad * 3, 2, colors);
            cursor = Math.max(cursor + 23, cursor + photoH) + 2;
        }

        if (!(kind === 'split' && d.photo)) {
            text(doc, [42,42,39]);
            doc.setFont(undefined, 'bold');
            doc.setFontSize(kind === 'feature' ? 9.5 : 8.6);
            cursor = addWrap(
                doc,
                d.stats.map(function (s) { return s[0]; }).join('   ·   '),
                x + pad,
                cursor,
                inner,
                kind === 'feature' ? 9.5 : 8.6,
                'bold',
                [42,42,39],
                3.4
            ) + 2;
        }

        if (d.secondary.length) {
            cursor = addWrap(doc, d.secondary.join(' · '), x + pad, cursor, inner, 6.9, 'normal', [105,105,101], 2.8) + 3;
        }

        if (d.peaks.length) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 3.2;
            cursor = peaksBlock(doc, d, x + pad, cursor, kind === 'compact' ? 4 : 7, colors, inner) + 2;
        }

        if (d.extras.length) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 4;
            d.extras.forEach(function(ex){
                rule(doc, x + pad, cursor - 1.8, 8, colors.accent, 0.8);
                text(doc, [90,90,86]); doc.setFont(undefined, 'bold'); doc.setFontSize(6.5); doc.text(st(ex[0].toUpperCase()), x + pad + 11, cursor);
                cursor = addWrap(doc, ex[1], x + pad + 10, cursor + 2.8, inner - 10, 6.9, 'normal', [72,72,68], 2.8) + 2.5;
            });
        }

        if (d.startingPoint || d.profile) {
            draw(doc, [224,224,219]);
            doc.setLineWidth(0.25);
            doc.line(x + pad, cursor, x + w - pad, cursor);
            cursor += 3.2;

            if (d.startingPoint && d.profile) {
                var colW = (inner - 6) / 2;

                text(doc, [100,100,96]);
                doc.setFont(undefined, 'bold');
                doc.setFontSize(6.1);
                doc.text('AUSGANGSPUNKT', x + pad, cursor);

                text(doc, colors.accent);
                doc.setFont(undefined, 'bold');
                doc.setFontSize(6.1);
                doc.text('TOURPROFIL', x + pad + colW + 6, cursor);

                cursor += 2.8;

                var startY = cursor;
                var leftEnd = addWrap(
                    doc, d.startingPoint,
                    x + pad, startY, colW, 6.9, 'normal', [72,72,68], 2.8
                );
                var rightEnd = addWrap(
                    doc, d.profile,
                    x + pad + colW + 6, startY, colW, 6.9, 'normal', [72,72,68], 2.8
                );

                cursor = Math.max(leftEnd, rightEnd) + 2;
            } else if (d.startingPoint) {
                text(doc, [100,100,96]);
                doc.setFont(undefined, 'bold');
                doc.setFontSize(6.1);
                doc.text('AUSGANGSPUNKT', x + pad, cursor);
                cursor += 2.8;
                cursor = addWrap(doc, d.startingPoint, x + pad, cursor, inner, 6.9, 'normal', [72,72,68], 2.8) + 2;
            } else {
                text(doc, colors.accent);
                doc.setFont(undefined, 'bold');
                doc.setFontSize(6.4);
                doc.text('TOURPROFIL', x + pad, cursor);
                cursor += 3.2;
                cursor = addWrap(doc, d.profile, x + pad, cursor, inner, 7.0, 'normal', [72,72,68], 2.8) + 2;
            }
        }

        if (d.p) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 4;
            cursor = drawPerf(doc, d, x + pad, cursor, inner, colors);
        }

        if (d.notes) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 4;
            cursor = addWrap(doc, d.notes, x + pad, cursor, inner, 7.0, 'italic', [118,118,112], 2.7);
        }
        // Die Vorabmessung ist bewusst konservativ. Falls die Zeichenhöhe sie
        // dennoch überschreitet, mindestens die reale Höhe zurückmelden, damit
        // die nachfolgende Karte nicht auf Grundlage einer zu kleinen Höhe platziert wird.
        var actualHeight = cursor - y + 2;
        if (actualHeight > h) {
            console.warn('PDF-Tourkarte benötigt mehr Höhe als vorab gemessen:', d.title, {
                measured: h, actual: actualHeight
            });
        }
        return Math.max(h, actualHeight);
    }

    function addHeader(doc, label, colors) {
        var grad;
        try {
            grad = typeof window.createPdfGradientImage === 'function'
                ? window.createPdfGradientImage(colors.topHex, colors.bottomHex, 1200, 60, 'horizontal')
                : null;
        } catch (_) { grad = null; }
        if (grad) doc.addImage(grad, 'PNG', 0, 0, A4.w, 9, undefined, 'FAST');
        text(doc, [105,105,101]); doc.setFont(undefined, 'bold'); doc.setFontSize(6.7); doc.text('BERGTOUREN TRACKER', M, 19);
        doc.setFont(undefined, 'normal'); doc.text(st('TOURENBUCH ' + label), A4.w - M, 19, {align:'right'});
        rule(doc, M, 22, CW, colors.accent, 0.65);
    }

    function footer(doc, label) {
        var total = doc.getNumberOfPages();
        for (var i = 1; i <= total; i++) {
            doc.setPage(i); text(doc, [145,145,140]); doc.setFont(undefined, 'normal'); doc.setFontSize(6.5);
            var footerY = A4.h - 8;
            var footerColor = photoPageIndexes.has(i) ? [255,255,255] : [145,145,140];
            text(doc, footerColor);
            doc.text('Persönliches Bergtourenbuch', M, footerY);
            doc.text(st('Tourenbuch ' + label), A4.w / 2, footerY, {align:'center'});
            doc.text(st('Seite ' + i + ' / ' + total), A4.w - M, footerY, {align:'right'});
        }
    }

    async function cover(doc, entries, stats, label, colors, rep, options) {
        fill(doc, [255,255,253]); doc.rect(0,0,A4.w,A4.h,'F');
        if (rep && rep.imageData) {
            try {
                var bg = await cropFullBleed(rep.imageData, 1800, Math.round(1800 * A4.h / A4.w), 0.9);
                doc.addImage(bg, 'JPEG', 0, 0, A4.w, A4.h, undefined, 'FAST');
                photoPageIndexes.add(doc.getNumberOfPages());
                text(doc, [255,255,255]); doc.setFont(undefined, 'bold');
                doc.setFontSize(A4.w < 230 ? 23 : 31);
                doc.text(st('Mein Bergjahr ' + label), M, A4.h * 0.76);
                doc.setFont(undefined, 'normal'); doc.setFontSize(8.5);
                doc.text('Persönliches alpines Fotobuch', M, A4.h * 0.76 + 9);
                return;
            } catch (error) {
                console.warn('Titelbild konnte nicht verarbeitet werden:', error);
            }
        }
        rule(doc, M, 30, 7, colors.accent, 55);
        text(doc, [35,35,32]); doc.setFont(undefined, 'bold'); doc.setFontSize(25);
        doc.text(st('Mein Bergjahr ' + label), M + 13, 53);
        text(doc, [120,120,114]); doc.setFont(undefined, 'normal'); doc.setFontSize(9);
        doc.text('Persönliches alpines Fotobuch und Tourenchronik', M + 13, 62);
    }

    function buildCoverHighlights(entries, options) {
        options = options || getExportOptions();
        var longest = null, biggestAsc = null, fastest = null, mostSteps = null;
        var bestPerf = null, highestPeak = null;

        entries.forEach(function(entry) {
            var dist = parseFloat(String(entry.strecke || '').replace(',', '.')) || 0;
            var asc = parseFloat(String(entry.aufstieg || '').replace(',', '.')) || 0;
            var steps = typeof window.calculateEntrySteps === 'function'
                ? Number(window.calculateEntrySteps(entry)) || 0
                : 0;

            if (dist > 0 && (!longest || dist > longest.value)) longest = { value: dist, entry: entry };
            if (asc > 0 && (!biggestAsc || asc > biggestAsc.value)) biggestAsc = { value: asc, entry: entry };
            if (steps > 0 && (!mostSteps || steps > mostSteps.value)) mostSteps = { value: steps, entry: entry };

            if (options.secondary && dist > 0 && entry.zeit && entry.zeit.includes(':')) {
                var parts = entry.zeit.split(':').map(Number);
                var mins = parts[0] * 60 + parts[1];
                if (Number.isFinite(mins) && mins > 0) {
                    var speed = dist / (mins / 60);
                    if (!fastest || speed > fastest.value) fastest = { value: speed, entry: entry };
                }
            }

            if (options.performance && typeof window.calculatePerformanceIndex === 'function') {
                var perf = window.calculatePerformanceIndex(entry);
                if (perf && Number.isFinite(Number(perf.score)) &&
                    (!bestPerf || Number(perf.score) > bestPerf.value)) {
                    bestPerf = { value: Number(perf.score), entry: entry };
                }
            }

            if (Array.isArray(entry.gipfelDetails)) {
                entry.gipfelDetails.forEach(function(peak) {
                    var height = typeof window.parsePeakHeight === 'function'
                        ? window.parsePeakHeight(peak.hoehe)
                        : parseFloat(String(peak.hoehe || '').replace(',', '.')) || 0;
                    if (height > 0 && (!highestPeak || height > highestPeak.value)) {
                        highestPeak = {
                            value: height,
                            name: peak.name || 'Gipfel',
                            entry: entry
                        };
                    }
                });
            }
        });

        return [
            longest ? ['Längste Strecke', f1(longest.value) + ' km'] : null,
            biggestAsc ? ['Größter Aufstieg', fi(biggestAsc.value) + ' hm'] : null,
            highestPeak ? ['Höchster Gipfel', st(highestPeak.name) + ' · ' + fi(highestPeak.value) + ' m'] : null,
            fastest ? ['Schnellste Tour', f1(fastest.value) + ' km/h'] : null,
            mostSteps ? ['Meiste Schritte', fi(mostSteps.value) + ' Schritte'] : null,
            bestPerf ? ['Bester Leistungsindex', fi(bestPerf.value) + ' / 100'] : null
        ].filter(Boolean);
    }

    function coverStats(doc, stats, y, colors, entries, options) {
        var items = [
            ['Touren', fi(stats.totalTours)],
            ['Strecke', fi(stats.totalDistance) + ' km'],
            ['Aufstieg', fi(stats.totalAscent) + ' hm'],
            ['Gipfel', fi(stats.totalPeaks)]
        ];
        var gap = 4, w = (CW - gap * 3) / 4;
        items.forEach(function(it, i){
            var x = M + i * (w + gap);
            fill(doc, [248,248,244]); doc.roundedRect(x,y,w,24,2.8,2.8,'F');
            rule(doc,x,y,10,colors.accent,1);
            text(doc,[35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(13.4); doc.text(st(it[1]),x+4,y+11);
            text(doc,[125,125,120]); doc.setFont(undefined,'normal'); doc.setFontSize(6.7); doc.text(it[0],x+4,y+18);
        });
        text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8.1); doc.text('MEINE HIGHLIGHTS',M,y+39);

        var highlights = buildCoverHighlights(entries || [], options);
        var gapX = 4, colCount = 3, colW = (CW - gapX * 2) / colCount;
        highlights.slice(0, 6).forEach(function(item, i) {
            var col = i % colCount, row = Math.floor(i / colCount);
            var x = M + col * (colW + gapX), yy = y + 46 + row * 12;

            text(doc,[95,95,90]); doc.setFont(undefined,'normal'); doc.setFontSize(5.8);
            doc.text(st(item[0].toUpperCase()),x,yy);

            text(doc,[40,40,37]); doc.setFont(undefined,'bold'); doc.setFontSize(7.0);
            doc.text(st(item[1]),x,yy+5);
        });
    }

    function formatMilestoneTotal(key, total) {
        if (key === 'dist') return f1(total) + ' km';
        if (key === 'asc') return fi(total) + ' hm';
        if (key === 'time') {
            var mins = Math.round(n(total) * 60);
            var hours = Math.floor(mins / 60), rest = mins % 60;
            return hours + ' h ' + String(rest).padStart(2, '0') + ' min';
        }
        if (key === 'peaks') return fi(total) + ' Gipfel';
        if (key === 'steps') return fi(total) + ' Schritte';
        return fi(total);
    }

    function formatMilestoneTarget(value, key) {
        if (key === 'time') return f1(value) + ' h';
        if (key === 'dist') return f1(value) + ' km';
        if (key === 'asc') return fi(value) + ' hm';
        if (key === 'peaks') return fi(value) + ' Gipfel';
        if (key === 'steps') return fi(value) + ' Schritte';
        return fi(value);
    }

    function buildYearHighlights(entries, options) {
        options = options || getExportOptions();
        var longest = null, biggestAsc = null, bestPerf = null, highestPeak = null;

        entries.forEach(function (entry) {
            var dist = parseFloat(String(entry.strecke || '').replace(',', '.')) || 0;
            var asc = parseFloat(String(entry.aufstieg || '').replace(',', '.')) || 0;

            if (dist > 0 && (!longest || dist > longest.value)) longest = { value: dist, entry: entry };
            if (asc > 0 && (!biggestAsc || asc > biggestAsc.value)) biggestAsc = { value: asc, entry: entry };

            var perf = options.performance && typeof window.calculatePerformanceIndex === 'function'
                ? window.calculatePerformanceIndex(entry)
                : null;
            if (perf && Number.isFinite(Number(perf.score)) &&
                (!bestPerf || Number(perf.score) > bestPerf.value)) {
                bestPerf = { value: Number(perf.score), entry: entry };
            }

            if (Array.isArray(entry.gipfelDetails)) {
                entry.gipfelDetails.forEach(function (peak) {
                    var height = typeof window.parsePeakHeight === 'function'
                        ? window.parsePeakHeight(peak.hoehe)
                        : parseFloat(String(peak.hoehe || '').replace(',', '.')) || 0;
                    if (height > 0 && (!highestPeak || height > highestPeak.value)) {
                        highestPeak = {
                            value: height,
                            name: peak.name || 'Gipfel',
                            entry: entry
                        };
                    }
                });
            }
        });

        return { longest: longest, biggestAsc: biggestAsc, bestPerf: bestPerf, highestPeak: highestPeak };
    }

    function yearOpeningPage(doc, entries, stats, label, colors, options) {
        doc.addPage();
        addHeader(doc, label, colors);
        text(doc, [35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(20);
        doc.text('Das Bergjahr in Zahlen', M, 38);
        text(doc, [120,120,114]); doc.setFont(undefined,'normal'); doc.setFontSize(7.5);
        doc.text(st(entries.length + ' Touren · ' + label + ' · Persönliche Highlights'), M, 45);
        coverStats(doc, stats, 55, colors, entries, options);
    }

    function summary(doc, entries, stats, label, colors, options) {
        options = options || getExportOptions();
        addHeader(doc, label, colors);
        text(doc,[35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(19); doc.text('Saisonbilanz',M,36);
        text(doc,colors.accent); doc.setFontSize(8); doc.text(st(fi(stats.totalTours)+' Touren · '+f1(stats.totalDistance)+' km · '+fi(stats.totalAscent)+' hm'),M,43);

        var items = [
            ['Gehzeit', stats.totalTimeText ? stats.totalTimeText+' h' : '–'],
            ['Schritte', stats.totalSteps > 0 ? fi(stats.totalSteps) : '–'],
            ['Big Tours', fi(stats.bigTours)],
            ['Ø Speed', stats.avgSpeed > 0 ? f1(stats.avgSpeed)+' km/h' : '–'],
            ['Ø Steigung', stats.avgGradient > 0 ? fi(stats.avgGradient)+' hm/km' : '–'],
            ['Ø Anstieg/h', stats.avgAscentPerHour > 0 ? fi(stats.avgAscentPerHour)+' hm/h' : '–']
        ].filter(function(item) {
            return options.secondary || ['Ø Speed', 'Ø Steigung', 'Ø Anstieg/h'].indexOf(item[0]) === -1;
        });

        var gap=5,w=(CW-gap*2)/3;
        items.forEach(function(it,i){
            var x=M+(i%3)*(w+gap), y=51+Math.floor(i/3)*29;
            fill(doc,[248,248,244]); doc.roundedRect(x,y,w,24,2.6,2.6,'F');
            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(15); doc.text(st(it[1]),x+5,y+11);
            text(doc,[122,122,116]); doc.setFont(undefined,'normal'); doc.setFontSize(6.7); doc.text(it[0],x+5,y+18);
        });

        var extra = [
            ['Gipfel 2000–2499 m',fi(stats.peaks2000)],
            ['Gipfel 2500–2999 m',fi(stats.peaks2500)],
            ['Gipfel ab 3000 m',fi(stats.peaks3000)],
            ['Ø Leistungsindex',Number.isFinite(Number(stats.avgPerformanceIndex)) ? fi(stats.avgPerformanceIndex)+' / 100' : '–']
        ].filter(function(row) {
            return options.performance || row[0] !== 'Ø Leistungsindex';
        });
        var y=117;
        text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8.4); doc.text('WEITERE KENNZAHLEN',M,y); y+=6;
        extra.forEach(function(row,i){
            var x=M+(i%2)*92, yy=y+Math.floor(i/2)*12;
            text(doc,[90,90,86]); doc.setFont(undefined,'normal'); doc.setFontSize(7.6); doc.text(row[0],x,yy);
            text(doc,[38,38,35]); doc.setFont(undefined,'bold'); doc.text(row[1],x+66,yy,{align:'right'});
        });

        if (options.milestones && typeof window.computeMilestones === 'function') {
            var ms=window.computeMilestones(entries);
            var defs=[
                ['Strecke','dist'],
                ['Aufstieg','asc'],
                ['Gehzeit','time'],
                ['Gipfel','peaks'],
                ['Schritte','steps']
            ];

            y+=31;
            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8.4); doc.text('MEILENSTEINE',M,y); y+=7;

            defs.forEach(function(d,i){
                var x=M+(i%2)*92, yy=y+Math.floor(i/2)*22, data=ms[d[1]];
                if(!data) return;

                var reached=Array.isArray(data.reached)?data.reached.length:0;
                var progress=1;
                if(data.next!==null && Number.isFinite(Number(data.next))){
                    var prev=reached ? Number(data.reached[reached-1].milestone) : 0;
                    progress=Math.max(0,Math.min(1,
                        (n(data.total)-prev) / Math.max(1,n(data.next)-prev)
                    ));
                }

                text(doc,[65,65,60]); doc.setFont(undefined,'bold'); doc.setFontSize(7.1); doc.text(d[0],x,yy);
                text(doc,[38,38,35]); doc.setFont(undefined,'bold'); doc.setFontSize(10.5);
                doc.text(formatMilestoneTotal(d[1],data.total),x,yy+6.5);

                text(doc,[135,135,130]); doc.setFont(undefined,'normal'); doc.setFontSize(6.1);
                var sub = reached + ' Meilensteine';
                if(data.next!==null && Number.isFinite(Number(data.next))){
                    sub += ' · noch ' + formatMilestoneTarget(Math.max(0,n(data.next)-n(data.total)), d[1]);
                    sub += ' bis ' + formatMilestoneTarget(data.next, d[1]);
                } else {
                    sub += ' · alle Stufen erreicht';
                }
                doc.text(st(sub),x,yy+10.5);

                fill(doc,[231,231,227]); doc.roundedRect(x,yy+13.5,84,2.2,1.1,1.1,'F');
                fill(doc,colors.accent); doc.roundedRect(x,yy+13.5,Math.max(2,84*progress),2.2,1.1,1.1,'F');
            });
        }
    }

    function yearsPage(doc, from, to, colors, options) {
        options = options || getExportOptions();
        var label=from+'–'+to;
        addHeader(doc,label,colors);
        text(doc,[35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(19); doc.text('Jahresrückblick',M,36);
        text(doc,[120,120,114]); doc.setFont(undefined,'normal'); doc.setFontSize(7.2);
        doc.text(st('Die wichtigsten Kennzahlen und persönlichen Highlights pro Jahr'),M,43);

        var years=[];
        for(var year=from;year<=to;year++){
            var es=typeof window.getToursInYearRange==='function'?window.getToursInYearRange(year,year):[];
            if(es.length) years.push({year:year,entries:es,stats:window.computeStatsSummary(es)});
        }

        var gap=6, cardW=(CW-gap)/2, cardH=53, top=49;
        years.forEach(function(item,i){
            var col=i%2, row=Math.floor(i/2), x=M+col*(cardW+gap), y=top+row*(cardH+gap);
            var s=item.stats, h=buildYearHighlights(item.entries, options);

            fill(doc,[249,248,244]); doc.roundedRect(x,y,cardW,cardH,3,3,'F');
            rule(doc,x,y,18,colors.accent,1.2);

            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(15); doc.text(String(item.year),x+5,y+10);
            text(doc,[45,45,42]); doc.setFont(undefined,'bold'); doc.setFontSize(7.2);
            doc.text(st(fi(s.totalTours)+' Touren · '+f1(s.totalDistance)+' km'),x+5,y+17);
            text(doc,[115,115,110]); doc.setFont(undefined,'normal'); doc.setFontSize(6.1);
            doc.text(st(fi(s.totalAscent)+' hm · '+s.totalTimeText+' h Gehzeit'),x+5,y+22);

            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(6.1); doc.text('DURCHSCHNITT',x+5,y+29);
            text(doc,[85,85,81]); doc.setFont(undefined,'normal'); doc.setFontSize(6.0);
            var avgLine='Ø '+f1(s.avgDistance)+' km/Tour · '+fi(s.avgAscent)+' hm/Tour';
            if(options.performance && Number.isFinite(Number(s.avgPerformanceIndex))) avgLine += ' · PI '+fi(s.avgPerformanceIndex);
            doc.text(st(avgLine),x+5,y+34);

            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(6.1); doc.text('HIGHLIGHTS',x+5,y+41);
            text(doc,[78,78,74]); doc.setFont(undefined,'normal'); doc.setFontSize(5.9);

            var lines=[];
            if(h.longest) lines.push('Längste Tour: '+st(h.longest.entry.tourname||'–')+' · '+f1(h.longest.value)+' km');
            if(h.highestPeak) lines.push('Höchster Gipfel: '+st(h.highestPeak.name)+' · '+fi(h.highestPeak.value)+' m');
            if(!lines.length && h.biggestAsc) lines.push('Größter Aufstieg: '+st(h.biggestAsc.entry.tourname||'–')+' · '+fi(h.biggestAsc.value)+' hm');
            if(lines.length===1 && h.biggestAsc && (!h.highestPeak)) lines.push('Größter Aufstieg: '+st(h.biggestAsc.entry.tourname||'–')+' · '+fi(h.biggestAsc.value)+' hm');
            if(lines.length===0 && h.bestPerf) lines.push('Bester Leistungsindex: '+fi(h.bestPerf.value)+' / 100');
            lines.slice(0,2).forEach(function(line,j){ doc.text(st(line),x+5,y+47+j*4); });
        });
    }


    function readSummitAssignmentsForTour(entry, options) {
        if (!options.summitPhotos || !entry || !entry.id) return [];
        try {
            var all = typeof appStorage !== 'undefined' ? (appStorage.get('summitPhotoAssignments.v1') || {}) : {};
            return Object.keys(all).map(function(uri) {
                var item = all[uri];
                if (!item || String(item.tourId || '') !== String(entry.id)) return null;
                var peaks = Array.isArray(entry.gipfelDetails) ? entry.gipfelDetails : [];
                var peak = null;
                if (item.peakName) peak = peaks.find(function(p) {
                    return String(p.name || '').trim().toLowerCase() === String(item.peakName).trim().toLowerCase();
                });
                if (!peak && item.peakIndex !== null && item.peakIndex !== undefined &&
                    Number.isInteger(Number(item.peakIndex))) peak = peaks[Number(item.peakIndex)];
                if (item.peakName && !peak) return null;
                if (item.peakName && peak && String(peak.name || '').trim().toLowerCase() !== String(item.peakName).trim().toLowerCase()) {
                    return null;
                }
                return { uri: uri, peakName: item.peakName || (peak && peak.name) || 'Gipfel', peakHeight: item.peakHeight || (peak && peak.hoehe) || 0 };
            }).filter(Boolean);
        } catch (error) {
            console.warn('Gipfelfoto-Zuordnungen konnten nicht gelesen werden.', error);
            return [];
        }
    }

    async function loadEntryPhotoAssets(entry, options) {
        var assets = [];
        if (options.photos && entry.imageData) assets.push({ src: entry.imageData, label: 'Hauptfoto' });

        if (options.galleryPhotos && Array.isArray(entry.galleryPhotos) &&
            typeof window.__tourGalleryLoadPhotoFull === 'function') {
            var gallery = entry.galleryPhotos.filter(function(item) {
                return item && item.mediaType === 'photo' && item.uri;
            });
            for (var i = 0; i < gallery.length; i++) {
                try {
                    var src = await window.__tourGalleryLoadPhotoFull(gallery[i]);
                    if (src) assets.push({ src: src, label: 'Tourfoto ' + (i + 1) });
                } catch (_) {}
            }
        }

        if (options.summitPhotos && typeof window.__androidNativeRequest === 'function') {
            var summit = readSummitAssignmentsForTour(entry, options);
            for (var j = 0; j < summit.length; j++) {
                try {
                    var result = await window.__androidNativeRequest('gallery.summit.folder.full', { uri: summit[j].uri }, 45000);
                    if (result && result.status === 'ok' && result.data) {
                        assets.push({
                            src: 'data:' + (result.mimeType || 'image/jpeg') + ';base64,' + result.data,
                            label: summit[j].peakName + (summit[j].peakHeight ? ' · ' + fi(summit[j].peakHeight) + ' m' : '')
                        });
                    }
                } catch (error) {
                    console.warn('Zugeordnetes Gipfelfoto konnte nicht geladen werden.', error);
                }
            }
        }
        return assets;
    }

    async function drawPhotoStory(doc, d, assets, colors) {
        if (!assets.length) return;
        var hero = assets[0];
        try {
            var heroData = await cropFullBleed(hero.src, 1800, Math.round(1800 * A4.h / A4.w), 0.91);
            doc.addPage();
            doc.addImage(heroData, 'JPEG', 0, 0, A4.w, A4.h, undefined, 'FAST');
            photoPageIndexes.add(doc.getNumberOfPages());
            text(doc, [255,255,255]); doc.setFont(undefined, 'bold');
            doc.setFontSize(A4.w < 230 ? 21 : 29);
            var titleLines = wrap(doc, d.title, A4.w - M * 2, A4.w < 230 ? 21 : 29, 'bold').slice(0,2);
            doc.text(titleLines, M, A4.h - 42);
            doc.setFont(undefined, 'normal'); doc.setFontSize(8);
            doc.text(st(d.date + ' · ' + d.difficulty + ' · ' + d.region), M, A4.h - 29);
            var statLine = d.e.strecke ? f1(d.e.strecke) + ' km' : '';
            if (d.e.aufstieg) statLine += (statLine ? '  ·  ' : '') + fi(d.e.aufstieg) + ' hm';
            if (d.e.zeit) statLine += (statLine ? '  ·  ' : '') + st(d.e.zeit) + ' h';
            doc.setFont(undefined, 'bold'); doc.setFontSize(10);
            if (statLine) doc.text(st(statLine), M, A4.h - 18);
        } catch (error) {
            console.warn('Fotoseite konnte nicht gezeichnet werden:', error);
        }

        for (var start = 1; start < assets.length; start += 3) {
            var group = assets.slice(start, start + 3);
            var heroW = A4.w * 0.62, sideW = A4.w - heroW;
            var tiles = [
                { x: 0, y: 0, w: heroW - 1.2, h: A4.h },
                { x: heroW, y: 0, w: sideW, h: group.length > 1 ? A4.h * 0.495 : A4.h }
            ];
            if (group.length > 2) tiles.push({ x: heroW, y: A4.h * 0.505, w: sideW, h: A4.h * 0.495 });
            var tileImages = [];
            for (var loadIndex = 0; loadIndex < group.length; loadIndex++) {
                try {
                    var loadTile = tiles[loadIndex];
                    tileImages[loadIndex] = await cropFullBleed(group[loadIndex].src, 1200, Math.max(1, Math.round(1200 * loadTile.h / loadTile.w)), 0.9);
                } catch (_) { tileImages[loadIndex] = null; }
            }
            if (!tileImages.some(Boolean)) continue;
            doc.addPage();
            for (var k = 0; k < group.length; k++) {
                try {
                    var tile = tiles[k];
                    if (!tileImages[k]) continue;
                    doc.addImage(tileImages[k], 'JPEG', tile.x, tile.y, tile.w, tile.h, undefined, 'FAST');
                    text(doc, [255,255,255]); doc.setFont(undefined, 'bold'); doc.setFontSize(7.5);
                    doc.text(st(group[k].label || 'Tourfoto'), tile.x + 4, tile.y + tile.h - 5);
                } catch (error) {
                    console.warn('Fotocollage-Bild konnte nicht gezeichnet werden:', error);
                }
            }
            photoPageIndexes.add(doc.getNumberOfPages());
        }
    }

    function monthKey(entry) {
        var raw = String(entry && entry.date || '');
        var match = raw.match(/^(\\d{4})-(\\d{2})/);
        if (match) return match[1] + '-' + match[2];
        match = raw.match(/^(\\d{1,2})[.\\/]([0-9]{1,2})[.\\/](\\d{4})$/);
        return match ? match[3] + '-' + String(match[2]).padStart(2,'0') : '';
    }

    function monthlyPage(doc, entries, label, colors) {
        doc.addPage(); addHeader(doc, label, colors);
        text(doc, [35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(19);
        doc.text('Das Bergjahr im Monatsverlauf', M, 36);
        var names = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
        var rows = {};
        entries.forEach(function(entry) {
            var key = monthKey(entry); if (!key) return;
            var month = Number(key.slice(5,7)); if (!month) return;
            if (!rows[month]) rows[month] = { tours:0, distance:0, ascent:0 };
            rows[month].tours++;
            rows[month].distance += n(entry.strecke);
            rows[month].ascent += n(entry.aufstieg);
        });
        var colW = (CW - 12) / 3;
        for (var i=1;i<=12;i++) {
            var item = rows[i] || {tours:0,distance:0,ascent:0};
            var col=(i-1)%3, row=Math.floor((i-1)/3), x=M+col*(colW+6), y=49+row*34;
            fill(doc,[248,248,244]); doc.roundedRect(x,y,colW,29,2.5,2.5,'F');
            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8); doc.text(names[i-1],x+4,y+7);
            text(doc,[42,42,39]); doc.setFontSize(10); doc.text(String(item.tours)+' Touren',x+4,y+16);
            text(doc,[115,115,110]); doc.setFont(undefined,'normal'); doc.setFontSize(6.5);
            doc.text(f1(item.distance)+' km  ·  '+fi(item.ascent)+' hm',x+4,y+23);
        }
    }

    function peakOverviewPage(doc, entries, label, colors) {
        var peaks = new Map();
        entries.forEach(function(entry) {
            (Array.isArray(entry.gipfelDetails) ? entry.gipfelDetails : []).forEach(function(peak) {
                var name=st(peak && peak.name); if (!name) return;
                var height=n(String(peak.hoehe || '').replace(/[^0-9,.]/g,'').replace(',','.'));
                var key=name.toLowerCase();
                if (!peaks.has(key) || height>peaks.get(key).height) peaks.set(key,{name:name,height:height});
            });
        });
        var list=Array.from(peaks.values()).sort(function(a,b){return b.height-a.height;});
        var perColumn=Math.max(1,Math.floor((SAFE_BOTTOM-54)/8));
        var perPage=perColumn*2;
        var pageCount=Math.max(1,Math.ceil(list.length/perPage));
        for(var pageIndex=0;pageIndex<pageCount;pageIndex++){
            doc.addPage(); addHeader(doc,label,colors);
            text(doc,[35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(19);
            doc.text('Meine Gipfel',M,36);
            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8);
            doc.text(list.length+' unterschiedliche Gipfel',M,43);
            var start=pageIndex*perPage, subset=list.slice(start,start+perPage);
            subset.forEach(function(peak,i) {
                var col=Math.floor(i/perColumn), row=i%perColumn;
                var colW=(CW-8)/2, x=M+col*(colW+8), py=52+row*8;
                text(doc,[55,55,51]); doc.setFont(undefined,'normal'); doc.setFontSize(7.2);
                doc.text(st(peak.name),x,py);
                text(doc,colors.accent); doc.setFont(undefined,'bold');
                doc.text(peak.height?fi(peak.height)+' m':'–',x+colW,py,{align:'right'});
            });
        }
    }

    function kindFor(d){
        // Magazin und Kompakt behalten zwei Spalten; Detail zeigt eine breite Karte je Zeile.
        return d.photo ? 'split' : 'compact';
    }

    async function renderTours(doc, entries, from, to, colors, options) {
        options = options || getExportOptions();
        var profile=typeof window.buildTourProfileAnalysis==='function'?window.buildTourProfileAnalysis(entries):null;
        var ds=entries.map(function(e){return dataFor(e,profile,options);});
        var bookProfile=options.profile || 'premium';
        var detail=bookProfile !== 'chronicle';
        var colGap=detail?0:5,colW=detail?CW:(CW-colGap)/2,colY=detail?[28]:[28,28];
        function page(){
            doc.addPage(); addHeader(doc,from===to?String(from):from+'–'+to,colors);
            colY=detail?[28]:[28,28];
        }
        if (bookProfile !== 'premium') page();
        for(var i=0;i<ds.length;i++){
            var d=ds[i];
            var assets=await loadEntryPhotoAssets(d.e,options);
            if (bookProfile === 'premium') {
                if (assets.length) await drawPhotoStory(doc,d,assets,colors);
                page();
                d.photo=false;
                var featureHeight=measure(getMeasureDoc(),d,CW,'feature');
                if (featureHeight > SAFE_BOTTOM - 28) {
                    console.warn('Umfangreiche Tourdetails benötigen möglicherweise Zusatzseiten:',d.title);
                }
                await drawTour(doc,d,M,28,CW,'feature',colors);
                continue;
            }
            var extraAssets=assets.slice(d.photo ? 1 : 0);
            if (extraAssets.length) await drawPhotoStory(doc,d,extraAssets,colors);
            var actual=detail?'feature':kindFor(d);
            var h=measure(getMeasureDoc(),d,colW,actual);
            var col=detail?0:(colY[0]<=colY[1]?0:1);
            if(colY[col]+h>SAFE_BOTTOM){
                if(detail){ page(); col=0; }
                else {
                    var other=1-col;
                    if(colY[other]+h<=SAFE_BOTTOM) col=other;
                    else { page(); col=0; }
                }
            }
            var x=M+col*(colW+colGap), y=colY[col];
            var drawnH=await drawTour(doc,d,x,y,colW,actual,colors);
            colY[col]=y+drawnH+GAP;
        }
    }

    async function generate(from,to){
        if(typeof window.showToast==='function')window.showToast('PDF-Export wird vorbereitet…',{type:'info',duration:2500});
        await ensurePdfLibraries();
        var options = getExportOptions();
        configurePage(options.format);
        var js=window.jspdf.jsPDF, doc=new js({unit:'mm',format:[A4.w,A4.h]}), colors=colorsForExport(tc(), options.style);
        // Die Reihenfolge aus der App-Datenquelle bleibt unverändert im PDF erhalten.
        var entries=window.getToursInYearRange(from,to), label=from===to?String(from):from+'–'+to;
        if ((options.photos || options.coverPhoto) && typeof window.loadTourImagesForEntries === 'function') {
            await window.loadTourImagesForEntries(entries);
        }
        if(typeof window.showToast==='function') window.showToast('Magazin-Tourenbuch wird erstellt…',{type:'info',duration:2500});
        if(!entries.length){
            await cover(doc,[],{totalTours:0,totalDistance:0,totalAscent:0,totalPeaks:0,totalSteps:0,totalTimeText:'0:00',bigTours:0},label,colors,null,options);
            footer(doc,label); await save(doc,from,to); return;
        }
        var stats=window.computeStatsSummary(entries), rep=options.coverPhoto ? (typeof window.getPdfRepresentativePhoto==='function'?window.getPdfRepresentativePhoto(entries):entries.find(function(e){return e.imageData;})||null) : null;
        await cover(doc,entries,stats,label,colors,rep,options);
        yearOpeningPage(doc,entries,stats,label,colors,options);
        doc.addPage(); summary(doc,entries,stats,label,colors,options);
        if(from!==to){ doc.addPage(); yearsPage(doc,from,to,colors,options); }
        if(options.monthly) monthlyPage(doc,entries,label,colors);
        if(options.peakOverview) peakOverviewPage(doc,entries,label,colors);
        await renderTours(doc,entries,from,to,colors,options);
        if(options.closing){
            var finalPhoto=null;
            for(var fiIndex=entries.length-1;fiIndex>=0&&!finalPhoto;fiIndex--){
                var finalEntry=entries[fiIndex];
                if(finalEntry.imageData) finalPhoto=finalEntry.imageData;
                else if(options.galleryPhotos&&Array.isArray(finalEntry.galleryPhotos)&&finalEntry.galleryPhotos.length&&typeof window.__tourGalleryLoadPhotoFull==='function'){
                    finalPhoto=await window.__tourGalleryLoadPhotoFull(finalEntry.galleryPhotos[0]);
                }
            }
            if(finalPhoto){
                doc.addPage();
                var closingBg=await cropFullBleed(finalPhoto,1600,Math.round(1600*A4.h/A4.w),0.9);
                doc.addImage(closingBg,'JPEG',0,0,A4.w,A4.h,undefined,'FAST');
                photoPageIndexes.add(doc.getNumberOfPages());
                text(doc,[255,255,255]);doc.setFont(undefined,'bold');doc.setFontSize(25);
                doc.text('Bis zum nächsten Gipfel.',M,A4.h*0.78);
                doc.setFont(undefined,'normal');doc.setFontSize(8);
                doc.text(st(fi(stats.totalTours)+' Touren · '+f1(stats.totalDistance)+' km · '+fi(stats.totalAscent)+' hm'),M,A4.h*0.78+9);
            }
        }
        footer(doc,label); await save(doc,from,to);
    }

    async function save(doc,from,to){
        var filename=from===to?'tourenbuch-'+from+'.pdf':'tourenbuch-'+from+'-'+to+'.pdf';
        var blob=doc.output('blob');

        // Android-WebView unterstützt den normalen Download eines blob:-Links nicht zuverlässig.
        // Die APK übergibt das fertige PDF deshalb an den nativen Speicherdialog.
        if(typeof window.saveTourPdfNative==='function'){
            var nativeResult=await window.saveTourPdfNative(blob,filename);
            if(nativeResult&&nativeResult.handled){
                if(nativeResult.cancelled)return;
                if(!nativeResult.saved)throw new Error('Android hat das Speichern der PDF-Datei nicht bestätigt.');
                if(typeof window.showToast==='function'){
                    window.showToast('PDF wurde gespeichert: '+(nativeResult.fileName||filename),{type:'success',duration:3500});
                }
                return;
            }
        }
        if(document.documentElement.classList.contains('android-native-shell')){
            throw new Error('Die native Android-PDF-Schnittstelle ist nicht verfügbar. Bitte die aktuelle APK-Version installieren.');
        }

        // Browser/PWA: Freigabe oder klassischer Download wie bisher.
        var file=new File([blob],filename,{type:'application/pdf'});
        try{
            if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
                navigator.share({files:[file],title:filename}).catch(function(err){if(!err||err.name!=='AbortError')download(blob,filename);});
                return;
            }
        }catch(_){}
        download(blob,filename);
    }
    function download(blob,filename){
        var url=URL.createObjectURL(blob), a=document.createElement('a');
        a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1200);
    }

    window.generateTourbookPdf=generate;

    function bind(){
        var b=document.getElementById('pdf-export-run-btn');
        if(!b||b.dataset.magazineBound==='1')return;
        b.dataset.magazineBound='1';
        b.addEventListener('click',function(e){
            e.preventDefault();e.stopImmediatePropagation();
            var range=document.getElementById('pdf-export-range-panel'), isRange=range&&!range.classList.contains('is-hidden'), from,to;
            if(isRange){
                from=Number(document.getElementById('pdf-export-year-from')&&document.getElementById('pdf-export-year-from').value);
                to=Number(document.getElementById('pdf-export-year-to')&&document.getElementById('pdf-export-year-to').value);
                if(!from||!to){if(typeof window.showToast==='function')window.showToast('Bitte Start- und Endjahr auswählen.',{type:'error',duration:2600});return;}
                if(from>to){var t=from;from=to;to=t;}
            }else{
                from=Number(document.getElementById('pdf-export-year')&&document.getElementById('pdf-export-year').value);to=from;
                if(!from){if(typeof window.showToast==='function')window.showToast('Bitte ein Jahr auswählen.',{type:'error',duration:2600});return;}
            }
            generate(from,to).catch(function(err){
                console.error('PDF-Magazin:',err);
                var detail = err && err.message ? String(err.message) : '';
                if(typeof window.showToast==='function')window.showToast(
                    detail ? 'PDF-Erstellung fehlgeschlagen: '+detail : 'PDF konnte nicht erstellt werden.',
                    {type:'error',duration:6000}
                );
            });
        },true);
    }

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
    console.info('PDF-Magazin-Layout aktiviert.');
})();