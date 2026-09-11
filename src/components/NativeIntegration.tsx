"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativePlatform, enableNativePush } from "@/lib/native";

/** Bootstraps native-only integrations (FCM push) inside the mobile shell. */
export default function NativeIntegration() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativePlatform()) return;

    let cancelled = false;
    let unlisten: (() => Promise<void>) | null = null;

    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const me = (await res.json()) as { fan?: unknown };
        if (!me.fan) return;
        unlisten = await enableNativePush((conversationId) => {
          router.push(`/chat/${conversationId}`);
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
      unlisten?.().catch(() => {});
    };
  }, [router]);

  return null;
}