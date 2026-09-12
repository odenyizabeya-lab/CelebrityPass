"use client";

import { useEffect } from "react";
import { flushGlobalOutbox } from "@/lib/chat/outbox";

/**
 * Mounted once inside the chat shell. Flushes locally-queued chat sends across
 * ALL cached conversations (not just the open one) whenever the network
 * returns or the tab regains focus, and on a fixed cadence while any message
 * could still be waiting for a server ack. Renders nothing.
 */
export default function GlobalOutboxFlusher() {
  useEffect(() => {
    const tryFlush = () => {
      if (navigator.onLine !== false) void flushGlobalOutbox();
    };
    const id = window.setInterval(tryFlush, 20000);
    window.addEventListener("online", tryFlush);
    window.addEventListener("focus", tryFlush);
    document.addEventListener("visibilitychange", tryFlush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", tryFlush);
      window.removeEventListener("focus", tryFlush);
      document.removeEventListener("visibilitychange", tryFlush);
    };
  }, []);

  return null;
}