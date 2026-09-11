"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-context";

interface CelebrityOption {
  id: string;
  slug: string;
  name: string;
  profession: string;
  profileImage: string | null;
  accentColor: string;
  isVerified: boolean;
  selected: boolean;
}

export default function CelebrityPicker() {
  const { t } = useLanguage();
  const router = useRouter();
  const [celebrities, setCelebrities] = useState<CelebrityOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/celebrities", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login?next=/onboarding/celebrities");
          return;
        }
        if (!res.ok) throw new Error("Failed to load celebrities");
        const data = (await res.json()) as { celebrities: CelebrityOption[] };
        if (cancelled) return;
        setCelebrities(data.celebrities ?? []);
        setSelected(new Set((data.celebrities ?? []).filter((c) => c.selected).map((c) => c.id)));
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not load celebrities. Please try again.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (selected.size === 0) {
      setError("Choose at least one celebrity to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/celebrities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrityIds: [...selected] }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Something went wrong. Please try again.");
        setSaving(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("common.networkError"));
      setSaving(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {celebrities.map((c) => {
              const isSel = selected.has(c.id);
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
                    {c.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.profileImage}
                        alt={c.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
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
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {celebrities.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
              <p className="text-sm text-zinc-400">No celebrity communities are available yet.</p>
              <Link
                href="/celebrities"
                className="mt-3 inline-block text-sm font-bold text-primary-400 hover:text-primary-300"
              >
                Browse all celebrities
              </Link>
            </div>
          )}

          <div className="sticky bottom-4 mt-10 flex flex-col items-stretch gap-3 rounded-2xl border border-white/10 bg-ink-900/90 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="px-1 text-sm text-zinc-400">
              <span className="font-bold text-white">{selected.size}</span> selected
            </p>
            <div className="flex gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:bg-white/5"
              >
                Skip for now
              </Link>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="btn-grad inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}