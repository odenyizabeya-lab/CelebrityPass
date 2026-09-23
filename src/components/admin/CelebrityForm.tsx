"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import type { Celebrity } from "@prisma/client";
import { slugify, tryParseJson, type CardDesign, type SocialLinks } from "@/lib/utils";
import { EVENT_TYPES } from "@/lib/events/types";
import type { ScanResult, ScanInvestor } from "@/lib/ai/types";
import {
  ALL_CATEGORIES,
  CATEGORY_OPTIONS,
  PROFILE_TYPES,
  suggestProfileType,
  type ProfileClass,
} from "@/lib/profiles/classes";

type PreparedTier = { name: string; description: string; price: number | null; currency: string };

type DuplicateInfo = { code: string; message: string; existing?: { id: string; slug: string; name: string } };

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
    | "accentColor"
    | "socialLinks"
    | "cardDesign"
    | "website"
    | "facebookUrl"
    | "instagramUrl"
    | "tiktokUrl"
    | "googleUrl"
    | "isFeatured"
    | "isActive"
    | "isVerified"
    | "profileType"
    | "fansCardEnabled"
    | "instagramFollowers"
    | "tiktokFollowers"
    | "facebookFollowers"
  >
> & { profileImage?: string | null; coverImage?: string | null; hasProfileImage?: boolean; hasCoverImage?: boolean };

export default function CelebrityForm({ mode, celebrity }: { mode: "create" | "edit"; celebrity?: CelebrityLike }) {
  const router = useRouter();
  const edit = mode === "edit";
  const legacySocials = tryParseJson<SocialLinks>(celebrity?.socialLinks ?? null, {});
  // Source of truth is now the four permanent columns; legacy socials JSON is
  // only a fallback so older records still show their already-saved links.
  const initialSocials: SocialLinks = {
    facebook: celebrity?.facebookUrl || legacySocials.facebook || "",
    instagram: celebrity?.instagramUrl || legacySocials.instagram || "",
    tiktok: celebrity?.tiktokUrl || legacySocials.tiktok || "",
    google: celebrity?.googleUrl || legacySocials.google || "",
  };
  const initialDesign = tryParseJson<CardDesign>(celebrity?.cardDesign ?? null, {});

  const [name, setName] = useState(celebrity?.name ?? "");
  const [slug, setSlug] = useState(celebrity?.slug ?? "");
  const [category, setCategory] = useState(celebrity?.category ?? "Public Figure");
  const [profileType, setProfileType] = useState<ProfileClass>(
    celebrity?.profileType ? (celebrity.profileType as ProfileClass) : suggestProfileType(celebrity?.category ?? null),
  );
  const [profileTypeTouched, setProfileTypeTouched] = useState(false);
  const [fansCardEnabled, setFansCardEnabled] = useState(celebrity?.fansCardEnabled ?? true);
  const [profession, setProfession] = useState(celebrity?.profession ?? "");
  const [bio, setBio] = useState(celebrity?.bio ?? "");
  const [country, setCountry] = useState(celebrity?.country ?? "");
  const [city, setCity] = useState(celebrity?.city ?? "");
  const [accent, setAccent] = useState(celebrity?.accentColor ?? "#8b5cf6");
  const [website, setWebsite] = useState(celebrity?.website ?? "");
  const [isFeatured, setIsFeatured] = useState(celebrity?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(celebrity?.isActive ?? true);
  const [isVerified, setIsVerified] = useState(celebrity?.isVerified ?? true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileChanged, setProfileChanged] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverChanged, setCoverChanged] = useState(false);
  const [igFollowers, setIgFollowers] = useState(celebrity?.instagramFollowers != null ? String(celebrity.instagramFollowers) : "");
  const [ttFollowers, setTtFollowers] = useState(celebrity?.tiktokFollowers != null ? String(celebrity.tiktokFollowers) : "");
  const [fbFollowers, setFbFollowers] = useState(celebrity?.facebookFollowers != null ? String(celebrity.facebookFollowers) : "");
  const [socials, setSocials] = useState<SocialLinks>(initialSocials);
  const [design, setDesign] = useState<CardDesign>(initialDesign);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "error" | "low_confidence">("idle");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanDetail, setScanDetail] = useState<string | null>(null);
  const [scanMeta, setScanMeta] = useState<{ used: string | null; skipped: string[] }>({ used: null, skipped: [] });
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<number[]>([]);
  const [preparedTiers, setPreparedTiers] = useState<PreparedTier[]>([]);
  // Person-specific investment info found by the scanner (create mode only).
  const [investorPreview, setInvestorPreview] = useState<ScanInvestor | null>(null);

  /** Never send a multi-megabyte photo. Compress anything still raster and
 * bigger than ~700KB so the saved image and the JSON payload both stay sane
 * (small PNGs/WebP pass through untouched; only oversized raster re-encodes). */
const shrinkImage = async (value: string | null | undefined): Promise<string | null | undefined> => {
  if (!value || !/^data:image\/(png|jpe?g|webp);base64,/i.test(value)) return value;
  const bytes = Math.round((value.length * 3) / 4);
  if (bytes < 1_000_000) return value;
  try {
    return await downscaleImage(value, 1600, 0.82);
  } catch {
    return value;
  }
};

const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDuplicate(null);
    setLoading(true);
    // Compress any oversized photo before it is stringified into the request,
    // so saves work regardless of server body-size limits.
    const rawProfile = profileChanged || mode === "create" ? profileImage : undefined;
    const rawCover = coverChanged || mode === "create" ? coverImage : undefined;
    const [savedProfile, savedCover] = await Promise.all([shrinkImage(rawProfile), shrinkImage(rawCover)]);
    const payload = {
      name,
      slug: slug || undefined,
      category,
      profileType,
      fansCardEnabled,
      profession,
      bio: bio.trim() === "" ? null : bio.trim(),
      country,
      city,
      website,
      isFeatured,
      isActive,
      isVerified,
      accentColor: accent,
      profileImage: savedProfile,
      coverImage: savedCover,
      instagramFollowers: igFollowers === "" ? null : Number(igFollowers),
      tiktokFollowers: ttFollowers === "" ? null : Number(ttFollowers),
      facebookFollowers: fbFollowers === "" ? null : Number(fbFollowers),
      socialLinks: socials,
      // Permanent verified platform columns (source of truth).
      facebookUrl: socials.facebook?.trim() || null,
      instagramUrl: socials.instagram?.trim() || null,
      tiktokUrl: socials.tiktok?.trim() || null,
      googleUrl: socials.google?.trim() || null,
      cardDesign: design,
      // Base Silver→VIP tiers travel with the create itself: the server creates
      // them (with the premium ladder) in the same request, so a new community
      // can never lose its tiers to the background-save race on redirect.
      baseMemberships: mode === "create" ? preparedTiers : undefined,
      // Person-specific investment info from the AI scan — stored strictly under
      // THIS celebrity's id, never shared with other people.
      investorProfile: mode === "create" ? investorPreview : undefined,
    };
    try {
      const url = edit ? `/api/celebrities/${celebrity!.id}` : "/api/celebrities";
      const res = await fetch(url, {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: Record<string, unknown> & { error?: string; code?: string } = {};
      try {
        data = await res.json();
      } catch {
        // The server sent a non-JSON body (e.g. an oversized-body HTML error).
        setError(
          `The server rejected the request (HTTP ${res.status}). If you just uploaded a photo, please use a smaller image and try again.`,
        );
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const code = data?.code;
        if (code === "CELEBRITY_EXISTS" || code === "IMAGE_EXISTS" || code === "SLUG_EXISTS") {
          setDuplicate(data as DuplicateInfo);
        } else {
          setError(data?.error ?? "Failed to save. Please try again.");
        }
        setLoading(false);
        return;
      }
      setLoading(false);
      const created = data?.celebrity as { id?: string } | undefined;
      const id = (edit ? celebrity!.id : undefined) ?? created?.id;
      if (!id) {
        setError("Could not determine the saved celebrity id.");
        setLoading(false);
        return;
      }
      if (mode === "create") {
        // Memberships and events still get created, but in the background so the
        // admin is never left waiting on the form.
        void createExtras(id).catch(() => {});
      } else {
        // Edit mode: honors the selected scan events too, creating only ones
        // the celebrity does not already have.
        void createScanEvents(id).catch(() => {});
      }
      // App-like handoff: leave the form instantly and land on the celebrities dashboard.
      router.push("/admin/celebrities");
      router.refresh();
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

  /** Choosing a canonical category auto-suggests its profile class, unless the
   *  admin already picked one explicitly. Picking an entertainment category
   *  clears any scanned investor info — the fan system and the investment
   *  section are separate and never combined. */
  const selectCategory = (value: string) => {
    setCategory(value);
    if (!profileTypeTouched) {
      const group = Object.entries(CATEGORY_OPTIONS).find(([, cats]) => cats.includes(value));
      if (group) {
        setProfileType(group[0] as ProfileClass);
        if (group[0] === "entertainment") setInvestorPreview(null);
      }
    }
  };

  const applyScan = (result: ScanResult) => {
    const p = result.profile;
    if (p) {
      setName(p.name);
      setCategory(p.category);
      setProfileType(p.profileType);
      setProfileTypeTouched(true);
      setFansCardEnabled(p.fansCardEnabled);
      setInvestorPreview(p.investorProfile ?? null);
      setProfession(p.profession);
      setCountry(p.country);
      setCity(p.city ?? "");
      setWebsite(p.website ?? "");
      if (/^#[0-9a-fA-F]{6}$/.test(p.accentColor)) setAccent(p.accentColor);
      setSocials((s) => ({
        ...s,
        facebook: p.socials.facebook ?? s.facebook,
        instagram: p.socials.instagram ?? s.instagram,
        tiktok: p.socials.tiktok ?? s.tiktok,
        google: p.socials.google ?? s.google,
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
    setScanDetail(null);
    setScanResult(null);
    try {
      const small = await downscaleImage(dataUri, 1200, 0.85);
      const res = await fetch("/api/admin/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUri: small, includeEvents }),
      });
      const data = await res.json().catch(() => null);
      const meta = {
        used: typeof data?.diagnostics?.used?.label === "string" ? data.diagnostics.used.label : null,
        skipped: Array.isArray(data?.diagnostics?.skipped) ? data.diagnostics.skipped.map((s: { label?: string; reason?: string }) => s?.label ?? "").filter(Boolean) : [],
      };
      setScanMeta(meta);
      if (data?.status === "low_confidence") {
        setScanState("low_confidence");
        setScanMessage(data.message ?? "Could not confidently identify who this is. Try a clearer photo.");
        return;
      }
      if (!res.ok || data?.status === "provider_error") {
        setScanState("error");
        setScanMessage(data?.message ?? "The scan failed. Try again.");
        setScanDetail(typeof data?.detail === "string" ? data.detail : null);
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

  /** Create the scan events the admin selected, skipping ones that already exist for the celebrity. */
  const createScanEvents = async (cid: string) => {
    const warnings: string[] = [];
    if (!scanResult) return warnings;
    const existing = new Set<string>();
    try {
      const r = await fetch(`/api/events?celebrityId=${encodeURIComponent(cid)}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (r.ok) {
        const d = await r.json().catch(() => null);
        for (const e of d?.events ?? []) {
          const day = e.startAt ? e.startAt.slice(0, 10) : "";
          existing.add(`${day}__${String(e.name ?? "").trim().toLowerCase()}`);
        }
      }
    } catch {
      // If the existing-events lookup fails, still attempt creation.
    }
    for (const idx of selectedEvents) {
      const ev = scanResult.events[idx];
      if (!ev) continue;
      const nm = ev.name?.trim();
      if (!nm) continue;
      if (existing.has(`${ev.startDate ?? ""}__${nm.toLowerCase()}`)) continue;
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
          warnings.push(`Event "${nm}": ${d?.error ?? "not created"}`);
        }
      } catch {
        warnings.push(`Event "${nm}": network error`);
      }
    }
    return warnings;
  };

  /** After the celebrity row is created: publish the admin-selected scan
   *  events only. The base Silver→VIP tiers and the shared premium ladder are
   *  both applied server-side by the create route itself — they never depend
   *  on this client call, which could be aborted by the form navigating away. */
  const createExtras = async (cid: string) => {
    const warnings: string[] = [];
    warnings.push(...(await createScanEvents(cid)));
    return warnings;
  };

  return (
    <form onSubmit={submit} className="glass rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black tracking-tight">{edit ? `Edit ${celebrity!.name}` : "New Celebrity"}</h1>
        <div className="flex items-center gap-3">
          <Toggle label="Featured" checked={isFeatured} onChange={setIsFeatured} />
          <Toggle label="Verified" checked={isVerified} onChange={setIsVerified} />
          <Toggle label="Active" checked={isActive} onChange={setIsActive} />
        </div>
      </div>

      {/* Profile class — decides which feature system this person uses. The
          stored value is authoritative (never inferred purely from fame). */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-ink-900/40 p-5">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400">Profile Class</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
          Determines what this page is about: <strong className="text-zinc-300">Entertainment</strong> runs the CelebrityPass
          fan system (fan card, membership tiers, fan chat); <strong className="text-zinc-300">Business / Investor</strong> and{" "}
          <strong className="text-zinc-300">Political</strong> are factual, verified profiles with no fan system and never an
          implied offer to invest. Your choice is stored per person and enforced server-side.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {PROFILE_TYPES.map((pt) => (
            <label
              key={pt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                profileType === pt.value
                  ? "border-primary-500/60 bg-primary-500/10"
                  : "border-white/10 bg-ink-900/60 hover:border-white/20"
              }`}
            >
              <input
                type="radio"
                name="profileType"
                checked={profileType === pt.value}
                onChange={() => {
                  setProfileType(pt.value);
                  setProfileTypeTouched(true);
                  if (pt.value === "entertainment") setInvestorPreview(null);
                }}
                className="mt-1 h-4 w-4 accent-primary-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">{pt.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">
                  {pt.value === "entertainment"
                    ? "CelebrityPass fan card, tiers, fans & fan chat."
                    : pt.value === "business"
                      ? "Factual business/investment profile with verified sources."
                      : "Official public profile; investment info only when separately verified."}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-300">CelebrityPass Fan System</p>
            <p className="mt-0.5 text-xs leading-5 text-zinc-500">
              {fansCardEnabled
                ? "Fans can register for a fan card, tiers and fan chat for this person."
                : "No fan card, fan tiers or fan chat for this person — this is a factual, verified profile."}
            </p>
            {!fansCardEnabled && profileType === "entertainment" && (
              <p className="mt-1 text-xs font-semibold text-amber-300">
                Entertainment profiles normally keep this ON. Turning it OFF makes this a factual profile with no fan system.
              </p>
            )}
            {fansCardEnabled && profileType !== "entertainment" && (
              <p className="mt-1 text-xs font-semibold text-amber-300">
                Business/political profiles normally keep this OFF. Only enable it if you intentionally want the fan system here.
              </p>
            )}
          </div>
          <Toggle label="Enabled" checked={fansCardEnabled} onChange={setFansCardEnabled} />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {duplicate && (
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-black text-amber-300">
            <span aria-hidden>⚠️</span>
            {duplicate.code === "CELEBRITY_EXISTS"
              ? "Celebrity Already Added"
              : duplicate.code === "IMAGE_EXISTS"
                ? "Image Already Added"
                : "URL Already Taken"}
          </div>
          <p className="mt-1 text-sm leading-5 text-amber-200">
            {duplicate.message ?? "This record is already in your CelebrityPass database."}{" "}
            This celebrity was <strong>not saved a second time</strong> — nothing was duplicated or overwritten.
          </p>
          {duplicate.existing && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={`/admin/celebrities/${duplicate.existing.id}`}
                className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-ink-900 transition hover:bg-amber-300"
              >
                View Existing Celebrity →
              </a>
              <span className="text-xs text-amber-200/70">/celebrity/{duplicate.existing.slug}</span>
            </div>
          )}
        </div>
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
          <select
            value={ALL_CATEGORIES.includes(category) ? category : ""}
            onChange={(e) => selectCategory(e.target.value)}
            className={inputCls}
          >
            <option value="">— Choose a category —</option>
            {PROFILE_TYPES.map((ct) => (
              <optgroup key={ct.value} label={ct.label}>
                {CATEGORY_OPTIONS[ct.value].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            ))}
            {category && !ALL_CATEGORIES.includes(category) && (
              <optgroup label="Custom (legacy)">
                <option value={category}>{category}</option>
              </optgroup>
            )}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Choose the category that best describes this person. “Public Figure” and other legacy values remain but are
            discouraged.
          </p>
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

      {/* Biography */}
      <div className="mt-5">
        <label className={labelCls}>Biography</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={`${inputCls} resize-y`}
          rows={4}
          placeholder="A short paragraph about this person, shown at the top of the public community page. Leave empty to show none."
        />
        <p className="mt-1 text-xs text-zinc-500">
          Shown as the intro on /celebrity/{slug || "…"} · used for the page&apos;s meta description when there is no
          knowledge-panel tagline.
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
            value={
              profileChanged || mode === "create"
                ? (profileImage ?? null)
                : celebrity?.hasProfileImage && celebrity?.slug
                  ? `/images/${celebrity.slug}/profile`
                  : null
            }
            onPick={(data) => {
              setProfileImage(data);
              setProfileChanged(true);
            }}
            onRemove={() => {
              setProfileImage(null);
              setProfileChanged(true);
            }}
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-300">Cover Image</span>
          </div>
          <ImageUpload
            label=""
            value={
              coverChanged || mode === "create"
                ? (coverImage ?? null)
                : celebrity?.hasCoverImage && celebrity?.slug
                  ? `/images/${celebrity.slug}/cover`
                  : null
            }
            onPick={(data) => {
              setCoverImage(data);
              setCoverChanged(true);
            }}
            onRemove={() => {
              setCoverImage(null);
              setCoverChanged(true);
            }}
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
            <p>
              {scanMessage}{" "}
              <Link href="/admin/ai-settings" className="underline">
                Open AI Settings
              </Link>
            </p>
            {scanDetail && <p className="mt-2 text-xs leading-5 text-rose-200/80">{scanDetail}</p>}
          </div>
        )}

        {scanState === "done" && scanResult && (
          <div className="mt-5 space-y-5">
            {scanMeta.used && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
                Scanned with <strong>{scanMeta.used}</strong>
                {scanMeta.skipped.length > 0 && (
                  <span className="text-zinc-400">
                    {" "}
                    · skipped blocked keys: {scanMeta.skipped.join(", ")}
                  </span>
                )}
              </div>
            )}
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

            {investorPreview && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-4 py-4">
                <h3 className="text-xs font-black uppercase tracking-[0.15em] text-amber-300">
                  Person-specific business / investment info (found for {name})
                </h3>
                <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                  Saved strictly under this person&apos;s own profile id. Only verified, sourced facts are kept — never
                  invented, never copied from another person. Review every field before creating.
                </p>
                {investorPreview.sector && (
                  <p className="mt-3 text-sm text-zinc-200">
                    <span className="font-bold text-zinc-400">Sector:</span> {investorPreview.sector}
                  </p>
                )}
                {investorPreview.overview && (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    <span className="font-bold text-zinc-400">Overview:</span> {investorPreview.overview}
                  </p>
                )}
                {investorPreview.ventures && (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    <span className="font-bold text-zinc-400">Ventures &amp; roles:</span> {investorPreview.ventures}
                  </p>
                )}
                {(investorPreview.sources?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Sources</p>
                    {(investorPreview.sources ?? []).map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-sky-300 underline underline-offset-2 hover:text-sky-200"
                      >
                        {s.label || s.url}
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-zinc-500">
                  {investorPreview.verified ? "Marked as verified." : "Not yet marked verified."} You can finish the
                  verification details on the community page after saving.
                </p>
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

      {/* Social links — the four permanent, verified platforms only */}
      <div className="mt-6">
        <h2 className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400">Social Links</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Only Facebook, Instagram, TikTok, and Google are supported. Links must be the celebrity&apos;s real verified
          official profiles — never fan pages, impersonators, or guessed URLs. Leave a platform empty when it cannot be
          verified.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["facebook", "Facebook"],
              ["instagram", "Instagram"],
              ["tiktok", "TikTok"],
              ["google", "Google"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <input
                value={socials[key] ?? ""}
                onChange={(e) => setSocials((s) => ({ ...s, [key]: e.target.value }))}
                className={inputCls}
                placeholder={
                  key === "google"
                    ? "https://www.google.com/search?q=…"
                    : `https://www.${key === "facebook" ? "facebook.com" : key === "instagram" ? "instagram.com" : "tiktok.com"}/…`
                }
              />
            </div>
          ))}
        </div>
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
        No tiers prepared. The standard Silver → VIP base tiers are created
        automatically with your community — edit them from the community page
        afterward if needed.
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