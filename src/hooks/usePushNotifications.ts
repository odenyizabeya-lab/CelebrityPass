"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PushState = "unsupported" | "unavailable" | "denied" | "subscribed" | "unsubscribed" | "loading";

function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  try {
    return navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return Promise.resolve(null);
  }
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const subRef = useRef<PushSubscription | null>(null);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const checkRef = useRef(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("PushManager" in window)) {
      setState("unsupported");
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    const reg = await getRegistration();
    regRef.current = reg;

    if (Notification.permission === "default") {
      setState("unsubscribed");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      subRef.current = sub;
      setState("subscribed");
    } else {
      setState("unsubscribed");
    }
  }, []);

  useEffect(() => {
    if (checkRef.current) return;
    checkRef.current = true;
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) return false;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") {
      setState(perm === "denied" ? "denied" : "unsubscribed");
      return false;
    }

    try {
      let reg = regRef.current;
      if (!reg) {
        reg = await getRegistration();
        regRef.current = reg;
      }
      if (!reg || !reg.pushManager) {
        setState("unavailable");
        return false;
      }

      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        subRef.current = existing;
      } else {
        const keyRes = await fetch("/api/push/vapid-key");
        if (!keyRes.ok) {
          setState("unavailable");
          return false;
        }
        const { publicKey } = await keyRes.json();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });
        subRef.current = sub;
      }

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subRef.current.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });
      setState("subscribed");
      return true;
    } catch (err) {
      console.error("[push] enable failed", err);
      setState("unavailable");
      return false;
    }
  }, []);

  const disable = useCallback(async () => {
    try {
      const sub = subRef.current ?? (await regRef.current?.pushManager?.getSubscription());
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } catch {}
    subRef.current = null;
    setState("unsubscribed");
  }, []);

  return { state, permission, enable, disable, refresh };
}