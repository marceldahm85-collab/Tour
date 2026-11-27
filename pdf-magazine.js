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

    // Tourbuch-PDF: exakt die im Theme-Editor aktive Schriftfamilie einbetten.
    // jsPDF benötigt TrueType-Dateien; die App-Webfonts bleiben davon unabhängig.
    var pdfFontBinaryCache = Object.create(null);
    var PDF_FONT_DEFINITIONS = {
        inter: { file: 'inter-variable.ttf', family: 'BergtourenInter' },
        'space-grotesk': { file: 'space-grotesk-variable.ttf', family: 'BergtourenSpaceGrotesk' },
        oswald: { file: 'oswald-variable.ttf', family: 'BergtourenOswald' },
        'playfair-display-sc-bold': { file: 'playfair-display-sc-bold.ttf', family: 'BergtourenPlayfairDisplaySCBold' },
        cinzel: { file: 'cinzel-variable.ttf', family: 'BergtourenCinzel' },
        urbanist: { file: 'urbanist-variable.ttf', family: 'BergtourenUrbanist' },
        'marcellus-sc': { file: 'marcellus-sc.ttf', family: 'BergtourenMarcellusSC' },
        'castoro-titling': { file: 'castoro-titling.ttf', family: 'BergtourenCastoroTitling' }
    };

    function getSelectedPdfFontKey() {
        var selected = '';
        try {
            if (typeof window.getThemeEditorFontName === 'function') {
                selected = window.getThemeEditorFontName();
            }
        } catch (_) {}
        if (!selected && document.body) selected = document.body.dataset.font || '';
        return Object.prototype.hasOwnProperty.call(PDF_FONT_DEFINITIONS, selected)
            ? selected
            : 'inter';
    }

    async function loadPdfFontBinary(fileName) {
        if (pdfFontBinaryCache[fileName]) return pdfFontBinaryCache[fileName];

        var response = await fetch('./fonts/' + fileName, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error('Die Schriftdatei für das Tourbuch-PDF konnte nicht geladen werden: ' + fileName);
        }

        var bytes = new Uint8Array(await response.arrayBuffer());
        var binary = '';
        var chunkSize = 0x8000;
        for (var offset = 0; offset < bytes.length; offset += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
        }
        if (!binary.length) throw new Error('Die Schriftdatei ist leer: ' + fileName);

        pdfFontBinaryCache[fileName] = binary;
        return binary;
    }

    async function applySelectedPdfFont(doc, fontKey) {
        var definition = PDF_FONT_DEFINITIONS[fontKey] || PDF_FONT_DEFINITIONS.inter;
        var fileName = definition.file;
        var family = definition.family;
        var binary = await loadPdfFontBinary(fileName);
        var vfsName = 'Bergtouren-' + fileName;

        doc.addFileToVFS(vfsName, binary);
        // jsPDF schaltet bei Überschriften/Betonungen zwischen normal, bold
        // und italic um. Alle Varianten bleiben in derselben gewählten Familie.
        ['normal', 'bold', 'italic', 'bolditalic'].forEach(function(style) {
            doc.addFont(vfsName, family, style);
        });
        doc.setFont(family, 'normal');
        return family;
    }

    var A4 = { w: 297, h: 210 };
    var M = 12;
    var CW = A4.w - M * 2;
    var SAFE_BOTTOM = A4.h - 15;
    var GAP = 3;
    var photoPageIndexes = new Set();
    var footerExcludedPageIndexes = new Set();
    var photoAssetsByTour = new WeakMap();

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
            img.crossOrigin = 'anonymous';
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
            coverTitle: (document.getElementById('pdf-book-opt-cover-title') || {}).value || 'Mein Bergjahr {year}',
            closingTitle: (document.getElementById('pdf-book-opt-closing-title') || {}).value || 'Bis zum nächsten Gipfel.',
            coverPhotoChoice: (document.getElementById('pdf-book-opt-cover-photo-choice') || {}).value || 'auto',
            closingPhotoChoice: (document.getElementById('pdf-book-opt-closing-photo-choice') || {}).value || 'auto',
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
        footerExcludedPageIndexes = new Set();
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
            m.speed != null ? 'Ø Speed: ' + f1(m.speed) + ' km/h' : null,
            m.gradient != null ? 'Ø Steigung: ' + fi(m.gradient) + ' hm/km' : null,
            m.ascentRate != null ? 'Ø Anstieg: ' + fi(m.ascentRate) + ' hm/h' : null
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

    function drawOutlinedAccentText(doc, value, x, y, size, colors, align) {
        var label = st(value);
        doc.setFont(undefined, 'bold'); doc.setFontSize(size);
        text(doc, [255,255,255]);
        [[-0.55,0],[0.55,0],[0,-0.55],[0,0.55],[-0.4,-0.4],[0.4,-0.4],[-0.4,0.4],[0.4,0.4]].forEach(function(o) {
            doc.text(label, x + o[0], y + o[1], {align: align || 'center'});
        });
        text(doc, colors.accent); doc.text(label, x, y, {align: align || 'center'});
    }

    function mixRgb(base, tint, amount) {
        return base.map(function(value, index) {
            return Math.round(value * (1 - amount) + (tint[index] || 0) * amount);
        });
    }

    function drawAccentTile(doc, x, y, w, h, colors, amount) {
        var neutral = [248,248,244], first = mixRgb(neutral, colors.accent, amount || 0.10);
        var second = mixRgb(neutral, colors.accent2 || colors.accent, (amount || 0.10) * 0.72);
        fill(doc, neutral);
        doc.roundedRect(x, y, w, h, 2.2, 2.2, 'F');
        var inset = 0.65, innerX = x + inset, innerY = y + inset;
        var innerW = Math.max(0, w - inset * 2), innerH = Math.max(0, h - inset * 2);
        var segments = 14;
        for (var i = 0; i < segments; i++) {
            var t = i / (segments - 1);
            var tint = first.map(function(value, index) {
                return Math.round(value * (1 - t) + second[index] * t);
            });
            fill(doc, tint);
            var segmentW = innerW / segments;
            doc.rect(innerX + i * segmentW, innerY, segmentW + 0.08, innerH, 'F');
        }
        draw(doc, [218,218,211]); doc.setLineWidth(0.25);
        doc.roundedRect(x, y, w, h, 2.2, 2.2, 'S');
    }

    function footer(doc, label) {
        var total = doc.getNumberOfPages();
        for (var i = 1; i <= total; i++) {
            if (footerExcludedPageIndexes.has(i)) continue;
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
        footerExcludedPageIndexes.add(doc.getNumberOfPages());
        var title = st(String(options.coverTitle || 'Mein Bergjahr {year}').replace(/\{year\}/gi, label)) || ('Mein Bergjahr ' + label);
        fill(doc,[255,255,253]); doc.rect(0,0,A4.w,A4.h,'F');
        if (rep && rep.imageData) {
            try {
                var bg=await cropFullBleed(rep.imageData,1800,Math.round(1800*A4.h/A4.w),0.9);
                doc.addImage(bg,'JPEG',0,0,A4.w,A4.h,undefined,'FAST');
                photoPageIndexes.add(doc.getNumberOfPages());
                drawOutlinedAccentText(doc,title,A4.w/2,A4.h*0.76,A4.w<230?25:36,colors,'center');
                return;
            } catch(error) { console.warn('Titelbild konnte nicht verarbeitet werden:',error); }
        }
        rule(doc,M,30,7,colors.accent,55);
        drawOutlinedAccentText(doc,title,A4.w/2,A4.h*0.48,A4.w<230?24:34,colors,'center');
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
        options = options || getExportOptions();
        doc.addPage();
        addHeader(doc, label, colors);
        text(doc, [35,35,32]); doc.setFont(undefined, 'bold'); doc.setFontSize(17);
        doc.text('Das Alpinjahr in Zahlen', M, 34);

        var names = new Set();
        entries.forEach(function(entry) {
            (Array.isArray(entry.gipfelDetails) ? entry.gipfelDetails : []).forEach(function(peak) {
                var name = st(peak && peak.name);
                if (name) names.add(name.toLocaleLowerCase('de'));
            });
        });
        var tiles = [
            ['Touren', fi(stats.totalTours)],
            ['Strecke', f1(stats.totalDistance) + ' km'],
            ['Aufstieg', fi(stats.totalAscent) + ' hm'],
            ['Gipfel gesamt', fi(stats.totalPeaks)],
            ['Gehzeit', stats.totalTimeText ? stats.totalTimeText + ' h' : '–'],
            ['Schritte', stats.totalSteps > 0 ? fi(stats.totalSteps) : '–'],
            ['Big Tours', fi(stats.bigTours)],
            ['Ø Speed', stats.avgSpeed > 0 ? f1(stats.avgSpeed) + ' km/h' : '–'],
            ['Ø Steigung', stats.avgGradient > 0 ? fi(stats.avgGradient) + ' hm/km' : '–'],
            ['Ø Anstieg/h', stats.avgAscentPerHour > 0 ? fi(stats.avgAscentPerHour) + ' hm/h' : '–'],
            ['Gipfel 2000–2499 m', fi(stats.peaks2000)],
            ['Gipfel 2500–2999 m', fi(stats.peaks2500)],
            ['Gipfel ab 3000 m', fi(stats.peaks3000)],
            ['Verschiedene Gipfel', fi(names.size)]
        ].filter(function(item) {
            return options.secondary || ['Ø Speed', 'Ø Steigung', 'Ø Anstieg/h'].indexOf(item[0]) === -1;
        });
        buildCoverHighlights(entries, options).slice(0, 6).forEach(function(item) {
            tiles.push([item[0], item[1]]);
        });

        var milestoneDefs = [['Strecke','dist'],['Aufstieg','asc'],['Gehzeit','time'],['Gipfel','peaks'],['Schritte','steps']];
        var hasMilestones = options.milestones && typeof window.computeMilestones === 'function';
        var cols = 4, tileRows = Math.ceil(tiles.length / cols), tileGapX = 2.5, tileGapY = 2.2;
        var tileW = (CW - tileGapX * (cols - 1)) / cols;
        var top = 40, bottom = A4.h - 12;
        var milestoneHeadingH = hasMilestones ? 10 : 0;
        var availableH = bottom - top - milestoneHeadingH - (hasMilestones ? 5 : 0);
        var gridH = hasMilestones ? availableH * 0.56 : availableH;
        var tileH = (gridH - tileGapY * (tileRows - 1)) / tileRows;

        tiles.forEach(function(item, index) {
            var col = index % cols, row = Math.floor(index / cols);
            var x = M + col * (tileW + tileGapX), y = top + row * (tileH + tileGapY);
            drawAccentTile(doc, x, y, tileW, tileH, colors, 0.12);
            var valueSize = tileH < 14 ? 10.2 : 11.6;
            var valueLines = wrap(doc, item[1], tileW - 5, valueSize, 'bold').slice(0, 2);
            text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(valueSize);
            var valueStartY = y + tileH * (valueLines.length > 1 ? 0.40 : 0.49);
            valueLines.forEach(function(line, lineIndex) {
                doc.text(line, x + tileW / 2, valueStartY + lineIndex * (valueSize * 0.42), {align:'center'});
            });
            text(doc, [75,78,72]); doc.setFont(undefined, 'bold'); doc.setFontSize(tileH < 14 ? 7.8 : 8.4);
            doc.text(st(item[0]), x + tileW / 2, y + tileH * 0.84, {align:'center'});
        });

        if (hasMilestones) {
            var ms = window.computeMilestones(entries);
            var headingY = top + gridH + 8;
            text(doc, [35,35,32]); doc.setFont(undefined, 'bold'); doc.setFontSize(12.5);
            doc.text('Meilensteine', M, headingY);
            var msTop = headingY + 5;
            var rowGap = 2;
            var rowH = (bottom - msTop - rowGap * (milestoneDefs.length - 1)) / milestoneDefs.length;
            milestoneDefs.forEach(function(def, index) {
                var data = ms && ms[def[1]];
                if (!data) return;
                var y = msTop + index * (rowH + rowGap);
                drawAccentTile(doc, M, y, CW, rowH, colors, 0.10);
                text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(9);
                doc.text(def[0], M + 4, y + rowH * 0.43);
                text(doc, [42,45,40]); doc.setFont(undefined, 'bold'); doc.setFontSize(9);
                doc.text(formatMilestoneTotal(def[1], data.total), M + CW - 4, y + rowH * 0.43, {align:'right'});
                var reached = Array.isArray(data.reached) ? data.reached.length : 0, progress = 1;
                if (data.next !== null && Number.isFinite(Number(data.next))) {
                    var previous = reached ? Number(data.reached[reached - 1].milestone) : 0;
                    progress = Math.max(0, Math.min(1, (n(data.total) - previous) / Math.max(1, n(data.next) - previous)));
                }
                var barW = CW - 8, barY = y + rowH - 3.2;
                fill(doc, [229,229,222]); doc.roundedRect(M + 4, barY, barW, 1.5, 0.7, 0.7, 'F');
                fill(doc, colors.accent); doc.roundedRect(M + 4, barY, Math.max(1, barW * progress), 1.5, 0.7, 0.7, 'F');
            });
        }
    }
    function summary(doc, entries, stats, label, colors, options) {
        // Die Saisonbilanz ist in yearOpeningPage integriert, damit beide Bereiche
        // gemeinsam genau eine Seite belegen.
    }

    function yearsPage(doc, from, to, colors, options, allEntries) {
        options = options || getExportOptions();
        var label=from+'–'+to;
        addHeader(doc,label,colors);
        text(doc,[35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(19); doc.text('Jahresrückblick',M,36);
        text(doc,[120,120,114]); doc.setFont(undefined,'normal'); doc.setFontSize(7.2);
        doc.text(st('Die wichtigsten Kennzahlen und persönlichen Highlights pro Jahr'),M,43);

        var years=[];
        for(var year=from;year<=to;year++){
            var es=Array.isArray(allEntries) ? allEntries.filter(function(entry) {
                var key = monthKey(entry); return key && Number(key.slice(0,4)) === year;
            }) : (typeof window.getToursInYearRange==='function'?window.getToursInYearRange(year,year):[]);
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
        if (photoAssetsByTour.has(entry)) return photoAssetsByTour.get(entry);
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
        photoAssetsByTour.set(entry, assets);
        return assets;
    }

    async function loadSummitPhotoAssets(entries, options) {
        var assets = [];
        if (!options.summitPhotos || typeof window.__androidNativeRequest !== 'function') return assets;
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i], assignments = readSummitAssignmentsForTour(entry, options);
            for (var j = 0; j < assignments.length; j++) {
                try {
                    var result = await window.__androidNativeRequest('gallery.summit.folder.full', { uri: assignments[j].uri }, 45000);
                    if (result && result.status === 'ok' && result.data) {
                        assets.push({
                            src: 'data:' + (result.mimeType || 'image/jpeg') + ';base64,' + result.data,
                            label: assignments[j].peakName + (assignments[j].peakHeight ? ' · ' + fi(assignments[j].peakHeight) + ' m' : ''),
                            peakName: assignments[j].peakName,
                            peakHeight: assignments[j].peakHeight
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
        if (!assets || !assets.length) return;
        doc.addPage();
        photoPageIndexes.add(doc.getNumberOfPages());
        var heroW = assets.length > 1 ? A4.w * 0.64 : A4.w;
        try {
            var hero = await cropFullBleed(assets[0].src, 1800, Math.max(1, Math.round(1800 * A4.h / heroW)), 0.91);
            doc.addImage(hero, 'JPEG', 0, 0, heroW, A4.h, undefined, 'FAST');
        } catch (error) {
            console.warn('Tour-Hauptfoto konnte nicht verarbeitet werden:', error);
        }
        if (assets.length > 1) {
            var sideX = heroW, sideW = A4.w - sideX, sideH = A4.h / (assets.length - 1);
            for (var i = 1; i < assets.length; i++) {
                var y = (i - 1) * sideH;
                try {
                    var tile = await cropFullBleed(assets[i].src, 900, Math.max(1, Math.round(900 * sideH / sideW)), 0.88);
                    doc.addImage(tile, 'JPEG', sideX, y, sideW, sideH, undefined, 'FAST');
                } catch (error) {
                    console.warn('Zusatzfoto konnte nicht verarbeitet werden:', error);
                }
            }
        }

        var textX = 6, textW = heroW - 12;
        var titleSize = A4.w < 230 ? 17 : 18;
        doc.setFont(undefined, 'bold'); doc.setFontSize(titleSize);
        var titleLines = wrap(doc, d.title || 'Bergtour', textW, titleSize, 'bold').slice(0, 2);
        titleLines.forEach(function(line, index) {
            drawOutlinedAccentText(doc, line, textX, 11 + index * (titleSize * 0.48), titleSize, colors, 'left');
        });
        var dateLine = [d.date, d.difficulty, d.region].filter(Boolean).join(' · ');
        if (dateLine) drawOutlinedAccentText(doc, dateLine, textX, 11 + titleLines.length * (titleSize * 0.48) + 4, A4.w < 230 ? 10 : 10.5, colors, 'left');

        var statItems = (d.stats || []).map(function(item) { return item[1] + ': ' + item[0]; });
        var secondaryItems = (d.secondary || []).slice(0, 3);
        var statColumns = 2, statCellW = textW / statColumns;
        var statStartY = A4.h - (secondaryItems.length ? 34 : 10);
        statItems.forEach(function(item, index) {
            var col = index % statColumns, row = Math.floor(index / statColumns);
            var centerX = textX + col * statCellW + statCellW / 2;
            var y = statStartY - (Math.ceil(statItems.length / statColumns) - 1 - row) * 10;
            var statFontSize = A4.w < 230 ? 10 : 10.5;
            doc.setFont(undefined, 'bold');
            while (statFontSize > 8.5) {
                doc.setFontSize(statFontSize);
                if (doc.getTextWidth(item) <= statCellW - 5) break;
                statFontSize -= 0.4;
            }
            drawOutlinedAccentText(doc, item, centerX, y, statFontSize, colors, 'center');
        });
        if (secondaryItems.length) {
            var secondaryCellW = textW / secondaryItems.length;
            secondaryItems.forEach(function(item, index) {
                var centerX = textX + index * secondaryCellW + secondaryCellW / 2;
                var secondaryFontSize = A4.w < 230 ? 8.5 : 9;
                doc.setFont(undefined, 'bold');
                while (secondaryFontSize > 7.2) {
                    doc.setFontSize(secondaryFontSize);
                    if (doc.getTextWidth(item) <= secondaryCellW - 3) break;
                    secondaryFontSize -= 0.3;
                }
                drawOutlinedAccentText(doc, item, centerX, A4.h - 7.5, secondaryFontSize, colors, 'center');
            });
        }
    }
    async function drawSummitPhotoCollage(doc, assets, label, colors) {
        if (!assets || !assets.length) return;
        var perPage = 6;
        for (var start = 0; start < assets.length; start += perPage) {
            doc.addPage();
            var subset = assets.slice(start, start + perPage);
            var rowCount = Math.ceil(subset.length / 3);
            var rowH = A4.h / rowCount;
            for (var row = 0; row < rowCount; row++) {
                var inRow = Math.min(3, subset.length - row * 3);
                var cellW = A4.w / inRow, y = row * rowH;
                for (var col = 0; col < inRow; col++) {
                    var asset = subset[row * 3 + col], x = col * cellW;
                    try {
                        var data = await cropFullBleed(asset.src, 1200, Math.max(1, Math.round(1200 * rowH / cellW)), 0.9);
                        doc.addImage(data, 'JPEG', x, y, cellW, rowH, undefined, 'FAST');
                        var name = asset.peakName || asset.label || 'Gipfel';
                        var height = asset.peakHeight ? fi(asset.peakHeight) + ' m' : '';
                        var nameSize = A4.w < 230 ? 9 : 8.2;
                        var nameLines = wrap(doc, name, cellW - 8, nameSize, 'bold').slice(0, 2);
                        var nameBaseY = y + rowH - (height ? 10 : 5);
                        if (nameLines.length > 1) {
                            drawOutlinedAccentText(doc, nameLines[0], x + cellW / 2, nameBaseY - 6, nameSize, colors, 'center');
                        }
                        drawOutlinedAccentText(doc, nameLines[nameLines.length - 1], x + cellW / 2, nameBaseY, nameSize, colors, 'center');
                        if (height) drawOutlinedAccentText(doc, height, x + cellW / 2, y + rowH - 3.5, nameSize - 0.5, colors, 'center');
                    } catch (error) {
                        console.warn('Gipfelfoto-Collage konnte nicht gezeichnet werden:', error);
                    }
                }
            }
        }
    }
    function monthKey(entry) {
        var raw = String(entry && entry.date || '');
        var match = raw.match(/^(\d{4})-(\d{2})/);
        if (match) return match[1] + '-' + match[2];
        match = raw.match(/^(\d{1,2})[.\/]([0-9]{1,2})[.\/](\d{4})$/);
        return match ? match[3] + '-' + String(match[2]).padStart(2,'0') : '';
    }

    function monthlyPage(doc, entries, label, colors) {
        doc.addPage();
        addHeader(doc, label, colors);
        text(doc, [35,35,32]); doc.setFont(undefined, 'bold'); doc.setFontSize(19);
        doc.text('Das Bergjahr im Monatsverlauf', M, 32);
        var monthNames = ['Jänner','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
        var groups = {};
        entries.forEach(function(entry) {
            var key = monthKey(entry);
            if (!key) return;
            var month = Number(key.slice(5,7));
            if (!month) return;
            (groups[month] || (groups[month] = [])).push(entry);
        });
        var gapX = 3, gapY = 3, cols = 3, top = 39, bottom = A4.h - 13;
        var cellW = (CW - gapX * (cols - 1)) / cols;
        var cellH = (bottom - top - gapY * 3) / 4;
        for (var month = 1; month <= 12; month++) {
            var monthEntries = groups[month] || [];
            var summary = typeof window.computeStatsSummary === 'function'
                ? window.computeStatsSummary(monthEntries)
                : { totalTours: monthEntries.length, totalDistance: 0, totalAscent: 0, totalTimeText: '0', totalSteps: 0, totalPeaks: 0 };
            var col = (month - 1) % 3, row = Math.floor((month - 1) / 3);
            var x = M + col * (cellW + gapX), y = top + row * (cellH + gapY);
            drawAccentTile(doc, x, y, cellW, cellH, colors, 0.12);
            rule(doc, x + 1, y + 0.4, cellW - 2, colors.accent, 0.9);

            text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(13.5);
            doc.text(monthNames[month - 1], x + cellW / 2, y + 8, {align:'center'});
            text(doc, [40,40,37]); doc.setFont(undefined, 'bold'); doc.setFontSize(10.8);
            doc.text(fi(summary.totalTours) + ' Touren', x + cellW / 2, y + 15, {align:'center'});

            var metrics = [
                ['Strecke', f1(summary.totalDistance) + ' km'],
                ['Aufstieg', fi(summary.totalAscent) + ' hm'],
                ['Gehzeit', summary.totalTimeText ? summary.totalTimeText + ' h' : '–'],
                ['Schritte', summary.totalSteps > 0 ? fi(summary.totalSteps) : '0'],
                ['Gipfel', fi(summary.totalPeaks)]
            ];
            metrics.forEach(function(item, index) {
                var row = Math.floor(index / 2), col = index % 2;
                var centerX = index === 4 ? x + cellW / 2 : x + (col + 0.5) * (cellW / 2);
                var lineY = y + 19.5 + row * 6.3;
                text(doc, [75,78,72]); doc.setFont(undefined, 'bold'); doc.setFontSize(6.8);
                doc.text(item[0], centerX, lineY, {align:'center'});
                text(doc, [35,38,34]); doc.setFont(undefined, 'bold'); doc.setFontSize(8.8);
                doc.text(item[1], centerX, lineY + 3.5, {align:'center'});
            });
        }
    }
    function peakOverviewPage(doc, entries, label, colors) {
        var peaks = new Map();
        entries.forEach(function(entry) {
            var raw = String(entry.date || '');
            var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            var local = raw.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
            var dateKey = iso ? iso[1] + '-' + iso[2] + '-' + iso[3]
                : local ? local[3] + '-' + String(local[2]).padStart(2,'0') + '-' + String(local[1]).padStart(2,'0')
                : monthKey(entry) + '-01';
            var seenThisTour = new Set();
            (Array.isArray(entry.gipfelDetails) ? entry.gipfelDetails : []).forEach(function(peak) {
                var name = st(peak && peak.name);
                if (!name) return;
                var key = name.toLocaleLowerCase('de');
                if (seenThisTour.has(key)) return;
                seenThisTour.add(key);
                var height = n(String(peak.hoehe || '').replace(/[^0-9,.]/g, '').replace(',', '.'));
                var existing = peaks.get(key);
                if (!existing) peaks.set(key, {name:name, height:height, firstDate:dateKey, count:1});
                else {
                    existing.count += 1;
                    if (height > existing.height) existing.height = height;
                    if (dateKey && (!existing.firstDate || dateKey < existing.firstDate)) existing.firstDate = dateKey;
                }
            });
        });
        var list = Array.from(peaks.values()).sort(function(a,b) {
            return String(a.firstDate || '').localeCompare(String(b.firstDate || '')) ||
                a.name.localeCompare(b.name, 'de', {sensitivity:'base'});
        });
        var rowGap = 8.1, firstY = 53;
        var perColumn = Math.max(1, Math.floor((SAFE_BOTTOM - firstY - 2) / rowGap));
        var perPage = perColumn * 2, pageCount = Math.max(1, Math.ceil(list.length / perPage));
        for (var page = 0; page < pageCount; page++) {
            doc.addPage(); addHeader(doc, label, colors);
            text(doc, [35,35,32]); doc.setFont(undefined, 'bold'); doc.setFontSize(19);
            doc.text('Meine Gipfel', M, 36);
            text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(8.5);
            doc.text(list.length + ' unterschiedliche Gipfel · chronologisch', M, 43);
            var subset = list.slice(page * perPage, (page + 1) * perPage), colGap = 9, colW = (CW - colGap) / 2;
            subset.forEach(function(peak, index) {
                var col = index % 2, row = Math.floor(index / 2);
                var x = M + col * (colW + colGap), y = firstY + row * rowGap;
                text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(7.3);
                doc.text(String(page * perPage + index + 1) + '.', x, y);
                text(doc, [55,55,51]); doc.setFont(undefined, 'bold'); doc.setFontSize(8.2);
                var displayName = peak.name + (peak.count > 1 ? ' (' + peak.count + ')' : '');
                doc.text(wrap(doc, displayName, colW - 29, 8.2, 'bold').slice(0,1), x + 6, y);
                text(doc, colors.accent); doc.setFontSize(8.2);
                doc.text(peak.height ? fi(peak.height) + ' m' : '–', x + colW, y, {align:'right'});
                draw(doc, [215,215,210]); doc.setLineWidth(0.2); doc.line(x + 6, y + 1.7, x + colW, y + 1.7);
            });
        }
    }
    function kindFor(d){
        // Magazin und Kompakt behalten zwei Spalten; Detail zeigt eine breite Karte je Zeile.
        return d.photo ? 'split' : 'compact';
    }

    async function renderTours(doc, entries, from, to, colors, options) {
        options = options || getExportOptions();
        var profile = typeof window.buildTourProfileAnalysis === 'function' ? window.buildTourProfileAnalysis(entries) : null;
        var ds = entries.map(function(e) { return dataFor(e, profile, options); });
        for (var i = 0; i < ds.length; i++) {
            var d = ds[i];
            var assets = await loadEntryPhotoAssets(d.e, options);
            if (!assets.length) continue;
            await drawPhotoStory(doc, d, assets, colors);
        }
    }

    async function resolvePhotoChoice(entries, choice, fallback, galleryEnabled) {
        if (!choice || choice === 'auto') return fallback;
        var value = String(choice);
        if (value.indexOf('preset:') === 0) {
            var presetId = value.slice(7);
            var catalog = typeof window.getAppBackgroundPresetCatalog === 'function'
                ? window.getAppBackgroundPresetCatalog()
                : [];
            var preset = Array.isArray(catalog) ? catalog.find(function(item) {
                return item && item.id === presetId;
            }) : null;
            return preset && (preset.src || preset.preview) ? (preset.src || preset.preview) : fallback;
        }
        var parts = value.split(':');
        var entryIndex = Number(parts[0]), entry = entries[entryIndex];
        if (!entry || !Number.isInteger(entryIndex)) return fallback;
        if (parts[1] === 'main') return entry.imageData || fallback;
        if (parts[1] === 'gallery' && galleryEnabled && typeof window.__tourGalleryLoadPhotoFull === 'function') {
            var gallery = Array.isArray(entry.galleryPhotos) ? entry.galleryPhotos.filter(function(item) {
                return item && item.mediaType === 'photo' && item.uri;
            }) : [];
            var galleryIndex = Number(parts[2]), item = gallery[galleryIndex];
            if (item) {
                try {
                    var loaded = await window.__tourGalleryLoadPhotoFull(item);
                    if (loaded) return loaded;
                } catch (error) {
                    console.warn('Ausgewähltes Fotobuchbild konnte nicht geladen werden:', error);
                }
            }
        }
        return fallback;
    }


    // PDF-Kartenübersicht: eigenständige Momentaufnahme der beiden App-Karten.
    // Die Datengrundlage wird aus sämtlichen Touren des Exportzeitraums gebildet,
    // nicht aus dem aktuellen Kartenfilter. Deutschland wird per Länderpolygon
    // ausgeschlossen; Regionsnamen sind dafür ausdrücklich kein Kriterium.
    var pdfGermanyBoundaryPromise = null;
    var pdfMapTileCache = new Map();

    async function loadPdfGermanyBoundary() {
        if (!pdfGermanyBoundaryPromise) {
            pdfGermanyBoundaryPromise = fetch('./assets/maps/germany-boundary.geojson', { cache: 'force-cache' })
                .then(function(response) {
                    if (!response.ok) throw new Error('Deutschlandgrenze für die Kartenübersicht konnte nicht geladen werden.');
                    return response.json();
                })
                .then(function(data) {
                    if (!data || !Array.isArray(data.features) || !data.features.length) {
                        throw new Error('Die Deutschlandgrenze für die Kartenübersicht ist ungültig.');
                    }
                    return data;
                })
                .catch(function(error) {
                    pdfGermanyBoundaryPromise = null;
                    throw error;
                });
        }
        return pdfGermanyBoundaryPromise;
    }

    function pdfPointInRing(lng, lat, ring) {
        if (!Array.isArray(ring) || ring.length < 3) return false;
        var inside = false;
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            var a = ring[i], b = ring[j];
            if (!a || !b) continue;
            var ax = Number(a[0]), ay = Number(a[1]), bx = Number(b[0]), by = Number(b[1]);
            var cross = (lng - ax) * (by - ay) - (lat - ay) * (bx - ax);
            if (Math.abs(cross) < 1e-10 &&
                lng >= Math.min(ax, bx) - 1e-10 && lng <= Math.max(ax, bx) + 1e-10 &&
                lat >= Math.min(ay, by) - 1e-10 && lat <= Math.max(ay, by) + 1e-10) return true;
            var intersects = ((ay > lat) !== (by > lat)) &&
                (lng < (bx - ax) * (lat - ay) / ((by - ay) || 1e-20) + ax);
            if (intersects) inside = !inside;
        }
        return inside;
    }

    function pdfPointInPolygon(lng, lat, polygon) {
        if (!Array.isArray(polygon) || !polygon.length || !pdfPointInRing(lng, lat, polygon[0])) return false;
        for (var i = 1; i < polygon.length; i++) {
            if (pdfPointInRing(lng, lat, polygon[i])) return false;
        }
        return true;
    }

    function pdfPointInGermany(lng, lat, boundary) {
        var features = boundary && Array.isArray(boundary.features) ? boundary.features : [];
        for (var i = 0; i < features.length; i++) {
            var geometry = features[i] && features[i].geometry;
            if (!geometry) continue;
            if (geometry.type === 'Polygon' && pdfPointInPolygon(lng, lat, geometry.coordinates)) return true;
            if (geometry.type === 'MultiPolygon') {
                for (var j = 0; j < geometry.coordinates.length; j++) {
                    if (pdfPointInPolygon(lng, lat, geometry.coordinates[j])) return true;
                }
            }
        }
        return false;
    }

    // Exakt dieselben Regionsgruppen wie in der App-Karte (map-view.js).
    // Die PDF-Übersicht zeigt bewusst nur die beiden persönlichen Hauptregionen.
    var PDF_MAP_REGION_GROUPS = {
        osttirol: ['Talboden & Dolomiten', 'Iseltal', 'Oberland & Pustertal', 'Defereggental']
    };

    async function getPdfMapEntries(entries, regionKey) {
        var allowedRegions = PDF_MAP_REGION_GROUPS[regionKey] || [];
        return (Array.isArray(entries) ? entries : []).filter(function(entry) {
            if (!entry || allowedRegions.indexOf(String(entry.region || '').trim()) === -1) return false;
            var lat = Number(entry.lat), lng = Number(entry.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) &&
                lat >= -85.05112878 && lat <= 85.05112878 && lng >= -180 && lng <= 180;
        });
    }

    function pdfMercatorPoint(lat, lng, zoom) {
        var world = 256 * Math.pow(2, zoom);
        var safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
        var sin = Math.sin(safeLat * Math.PI / 180);
        return {
            x: (lng + 180) / 360 * world,
            y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world
        };
    }

    function loadPdfMapTile(zoom, x, y) {
        var count = Math.pow(2, zoom);
        var tileX = ((x % count) + count) % count;
        var key = zoom + '/' + tileX + '/' + y;
        if (pdfMapTileCache.has(key)) return pdfMapTileCache.get(key);
        var promise = new Promise(function(resolve, reject) {
            var image = new Image();
            image.crossOrigin = 'anonymous';
            image.referrerPolicy = 'strict-origin-when-cross-origin';
            image.onload = function() { resolve(image); };
            image.onerror = function() {
                reject(new Error('OpenTopoMap-Kartenkacheln konnten nicht geladen werden. Bitte Internetverbindung prüfen und den PDF-Export erneut starten.'));
            };
            var hosts = ['a', 'b', 'c'];
            image.src = 'https://' + hosts[(tileX + y) % hosts.length] +
                '.tile.opentopomap.org/' + zoom + '/' + tileX + '/' + y + '.png';
        });
        pdfMapTileCache.set(key, promise);
        promise.catch(function() { pdfMapTileCache.delete(key); });
        return promise;
    }

    async function createPdfMapBase(entries, width, height) {
        var coords = entries.map(function(entry) {
            return { entry: entry, lat: Number(entry.lat), lng: Number(entry.lng) };
        });
        var zoom = 2, projected = [];
        for (var candidate = 2; candidate <= 16; candidate++) {
            var points = coords.map(function(item) {
                return pdfMercatorPoint(item.lat, item.lng, candidate);
            });
            var xs = points.map(function(point) { return point.x; });
            var ys = points.map(function(point) { return point.y; });
            var spanX = Math.max.apply(null, xs) - Math.min.apply(null, xs);
            var spanY = Math.max.apply(null, ys) - Math.min.apply(null, ys);
            zoom = candidate;
            projected = points;
            // Den verfügbaren Kartenrahmen weitgehend ausnutzen; nur ca. 8–10 % Rand.
            if (coords.length === 1 || (spanX <= width * 0.90 && spanY <= height * 0.86)) continue;
            zoom = Math.max(2, candidate - 1);
            projected = coords.map(function(item) { return pdfMercatorPoint(item.lat, item.lng, zoom); });
            break;
        }
        if (coords.length === 1) {
            zoom = 12;
            projected = coords.map(function(item) { return pdfMercatorPoint(item.lat, item.lng, zoom); });
        }
        var minX = Math.min.apply(null, projected.map(function(point) { return point.x; }));
        var maxX = Math.max.apply(null, projected.map(function(point) { return point.x; }));
        var minY = Math.min.apply(null, projected.map(function(point) { return point.y; }));
        var maxY = Math.max.apply(null, projected.map(function(point) { return point.y; }));
        var centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
        var left = centerX - width / 2, top = centerY - height / 2;
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Die PDF-Kartenfläche konnte nicht erzeugt werden.');
        ctx.fillStyle = '#e8e7e1';
        ctx.fillRect(0, 0, width, height);

        var firstTileX = Math.floor(left / 256);
        var lastTileX = Math.floor((left + width) / 256);
        var firstTileY = Math.floor(top / 256);
        var lastTileY = Math.floor((top + height) / 256);
        var jobs = [];
        for (var tileY = firstTileY; tileY <= lastTileY; tileY++) {
            if (tileY < 0 || tileY >= Math.pow(2, zoom)) continue;
            for (var tileX = firstTileX; tileX <= lastTileX; tileX++) {
                jobs.push((function(tx, ty) {
                    return loadPdfMapTile(zoom, tx, ty).then(function(image) {
                        ctx.drawImage(image, tx * 256 - left, ty * 256 - top, 256, 256);
                    });
                })(tileX, tileY));
            }
        }
        await Promise.all(jobs);
        return {
            canvas: canvas,
            zoom: zoom,
            left: left,
            top: top,
            width: width,
            height: height,
            points: coords,
            project: function(lat, lng) {
                var point = pdfMercatorPoint(lat, lng, zoom);
                return { x: point.x - left, y: point.y - top };
            }
        };
    }

    function pdfHeatPalette() {
        var body = document.body;
        if (body.classList.contains('summit')) {
            return [[0.18, '#155a9c'], [0.38, '#176fc1'], [0.58, '#3aa0ff'], [0.78, '#63b7ff'], [1, '#c9eaff']];
        }
        if (body.classList.contains('green')) {
            return [[0.25, '#1b4332'], [0.50, '#2d6a4f'], [0.72, '#52b788'], [0.88, '#95d5b2'], [1, '#d8f3dc']];
        }
        if (body.classList.contains('dark')) {
            return [[0.30, '#1e3a5f'], [0.50, '#7b2d8b'], [0.70, '#c0392b'], [0.85, '#e67e22'], [1, '#f9d77e']];
        }
        return [[0.30, '#3b82f6'], [0.50, '#8b5cf6'], [0.70, '#ef4444'], [0.85, '#f97316'], [1, '#fef08a']];
    }

    function pdfHexRgb(hex) {
        var value = String(hex || '#000000').replace('#', '');
        return [
            parseInt(value.slice(0, 2), 16) || 0,
            parseInt(value.slice(2, 4), 16) || 0,
            parseInt(value.slice(4, 6), 16) || 0
        ];
    }

    function pdfHeatColor(value, palette) {
        var stops = palette;
        if (value <= stops[0][0]) return stops[0][1];
        for (var i = 1; i < stops.length; i++) {
            if (value <= stops[i][0]) {
                var t = (value - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
                var a = pdfHexRgb(stops[i - 1][1]), b = pdfHexRgb(stops[i][1]);
                return 'rgb(' + a.map(function(v, index) { return Math.round(v + (b[index] - v) * t); }).join(',') + ')';
            }
        }
        return stops[stops.length - 1][1];
    }

    function pdfColorWithAlpha(color, alpha) {
        var match = String(color).match(/^rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)$/);
        var rgb = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : pdfHexRgb(color);
        return 'rgba(' + rgb.join(',') + ',' + alpha + ')';
    }

    function renderPdfPerformanceMap(base) {
        var canvas = document.createElement('canvas');
        canvas.width = base.width;
        canvas.height = base.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(base.canvas, 0, 0);
        var scored = base.points.map(function(item) {
            var performance = typeof window.calculatePerformanceIndex === 'function'
                ? window.calculatePerformanceIndex(item.entry) : null;
            return {
                entry: item.entry,
                score: performance && Number.isFinite(Number(performance.score))
                    ? Number(performance.score) : null
            };
        });
        var validScores = scored.map(function(item) { return item.score; })
            .filter(Number.isFinite).sort(function(a, b) { return a - b; });
        var topThreshold = validScores.length
            ? validScores[Math.max(0, Math.ceil(validScores.length * 0.90) - 1)] : Infinity;
        var counts = Object.create(null);
        var dark = document.body.classList.contains('dark') ||
            document.body.classList.contains('green') || document.body.classList.contains('summit');

        scored.forEach(function(item) {
            var entry = item.entry;
            var lat = Number(entry.lat), lng = Number(entry.lng);
            var key = lat.toFixed(6) + ',' + lng.toFixed(6);
            var count = counts[key] || 0;
            counts[key] = count + 1;
            var angle = count * 137.5 * Math.PI / 180;
            var point = base.project(
                lat + (count ? 0.00026 * Math.cos(angle) : 0),
                lng + (count ? 0.00026 * Math.sin(angle) : 0)
            );
            var score = item.score;
            var isTop = Number.isFinite(score) && score >= topThreshold && validScores.length >= 3;
            var color = isTop ? '#ffd23f' :
                !Number.isFinite(score) ? '#7b8794' :
                score >= 75 ? '#f97316' : score >= 50 ? '#3aa0ff' : '#64748b';
            var radius = isTop ? 10.5 : !Number.isFinite(score) ? 5.5 :
                score >= 75 ? 8.8 : score >= 50 ? 7.2 : 6;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius * 2.7, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius * 2.25, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = isTop ? 6.4 : 4.8;
            ctx.strokeStyle = dark ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.96)';
            ctx.stroke();
        });
        return canvas.toDataURL('image/jpeg', 0.91);
    }

    function renderPdfIntensityMap(base) {
        var canvas = document.createElement('canvas');
        canvas.width = base.width;
        canvas.height = base.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(base.canvas, 0, 0);
        var maxAscent = Math.max(1, ...base.points.map(function(item) { return Number(item.entry.aufstieg) || 0; }));
        var maxDistance = Math.max(1, ...base.points.map(function(item) { return Number(item.entry.strecke) || 0; }));
        var palette = pdfHeatPalette();
        base.points.forEach(function(item) {
            var entry = item.entry;
            var ascent = Number(entry.aufstieg) || 0;
            var distance = Number(entry.strecke) || 0;
            var intensity = Math.max(0.35, 0.6 * (ascent / maxAscent) + 0.4 * (distance / maxDistance));
            var point = base.project(Number(entry.lat), Number(entry.lng));
            var color = pdfHeatColor(intensity, palette);
            var alpha = Math.min(0.82, 0.42 + intensity * 0.36);
            var radius = 112;
            var gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
            gradient.addColorStop(0, pdfColorWithAlpha(color, alpha));
            gradient.addColorStop(0.42, pdfColorWithAlpha(color, alpha * 0.62));
            gradient.addColorStop(1, pdfColorWithAlpha(color, 0));
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.fill();
        });
        return canvas.toDataURL('image/jpeg', 0.91);
    }

    function drawPdfPerformanceLegend(doc, y) {
        var items = [
            ['#ffd23f', 'Top 10 %'],
            ['#f97316', 'hoch'],
            ['#3aa0ff', 'mittel'],
            ['#64748b', 'niedriger'],
            ['#7b8794', 'nicht auswertbar']
        ];
        var x = M;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(6.1);
        items.forEach(function(item) {
            fill(doc, pdfHexRgb(item[0]));
            doc.circle(x + 1.3, y - 0.7, 1.15, 'F');
            text(doc, [80,80,76]);
            doc.text(item[1], x + 3.5, y);
            x += item[1] === 'nicht auswertbar' ? 39 : item[1] === 'niedriger' ? 30 : 27;
        });
    }

    function drawPdfIntensityLegend(doc, y) {
        var palette = pdfHeatPalette();
        var x = M, width = 48, height = 2.2;
        for (var i = 0; i < 16; i++) {
            var value = 0.3 + (0.7 * i / 15);
            fill(doc, pdfHexRgb(pdfHeatColor(value, palette)));
            doc.rect(x + i * width / 16, y - height, width / 16 + 0.15, height, 'F');
        }
        text(doc, [90,90,84]);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(6.1);
        doc.text('gering', x + width + 3, y);
        doc.text('hoch', x + width + 19, y);
    }

    async function tourMapOverviewPage(doc, entries, label, colors) {
        // Das Tourbuch zeigt ausschließlich die persönliche Hauptregion Osttirol.
        // Die Karte nutzt die gesamte nutzbare Seitenfläche und passt ihr Seitenverhältnis
        // an das im Export gewählte PDF-Format (Hochformat, Querformat oder Quadrat) an.
        var items = await getPdfMapEntries(entries, 'osttirol');
        if (!items.length) return;

        doc.addPage();
        addHeader(doc, label, colors);

        text(doc, [35,35,32]);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(16);
        doc.text('Touren im geografischen Überblick', M, 34);

        text(doc, colors.accent);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9.2);
        doc.text('Leistungskarte · Osttirol', M, 43);

        text(doc, [105,105,100]);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(6.4);
        doc.text('Leistungsindex je Tour · Gold markiert die besten 10 %', M, 48);

        var mapX = M;
        var mapY = 52;
        var mapW = CW;
        // Unten bleibt nur der schmale Bereich für die Kartendaten-Quellenangabe.
        var mapH = Math.max(80, A4.h - mapY - 17);
        var pixelWidth = 1600;
        var pixelHeight = Math.max(700, Math.round(pixelWidth * mapH / mapW));

        var base = await createPdfMapBase(items, pixelWidth, pixelHeight);
        var image = renderPdfPerformanceMap(base);
        doc.addImage(image, 'JPEG', mapX, mapY, mapW, mapH, undefined, 'FAST');
        drawPdfPerformanceLegend(doc, mapY + mapH + 4);

        text(doc, [115,115,109]);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(5.4);
        doc.text('Kartendaten: © OpenStreetMap-Mitwirkende · Kartendarstellung: © OpenTopoMap (CC-BY-SA)', M, A4.h - 5);
    }

    async function generate(from,to){
        if(typeof window.showToast==='function')window.showToast('PDF-Export wird vorbereitet…',{type:'info',duration:2500});
        await ensurePdfLibraries();
        var options = getExportOptions();
        configurePage(options.format);
        photoAssetsByTour = new WeakMap();
        var js=window.jspdf.jsPDF, doc=new js({unit:'mm',format:[A4.w,A4.h]}), colors=colorsForExport(tc(), options.style);
        var selectedFontKey = getSelectedPdfFontKey();
        // Auch das Messdokument erhält dieselbe Schrift, damit Zeilenumbrüche
        // und Kartenhöhen mit der später tatsächlich gedruckten Schrift übereinstimmen.
        var measureFontDoc = getMeasureDoc();
        await Promise.all([
            applySelectedPdfFont(doc, selectedFontKey),
            applySelectedPdfFont(measureFontDoc, selectedFontKey)
        ]);
        var allEntries = window.getToursInYearRange(from,to), label=from===to?String(from):from+'–'+to;
        if ((options.photos || options.galleryPhotos || options.coverPhoto || options.closing || options.coverPhotoChoice !== 'auto' || options.closingPhotoChoice !== 'auto') && typeof window.loadTourImagesForEntries === 'function') {
            await window.loadTourImagesForEntries(allEntries);
        }
        // Jahreswerte und Übersichten beziehen sich immer auf sämtliche Touren des Jahres.
        // Nur die Einzeltour-Seiten werden auf Touren mit tatsächlich ladbaren Fotos begrenzt.
        var photographedEntries = [];
        for (var i = 0; i < allEntries.length; i++) {
            var assets = await loadEntryPhotoAssets(allEntries[i], options);
            if (assets.length) photographedEntries.push(allEntries[i]);
        }
        if(typeof window.showToast==='function') window.showToast('Fotobuch wird erstellt…',{type:'info',duration:2500});
        var stats = window.computeStatsSummary(allEntries);
        var rep = options.coverPhoto ? (typeof window.getPdfRepresentativePhoto==='function'
            ? window.getPdfRepresentativePhoto(allEntries)
            : allEntries.find(function(e){return !!e.imageData;}) || null) : null;
        if (options.coverPhoto) {
            var selectedCoverPhoto = await resolvePhotoChoice(allEntries, options.coverPhotoChoice, rep && rep.imageData, options.galleryPhotos);
            rep = selectedCoverPhoto ? {imageData:selectedCoverPhoto} : null;
        }
        await cover(doc,allEntries,stats,label,colors,rep,options);
        yearOpeningPage(doc,allEntries,stats,label,colors,options);
        if(from!==to){ doc.addPage(); yearsPage(doc,from,to,colors,options,allEntries); }
        if(options.monthly) monthlyPage(doc,allEntries,label,colors);
        await tourMapOverviewPage(doc, allEntries, label, colors);
        await renderTours(doc,photographedEntries,from,to,colors,options);
        // Die Gipfelliste und die zugeordneten Gipfelfotos bilden den Abschluss nach allen Tourseiten.
        if(options.peakOverview) peakOverviewPage(doc,allEntries,label,colors);
        var summitAssets = await loadSummitPhotoAssets(allEntries, options);
        await drawSummitPhotoCollage(doc,summitAssets,label,colors);
        if(options.closing){
            var finalPhoto=null;
            for(var fiIndex=allEntries.length-1;fiIndex>=0&&!finalPhoto;fiIndex--){
                var finalEntry=allEntries[fiIndex];
                if(finalEntry.imageData) finalPhoto=finalEntry.imageData;
                else if(options.galleryPhotos&&Array.isArray(finalEntry.galleryPhotos)&&finalEntry.galleryPhotos.length&&typeof window.__tourGalleryLoadPhotoFull==='function'){
                    finalPhoto=await window.__tourGalleryLoadPhotoFull(finalEntry.galleryPhotos[0]);
                }
            }
            finalPhoto = await resolvePhotoChoice(allEntries, options.closingPhotoChoice, finalPhoto, options.galleryPhotos);
            if(finalPhoto){
                doc.addPage();
                footerExcludedPageIndexes.add(doc.getNumberOfPages());
                var closingBg=await cropFullBleed(finalPhoto,1600,Math.round(1600*A4.h/A4.w),0.9);
                doc.addImage(closingBg,'JPEG',0,0,A4.w,A4.h,undefined,'FAST');
                photoPageIndexes.add(doc.getNumberOfPages());
                var closingTitle=st(options.closingTitle||'Bis zum nächsten Gipfel.');
                drawOutlinedAccentText(doc,closingTitle,A4.w/2,A4.h*.78,A4.w<230?21:29,colors,'center');
            }
        }
        await save(doc,from,to);
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

    var photoChoiceRefreshSequence = 0;
    async function refreshPhotoChoiceSelectors(from, to) {
        var coverSelect = document.getElementById('pdf-book-opt-cover-photo-choice');
        var closingSelect = document.getElementById('pdf-book-opt-closing-photo-choice');
        if (!coverSelect || !closingSelect || !from || !to || typeof window.getToursInYearRange !== 'function') return;
        var sequence = ++photoChoiceRefreshSequence;
        var previousCover = coverSelect.value || 'auto';
        var previousClosing = closingSelect.value || 'auto';
        var entries = window.getToursInYearRange(from, to);
        if (typeof window.loadTourImagesForEntries === 'function') {
            try { await window.loadTourImagesForEntries(entries); }
            catch (error) { console.warn('Fotobuch-Bildauswahl konnte Tourbilder nicht laden:', error); }
        }
        if (sequence !== photoChoiceRefreshSequence) return;
        var choices = [];
        var presetCatalog = typeof window.getAppBackgroundPresetCatalog === 'function'
            ? window.getAppBackgroundPresetCatalog()
            : [];
        if (Array.isArray(presetCatalog)) {
            presetCatalog.forEach(function(preset) {
                if (preset && preset.id && (preset.src || preset.preview)) {
                    choices.push({
                        value: 'preset:' + preset.id,
                        label: 'Alpenmotiv – ' + st(preset.name || preset.id)
                    });
                }
            });
        }
        var galleryEnabled = !!(document.getElementById('pdf-book-opt-gallery-photos') || {}).checked;
        entries.forEach(function(entry, entryIndex) {
            var tour = st(entry.tourname || 'Unbenannte Tour');
            var date = st(typeof window.pdfExportFormatDate === 'function' ? window.pdfExportFormatDate(entry.date) : entry.date || '');
            var prefix = [tour, date].filter(Boolean).join(' · ');
            if (entry.imageData) choices.push({value:entryIndex + ':main', label:prefix + ' – Hauptfoto'});
            if (galleryEnabled && Array.isArray(entry.galleryPhotos)) {
                var gallery = entry.galleryPhotos.filter(function(item) {
                    return item && item.mediaType === 'photo' && item.uri;
                });
                gallery.forEach(function(item, galleryIndex) {
                    var display = item.displayName || item.name || item.fileName || ('Galeriefoto ' + (galleryIndex + 1));
                    choices.push({value:entryIndex + ':gallery:' + galleryIndex, label:prefix + ' – ' + st(display)});
                });
            }
        });
        function fillSelect(select, previous, caption) {
            select.innerHTML = '';
            select.add(new Option('Automatisch auswählen', 'auto'));
            choices.forEach(function(choice) { select.add(new Option(choice.label, choice.value)); });
            select.value = choices.some(function(choice) { return choice.value === previous; }) ? previous : 'auto';
            select.disabled = false;
            select.setAttribute('aria-label', caption);
        }
        fillSelect(coverSelect, previousCover, 'Bild für das Titelblatt');
        fillSelect(closingSelect, previousClosing, 'Bild für die Abschlussseite');
    }

    function refreshPhotoChoicesForCurrentRange() {
        var rangePanel = document.getElementById('pdf-export-range-panel');
        var isRange = rangePanel && !rangePanel.classList.contains('is-hidden');
        var from = Number(document.getElementById(isRange ? 'pdf-export-year-from' : 'pdf-export-year')?.value);
        var to = isRange ? Number(document.getElementById('pdf-export-year-to')?.value) : from;
        if (from && to) refreshPhotoChoiceSelectors(from, to);
    }

    function bind(){
        var b=document.getElementById('pdf-export-run-btn');
        if(!b||b.dataset.magazineBound==='1')return;
        b.dataset.magazineBound='1';
        ['pdf-export-year','pdf-export-year-from','pdf-export-year-to','pdf-book-opt-gallery-photos'].forEach(function(id) {
            var field = document.getElementById(id);
            if (field) field.addEventListener('change', refreshPhotoChoicesForCurrentRange);
        });
        ['pdf-export-card','pdf-book-options'].forEach(function(id) {
            var panel = document.getElementById(id);
            if (panel) panel.addEventListener('toggle', function() {
                if (panel.open) refreshPhotoChoicesForCurrentRange();
            });
        });
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
            refreshPhotoChoiceSelectors(from,to).then(function() {
                return generate(from,to);
            }).catch(function(err){
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