/* pdf-magazine.js - adaptive magazine PDF renderer */
(function () {
    'use strict';

    if (!window.jspdf || !window.jspdf.jsPDF) return;

    var A4 = { w: 210, h: 297 };
    var M = 12;
    var CW = 186;
    var SAFE_BOTTOM = 282;
    var GAP = 2;

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
        if (typeof window.cropImageToAspectDataUrl === 'function') return window.cropImageToAspectDataUrl(url, w, h, q || 0.82);
        return Promise.resolve(url);
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
    function dataFor(e, profile) {
        var m = metrics(e, profile), p = perf(e), cs = cats(e), extras = [];
        var stats = [
            e.strecke ? [f1(e.strecke) + ' km', 'Strecke'] : null,
            e.aufstieg ? [fi(e.aufstieg) + ' hm', 'Aufstieg'] : null,
            e.zeit ? [st(e.zeit) + ' h', 'Gehzeit'] : null,
            e.gipfel ? [fi(e.gipfel), 'Gipfel'] : null,
            m.steps ? [fi(m.steps), 'Schritte'] : null
        ].filter(Boolean);
        var secondary = [
            m.speed != null ? f1(m.speed) + ' km/h Ø Speed' : null,
            m.gradient != null ? fi(m.gradient) + ' hm/km Ø Steigung' : null,
            m.ascentRate != null ? fi(m.ascentRate) + ' hm/h Ø Anstieg' : null
        ].filter(Boolean);
        var peaks = Array.isArray(e.gipfelDetails) ? e.gipfelDetails.filter(function (g) {
            return g && (g.name || g.hoehe);
        }).map(function (g) {
            return (g.name || 'Unbenannt') + ' · ' + (g.hoehe || '–') + ' m';
        }) : [];

        if (e.ferrataStrecke || e.ferrataHm || e.ferrataZeit) extras.push([
            'Klettersteig',
            [
                e.ferrataStrecke ? f1(e.ferrataStrecke) + ' km' : null,
                e.ferrataHm ? fi(e.ferrataHm) + ' hm' : null,
                e.ferrataZeit ? st(e.ferrataZeit) + ' h' : null
            ].filter(Boolean).join(' · ')
        ]);
        if (e.bikeStrecke || e.bikeHm || e.bikeZeit) extras.push([
            'Rad',
            [
                e.bikeStrecke ? f1(e.bikeStrecke) + ' km' : null,
                e.bikeHm ? fi(e.bikeHm) + ' hm' : null,
                e.bikeZeit ? st(e.bikeZeit) + ' h' : null
            ].filter(Boolean).join(' · ')
        ]);
        if (e.ausgangspunkt) extras.push(['Ausgangspunkt', e.ausgangspunkt]);
        if (e.tourGroup) extras.push([
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
            extras.length * 0.8 + (e.notes ? 2 : 0) + (p ? 1.4 : 0) + (big(e) ? 1.5 : 0);

        return {
            e: e,
            m: m,
            p: p,
            cs: cs,
            stats: stats,
            secondary: secondary,
            peaks: peaks,
            extras: extras,
            pText: pText,
            complexity: complexity,
            photo: !!e.imageData,
            title: e.tourname || 'Unbenannte Tour',
            date: typeof window.pdfExportFormatDate === 'function' ? window.pdfExportFormatDate(e.date) : (e.date || '–'),
            difficulty: difficulty(e),
            region: e.region || '–',
            isBig: big(e),
            fullGradient: !!e.useFullDistanceForGradient,
            profile: m.profile && m.profile !== '–' ? m.profile : '',
            notes: e.notes || ''
        };
    }

    function measure(doc, d, w, kind) {
        var h = 7, inner = w - 8, titleSize = kind === 'feature' ? 15 : 10.8;
        h += wrap(doc, d.title, inner, titleSize, 'bold').length * (titleSize * 0.38) + 5;
        h += 5;
        if (d.cs.length) h += wrap(doc, d.cs.map(function (c) { return c.name + ' · ' + c.rank; }).join(' / '), inner, 6.3, 'italic').length * 2.5 + 2;

        if (kind === 'feature' && d.photo) h += 50;
        if (kind === 'split' && d.photo) h += 43;

        if (kind === 'split' && d.photo) {
            h += 23;
        } else {
            // Kompakte Touren: Hauptkennzahlen als eine starke Zeile statt einzelner Kacheln.
            h += wrap(doc, d.stats.map(function (s) { return s[0]; }).join('   ·   '), inner, kind === 'feature' ? 9.5 : 8.6, 'bold').length * 3.4 + 3;
        }

        if (d.secondary.length) h += wrap(doc, d.secondary.join(' · '), inner, 6.5, 'normal').length * 2.5 + 3;
        if (d.peaks.length) h += 4 + Math.min(d.peaks.length, kind === 'compact' ? 4 : 6) * 3.6;
        h += d.extras.length * 6.5;
        if (d.profile) h += wrap(doc, d.profile, inner, 7.0, 'normal').length * 2.8 + 5;
        if (d.p) h += 13;
        if (d.notes) h += wrap(doc, d.notes, inner, 7.0, 'italic').length * 2.7 + 5;

        // Kleiner Sicherheitspuffer zwischen gemessener und tatsächlich gezeichnetem Inhalt.
        return Math.max(38, h + 2.5);
    }

    var measureDoc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });

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

    function peaksBlock(doc, d, x, y, max, colors) {
        if (!d.peaks.length) return y;
        text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(6.5); doc.text('GIPFEL', x, y); y += 4;
        var shown = d.peaks.slice(0, max);
        shown.forEach(function (p, i) {
            text(doc, [70,70,66]); doc.setFont(undefined, 'normal'); doc.setFontSize(6.7); doc.text(st('• ' + p), x, y + i * 3.6);
        });
        if (d.peaks.length > shown.length) {
            text(doc, [135,135,130]); doc.setFontSize(6.3); doc.text(st('+ ' + (d.peaks.length - shown.length) + ' weitere'), x, y + shown.length * 3.6);
            return y + (shown.length + 1) * 3.6;
        }
        return y + shown.length * 3.6;
    }

    function drawPerf(doc, d, x, y, w, colors) {
        if (!d.p) return y;
        text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(6.9); doc.text('LEISTUNGSINDEX', x, y);
        text(doc, [45,45,42]); doc.setFontSize(13.5); doc.text(st(d.p.score), x, y + 6);
        text(doc, [120,120,115]); doc.setFont(undefined, 'normal'); doc.setFontSize(6.3); doc.text(st(d.pText.replace(/^\d+\s*\/\s*100\s*·\s*/, '')), x + 14, y + 5.5);
        fill(doc, [232,232,228]); doc.roundedRect(x, y + 9.5, w, 2.2, 1.1, 1.1, 'F');
        fill(doc, colors.accent); doc.roundedRect(x, y + 9.5, Math.max(2, Math.min(100, n(d.p.score)) / 100 * w), 2.2, 1.1, 1.1, 'F');
        return y + 15;
    }

    async function drawTour(doc, d, x, y, w, kind, colors) {
        var h = measure(measureDoc, d, w, kind), pad = 4, inner = w - 8, cursor = y + pad + 1;
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
                doc.addImage(await crop(d.e.imageData, 1200, 740, 0.84), 'JPEG', x + pad, cursor, inner, 50, undefined, 'FAST');
                cursor += 53;
            } catch (_) {}
        } else if (kind === 'split' && d.photo) {
            var pw = Math.min(50, w * 0.34);
            try { doc.addImage(await crop(d.e.imageData, 700, 700, 0.84), 'JPEG', x + pad, cursor, pw, 43, undefined, 'FAST'); } catch (_) {}
            statGrid(doc, d, x + pw + pad * 2, cursor, w - pw - pad * 3, 2, colors);
            cursor = Math.max(cursor + 23, cursor + 43) + 2;
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
            cursor = peaksBlock(doc, d, x + pad, cursor, kind === 'compact' ? 4 : 7, colors) + 2;
        }

        if (d.extras.length) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 4;
            d.extras.forEach(function(ex){
                rule(doc, x + pad, cursor - 1.8, 8, colors.accent, 0.8);
                text(doc, [90,90,86]); doc.setFont(undefined, 'bold'); doc.setFontSize(6.5); doc.text(st(ex[0].toUpperCase()), x + pad + 11, cursor);
                cursor = addWrap(doc, ex[1], x + pad + 10, cursor + 2.8, inner - 10, 6.9, 'normal', [72,72,68], 2.8) + 2.5;
            });
        }

        if (d.profile) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 4;
            text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(6.4); doc.text('TOURPROFIL', x + pad, cursor); cursor += 3.2;
            cursor = addWrap(doc, d.profile, x + pad, cursor, inner, 7.0, 'normal', [72,72,68], 2.8) + 2;
        }

        if (d.p) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 4;
            cursor = drawPerf(doc, d, x + pad, cursor, inner, colors);
        }

        if (d.notes) {
            draw(doc, [224,224,219]); doc.setLineWidth(0.25); doc.line(x + pad, cursor, x + w - pad, cursor); cursor += 4;
            cursor = addWrap(doc, d.notes, x + pad, cursor, inner, 7.0, 'italic', [118,118,112], 2.7);
        }
        return h;
    }

    function addHeader(doc, label, colors) {
        var grad;
        try {
            grad = typeof window.createPdfGradientImage === 'function'
                ? window.createPdfGradientImage(colors.topHex, colors.bottomHex, 1200, 60, 'horizontal')
                : null;
        } catch (_) { grad = null; }
        if (grad) doc.addImage(grad, 'PNG', 0, 0, 210, 9, undefined, 'FAST');
        text(doc, [105,105,101]); doc.setFont(undefined, 'bold'); doc.setFontSize(6.7); doc.text('BERGTOUREN TRACKER', M, 19);
        doc.setFont(undefined, 'normal'); doc.text(st('TOURENBUCH ' + label), 198, 19, {align:'right'});
        rule(doc, M, 22, CW, colors.accent, 0.65);
    }

    function footer(doc, label) {
        var total = doc.getNumberOfPages();
        for (var i = 1; i <= total; i++) {
            doc.setPage(i); text(doc, [145,145,140]); doc.setFont(undefined, 'normal'); doc.setFontSize(6.5);
            doc.text('Persönliches Bergtourenbuch', M, 288);
            doc.text(st('Tourenbuch ' + label), 105, 288, {align:'center'});
            doc.text(st('Seite ' + i + ' / ' + total), 198, 288, {align:'right'});
        }
    }

    async function cover(doc, entries, stats, label, colors, rep) {
        fill(doc, [255,255,253]); doc.rect(0,0,210,297,'F');
        if (rep) {
            try {
                doc.addImage(await crop(rep.imageData, 1400, 860, 0.86), 'JPEG', M, 28, CW, 112, undefined, 'FAST');
                fill(doc, [255,255,253]); doc.roundedRect(M + 8, 118, CW - 16, 39, 4, 4, 'F');
                text(doc, colors.accent); doc.setFont(undefined, 'bold'); doc.setFontSize(7); doc.text('PERSÖNLICHES BERGTOURENBUCH', M + 15, 128);
                text(doc, [34,34,32]); doc.setFontSize(23); doc.text(st('Tourenbuch ' + label), M + 15, 141);
                text(doc, [118,118,112]); doc.setFont(undefined, 'normal'); doc.setFontSize(7.1);
                doc.text(st(entries.length + ' gespeicherte Touren · erstellt am ' + new Date().toLocaleDateString('de-AT')), M + 15, 149);
                coverStats(doc, stats, 164, colors);
                return;
            } catch (_) {}
        }
        rule(doc, M, 30, 7, colors.accent, 55);
        text(doc, [35,35,32]); doc.setFont(undefined, 'bold'); doc.setFontSize(25); doc.text(st('Tourenbuch ' + label), M + 13, 53);
        text(doc, [120,120,114]); doc.setFont(undefined, 'normal'); doc.setFontSize(9); doc.text('Persönliche Bergstatistik und Tourenchronik', M + 13, 62);
        coverStats(doc, stats, 82, colors);
    }

    function coverStats(doc, stats, y, colors) {
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
        text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8.1); doc.text('MEINE BERGSAISON',M,y+39);
        var extra = [
            stats.totalSteps > 0 ? fi(stats.totalSteps) + ' Schritte' : null,
            stats.totalTimeText ? stats.totalTimeText + ' h Gehzeit' : null,
            stats.bigTours ? fi(stats.bigTours) + ' Big Tours' : null
        ].filter(Boolean).join(' · ');
        text(doc,[110,110,105]); doc.setFont(undefined,'normal'); doc.setFontSize(7.2); doc.text(st(extra),M,y+45);
    }

    function summary(doc, entries, stats, label, colors) {
        addHeader(doc, label, colors);
        text(doc,[35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(19); doc.text('Saisonbilanz',M,36);
        text(doc,colors.accent); doc.setFontSize(8); doc.text(st(fi(stats.totalTours)+' Touren · '+fi(stats.totalDistance)+' km · '+fi(stats.totalAscent)+' hm'),M,43);
        var items = [
            ['Gehzeit', stats.totalTimeText ? stats.totalTimeText+' h' : '–'],
            ['Schritte', stats.totalSteps > 0 ? fi(stats.totalSteps) : '–'],
            ['Big Tours', fi(stats.bigTours)],
            ['Ø Speed', stats.avgSpeed > 0 ? f1(stats.avgSpeed)+' km/h' : '–'],
            ['Ø Steigung', stats.avgGradient > 0 ? fi(stats.avgGradient)+' hm/km' : '–'],
            ['Ø Anstieg/h', stats.avgAscentPerHour > 0 ? fi(stats.avgAscentPerHour)+' hm/h' : '–']
        ];
        var gap=5,w=(CW-gap*2)/3;
        items.forEach(function(it,i){
            var x=M+(i%3)*(w+gap), y=51+Math.floor(i/3)*29;
            fill(doc,[248,248,244]); doc.roundedRect(x,y,w,24,2.6,2.6,'F');
            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(15); doc.text(st(it[1]),x+5,y+11);
            text(doc,[122,122,116]); doc.setFont(undefined,'normal'); doc.setFontSize(6.7); doc.text(it[0],x+5,y+18);
        });
        var extra = [['Gipfel 2000–2499 m',fi(stats.peaks2000)],['Gipfel 2500–2999 m',fi(stats.peaks2500)],['Gipfel ab 3000 m',fi(stats.peaks3000)],['Ø Leistungsindex',Number.isFinite(Number(stats.avgPerformanceIndex))?fi(stats.avgPerformanceIndex)+' / 100':'–']];
        var y=117; text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8.4); doc.text('WEITERE KENNZAHLEN',M,y); y+=6;
        extra.forEach(function(row,i){ var x=M+(i%2)*92, yy=y+Math.floor(i/2)*12; text(doc,[90,90,86]); doc.setFont(undefined,'normal'); doc.setFontSize(7.6); doc.text(row[0],x,yy); text(doc,[38,38,35]); doc.setFont(undefined,'bold'); doc.text(row[1],x+66,yy,{align:'right'}); });
        if (typeof window.computeMilestones === 'function') {
            var ms=window.computeMilestones(entries), defs=[['Strecke','dist','km'],['Aufstieg','asc','hm'],['Gehzeit','time','h'],['Gipfel','peaks','Gipfel'],['Schritte','steps','Schritte']];
            y+=31; text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(8.4); doc.text('MEILENSTEINE',M,y); y+=7;
            defs.forEach(function(d,i){
                var x=M+(i%2)*92, yy=y+Math.floor(i/2)*19, data=ms[d[1]], reached=data&&Array.isArray(data.reached)?data.reached.length:0, progress=1;
                if(data&&data.next!==null){ var prev=reached?data.reached[reached-1].milestone:0; progress=Math.max(0,Math.min(1,(n(data.total)-prev)/Math.max(1,data.next-prev))); }
                text(doc,[65,65,60]); doc.setFont(undefined,'bold'); doc.setFontSize(7.1); doc.text(d[0],x,yy);
                text(doc,[135,135,130]); doc.setFont(undefined,'normal'); doc.setFontSize(6.4);
                var remain=data&&data.next!==null?(' · noch '+Math.max(0,data.next-n(data.total))+' '+d[2]):'';
                doc.text(st(reached+' erreicht'+remain),x,yy+4);
                fill(doc,[231,231,227]); doc.roundedRect(x,yy+7,84,2.4,1.2,1.2,'F'); fill(doc,colors.accent); doc.roundedRect(x,yy+7,Math.max(2,84*progress),2.4,1.2,1.2,'F');
            });
        }
    }

    function yearsPage(doc, from, to, colors) {
        var label=from+'–'+to;
        addHeader(doc,label,colors);
        text(doc,[35,35,32]); doc.setFont(undefined,'bold'); doc.setFontSize(19); doc.text('Jahresübersicht',M,36);
        var y=49;
        for(var year=from;year<=to;year++){
            var es=typeof window.getToursInYearRange==='function'?window.getToursInYearRange(year,year):[];
            if(!es.length) continue;
            var s=window.computeStatsSummary(es), h=30;
            fill(doc, [249,248,244]); doc.roundedRect(M,y,CW,h,3,3,'F'); rule(doc,M,y,22,colors.accent,1.2);
            text(doc,colors.accent); doc.setFont(undefined,'bold'); doc.setFontSize(15); doc.text(String(year),M+5,y+13);
            [['Touren',fi(s.totalTours)],['Strecke',f1(s.totalDistance)+' km'],['Aufstieg',fi(s.totalAscent)+' hm'],['Gehzeit',s.totalTimeText+' h'],['Gipfel',fi(s.totalPeaks)]].forEach(function(c,j){
                var x=M+39+j*30.3; text(doc,[115,115,110]); doc.setFont(undefined,'normal'); doc.setFontSize(6.2); doc.text(c[0],x,y+8);
                text(doc,[42,42,39]); doc.setFont(undefined,'bold'); doc.setFontSize(8.3); doc.text(c[1],x,y+16);
            });
            y+=h+5;
        }
    }

    function kindFor(d,i,seed){
        // Vollbreite nur noch für echte Highlights: Big Tours oder sehr inhaltsreiche Fototouren.
        if(d.isBig || (d.photo && d.complexity>=12)) return 'feature';
        return d.photo && ((i + seed) % 3 === 1) ? 'split' : 'compact';
    }

    async function renderTours(doc, entries, from, to, colors) {
        var profile=typeof window.buildTourProfileAnalysis==='function'?window.buildTourProfileAnalysis(entries):null;
        var ds=entries.map(function(e){return dataFor(e,profile);});
        var colGap=5,colW=(CW-colGap)/2,colY=[28,28],seed=0;
        doc.addPage(); addHeader(doc,from===to?String(from):from+'–'+to,colors);
        function page(){
            doc.addPage(); addHeader(doc,from===to?String(from):from+'–'+to,colors); colY=[28,28]; seed++;
        }
        for(var i=0;i<ds.length;i++){
            var d=ds[i], kind=kindFor(d,i,seed);
            if(kind==='feature'){
                var fh=measure(measureDoc,d,CW,'feature'), yy=Math.max(colY[0],colY[1]);
                if(yy+fh>SAFE_BOTTOM){ page(); yy=28; }
                await drawTour(doc,d,M,yy,CW,'feature',colors);
                colY=[yy+fh+GAP,yy+fh+GAP];
                continue;
            }
            var actual=(d.photo&&((i+seed)%2===1))?'split':'compact';
            var h=measure(measureDoc,d,colW,actual), col=colY[0]<=colY[1]?0:1;
            if(colY[col]+h>SAFE_BOTTOM){
                var other=1-col;
                if(colY[other]+h<=SAFE_BOTTOM) col=other;
                else { page(); col=0; }
            }
            var x=M+col*(colW+colGap), y=colY[col];
            await drawTour(doc,d,x,y,colW,actual,colors);
            colY[col]=y+h+GAP;

        }
    }

    async function generate(from,to){
        var js=window.jspdf.jsPDF, doc=new js({unit:'mm',format:'a4'}), colors=tc();
        var entries=window.getToursInYearRange(from,to), label=from===to?String(from):from+'–'+to;
        if(typeof window.showToast==='function') window.showToast('Magazin-Tourenbuch wird erstellt…',{type:'info',duration:2500});
        if(!entries.length){
            await cover(doc,[],{totalTours:0,totalDistance:0,totalAscent:0,totalPeaks:0,totalSteps:0,totalTimeText:'0:00',bigTours:0},label,colors,null);
            footer(doc,label); save(doc,from,to); return;
        }
        var stats=window.computeStatsSummary(entries), rep=typeof window.getPdfRepresentativePhoto==='function'?window.getPdfRepresentativePhoto(entries):entries.find(function(e){return e.imageData;})||null;
        await cover(doc,entries,stats,label,colors,rep);
        doc.addPage(); summary(doc,entries,stats,label,colors);
        if(from!==to){ doc.addPage(); yearsPage(doc,from,to,colors); }
        await renderTours(doc,entries,from,to,colors);
        footer(doc,label); save(doc,from,to);
    }

    function save(doc,from,to){
        var filename=from===to?'tourenbuch-'+from+'.pdf':'tourenbuch-'+from+'-'+to+'.pdf';
        var blob=doc.output('blob'), file=new File([blob],filename,{type:'application/pdf'});
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
                if(typeof window.showToast==='function')window.showToast('PDF konnte nicht erstellt werden.',{type:'error',duration:3500});
            });
        },true);
    }

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
    console.info('PDF-Magazin-Layout aktiviert.');
})();