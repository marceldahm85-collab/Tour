/* Einzeltour-Modal: einklappbare Bereiche und gebündelte Medien.
   Beeinflusst ausschließlich gespeicherte Einzeltouren im Detailmodal. */
(function () {
    'use strict';

    function makeIcon(kind) {
        const paths = {
            profile: '<path d="M3 19 9.4 8l3.4 5 2.2-3.2L21 19H3Z"/><path d="m7.2 12 2.2 2 2-1"/>',
            performance: '<path d="M4 19h16"/><path d="m5 16 4-5 3 3 6-8"/><path d="M14 6h4v4"/>',
            media: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.5-4 3 2.5 2.5-2 4 3.5"/>'
        };
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            (paths[kind] || paths.profile) + '</svg>';
    }

    function isSavedTourDetail(modal) {
        if (!modal || modal.classList.contains('hidden')) return false;

        try {
            if (typeof currentDetailType !== 'undefined' &&
                currentDetailType &&
                currentDetailType !== 'saved') return false;
            if (typeof currentDetailEntry !== 'undefined' &&
                currentDetailEntry &&
                currentDetailEntry._isMultidaySummary) return false;
        } catch (_) {
            // Die DOM-Struktur bleibt der Fallback, falls App-Zustände gekapselt sind.
        }

        return true;
    }

    function createSection(body, key, title, iconKind, beforeNode) {
        const section = document.createElement('section');
        section.className = 'td-accordion-section is-collapsed';
        section.dataset.tdSection = key;

        const header = document.createElement('div');
        header.className = 'td-accordion-header stats-analysis-title';
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');
        header.setAttribute('aria-label', title + ' öffnen');

        const label = document.createElement('span');
        label.className = 'td-accordion-label stats-premium-title-label';

        const icon = document.createElement('span');
        icon.className = 'td-accordion-icon stats-premium-title-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = makeIcon(iconKind);

        const text = document.createElement('span');
        text.textContent = title;

        label.append(icon, text);
        header.appendChild(label);

        const content = document.createElement('div');
        content.className = 'td-accordion-content';
        content.id = 'td-' + key + '-content';

        header.setAttribute('aria-controls', content.id);
        section.append(header, content);

        if (beforeNode && beforeNode.parentElement === body) {
            body.insertBefore(section, beforeNode);
        } else {
            body.appendChild(section);
        }

        return section;
    }

    function findSection(body, key) {
        return Array.from(body.children).find(node =>
            node.matches('.td-accordion-section') &&
            node.dataset.tdSection === key
        ) || null;
    }

    function getContent(section) {
        return section && section.querySelector(':scope > .td-accordion-content');
    }

    function ensureSection(body, key, title, iconKind, item) {
        if (!item) return null;

        let section = findSection(body, key);
        if (!section) {
            section = createSection(body, key, title, iconKind, item);
        }

        const content = getContent(section);
        if (content && item.parentElement !== content) {
            content.appendChild(item);
        }
        return section;
    }

    function findPerformanceRow(body) {
        return Array.from(body.children).find(node => {
            if (!node.classList.contains('tour-stats-row')) return false;
            const label = node.querySelector('.tour-stat-label');
            return /leistungsindex/i.test(label ? label.textContent : '');
        }) || null;
    }

    function toggleSection(section) {
        if (!section) return;
        const collapsed = !section.classList.contains('is-collapsed');
        section.classList.toggle('is-collapsed', collapsed);

        const header = section.querySelector(':scope > .td-accordion-header');
        if (header) {
            const title = header.querySelector('.td-accordion-label > span:last-child')?.textContent || 'Bereich';
            header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            header.setAttribute('aria-label', title + (collapsed ? ' öffnen' : ' schließen'));
        }
    }

    function enhanceTourDetail(body, modal) {
        if (!isSavedTourDetail(modal)) return;
        if (!body.querySelector(':scope > .modal-detail-grid')) return;

        const profileCard = Array.from(body.children).find(node =>
            node.classList.contains('tour-profile-detail-card')
        ) || null;

        if (profileCard) {
            profileCard.querySelector('.tour-profile-detail-kicker')?.remove();
            ensureSection(body, 'profile', 'Tourprofil', 'profile', profileCard);
        }

        const performanceRow = findPerformanceRow(body);
        const performanceSection = ensureSection(
            body,
            'performance',
            'Leistungsindex',
            'performance',
            performanceRow
        );

        if (performanceRow && !performanceRow.dataset.tdLabelAdjusted) {
            const label = performanceRow.querySelector('.tour-stat-label');
            if (label) {
                const groupName = label.textContent
                    .replace(/^\s*Leistungsindex\s*[·•-]\s*/i, '')
                    .trim();
                if (groupName) label.textContent = groupName;
            }
            performanceRow.dataset.tdLabelAdjusted = 'true';
        }

        const image = Array.from(body.children).find(node =>
            node.classList.contains('tour-detail-image-wrap')
        ) || null;
        const gallery = Array.from(body.children).find(node =>
            node.id === 'td-gallery-panel'
        ) || null;

        let mediaSection = findSection(body, 'media');
        if (!mediaSection && (image || gallery)) {
            const profileSection = findSection(body, 'profile');
            const detailsGrid = Array.from(body.children).find(node =>
                node.classList.contains('modal-detail-grid')
            ) || null;
            const peaksSection = detailsGrid ? detailsGrid.nextElementSibling : null;
            const anchor = performanceSection || profileSection || peaksSection || detailsGrid;
            mediaSection = createSection(
                body,
                'media',
                'Bilder & Medien',
                'media',
                anchor ? anchor.nextElementSibling : null
            );
        }

        const mediaContent = getContent(mediaSection);
        if (mediaContent) {
            if (image && image.parentElement !== mediaContent) {
                mediaContent.appendChild(image);
            }
            if (gallery && gallery.parentElement !== mediaContent) {
                mediaContent.appendChild(gallery);
            }
        }
    }

    function init() {
        const modal = document.getElementById('tour-detail-modal');
        const body = document.getElementById('td-body');
        if (!modal || !body || body.dataset.tdAccordionsBound === 'true') return;

        body.dataset.tdAccordionsBound = 'true';

        body.addEventListener('click', event => {
            const header = event.target.closest('.td-accordion-header');
            if (!header || !body.contains(header)) return;
            toggleSection(header.parentElement);
        });

        body.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const header = event.target.closest('.td-accordion-header');
            if (!header || !body.contains(header)) return;
            event.preventDefault();
            toggleSection(header.parentElement);
        });

        let scheduled = false;
        const scheduleEnhancement = () => {
            if (scheduled) return;
            scheduled = true;
            window.requestAnimationFrame(() => {
                scheduled = false;
                enhanceTourDetail(body, modal);
            });
        };

        const bodyObserver = new MutationObserver(scheduleEnhancement);
        bodyObserver.observe(body, { childList: true });

        const modalObserver = new MutationObserver(scheduleEnhancement);
        modalObserver.observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });

        scheduleEnhancement();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();