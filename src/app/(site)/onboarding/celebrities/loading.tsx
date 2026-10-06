/**
 * Streaming fallback for the onboarding screen.
 *
 * The page reads the session and the celebrity list on the server before it can
 * render. Without this boundary the user stares at a blank screen for the length
 * of that round-trip on a slow phone connection, so the header and a skeleton are
 * painted immediately while the real content streams in.
 */
import T from "@/components/T";

export default function OnboardingCelebritiesLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <div className="mx-auto h-3 w-24 animate-pulse rounded bg-white/[0.07]" />
        <div className="mx-auto mt-4 h-9 w-72 max-w-full animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="mx-auto mt-4 h-4 w-full max-w-lg animate-pulse rounded bg-white/[0.05]" />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
            <div className="aspect-[4/3] w-full animate-pulse bg-white/[0.06]" />
            <div className="space-y-2 p-3">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.07]" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
        ))}
      </div>

      <p className="sr-only" role="status">
        <T k="onboarding.loading" />
      </p>
    </div>
  );
}
