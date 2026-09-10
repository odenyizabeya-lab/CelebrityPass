"use client";

import { useEffect, useState } from "react";

type AudienceType = "ALL_SUBSCRIBED" | "NEW_CELEBRITY" | "CELEBRITY_FANS" | "MEMBERSHIP_LEVEL" | "COUNTRY" | "SPECIFIC_FANS";
type Template = "NEW_CELEBRITY" | "UPDATE" | "COMMUNITY" | "PROMOTION";

type Celebrity = { id: string; slug: string; name: string; category?: string };
type MembershipLevel = { id: string; name: string; level: string };

const AUDIENCE_OPTIONS: Array<{ value: AudienceType; label: string; hint: string }> = [
  { value: "ALL_SUBSCRIBED", label: "All subscribers", hint: "Everyone who hasn't unsubscribed" },
  { value: "NEW_CELEBRITY", label: "New celebrity", hint: "Fans who follow this celebrity" },
  { value: "CELEBRITY_FANS", label: "Celebrity fans", hint: "People who follow a specific celebrity" },
  { value: "MEMBERSHIP_LEVEL", label: "Membership level", hint: "Fans in a paid tier" },
  { value: "COUNTRY", label: "By country", hint: "Fans registered in a country" },
  { value: "SPECIFIC_FANS", label: "Specific fans", hint: "Enter email addresses" },
];

const TEMPLATE_OPTIONS: Array<{ value: Template; label: string }> = [
  { value: "NEW_CELEBRITY", label: "New celebrity joined" },
  { value: "UPDATE", label: "Product update" },
  { value: "COMMUNITY", label: "Community message" },
  { value: "PROMOTION", label: "Promotion" },
];

let fillTyping = "";

export default function AnnouncementComposer({ countries, onSent }: { countries: string[]; onSent: () => void }) {
  const [audienceType, setAudienceType] = useState<AudienceType>("ALL_SUBSCRIBED");
  const [template, setTemplate] = useState<Template>("UPDATE");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [celebrityId, setCelebrityId] = useState("");
  const [membershipLevelId, setMembershipLevelId] = useState("");
  const [country, setCountry] = useState("");
  const [fanEmails, setFanEmails] = useState("");

  const [celebrities, setCelebrities] = useState<Celebrity[]>([]);
  const [levelsCache, setLevelsCache] = useState<Record<string, MembershipLevel[]>>({});

  const [preview, setPreview] = useState<{ count: number; subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/celebrities")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCelebrities(d?.celebrities ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const celebId = celebrityId;
    if (!celebId) return;
    fetch(`/api/celebrities/${celebId}/memberships`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        setLevelsCache((prev) => ({ ...prev, [celebId]: d?.memberships ?? [] }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [celebrityId]);

  const selectedCelebrity = celebrities.find((c) => c.id === celebrityId);
  const shownLevels = levelsCache[celebrityId ?? ""] ?? [];
  const effectiveTemplate: Template = audienceType === "NEW_CELEBRITY" ? "NEW_CELEBRITY" : template;

  function buildAudience() {
    switch (audienceType) {
      case "ALL_SUBSCRIBED":
        return { type: "ALL_SUBSCRIBED" as const };
      case "NEW_CELEBRITY":
        return { type: "NEW_CELEBRITY" as const, celebrityId };
      case "CELEBRITY_FANS":
        return { type: "CELEBRITY_FANS" as const, celebrityId };
      case "MEMBERSHIP_LEVEL":
        return { type: "MEMBERSHIP_LEVEL" as const, celebrityId, membershipLevelId };
      case "COUNTRY":
        return { type: "COUNTRY" as const, country };
      case "SPECIFIC_FANS":
        return { type: "SPECIFIC_FANS" as const, fanEmails: fanEmails.split("\n").map((e) => e.trim()).filter(Boolean) };
    }
  }

  const needsCelebrity = audienceType === "NEW_CELEBRITY" || audienceType === "CELEBRITY_FANS" || audienceType === "MEMBERSHIP_LEVEL";

  async function runPreview() {
    setPreviewing(true);
    setError(null);
    const res = await fetch("/api/admin/emails/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: buildAudience(), template: effectiveTemplate, title: title || undefined, subject: subject || undefined, message: message || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setPreviewing(false);
    if (!res.ok) return setError(data?.error ?? "Preview failed");
    setPreview(data);
    if (!subject || fillTyping === "celebrity") setSubject(data.subject);
    fillTyping = "";
  }

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/admin/emails/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: buildAudience(), template: effectiveTemplate, title: title || undefined, subject: subject || undefined, message: message || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data?.error ?? "Send failed");
    setResult(`Queued for ${data.targetsCount} recipients (${data.enqueuedCount} messages created). They send within a minute.`);
    setPreview(null);
    setTitle("");
    setSubject("");
    setMessage("");
    onSent();
  }

  return (
    <div className="glass rounded-3xl p-7">
      <h3 className="text-lg font-bold text-white">Compose announcement</h3>
      <p className="mt-1 text-sm text-zinc-500">Any recipient can unsubscribe with one click, and preferences are respected.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Audience */}
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Audience</p>
          <div className="mt-3 space-y-1.5">
            {AUDIENCE_OPTIONS.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 transition hover:border-primary-500/40">
                <input
                  type="radio"
                  name="audience"
                  checked={audienceType === o.value}
                  onChange={() => {
                    setAudienceType(o.value);
                    setPreview(null);
                  }}
                  className="h-4 w-4 accent-primary-500"
                />
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{o.label}</p>
                  <p className="text-xs text-zinc-500">{o.hint}</p>
                </div>
              </label>
            ))}
          </div>

          {needsCelebrity && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-zinc-400">Celebrity</label>
              <select
                value={celebrityId}
                onChange={(e) => {
                  setCelebrityId(e.target.value);
                  setPreview(null);
                  if (audienceType === "NEW_CELEBRITY") {
                    fillTyping = "celebrity";
                    setSubject("");
                  }
                }}
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50"
              >
                <option value="">Select celebrity…</option>
                {celebrities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audienceType === "MEMBERSHIP_LEVEL" && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-zinc-400">Membership level</label>
              <select
                value={membershipLevelId}
                onChange={(e) => {
                  setMembershipLevelId(e.target.value);
                  setPreview(null);
                }}
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50"
              >
                <option value="">Select a level…</option>
                {shownLevels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audienceType === "COUNTRY" && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-zinc-400">Country</label>
              <input
                list="email-center-countries"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setPreview(null);
                }}
                placeholder="e.g. United States"
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50"
              />
              <datalist id="email-center-countries">
                {countries.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}

          {audienceType === "SPECIFIC_FANS" && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-zinc-400">Fan emails (one per line)</label>
              <textarea
                value={fanEmails}
                onChange={(e) => {
                  setFanEmails(e.target.value);
                  setPreview(null);
                }}
                rows={4}
                placeholder={"fan@example.com\nanotherfan@example.com"}
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 font-mono text-xs text-zinc-200 outline-none focus:border-primary-500/50"
              />
            </div>
          )}
        </div>

        {/* Message + template */}
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Email</p>

          <div className="mt-3">
            <label className="block text-xs font-semibold text-zinc-400">Template</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {(audienceType === "NEW_CELEBRITY" ? [TEMPLATE_OPTIONS[0]] : TEMPLATE_OPTIONS).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setTemplate(t.value);
                    setPreview(null);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    effectiveTemplate === t.value ? "border-primary-500/60 bg-primary-500/15 text-primary-200" : "border-white/10 text-zinc-400 hover:border-white/25"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {effectiveTemplate !== "NEW_CELEBRITY" && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-zinc-400">Title (shown at top of the email)</label>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setPreview(null);
                }}
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50"
              />
            </div>
          )}

          <div className="mt-3">
            <label className="block text-xs font-semibold text-zinc-400">Subject line</label>
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setPreview(null);
              }}
              placeholder={effectiveTemplate === "NEW_CELEBRITY" ? "Auto-filled from celebrity name" : "What fans see in their inbox"}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50"
            />
          </div>

          {effectiveTemplate !== "NEW_CELEBRITY" && (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-zinc-400">Message</label>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setPreview(null);
                }}
                rows={5}
                placeholder="Write a short, friendly message…"
                className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-primary-500/50"
              />
            </div>
          )}

          {audienceType === "NEW_CELEBRITY" && (
            <div className="mt-3 rounded-xl border border-primary-500/20 bg-primary-500/5 px-4 py-3 text-xs text-zinc-300">
              Sends a styled “new celebrity” announcement (with photo + Join button) to every fan following{" "}
              <span className="font-bold text-white">{selectedCelebrity?.name ?? "the selected celebrity"}</span>. Send on the activation day for best effect.
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runPreview}
              disabled={previewing}
              className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold text-zinc-300 transition hover:border-white/30 disabled:opacity-60"
            >
              {previewing ? "Counting…" : "Preview & count"}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || previewing}
              className="rounded-full bg-primary-600 px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-500 disabled:opacity-60"
            >
              {sending ? "Sending…" : preview ? `Send to ${preview.count.toLocaleString()}` : "Compose first"}
            </button>
          </div>

          {error && <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">{error}</p>}
          {result && <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">{result}</p>}

          {preview && (
            <div className="mt-4">
              <p className="text-xs text-zinc-400">
                {preview.count.toLocaleString()} eligible recipients · Subject: <span className="font-semibold text-zinc-200">{preview.subject}</span>
              </p>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={preview.html}
                className="mt-2 h-96 w-full rounded-2xl border border-white/10 bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}