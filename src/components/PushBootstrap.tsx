"use client";

import { useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/**
 * App-wide push bootstrap.
 *
 * Registers the service worker on every page so push events and notification
 * taps always work. When the fan has already granted notification permission,
 * it silently re-subscribes (no prompt) — so phone notifications keep working
 * after a new device, reinstall, or cleared data, even if they never open a
 * chat page again. It never asks for permission by itself; the subscribe UI
 * lives in the chat screens where an explicit request belongs.
 */
export default function PushBootstrap() {
  const { state, refresh, enable } = usePushNotifications();
  const autoRestoreRef = useRef(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRestoreRef.current) return;
    // Permission already granted (past session/device) but no stored
    // subscription yet — restore silently. requestPermission resolves
    // instantly here, so no system prompt appears.
    if (state !== "unsubscribed") return;
    autoRestoreRef.current = true;
    void enable();
  }, [state, enable]);

  return null;
}