package at.marcel.bergtouren;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
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
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String TAG = "BergtourenAndroid";
    private static final int FILE_CHOOSER_REQUEST_CODE = 4102;
    private static final int GALLERY_PERMISSION_REQUEST_CODE = 4203;
    private static final String BRIDGE_NAME = "TourNative";

    private static final Uri APP_URI = Uri.parse(BuildConfig.WEB_APP_URL);
    private static final String APP_ORIGIN =
            APP_URI.getScheme() + "://" + APP_URI.getAuthority();
    private static final String APP_BASE_PATH = normalizeBasePath(APP_URI.getPath());

    private WebView webView;
    private FrameLayout root;
    private ProgressBar progressBar;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> pendingFileChooser;
    private boolean bridgeAvailable;
    private Object backInvokedCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService galleryExecutor = Executors.newSingleThreadExecutor();
    private JavaScriptReplyProxy pendingGalleryPermissionReply;
    private String pendingGalleryPermissionRequestId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

    private void createWebViewLayout() {
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11, 15, 20));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
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
        root.addView(webView);

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
        root.addView(progressBar, progressParams);

        errorPanel = createErrorPanel();
        errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

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

                progressBar.setVisibility(View.GONE);
                sendBridgeHandshake();
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
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
                        if (data == null || data.length() > 1024) {
                            return;
                        }

                        try {
                            JSONObject request = new JSONObject(data);
                            String type = request.optString("type", "");
                            String requestId = request.optString("requestId", "");

                            if ("bridge.ping".equals(type)) {
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
    protected void onDestroy() {
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
