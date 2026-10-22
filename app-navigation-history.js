/* =========================================================
   Native Android/Browser Back Navigation
   - The Back button closes the topmost open dialog first.
   - Internal view changes are kept in browser history.
   - Existing modal close handlers are reused wherever possible.
   ========================================================= */
(() => {
    'use strict';

    if (window.__bergTourenBackNavigationInitialized) return;
    window.__bergTourenBackNavigationInitialized = true;

    const HISTORY_FLAG = '__bergTourenTrackerHistory';
    let historyReady = false;
    let restoringFromBack = false;
    let historyBackPending = false;
    let sequence = 0;

    function isAppState(state) {
        return Boolean(state && state[HISTORY_FLAG] === true);
    }

    function currentViewName() {
        return typeof currentView === 'string' ? currentView : 'dashboard';
    }

    function isKnownView(view) {
        return typeof view === 'string' &&
            typeof viewOrder !== 'undefined' &&
            Array.isArray(viewOrder) &&
            viewOrder.includes(view);
    }

    function getVisibleModals() {
        const candidates = Array.from(document.querySelectorAll(
            '.modal:not(.hidden), .image-lightbox:not(.hidden), ' +
            '[role="dialog"][aria-modal="true"]:not(.hidden)'
        ));

        return candidates
            .filter((element) => {
                if (element.hidden || element.classList.contains('hidden')) return false;
                const style = window.getComputedStyle(element);
                return style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    element.getClientRects().length > 0;
            })
            .map((element) => {
                if (!element.id) {
                    element.id = 'berg-touren-dialog-' + (++sequence);
                }
                return element;
            })
            .sort((a, b) => {
                const zA = Number.parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
                const zB = Number.parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
                if (zA !== zB) return zA - zB;
                const relation = a.compareDocumentPosition(b);
                if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });
    }

    function topmostModal() {
        const modals = getVisibleModals();
        return modals.length ? modals[modals.length - 1] : null;
    }

    function pushAppHistoryEntry(kind, view, modalId = null) {
        if (!historyReady || restoringFromBack) return;

        try {
            const oldState = history.state && typeof history.state === 'object'
                ? history.state
                : {};
            sequence = Math.max(sequence, Number(oldState.bergTourenHistorySequence) || 0) + 1;

            history.pushState({
                ...oldState,
                [HISTORY_FLAG]: true,
                appView: view,
                modalId: modalId || null,
                previousModalId: isAppState(oldState) ? (oldState.modalId || null) : null,
                previousAppView: isAppState(oldState) ? (oldState.appView || currentViewName()) : currentViewName(),
                appNavigationKind: kind,
                bergTourenHistorySequence: sequence
            }, '', location.href);
        } catch (error) {
            // Ein nicht verfügbarer History-Eintrag darf die App-Navigation
            // nicht blockieren. Der sichtbare Schließen-Button bleibt nutzbar.
            console.warn('Zurück-Navigation konnte keinen Verlaufseintrag anlegen.', error);
        }
    }

    function requestHistoryBack() {
        if (historyBackPending) return;
        const state = history.state;
        if (!isAppState(state) || !state.modalId) return;

        historyBackPending = true;
        try {
            history.back();
        } catch (error) {
            historyBackPending = false;
            console.warn('Modal-Verlauf konnte nicht zurückgesetzt werden.', error);
        }
    }

    function closeTopmostModal(modal) {
        if (!modal) return;

        // Die Tourdetail-Ansicht besitzt einen eigenen Zurück-Button. Wenn
        // sie aus einer Liste/einem anderen Modal geöffnet wurde, soll Android-
        // Zurück genau diesen Rückweg nutzen und nicht den ganzen Dialog schließen.
        if (modal.id === 'tour-detail-modal') {
            const detailBackButton = document.getElementById('td-back');
            if (detailBackButton && !detailBackButton.hidden) {
                detailBackButton.click();
                return;
            }
        }

        // Wenn vorhanden, immer den vorgesehenen Schließen-Button verwenden:
        // so bleiben Aufräumarbeiten der jeweiligen Modal-Funktion erhalten.
        const closeButton = modal.querySelector(
            'button[id$="-close"], ' +
            'button[aria-label="Schließen"], ' +
            'button[aria-label="Modal schließen"], ' +
            'button[aria-label="Bild schließen"], ' +
            'button[aria-label="Close"]'
        );

        if (closeButton && !closeButton.disabled) {
            closeButton.click();
            return;
        }

        // Fallback für vorhandene Dialoge ohne erkennbaren Close-Button.
        const closersById = {
            'tour-detail-modal': () => {
                if (typeof closeTourDetail === 'function') closeTourDetail();
            },
            'image-lightbox': () => {
                if (typeof closeImageLightbox === 'function') closeImageLightbox();
            },
            'achievement-category-modal': () => {
                if (typeof closeAchievementCategoryModal === 'function') closeAchievementCategoryModal();
            },
            'compare-modal': () => {
                if (typeof closeCompareModal === 'function') closeCompareModal();
            },
            'month-stats-modal': () => {
                if (typeof closeMonthStatsModal === 'function') closeMonthStatsModal();
            },
            'stats-chart-modal': () => {
                if (typeof closeStatsChartModal === 'function') closeStatsChartModal();
            },
            'tour-list-modal': () => {
                if (typeof closeTourListModal === 'function') closeTourListModal();
            },
            'milestone-modal': () => {
                if (typeof closeMilestoneModal === 'function') closeMilestoneModal();
            },
            'dash-stat-modal': () => {
                if (typeof closeDashStatModal === 'function') closeDashStatModal();
            }
        };

        const closer = closersById[modal.id];
        if (closer) {
            closer();
            return;
        }

        const backdrop = modal.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.click();
            return;
        }

        // Letzter generischer Fallback für zusätzliche Dialoge, die später
        // ergänzt werden. Bei bekannten Modalen wird dieser Weg nicht benutzt.
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        if (!getVisibleModals().some((openModal) => openModal !== modal)) {
            document.body.classList.remove('modal-open');
        }
    }

    function hasModalOpening(records) {
        return records.some((record) => {
            if (record.type === 'attributes') {
                const oldClasses = String(record.oldValue || '').split(/\s+/);
                return oldClasses.includes('hidden') &&
                    !record.target.classList.contains('hidden');
            }
            if (record.type === 'childList') {
                return Array.from(record.addedNodes).some((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;
                    return node.matches?.(
                        '.modal:not(.hidden), .image-lightbox:not(.hidden), ' +
                        '[role="dialog"][aria-modal="true"]:not(.hidden)'
                    ) || Boolean(node.querySelector?.(
                        '.modal:not(.hidden), .image-lightbox:not(.hidden), ' +
                        '[role="dialog"][aria-modal="true"]:not(.hidden)'
                    ));
                });
            }
            return false;
        });
    }

    function processModalMutations(records) {
        const relevant = records.some((record) => {
            if (record.type === 'attributes') {
                return record.target.matches?.(
                    '.modal, .image-lightbox, [role="dialog"][aria-modal="true"]'
                );
            }
            return record.type === 'childList' &&
                Array.from(record.addedNodes).some((node) =>
                    node.nodeType === Node.ELEMENT_NODE &&
                    (node.matches?.(
                        '.modal, .image-lightbox, [role="dialog"][aria-modal="true"]'
                    ) || node.querySelector?.(
                        '.modal, .image-lightbox, [role="dialog"][aria-modal="true"]'
                    ))
                );
        });
        if (!relevant || !historyReady || restoringFromBack) return;

        const visible = getVisibleModals();

        // openTourDetail lädt ein ausgelagertes Bild asynchron. In dieser
        // Übergangsphase kann das Quellmodal schon geschlossen sein, bevor
        // das Tourdetail sichtbar wird. Das ist kein echter Modal-Schließvorgang.
        if (!visible.length && (Number(window.__tourDetailOpeningCount) || 0) > 0) {
            return;
        }

        const top = visible.length ? visible[visible.length - 1] : null;
        const state = history.state;
        const opened = hasModalOpening(records);

        if (top) {
            if (isAppState(state) && state.modalId === top.id) return;

            const currentModalIsVisible = isAppState(state) && state.modalId &&
                visible.some((modal) => modal.id === state.modalId);

            if (isAppState(state) && state.modalId && !currentModalIsVisible) {
                // Wenn das zuvor geöffnete Modal gerade in ein anderes wechselt,
                // prüfen, ob das neue sichtbare Modal bereits der vorherige
                // Verlaufsschritt war. Dann zurückspringen statt einen doppelten
                // Verlaufseintrag anzulegen (z. B. Tourdetail -> Tourliste).
                if (opened && (state.previousModalId !== top.id || top.id === 'tour-detail-modal')) {
                    pushAppHistoryEntry('modal', currentViewName(), top.id);
                } else {
                    requestHistoryBack();
                }
                return;
            }

            // Neues Modal oder eine zusätzliche Dialogebene über einem weiterhin
            // sichtbaren Modal: eigenen Verlaufseintrag anlegen.
            pushAppHistoryEntry('modal', currentViewName(), top.id);
            return;
        }

        // Manuelles Schließen über ✕, Zurück-Wischgeste oder Hintergrund:
        // den dazugehörigen History-Eintrag automatisch entfernen.
        if (isAppState(state) && state.modalId) requestHistoryBack();
    }

    function initializeHistory() {
        if (!window.history || typeof window.history.pushState !== 'function') return;

        const oldState = history.state && typeof history.state === 'object'
            ? history.state
            : {};
        history.replaceState({
            ...oldState,
            [HISTORY_FLAG]: true,
            appView: currentViewName(),
            modalId: null,
            appNavigationKind: 'view',
            bergTourenHistorySequence: Number(oldState.bergTourenHistorySequence) || 0
        }, '', location.href);

        historyReady = true;

        // Der bestehende Startbildschirm-Kurzbefehl ruft nach dem View-Wechsel
        // replaceState({}, ...) auf, um ?action=... zu entfernen. Ein leerer
        // State darf dabei unseren App-Verlauf nicht wieder löschen.
        const originalHistoryReplaceState = history.replaceState.bind(history);
        history.replaceState = function (state, title, url) {
            const isEmptyState = state && typeof state === 'object' &&
                Object.keys(state).length === 0;
            let nextState = state;

            if (historyReady && isEmptyState && isAppState(history.state)) {
                nextState = {
                    ...history.state,
                    appView: currentViewName(),
                    modalId: topmostModal()?.id || null
                };
            }

            return originalHistoryReplaceState(nextState, title, url);
        };

        const observer = new MutationObserver(processModalMutations);
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ['class']
        });

        window.addEventListener('popstate', (event) => {
            // Unterscheiden, ob wir selbst nach einem manuellen Modal-Schließen
            // zurückspringen oder ob Android/der Browser zurück navigiert.
            // Nur beim echten Zurück-Schritt muss ein vorheriges, inzwischen
            // ausgeblendetes Modal wiederhergestellt werden.
            const wasHistoryBackPending = historyBackPending;
            historyBackPending = false;

            const state = event.state;
            const isKnownState = isAppState(state);
            const expectedModalId = isKnownState ? (state.modalId || null) : null;
            const activeModal = topmostModal();

            // Bei Android-Zurück zuerst nur den obersten Dialog schließen.
            // Wenn ein übergeordnetes Modal offen ist, bleibt es erhalten.
            if (activeModal && (!isKnownState || activeModal.id !== expectedModalId)) {
                closeTopmostModal(activeModal);
            }

            // Zwischenmodale werden oft ausgeblendet, statt im DOM entfernt zu
            // werden. Beim System-Zurück muss deshalb das Modal des vorherigen
            // Verlaufseintrags wieder sichtbar werden (auch bei mehreren Ebenen).
            // Ein von der App selbst ausgelöstes history.back() nach bewusstem
            // Schließen soll dagegen kein übergeordnetes Modal erneut öffnen.
            if (isKnownState && expectedModalId && !wasHistoryBackPending) {
                const expectedModal = document.getElementById(expectedModalId);
                if (expectedModal) {
                    expectedModal.hidden = false;
                    expectedModal.classList.remove('hidden');
                    if (expectedModal.hasAttribute('aria-hidden')) {
                        expectedModal.setAttribute('aria-hidden', 'false');
                    }
                    document.body.classList.add('modal-open');
                }
            }

            // Ohne offenes Modal führt Zurück zur zuvor besuchten App-Ansicht.
            if (isKnownState && isKnownView(state.appView) &&
                currentViewName() !== state.appView) {
                restoringFromBack = true;
                try {
                    goToView(state.appView, false);
                } finally {
                    restoringFromBack = false;
                }
            }
        });

        // Die vorhandene Navigation bleibt unverändert; ihre View-Wechsel
        // ergänzen lediglich Einträge im Browser-Verlauf.
        if (typeof goToView === 'function' && !window.__bergTourenOriginalGoToView) {
            const originalGoToView = goToView;
            window.__bergTourenOriginalGoToView = originalGoToView;

            goToView = function (...args) {
                const before = currentViewName();

                // PWA-Icon-Kurzbefehle tragen ?action=... beim Start in der URL.
                // Den Parameter vor dem ersten internen View-Eintrag entfernen,
                // damit Zurück nicht versehentlich denselben Kurzbefehl neu startet.
                if (!restoringFromBack && new URLSearchParams(location.search).has('action')) {
                    const state = history.state && typeof history.state === 'object'
                        ? history.state
                        : {};
                    originalHistoryReplaceState({
                        ...state,
                        [HISTORY_FLAG]: true,
                        appView: before,
                        modalId: null,
                        appNavigationKind: 'view'
                    }, '', location.pathname + location.hash);
                }

                const result = originalGoToView.apply(this, args);
                const after = currentViewName();

                if (before !== after && historyReady && !restoringFromBack) {
                    const modal = topmostModal();
                    pushAppHistoryEntry('view', after, modal?.id || null);
                }
                return result;
            };
        }

    }

    initializeHistory();
})();
