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

    function decodeStreamChunks(chunks, expectedBytes) {
        if (!Number.isInteger(expectedBytes) || expectedBytes < 0 ||
            expectedBytes > MAX_BACKUP_BYTES) {
            throw new RangeError('Die ausgewählte Sicherungsdatei hat eine ungültige Größe.');
        }

        const output = new Uint8Array(expectedBytes);
        let offset = 0;
        chunks.forEach(encoded => {
            const binary = window.atob(encoded);
            if (offset + binary.length > output.length) {
                throw new Error('Die Sicherungsdatei wurde unvollständig übertragen.');
            }
            for (let index = 0; index < binary.length; index += 1) {
                output[offset++] = binary.charCodeAt(index);
            }
        });
        if (offset !== expectedBytes) {
            throw new Error('Die Sicherungsdatei wurde unvollständig übertragen.');
        }
        return new TextDecoder('utf-8').decode(output);
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
        const requestId = String(message.requestId || '');
        const pending = pendingRequests.get(requestId);
        if (!pending) return;

        if (message.ok === false || message.type === 'backup.export.error' ||
            message.type === 'backup.file.read.error') {
            pendingRequests.delete(requestId);
            window.clearTimeout(pending.timeout);
            pending.reject(new Error(message.error || 'Der Android-Dateizugriff ist fehlgeschlagen.'));
            return;
        }

        if (pending.stream) {
            if (message.type === pending.stream.startType) {
                pending.metadata = message;
                pending.chunks = [];
                return;
            }
            if (message.type === pending.stream.chunkType) {
                if (!Array.isArray(pending.chunks) ||
                    typeof message.data !== 'string' ||
                    message.data.length > 48 * 1024) {
                    pendingRequests.delete(requestId);
                    window.clearTimeout(pending.timeout);
                    pending.reject(new Error('Ein Teil der Sicherungsdatei ist ungültig.'));
                    return;
                }
                pending.chunks.push(message.data);
                return;
            }
            if (message.type === pending.stream.completeType) {
                pendingRequests.delete(requestId);
                window.clearTimeout(pending.timeout);
                if (message.cancelled) {
                    pending.resolve(message);
                    return;
                }
                try {
                    const metadata = pending.metadata || {};
                    const content = decodeStreamChunks(
                        pending.chunks || [],
                        Number(metadata.totalBytes)
                    );
                    pending.resolve(Object.assign({}, metadata, message, { content }));
                } catch (error) {
                    pending.reject(error);
                }
                return;
            }
        }

        pendingRequests.delete(requestId);
        window.clearTimeout(pending.timeout);
        pending.resolve(message);
    }

    nativeBridge.addEventListener('message', handleNativeMessage);

    function nativeRequest(type, payload, timeoutMs, stream) {
        const requestId = nextId('backup');
        const timeout = Number(timeoutMs) || 30000;

        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                pendingRequests.delete(requestId);
                reject(new Error('Die Android-Sicherung antwortet nicht mehr.'));
            }, timeout);

            pendingRequests.set(requestId, { resolve, reject, timeout: timer, stream: stream || null, chunks: stream ? [] : null, metadata: null });
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

    async function saveTourBackupNative(json, suggestedFileName, options) {
        if (typeof json !== 'string' || !json) {
            throw new Error('Die Sicherung enthält keine Daten.');
        }

        const ping = await nativeRequest('bridge.ping', {}, 10000);
        const features = Array.isArray(ping.features) ? ping.features : [];
        if (!features.includes('backup.export.v1')) {
            return { handled: false };
        }

        const saveOptions = options && typeof options === 'object' ? options : {};
        const targetUri = typeof saveOptions.targetUri === 'string' ? saveOptions.targetUri : '';
        const linkOnSave = saveOptions.linkOnSave === true;
        if ((targetUri || linkOnSave) && !features.includes('backup.file.link.v1')) {
            return { handled: false };
        }

        const bytes = new TextEncoder().encode(json);
        if (!bytes.length || bytes.length > MAX_BACKUP_BYTES) {
            throw new RangeError('Die Sicherungsdatei ist für den Android-Export zu groß (maximal 48 MB).');
        }

        const fileName = String(suggestedFileName || 'Touren-Backup.json')
            .replace(/[^A-Za-z0-9._-]/g, '_')
            .slice(0, 80) || 'Touren-Backup.json';
        if (targetUri && !targetUri.startsWith('content://')) {
            throw new Error('Die verknüpfte Sicherungsdatei ist ungültig.');
        }

        const transferId = nextId('backup-transfer');
        const totalChunks = Math.ceil(bytes.length / CHUNK_BYTES);
        let finishStarted = false;

        try {
            await nativeRequest('backup.export.start', {
                transferId,
                fileName,
                totalBytes: bytes.length,
                totalChunks,
                targetUri,
                linkOnSave
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
                fileName: result.fileName || fileName,
                uri: result.uri || targetUri || null
            };
        } catch (error) {
            if (!finishStarted) {
                nativeRequest('backup.export.abort', { transferId }, 5000).catch(() => {});
            }
            throw error;
        }
    }


    async function saveTourPdfNative(blob, suggestedFileName) {
        if (!blob || typeof blob.arrayBuffer !== 'function') {
            throw new TypeError('Der PDF-Export hat keine gültige Datei erzeugt.');
        }

        const ping = await nativeRequest('bridge.ping', {}, 10000);
        const features = Array.isArray(ping.features) ? ping.features : [];
        if (!features.includes('pdf.export.v1') || !features.includes('backup.export.v1')) {
            return { handled: false };
        }

        if (!Number.isFinite(Number(blob.size)) || blob.size <= 0 || blob.size > MAX_BACKUP_BYTES) {
            throw new RangeError('Die PDF-Datei ist leer oder größer als 48 MB.');
        }

        let arrayBuffer;
        if (typeof blob.arrayBuffer === 'function') {
            arrayBuffer = await blob.arrayBuffer();
        } else {
            arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('Die PDF-Datei konnte nicht gelesen werden.'));
                reader.onabort = () => reject(new Error('Das Lesen der PDF-Datei wurde abgebrochen.'));
                reader.readAsArrayBuffer(blob);
            });
        }
        const bytes = new Uint8Array(arrayBuffer);
        if (bytes.length !== Number(blob.size) || !bytes.length) {
            throw new Error('Die PDF-Datei konnte nicht vollständig vorbereitet werden.');
        }

        const fileName = String(suggestedFileName || 'Tourenbuch.pdf')
            .replace(/[^A-Za-z0-9._-]/g, '_')
            .slice(0, 80) || 'Tourenbuch.pdf';
        const pdfName = fileName.toLowerCase().endsWith('.pdf') ? fileName : fileName + '.pdf';
        const transferId = nextId('pdf-transfer');
        const totalChunks = Math.ceil(bytes.length / CHUNK_BYTES);
        let finishStarted = false;

        try {
            await nativeRequest('backup.export.start', {
                transferId,
                fileName: pdfName,
                mimeType: 'application/pdf',
                totalBytes: bytes.length,
                totalChunks,
                targetUri: '',
                linkOnSave: false
            }, 30000);

            for (let index = 0; index < totalChunks; index += 1) {
                const start = index * CHUNK_BYTES;
                const end = Math.min(bytes.length, start + CHUNK_BYTES);
                const data = encodeChunk(bytes, start, end);
                await nativeRequest('backup.export.chunk', { transferId, index, data }, 45000);
            }

            finishStarted = true;
            const result = await nativeRequest('backup.export.finish', { transferId }, 5 * 60 * 1000);
            if (result.type === 'backup.export.cancelled') {
                return { handled: true, cancelled: true };
            }
            if (result.type !== 'backup.export.complete') {
                throw new Error('Android hat das Speichern des Tourbuch-PDFs nicht bestätigt.');
            }
            return { handled: true, saved: true, fileName: result.fileName || pdfName };
        } catch (error) {
            if (!finishStarted) {
                nativeRequest('backup.export.abort', { transferId }, 5000).catch(() => {});
            }
            throw error;
        }
    }


    async function openTourBackupNative() {
        const ping = await nativeRequest('bridge.ping', {}, 10000);
        const features = Array.isArray(ping.features) ? ping.features : [];
        if (!features.includes('backup.file.link.v1')) return { handled: false };

        const result = await nativeRequest('backup.file.open', {}, 5 * 60 * 1000, {
            startType: 'backup.file.read.start',
            chunkType: 'backup.file.read.chunk',
            completeType: 'backup.file.read.complete'
        });
        if (result.cancelled) return { handled: true, cancelled: true };
        return {
            handled: true,
            opened: true,
            uri: result.uri,
            fileName: result.fileName || 'Touren-Backup.json',
            content: result.content
        };
    }

    async function readTourBackupNative(uri) {
        if (typeof uri !== 'string' || !uri.startsWith('content://')) {
            throw new Error('Die verknüpfte Sicherungsdatei ist ungültig.');
        }
        const ping = await nativeRequest('bridge.ping', {}, 10000);
        const features = Array.isArray(ping.features) ? ping.features : [];
        if (!features.includes('backup.file.link.v1')) return { handled: false };

        const result = await nativeRequest('backup.file.read', { uri }, 5 * 60 * 1000, {
            startType: 'backup.file.read.start',
            chunkType: 'backup.file.read.chunk',
            completeType: 'backup.file.read.complete'
        });
        return {
            handled: true,
            uri: result.uri || uri,
            fileName: result.fileName || 'Touren-Backup.json',
            content: result.content
        };
    }

    window.saveTourBackupNative = saveTourBackupNative;
    window.saveTourPdfNative = saveTourPdfNative;
    window.openTourBackupNative = openTourBackupNative;
    window.readTourBackupNative = readTourBackupNative;
})();
