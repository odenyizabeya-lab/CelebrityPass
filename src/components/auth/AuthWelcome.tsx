"use client";

import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import { appPrimaryButtonClass, appSecondaryButtonClass } from "@/components/auth/authStyles";

/**
 * Native "Welcome to CelebrityPass" start screen. Replaces the plain form for
 * first-time visitors opening the app: a brand card, a short pitch, and two
 * native buttons — Create Account and Log In. The chosen action slides the
 * welcome sheet away and reveals the matching form.
 */
export default function AuthWelcome({
  leaving,
  onAction,
  onDismiss,
}: {
  leaving: boolean;
  onAction: (dest?: string) => void;
  onDismiss: () => void;
}) {
  const pathname = usePathname();
  const onLogin = pathname === "/login";
  const onRegister = pathname === "/register";

  const primary = onLogin ? "login" : onRegister ? "register" : ("register" as const);
  const secondary = primary === "login" ? "register" : "login";

  const label = (which: "login" | "register") =>
    which === "login" ? "Log In" : "Create Account";

  return (
    <div
      role="dialog"
      aria-modal="false"
      className={`fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-aurora px-6 ${
        leaving ? "welcome-leave" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="welcome-glow welcome-glow-a" />
        <div className="welcome-glow welcome-glow-b" />
        <div className="welcome-glow welcome-glow-c" />
      </div>

      <div className="welcome-sheet-in relative z-10 mx-auto w-full max-w-[400px] text-center">
        <div className="mx-auto mb-7 w-fit">
          <div className="relative">
            <span className="absolute -inset-4 rounded-[2.5rem] bg-primary-600/25 blur-2xl" aria-hidden />
            <Logo
              size="xl"
              className="app-screen-fade relative shadow-2xl shadow-primary-600/50 ring-1 ring-white/25"
            />
          </div>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary-400">Welcome</p>
        <h1 className="mt-2 text-[2rem] font-black leading-tight tracking-tight text-white">
          Welcome to Celebrity<span className="gradient-text">Pass</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-relaxed text-zinc-400">
          One app for official fan communities — fan cards, tickets and exclusive VIP experiences with the people you
          admire.
        </p>

        <div className="mx-auto mt-9 max-w-[320px] space-y-3">
          <button type="button" className={appPrimaryButtonClass} onClick={() => onAction(`/${primary}`)}>
            {label(primary)}
            {primary === "login" && " to your account"}
          </button>
          <button type="button" className={appSecondaryButtonClass} onClick={() => onAction(`/${secondary}`)}>
            {label(secondary)}
          </button>
          <button
            type="button"
            className="w-full pt-1 text-[13px] font-medium text-zinc-500 transition hover:text-zinc-300"
            onClick={onDismiss}
          >
            Continue without an account
          </button>
        </div>

        <p className="mt-8 text-[11px] text-zinc-600">Free to join · Members get exclusive chat and perks</p>
      </div>
    </div>
  );
}