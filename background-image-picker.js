/* Preset-Auswahl für den App-Hintergrund – Schritt 2.
   Die Darstellung und Auswahl bleiben vom allgemeinen Theme-Editor getrennt. */
(function () {
    'use strict';

    const grid = document.getElementById('background-image-presets');
    const status = document.getElementById('background-image-selected-label');
    const credits = document.getElementById('background-image-credits-list');

    if (!grid) return;

    function getCatalog() {
        try {
            return typeof window.getAppBackgroundPresetCatalog === 'function'
                ? window.getAppBackgroundPresetCatalog()
                : [];
        } catch (error) {
            console.warn('[Hintergrund] Preset-Katalog konnte nicht gelesen werden:', error);
            return [];
        }
    }

    function getSettings() {
        try {
            return typeof window.getAppBackgroundSettings === 'function'
                ? window.getAppBackgroundSettings()
                : { mode: 'preset', presetId: 'alpine-classic' };
        } catch (_) {
            return { mode: 'preset', presetId: 'alpine-classic' };
        }
    }

    function createPresetCard(preset, selected) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'background-preset-card' + (selected ? ' is-selected' : '');
        button.dataset.presetId = preset.id;
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.setAttribute(
            'aria-label',
            preset.name + (selected ? ', aktuell ausgewählt' : ', als Hintergrund auswählen')
        );

        const imageWrap = document.createElement('span');
        imageWrap.className = 'background-preset-image-wrap';

        const image = document.createElement('img');
        image.className = 'background-preset-image';
        image.src = preset.preview;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
            imageWrap.classList.add('image-unavailable');
            image.hidden = true;
        }, { once: true });

        const check = document.createElement('span');
        check.className = 'background-preset-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';

        imageWrap.append(image, check);

        const textWrap = document.createElement('span');
        textWrap.className = 'background-preset-copy';

        const title = document.createElement('strong');
        title.className = 'background-preset-title';
        title.textContent = preset.name;

        const description = document.createElement('span');
        description.className = 'background-preset-description';
        description.textContent = preset.description || '';

        textWrap.append(title, description);
        button.append(imageWrap, textWrap);

        button.addEventListener('click', () => {
            try {
                if (typeof window.setAppBackgroundPreset !== 'function') {
                    throw new Error('Die Hintergrundverwaltung ist nicht verfügbar.');
                }

                const applied = window.setAppBackgroundPreset(preset.id);
                if (!applied) {
                    throw new Error('Dieses Hintergrundmotiv konnte nicht ausgewählt werden.');
                }

                render();
                if (typeof window.showToast === 'function') {
                    window.showToast('Hintergrundbild „' + preset.name + '“ übernommen ✓', {
                        type: 'success',
                        duration: 2200
                    });
                }
            } catch (error) {
                console.error('[Hintergrund] Preset konnte nicht übernommen werden:', error);
                if (typeof window.showToast === 'function') {
                    window.showToast(error.message || 'Hintergrundbild konnte nicht übernommen werden.', {
                        type: 'error',
                        duration: 3000
                    });
                }
            }
        });

        return button;
    }

    function renderCredits(catalog) {
        if (!credits) return;
        credits.replaceChildren();

        catalog.filter(preset => preset.sourceUrl && preset.credit).forEach(preset => {
            const item = document.createElement('li');
            const source = document.createElement('a');
            source.href = preset.sourceUrl;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = preset.name + ' – ' + preset.credit;
            item.appendChild(source);

            if (preset.licenseUrl && preset.licenseLabel) {
                const license = document.createElement('a');
                license.href = preset.licenseUrl;
                license.target = '_blank';
                license.rel = 'noopener noreferrer';
                license.textContent = 'Lizenz';
                license.setAttribute('aria-label', preset.licenseLabel + ' Lizenz für ' + preset.name);
                item.append(' · ', license);
            }

            credits.appendChild(item);
        });
    }

    function render() {
        const catalog = getCatalog();
        const settings = getSettings();
        if (!catalog.length) {
            grid.innerHTML = '<p class="background-preset-empty">Die Hintergrundmotive konnten nicht geladen werden.</p>';
            return;
        }

        const activePresetId = settings.mode === 'custom' ? '' : settings.presetId;
        grid.replaceChildren();

        catalog.forEach(preset => {
            const selected = preset.id === activePresetId;
            grid.appendChild(createPresetCard(preset, selected));
        });

        const activePreset = catalog.find(preset => preset.id === activePresetId);
        if (status) {
            status.textContent = activePreset
                ? 'Aktiv: ' + activePreset.name
                : 'Ein eigenes Hintergrundbild ist aktiv.';
        }

        renderCredits(catalog);
    }

    // Beim Öffnen der App zunächst den sicheren Standard anzeigen. Nach dem
    // IndexedDB-Start wird erneut gerendert und die tatsächlich gespeicherte
    // Auswahl markiert.
    render();

    const originalInitStorage = window.initStorage;
    if (typeof originalInitStorage === 'function') {
        window.initStorage = async function (...args) {
            const result = await originalInitStorage.apply(this, args);
            render();
            return result;
        };
    }
})();