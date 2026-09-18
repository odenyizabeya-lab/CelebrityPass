"use client";

import { useState } from "react";
import type { InvestorView, InvestorSource } from "@/lib/profiles/investor";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";
const labelCls = "mb-1.5 block text-sm font-semibold text-zinc-300";
const MAX_SOURCES = 8;

function formatDate(iso: string | null): string {
  if (!iso) return "Not verified yet";
  try {
    return new Date(iso).toLocaleDateString("en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "Not verified yet";
  }
}

/**
 * Admin tooling for the person-specific business/investment profile. Everything
 * saved here is keyed 1:1 to THIS celebrity (celebrityId) — it is never shared,
 * copied, or blended with another person's info, and only verified, sourced
 * facts should be entered. Never invent offerings, minimums, returns, or claims
 * that the person personally accepts investments.
 */
export default function InvestorProfileManager({
  celebrityId,
  celebrityName,
  initial,
}: {
  celebrityId: string;
  celebrityName: string;
  initial: InvestorView | null;
}) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [overview, setOverview] = useState(initial?.overview ?? "");
  const [sector, setSector] = useState(initial?.sector ?? "");
  const [ventures, setVentures] = useState(initial?.ventures ?? "");
  const [opportunities, setOpportunities] = useState(initial?.opportunities ?? "");
  const [eligibility, setEligibility] = useState(initial?.eligibility ?? "");
  const [risks, setRisks] = useState(initial?.risks ?? "");
  const [disclaimer, setDisclaimer] = useState(initial?.disclaimer ?? "");
  const [sources, setSources] = useState<InvestorSource[]>(initial?.sources ?? []);
  const [lastVerified, setLastVerified] = useState(initial?.verifiedAt ?? null);
  const [markVerified, setMarkVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasContent = overview.trim() !== "" || ventures.trim() !== "" || opportunities.trim() !== "";
  const enableHint =
    !hasContent && !markVerified
      ? "Enable stays OFF until you add real content or mark it verified — an empty section is never published."
      : "";

  const updateSource = (i: number, patch: Partial<InvestorSource>) =>
    setSources((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch(
        `/api/admin/celebrities/${celebrityId}/investor-profile`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            overview,
            sector,
            ventures,
            opportunities,
            eligibility,
            risks,
            disclaimer,
            sources: sources.filter((s) => s.label.trim() && s.url.trim()),
            verified: markVerified,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to save the investment profile.");
        return;
      }
      if (data?.investor) {
        setLastVerified(data.investor.verifiedAt ?? lastVerified);
        setEnabled(Boolean(data.investor.enabled));
      }
      setMarkVerified(false);
      setSavedAt(new Date().toISOString());
    } catch {
      setError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight">Business &amp; Investment Profile</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">
            Person-specific, verified business and investment information for{" "}
            <strong className="text-zinc-200">{celebrityName}</strong>. It is stored only under this person&apos;s
            profile (never copied from or shared with anyone else) and shown to the public only when{" "}
            <strong className="text-zinc-200">enabled</strong> here. Enter only facts verified against authoritative
            sources — never invent offerings, minimum deposits, returns, partnerships, or claims that this person
            personally accepts investments.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${
            enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-600/20 text-zinc-400"
          }`}
        >
          {enabled ? "Published" : "Hidden from public"}
        </span>
      </div>

      <div className="mt-5 grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Show this section on the public profile</p>
            <p className="mt-0.5 text-xs leading-5 text-zinc-500">
              {enableHint ||
                (enabled
                  ? "The verified business/investment section is public."
                  : "The section is hidden from the public until you enable it.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-white/15"}`}
            aria-pressed={enabled}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        <div>
          <label className={labelCls}>Overview</label>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={4}
            className={`${inputCls} resize-y`}
            placeholder="Factual summary of this person's public business and investment life — roles held, ventures founded, board seats. No offer numbers."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Sector</label>
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className={inputCls}
              placeholder="e.g. Technology, Real Estate, Consumer Goods"
            />
          </div>
          <div>
            <label className={labelCls}>Ventures &amp; Roles</label>
            <input
              value={ventures}
              onChange={(e) => setVentures(e.target.value)}
              className={inputCls}
              placeholder="Documented companies/ventures this person founded or led"
            />
          </div>
          <div>
            <label className={labelCls}>How Eligible Investors May Engage</label>
            <textarea
              value={opportunities}
              onChange={(e) => setOpportunities(e.target.value)}
              rows={3}
              className={`${inputCls} resize-y`}
              placeholder="Leave empty unless a real, publicly documented way to engage exists and is verified."
            />
          </div>
          <div>
            <label className={labelCls}>Who Is Eligible</label>
            <textarea
              value={eligibility}
              onChange={(e) => setEligibility(e.target.value)}
              rows={3}
              className={`${inputCls} resize-y`}
              placeholder="Eligibility rules (accredited / geographic), only if documented."
            />
          </div>
          <div>
            <label className={labelCls}>Risks to Weigh</label>
            <textarea
              value={risks}
              onChange={(e) => setRisks(e.target.value)}
              rows={3}
              className={`${inputCls} resize-y`}
              placeholder="Material risks an investor should weigh."
            />
          </div>
          <div>
            <label className={labelCls}>Disclaimer</label>
            <textarea
              value={disclaimer}
              onChange={(e) => setDisclaimer(e.target.value)}
              rows={3}
              className={`${inputCls} resize-y`}
              placeholder="Shown near any opportunity text. A clear default is used when empty."
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Verification Sources</label>
          <p className="-mt-1 mb-3 text-xs leading-5 text-zinc-500">
            Authoritative sources (official company, government, or regulatory pages). Every factual claim should be
            backed here; sources appear on the public page as labeled links.
          </p>
          <div className="space-y-3">
            {sources.map((s, i) => (
              <div key={i} className="grid gap-3 rounded-xl border border-white/10 bg-ink-900/50 p-3 sm:grid-cols-[1.2fr_2fr_0.7fr_auto]">
                <input
                  value={s.label}
                  onChange={(e) => updateSource(i, { label: e.target.value })}
                  placeholder="Source name"
                  className={inputCls}
                />
                <input
                  value={s.url}
                  onChange={(e) => updateSource(i, { url: e.target.value })}
                  placeholder="https://…"
                  className={inputCls}
                />
                <input
                  value={s.date ?? ""}
                  onChange={(e) => updateSource(i, { date: e.target.value })}
                  placeholder="Date (or blank)"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setSources((prev) => prev.filter((_, idx) => idx !== i))}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:text-rose-300"
                >
                  Remove
                </button>
              </div>
            ))}
            {sources.length < MAX_SOURCES && (
              <button
                type="button"
                onClick={() => setSources((prev) => [...prev, { label: "", url: "", date: null }])}
                className="rounded-full px-4 py-2 text-sm font-semibold text-primary-300 ring-1 ring-white/10 transition hover:ring-primary-500/40"
              >
                + Add source
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Last verified</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {formatDate(lastVerified)}
              {lastVerified && <span> · set again on every “Mark verified” save</span>}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-300">
            <input
              type="checkbox"
              checked={markVerified}
              onChange={(e) => setMarkVerified(e.target.checked)}
              className="h-4 w-4 rounded accent-emerald-500"
            />
            Mark verified now
          </label>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-grad rounded-full px-7 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Investment Profile"}
          </button>
          {savedAt && <span className="text-sm text-emerald-300">Saved.</span>}
        </div>
      </div>
    </section>
  );
}