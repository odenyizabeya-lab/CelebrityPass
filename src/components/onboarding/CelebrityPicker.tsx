"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";
import { fetchWithTimeout } from "@/lib/client-http";
import type { OnboardingCelebrity } from "@/lib/onboarding-celebrities";

/** Ceiling on the save request: a hung POST must never leave the button spinning. */
const SAVE_TIMEOUT_MS = 20_000;

/**
 * Celebrity selection ("Choose Your Celebrities").
 *
 * The list arrives as a prop from the server page. That is the whole point of
 * this component being presentational: the previous version fetched on mount,
 * and because that request had no timeout and no abort, a dropped connection
 * left the skeletons on screen indefinitely — the "minimise and reopen the app
 * to unstick it" behaviour. There is no longer any load step to get stuck in;
 * the only async work left is the save, which is bounded and reports failure.
 */
export default function CelebrityPicker({
  celebrities,
}: {
  celebrities: OnboardingCelebrity[];
}) {
  const { t } = useLanguage();
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(celebrities.filter((c) => c.selected).map((c) => c.id)),
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Images that failed to load fall back to the monogram rather than a broken
  // image icon — a broken avatar must never be the reason a card looks dead.
  const [brokenImages, setBrokenImages] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) => {
    setFormError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    if (selected.size === 0) {
      setFormError(t("onboarding.chooseOneError"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetchWithTimeout("/api/onboarding/celebrities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrityIds: [...selected] }),
        timeoutMs: SAVE_TIMEOUT_MS,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        // 401 means the session died between page load and save.
        if (res.status === 401) {
          router.replace("/login?next=/onboarding/celebrities&reason=expired");
          return;
        }
        setFormError(data?.error ?? t("common.somethingWrong"));
        setSaving(false);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setFormError(t("common.networkError"));
      setSaving(false);
    }
  };

  if (celebrities.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
        <p className="text-sm text-zinc-400">{t("onboarding.empty")}</p>
        <Link
          href="/celebrities"
          className="mt-3 inline-block text-sm font-bold text-primary-400 hover:text-primary-300"
        >
          {t("onboarding.browseAll")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {formError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          <span className="flex-1">{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {celebrities.map((c) => {
          const isSel = selected.has(c.id);
          const showImage = Boolean(c.profileImage) && !brokenImages.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={isSel}
              className={`relative overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] ${
                isSel
                  ? "border-primary-400 bg-primary-600/10 ring-2 ring-primary-500"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-white/5">
                {showImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.profileImage as string}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={() =>
                      setBrokenImages((prev) => {
                        const next = new Set(prev);
                        next.add(c.id);
                        return next;
                      })
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="grid h-full w-full place-items-center text-3xl font-black text-white"
                    style={{ backgroundColor: c.accentColor }}
                  >
                    {c.name.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-bold text-white">
                  {c.name}
                  {c.isVerified && (
                    <span className="ml-1 inline-block h-3.5 w-3.5 align-[-2px] text-primary-400">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 1l2.6 2.6 3.6-.5.9 3.5 3.1 1.9-1.4 3.3 1.4 3.3-3.1 1.9-.9 3.5-3.6-.5L12 23l-2.6-2.6-3.6.5-.9-3.5-3.1-1.9 1.4-3.3-1.4-3.3 3.1-1.9.9-3.5 3.6.5L12 1zm-1.2 14.6l5-5-1.4-1.4-3.6 3.6-1.6-1.6-1.4 1.4 3 3z" />
                      </svg>
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{c.profession}</p>
              </div>
              {isSel && (
                <div className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary-500 text-white shadow">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-10 flex flex-col items-stretch gap-3 rounded-2xl border border-white/10 bg-ink-900/90 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="px-1 text-sm text-zinc-400">
          {t("onboarding.selected", { n: selected.size })}
        </p>
        <div className="flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
          >
            {t("onboarding.skipForNow")}
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-grad inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? t("onboarding.saving") : t("onboarding.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
