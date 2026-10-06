package com.kcoai.app;

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
 *
 * The previous version of this file caused the "CelebrityPass keeps stopping"
 * crash. {@code onRenderProcessGone} returned {@code false}, which tells Android
 * "this app is not handling the crash" — and Android kills the entire app
 * process. The WebView render process dies routinely on memory-pressured devices
 * (and on some OEM WebView builds), so this reliably took the app down.
 */
public class MainActivity extends BridgeActivity {

    private static final String BRAND_BG = "#1E1B2E";
    private static final String ACCENT = "#7C3AED";
    private static final String MUTED = "#A1A1AA";

    /**
     * How many consecutive render-process deaths we will auto-recover from before
     * giving up and showing a manual retry. Without this ceiling a device that
     * crashes on every start would spawn a fresh Activity forever.
     */
    private static final int MAX_RENDER_RECOVERIES = 3;

    /**
     * Static so it survives {@link #recreate()}, which is exactly when we need it
     * to survive. Reset whenever a page loads successfully.
     */
    private static int consecutiveRenderDeaths = 0;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ConnectivityManager.NetworkCallback networkCallback;
    private boolean doubleBackToExitPressedOnce = false;

    /**
     * True once the WebView's render process has died. The WebView object itself
     * survives but is unusable: calling {@code reload()}, {@code canGoBack()} or
     * {@code goBack()} on it throws or hangs. Every touch point must check this.
     */
    private boolean renderProcessGone = false;

    private View offlineView;
    private TextView offlineTitle;
    private TextView offlineMessage;

    @Override
    protected void load() {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                postIfAlive(MainActivity.this::hideOffline);
            }

            @Override
            public void onPageLoaded(WebView webView) {
                consecutiveRenderDeaths = 0;
                postIfAlive(MainActivity.this::hideOffline);
            }

            @Override
            public void onReceivedError(WebView webView) {
                postIfAlive(MainActivity.this::updateOfflineState);
            }

            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                return handleRenderProcessGone();
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

    /**
     * Handles a dead WebView render process.
     *
     * <p>Returning {@code true} is the critical part: it claims the crash has
     * been handled, so Android does not tear down the app process. Returning
     * {@code false} was the bug behind the repeated "keeps stopping" dialogs.
     *
     * <p>Recovery itself cannot reuse the dead WebView, so the Activity is
     * recreated, which rebuilds the bridge and a fresh WebView. The work is
     * posted to the main looper because this callback arrives from the WebView
     * provider process and it is not safe to tear the Activity down inside it.
     */
    private boolean handleRenderProcessGone() {
        renderProcessGone = true;
        consecutiveRenderDeaths++;

        mainHandler.post(() -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            if (consecutiveRenderDeaths > MAX_RENDER_RECOVERIES) {
                // Recreating again would only loop, so stop guessing and let the
                // user decide when to try.
                showPanel(
                        "App restarted unexpectedly",
                        "CelebrityPass ran into a problem loading and has restarted a few times. Tap Retry to try again.");
                return;
            }
            hideOffline();
            recreate();
        });

        return true;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildOfflineView();
        watchNetworkChanges();
    }

    @Override
    public void onDestroy() {
        // Anything still queued (the startup check, the double-back timer, WebView
        // callbacks) would otherwise run against a destroyed Activity and Window.
        mainHandler.removeCallbacksAndMessages(null);
        unregisterNetworkCallback();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        WebView web = bridge != null ? bridge.getWebView() : null;
        // Never touch a WebView whose render process has died.
        if (web != null && !renderProcessGone) {
            try {
                if (web.canGoBack()) {
                    web.goBack();
                    return;
                }
            } catch (Throwable ignored) {
                // Treat an unusable WebView as "no history" and fall through.
            }
        }

        if (doubleBackToExitPressedOnce) {
            super.onBackPressed();
            return;
        }

        doubleBackToExitPressedOnce = true;
        Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
        mainHandler.postDelayed(() -> doubleBackToExitPressedOnce = false, 2000);
    }

    /** Runs a task on the main looper only while this Activity is usable. */
    private void postIfAlive(Runnable task) {
        mainHandler.post(() -> {
            if (isFinishing() || isDestroyed()) {
                return;
            }
            task.run();
        });
    }

    /**
     * React to connectivity changes. The WebView sits on top of the offline
     * overlay, so when a connection returns we simply hide it and let the page
     * continue; the Retry button is used when the user wants an immediate reload.
     *
     * <p>The callback is stored so it can be unregistered in {@link #onDestroy()}.
     * It previously leaked: the Activity stayed reachable for the life of the
     * process, and every configuration change registered another one.
     */
    private void watchNetworkChanges() {
        if (networkCallback != null) {
            return;
        }
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) {
            return;
        }
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                postIfAlive(MainActivity.this::hideOffline);
            }

            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                // Becoming validated is the real "the internet is back" signal;
                // onAvailable also fires for captive portals.
                if (caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
                    postIfAlive(MainActivity.this::hideOffline);
                }
            }

            @Override
            public void onLost(Network network) {
                postIfAlive(MainActivity.this::updateOfflineState);
            }
        };
        try {
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (SecurityException | IllegalStateException e) {
            // ACCESS_NETWORK_STATE is declared in the manifest, but some OEM builds
            // still refuse. Not fatal: the WebView error callback covers it.
            networkCallback = null;
        }
    }

    private void unregisterNetworkCallback() {
        if (networkCallback == null) {
            return;
        }
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            try {
                cm.unregisterNetworkCallback(networkCallback);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered.
            }
        }
        networkCallback = null;
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
        showPanel("You're offline", "Connect to the internet to keep using CelebrityPass.");
    }

    /** Shows the recovery panel with the given copy. */
    private void showPanel(String title, String message) {
        if (offlineView == null) {
            return;
        }
        offlineTitle.setText(title);
        offlineMessage.setText(message);
        offlineView.setVisibility(View.VISIBLE);
    }

    private void hideOffline() {
        if (offlineView != null) {
            offlineView.setVisibility(View.GONE);
        }
    }

    private void retryLoading() {
        hideOffline();

        if (renderProcessGone) {
            // reload() on a dead WebView is undefined behaviour and can crash
            // again. A recreated Activity always yields a usable WebView.
            renderProcessGone = false;
            consecutiveRenderDeaths = 0;
            recreate();
            return;
        }

        WebView web = bridge != null ? bridge.getWebView() : null;
        if (web == null) {
            return;
        }
        try {
            if (web.getUrl() != null) {
                web.reload();
            } else if (bridge.getServerUrl() != null) {
                web.loadUrl(bridge.getServerUrl());
            }
        } catch (Throwable ignored) {
            // The WebView turned out to be unusable after all.
            renderProcessGone = true;
            recreate();
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

        offlineTitle = new TextView(this);
        offlineTitle.setText("You're offline");
        offlineTitle.setTextColor(Color.WHITE);
        offlineTitle.setTextSize(18);
        offlineTitle.setTypeface(offlineTitle.getTypeface(), Typeface.BOLD);
        LinearLayout.LayoutParams titleLp = wrapContent();
        titleLp.topMargin = dp(24);
        root.addView(offlineTitle, titleLp);

        offlineMessage = new TextView(this);
        offlineMessage.setText("Connect to the internet to keep using CelebrityPass.");
        offlineMessage.setTextColor(Color.parseColor(MUTED));
        offlineMessage.setTextSize(15);
        offlineMessage.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams msgLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        msgLp.topMargin = dp(12);
        root.addView(offlineMessage, msgLp);

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
