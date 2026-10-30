package at.marcel.bergtouren;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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

public final class MainActivity extends Activity {
    private static final String TAG = "BergtourenAndroid";
    private static final int FILE_CHOOSER_REQUEST_CODE = 4102;
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
                            if (!"bridge.ping".equals(request.optString("type"))) {
                                Log.w(TAG, "Unbekannte Bridge-Nachricht verworfen.");
                                return;
                            }

                            JSONObject response = new JSONObject();
                            response.put("type", "bridge.pong");
                            response.put("nativeVersion", BuildConfig.VERSION_NAME);
                            replyProxy.postMessage(response.toString());
                            Log.i(TAG, "Sichere JavaScript-Bridge ist erreichbar.");
                        } catch (JSONException error) {
                            Log.w(TAG, "Ungültige Bridge-Nachricht verworfen.", error);
                        }
                    }
                }
        );

        bridgeAvailable = true;
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
