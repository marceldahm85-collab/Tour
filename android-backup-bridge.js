/*
 * Native JSON-Backup-Export für die Android-WebView.
 * Chrome/PWA verwendet weiterhin den regulären Browser-Download.
 * Das JSON wird in kleinen, bestätigten Base64-Blöcken an Android übertragen,
 * damit große Sicherungen nicht als einzelne WebMessage gesendet werden müssen.
 */
(() => {
    'use strict';

    const nativeBridge = window.TourNative;
    if (!nativeBridge ||
        typeof nativeBridge.postMessage !== 'function' ||
        typeof nativeBridge.addEventListener !== 'function') {
        return;
    }

    const MAX_BACKUP_BYTES = 48 * 1024 * 1024;
    const CHUNK_BYTES = 36 * 1024; // Durch 3 teilbar; Base64-Blöcke bleiben unabhängig dekodierbar.
    const pendingRequests = new Map();
    let requestCounter = 0;

    function nextId(prefix) {
        requestCounter += 1;
        return prefix + '-' + Date.now() + '-' + requestCounter;
    }

    function handleNativeMessage(event) {
        let message;
        try {
            message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (error) {
            console.warn('[Android-Sicherung] Ungültige native Antwort.', error);
            return;
        }

        if (!message || typeof message !== 'object') return;
        const pending = pendingRequests.get(String(message.requestId || ''));
        if (!pending) return;

        pendingRequests.delete(String(message.requestId));
        window.clearTimeout(pending.timeout);

        if (message.ok === false || message.type === 'backup.export.error') {
            pending.reject(new Error(message.error || 'Die Android-Sicherung ist fehlgeschlagen.'));
        } else {
            pending.resolve(message);
        }
    }

    nativeBridge.addEventListener('message', handleNativeMessage);

    function nativeRequest(type, payload, timeoutMs) {
        const requestId = nextId('backup');
        const timeout = Number(timeoutMs) || 30000;

        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                pendingRequests.delete(requestId);
                reject(new Error('Die Android-Sicherung antwortet nicht mehr.'));
            }, timeout);

            pendingRequests.set(requestId, { resolve, reject, timeout: timer });
            try {
                nativeBridge.postMessage(JSON.stringify(Object.assign({
                    type,
                    requestId
                }, payload || {})));
            } catch (error) {
                window.clearTimeout(timer);
                pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }

    function encodeChunk(bytes, start, end) {
        const source = bytes.subarray(start, end);
        let binary = '';
        const conversionBlock = 0x6000;

        for (let offset = 0; offset < source.length; offset += conversionBlock) {
            const block = source.subarray(offset, Math.min(source.length, offset + conversionBlock));
            binary += String.fromCharCode(...block);
        }
        return window.btoa(binary);
    }

    async function saveTourBackupNative(json, suggestedFileName) {
        if (typeof json !== 'string' || !json) {
            throw new Error('Die Sicherung enthält keine Daten.');
        }

        const ping = await nativeRequest('bridge.ping', {}, 10000);
        const features = Array.isArray(ping.features) ? ping.features : [];
        if (!features.includes('backup.export.v1')) {
            return { handled: false };
        }

        const bytes = new TextEncoder().encode(json);
        if (!bytes.length || bytes.length > MAX_BACKUP_BYTES) {
            throw new RangeError('Die Sicherungsdatei ist für den Android-Export zu groß (maximal 48 MB).');
        }

        const fileName = String(suggestedFileName || 'Touren-Backup.json')
            .replace(/[^A-Za-z0-9._-]/g, '_')
            .slice(0, 80) || 'Touren-Backup.json';
        const transferId = nextId('backup-transfer');
        const totalChunks = Math.ceil(bytes.length / CHUNK_BYTES);
        let finishStarted = false;

        try {
            await nativeRequest('backup.export.start', {
                transferId,
                fileName,
                totalBytes: bytes.length,
                totalChunks
            }, 30000);

            for (let index = 0; index < totalChunks; index += 1) {
                const start = index * CHUNK_BYTES;
                const end = Math.min(bytes.length, start + CHUNK_BYTES);
                const data = encodeChunk(bytes, start, end);
                await nativeRequest('backup.export.chunk', {
                    transferId,
                    index,
                    data
                }, 45000);
            }

            finishStarted = true;
            const result = await nativeRequest('backup.export.finish', {
                transferId
            }, 5 * 60 * 1000);

            if (result.type === 'backup.export.cancelled') {
                return { handled: true, cancelled: true };
            }
            if (result.type !== 'backup.export.complete') {
                throw new Error('Android hat die Sicherung nicht bestätigt.');
            }

            return {
                handled: true,
                saved: true,
                fileName: result.fileName || fileName
            };
        } catch (error) {
            if (!finishStarted) {
                nativeRequest('backup.export.abort', { transferId }, 5000).catch(() => {});
            }
            throw error;
        }
    }

    window.saveTourBackupNative = saveTourBackupNative;
})();
