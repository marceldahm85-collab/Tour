/*
 * Sicherung, dateiverknüpfte Datenhaltung und Tourbuch-Export.
 * Wird nach dem App-Kern und vor pdf-magazine.js geladen.
 * App-Funktionen/Stores werden bewusst aus dem globalen App-Kontext verwendet.
 */

/* ---------- Persistenter Datei-Handle (IndexedDB) ---------- */
// ---------IndexedDB-Hilfsfunktion--------

const FILE_DB_NAME = 'tourtracker-file-db';
const FILE_DB_STORE = 'handles';
const FILE_DB_KEY = 'mainDataFileHandle';

function openFileHandleDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(FILE_DB_NAME, 1);

        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(FILE_DB_STORE)) {
                db.createObjectStore(FILE_DB_STORE);
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function persistLinkedFileHandle(handle) {
    const db = await openFileHandleDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_DB_STORE, 'readwrite');
        const store = tx.objectStore(FILE_DB_STORE);

        store.put(handle, FILE_DB_KEY);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

async function loadPersistedFileHandle() {
    const db = await openFileHandleDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_DB_STORE, 'readonly');
        const store = tx.objectStore(FILE_DB_STORE);
        const req = store.get(FILE_DB_KEY);

        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function clearPersistedFileHandle() {
    const db = await openFileHandleDb();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(FILE_DB_STORE, 'readwrite');
        const store = tx.objectStore(FILE_DB_STORE);

        store.delete(FILE_DB_KEY);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

async function ensureFilePermission(handle, write = false) {
    if (!handle) return false;

    const options = { mode: write ? 'readwrite' : 'read' };

    if ((await handle.queryPermission(options)) === 'granted') {
        return true;
    }

    if ((await handle.requestPermission(options)) === 'granted') {
        return true;
    }

    return false;
}

/* ---------- Datenbackup und Wiederherstellung ---------- */
// --------------Datei speichern-----------

let linkedFileHandle = null;
const BACKUP_LAST_SAVED_KEY = 'backupLastSavedAt_v1';

function formatBackupStatusDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Noch keine';

    return date.toLocaleString('de-AT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', ' ·');
}

function updateBackupStatusSummary() {
    const savedEl = document.getElementById('backup-status-saved');
    const plannedEl = document.getElementById('backup-status-planned');
    const lastEl = document.getElementById('backup-status-last');
    const fileEl = document.getElementById('backup-status-file');

    const savedTours = appStorage.get('touren') || [];
    const plannedTours = appStorage.get('plannedTours') || [];
    const lastSavedAt = appStorage.get(BACKUP_LAST_SAVED_KEY);

    if (savedEl) savedEl.textContent = String(Array.isArray(savedTours) ? savedTours.length : 0);
    if (plannedEl) plannedEl.textContent = String(Array.isArray(plannedTours) ? plannedTours.length : 0);
    if (lastEl) lastEl.textContent = formatBackupStatusDate(lastSavedAt);
    if (fileEl) fileEl.textContent = linkedFileHandle?.name || 'Nicht verbunden';
}

function markBackupSavedNow() {
    appStorage.set(BACKUP_LAST_SAVED_KEY, new Date().toISOString());
    updateBackupStatusSummary();
}

function buildAppDataPayload() {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        touren: appStorage.get('touren') || [],
        plannedTours: appStorage.get('plannedTours') || [],
        meta: {
            theme: document.body.classList.contains('dark')
                ? 'dark'
                : document.body.classList.contains('green')
                ? 'green'
                : document.body.classList.contains('summit')
                ? 'summit'
                : 'light',
            themeEditorSettings: appStorage.get(THEME_EDITOR_KEY) || null,
            font: getThemeEditorFontName(),
            fontSize: getThemeEditorFontSizeScale()
        }
    };
}

function applyAppDataPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Ungültige Datendatei');
    }

    const importedTours =
        ensureUniqueEntryIds(
            Array.isArray(payload.touren)
                ? payload.touren
                : [],
            'tour'
        ).entries;

    const importedPlannedTours =
        ensureUniqueEntryIds(
            Array.isArray(payload.plannedTours)
                ? payload.plannedTours
                : [],
            'plan'
        ).entries;

    appStorage.set('touren', importedTours);
    appStorage.set('plannedTours', importedPlannedTours);

    if (payload.meta?.themeEditorSettings) {
        appStorage.set(THEME_EDITOR_KEY, payload.meta.themeEditorSettings);

        if (typeof invalidateThemeEditorDraft === 'function') {
            invalidateThemeEditorDraft();
        }
    }

    if (payload.meta?.theme) {

    const ICONS = {
        light: '☀️',
        dark: '🌙',
        green: '🌿',
        summit: '⛰️'
    };

    const validThemes = [
        'light',
        'dark',
        'green',
        'summit'
    ];

    let theme =
        payload.meta.theme;

    if (!validThemes.includes(theme)) {
        theme = 'light';
    }

    document.body.classList.remove(
        'dark',
        'green',
        'summit'
    );

    if (theme === 'dark') {
        document.body.classList.add('dark');
    }

    if (theme === 'green') {
        document.body.classList.add('green');
    }

    if (theme === 'summit') {
        document.body.classList.add('summit');
    }

    appStorage.set('theme', theme);



    try {


        localStorage.setItem('tourtracker-theme', theme);


    } catch (error) {


        console.warn('[Theme] localStorage-Sicherung fehlgeschlagen:', error);


    }

    if (typeof applyThemeEditorSettingsToDom === 'function') {
        applyThemeEditorSettingsToDom();
    }

}

    const importedFont = payload.meta?.font;
    if (
        typeof importedFont === 'string' &&
        Object.prototype.hasOwnProperty.call(THEME_EDITOR_FONT_PRESETS, importedFont)
    ) {
        appStorage.set(THEME_EDITOR_FONT_KEY, importedFont);
        if (typeof applyThemeEditorFont === 'function') {
            applyThemeEditorFont(importedFont, false);
        }
    }

    const importedFontSize = Number(payload.meta?.fontSize);
    if (Number.isFinite(importedFontSize)) {
        appStorage.set(
            THEME_EDITOR_FONT_SIZE_KEY,
            Math.max(80, Math.min(130, importedFontSize))
        );
        if (typeof applyThemeEditorFontSize === 'function') {
            applyThemeEditorFontSize(importedFontSize, false);
        }
    }

    tablePage = 1;
    loadData();
    loadPlannedTours();
    updatePlannedPeaks();
    updateBackupStatusSummary();
}

function updateFileStatus(text) {
    const statusEl = document.getElementById('file-status');
    if (statusEl) statusEl.textContent = text;
    updateBackupStatusSummary();
}

async function createNewDataFile() {
    if (!window.showSaveFilePicker) {
        showToast(
    'Dieser Browser unterstützt die Datendatei-Funktion leider nicht vollständig.',
    {
        type: 'info',
        duration: 4000
    }
);
        return;
    }

    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: 'Tourentracker-Daten.json',
            types: [
                {
                    description: 'JSON-Datei',
                    accept: {
                        'application/json': ['.json']
                    }
                }
            ]
        });

        linkedFileHandle = handle;
        await persistLinkedFileHandle(handle);

        updateFileStatus(`Neue Datei verbunden: ${handle.name}`);

        await saveDataToLinkedFile();
    } catch (err) {
        if (err?.name !== 'AbortError') {
            console.error(err);
            showToast(
    'Neue Datei konnte nicht angelegt werden.',
    {
        type: 'error',
        duration: 3500
    }
);
        }
    }
}

async function openExistingDataFile() {
    if (!window.showOpenFilePicker) {
        showToast(
    'Dieser Browser unterstützt das Öffnen bestehender Datendateien leider nicht vollständig.',
    {
        type: 'info',
        duration: 4000
    }
);
        return;
    }

    try {
        const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [
                {
                    description: 'JSON-Datei',
                    accept: {
                        'application/json': ['.json']
                    }
                }
            ]
        });

        if (!handle) return;

        linkedFileHandle = handle;
        await persistLinkedFileHandle(handle);

        updateFileStatus(`Geöffnet: ${handle.name}`);

        await loadDataFromLinkedFile();
    } catch (err) {
        if (err?.name !== 'AbortError') {
            console.error(err);
            showToast(
    'Bestehende Datei konnte nicht geöffnet werden.',
    {
        type: 'error',
        duration: 3500
    }
);
        }
    }
}

async function saveDataToLinkedFile(silent = false) {
    if (!linkedFileHandle) {
        if (!silent) {
    showToast(
        'Bitte zuerst eine Datei anlegen oder öffnen.',
        {
            type: 'info',
            duration: 3000
        }
    );
}
        return false;
    }

    try {
        const hasPermission = await ensureFilePermission(linkedFileHandle, true);
        if (!hasPermission) {
            if (!silent) {
                showToast(
    'Keine Schreibberechtigung für die Datei.',
    {
        type: 'error',
        duration: 3500
    }
);
            } else {
                console.warn('Auto-Save: Keine Schreibberechtigung für die Datei.');
            }
            return false;
        }

        const writable = await linkedFileHandle.createWritable();
        const payload = buildAppDataPayload();

        await writable.write(JSON.stringify(payload, null, 2));
        await writable.close();

        updateFileStatus(`Gespeichert: ${linkedFileHandle.name} (${new Date().toLocaleTimeString('de-DE')})`);
        markBackupSavedNow();
        return true;
    } catch (err) {
        console.error(err);
        if (!silent) {
            showToast(
    'Speichern in Datei fehlgeschlagen.',
    {
        type: 'error',
        duration: 3500
    }
);
        } else {
            console.warn('Automatischer Datei-Sync fehlgeschlagen — Tour wurde aber lokal gespeichert.');
        }
        return false;
    }
}

async function loadDataFromLinkedFile() {
    if (!linkedFileHandle) {
        showToast(
    'Bitte zuerst eine bestehende Datei öffnen oder eine Datei anlegen.',
    {
        type: 'info',
        duration: 3000
    }
);
        return;
    }

    try {
        const hasPermission = await ensureFilePermission(linkedFileHandle, false);
        if (!hasPermission) {
            showToast(
    'Keine Leseberechtigung für die Datei.',
    {
        type: 'error',
        duration: 3500
    }
);
            return;
        }

        const file = await linkedFileHandle.getFile();
        const text = await file.text();
        const payload = JSON.parse(text);

        applyAppDataPayload(payload);
        updateFileStatus(`Geladen: ${linkedFileHandle.name}`);
    } catch (err) {
        console.error(err);
        showToast(
    'Laden aus Datei fehlgeschlagen oder Datei ist ungültig.',
    {
        type: 'error',
        duration: 4000
    }
);
    }
}

async function disconnectDataFile() {
    linkedFileHandle = null;

    try {
        await clearPersistedFileHandle();
    } catch (err) {
        console.error('Datei-Verknüpfung konnte nicht gelöscht werden:', err);
    }

    updateFileStatus('Keine Datei verbunden');
}

async function autoSaveDataFileIfLinked() {
    // Automatischer Datei-Sync deaktiviert — die File System Access API
    // löst dabei native Berechtigungs-Dialoge aus, die sich nicht stylen lassen.
    // Datensicherung läuft stattdessen ausschließlich über
    // "Einfacher Download" / "Einfacher Import" (siehe Datensicherung-Box).
    return;
}

async function restoreLinkedFileHandleOnStartup() {
    try {
        const handle = await loadPersistedFileHandle();

        if (!handle) {
            updateFileStatus('Keine Datei verbunden');
            return;
        }

        linkedFileHandle = handle;

        const hasReadPermission = await handle.queryPermission({ mode: 'read' });

        if (hasReadPermission === 'granted') {
            updateFileStatus(`Verbunden: ${handle.name}`);

            // Theme zusätzlich aus der verknüpften Datendatei wiederherstellen.
            // Die Tourdaten selbst werden dabei NICHT automatisch geladen.
            try {
                const file = await handle.getFile();
                const payload = JSON.parse(await file.text());
                const fileTheme = payload?.meta?.theme;
                const validThemes = ['light', 'dark', 'green', 'summit'];

                if (payload?.meta?.themeEditorSettings) {
                    appStorage.set(THEME_EDITOR_KEY, payload.meta.themeEditorSettings);

                    if (typeof invalidateThemeEditorDraft === 'function') {
                        invalidateThemeEditorDraft();
                    }
                }

                const fileFont = payload?.meta?.font;
                if (
                    typeof fileFont === 'string' &&
                    Object.prototype.hasOwnProperty.call(THEME_EDITOR_FONT_PRESETS, fileFont)
                ) {
                    appStorage.set(THEME_EDITOR_FONT_KEY, fileFont);
                    if (typeof applyThemeEditorFont === 'function') {
                        applyThemeEditorFont(fileFont, false);
                    }
                }

                const fileFontSize = Number(payload?.meta?.fontSize);
                if (Number.isFinite(fileFontSize)) {
                    appStorage.set(
                        THEME_EDITOR_FONT_SIZE_KEY,
                        Math.max(80, Math.min(130, fileFontSize))
                    );
                    if (typeof applyThemeEditorFontSize === 'function') {
                        applyThemeEditorFontSize(fileFontSize, false);
                    }
                }

                if (validThemes.includes(fileTheme)) {
                    document.body.classList.remove('dark', 'green', 'summit');

                    if (fileTheme === 'dark') {
                        document.body.classList.add('dark');
                    } else if (fileTheme === 'green') {
                        document.body.classList.add('green');
                    } else if (fileTheme === 'summit') {
                        document.body.classList.add('summit');
                    }

                    appStorage.set('theme', fileTheme);

                    try {
                        localStorage.setItem('tourtracker-theme', fileTheme);
                    } catch (error) {
                        console.warn('[Theme] lokale Sicherung aus Datendatei fehlgeschlagen:', error);
                    }

                    try {
                        sessionStorage.setItem('tourtracker-theme', fileTheme);
                    } catch (error) {
                        console.warn('[Theme] Session-Sicherung aus Datendatei fehlgeschlagen:', error);
                    }

                    const icons = {
                        light: '☀️',
                        dark: '🌙',
                        green: '🌿',
                        summit: '⛰️'
                    };
                

                    document.querySelectorAll('[data-theme-choice]').forEach(option => {
                        const active = option.dataset.themeChoice === fileTheme;
                        option.classList.toggle('active', active);
                        option.setAttribute('aria-pressed', active ? 'true' : 'false');
                    });

                    if (typeof applyThemeEditorSettingsToDom === 'function') {
                        applyThemeEditorSettingsToDom();
                    }

                    if (typeof refreshThemeDependentUi === 'function') {
                        refreshThemeDependentUi();
                    }
                }
            } catch (error) {
                console.warn('[Theme] Theme aus verknüpfter Datendatei konnte nicht gelesen werden:', error);
            }
        } else {
            updateFileStatus(`Gemerkte Datei: ${handle.name} (Zugriff bei Bedarf bestätigen)`);
        }
    } catch (err) {
        console.error('Gespeicherte Datei-Verknüpfung konnte nicht geladen werden:', err);
        updateFileStatus('Keine Datei verbunden');
    }
}

function initBackupExportFeature() {
    document.getElementById('file-create-btn')?.addEventListener('click', createNewDataFile);
    document.getElementById('file-open-btn')?.addEventListener('click', openExistingDataFile);
    document.getElementById('file-load-btn')?.addEventListener('click', loadDataFromLinkedFile);
    document.getElementById('file-save-btn')?.addEventListener('click', () => {
    saveDataToLinkedFile(false);
    });
    document.getElementById('file-disconnect-btn')?.addEventListener('click', disconnectDataFile);
    
    // Einfacher Download (funktioniert auf allen Geräten)
    document.getElementById('simple-download-btn')?.addEventListener('click', () => {
        const payload = buildAppDataPayload();
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
    
        const date = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Touren-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        markBackupSavedNow();
    
        showToast('Datei heruntergeladen ✓', { type: 'success', duration: 2000 });
    });
    
    // Einfacher Import (funktioniert auf allen Geräten)
    document.getElementById('simple-import-btn')?.addEventListener('click', () => {
        document.getElementById('simple-import-input')?.click();
    });
    
    document.getElementById('simple-import-input')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            applyAppDataPayload(payload);
            showToast('Daten erfolgreich importiert ✓', { type: 'success', duration: 3000 });
        } catch (err) {
            console.error(err);
            showToast('Import fehlgeschlagen — Datei ungültig.', { type: 'error' });
        }
    
        // Input zurücksetzen damit dieselbe Datei nochmal geladen werden kann
        e.target.value = '';
    });
    
    updateBackupStatusSummary();
    restoreLinkedFileHandleOnStartup();
}

/* ---------- Tourbuch-Export: Datenauswahl ---------- */
// ================== PDF-Tourenbuch: Datenfunktionen ==================

function getToursInYearRange(fromYear, toYear) {
    const from = Math.min(fromYear, toYear);
    const to = Math.max(fromYear, toYear);

    return getAllSavedTours()
        .filter(entry => {
            const date = parseStatsCalendarDate(entry?.date);
            if (!date) return false;
            const year = date.getFullYear();
            return year >= from && year <= to;
        })
        .sort((a, b) => parseStatsCalendarDate(a.date) - parseStatsCalendarDate(b.date));
}

function getPdfExportAvailableYears() {
    const years = new Set();
    getAllSavedTours().forEach(entry => {
        const date = parseStatsCalendarDate(entry?.date);
        if (date) years.add(date.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
}

function buildPdfYearOverviewRows(fromYear, toYear) {
    const rows = [];
    for (let year = fromYear; year <= toYear; year++) {
        const entries = getToursInYearRange(year, year);
        if (!entries.length) continue;
        const stats = computeStatsSummary(entries);
        rows.push([
            String(year),
            String(stats.totalTours),
            `${stats.totalDistance.toFixed(1).replace('.', ',')} km`,
            `${Math.round(stats.totalAscent)} hm`,
            `${stats.totalTimeText} h`,
            Math.round(stats.totalSteps).toLocaleString('de-AT'),
            String(stats.totalPeaks)
        ]);
    }
    return rows;
}


function getPdfRepresentativePhoto(entries) {
    const withPhotos = entries.filter(e => e.imageData);
    if (!withPhotos.length) return null;

    let best = withPhotos[0];
    let bestScore = -Infinity;

    withPhotos.forEach(entry => {
        const perf = calculatePerformanceIndex(entry);
        const score = perf && Number.isFinite(perf.score) ? perf.score : -1;
        if (score > bestScore) {
            bestScore = score;
            best = entry;
        }
    });

    return best;
}

/* ---------- Tourbuch-Export: PDF-Erzeugung und Steuerung ---------- */
const PDF_EXPORT_PAGE = { width: 210, height: 297, margin: 15 };

function pdfExportFormatDate(dateStr) {
    const date = parseStatsCalendarDate(dateStr);
    if (!date) return dateStr || '–';
    return date.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sanitizePdfText(value) {
    if (value === null || value === undefined) return '';

    return String(value)
        .replace(/≥/g, '>=')
        .replace(/≤/g, '<=')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')  // Emoji-Blöcke (Symbole, Piktogramme, Gesten, Flaggen)
        .replace(/[\u{2190}-\u{2BFF}]/gu, '')    // Pfeile, math. Symbole, Dingbats, Sterne
        .replace(/[\u{2600}-\u{27BF}]/gu, '')    // Wettersymbole, Dingbats (⛰, ⚡, ✓ ...)
        .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // Variation Selectors (Emoji-Zusatzbytes)
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function cropImageToAspectDataUrl(dataUrl, targetWidthPx, targetHeightPx, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const targetRatio = targetWidthPx / targetHeightPx;
            const imgRatio = img.width / img.height;
            let sx, sy, sw, sh;

            if (imgRatio > targetRatio) {
                sh = img.height;
                sw = sh * targetRatio;
                sx = (img.width - sw) / 2;
                sy = 0;
            } else {
                sw = img.width;
                sh = sw / targetRatio;
                sx = 0;
                sy = (img.height - sh) / 2;
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetWidthPx;
            canvas.height = targetHeightPx;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidthPx, targetHeightPx);

            resolve(canvas.toDataURL('image/jpeg', quality));
        };

        img.onerror = reject;
        img.src = dataUrl;
    });
}

function buildPdfTourCardBlocks(doc, entry, textWidth, profileAnalysis) {
    const blocks = [];

    const addBlock = (text, { fontSize, style = 'normal', color = [40, 40, 40], lineHeight, gapAfter = 1.5 } = {}) => {
        const safeText = sanitizePdfText(text);
        doc.setFont(undefined, style);
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(safeText, textWidth);
        blocks.push({ lines, fontSize, style, color, lineHeight: lineHeight || fontSize * 0.42, gapAfter });
    };

    const addRawLines = (rawLines, { fontSize, style = 'normal', color = [70, 70, 70], lineHeight, gapAfter = 1.5 } = {}) => {
        const safeLines = rawLines.map(sanitizePdfText).filter(Boolean);
        if (!safeLines.length) return;
        doc.setFont(undefined, style);
        doc.setFontSize(fontSize);
        blocks.push({ lines: safeLines, fontSize, style, color, lineHeight: lineHeight || fontSize * 0.42, gapAfter });
    };

    // ---------- Titel mit Auszeichnungen ----------
    const bigTourFlag = isBigTour(entry) ? ' [Big Tour]' : '';
    const gradientFlag = entry.useFullDistanceForGradient ? ' [Volle Strecke]' : '';

    addBlock(
        `${pdfExportFormatDate(entry.date)} · ${entry.tourname || 'Unbenannte Tour'}${bigTourFlag}${gradientFlag}`,
        { fontSize: 12, style: 'bold', color: [25, 25, 25], gapAfter: 2 }
    );

    // ---------- Top-3-Kategorien (ohne Icons) ----------
    const categoryDetails = getHighlightCategoryDetails(entry);
    if (categoryDetails.length) {
        const text = categoryDetails
            .map(info => `${info.name} (Platz ${info.rank})`)
            .join('   ·   ');
        addBlock(text, { fontSize: 8, style: 'italic', color: [150, 120, 20], gapAfter: 2 });
    }

    // ---------- Art & Region ----------
    addBlock(
        `${getTourCompareDifficultyLabel(entry.difficulty)} · ${entry.region || '–'}`,
        { fontSize: 8.5, color: [100, 100, 100], gapAfter: 2 }
    );

    // ---------- Tourgruppe ----------
    if (entry.tourGroup) {
        const dayInfo = entry.tourDay && entry.tourDayCount ? ` (Tag ${entry.tourDay}/${entry.tourDayCount})` : '';
        addBlock(`Tourgruppe: ${entry.tourGroup}${dayInfo}`, { fontSize: 8.5, style: 'italic', color: [110, 110, 110], gapAfter: 2 });
    }

    // ---------- Hauptkennzahlen ----------
    const metrics = getTourCompareMetrics(entry, profileAnalysis);
    const mainStats = [
        entry.strecke ? `${entry.strecke} km` : null,
        entry.aufstieg ? `${entry.aufstieg} hm` : null,
        entry.zeit ? `${entry.zeit} h` : null,
        entry.gipfel ? `${entry.gipfel} Gipfel` : null,
        metrics.steps ? `${metrics.steps.toLocaleString('de-AT')} Schritte` : null
    ].filter(Boolean).join('   ·   ');
    if (mainStats) addBlock(mainStats, { fontSize: 9.5, color: [40, 40, 40], gapAfter: 1.5 });

    // ---------- Klettersteig ----------
    if (entry.ferrataStrecke || entry.ferrataHm || entry.ferrataZeit) {
        const text = [
            entry.ferrataStrecke ? `${entry.ferrataStrecke} km` : null,
            entry.ferrataHm ? `${entry.ferrataHm} hm` : null,
            entry.ferrataZeit ? `${entry.ferrataZeit} h` : null
        ].filter(Boolean).join(' · ');
        addBlock(`Klettersteig: ${text}`, { fontSize: 8.5, color: [70, 70, 70], gapAfter: 1.5 });
    }

    // ---------- Rad ----------
    if (entry.bikeStrecke || entry.bikeHm || entry.bikeZeit) {
        const text = [
            entry.bikeStrecke ? `${entry.bikeStrecke} km` : null,
            entry.bikeHm ? `${entry.bikeHm} hm` : null,
            entry.bikeZeit ? `${entry.bikeZeit} h` : null
        ].filter(Boolean).join(' · ');
        addBlock(`Rad: ${text}`, { fontSize: 8.5, color: [70, 70, 70], gapAfter: 1.5 });
    }

    // ---------- Ausgangspunkt ----------
    if (entry.ausgangspunkt) {
        addBlock(`Ausgangspunkt: ${entry.ausgangspunkt}`, { fontSize: 8.5, color: [70, 70, 70], gapAfter: 1.5 });
    }

    // ---------- Gipfel – detailliert, eine Zeile pro Gipfel (Bullet statt Emoji) ----------
    if (Array.isArray(entry.gipfelDetails) && entry.gipfelDetails.length) {
        const peakLines = entry.gipfelDetails
            .filter(g => g && (g.name || g.hoehe))
            .map(g => `• ${g.name || 'Unbenannt'} – ${g.hoehe || '–'} m`);
        addRawLines(peakLines, { fontSize: 8.5, color: [70, 70, 70], gapAfter: 1.5 });
    }

    // ---------- Geschwindigkeit / Steigung / Anstieg ----------
    const metricsLine = [
        metrics.speed !== null ? formatTourCompareValue(metrics.speed, 'speed') : null,
        metrics.gradient !== null ? formatTourCompareValue(metrics.gradient, 'gradient') : null,
        metrics.ascentRate !== null ? formatTourCompareValue(metrics.ascentRate, 'ascentRate') : null
    ].filter(Boolean).join('   ·   ');
    if (metricsLine) addBlock(metricsLine, { fontSize: 8.5, color: [70, 70, 70], gapAfter: 1.5 });

    // ---------- Tourprofil ----------
    if (metrics.profile && metrics.profile !== '–') {
        addBlock(`Tourprofil: ${metrics.profile}`, { fontSize: 8.5, color: [70, 70, 70], gapAfter: 1.5 });
    }

    // ---------- Leistungsindex ----------
    const performance = calculatePerformanceIndex(entry);
    if (performance && Number.isFinite(performance.score)) {
        let comparisonText;
        if (performance.comparisonCount >= 5) {
            comparisonText = performance.overallPercentile >= 100
                ? 'beste deiner vergleichbaren Touren'
                : `besser als ${performance.overallPercentile} % deiner vergleichbaren Touren`;
        } else {
            comparisonText = `Vergleich mit ${performance.comparisonCount} ${performance.comparisonCount === 1 ? 'Tour' : 'Touren'}`;
        }
        addBlock(
            `Leistungsindex (${performance.groupLabel}): ${performance.score} / 100 – ${comparisonText}`,
            { fontSize: 8.5, color: [70, 70, 70], gapAfter: 1.5 }
        );
    }

    // ---------- Notizen ----------
    if (entry.notes) {
        addBlock(entry.notes, { fontSize: 8, style: 'italic', color: [120, 120, 120], gapAfter: 0 });
    }

    return blocks;
}

function measurePdfTourCardHeight(blocks, minPhotoHeight) {
    const textHeight = blocks.reduce((sum, b) => sum + b.lines.length * b.lineHeight + b.gapAfter, 0);
    return Math.max(textHeight + 10, minPhotoHeight + 10);
}

async function drawPdfTourCard(doc, entry, x, y, width, blocks, cardHeight) {
    const hasPhoto = !!entry.imageData;
    const photoSize = hasPhoto ? 38 : 0;
    const textX = x + 5;

    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(x, y, width, cardHeight, 3, 3, 'FD');

    let cursorY = y + 8;

    blocks.forEach(block => {
        doc.setFont(undefined, block.style);
        doc.setFontSize(block.fontSize);
        doc.setTextColor(...block.color);
        block.lines.forEach((line, idx) => {
            doc.text(line, textX, cursorY + idx * block.lineHeight);
        });
        cursorY += block.lines.length * block.lineHeight + block.gapAfter;
    });

    if (hasPhoto) {
        try {
            const cropped = await cropImageToAspectDataUrl(entry.imageData, 300, 300, 0.75);
            const photoX = x + width - photoSize - 5;
            const photoY = y + 5;
            doc.addImage(cropped, 'JPEG', photoX, photoY, photoSize, photoSize, undefined, 'FAST');
        } catch (err) {
            console.warn('PDF-Bild konnte nicht eingebettet werden:', err);
        }
    }
}

function pdfExportDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pdfExportSaveOrShare(doc, fromYear, toYear) {
    const filename = fromYear === toYear
        ? `tourenbuch-${fromYear}.pdf`
        : `tourenbuch-${fromYear}-${toYear}.pdf`;

    const blob = doc.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });
    const canUseShare = navigator.canShare && navigator.canShare({ files: [file] });

    if (canUseShare) {
        navigator.share({ files: [file], title: filename }).catch(err => {
            if (err.name !== 'AbortError') pdfExportDownloadBlob(blob, filename);
        });
        return;
    }

    pdfExportDownloadBlob(blob, filename);
}

// ================== PDF: Theme-Farben & Grafik-Helfer ==================

function hexToRgbArray(hex) {
    const clean = String(hex || '').replace('#', '');
    if (clean.length !== 6) return [60, 60, 60];
    return [
        parseInt(clean.substring(0, 2), 16),
        parseInt(clean.substring(2, 4), 16),
        parseInt(clean.substring(4, 6), 16)
    ];
}

function getPdfThemeColors() {
    const themeKey = themeEditorGetActiveTheme();
    const settings = getThemeEditorSettings()[themeKey] || defaultThemeEditorSettings.light;

    return {
        top: hexToRgbArray(settings.topColor),
        bottom: hexToRgbArray(settings.bottomColor),
        accent: hexToRgbArray(settings.accent),
        accent2: hexToRgbArray(settings.accent2),
        topHex: settings.topColor,
        bottomHex: settings.bottomColor
    };
}

function getPdfContrastTextColor(rgb) {
    const [r, g, b] = rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? [30, 30, 30] : [255, 255, 255];
}

function createPdfGradientImage(colorStartHex, colorEndHex, widthPx, heightPx, direction = 'horizontal') {
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');

    const gradient = direction === 'horizontal'
        ? ctx.createLinearGradient(0, 0, widthPx, 0)
        : ctx.createLinearGradient(0, 0, 0, heightPx);

    gradient.addColorStop(0, colorStartHex);
    gradient.addColorStop(1, colorEndHex);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, widthPx, heightPx);

    return canvas.toDataURL('image/png');
}

function drawPdfStatTile(doc, x, y, w, h, label, value, colors) {
    doc.setDrawColor(225, 225, 225);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');

    doc.setFillColor(...colors.accent);
    doc.roundedRect(x, y, 2, h, 1, 1, 'F');

    doc.setFontSize(12.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(sanitizePdfText(value), x + 5, y + h / 2 - 1);

    doc.setFontSize(7.5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(sanitizePdfText(label), x + 5, y + h / 2 + 6);
}

function drawPdfMilestoneRow(doc, x, y, w, label, data, unit, colors) {
    const reachedCount = data.reached.length;
    const next = data.next;
    let progress = 100;
    let progressText = 'Alle Meilensteine erreicht';

    if (next !== null) {
        const prev = reachedCount > 0 ? data.reached[reachedCount - 1].milestone : 0;
        progress = Math.min(100, Math.max(0, ((data.total - prev) / (next - prev)) * 100));
        const remaining = next - data.total;
        const fmtRemain = unit === 'km'
            ? remaining.toFixed(1).replace('.', ',')
            : Math.round(remaining).toLocaleString('de-AT');
        progressText = `${fmtRemain} ${unit} bis ${next.toLocaleString('de-AT')} ${unit}`;
    }

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(sanitizePdfText(label), x, y);

    doc.setFontSize(7.3);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(sanitizePdfText(`${reachedCount} erreicht · ${progressText}`), x, y + 4.2);

    const barY = y + 6.5;
    const barH = 2.6;
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(x, barY, w, barH, 1.3, 1.3, 'F');

    const fillW = Math.max(2, (progress / 100) * w);
    doc.setFillColor(...colors.accent);
    doc.roundedRect(x, barY, fillW, barH, 1.3, 1.3, 'F');
}

function buildPdfExtraMetricsRows(stats) {
    return [
        ['Gipfel 2000–2499 m', String(stats.peaks2000)],
        ['Gipfel 2500–2999 m', String(stats.peaks2500)],
        ['Gipfel ab 3000 m', String(stats.peaks3000)],
        ['Ø Leistungsindex', Number.isFinite(stats.avgPerformanceIndex) ? `${Math.round(stats.avgPerformanceIndex)} / 100` : '–']
    ];
}

async function generateTourbookPdf(fromYear, toYear) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('PDF-Bibliothek konnte nicht geladen werden.', { type: 'error', duration: 3000 });
        return;
    }

    showToast('Tourenbuch wird erstellt…', { type: 'info', duration: 2500 });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const { width: pageW, height: pageH, margin } = PDF_EXPORT_PAGE;
    const contentW = pageW - margin * 2;
    const colors = getPdfThemeColors();

    const entries = getToursInYearRange(fromYear, toYear);

    // ---------- Seite 1: Dashboard-Stil, in Theme-Farben ----------
    const headerH = 32;
    const headerImg = createPdfGradientImage(colors.topHex, colors.bottomHex, 200, 4, 'horizontal');
    doc.addImage(headerImg, 'PNG', 0, 0, pageW, headerH, undefined, 'FAST');

    const headerTextColor = getPdfContrastTextColor(colors.top);

    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...headerTextColor);
    const titleText = fromYear === toYear ? `Tourenbuch ${fromYear}` : `Tourenbuch ${fromYear}–${toYear}`;
    doc.text(sanitizePdfText(titleText), margin, 16);

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(sanitizePdfText(`Erstellt am ${new Date().toLocaleDateString('de-AT')}`), margin, 23);

    if (!entries.length) {
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text('Keine Touren in diesem Zeitraum gefunden.', margin, headerH + 15);
        pdfExportSaveOrShare(doc, fromYear, toYear);
        return;
    }

    const overallStats = computeStatsSummary(entries);

    // ---- Stat-Kacheln (wie im Dashboard) ----
    const tiles = [
        { label: 'Touren', value: String(overallStats.totalTours) },
        { label: 'Schritte', value: overallStats.totalSteps > 0 ? Math.round(overallStats.totalSteps).toLocaleString('de-AT') : '–' },
        { label: 'Gipfel', value: String(overallStats.totalPeaks) },
        { label: 'Big Tours', value: String(overallStats.bigTours) },
        { label: 'Strecke', value: `${overallStats.totalDistance.toFixed(0)} km` },
        { label: 'Aufstieg', value: `${Math.round(overallStats.totalAscent)} hm` },
        { label: 'Gehzeit', value: `${overallStats.totalTimeText} h` },
        { label: 'Ø Geschwindigkeit', value: overallStats.avgSpeed > 0 ? `${formatDecimalAT(overallStats.avgSpeed)} km/h` : '–' },
        { label: 'Ø Steigung', value: overallStats.avgGradient > 0 ? `${Math.round(overallStats.avgGradient)} hm/km` : '–' },
        { label: 'Ø Anstieg/h', value: overallStats.avgAscentPerHour > 0 ? `${Math.round(overallStats.avgAscentPerHour)} hm/h` : '–' }
    ];

    const tileCols = 5;
    const tileGap = 4;
    const tileW = (contentW - tileGap * (tileCols - 1)) / tileCols;
    const tileH = 22;
    const tileStartY = headerH + 10;

    tiles.forEach((tile, i) => {
        const col = i % tileCols;
        const row = Math.floor(i / tileCols);
        const x = margin + col * (tileW + tileGap);
        const y = tileStartY + row * (tileH + tileGap);
        drawPdfStatTile(doc, x, y, tileW, tileH, tile.label, tile.value, colors);
    });

    const tileRows = Math.ceil(tiles.length / tileCols);
    let cursorY = tileStartY + tileRows * (tileH + tileGap) + 4;

    // ---- Weitere Kennzahlen ----
    doc.autoTable({
        startY: cursorY,
        head: [['Weitere Kennzahlen', '']],
        body: buildPdfExtraMetricsRows(overallStats),
        theme: 'grid',
        headStyles: { fillColor: colors.accent, textColor: getPdfContrastTextColor(colors.accent) },
        styles: { fontSize: 8.5, cellPadding: 2 },
        margin: { left: margin, right: margin }
    });

    cursorY = doc.lastAutoTable.finalY + 8;

    // ---- Meilensteine ----
    const milestones = computeMilestones(entries);
    const milestoneDefs = [
        { key: 'dist', label: 'Strecke', unit: 'km' },
        { key: 'asc', label: 'Aufstieg', unit: 'hm' },
        { key: 'time', label: 'Gehzeit', unit: 'h' },
        { key: 'peaks', label: 'Gipfel', unit: 'Gipfel' },
        { key: 'steps', label: 'Schritte', unit: 'Schritte' }
    ];

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...colors.accent);
    doc.text('Meilensteine', margin, cursorY);
    cursorY += 6;

    const msColW = (contentW - 8) / 2;
    milestoneDefs.forEach((def, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + col * (msColW + 8);
        const y = cursorY + row * 16;
        drawPdfMilestoneRow(doc, x, y, msColW, def.label, milestones[def.key], def.unit, colors);
    });

    const msRows = Math.ceil(milestoneDefs.length / 2);
    cursorY = cursorY + msRows * 16 + 6;

    // ---- Titelbild ----
    const photoEntry = getPdfRepresentativePhoto(entries);
    if (photoEntry) {
        const photoW = 100, photoH = 65;
        let photoY = cursorY;

        if (photoY + photoH + 10 > pageH - margin) {
            doc.addPage();
            photoY = margin;
        }

        try {
            const cropped = await cropImageToAspectDataUrl(photoEntry.imageData, 600, 390, 0.8);
            const photoX = (pageW - photoW) / 2;
            doc.addImage(cropped, 'JPEG', photoX, photoY, photoW, photoH, undefined, 'FAST');

            doc.setFontSize(8);
            doc.setFont(undefined, 'italic');
            doc.setTextColor(120, 120, 120);
            doc.text(
                sanitizePdfText(`${pdfExportFormatDate(photoEntry.date)} · ${photoEntry.tourname || ''}`),
                pageW / 2,
                photoY + photoH + 5,
                { align: 'center' }
            );
        } catch (err) {
            console.warn('Titelbild konnte nicht eingebettet werden:', err);
        }
    }

    // ---- Jahr-für-Jahr-Tabelle (nur bei Mehrjahres-Export) ----
    if (fromYear !== toYear) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Jahresübersicht', margin, margin + 5);

        doc.autoTable({
            startY: margin + 12,
            head: [['Jahr', 'Touren', 'Strecke', 'Höhenmeter', 'Gehzeit', 'Schritte', 'Gipfel']],
            body: buildPdfYearOverviewRows(fromYear, toYear),
            theme: 'grid',
            headStyles: { fillColor: colors.accent, textColor: getPdfContrastTextColor(colors.accent) },
            styles: { fontSize: 9, cellPadding: 2.5 },
            margin: { left: margin, right: margin }
        });
    }

    // ---------- Highlight-Rankings & Tourprofile NUR für den Exportzeitraum ----------
    const savedHighlightInfo = highlightTop3Info;
    const savedHighlightRevision = highlightTop3CacheRevision;
    const savedHighlightYearFilter = highlightTop3CacheYearFilter;

    rebuildHighlightTop3Info(entries);
    const profileAnalysis = buildTourProfileAnalysis(entries);

    // ---------- Folgeseiten: Tourenkarten ----------
    doc.addPage();

    const cardGap = 6;
    let cardCursorY = margin;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const hasPhoto = !!entry.imageData;
        const textWidth = hasPhoto ? contentW - 38 - 15 : contentW - 10;

        const blocks = buildPdfTourCardBlocks(doc, entry, textWidth, profileAnalysis);
        const cardHeight = measurePdfTourCardHeight(blocks, hasPhoto ? 48 : 0);

        if (cardCursorY + cardHeight > pageH - margin) {
            doc.addPage();
            cardCursorY = margin;
        }

        await drawPdfTourCard(doc, entry, margin, cardCursorY, contentW, blocks, cardHeight);
        cardCursorY += cardHeight + cardGap;
    }

    highlightTop3Info = savedHighlightInfo;
    highlightTop3CacheRevision = savedHighlightRevision;
    highlightTop3CacheYearFilter = savedHighlightYearFilter;

    pdfExportSaveOrShare(doc, fromYear, toYear);
}

    
// ================== PDF-Tourenbuch: UI-Steuerung ==================

let pdfExportRangeMode = 'single';

function populatePdfExportYearSelects() {
    const years = getPdfExportAvailableYears();
    const selects = [
        document.getElementById('pdf-export-year'),
        document.getElementById('pdf-export-year-from'),
        document.getElementById('pdf-export-year-to')
    ];

    selects.forEach(select => {
        if (!select) return;
        const current = select.value;
        select.innerHTML = '<option value="">Bitte wählen</option>' +
            years.map(y => `<option value="${y}">${y}</option>`).join('');
        if (years.includes(Number(current))) select.value = current;
        syncTourCompareMobileSelect(select);
    });
}

function setPdfExportRangeMode(mode) {
    pdfExportRangeMode = mode === 'range' ? 'range' : 'single';

    document.querySelectorAll('[data-pdf-range-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pdfRangeMode === pdfExportRangeMode);
    });

    document.getElementById('pdf-export-single-panel')?.classList.toggle('is-hidden', pdfExportRangeMode !== 'single');
    document.getElementById('pdf-export-range-panel')?.classList.toggle('is-hidden', pdfExportRangeMode !== 'range');
}

/* PDF-Bibliotheken erst bei der ersten Export-Aktion laden. */
function loadTourbookPdfScriptOnce(url) {
    if (!window.__tourbookPdfScriptPromises) {
        window.__tourbookPdfScriptPromises = Object.create(null);
    }
    const loads = window.__tourbookPdfScriptPromises;
    if (loads[url]) return loads[url];

    loads[url] = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => {
            script.remove();
            reject(new Error('Skript nicht geladen: ' + url));
        };
        document.head.appendChild(script);
    }).catch(error => {
        delete loads[url];
        throw error;
    });
    return loads[url];
}

function ensureTourbookPdfMagazineLoaded(runButton) {
    if (window.__tourbookPdfMagazineReady) return Promise.resolve();
    if (window.__tourbookPdfLoadPromise) return window.__tourbookPdfLoadPromise;

    window.__tourbookPdfLoadPromise = (async () => {
        await loadTourbookPdfScriptOnce('./libs/jspdf.umd.min.js');
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('jsPDF wurde geladen, ist aber nicht verfügbar.');
        }
        await loadTourbookPdfScriptOnce('./libs/jspdf.plugin.autotable.min.js');
        await loadTourbookPdfScriptOnce('./pdf-magazine.js');
        if (!runButton || runButton.dataset.magazineBound !== '1') {
            throw new Error('Der PDF-Magazin-Renderer wurde nicht initialisiert.');
        }
        window.__tourbookPdfMagazineReady = true;
    })().catch(error => {
        window.__tourbookPdfLoadPromise = null;
        throw error;
    });
    return window.__tourbookPdfLoadPromise;
}

function initPdfExportFeature() {
    populatePdfExportYearSelects();

    const runButton = document.getElementById('pdf-export-run-btn');
    if (runButton && runButton.dataset.lazyPdfLoaderBound !== '1') {
        runButton.dataset.lazyPdfLoaderBound = '1';
        let isLoadingPdf = false;
        runButton.addEventListener('click', async event => {
            if (window.__tourbookPdfMagazineReady) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (isLoadingPdf) return;

            isLoadingPdf = true;
            const originalHtml = runButton.innerHTML;
            const originalDisabled = runButton.disabled;
            runButton.disabled = true;
            runButton.textContent = 'PDF-Funktion wird geladen…';
            try {
                showToast('PDF-Funktion wird vorbereitet…', { type: 'info', duration: 1800 });
                await ensureTourbookPdfMagazineLoaded(runButton);
                runButton.disabled = originalDisabled;
                runButton.innerHTML = originalHtml;
                runButton.click();
            } catch (error) {
                console.error('[PDF] Bibliotheken konnten nicht geladen werden:', error);
                showToast('PDF-Funktion konnte nicht geladen werden. Bitte Internetverbindung prüfen.', {
                    type: 'error',
                    duration: 3500
                });
            } finally {
                runButton.disabled = originalDisabled;
                runButton.innerHTML = originalHtml;
                isLoadingPdf = false;
            }
        }, true);
    }

    document.querySelectorAll('[data-pdf-range-mode]').forEach(btn => {
        btn.addEventListener('click', () => setPdfExportRangeMode(btn.dataset.pdfRangeMode));
    });

    document.getElementById('pdf-export-run-btn')?.addEventListener('click', () => {
        let fromYear, toYear;

        if (pdfExportRangeMode === 'single') {
            const year = Number(document.getElementById('pdf-export-year')?.value);
            if (!year) {
                showToast('Bitte ein Jahr auswählen.', { type: 'error', duration: 2600 });
                return;
            }
            fromYear = toYear = year;
        } else {
            const from = Number(document.getElementById('pdf-export-year-from')?.value);
            const to = Number(document.getElementById('pdf-export-year-to')?.value);
            if (!from || !to) {
                showToast('Bitte Start- und Endjahr auswählen.', { type: 'error', duration: 2600 });
                return;
            }
            fromYear = Math.min(from, to);
            toYear = Math.max(from, to);
        }

        generateTourbookPdf(fromYear, toYear);
    });

    setPdfExportRangeMode('single');
}
