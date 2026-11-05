/* Premium Alpine — behutsame Strukturierung des Dashboardkachel-Modals Strecke.
   Bestehende Werte, Zeilen, Listener und Drilldowns werden unverändert übernommen. */
(function () {
    'use strict';

    function init() {
        const modal = document.getElementById('dash-stat-modal');
        const title = document.getElementById('ds-title');
        const body = document.getElementById('ds-body');
        if (!modal || !title || !body || modal.dataset.premiumDistanceModalInit === 'true') return;

        modal.dataset.premiumDistanceModalInit = 'true';

        function syncModalType() {
            const label = String(title.textContent || '').trim().toLocaleLowerCase('de');
            if (label.includes('strecke')) {
                modal.dataset.dashboardStatType = 'strecke';
            } else {
                delete modal.dataset.dashboardStatType;
            }
            enhanceDistanceOverview();
        }

        function enhanceDistanceOverview() {
            if (modal.dataset.dashboardStatType !== 'strecke') return;

            // Drilldown-Ansichten besitzen einen eigenen Zurück-Button und bleiben Listenansichten.
            if (body.querySelector('#ds-back')) return;

            // Bereits gruppiert: MutationObserver nicht erneut auf denselben Inhalt anwenden.
            if (body.querySelector(':scope > .dashboard-stat-overview')) return;

            const sourceList = Array.from(body.children).find(
                element => element.matches?.('.stats-list')
            );
            if (!sourceList) return;

            const totalRow = sourceList.querySelector(':scope > #ds-total-row');
            const averageRow = totalRow?.nextElementSibling;
            if (!totalRow || !averageRow?.matches('li.stats-sub')) return;

            const monthRows = Array.from(sourceList.children).filter(
                element => element !== totalRow && element !== averageRow
            );
            if (monthRows.some(row => !row.matches('li[data-month-idx]'))) return;

            const overview = document.createElement('section');
            overview.className = 'dashboard-stat-overview';
            overview.setAttribute('aria-label', 'Streckenübersicht');

            const overviewList = document.createElement('ul');
            overviewList.className = 'stats-list dashboard-stat-overview-list';
            overviewList.append(totalRow, averageRow);
            overview.append(overviewList);

            const sections = [overview];

            if (monthRows.length) {
                const months = document.createElement('section');
                months.className = 'dashboard-stat-months';

                const heading = document.createElement('div');
                heading.className = 'dashboard-stat-month-heading';
                heading.textContent = 'NACH MONAT';

                const monthList = document.createElement('ul');
                monthList.className = 'stats-list dashboard-stat-month-list';
                monthRows.forEach(row => monthList.appendChild(row));

                months.append(heading, monthList);
                sections.push(months);
            }

            body.replaceChildren(...sections);
        }

        const titleObserver = new MutationObserver(syncModalType);
        titleObserver.observe(title, {
            childList: true,
            characterData: true,
            subtree: true
        });

        const bodyObserver = new MutationObserver(enhanceDistanceOverview);
        bodyObserver.observe(body, { childList: true });

        syncModalType();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
