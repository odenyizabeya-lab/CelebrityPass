"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

const EXIT_MS = 440;

export default function WelcomeScreen() {
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(false);

  // Lock page scroll while the full-screen welcome is up (app-like feel).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const finish = async (dest?: string) => {
    if (done || exiting) return;
    setExiting(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" }).catch(() => undefined);
    } finally {
      setTimeout(() => {
        setDone(true);
        if (dest) window.location.href = dest;
      }, EXIT_MS);
    }
  };

  if (done) return null;

  return (
    <div
      aria-label="Welcome to CelebrityPass"
      className={`fixed inset-0 z-[9999] overflow-hidden bg-aurora ${exiting ? "welcome-exit" : ""}`}
    >
      {/* Ambient animated glows */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="welcome-glow welcome-glow-a" />
        <div className="welcome-glow welcome-glow-b" />
        <div className="welcome-glow welcome-glow-c" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink-950/70 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-8 py-14 text-center">
        {/* Logo */}
        <div className="fade-up" style={{ animationDelay: "140ms" }}>
          <div className="relative mx-auto grid h-24 w-24 place-items-center">
            <div className="absolute inset-0 rounded-[1.75rem] bg-primary-600/40 blur-2xl" aria-hidden />
            <div className="relative">
              <Logo size="xl" className="shadow-2xl shadow-primary-600/40 ring-1 ring-white/25" />
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="fade-up mt-12 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl" style={{ animationDelay: "240ms" }}>
          <span className="block text-sm font-bold uppercase tracking-[0.35em] text-primary-300">Welcome to</span>
          <span className="mt-2 block">
            Celebrity<span className="gradient-text">Pass</span>
          </span>
        </h1>

        {/* Tagline */}
        <p className="fade-up mt-6 max-w-sm text-lg font-semibold text-white" style={{ animationDelay: "340ms" }}>
          Your connection to the celebrities you love.
        </p>

        {/* Description */}
        <p className="fade-up mt-4 max-w-sm text-[15px] leading-relaxed text-zinc-400" style={{ animationDelay: "440ms" }}>
          Discover official fan communities, get your digital fan card, and enjoy an exclusive CelebrityPass experience.
        </p>

        {/* Actions */}
        <div className="fade-up mt-12 w-full space-y-3" style={{ animationDelay: "540ms" }}>
          <button
            type="button"
            onClick={() => finish()}
            className="btn-grad w-full rounded-2xl py-4 text-base font-black tracking-tight text-white shadow-xl shadow-primary-600/30"
          >
            Get Started
          </button>
          <button
            type="button"
            onClick={() => finish("/login")}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5 hover:text-white"
          >
            Sign In
          </button>
        </div>

        {/* App-like footer line */}
        <p className="fade-up mt-14 text-[11px] font-medium tracking-wide text-zinc-600" style={{ animationDelay: "640ms" }}>
          Official fan communities · Digital fan cards · VIP experiences
        </p>
      </div>
    </div>
  );
}