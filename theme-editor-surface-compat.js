/* Premium Alpine · Theme-Editor-Kompatibilität für halbtransparente Flächen.
   Lässt Theme-Editor-Farben, Verläufe, Radius und Blur aktiv, begrenzt aber die
   Deckkraft der großen Inhaltsflächen, damit das feste Alpin-Motiv sichtbar bleibt. */
(function () {
    'use strict';

    const PATCH_ID = '20261026-theme-editor-paused-for-premium-alpine';
    if (window.__themeEditorSurfaceCompat === PATCH_ID) return;

    const isThemeEditorPaused = () =>
        Boolean(document.body?.classList.contains('premium-alpine-editor-paused'));

    function clearPausedThemeEditorStyles() {
        const body = document.body;
        if (body) {
            [
                '--text-main', '--text-soft', '--accent', '--accent-soft', '--accent-gradient', '--accent-text-color',
                '--theme-surface-top', '--theme-surface-bottom', '--theme-surface-soft-top', '--theme-surface-soft-bottom',
                '--theme-surface-border', '--theme-surface-text',
                '--surface-gradient-top', '--surface-gradient-bottom', '--surface-gradient-soft-top', '--surface-gradient-soft-bottom',
                '--surface-gradient-border', '--surface-gradient-text',
                '--light-surface-top', '--light-surface-bottom', '--light-surface-soft-top', '--light-surface-soft-bottom',
                '--light-surface-border', '--light-surface-text',
                '--light-nav-top', '--light-nav-bottom', '--light-nav-soft-top', '--light-nav-soft-bottom',
                '--light-nav-border', '--light-nav-text',
                '--ui-card-bg', '--ui-card-bg-interactive', '--ui-section-bg', '--ui-card-border',
                '--year-control-bg', '--year-control-bg-hover', '--year-control-border', '--year-option-bg', '--year-option-text',
                '--glass-bg', '--glass-border'
            ].forEach(name => body.style.removeProperty(name));
        }

        const liveStyle = document.getElementById('theme-editor-live-style');
        if (liveStyle) liveStyle.textContent = '';

        const brightnessLayer = document.getElementById('theme-editor-brightness-layer');
        if (brightnessLayer) {
            brightnessLayer.style.setProperty('opacity', '0', 'important');
            brightnessLayer.setAttribute('aria-hidden', 'true');
        }
    }

    function softenThemeEditorSurfaces(cssText) {
        const capRgbaAlpha = (text, maxAlpha) => text.replace(
            /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/gi,
            (match, red, green, blue, alphaText) => {
                const alpha = Number(alphaText);
                if (!Number.isFinite(alpha) || alpha <= maxAlpha) return match;
                return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + maxAlpha.toFixed(2) + ')';
            }
        );

        // Das generierte Theme-Editor-CSS besteht aus einzelnen flachen Regeln.
        // Große Flächen haben Schatten + Blur; kleinere Komponenten nur Radius.
        return String(cssText || '').replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selector, declarations) => {
            if (!/background\s*:\s*(?:linear|radial)-gradient/i.test(declarations)) return rule;

            const isLargeSurface =
                /box-shadow\s*:/i.test(declarations) &&
                /backdrop-filter\s*:/i.test(declarations);
            const isSmallSurface =
                !/box-shadow\s*:/i.test(declarations) &&
                /border-radius\s*:\s*\d+px\s*!important/i.test(declarations);

            if (isLargeSurface) {
                return selector + '{' + capRgbaAlpha(declarations, 0.78) + '}';
            }
            if (isSmallSurface) {
                return selector + '{' + capRgbaAlpha(declarations, 0.66) + '}';
            }
            return rule;
        });
    }

    function softenThemeEditorInlineVariables() {
        const body = document.body;
        if (!body) return;

        const capValue = (value, maxAlpha) => String(value || '').replace(
            /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/gi,
            (match, red, green, blue, alphaText) => {
                const alpha = Number(alphaText);
                if (!Number.isFinite(alpha) || alpha <= maxAlpha) return match;
                return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + maxAlpha.toFixed(2) + ')';
            }
        );

        const strongSurfaceTokens = [
            '--theme-surface-top', '--theme-surface-bottom',
            '--surface-gradient-top', '--surface-gradient-bottom',
            '--light-surface-top', '--light-surface-bottom',
            '--light-nav-top', '--light-nav-bottom', '--glass-bg'
        ];
        const softSurfaceTokens = [
            '--theme-surface-soft-top', '--theme-surface-soft-bottom',
            '--surface-gradient-soft-top', '--surface-gradient-soft-bottom',
            '--light-surface-soft-top', '--light-surface-soft-bottom',
            '--light-nav-soft-top', '--light-nav-soft-bottom',
            '--ui-card-bg', '--ui-card-bg-interactive', '--ui-section-bg',
            '--year-control-bg', '--year-control-bg-hover'
        ];

        strongSurfaceTokens.forEach(name => {
            const value = body.style.getPropertyValue(name);
            if (value) body.style.setProperty(name, capValue(value, 0.78));
        });
        softSurfaceTokens.forEach(name => {
            const value = body.style.getPropertyValue(name);
            if (value) body.style.setProperty(name, capValue(value, 0.66));
        });
    }

    const originalBuildCss = window.buildThemeEditorLiveCss;
    if (typeof originalBuildCss === 'function' && !originalBuildCss.__alpineSurfaceCompat) {
        const compatibleBuildCss = function () {
            return softenThemeEditorSurfaces(originalBuildCss.apply(this, arguments));
        };
        compatibleBuildCss.__alpineSurfaceCompat = true;
        window.buildThemeEditorLiveCss = compatibleBuildCss;
    }

    const originalApplySettings = window.applyThemeEditorSettingsToDom;
    if (typeof originalApplySettings === 'function' && !originalApplySettings.__alpineSurfaceCompat) {
        const compatibleApplySettings = function () {
            if (isThemeEditorPaused()) {
                clearPausedThemeEditorStyles();
                return;
            }
            const result = originalApplySettings.apply(this, arguments);
            const liveStyle = document.getElementById('theme-editor-live-style');
            if (liveStyle) {
                liveStyle.textContent = softenThemeEditorSurfaces(liveStyle.textContent);
            }
            softenThemeEditorInlineVariables();
            return result;
        };
        compatibleApplySettings.__alpineSurfaceCompat = true;
        window.applyThemeEditorSettingsToDom = compatibleApplySettings;
    }

    // Die erste Theme-Anwendung kann vor dem Laden dieses Kompatibilitätsmoduls
    // erfolgt sein. Direkt den bereits erzeugten Live-Style mit angleichen.
    if (isThemeEditorPaused()) {
        clearPausedThemeEditorStyles();
    } else {
        const existingLiveStyle = document.getElementById('theme-editor-live-style');
        if (existingLiveStyle) {
            existingLiveStyle.textContent = softenThemeEditorSurfaces(existingLiveStyle.textContent);
        }
        softenThemeEditorInlineVariables();
    }

    window.__themeEditorSurfaceCompat = PATCH_ID;
})();
