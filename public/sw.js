self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }

  const title = data?.title || "CelebrityPass";
  const body = data?.body || "You have a new message";
  const url = data?.url || "/chat";
  // Keep notifications grouped per conversation. renotify makes a replacement
  // re-alert (sound/vibration) instead of silently updating the tile.
  const tag = data?.conversationId || url.split("/").pop() || "chat";

  event.waitUntil(
    (async () => {
      try {
        if ("setAppBadge" in self.navigator) await self.navigator.setAppBadge();
      } catch {}
      await self.registration.showNotification(title, {
        body,
        // Real CelebrityPass app icon (large, looks crisp on lock screen).
        icon: "/icons/icon-192.png",
        // Small monochrome badge for the status bar / notification shade.
        badge: "/icons/icon-monochrome.svg",
        tag,
        renotify: true,
        data: { url, conversationId: tag },
        vibrate: [100, 40, 100, 40, 100],
        timestamp: Date.now(),
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/chat";
  const scopeUrl = new URL(url, self.registration.scope).href;
  const targetPath = new URL(scopeUrl).pathname;

  event.waitUntil(
    (async () => {
      try {
        if ("clearAppBadge" in self.navigator) await self.navigator.clearAppBadge();
      } catch {}

      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // 1. A window already on this exact chat — just bring it up.
      for (const client of clients) {
        try {
          if (new URL(client.url).pathname === targetPath) {
            if ("focus" in client) await client.focus();
            return;
          }
        } catch {}
      }

      // 2. A window of our app is open — navigate it to the chat and focus.
      for (const client of clients) {
        if (!client.url.startsWith(self.registration.scope)) continue;
        try {
          if (typeof client.navigate !== "function") continue;
          await client.navigate(scopeUrl);
          if ("focus" in client) await client.focus();
          return;
        } catch {}
      }

      // 3. Nothing open — launch the app on the chat.
      if (self.clients.openWindow) await self.clients.openWindow(scopeUrl);
    })()
  );
});

// User dismissed the notification: clear the launcher badge as well.
self.addEventListener("notificationclose", (event) => {
  event.waitUntil(
    (async () => {
      try {
        if ("clearAppBadge" in self.navigator) await self.navigator.clearAppBadge();
      } catch {}
    })()
  );
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});