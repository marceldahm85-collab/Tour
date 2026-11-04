/*
 * Zentrale Oberflächendichte für alle App-Views.
 *
 * Die vorhandenen CSS-Regeln bleiben die Quelle der Standardmaße. Dieses
 * Modul liest deren tatsächlich berechnete Abstände aus und skaliert nur
 * Layout-Abstände und Bedienelement-Maße. Schriftgrößen, Breiten, Bilder,
 * Diagrammflächen und Leaflet-Karten bleiben unangetastet.
 */
(function () {
    'use strict';

    const SCALE_BY_DENSITY = {
        compact: 0.90,
        standard: 1,
        comfortable: 1.10
    };

    const SURFACE_PATTERN =
        /(?:^|[\\s_-])(box|card|tile|panel|section|sheet|modal|nav|list|item|row|form|field|filter|accordion|summary|header|content|group|wrap|option|btn|button|control|metric|stat|entry|toolbar|subnav|tab|view)(?:$|[\\s_-])/i;

    const MARGIN_PATTERN =
        /(?:^|[\\s_-])(section|list|item|form|field|header|heading|title|summary|group|wrap|content|accordion|nav)(?:$|[\\s_-])/i;

    const EXCLUDED_ANCESTORS = [
        '.leaflet-container',
        '.leaflet-pane',
        '.leaflet-control',
        '.chart-canvas-stage',
        '.chart-canvas-wrap',
        '[data-density-ignore="true"]'
    ].join(',');

    const EXCLUDED_TAGS = new Set([
        'img', 'svg', 'canvas', 'video', 'audio', 'picture',
        'source', 'iframe', 'path', 'g', 'circle', 'rect',
        'line', 'polyline', 'polygon', 'text', 'use'
    ]);

    const CONTROL_INPUT_TYPES = new Set([
        'checkbox', 'radio', 'range', 'color', 'file', 'hidden', 'image', 'submit', 'reset'
    ]);

    const records = new WeakMap();
    const managedElements = new Set();
    let refreshFrame = 0;

    function elementSignature(element) {
        const className = typeof element.className === 'string'
            ? element.className
            : (element.getAttribute('class') || '');
        return (element.id || '') + ' ' + className;
    }

    function isExcluded(element) {
        if (!element || element.nodeType !== 1) return true;
        const tag = String(element.tagName || '').toLowerCase();
        if (EXCLUDED_TAGS.has(tag)) return true;
        if (element.closest && element.closest(EXCLUDED_ANCESTORS)) return true;
        if (element.closest && element.closest('#tour-map')) return true;
        return false;
    }

    function isControl(element, tag) {
        if (tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'summary') {
            return true;
        }

        if (tag === 'input') {
            const type = String(element.type || 'text').toLowerCase();
            return !CONTROL_INPUT_TYPES.has(type);
        }

        return false;
    }

    function isListRow(element, tag, signature) {
        if (tag !== 'li') return false;
        if (SURFACE_PATTERN.test(signature)) return true;
        const parent = element.parentElement;
        if (!parent) return false;
        return /(?:^|[\\s_-])(list|tour-list|stats-list|peak-tour-list)(?:$|[\\s_-])/i
            .test(elementSignature(parent));
    }

    function isPixelValue(value) {
        return typeof value === 'string' && /^-?(?:\\d+\\.?\\d*|\\.\\d+)px$/i.test(value.trim());
    }

    function positivePixel(value, min, max) {
        if (!isPixelValue(value)) return null;
        const number = Number.parseFloat(value);
        if (!Number.isFinite(number) || number < min || number > max) return null;
        return number;
    }

    function getDensityScale() {
        const density = document.body?.dataset?.appDensity || 'standard';
        return SCALE_BY_DENSITY[density] || 1;
    }

    function updateScaleVariable() {
        if (!document.documentElement) return;
        document.documentElement.style.setProperty(
            '--app-density-scale',
            String(getDensityScale()),
            'important'
        );
    }

    function restoreOriginalInlineStyles(element, record) {
        if (!record) return;

        record.activeProperties.forEach(property => {
            const original = record.originalInline.get(property);
            if (original && original.value) {
                element.style.setProperty(property, original.value, original.priority);
            } else {
                element.style.removeProperty(property);
            }
        });
        record.activeProperties.clear();
    }

    function rememberOriginalInlineStyle(element, record, property) {
        if (record.originalInline.has(property)) return;
        record.originalInline.set(property, {
            value: element.style.getPropertyValue(property),
            priority: element.style.getPropertyPriority(property)
        });
    }

    function candidateProperties(element, computed, signature, control, surface, listRow) {
        const tag = String(element.tagName || '').toLowerCase();
        const display = computed.display;
        const isLayout = display === 'flex' || display === 'inline-flex' ||
            display === 'grid' || display === 'inline-grid';
        const properties = new Map();

        const add = (property, value, min, max) => {
            const number = positivePixel(value, min, max);
            if (number === null || number === 0) return;
            properties.set(property, number);
        };

        // Innenabstände aller Karten, Panels, Abschnitte, Listenzeilen,
        // Navigationsflächen sowie Eingabe- und Bedienelemente.
        if (surface || control || listRow) {
            add('padding-top', computed.paddingTop, 0.1, 100);
            add('padding-right', computed.paddingRight, 0.1, 100);
            add('padding-bottom', computed.paddingBottom, 0.1, 100);
            add('padding-left', computed.paddingLeft, 0.1, 100);
        }

        // Flex-/Grid-Abstände sind die zentrale Quelle für Zwischenräume
        // zwischen Kennzahlen, Formularfeldern, Listen und Navigationen.
        if (isLayout) {
            add('row-gap', computed.rowGap, 0.1, 80);
            add('column-gap', computed.columnGap, 0.1, 80);
        }

        // Vertikale Außenabstände nur für strukturelle Elemente skalieren.
        if (MARGIN_PATTERN.test(signature)) {
            add('margin-top', computed.marginTop, 0.1, 80);
            add('margin-bottom', computed.marginBottom, 0.1, 80);
        }

        // Nur tatsächliche Bedienelemente und Listeneinträge erhalten
        // proportionale Höhen. Keine Bild-, Icon-, Karten- oder Chart-Höhen.
        if (control) {
            add('min-height', computed.minHeight, 24, 90);
            add('height', computed.height, 26, 90);
        } else if (listRow) {
            add('min-height', computed.minHeight, 28, 110);
        } else if (surface && /(?:^|[\\s_-])(tab|nav-item|list-item)(?:$|[\\s_-])/i.test(signature)) {
            add('min-height', computed.minHeight, 28, 90);
        }

        return properties;
    }

    function processElement(element, forceRefresh) {
        if (!element || element.nodeType !== 1) return;

        const previous = records.get(element);
        if (previous && !forceRefresh) return;

        if (previous) restoreOriginalInlineStyles(element, previous);

        if (isExcluded(element)) {
            if (previous) {
                records.delete(element);
                managedElements.delete(element);
            }
            return;
        }

        const tag = String(element.tagName || '').toLowerCase();
        const signature = elementSignature(element);
        const surface = SURFACE_PATTERN.test(signature) ||
            ['main', 'section', 'article', 'nav', 'aside', 'details'].includes(tag);
        const control = isControl(element, tag);
        const listRow = isListRow(element, tag, signature);

        if (!surface && !control && !listRow) {
            if (previous) {
                records.delete(element);
                managedElements.delete(element);
            }
            return;
        }

        const computed = window.getComputedStyle(element);
        const candidates = candidateProperties(
            element, computed, signature, control, surface, listRow
        );

        const record = previous || {
            originalInline: new Map(),
            activeProperties: new Set()
        };

        candidates.forEach((baseValue, property) => {
            rememberOriginalInlineStyle(element, record, property);
            const stableValue = Number(baseValue.toFixed(3));
            element.style.setProperty(
                property,
                'calc(' + stableValue + 'px * var(--app-density-scale, 1))',
                'important'
            );
            record.activeProperties.add(property);
        });

        records.set(element, record);
        if (record.activeProperties.size) managedElements.add(element);
        else managedElements.delete(element);
    }

    function processTree(root, forceRefresh) {
        if (!root || root.nodeType !== 1) return;
        processElement(root, forceRefresh);
        const descendants = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (let index = 0; index < descendants.length; index++) {
            processElement(descendants[index], forceRefresh);
        }
    }

    function forgetTree(root) {
        if (!root || root.nodeType !== 1) return;
        const forget = element => {
            const record = records.get(element);
            if (record) restoreOriginalInlineStyles(element, record);
            records.delete(element);
            managedElements.delete(element);
        };

        forget(root);
        const descendants = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (let index = 0; index < descendants.length; index++) forget(descendants[index]);
    }

    function refreshAll() {
        updateScaleVariable();
        managedElements.forEach(element => {
            if (!element.isConnected) {
                managedElements.delete(element);
                records.delete(element);
                return;
            }
            processElement(element, true);
        });
        processTree(document.body, false);
    }

    function scheduleRefresh() {
        if (refreshFrame) cancelAnimationFrame(refreshFrame);
        refreshFrame = requestAnimationFrame(() => {
            refreshFrame = 0;
            refreshAll();
        });
    }

    function start() {
        if (!document.body || document.body.dataset.surfaceDensityReady === 'true') return;
        document.body.dataset.surfaceDensityReady = 'true';
        updateScaleVariable();

        // Initiale Oberflächen und bereits vorhandene Views erfassen.
        requestAnimationFrame(() => {
            processTree(document.body, false);
            requestAnimationFrame(() => processTree(document.body, false));
        });

        const observer = new MutationObserver(mutations => {
            let densityChanged = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'data-app-density') {
                        densityChanged = true;
                    } else if (mutation.attributeName === 'class') {
                        processTree(mutation.target, true);
                    }
                    return;
                }

                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) processTree(node, false);
                });
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === 1) forgetTree(node);
                });
            });

            if (densityChanged) updateScaleVariable();
        });

        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'data-app-density']
        });

        window.addEventListener('resize', scheduleRefresh, { passive: true });
        window.addEventListener('orientationchange', scheduleRefresh, { passive: true });
        window.addEventListener('pageshow', scheduleRefresh, { passive: true });

        window.refreshAppSurfaceDensity = scheduleRefresh;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
