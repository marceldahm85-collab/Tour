/* Premium Alpine · Theme-Editor-Kompatibilität für halbtransparente Flächen.
   Lässt Theme-Editor-Farben, Verläufe, Radius und Blur aktiv, begrenzt aber die
   Deckkraft der großen Inhaltsflächen, damit das feste Alpin-Motiv sichtbar bleibt. */
(function () {
    'use strict';

    const PATCH_ID = '20261026-theme-editor-translucent-surfaces';
    if (window.__themeEditorSurfaceCompat === PATCH_ID) return;

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
            const result = originalApplySettings.apply(this, arguments);
            const liveStyle = document.getElementById('theme-editor-live-style');
            if (liveStyle) {
                liveStyle.textContent = softenThemeEditorSurfaces(liveStyle.textContent);
            }
            return result;
        };
        compatibleApplySettings.__alpineSurfaceCompat = true;
        window.applyThemeEditorSettingsToDom = compatibleApplySettings;
    }

    // Die erste Theme-Anwendung kann vor dem Laden dieses Kompatibilitätsmoduls
    // erfolgt sein. Direkt den bereits erzeugten Live-Style mit angleichen.
    const existingLiveStyle = document.getElementById('theme-editor-live-style');
    if (existingLiveStyle) {
        existingLiveStyle.textContent = softenThemeEditorSurfaces(existingLiveStyle.textContent);
    }

    window.__themeEditorSurfaceCompat = PATCH_ID;
})();
