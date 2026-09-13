"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

const EXIT_MS = 440;
const SPLASH_MS = 1250;
const SPLASH_FADE_MS = 420;

// Same session keys as the auth shell so the splash + welcome "remember" a
// choice made earlier in this browser session (e.g. finishing at "/", then
// opening /login via a link).
const SPLASH_KEY = "cp_app_splash";
const WELCOME_KEY = "cp_app_welcome_seen";

type Stage = "splash" | "splash-exit" | "welcome";

function sessionGet(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function sessionSet(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {}
}

export default function WelcomeScreen() {
  const [stage, setStage] = useState<Stage>("splash");
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

  const splashSeen = sessionGet(SPLASH_KEY);

  // Logo splash first, then reveal the welcome card. Returning visitors who
  // already saw the splash this session skip straight to the welcome card.
  useEffect(() => {
    if (stage === "splash") {
      const t1 = setTimeout(() => {
        sessionSet(SPLASH_KEY);
        setStage(splashSeen ? "welcome" : "splash-exit");
      }, splashSeen ? 40 : SPLASH_MS);
      return () => clearTimeout(t1);
    }
    if (stage === "splash-exit") {
      const t2 = setTimeout(() => setStage("welcome"), SPLASH_FADE_MS);
      return () => clearTimeout(t2);
    }
  }, [stage, splashSeen]);

  const finish = async (dest?: string) => {
    if (done || exiting) return;
    setExiting(true);
    sessionSet(WELCOME_KEY);
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
      className={`fixed inset-0 z-[9999] overflow-hidden bg-aurora ${
        exiting ? "welcome-exit" : stage === "splash" || stage === "splash-exit" ? "" : "app-screen-fade"
      }`}
    >
      {/* Ambient animated glows */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="welcome-glow welcome-glow-a" />
        <div className="welcome-glow welcome-glow-b" />
        <div className="welcome-glow welcome-glow-c" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink-950/70 to-transparent" />
      </div>

      {stage === "splash" || stage === "splash-exit" ? (
        // Launch splash: the logo pops in with an expanding glow ring.
        <div
          className={`relative z-20 grid h-full w-full place-items-center ${
            stage === "splash-exit" ? "app-splash-exit" : ""
          }`}
        >
          <div className="relative">
            <span className="app-splash-ring absolute -inset-5 rounded-[2.5rem] bg-primary-600/30 blur-2xl" aria-hidden />
            <div className="app-splash-logo relative grid h-24 w-24 place-items-center">
              <Logo size="xl" className="shadow-2xl shadow-primary-600/50 ring-1 ring-white/25" />
            </div>
          </div>
        </div>
      ) : (
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
          <h1
            className="fade-up mt-12 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl"
            style={{ animationDelay: "240ms" }}
          >
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
          <p
            className="fade-up mt-4 max-w-sm text-[15px] leading-relaxed text-zinc-400"
            style={{ animationDelay: "440ms" }}
          >
            Discover official fan communities, get your digital fan card, and enjoy an exclusive CelebrityPass
            experience.
          </p>

          {/* Actions */}
          <div className="fade-up mt-12 w-full space-y-3" style={{ animationDelay: "540ms" }}>
            <button
              type="button"
              onClick={() => finish("/register")}
              className="btn-grad w-full rounded-2xl py-4 text-base font-black tracking-tight text-white shadow-xl shadow-primary-600/30"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => finish("/login")}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 transition hover:bg-white/5 hover:text-white"
            >
              Log In
            </button>
          </div>

          {/* App-like footer line */}
          <p
            className="fade-up mt-14 text-[11px] font-medium tracking-wide text-zinc-600"
            style={{ animationDelay: "640ms" }}
          >
            Official fan communities · Digital fan cards · VIP experiences
          </p>
        </div>
      )}
    </div>
  );
}