"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AppSplash from "@/components/auth/AppSplash";
import AuthWelcome from "@/components/auth/AuthWelcome";

const SPLASH_MS = 1350;
const SPLASH_FADE_MS = 420;
const WELCOME_LEAVE_MS = 420;

const SPLASH_KEY = "cp_app_splash";
const WELCOME_KEY = "cp_app_welcome_seen";

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

function isAuthPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

/**
 * App-opening experience for the auth route group.
 *
 * 1. Splash — the CelebrityPass logo animates in over the brand gradient
 *    (once per browser session, so it never replays mid-flow).
 * 2. Welcome — a native "Welcome to CelebrityPass" start screen with Create
 *    Account / Log In. First-time visitors get it on /login and /register;
 *    once dismissed (or after onboarding), returning users go straight to the
 *    form.
 * 3. The underlying form screen fades in (the splash fades out on top of it).
 */
export default function AuthShell({
  onboarded,
  children,
}: {
  onboarded: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Initial state always matches SSR (no splash/reveal on the server); the
  // splashSeen flag only shortens the client-side splash below.
  const splashSeen = sessionGet(SPLASH_KEY);
  const welcomeSeen = sessionGet(WELCOME_KEY);

  const [phase, setPhase] = useState<"splash" | "ready">("splash");
  const [splashGone, setSplashGone] = useState(false);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);
  const [welcomeGone, setWelcomeGone] = useState(false);

  // Splash -> app screen.
  useEffect(() => {
    if (phase !== "splash") return;
    const delay = splashSeen ? 40 : SPLASH_MS;
    const t = setTimeout(() => {
      sessionSet(SPLASH_KEY);
      setPhase("ready");
      setTimeout(() => setSplashGone(true), splashSeen ? 0 : SPLASH_FADE_MS);
    }, delay);
    return () => clearTimeout(t);
  }, [phase, splashSeen]);

  // Derived (not stored in state) so the welcome card is a pure rendering
  // decision: visible only on first-run guest visits to the auth routes.
  const showWelcome = phase === "ready" && splashGone && isAuthPath(pathname) && !onboarded && !welcomeSeen;

  const dismissWelcome = (dest?: string) => {
    if (welcomeLeaving || welcomeGone) return;
    setWelcomeLeaving(true);
    // Remember the choice so this browser never shows the welcome again.
    sessionSet(WELCOME_KEY);
    void fetch("/api/onboarding/complete", { method: "POST" }).catch(() => undefined);
    setTimeout(() => {
      setWelcomeGone(true);
      if (dest) {
        window.location.href = dest;
      }
    }, WELCOME_LEAVE_MS);
  };

  return (
    <>
      <div className="relative flex min-h-dvh w-full flex-1 flex-col">
        {/* The page (login/register/…) — reveals as the splash fades out. */}
        <div className={`flex w-full flex-1 flex-col ${phase === "ready" ? "app-screen-in" : "invisible"}`}>
          {children}
        </div>
      </div>

      {!splashGone && <AppSplash exiting={phase === "ready"} />}

      {showWelcome && !welcomeGone && (
        <AuthWelcome
          leaving={welcomeLeaving}
          onAction={(dest) => dismissWelcome(dest)}
          onDismiss={() => dismissWelcome()}
        />
      )}
    </>
  );
}