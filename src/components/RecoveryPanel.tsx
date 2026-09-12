"use client";

import { useEffect, useState } from "react";

/**
 * Small branded "couldn't load / you're offline" panel used by error
 * boundaries and inline fallbacks. It never replaces the app shell — it sits
 * inside the existing context, keeps the header/footer visible, shows a simple
 * explanation and a Retry button. No auto-reload loops, no full-page takeover.
 */
export default function RecoveryPanel({
  title = "Something went wrong",
  message = "We couldn't load this right now. Check your connection and try again — your data is safe.",
  onRetry,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const [online, setOnline] = useState(true);
  const [attempted, setAttempted] = useState(0);

  useEffect(() => {
    const mark = () => setOnline(navigator.onLine);
    mark();
    window.addEventListener("online", mark);
    window.addEventListener("offline", mark);
    return () => {
      window.removeEventListener("online", mark);
      window.removeEventListener("offline", mark);
    };
  }, []);

  const handleRetry = () => {
    setAttempted((n) => n + 1);
    if (onRetry) {
      onRetry();
      return;
    }
    // Base fallback: a full reload matches "render the page again". The guard
    // is remembered across reloads (sessionStorage) so a persistent failure
    // can never cause a refresh loop, but it re-arms after 10s so an explicit
    // "Try again" a little later still does a real retry.
    let last = 0;
    try {
      last = Number(sessionStorage.getItem("cp.recovery.lastReload") ?? 0) || 0;
    } catch {
      /* storage unavailable — proceed as if never reloaded */
    }
    const reloadedRecently = attempted === 0 && Date.now() - last < 10_000;
    if (!reloadedRecently) {
      try {
        sessionStorage.setItem("cp.recovery.lastReload", String(Date.now()));
      } catch {
        /* ignore */
      }
      window.location.reload();
    }
  };

  const offlineCopy = online
    ? message
    : "You appear to be offline. Reconnect and retry — nothing has been lost.";

  return (
    <div
      className={`${compact ? "min-h-[40vh]" : "min-h-[60vh]"} flex w-full items-center justify-center p-6`}
    >
      <div className="glass w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
          {online ? (
            <svg className="h-7 w-7 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.288 15.038A5.5 5.5 0 017 9.75a5.5 5.5 0 0110.601-.83M8.288 15.038A9 9 0 003 20m5.288-4.962L21 21m2 16.657l-3.14-3.136M12 19l-4-2m4 2l2.5-1.25M3 20l4-2m6-4v3m6-3a9 9 0 01-2.25 6.03"
              />
            </svg>
          )}
        </div>
        {!online && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Offline
          </span>
        )}
        <h2 className="mt-4 text-lg font-bold text-white">{!online ? "You're offline" : title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">{offlineCopy}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="btn-grad mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
            />
          </svg>
          {online ? "Try again" : "Reconnecting…"}
        </button>
      </div>
    </div>
  );
}