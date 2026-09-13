import Logo from "@/components/Logo";

/**
 * Native-app launch splash: the CelebrityPass logo animates in over the brand
 * gradient with an expanding glow ring, then fades as the app screen reveals.
 */
export default function AppSplash({ exiting = false }: { exiting?: boolean }) {
  return (
    <div
      aria-hidden
      role="presentation"
      className={`fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-aurora ${
        exiting ? "app-splash-exit" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="welcome-glow welcome-glow-a" />
        <div className="welcome-glow welcome-glow-b" />
      </div>
      <div className="relative">
        <span className="app-splash-ring absolute -inset-5 rounded-[2.5rem] bg-primary-600/30 blur-2xl" aria-hidden />
        <div className="app-splash-logo relative">
          <Logo size="xl" className="shadow-2xl shadow-primary-600/50 ring-1 ring-white/25" />
        </div>
      </div>
    </div>
  );
}