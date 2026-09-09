"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Celebrity } from "@prisma/client";
import { slugify, tryParseJson, type CardDesign, type SocialLinks } from "@/lib/utils";
import { EVENT_TYPES } from "@/lib/events/types";
import type { ScanResult } from "@/lib/ai/types";

type PreparedTier = { name: string; description: string; price: number | null; currency: string };

type CelebrityLike = Partial<
  Pick<
    Celebrity,
    | "id"
    | "name"
    | "slug"
    | "category"
    | "country"
    | "city"
    | "profession"
    | "bio"
    | "shortBio"
    | "googleOverview"
    | "accentColor"
    | "socialLinks"
    | "cardDesign"
    | "website"
    | "isFeatured"
    | "isActive"
    | "isVerified"
    | "instagramFollowers"
    | "tiktokFollowers"
    | "facebookFollowers"
  >
> & { profileImage?: string | null; coverImage?: string | null };

export default function CelebrityForm({ mode, celebrity }: { mode: "create" | "edit"; celebrity?: CelebrityLike }) {
  const router = useRouter();
  const edit = mode === "edit";
  const initialSocials = tryParseJson<SocialLinks>(celebrity?.socialLinks ?? null, {});
  const initialDesign = tryParseJson<CardDesign>(celebrity?.cardDesign ?? null, {});

  const [name, setName] = useState(celebrity?.name ?? "");
  const [slug, setSlug] = useState(celebrity?.slug ?? "");
  const [category, setCategory] = useState(celebrity?.category ?? "Public Figure");
  const [profession, setProfession] = useState(celebrity?.profession ?? "");
  const [country, setCountry] = useState(celebrity?.country ?? "");
  const [city, setCity] = useState(celebrity?.city ?? "");
  const [accent, setAccent] = useState(celebrity?.accentColor ?? "#8b5cf6");
  const [bio, setBio] = useState(celebrity?.bio ?? "");
  const [shortBio, setShortBio] = useState(celebrity?.shortBio ?? "");
  const [googleOverview, setGoogleOverview] = useState(celebrity?.googleOverview ?? "");
  const [website, setWebsite] = useState(celebrity?.website ?? "");
  const [isFeatured, setIsFeatured] = useState(celebrity?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(celebrity?.isActive ?? true);
  const [profileImage, setProfileImage] = useState<string | null>(celebrity?.profileImage ?? null);
  const [coverImage, setCoverImage] = useState<string | null>(celebrity?.coverImage ?? null);
  const [igFollowers, setIgFollowers] = useState(celebrity?.instagramFollowers != null ? String(celebrity.instagramFollowers) : "");
  const [ttFollowers, setTtFollowers] = useState(celebrity?.tiktokFollowers != null ? String(celebrity.tiktokFollowers) : "");
  const [fbFollowers, setFbFollowers] = useState(celebrity?.facebookFollowers != null ? String(celebrity.facebookFollowers) : "");
  const [socials, setSocials] = useState<SocialLinks>(initialSocials);
  const [design, setDesign] = useState<CardDesign>(initialDesign);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "error" | "low_confidence">("idle");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);
  const [preparedTiers, setPreparedTiers] = useState<PreparedTier[]>([]);
  const [extrasWarning, setExtrasWarning] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload = {
      name,
      slug: slug || undefined,
      category,
      profession,
      country,
      city,
      bio,
      shortBio,
      googleOverview,
      website,
      isFeatured,
      isActive,
      accentColor: accent,
      profileImage,
      coverImage,
      instagramFollowers: igFollowers === "" ? null : Number(igFollowers),
      tiktokFollowers: ttFollowers === "" ? null : Number(ttFollowers),
      facebookFollowers: fbFollowers === "" ? null : Number(fbFollowers),
      socialLinks: socials,
      cardDesign: design,
    };
    try {
      const url = edit ? `/api/celebrities/${celebrity!.id}` : "/api/celebrities";
      const res = await fetch(url, {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save. Please try again.");
        setLoading(false);
        return;
      }
      setSaved(true);
      setLoading(false);
      const id = data.celebrity?.id ?? celebrity!.id;
      if (mode === "create") {
        const warnings = await createExtras(id);
        if (warnings.length) {
          setExtrasWarning(`The community was created, but some parts could not be added: ${warnings.join(" · ")}`);
        }
      }
      setTimeout(() => {
        router.push(`/admin/celebrities/${id}`);
        router.refresh();
      }, 1500);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";
  const labelCls = "mb-1.5 block text-sm font-semibold text-zinc-300";

  const toggleEvent = (i: number) =>
    setSelectedEvents((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b)));

  const applyScan = (result: ScanResult) => {
    const p = result.profile;
    if (p) {
      setName(p.name);
      setCategory(p.category);
      setProfession(p.profession);
      setCountry(p.country);
      setCity(p.city ?? "");
      setBio(p.bio);
      setShortBio(p.shortBio);
      setGoogleOverview(p.googleOverview);
      setWebsite(p.website ?? "");
      if (/^#[0-9a-fA-F]{6}$/.test(p.accentColor)) setAccent(p.accentColor);
      setSocials((s) => ({
        ...s,
        instagram: p.socials.instagram ?? s.instagram,
        x: p.socials.x ?? s.x,
        youtube: p.socials.youtube ?? s.youtube,
        tiktok: p.socials.tiktok ?? s.tiktok,
        facebook: p.socials.facebook ?? s.facebook,
        official: p.socials.official ?? s.official,
      }));
      setDesign((d) => ({
        ...d,
        badgeText: p.cardDesign.badgeText ?? d.badgeText,
        watermark: p.cardDesign.watermark ?? d.watermark,
        accent: p.cardDesign.accent ?? d.accent,
      }));
      setIgFollowers(p.followers.instagram != null ? String(p.followers.instagram) : "");
      setTtFollowers(p.followers.tiktok != null ? String(p.followers.tiktok) : "");
      setFbFollowers(p.followers.facebook != null ? String(p.followers.facebook) : "");
      setPreparedTiers(
        p.baseMemberships.map((t) => ({ name: t.name, description: t.description, price: typeof t.price === "number" ? t.price : null, currency: t.currency || "USD" })),
      );
    }
    if (!p && result.identity.bestName) setName(result.identity.bestName);
    setSelectedEvents(result.events.map((_, i) => i));
    setScanResult(result);
    setScanState("done");
    setScanMessage(null);
  };

  const scanFromImage = async (dataUri: string) => {
    setScanState("scanning");
    setScanMessage(null);
    setScanResult(null);
    setExtrasWarning(null);
    try {
      const small = await downscaleImage(dataUri, 1200, 0.85);
      const res = await fetch("/api/admin/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUri: small, includeEvents: includeEvents && !edit }),
      });
      const data = await res.json().catch(() => null);
      if (data?.status === "low_confidence") {
        setScanState("low_confidence");
        setScanMessage(data.message ?? "Could not confidently identify who this is. Try a clearer photo.");
        return;
      }
      if (!res.ok || data?.status === "provider_error") {
        setScanState("error");
        setScanMessage(data?.message ?? "The scan failed. Try again.");
        return;
      }
      if (data?.result) {
        applyScan(data.result as ScanResult);
      } else {
        setScanState("error");
        setScanMessage("The scanner returned an unexpected response.");
      }
    } catch {
      setScanState("error");
      setScanMessage("Network error during scan. Try again.");
    }
  };

  const eventTypeValid = (t: string) => ((EVENT_TYPES as readonly string[]).includes(t) ? t : "Other");

  const buildStartAt = (ev: ScanResult["events"][number]) => {
    const parsed = new Date(`${ev.startDate}T${ev.startTime ?? "12:00:00"}`);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  };

  /** After the celebrity row is created: base tiers, premium ladder, chosen events. */
  const createExtras = async (cid: string) => {
    const warnings: string[] = [];
    if (preparedTiers.length > 0) {
      for (let i = 0; i < preparedTiers.length; i++) {
        const t = preparedTiers[i];
        const nm = t.name.trim();
        if (!nm) continue;
        try {
          const r = await fetch(`/api/celebrities/${cid}/memberships`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: nm,
              description: t.description ?? "",
              price: typeof t.price === "number" && Number.isFinite(t.price) ? t.price : null,
              currency: t.currency || "USD",
              displayOrder: i,
              isActive: true,
            }),
          });
          if (!r.ok) {
            const d = await r.json().catch(() => null);
            warnings.push(`Membership "${nm}": ${d?.error ?? "not created"}`);
          }
        } catch {
          warnings.push(`Membership "${nm}": network error`);
        }
      }
      try {
        const r = await fetch(`/api/celebrities/${cid}/memberships/premium`, { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          warnings.push(`Premium tiers: ${d?.error ?? "not created"}`);
        }
      } catch {
        warnings.push("Premium tiers: network error");
      }
    }
    if (scanResult) {
      for (const idx of selectedEvents) {
        const ev = scanResult.events[idx];
        if (!ev) continue;
        try {
          const r = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              celebrityId: cid,
              name: ev.name,
              type: eventTypeValid(ev.type),
              description: ev.description ?? undefined,
              venue: ev.venue ?? undefined,
              city: ev.city ?? undefined,
              country: ev.country ?? undefined,
              startAt: buildStartAt(ev),
              allDay: !ev.startTime,
              timezone: ev.timezone ?? undefined,
              officialUrl: ev.officialUrl ?? undefined,
              sourceUrl: ev.sourceUrl ?? undefined,
              verification: "UNVERIFIED",
            }),
          });
          if (!r.ok) {
            const d = await r.json().catch(() => null);
            warnings.push(`Event "${ev.name}": ${d?.error ?? "not created"}`);
          }
        } catch {
          warnings.push(`Event "${ev.name}": network error`);
        }
      }
    }
    return warnings;
  };

  return (
    <form onSubmit={submit} className="glass rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">{edit ? `Edit ${celebrity!.name}` : "New Celebrity"}</h1>
        <div className="flex items-center gap-4">
          <Toggle label="Featured" checked={isFeatured} onChange={setIsFeatured} />
          <Toggle label="Active" checked={isActive} onChange={setIsActive} />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}
      {saved && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          ✓ Saved successfully! Taking you to the celebrity&apos;s page…
        </div>
      )}
      {saved && extrasWarning && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{extrasWarning}</div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className={labelCls}>Full Name *</label>
          <input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!edit || !slug) setSlug(slugify(e.target.value));
            }}
            className={inputCls}
            placeholder="Taylor Swift"
          />
        </div>
        <div>
          <label className={labelCls}>Slug</label>
          <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className={inputCls} placeholder="taylor-swift" />
          <p className="mt-1 text-xs text-zinc-500">URL: /celebrity/{slug || "…"}</p>
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Music" />
        </div>
        <div>
          <label className={labelCls}>Profession</label>
          <input value={profession} onChange={(e) => setProfession(e.target.value)} className={inputCls} placeholder="Singer & Songwriter" />
        </div>
        <div>
          <label className={labelCls}>Country</label>
          <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="United States" />
        </div>
        <div>
          <label className={labelCls}>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="New York" />
        </div>
        <div>
          <label className={labelCls}>Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://…" />
        </div>
        <div>
          <label className={labelCls}>Accent Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-xl border border-white/10 bg-ink-800 p-1"
            />
            <input value={accent} onChange={(e) => setAccent(e.target.value)} className={inputCls} placeholder="#8b5cf6" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Short Bio</label>
          <textarea value={shortBio} onChange={(e) => setShortBio(e.target.value)} rows={3} className={inputCls} placeholder="One or two lines for cards and search results." />
        </div>
        <div>
          <label className={labelCls}>Full Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={inputCls} placeholder="Longer community description." />
        </div>
      </div>

      <div className="mt-5">
        <label className={labelCls}>Google Overview (per celebrity)</label>
        <textarea
          value={googleOverview}
          onChange={(e) => setGoogleOverview(e.target.value)}
          rows={4}
          className={inputCls}
          placeholder="Paste the factual overview for THIS exact celebrity (as it appears in the Google knowledge panel). Every celebrity has their own unique write-up — never a generic or copied text."
        />
        <p className="mt-1 text-xs text-zinc-500">
          Shown right under this celebrity&apos;s name and profession as the Google-style factual overview. Leave blank to
          fall back to the short bio.
        </p>
      </div>

      {/* Images */}
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-zinc-300">Profile / Avatar Image</span>
          </div>
          <ImageUpload
            label=""
            value={profileImage}
            onPick={(data) => setProfileImage(data)}
            onRemove={() => setProfileImage(null)}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-300">Cover Image</span>
          </div>
          <ImageUpload
            label=""
            value={coverImage}
            onPick={(data) => setCoverImage(data)}
            onRemove={() => setCoverImage(null)}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Upload a celebrity photo. Leave images empty to use an auto-generated design.
      </p>

      {/* AI Scanner */}
      <section className="mt-6 rounded-2xl border border-primary-500/25 bg-primary-500/[0.04] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-primary-300">
              {edit ? "Auto-fill from photo" : "AI Celebrity Scanner"}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400">
              {edit
                ? "Upload a photo of the person and let Gemini auto-fill this form for review before you save."
                : "Upload a clear photo above, then let Gemini identify the person, research their real public profile, fan card and membership tiers, and pre-fill this form for review. Nothing is published until you review and save."}
            </p>
          </div>
          {!edit && (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-300">
              <input
                type="checkbox"
                checked={includeEvents}
                onChange={(e) => setIncludeEvents(e.target.checked)}
                className="h-4 w-4 rounded accent-primary-500"
              />
              Research public events
            </label>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (profileImage) scanFromImage(profileImage);
            }}
            disabled={!profileImage || scanState === "scanning"}
            className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {scanState === "scanning" ? "Scanning…" : edit ? "Scan & fill" : "Scan Celebrity"}
          </button>
          {!profileImage && <span className="text-xs text-zinc-500">Upload a profile photo above first.</span>}
          {scanState === "scanning" && (
            <span className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-400" />
              Gemini is identifying the person and researching their public profile…
            </span>
          )}
        </div>

        {scanState === "low_confidence" && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <strong>Could not confidently identify the person.</strong> {scanMessage}
            <p className="mt-1 text-xs text-amber-200/70">
              Upload a clearer, well-lit photo (face clearly visible, no group shots) and scan again.
            </p>
          </div>
        )}
        {scanState === "error" && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {scanMessage}{" "}
            <a href="/admin/ai-settings" className="underline">
              Open AI Settings
            </a>
          </div>
        )}

        {scanState === "done" && scanResult && (
          <div className="mt-5 space-y-5">
            {!edit && scanResult.duplicateOf && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                This person already has a community here: <strong>{scanResult.duplicateOf.name}</strong> (e.g.{" "}
                {"/celebrity/" + scanResult.duplicateOf.slug}). Consider editing the existing community instead of creating
                a duplicate.
              </div>
            )}

            {!edit && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">Prepared base memberships</h3>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Edit them before saving — they are created alongside the celebrity, followed by the shared premium
                  Experience ladder.
                </p>
                <MembershipTierEditor tiers={preparedTiers} onChange={setPreparedTiers} />
              </div>
            )}

            {scanResult.events.length > 0 && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">
                  Recommended public events ({scanResult.events.length})
                </h3>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Each has a real public source URL and is published as UNVERIFIED. Tick the ones you want to include.
                </p>
                <div className="mt-2 space-y-2">
                  {scanResult.events.map((ev, i) => (
                    <label
                      key={`${ev.name}-${ev.startDate}-${i}`}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-ink-900/50 px-4 py-3 transition hover:border-white/20"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(i)}
                        onChange={() => toggleEvent(i)}
                        className="mt-1 h-4 w-4 rounded accent-primary-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
                          {ev.name}
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-300">
                            {ev.type}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-400">
                          {ev.startDate}
                          {ev.startTime ? ` ${ev.startTime}` : ""}
                          {ev.city ? ` · ${ev.city}` : ""}
                          {ev.country ? `, ${ev.country}` : ""}
                          {ev.venue ? ` · ${ev.venue}` : ""}
                        </span>
                        {ev.sourceUrl && (
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-primary-300/70">{ev.sourceUrl}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!edit && (
              <p className="rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-xs text-zinc-400">
                Review the form above, edit the prepared tiers, tick the events to publish, then press{" "}
                <strong className="text-white">Create Celebrity</strong>. Every new community is auto-verified with the blue
                badge.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Follower counts */}
      <div className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400">Social Followers</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Leave blank to auto-fill realistic numbers. Set the celebrity&apos;s real published follower counts here anytime.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Instagram Followers</label>
            <input
              type="number"
              min={0}
              value={igFollowers}
              onChange={(e) => setIgFollowers(e.target.value)}
              className={inputCls}
              placeholder="e.g. 283000000"
            />
          </div>
          <div>
            <label className={labelCls}>TikTok Followers</label>
            <input
              type="number"
              min={0}
              value={ttFollowers}
              onChange={(e) => setTtFollowers(e.target.value)}
              className={inputCls}
              placeholder="e.g. 35000000"
            />
          </div>
          <div>
            <label className={labelCls}>Facebook Followers</label>
            <input
              type="number"
              min={0}
              value={fbFollowers}
              onChange={(e) => setFbFollowers(e.target.value)}
              className={inputCls}
              placeholder="e.g. 77000000"
            />
          </div>
        </div>
      </div>

      {/* Social links */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["instagram", "Instagram"],
            ["x", "X / Twitter"],
            ["youtube", "YouTube"],
            ["tiktok", "TikTok"],
            ["facebook", "Facebook"],
            ["official", "Official Site"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <input
              value={socials[key] ?? ""}
              onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))}
              className={inputCls}
              placeholder="https://…"
            />
          </div>
        ))}
      </div>

      {/* Card design */}
      <div className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400">Card Design</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Badge Text</label>
            <input value={design.badgeText ?? ""} onChange={(e) => setDesign((d) => ({ ...d, badgeText: e.target.value }))} className={inputCls} placeholder="FAN CARD" />
          </div>
          <div>
            <label className={labelCls}>Watermark</label>
            <input value={design.watermark ?? ""} onChange={(e) => setDesign((d) => ({ ...d, watermark: e.target.value }))} className={inputCls} placeholder="OFFICIAL FAN MEMBER" />
          </div>
          <div>
            <label className={labelCls}>Card Accent</label>
            <input value={design.accent ?? ""} onChange={(e) => setDesign((d) => ({ ...d, accent: e.target.value }))} className={inputCls} placeholder="#f59e0b" />
          </div>
        </div>
      </div>

      <div className="mt-7 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/admin/celebrities")}
          className="rounded-full px-5 py-3 text-sm font-semibold text-zinc-400 transition hover:text-white"
        >
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-grad rounded-full px-8 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? "Saving…" : edit ? "Save Changes" : "Create Celebrity"}
        </button>
      </div>
    </form>
  );
}

/** Downscale an image in the browser so scan payloads stay small and fast. */
function downscaleImage(dataUri: string, maxSide: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      if (scale === 1) {
        resolve(dataUri);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = dataUri;
  });
}

function MembershipTierEditor({ tiers, onChange }: { tiers: PreparedTier[]; onChange: (t: PreparedTier[]) => void }) {
  const update = (i: number, patch: Partial<PreparedTier>) => onChange(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => onChange(tiers.filter((_, idx) => idx !== i));
  const add = () => onChange([...tiers, { name: "", description: "", price: null, currency: "USD" }]);

  if (tiers.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-xs text-zinc-500">
        No tiers prepared. Create the celebrity and add tiers from the community page instead.
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {tiers.map((t, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-ink-900/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={t.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Tier name"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
            />
            <input
              type="number"
              min={0}
              value={t.price ?? ""}
              onChange={(e) => update(i, { price: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="Price"
              className="w-28 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:text-rose-300"
            >
              Remove
            </button>
          </div>
          <input
            value={t.description ?? ""}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Tier description (what members get)"
            className="mt-2 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="rounded-full px-4 py-2 text-sm font-semibold text-primary-300 ring-1 ring-white/10 transition hover:ring-primary-500/40"
      >
        + Add tier
      </button>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-300">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-primary-500" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
      {label}
    </label>
  );
}

function ImageUpload({
  label,
  value,
  onPick,
  onRemove,
}: {
  label: string;
  value: string | null;
  onPick: (data: string, fileName?: string) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-zinc-300">{label}</label>
      {value ? (
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-40 w-full bg-ink-900/60 object-contain" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-2 top-2 rounded-full bg-ink-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <label className="grid h-40 w-full cursor-pointer place-items-center rounded-2xl border border-dashed border-white/15 text-sm text-zinc-500 transition hover:border-white/30 hover:text-zinc-300">
          <span className="flex flex-col items-center gap-1">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Upload image
          </span>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onPick(String(reader.result), file.name);
              reader.readAsDataURL(file);
            }}
          />
        </label>
      )}
    </div>
  );
}