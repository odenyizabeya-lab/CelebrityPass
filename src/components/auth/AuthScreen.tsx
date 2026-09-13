import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import LanguageSelector from "@/components/LanguageSelector";

/**
 * Full-bleed native app screen shell for auth flows: brand gradient background
 * with ambient glows, safe-area padding, the CelebrityPass logo top-left, a
 * language picker, main content and a footer — no website header/footer.
 */
export default function AuthScreen({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh w-full flex-1 flex-col overflow-hidden bg-aurora">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="welcome-glow welcome-glow-a" />
        <div className="welcome-glow welcome-glow-b" />
        <div className="welcome-glow welcome-glow-c" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.04] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-8 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))] sm:pt-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size="lg" className="shadow-xl shadow-primary-600/40 ring-1 ring-white/20" />
            <span className="text-lg font-black tracking-tight">
              Celebrity<span className="gradient-text">Pass</span>
            </span>
          </div>
          <LanguageSelector />
        </header>

        <div className="flex flex-1 flex-col">{children}</div>

        {footer && <footer className="space-y-3 text-center">{footer}</footer>}
      </div>
    </div>
  );
}