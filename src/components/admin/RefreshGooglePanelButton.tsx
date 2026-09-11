"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetch a celebrity's Google-style knowledge panel (Wikipedia/Wikidata +
 * Deezer) with a live fetch and save it. Used to heal a panel that was built
 * before a data-source fix, or to pick up newly published facts.
 */
export default function RefreshGooglePanelButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch(`/api/celebrities/${encodeURIComponent(id)}/google`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setState("error");
        setMessage((data?.error as string | undefined) ?? "Refresh failed. Try again.");
        return;
      }
      const info = data?.info as { works?: unknown[]; images?: unknown[] } | null | undefined;
      setState("done");
      setMessage(
        `Refreshed for ${name} from live Wikipedia/Wikidata/Deezer data${
          info ? ` — ${info.works?.length ?? 0} works, ${info.images?.length ?? 0} images.` : "."
        }`,
      );
      router.refresh();
    } catch {
      setState("error");
      setMessage("Network error during refresh. Try again.");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={state === "loading"}
        className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white disabled:opacity-60"
      >
        {state === "loading" ? "Refreshing…" : "Refresh knowledge panel"}
      </button>
      {message && (
        <p
          className={`max-w-xs text-right text-xs ${
            state === "done" ? "text-emerald-300" : state === "error" ? "text-rose-300" : ""
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}