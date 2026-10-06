import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import { loadOnboardingCelebrities } from "@/lib/onboarding-celebrities";
import { safeWithDeadline } from "@/lib/safe-data";
import CelebrityPicker from "@/components/onboarding/CelebrityPicker";
import RecoveryPanel from "@/components/RecoveryPanel";
import T from "@/components/T";

export const metadata: Metadata = {
  title: "Choose Your Celebrities — CelebrityPass",
  description:
    "Pick the celebrities you want to follow. You can change your choices anytime.",
  robots: { index: false, follow: false },
};

/**
 * Onboarding: "Choose Your Celebrities".
 *
 * Three layers keep this internal screen away from anonymous users, so a
 * mistake in any single one is not enough to expose it:
 *   1. `src/proxy.ts` redirects unauthenticated requests before this page runs.
 *   2. The page re-checks the session and redirects if it is missing.
 *   3. `/api/onboarding/celebrities` returns 401 without a session.
 *
 * The celebrity list is loaded here, on the server, and handed to the picker as
 * props. It used to be fetched from the client on mount, which meant the screen
 * depended on a second round-trip after the HTML: with a hung or dropped
 * request the skeletons stayed up forever and the only recovery was killing the
 * app. Now the list arrives with the page — one round-trip, no spinner that can
 * outlive it — and a genuine database failure renders a real error state with a
 * retry instead.
 */
export default async function OnboardingCelebritiesPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/onboarding/celebrities&reason=expired");

  // A database failure must not masquerade as "you have already onboarded", so
  // the error is handled explicitly. This is deadline-guarded as well as
  // rejection-guarded: the pooled Postgres connection can be *refused* or
  // dropped mid-query, which leaves the promise pending rather than rejecting,
  // and the page then hangs instead of showing its recovery state.
  const celebrities = await safeWithDeadline(
    () => loadOnboardingCelebrities(fanId),
    null,
    6000,
  );

  // Already picked: never re-show onboarding to a returning fan.
  if (celebrities && celebrities.some((c) => c.selected)) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary-300">
          <T k="onboarding.breadcrumb" />
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
          <T k="onboarding.titleHi" />{" "}
          <span className="gradient-text">
            <T k="onboarding.titleWord" />
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
          <T k="onboarding.sub" />
        </p>
      </div>

      <div className="mt-10">
        {celebrities ? (
          <CelebrityPicker celebrities={celebrities} />
        ) : (
          <RecoveryPanel
            title={<T k="onboarding.loadErrorTitle" />}
            message={<T k="onboarding.loadErrorSub" />}
            compact
          />
        )}
      </div>
    </div>
  );
}
