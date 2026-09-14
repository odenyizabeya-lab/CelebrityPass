package com.celebritypass.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * CelebrityPass native shell.
 *
 * The product lives in a hosted Next.js app; this wrapper adds genuine native
 * behaviour on top of the WebView so the Android experience behaves like a real
 * app: WebView-history-aware back button, an offline connection screen with
 * retry, and recovery from WebView render-process crashes.
 */
public class MainActivity extends BridgeActivity {

    private static final String BRAND_BG = "#1E1B2E";
    private static final String ACCENT = "#7C3AED";
    private static final String MUTED = "#A1A1AA";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean doubleBackToExitPressedOnce = false;
    private View offlineView;

    @Override
    protected void load() {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                mainHandler.post(MainActivity.this::hideOffline);
            }

            @Override
            public void onPageLoaded(WebView webView) {
                mainHandler.post(MainActivity.this::hideOffline);
            }

            @Override
            public void onReceivedError(WebView webView) {
                mainHandler.post(MainActivity.this::updateOfflineState);
            }

            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                mainHandler.post(MainActivity.this::updateOfflineState);
                return false;
            }
        });

        super.load();

        // If the app launches without a connection, show the native offline screen
        // once the splash is out of the way instead of a bare WebView error page.
        mainHandler.postDelayed(() -> {
            if (!hasNetwork()) {
                showOffline();
            }
        }, 1600);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildOfflineView();
        watchNetworkChanges();
    }

    @Override
    public void onBackPressed() {
        WebView web = bridge != null ? bridge.getWebView() : null;
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }

        if (doubleBackToExitPressedOnce) {
            super.onBackPressed();
            return;
        }

        doubleBackToExitPressedOnce = true;
        Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
        mainHandler.postDelayed(() -> doubleBackToExitPressedOnce = false, 2000);
    }

    /**
     * React to connectivity changes. The WebView sits on top of the offline
     * overlay, so when a connection returns we simply hide it and let the page
     * continue; the Retry button is used when the user wants an immediate reload.
     */
    private void watchNetworkChanges() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) {
            return;
        }
        try {
            cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    mainHandler.post(MainActivity.this::hideOffline);
                }

                @Override
                public void onLost(Network network) {
                    mainHandler.post(MainActivity.this::updateOfflineState);
                }
            });
        } catch (SecurityException ignored) {
            // ACCESS_NETWORK_STATE deliberately absent — fall back to WebView errors.
        }
    }

    private boolean hasNetwork() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) {
            return false;
        }
        Network network = cm.getActiveNetwork();
        if (network == null) {
            return false;
        }
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    private void updateOfflineState() {
        if (hasNetwork()) {
            hideOffline();
        } else {
            showOffline();
        }
    }

    private void showOffline() {
        if (offlineView != null) {
            offlineView.setVisibility(View.VISIBLE);
        }
    }

    private void hideOffline() {
        if (offlineView != null) {
            offlineView.setVisibility(View.GONE);
        }
    }

    private void retryLoading() {
        hideOffline();
        WebView web = bridge != null ? bridge.getWebView() : null;
        if (web == null) {
            return;
        }
        if (web.getUrl() != null) {
            web.reload();
        } else if (bridge.getServerUrl() != null) {
            web.loadUrl(bridge.getServerUrl());
        }
    }

    private void buildOfflineView() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor(BRAND_BG));
        root.setPadding(dp(28), dp(28), dp(28), dp(28));

        TextView brand = new TextView(this);
        brand.setText("CelebrityPass");
        brand.setTextColor(Color.WHITE);
        brand.setTextSize(26);
        brand.setTypeface(brand.getTypeface(), Typeface.BOLD);
        root.addView(brand, wrapContent());

        TextView title = new TextView(this);
        title.setText("You're offline");
        title.setTextColor(Color.WHITE);
        title.setTextSize(18);
        title.setTypeface(title.getTypeface(), Typeface.BOLD);
        LinearLayout.LayoutParams titleLp = wrapContent();
        titleLp.topMargin = dp(24);
        root.addView(title, titleLp);

        TextView message = new TextView(this);
        message.setText("Connect to the internet to keep using CelebrityPass.");
        message.setTextColor(Color.parseColor(MUTED));
        message.setTextSize(15);
        message.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams msgLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        msgLp.topMargin = dp(12);
        root.addView(message, msgLp);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setTextColor(Color.WHITE);
        retry.setAllCaps(true);
        retry.setBackgroundColor(Color.parseColor(ACCENT));
        LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(dp(180), dp(48));
        btnLp.topMargin = dp(28);
        root.addView(retry, btnLp);
        retry.setOnClickListener(v -> retryLoading());

        offlineView = root;
        offlineView.setVisibility(View.GONE);
        addContentView(offlineView, matchParent());
    }

    private LinearLayout.LayoutParams wrapContent() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams matchParent() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}