package at.marcel.bergtouren;

import android.Manifest;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.animation.DecelerateInterpolator;
import android.annotation.TargetApi;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.core.splashscreen.SplashScreen;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String TAG = "BergtourenAndroid";
    private static final int FILE_CHOOSER_REQUEST_CODE = 4102;
    private static final int GALLERY_PERMISSION_REQUEST_CODE = 4203;
    private static final int BACKUP_SAVE_REQUEST_CODE = 4304;
    private static final int BACKUP_OPEN_REQUEST_CODE = 4305;
    private static final int MAX_BACKUP_BYTES = 48 * 1024 * 1024;
    private static final int MAX_PDF_BYTES = 64 * 1024 * 1024;
    private static final int MAX_BACKUP_CHUNKS = 2048;
    private static final int MAX_BACKUP_CHUNK_CHARS = 48 * 1024;
    private static final String BRIDGE_NAME = "TourNative";
    public static final String ACTION_OPEN_YEAR_STATS =
            "at.marcel.bergtouren.action.OPEN_YEAR_STATS";
    public static final String ACTION_OPEN_DASHBOARD =
            "at.marcel.bergtouren.action.OPEN_DASHBOARD";

    private static final Uri APP_URI = Uri.parse(BuildConfig.WEB_APP_URL);
    private static final String APP_ORIGIN =
            APP_URI.getScheme() + "://" + APP_URI.getAuthority();
    private static final String APP_BASE_PATH = normalizeBasePath(APP_URI.getPath());

    private WebView webView;
    private FrameLayout root;
    private FrameLayout appContent;
    private ProgressBar progressBar;
    private LinearLayout errorPanel;
    private FrameLayout premiumSplashOverlay;
    private ValueAnimator premiumSplashSheenAnimator;
    private boolean premiumSplashHiding;
    private ValueCallback<Uri[]> pendingFileChooser;
    private boolean bridgeAvailable;
    private boolean webPageLoaded;
    private boolean pendingOpenDashboard;
    private Object backInvokedCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService galleryExecutor = Executors.newSingleThreadExecutor();
    private JavaScriptReplyProxy pendingGalleryPermissionReply;
    private String pendingGalleryPermissionRequestId;
    private ByteArrayOutputStream pendingBackupStream;
    private String pendingBackupTransferId;
    private String pendingBackupFileName;
    private String pendingBackupMimeType;
    private Uri pendingBackupTargetUri;
    private boolean pendingBackupLinkOnSave;
    private JavaScriptReplyProxy pendingBackupOpenReply;
    private String pendingBackupOpenRequestId;
    private int pendingBackupExpectedBytes;
    private int pendingBackupExpectedChunks;
    private int pendingBackupNextChunk;
    private JavaScriptReplyProxy pendingBackupFinishReply;
    private String pendingBackupFinishRequestId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        pendingOpenDashboard = isWidgetDashboardAction(
                getIntent() != null ? getIntent().getAction() : null
        );

        configureSystemBars();
        createWebViewLayout();
        configureWebView();
        installRestrictedNativeBridge();
        registerPredictiveBackHandler();

        if (savedInstanceState != null && webView.restoreState(savedInstanceState) != null) {
            // Der vorhandene WebView-Verlauf wird nach einer Activity-Neuerstellung
            // wiederhergestellt. Die WebViewClient-Prüfung begrenzt alle Ziele weiterhin.
        } else {
            webView.loadUrl(BuildConfig.WEB_APP_URL);
        }
    }

    @SuppressWarnings("deprecation")
    private void configureSystemBars() {
        Window window = getWindow();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 15+ erzwingt Edge-to-Edge für Apps mit targetSdk 35+.
            // Die sicheren Inhaltsabstände werden am Root-Container gesetzt.
            window.setDecorFitsSystemWindows(false);
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);
        } else {
            window.setStatusBarColor(Color.rgb(11, 15, 20));
            window.setNavigationBarColor(Color.rgb(11, 15, 20));
        }
    }

    private void createPremiumSplashOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setClickable(true);
        overlay.setFocusable(true);
        overlay.setBackgroundColor(Color.rgb(7, 12, 18));

        // Das vorhandene, lokal gebündelte Alpenmotiv sorgt auch offline für
        // einen echten Bildhintergrund. Das Overlay liegt bewusst außerhalb
        // der inset-geschützten WebView-Fläche und reicht bis an alle Displayränder.
        ImageView panorama = new ImageView(this);
        panorama.setImageResource(R.drawable.splash_alpine_panorama);
        panorama.setScaleType(ImageView.ScaleType.CENTER_CROP);
        overlay.addView(panorama, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        View shade = new View(this);
        shade.setBackground(new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { 0x1A060B12, 0x48070D14, 0xA8070D14, 0xF20A1017 }
        ));
        overlay.addView(shade, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        // Dezente Randabdunklung gibt dem Panorama Tiefe, ohne ein künstliches
        // Bergmotiv oder weitere grafische Elemente darüberzulegen.
        View vignette = new View(this);
        GradientDrawable vignetteDrawable = new GradientDrawable();
        vignetteDrawable.setShape(GradientDrawable.RECTANGLE);
        vignetteDrawable.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        vignetteDrawable.setGradientCenter(0.5f, 0.46f);
        vignetteDrawable.setGradientRadius(dp(560));
        vignetteDrawable.setColors(new int[] { 0x00000000, 0x56040A12 });
        vignette.setBackground(vignetteDrawable);
        overlay.addView(vignette, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(dp(24), dp(24), dp(24), dp(24));
        content.setAlpha(0f);
        content.setTranslationY(dp(12));

        // Eine weiche Lichtaura trennt das Emblem optisch vom Fotohintergrund.
        FrameLayout emblemStage = new FrameLayout(this);
        GradientDrawable emblemGlow = new GradientDrawable();
        emblemGlow.setShape(GradientDrawable.OVAL);
        emblemGlow.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        emblemGlow.setGradientRadius(dp(96));
        emblemGlow.setGradientCenter(0.5f, 0.5f);
        emblemGlow.setColors(new int[] { 0x55E4BC75, 0x18C69A54, 0x00000000 });
        View glow = new View(this);
        glow.setBackground(emblemGlow);
        emblemStage.addView(glow, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        // Das Emblem verwendet ausdrücklich dasselbe 192er-PNG wie PWA- und
        // Android-Appsymbol: R.drawable.ic_launcher_pwa.
        FrameLayout emblem = new FrameLayout(this);
        emblem.setClipChildren(true);
        emblem.setClipToPadding(true);
        GradientDrawable emblemMetal = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[] { 0xFFFFE9B8, 0xFF8A6838, 0xFFE2BD78, 0xFF3B2C1C }
        );
        emblemMetal.setShape(GradientDrawable.OVAL);
        emblem.setBackground(emblemMetal);
        emblem.setElevation(dp(20));
        emblem.setClipToOutline(true);

        FrameLayout innerPlate = new FrameLayout(this);
        GradientDrawable innerMetal = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[] { 0xFF263342, 0xFF101923, 0xFF182431 }
        );
        innerMetal.setShape(GradientDrawable.OVAL);
        innerMetal.setStroke(dp(1), 0xFFBFA06A);
        innerPlate.setBackground(innerMetal);
        FrameLayout.LayoutParams innerParams = new FrameLayout.LayoutParams(
                dp(132), dp(132), Gravity.CENTER
        );
        emblem.addView(innerPlate, innerParams);

        ImageView emblemIcon = new ImageView(this);
        emblemIcon.setImageResource(R.drawable.ic_launcher_pwa);
        emblemIcon.setScaleType(ImageView.ScaleType.FIT_CENTER);
        emblemIcon.setPadding(dp(8), dp(8), dp(8), dp(8));
        innerPlate.addView(emblemIcon, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        GradientDrawable outerRim = new GradientDrawable();
        outerRim.setShape(GradientDrawable.OVAL);
        outerRim.setColor(Color.TRANSPARENT);
        outerRim.setStroke(dp(2), 0xFFE9D3A0);
        emblem.setForeground(outerRim);

        View sheen = new View(this);
        sheen.setBackground(new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[] { 0x00FFFFFF, 0x08FFFFFF, 0xC8FFFFFF, 0x18FFFFFF, 0x00FFFFFF }
        ));
        sheen.setRotation(22f);
        FrameLayout.LayoutParams sheenParams = new FrameLayout.LayoutParams(
                dp(42), dp(184), Gravity.CENTER
        );
        emblem.addView(sheen, sheenParams);

        FrameLayout.LayoutParams emblemParams = new FrameLayout.LayoutParams(
                dp(148), dp(148), Gravity.CENTER
        );
        emblemStage.addView(emblem, emblemParams);
        content.addView(emblemStage, new LinearLayout.LayoutParams(dp(190), dp(190)));

        TextView title = new TextView(this);
        title.setText("BERGTOUREN");
        title.setTextColor(0xFFFFF8EC);
        title.setTextSize(20);
        title.setTypeface(Typeface.create("sans-serif", Typeface.BOLD));
        title.setLetterSpacing(0.22f);
        title.setGravity(Gravity.CENTER);
        title.setIncludeFontPadding(false);
        title.setShadowLayer(dp(8), 0f, dp(2), 0xB0000000);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = dp(4);
        content.addView(title, titleParams);

        View divider = new View(this);
        GradientDrawable dividerGradient = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                new int[] { 0x00D5B77D, 0xD5B77D, 0x00D5B77D }
        );
        dividerGradient.setSize(dp(48), dp(1));
        divider.setBackground(dividerGradient);
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(dp(48), dp(1));
        dividerParams.topMargin = dp(12);
        content.addView(divider, dividerParams);

        TextView subtitle = new TextView(this);
        subtitle.setText("TOUREN  ·  GIPFEL  ·  ERLEBNISSE");
        subtitle.setTextColor(0xE8E8DCC8);
        subtitle.setTextSize(10);
        subtitle.setLetterSpacing(0.16f);
        subtitle.setGravity(Gravity.CENTER);
        subtitle.setIncludeFontPadding(false);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subtitleParams.topMargin = dp(10);
        content.addView(subtitle, subtitleParams);

        overlay.addView(content, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
        ));

        root.addView(overlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        premiumSplashOverlay = overlay;

        // Ruhiger Einstieg: Panorama zuerst, anschließend Emblem und Schrift.
        // Die einmalige Lichtreflexion läuft erst über das bereits sichtbare Emblem.
        if (ValueAnimator.areAnimatorsEnabled()) {
            overlay.setAlpha(0f);
            overlay.post(() -> {
                // app.ready kann bei warmem Start sehr früh eintreffen. In
                // diesem Fall darf die noch ausstehende Einblendsequenz den
                // bereits laufenden Splash-Ausgang nicht wieder sichtbar machen.
                if (premiumSplashHiding || premiumSplashOverlay != overlay) return;

                overlay.animate()
                        .alpha(1f)
                        .setDuration(360L)
                        .setInterpolator(new DecelerateInterpolator())
                        .start();
                content.animate()
                        .alpha(1f)
                        .translationY(0f)
                        .setStartDelay(110L)
                        .setDuration(480L)
                        .setInterpolator(new DecelerateInterpolator())
                        .start();
                emblem.animate()
                        .scaleX(1f)
                        .scaleY(1f)
                        .setStartDelay(130L)
                        .setDuration(560L)
                        .setInterpolator(new DecelerateInterpolator())
                        .start();

                premiumSplashSheenAnimator = ValueAnimator.ofFloat(-dp(164), dp(164));
                premiumSplashSheenAnimator.setStartDelay(470L);
                premiumSplashSheenAnimator.setDuration(1280L);
                premiumSplashSheenAnimator.setInterpolator(new DecelerateInterpolator());
                premiumSplashSheenAnimator.addUpdateListener(animation ->
                        sheen.setTranslationX((Float) animation.getAnimatedValue())
                );
                premiumSplashSheenAnimator.start();
            });
            emblem.setScaleX(0.92f);
            emblem.setScaleY(0.92f);
        } else {
            content.setAlpha(1f);
            content.setTranslationY(0f);
            emblem.setScaleX(1f);
            emblem.setScaleY(1f);
            sheen.setVisibility(View.GONE);
        }
    }

    private void hidePremiumSplashOverlay() {
        if (premiumSplashOverlay == null || premiumSplashHiding) return;
        premiumSplashHiding = true;

        if (premiumSplashSheenAnimator != null) {
            premiumSplashSheenAnimator.cancel();
            premiumSplashSheenAnimator = null;
        }

        FrameLayout overlay = premiumSplashOverlay;
        if (!ValueAnimator.areAnimatorsEnabled()) {
            overlay.setAlpha(0f);
            if (root != null) root.removeView(overlay);
            if (premiumSplashOverlay == overlay) premiumSplashOverlay = null;
            return;
        }

        overlay.animate()
                .alpha(0f)
                .setDuration(260L)
                .setInterpolator(new DecelerateInterpolator())
                .withEndAction(() -> {
                    if (root != null) root.removeView(overlay);
                    if (premiumSplashOverlay == overlay) premiumSplashOverlay = null;
                })
                .start();
    }

    private void triggerAdaptiveHaptic(String patternName) {
        final long[] timings;
        final int[] amplitudes;

        switch (patternName) {
            case "selection":
                timings = new long[] { 0L, 7L };
                amplitudes = new int[] { 0, 48 };
                break;
            case "navigation":
                timings = new long[] { 0L, 10L };
                amplitudes = new int[] { 0, 72 };
                break;
            case "tile":
                timings = new long[] { 0L, 13L };
                amplitudes = new int[] { 0, 98 };
                break;
            case "milestone":
                timings = new long[] { 0L, 18L, 30L, 22L };
                amplitudes = new int[] { 0, 92, 0, 136 };
                break;
            case "achievement":
                timings = new long[] { 0L, 22L, 38L, 30L, 46L, 34L };
                amplitudes = new int[] { 0, 105, 0, 150, 0, 182 };
                break;
            default:
                return;
        }

        try {
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager manager = getSystemService(VibratorManager.class);
                vibrator = manager != null ? manager.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator == null || !vibrator.hasVibrator()) return;
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1));
        } catch (RuntimeException error) {
            Log.w(TAG, "Adaptives haptisches Feedback ist auf diesem Gerät nicht verfügbar.", error);
        }
    }

    private void createWebViewLayout() {
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(7, 12, 18));

        // Nur der eigentliche App-Inhalt erhält Systemleisten-/Cutout-Insets.
        // Der Splash liegt als separates Root-Overlay darüber und bleibt dadurch
        // wirklich vollflächig bis hinter Status- und Navigationsleiste sichtbar.
        appContent = new FrameLayout(this);
        root.addView(appContent, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            appContent.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets systemBars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                );
                view.setPadding(
                        systemBars.left,
                        systemBars.top,
                        systemBars.right,
                        systemBars.bottom
                );
                return insets;
            });
        }

        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        appContent.addView(webView);

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3),
                Gravity.TOP
        );
        progressBar.setMax(100);
        progressBar.setProgressTintList(android.content.res.ColorStateList.valueOf(
                Color.rgb(199, 166, 106)
        ));
        appContent.addView(progressBar, progressParams);

        errorPanel = createErrorPanel();
        errorPanel.setVisibility(View.GONE);
        appContent.addView(errorPanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        // Das native Splash-Overlay wird zuletzt angelegt und verdeckt den noch
        // ladenden WebView-Inhalt bis app.ready oder zum Sicherheits-Fallback.
        createPremiumSplashOverlay();

        setContentView(root);
    }

    private LinearLayout createErrorPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(28), dp(28), dp(28));
        panel.setBackgroundColor(Color.rgb(11, 15, 20));

        TextView title = new TextView(this);
        title.setText("Bergtouren ist gerade nicht erreichbar");
        title.setTextColor(Color.WHITE);
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(12));
        panel.addView(title);

        TextView detail = new TextView(this);
        detail.setText("Bitte prüfe die Internetverbindung. Gespeicherte Offline-Inhalte können weiterhin verfügbar sein.");
        detail.setTextColor(Color.LTGRAY);
        detail.setTextSize(14);
        detail.setGravity(Gravity.CENTER);
        detail.setPadding(0, 0, 0, dp(20));
        panel.addView(detail);

        Button retry = new Button(this);
        retry.setText("Erneut versuchen");
        retry.setOnClickListener(view -> {
            errorPanel.setVisibility(View.GONE);
            webView.loadUrl(BuildConfig.WEB_APP_URL);
        });
        panel.addView(retry);

        return panel;
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);

        CookieManager.getInstance().setAcceptCookie(true);
        WebView.setWebContentsDebuggingEnabled(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (isTrustedAppUrl(target)) {
                    return false;
                }

                openExternalUri(target);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                webPageLoaded = false;

                Uri target = Uri.parse(url);
                if (!isTrustedAppUrl(target)) {
                    view.stopLoading();
                    openExternalUri(target);
                    return;
                }

                errorPanel.setVisibility(View.GONE);
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!isTrustedAppUrl(Uri.parse(url))) {
                    return;
                }

                webPageLoaded = true;
                progressBar.setVisibility(View.GONE);
                sendBridgeHandshake();
                deliverPendingDashboardWidgetNavigation();
                // Fallback, falls die PWA keinen eigenen Ready-Impuls senden kann.
                // Ein früheres app.ready blendet den Splash ohne künstliche Wartezeit aus.
                mainHandler.postDelayed(() -> hidePremiumSplashOverlay(), 2800L);
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    hidePremiumSplashOverlay();
                    progressBar.setVisibility(View.GONE);
                    errorPanel.setVisibility(View.VISIBLE);
                    Log.w(TAG, "Web-App konnte nicht geladen werden: " + error.getDescription());
                }
            }

            @Override
            public void onReceivedSslError(
                    WebView view,
                    android.webkit.SslErrorHandler handler,
                    android.net.http.SslError error
            ) {
                // Zertifikatsfehler werden niemals übergangen.
                handler.cancel();
                hidePremiumSplashOverlay();
                errorPanel.setVisibility(View.VISIBLE);
                progressBar.setVisibility(View.GONE);
                Log.e(TAG, "TLS-Zertifikatsfehler: " + error);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (pendingFileChooser != null) {
                    pendingFileChooser.onReceiveValue(null);
                }

                pendingFileChooser = filePathCallback;

                try {
                    Intent chooserIntent = fileChooserParams.createIntent();
                    // Die ausgewählte Datei wird direkt durch die WebView eingelesen
                    // und anschließend lokal optimiert/gespeichert. Der Lesezugriff
                    // auf Content-URIs muss deshalb ausdrücklich mitgegeben werden.
                    chooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    if (fileChooserParams.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                        chooserIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    }
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (RuntimeException error) {
                    Log.e(TAG, "Android-Dateiauswahl konnte nicht geöffnet werden.", error);
                    pendingFileChooser = null;
                    filePathCallback.onReceiveValue(null);
                    return false;
                }
            }
        });
    }

    private void registerPredictiveBackHandler() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }

        backInvokedCallback = Api33Back.register(this, this::handleBackNavigation);
    }

    private void handleBackNavigation() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    private void installRestrictedNativeBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            bridgeAvailable = false;
            Log.w(TAG, "Sichere WebMessageListener-Bridge wird von diesem WebView nicht unterstützt.");
            return;
        }

        WebViewCompat.addWebMessageListener(
                webView,
                BRIDGE_NAME,
                Collections.singleton(APP_ORIGIN),
                new WebViewCompat.WebMessageListener() {
                    @Override
                    public void onPostMessage(
                            WebView sourceView,
                            WebMessageCompat message,
                            Uri sourceOrigin,
                            boolean isMainFrame,
                            JavaScriptReplyProxy replyProxy
                    ) {
                        if (!isMainFrame
                                || !APP_ORIGIN.equals(sourceOrigin.toString())
                                || !isTrustedAppUrl(Uri.parse(sourceView.getUrl()))) {
                            Log.w(TAG, "Native Nachricht aus nicht erlaubtem Kontext verworfen.");
                            return;
                        }

                        String data = message.getData();
                        // Export-Chunks enthalten bis zu 48 KiB Base64 plus JSON-Hülle.
                        if (data == null || data.length() > 64 * 1024) {
                            return;
                        }

                        try {
                            JSONObject request = new JSONObject(data);
                            String type = request.optString("type", "");
                            String requestId = request.optString("requestId", "");

                            if ("app.ready".equals(type)) {
                                runOnUiThread(() -> hidePremiumSplashOverlay());
                            } else if ("haptics.trigger".equals(type)) {
                                triggerAdaptiveHaptic(request.optString("pattern", ""));
                            } else if ("bridge.ping".equals(type)) {
                                // Auch der Verbindungstest muss seine Anfrage-ID zurückgeben.
                                // Andernfalls kann die JavaScript-Seite den Pong keiner offenen
                                // Anfrage zuordnen und stuft die Bridge nach dem Timeout als offline ein.
                                JSONObject response = createGalleryResponse("bridge.pong", requestId);
                                response.put("nativeVersion", BuildConfig.VERSION_NAME);
                                org.json.JSONArray features = new org.json.JSONArray();
                                features.put("gallery.mediaStore.v1");
                                features.put("gallery.thumbnail.v1");
                                features.put("gallery.mediaStore.v2");
                                features.put("gallery.thumbnail.v2");
                                features.put("gallery.image.full.v1");
                                features.put("gallery.video.player.v1");
                                features.put("widget.yearStats.v1");
                                features.put("widget.yearStats.v2");
                                features.put("widget.yearStats.config.v1");
                                features.put("widget.yearStats.backup.v1");
                                features.put("backup.export.v1");
                                features.put("pdf.export.v1");
                                features.put("backup.file.link.v1");
                                features.put("haptics.adaptive.v1");
                                features.put("splash.hybrid.v1");
                                response.put("features", features);
                                replyToBridge(replyProxy, response);
                                Log.i(TAG, "Sichere JavaScript-Bridge ist erreichbar (Request-ID bestätigt).");
                            } else if ("gallery.permission.get".equals(type)) {
                                replyGalleryPermissionState(replyProxy, requestId);
                            } else if ("gallery.permission.request".equals(type)) {
                                requestGalleryPermission(replyProxy, requestId);
                            } else if ("gallery.media.byDate".equals(type)
                                    || "gallery.photos.byDate".equals(type)) {
                                String date = request.optString("date", "");
                                queryGalleryMediaForDate(replyProxy, requestId, date);
                            } else if ("gallery.thumbnail".equals(type)) {
                                String uri = request.optString("uri", "");
                                queryGalleryThumbnail(replyProxy, requestId, uri);
                            } else if ("gallery.image.full".equals(type)) {
                                String uri = request.optString("uri", "");
                                queryGalleryFullImage(replyProxy, requestId, uri);
                            } else if ("gallery.video.play".equals(type)) {
                                String uri = request.optString("uri", "");
                                launchGalleryVideo(replyProxy, requestId, uri);
                            } else if ("backup.export.start".equals(type)) {
                                startBackupExport(request, replyProxy, requestId);
                            } else if ("backup.export.chunk".equals(type)) {
                                appendBackupExportChunk(request, replyProxy, requestId);
                            } else if ("backup.export.finish".equals(type)) {
                                finishBackupExport(request, replyProxy, requestId);
                            } else if ("backup.export.abort".equals(type)) {
                                abortBackupExport(request, replyProxy, requestId);
                            } else if ("backup.file.open".equals(type)) {
                                openBackupFilePicker(replyProxy, requestId);
                            } else if ("backup.file.read".equals(type)) {
                                readBackupFile(request, replyProxy, requestId);
                            } else if ("widget.yearStats.settings".equals(type)) {
                                boolean saved = false;
                                int widgetCount = 0;
                                String saveError = null;
                                try {
                                    String title = request.optString("title", "BERGJAHR");
                                    String background = request.optString("background", "alpine");
                                    boolean showTours = request.optBoolean("showTours", true);
                                    boolean showDistance = request.optBoolean("showDistance", true);
                                    boolean showAscent = request.optBoolean("showAscent", true);
                                    boolean showPeaks = request.optBoolean("showPeaks", true);
                                    boolean showSteps = request.optBoolean("showSteps", true);
                                    boolean showTime = request.optBoolean("showTime", true);
                                    boolean showSpeed = request.optBoolean("showSpeed", false);
                                    boolean showGradient = request.optBoolean("showGradient", false);
                                    boolean showAscentRate = request.optBoolean("showAscentRate", false);
                                    int selectedCount = (showTours ? 1 : 0) + (showDistance ? 1 : 0)
                                            + (showAscent ? 1 : 0) + (showPeaks ? 1 : 0)
                                            + (showSteps ? 1 : 0) + (showTime ? 1 : 0)
                                            + (showSpeed ? 1 : 0) + (showGradient ? 1 : 0)
                                            + (showAscentRate ? 1 : 0);
                                    JSONArray orderJson = request.optJSONArray("metricOrder");
                                    String[] metricOrder = new String[orderJson == null ? 0 : orderJson.length()];
                                    if (orderJson != null) {
                                        for (int i = 0; i < orderJson.length(); i++) {
                                            metricOrder[i] = orderJson.optString(i, "");
                                        }
                                    }
                                    boolean valid = title.length() <= 20 && selectedCount >= 1 && selectedCount <= 6
                                            && ("alpine".equals(background) || "dark".equals(background));
                                    if (valid) {
                                        saved = YearStatsWidgetProvider.updateConfiguration(
                                                MainActivity.this, title, showTours, showDistance, showAscent,
                                                showPeaks, showSteps, showTime, showSpeed, showGradient,
                                                showAscentRate, metricOrder, background);
                                    } else {
                                        saveError = "Die Widget-Auswahl ist ungültig. Wähle eine bis sechs Kennzahlen.";
                                    }
                                    widgetCount = YearStatsWidgetProvider.getInstalledWidgetCount(MainActivity.this);
                                    if (valid && !saved) {
                                        saveError = "Android konnte die Widget-Einstellungen nicht dauerhaft speichern.";
                                    }
                                } catch (RuntimeException widgetError) {
                                    Log.e(TAG, "Widget-Konfiguration oder Widget-Aktualisierung fehlgeschlagen.", widgetError);
                                    saveError = "Android konnte die Widget-Konfiguration nicht anwenden: "
                                            + widgetError.getClass().getSimpleName();
                                }

                                JSONObject response = createGalleryResponse("widget.yearStats.settings.result", requestId);
                                response.put("ok", saved);
                                response.put("widgetCount", widgetCount);
                                if (saveError != null) response.put("error", saveError);
                                replyToBridge(replyProxy, response);
                                Log.i(TAG, "Widget-Konfiguration: saved=" + saved + ", widgetCount=" + widgetCount
                                        + ", requestId=" + requestId);
                            } else if ("widget.yearStats.backup.get".equals(type)) {
                                JSONObject response = createGalleryResponse("widget.yearStats.backup.result", requestId);
                                try {
                                    response.put("ok", true);
                                    response.put("configuration", YearStatsWidgetProvider.exportConfiguration(MainActivity.this));
                                    response.put("widgetCount", YearStatsWidgetProvider.getInstalledWidgetCount(MainActivity.this));
                                } catch (RuntimeException backupError) {
                                    Log.e(TAG, "Widget-Konfiguration konnte nicht exportiert werden.", backupError);
                                    response.put("ok", false);
                                    response.put("error", "Die Android-Widget-Konfiguration konnte nicht ausgelesen werden.");
                                }
                                replyToBridge(replyProxy, response);
                            } else if ("widget.yearStats.backup.restore".equals(type)) {
                                JSONObject response = createGalleryResponse("widget.yearStats.backup.result", requestId);
                                boolean restored = false;
                                try {
                                    restored = YearStatsWidgetProvider.restoreConfiguration(
                                            MainActivity.this, request.optJSONObject("configuration"));
                                    response.put("ok", restored);
                                    response.put("widgetCount", YearStatsWidgetProvider.getInstalledWidgetCount(MainActivity.this));
                                    if (!restored) {
                                        response.put("error", "Die Widget-Konfiguration in der Sicherungsdatei ist ungültig.");
                                    }
                                } catch (RuntimeException backupError) {
                                    Log.e(TAG, "Widget-Konfiguration konnte nicht wiederhergestellt werden.", backupError);
                                    response.put("ok", false);
                                    response.put("error", "Die Android-Widget-Konfiguration konnte nicht wiederhergestellt werden.");
                                }
                                replyToBridge(replyProxy, response);
                            } else if ("widget.yearStats.update".equals(type)) {
                                int year = request.optInt("year", -1);
                                int tours = request.optInt("tours", -1);
                                double distance = request.optDouble("distance", Double.NaN);
                                double ascent = request.optDouble("ascent", Double.NaN);
                                long peaks = request.optLong("peaks", -1L);
                                long steps = request.optLong("steps", -1L);
                                long walkingMinutes = request.optLong("walkingMinutes", -1L);
                                double avgSpeed = request.optDouble("avgSpeed", 0d);
                                double avgGradient = request.optDouble("avgGradient", 0d);
                                double avgAscentRate = request.optDouble("avgAscentRate", 0d);
                                String accent = request.optString("accent", "#ad7d12");

                                if (year >= 2000 && year <= 9999
                                        && tours >= 0
                                        && Double.isFinite(distance) && distance >= 0
                                        && Double.isFinite(ascent) && ascent >= 0
                                        && peaks >= 0 && steps >= 0 && walkingMinutes >= 0
                                        && Double.isFinite(avgSpeed) && avgSpeed >= 0
                                        && Double.isFinite(avgGradient) && avgGradient >= 0
                                        && Double.isFinite(avgAscentRate) && avgAscentRate >= 0
                                        && accent.matches("#[0-9a-fA-F]{6}")) {
                                    YearStatsWidgetProvider.updateStats(
                                            MainActivity.this, year, tours, distance, ascent,
                                            peaks, steps, walkingMinutes, avgSpeed, avgGradient,
                                            avgAscentRate, accent);
                                } else {
                                    Log.w(TAG, "Ungültige Jahresstatistik für das Widget verworfen.");
                                }
                            } else {
                                Log.w(TAG, "Unbekannte Bridge-Nachricht verworfen.");
                            }
                        } catch (JSONException error) {
                            Log.w(TAG, "Ungültige Bridge-Nachricht verworfen.", error);
                        }
                    }
                }
        );

        bridgeAvailable = true;
    }

    
    private void replyBackupExport(
            JavaScriptReplyProxy replyProxy,
            String responseType,
            String requestId,
            boolean ok,
            String error
    ) {
        JSONObject response = createGalleryResponse(responseType, requestId);
        try {
            response.put("ok", ok);
            if (error != null && !error.isEmpty()) {
                response.put("error", error);
            }
        } catch (JSONException serializationError) {
            Log.e(TAG, "Backup-Antwort konnte nicht serialisiert werden.", serializationError);
        }
        replyToBridge(replyProxy, response);
    }

    private void startBackupExport(
            JSONObject request,
            JavaScriptReplyProxy replyProxy,
            String requestId
    ) {
        if (pendingBackupStream != null) {
            replyBackupExport(replyProxy, "backup.export.error", requestId,
                    false, "Ein anderer Sicherungsvorgang ist noch aktiv.");
            return;
        }

        String transferId = request.optString("transferId", "");
        String fileName = request.optString("fileName", "Touren-Backup.json");
        String mimeType = request.optString("mimeType", "application/json");
        int totalBytes = request.optInt("totalBytes", -1);
        int totalChunks = request.optInt("totalChunks", -1);

        int maxAllowedBytes = "application/pdf".equals(mimeType)
                ? MAX_PDF_BYTES : MAX_BACKUP_BYTES;
        if (transferId.isEmpty() || transferId.length() > 100
                || totalBytes <= 0 || totalBytes > maxAllowedBytes
                || totalChunks <= 0 || totalChunks > MAX_BACKUP_CHUNKS
                || !fileName.matches("[A-Za-z0-9._-]{1,80}")
                || (!"application/json".equals(mimeType) && !"application/pdf".equals(mimeType))
                || ("application/pdf".equals(mimeType) && !fileName.endsWith(".pdf"))) {
            replyBackupExport(replyProxy, "backup.export.error", requestId,
                    false, "Die Sicherungsdaten sind ungültig oder überschreiten die erlaubte Größe.");
            return;
        }

        pendingBackupTransferId = transferId;
        String targetUriValue = request.optString("targetUri", "");
        Uri targetUri = null;
        if (!targetUriValue.isEmpty()) {
            targetUri = Uri.parse(targetUriValue);
            if (!"content".equalsIgnoreCase(targetUri.getScheme()) || targetUriValue.length() > 2048) {
                replyBackupExport(replyProxy, "backup.export.error", requestId,
                        false, "Die ausgewählte Sicherungsdatei ist ungültig.");
                return;
            }
        }

        pendingBackupFileName = fileName;
        pendingBackupMimeType = mimeType;
        pendingBackupTargetUri = targetUri;
        pendingBackupLinkOnSave = request.optBoolean("linkOnSave", false);
        pendingBackupExpectedBytes = totalBytes;
        pendingBackupExpectedChunks = totalChunks;
        pendingBackupNextChunk = 0;
        pendingBackupStream = new ByteArrayOutputStream(Math.min(totalBytes, 1024 * 1024));

        replyBackupExport(replyProxy, "backup.export.ready", requestId, true, null);
    }

    private void appendBackupExportChunk(
            JSONObject request,
            JavaScriptReplyProxy replyProxy,
            String requestId
    ) {
        String transferId = request.optString("transferId", "");
        int index = request.optInt("index", -1);
        String encoded = request.optString("data", "");

        if (pendingBackupStream == null
                || !pendingBackupTransferId.equals(transferId)
                || index != pendingBackupNextChunk
                || encoded.isEmpty()
                || encoded.length() > MAX_BACKUP_CHUNK_CHARS
                || !encoded.matches("[A-Za-z0-9+/]*={0,2}")) {
            replyBackupExport(replyProxy, "backup.export.error", requestId,
                    false, "Ein Sicherungsteil ist ungültig oder unvollständig.");
            clearBackupExportState();
            return;
        }

        try {
            byte[] decoded = Base64.decode(encoded, Base64.NO_WRAP);
            if (decoded.length == 0
                    || pendingBackupStream.size() + decoded.length > pendingBackupExpectedBytes) {
                throw new IllegalArgumentException("Ungültige Länge eines Sicherungsteils.");
            }

            pendingBackupStream.write(decoded);
            pendingBackupNextChunk++;
            replyBackupExport(replyProxy, "backup.export.chunk.ack", requestId, true, null);
        } catch (IllegalArgumentException | IOException error) {
            Log.w(TAG, "Sicherungsteil konnte nicht verarbeitet werden.", error);
            replyBackupExport(replyProxy, "backup.export.error", requestId,
                    false, "Die Sicherungsdaten konnten nicht übertragen werden.");
            clearBackupExportState();
        }
    }

    private void finishBackupExport(
            JSONObject request,
            JavaScriptReplyProxy replyProxy,
            String requestId
    ) {
        String transferId = request.optString("transferId", "");
        if (pendingBackupStream == null
                || !pendingBackupTransferId.equals(transferId)
                || pendingBackupNextChunk != pendingBackupExpectedChunks
                || pendingBackupStream.size() != pendingBackupExpectedBytes) {
            replyBackupExport(replyProxy, "backup.export.error", requestId,
                    false, "Die Sicherungsdatei wurde nicht vollständig übertragen.");
            clearBackupExportState();
            return;
        }

        pendingBackupFinishReply = replyProxy;
        pendingBackupFinishRequestId = requestId;
        if (pendingBackupTargetUri != null) {
            saveBackupToExistingUri(pendingBackupTargetUri, replyProxy, requestId);
            return;
        }
        runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(pendingBackupMimeType != null ? pendingBackupMimeType : "application/json");
                intent.putExtra(Intent.EXTRA_TITLE, pendingBackupFileName);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(intent, BACKUP_SAVE_REQUEST_CODE);
            } catch (RuntimeException error) {
                Log.e(TAG, "Android-Speicherdialog für die Sicherung konnte nicht geöffnet werden.", error);
                replyBackupExport(pendingBackupFinishReply, "backup.export.error",
                        pendingBackupFinishRequestId, false,
                        "Der Android-Speicherdialog konnte nicht geöffnet werden.");
                clearBackupExportState();
            }
        });
    }

    private void abortBackupExport(
            JSONObject request,
            JavaScriptReplyProxy replyProxy,
            String requestId
    ) {
        String transferId = request.optString("transferId", "");
        if (pendingBackupTransferId != null
                && pendingBackupTransferId.equals(transferId)
                && pendingBackupFinishReply == null) {
            clearBackupExportState();
            replyBackupExport(replyProxy, "backup.export.aborted", requestId, true, null);
        } else {
            replyBackupExport(replyProxy, "backup.export.error", requestId,
                    false, "Der Sicherungsvorgang kann nicht mehr abgebrochen werden.");
        }
    }

    private void handleBackupSaveResult(int resultCode, Intent data) {
        JavaScriptReplyProxy reply = pendingBackupFinishReply;
        String requestId = pendingBackupFinishRequestId;
        String fileName = pendingBackupFileName;

        if (reply == null || requestId == null) {
            clearBackupExportState();
            return;
        }

        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            replyBackupExport(reply, "backup.export.cancelled", requestId, true, null);
            clearBackupExportState();
            return;
        }

        Uri destination = data.getData();
        if (pendingBackupLinkOnSave) {
            int grantedFlags = data.getFlags() & (
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
            if ((grantedFlags & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == 0) {
                replyBackupExport(reply, "backup.export.error", requestId, false,
                        "Android hat keinen dauerhaften Schreibzugriff auf die neue Datei freigegeben.");
                clearBackupExportState();
                return;
            }
            try {
                getContentResolver().takePersistableUriPermission(destination, grantedFlags);
            } catch (SecurityException error) {
                Log.e(TAG, "Neue Sicherungsdatei konnte nicht dauerhaft verknüpft werden.", error);
                replyBackupExport(reply, "backup.export.error", requestId, false,
                        "Der dauerhafte Zugriff auf die neue Sicherungsdatei konnte nicht gespeichert werden.");
                clearBackupExportState();
                return;
            }
        }

        try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
            if (output == null) {
                throw new IOException("Der Zieldateistream konnte nicht geöffnet werden.");
            }
            pendingBackupStream.writeTo(output);
            output.flush();

            JSONObject response = createGalleryResponse("backup.export.complete", requestId);
            try {
                response.put("ok", true);
                response.put("fileName", fileName);
                if (pendingBackupLinkOnSave) response.put("uri", destination.toString());
            } catch (JSONException serializationError) {
                Log.e(TAG, "Backup-Erfolgsantwort konnte nicht erstellt werden.", serializationError);
            }
            replyToBridge(reply, response);
        } catch (IOException | RuntimeException error) {
            Log.e(TAG, "JSON-Sicherung konnte nicht auf dem Gerät gespeichert werden.", error);
            replyBackupExport(reply, "backup.export.error", requestId,
                    false, "Die Sicherungsdatei konnte nicht geschrieben werden.");
        } finally {
            clearBackupExportState();
        }
    }

    private void clearBackupExportState() {
        if (pendingBackupStream != null) {
            try {
                pendingBackupStream.close();
            } catch (IOException ignored) {
                // ByteArrayOutputStream benötigt keinen nativen Deskriptor.
            }
        }
        pendingBackupStream = null;
        pendingBackupTransferId = null;
        pendingBackupFileName = null;
        pendingBackupMimeType = null;
        pendingBackupTargetUri = null;
        pendingBackupLinkOnSave = false;
        pendingBackupExpectedBytes = 0;
        pendingBackupExpectedChunks = 0;
        pendingBackupNextChunk = 0;
        pendingBackupFinishReply = null;
        pendingBackupFinishRequestId = null;
    }


    private void saveBackupToExistingUri(
            Uri destination,
            JavaScriptReplyProxy replyProxy,
            String requestId
    ) {
        final byte[] backupBytes = pendingBackupStream.toByteArray();
        final String fileName = pendingBackupFileName;
        final boolean linkOnSave = pendingBackupLinkOnSave;

        galleryExecutor.execute(() -> {
            JSONObject response = createGalleryResponse("backup.export.complete", requestId);
            try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) {
                    throw new IOException("Der Zieldateistream konnte nicht geöffnet werden.");
                }
                output.write(backupBytes);
                output.flush();
                response.put("ok", true);
                response.put("fileName", fileName);
                if (linkOnSave) response.put("uri", destination.toString());
            } catch (Exception error) {
                Log.e(TAG, "Bestehende JSON-Sicherung konnte nicht überschrieben werden.", error);
                response = createGalleryResponse("backup.export.error", requestId);
                try {
                    response.put("ok", false);
                    response.put("error", "Die bestehende Sicherungsdatei konnte nicht überschrieben werden. Prüfe den Schreibzugriff.");
                } catch (JSONException serializationError) {
                    Log.e(TAG, "Backup-Fehlerantwort konnte nicht erstellt werden.", serializationError);
                }
            }

            JSONObject finalResponse = response;
            mainHandler.post(() -> {
                replyToBridge(replyProxy, finalResponse);
                clearBackupExportState();
            });
        });
    }

    private void openBackupFilePicker(
            JavaScriptReplyProxy replyProxy,
            String requestId
    ) {
        runOnUiThread(() -> {
            if (pendingBackupOpenReply != null) {
                replyBackupFileError(replyProxy, requestId,
                        "Eine Dateiauswahl ist bereits geöffnet.");
                return;
            }

            pendingBackupOpenReply = replyProxy;
            pendingBackupOpenRequestId = requestId;

            try {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                startActivityForResult(intent, BACKUP_OPEN_REQUEST_CODE);
            } catch (RuntimeException error) {
                Log.e(TAG, "Android-Dateiauswahl für eine bestehende Sicherung konnte nicht geöffnet werden.", error);
                pendingBackupOpenReply = null;
                pendingBackupOpenRequestId = null;
                replyBackupFileError(replyProxy, requestId,
                        "Die Android-Dateiauswahl konnte nicht geöffnet werden.");
            }
        });
    }

    private void readBackupFile(
            JSONObject request,
            JavaScriptReplyProxy replyProxy,
            String requestId
    ) {
        String uriValue = request.optString("uri", "");
        Uri uri = Uri.parse(uriValue);
        if (uriValue.isEmpty() || uriValue.length() > 2048
                || !"content".equalsIgnoreCase(uri.getScheme())) {
            replyBackupFileError(replyProxy, requestId,
                    "Die verknüpfte Sicherungsdatei ist ungültig.");
            return;
        }
        sendBackupFileContents(replyProxy, requestId, uri);
    }

    private void handleBackupOpenResult(int resultCode, Intent data) {
        JavaScriptReplyProxy reply = pendingBackupOpenReply;
        String requestId = pendingBackupOpenRequestId;
        pendingBackupOpenReply = null;
        pendingBackupOpenRequestId = null;

        if (reply == null || requestId == null) return;

        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            JSONObject cancelled = createGalleryResponse("backup.file.read.complete", requestId);
            try {
                cancelled.put("ok", true);
                cancelled.put("cancelled", true);
            } catch (JSONException error) {
                Log.w(TAG, "Abbruchantwort für Dateiauswahl konnte nicht erstellt werden.", error);
            }
            replyToBridge(reply, cancelled);
            return;
        }

        Uri uri = data.getData();
        int grantedFlags = data.getFlags() & (
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        );
        if ((grantedFlags & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == 0) {
            replyBackupFileError(reply, requestId,
                    "Android hat für diese Datei keinen Schreibzugriff freigegeben. Bitte wähle eine beschreibbare JSON-Datei.");
            return;
        }

        try {
            getContentResolver().takePersistableUriPermission(uri, grantedFlags);
        } catch (SecurityException error) {
            Log.e(TAG, "Dateizugriff konnte nicht dauerhaft freigegeben werden.", error);
            replyBackupFileError(reply, requestId,
                    "Der Zugriff auf diese Sicherungsdatei konnte nicht dauerhaft gespeichert werden.");
            return;
        }

        sendBackupFileContents(reply, requestId, uri);
    }

    private void sendBackupFileContents(
            JavaScriptReplyProxy replyProxy,
            String requestId,
            Uri uri
    ) {
        galleryExecutor.execute(() -> {
            byte[] contents;
            String fileName;
            try {
                fileName = getBackupDisplayName(uri);
                try (InputStream input = getContentResolver().openInputStream(uri);
                     ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    if (input == null) {
                        throw new IOException("Die ausgewählte Datei konnte nicht geöffnet werden.");
                    }
                    byte[] buffer = new byte[32 * 1024];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        if (output.size() + read > MAX_BACKUP_BYTES) {
                            throw new IOException("Die Sicherungsdatei überschreitet 48 MB.");
                        }
                        output.write(buffer, 0, read);
                    }
                    contents = output.toByteArray();
                }
                if (contents.length == 0) {
                    throw new IOException("Die ausgewählte Sicherungsdatei ist leer.");
                }
            } catch (Exception error) {
                Log.e(TAG, "Bestehende JSON-Sicherung konnte nicht gelesen werden.", error);
                mainHandler.post(() -> replyBackupFileError(replyProxy, requestId,
                        "Die Sicherungsdatei konnte nicht gelesen werden. Prüfe, ob sie zugänglich und höchstens 48 MB groß ist."));
                return;
            }

            final byte[] fileBytes = contents;
            final String displayName = fileName;
            mainHandler.post(() -> {
                JSONObject start = createGalleryResponse("backup.file.read.start", requestId);
                try {
                    start.put("ok", true);
                    start.put("uri", uri.toString());
                    start.put("fileName", displayName);
                    start.put("totalBytes", fileBytes.length);
                } catch (JSONException error) {
                    Log.e(TAG, "Datei-Lesekopf konnte nicht serialisiert werden.", error);
                    replyBackupFileError(replyProxy, requestId, "Die Sicherungsdatei konnte nicht vorbereitet werden.");
                    return;
                }
                replyToBridge(replyProxy, start);

                final int chunkBytes = 36 * 1024;
                for (int offset = 0; offset < fileBytes.length; offset += chunkBytes) {
                    int length = Math.min(chunkBytes, fileBytes.length - offset);
                    JSONObject chunk = createGalleryResponse("backup.file.read.chunk", requestId);
                    try {
                        chunk.put("data", Base64.encodeToString(
                                fileBytes, offset, length, Base64.NO_WRAP
                        ));
                    } catch (JSONException error) {
                        Log.e(TAG, "Sicherungsteil konnte nicht serialisiert werden.", error);
                        replyBackupFileError(replyProxy, requestId, "Die Sicherungsdatei konnte nicht vollständig übertragen werden.");
                        return;
                    }
                    replyToBridge(replyProxy, chunk);
                }

                JSONObject complete = createGalleryResponse("backup.file.read.complete", requestId);
                try {
                    complete.put("ok", true);
                } catch (JSONException error) {
                    Log.e(TAG, "Datei-Abschlussantwort konnte nicht serialisiert werden.", error);
                }
                replyToBridge(replyProxy, complete);
            });
        });
    }

    private String getBackupDisplayName(Uri uri) {
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                    uri,
                    new String[] { OpenableColumns.DISPLAY_NAME },
                    null,
                    null,
                    null
            );
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String name = cursor.getString(nameIndex);
                    if (name != null && !name.trim().isEmpty()) return name;
                }
            }
        } catch (RuntimeException error) {
            Log.w(TAG, "Name der Sicherungsdatei konnte nicht ermittelt werden.", error);
        } finally {
            if (cursor != null) cursor.close();
        }
        String fallback = uri.getLastPathSegment();
        return fallback == null || fallback.isEmpty() ? "Touren-Backup.json" : fallback;
    }

    private void replyBackupFileError(
            JavaScriptReplyProxy replyProxy,
            String requestId,
            String message
    ) {
        JSONObject response = createGalleryResponse("backup.file.read.error", requestId);
        try {
            response.put("ok", false);
            response.put("error", message);
        } catch (JSONException error) {
            Log.e(TAG, "Datei-Fehlerantwort konnte nicht serialisiert werden.", error);
        }
        replyToBridge(replyProxy, response);
    }

    private void replyToBridge(JavaScriptReplyProxy replyProxy, JSONObject response) {
        if (replyProxy == null || response == null) {
            return;
        }
        try {
            replyProxy.postMessage(response.toString());
        } catch (RuntimeException error) {
            Log.w(TAG, "Native Antwort konnte nicht an die Web-App gesendet werden.", error);
        }
    }

    private JSONObject createGalleryResponse(String type, String requestId) {
        JSONObject response = new JSONObject();
        try {
            response.put("type", type);
            if (requestId != null && !requestId.isEmpty()) {
                response.put("requestId", requestId);
            }
        } catch (JSONException error) {
            Log.e(TAG, "Native Galerieantwort konnte nicht vorbereitet werden.", error);
        }
        return response;
    }

    private void replyGalleryPermissionState(JavaScriptReplyProxy replyProxy, String requestId) {
        String access = GalleryMediaStore.getAccessState(this);
        JSONObject response = createGalleryResponse("gallery.permission.result", requestId);
        try {
            response.put("access", access);
            response.put("canSearchEntireLibrary", GalleryMediaStore.ACCESS_FULL.equals(access));
        } catch (JSONException error) {
            Log.e(TAG, "Berechtigungsstatus konnte nicht serialisiert werden.", error);
        }
        replyToBridge(replyProxy, response);
    }

    private void requestGalleryPermission(JavaScriptReplyProxy replyProxy, String requestId) {
        runOnUiThread(() -> {
            String access = GalleryMediaStore.getAccessState(this);
            if (GalleryMediaStore.ACCESS_FULL.equals(access)) {
                replyGalleryPermissionState(replyProxy, requestId);
                return;
            }

            if (pendingGalleryPermissionReply != null) {
                JSONObject busy = createGalleryResponse("gallery.permission.result", requestId);
                try {
                    busy.put("access", access);
                    busy.put("canSearchEntireLibrary", false);
                    busy.put("status", "request_in_progress");
                } catch (JSONException error) {
                    Log.e(TAG, "Berechtigungsantwort konnte nicht serialisiert werden.", error);
                }
                replyToBridge(replyProxy, busy);
                return;
            }

            pendingGalleryPermissionReply = replyProxy;
            pendingGalleryPermissionRequestId = requestId;

            String[] permissions;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                permissions = new String[] {
                        Manifest.permission.READ_MEDIA_IMAGES,
                        Manifest.permission.READ_MEDIA_VIDEO,
                        Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
                };
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissions = new String[] {
                        Manifest.permission.READ_MEDIA_IMAGES,
                        Manifest.permission.READ_MEDIA_VIDEO
                };
            } else {
                permissions = new String[] {
                        Manifest.permission.READ_EXTERNAL_STORAGE
                };
            }

            requestPermissions(permissions, GALLERY_PERMISSION_REQUEST_CODE);
        });
    }

    private void queryGalleryMediaForDate(
            JavaScriptReplyProxy replyProxy,
            String requestId,
            String date
    ) {
        if (date == null || date.length() != 10) {
            JSONObject error = createGalleryResponse("gallery.media.result", requestId);
            try {
                error.put("status", "invalid_date");
                error.put("message", "Das Datum muss im Format JJJJ-MM-TT vorliegen.");
            } catch (JSONException jsonError) {
                Log.e(TAG, "Fehlerantwort konnte nicht serialisiert werden.", jsonError);
            }
            replyToBridge(replyProxy, error);
            return;
        }

        galleryExecutor.execute(() -> {
            JSONObject response;
            try {
                response = GalleryMediaStore.queryMediaForLocalDate(getApplicationContext(), date);
                response.put("type", "gallery.media.result");
                if (requestId != null && !requestId.isEmpty()) {
                    response.put("requestId", requestId);
                }
            } catch (Exception error) {
                Log.e(TAG, "Medienabfrage für " + date + " fehlgeschlagen.", error);
                response = createGalleryResponse("gallery.media.result", requestId);
                try {
                    response.put("status", "query_failed");
                    response.put("message", "Fotos und Videos für dieses Datum konnten nicht gelesen werden.");
                } catch (JSONException jsonError) {
                    Log.e(TAG, "Fehlerantwort konnte nicht serialisiert werden.", jsonError);
                }
            }

            JSONObject finalResponse = response;
            mainHandler.post(() -> replyToBridge(replyProxy, finalResponse));
        });
    }

    private void queryGalleryThumbnail(
            JavaScriptReplyProxy replyProxy,
            String requestId,
            String uri
    ) {
        if (uri == null || uri.isEmpty() || uri.length() > 512) {
            JSONObject error = createGalleryResponse("gallery.thumbnail.result", requestId);
            try {
                error.put("status", "invalid_uri");
            } catch (JSONException jsonError) {
                Log.e(TAG, "Thumbnail-Fehlerantwort konnte nicht serialisiert werden.", jsonError);
            }
            replyToBridge(replyProxy, error);
            return;
        }

        galleryExecutor.execute(() -> {
            JSONObject response;
            try {
                response = GalleryMediaStore.loadThumbnailBase64(
                        getApplicationContext(),
                        uri
                );
                response.put("type", "gallery.thumbnail.result");
                if (requestId != null && !requestId.isEmpty()) {
                    response.put("requestId", requestId);
                }
            } catch (Exception error) {
                Log.w(TAG, "Galerie-Vorschau konnte nicht geladen werden.", error);
                response = createGalleryResponse("gallery.thumbnail.result", requestId);
                try {
                    response.put("status", "thumbnail_failed");
                } catch (JSONException jsonError) {
                    Log.e(TAG, "Thumbnail-Fehlerantwort konnte nicht serialisiert werden.", jsonError);
                }
            }

            JSONObject finalResponse = response;
            mainHandler.post(() -> replyToBridge(replyProxy, finalResponse));
        });
    }

    private void queryGalleryFullImage(
            JavaScriptReplyProxy replyProxy,
            String requestId,
            String uri
    ) {
        if (uri == null || uri.isEmpty() || uri.length() > 512) {
            JSONObject error = createGalleryResponse("gallery.image.full.result", requestId);
            try {
                error.put("status", "invalid_uri");
            } catch (JSONException jsonError) {
                Log.e(TAG, "Vollbild-Fehlerantwort konnte nicht serialisiert werden.", jsonError);
            }
            replyToBridge(replyProxy, error);
            return;
        }

        galleryExecutor.execute(() -> {
            JSONObject response;
            try {
                response = GalleryMediaStore.loadFullImageBase64(getApplicationContext(), uri);
                response.put("type", "gallery.image.full.result");
                if (requestId != null && !requestId.isEmpty()) response.put("requestId", requestId);
            } catch (Exception error) {
                Log.w(TAG, "Vollbildfoto konnte nicht geladen werden.", error);
                response = createGalleryResponse("gallery.image.full.result", requestId);
                try {
                    response.put("status", "image_failed");
                } catch (JSONException jsonError) {
                    Log.e(TAG, "Vollbild-Fehlerantwort konnte nicht serialisiert werden.", jsonError);
                }
            }
            JSONObject finalResponse = response;
            mainHandler.post(() -> replyToBridge(replyProxy, finalResponse));
        });
    }

    private void launchGalleryVideo(
            JavaScriptReplyProxy replyProxy,
            String requestId,
            String uriString
    ) {
        runOnUiThread(() -> {
            JSONObject response = createGalleryResponse("gallery.video.play.result", requestId);
            try {
                Uri uri = Uri.parse(uriString == null ? "" : uriString);
                if (!GalleryMediaStore.isAllowedVideoUri(uri)) {
                    response.put("status", "invalid_uri");
                } else if (!GalleryMediaStore.hasVideoAccess(this)) {
                    response.put("status", "permission_required");
                } else {
                    Intent intent = new Intent(this, GalleryVideoActivity.class);
                    intent.putExtra(GalleryVideoActivity.EXTRA_URI, uri.toString());
                    startActivity(intent);
                    response.put("status", "started");
                }
            } catch (Exception error) {
                Log.w(TAG, "Video-Player konnte nicht geöffnet werden.", error);
                try {
                    response.put("status", "player_failed");
                } catch (JSONException jsonError) {
                    Log.e(TAG, "Player-Fehlerantwort konnte nicht serialisiert werden.", jsonError);
                }
            }
            replyToBridge(replyProxy, response);
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != GALLERY_PERMISSION_REQUEST_CODE) {
            return;
        }

        JavaScriptReplyProxy replyProxy = pendingGalleryPermissionReply;
        String requestId = pendingGalleryPermissionRequestId;
        pendingGalleryPermissionReply = null;
        pendingGalleryPermissionRequestId = null;
        pendingBackupOpenReply = null;
        pendingBackupOpenRequestId = null;

        if (replyProxy == null) {
            return;
        }

        String access = GalleryMediaStore.getAccessState(this);
        JSONObject response = createGalleryResponse("gallery.permission.result", requestId);
        try {
            response.put("access", access);
            response.put("canSearchEntireLibrary", GalleryMediaStore.ACCESS_FULL.equals(access));
            response.put("granted", !GalleryMediaStore.ACCESS_NONE.equals(access));
        } catch (JSONException error) {
            Log.e(TAG, "Berechtigungsergebnis konnte nicht serialisiert werden.", error);
        }
        replyToBridge(replyProxy, response);
    }

    private void sendBridgeHandshake() {
        if (!bridgeAvailable || webView == null) {
            return;
        }

        String javascript =
                "(function(){"
                        + "try{"
                        + "if(window." + BRIDGE_NAME
                        + "&&typeof window." + BRIDGE_NAME + ".postMessage==='function'){"
                        + "window." + BRIDGE_NAME
                        + ".postMessage(JSON.stringify({type:'bridge.ping'}));"
                        + "return 'sent';"
                        + "}"
                        + "}catch(e){}"
                        + "return 'unavailable';"
                        + "})();";

        webView.evaluateJavascript(javascript, result ->
                Log.d(TAG, "Bridge handshake: " + result)
        );
    }

    private boolean isTrustedAppUrl(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) {
            return false;
        }

        String origin = uri.getScheme() + "://" + uri.getAuthority();
        if (!APP_ORIGIN.equalsIgnoreCase(origin)) {
            return false;
        }

        String path = uri.getPath();
        if (path == null) {
            return false;
        }

        String baseWithoutSlash = APP_BASE_PATH.endsWith("/")
                ? APP_BASE_PATH.substring(0, APP_BASE_PATH.length() - 1)
                : APP_BASE_PATH;

        return path.equals(baseWithoutSlash) || path.startsWith(APP_BASE_PATH);
    }

    private static String normalizeBasePath(String path) {
        if (path == null || path.isEmpty()) {
            return "/";
        }
        return path.endsWith("/") ? path : path + "/";
    }

    private void openExternalUri(Uri uri) {
        if (uri == null) {
            return;
        }

        String scheme = uri.getScheme();
        if (scheme == null) {
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
        } catch (ActivityNotFoundException error) {
            Log.w(TAG, "Kein Handler für externen Link: " + uri, error);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == BACKUP_SAVE_REQUEST_CODE) {
            handleBackupSaveResult(resultCode, data);
            return;
        }

        if (requestCode == BACKUP_OPEN_REQUEST_CODE) {
            handleBackupOpenResult(resultCode, data);
            return;
        }

        if (requestCode == FILE_CHOOSER_REQUEST_CODE && pendingFileChooser != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            pendingFileChooser.onReceiveValue(result);
            pendingFileChooser = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
            webView.saveState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBackNavigation();
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && isWidgetDashboardAction(intent.getAction())) {
            pendingOpenDashboard = true;
            deliverPendingDashboardWidgetNavigation();
        }
    }

    private boolean isWidgetDashboardAction(String action) {
        // Die alte Action bleibt als Kompatibilität für bereits angelegte Widgets
        // erhalten. Auch diese öffnen ab jetzt das Dashboard statt der Statistik.
        return ACTION_OPEN_DASHBOARD.equals(action)
                || ACTION_OPEN_YEAR_STATS.equals(action);
    }

    private void deliverPendingDashboardWidgetNavigation() {
        if (!pendingOpenDashboard || !webPageLoaded || webView == null) return;

        webView.evaluateJavascript(
                "(function(){try{"
                        + "if(typeof window.__openDashboardFromNativeWidget==='function'){"
                        + "return window.__openDashboardFromNativeWidget();"
                        + "}}catch(e){}return 'unavailable';})()",
                result -> {
                    if (result != null && (result.contains("opened") || result.contains("queued"))) {
                        pendingOpenDashboard = false;
                    } else {
                        Log.w(TAG, "Dashboard-Navigation aus dem Widget ist noch nicht verfügbar.");
                    }
                }
        );
    }
    @Override
    protected void onDestroy() {
        if (premiumSplashSheenAnimator != null) {
            premiumSplashSheenAnimator.cancel();
            premiumSplashSheenAnimator = null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && backInvokedCallback != null) {
            Api33Back.unregister(this, backInvokedCallback);
            backInvokedCallback = null;
        }

        if (pendingFileChooser != null) {
            pendingFileChooser.onReceiveValue(null);
            pendingFileChooser = null;
        }

        pendingGalleryPermissionReply = null;
        pendingGalleryPermissionRequestId = null;
        galleryExecutor.shutdownNow();

        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    // API-33-Typen bleiben in einer eigenen Klasse, damit ältere Android-
    // Versionen diese Typen beim Laden der Activity nicht auflösen müssen.
    private static final class Api33Back {
        @TargetApi(Build.VERSION_CODES.TIRAMISU)
        static Object register(Activity activity, Runnable action) {
            android.window.OnBackInvokedCallback callback = action::run;
            activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    callback
            );
            return callback;
        }

        @TargetApi(Build.VERSION_CODES.TIRAMISU)
        static void unregister(Activity activity, Object callback) {
            activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(
                    (android.window.OnBackInvokedCallback) callback
            );
        }
    }
}
