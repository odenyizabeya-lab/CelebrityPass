"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import VerifiedBadge from "@/components/VerifiedBadge";
import { fetchWithTimeout } from "@/lib/client-http";

type SearchItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  profession: string;
  tagline: string | null;
  profileImageUrl: string | null;
  isVerified: boolean;
  accentColor: string;
  fanCount: number;
  country: string;
};

const RECENT_KEY = "cp:recent-searches";
const RECENT_MAX = 6;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(q: string) {
  if (typeof window === "undefined" || !q.trim()) return;
  try {
    const next = [q.trim(), ...loadRecent().filter((x) => x !== q.trim())].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — skip history */
  }
}

function removeRecent(q: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(loadRecent().filter((x) => x !== q)));
  } catch {
    /* ignore */
  }
}

/** Compact follower-style count ("1.2M fans") like a real social app. */
function formatCount(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}K`;
  }
  if (n < 1_000_000_000) {
    const m = n / 1_000_000;
    return `${m >= 100 ? Math.round(m) : m.toFixed(1)}M`;
  }
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

/** Downscale + compress a camera/photo file so visual search stays fast. */
function downscaleImage(dataUri: string, maxSide = 900, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = dataUri;
  });
}

function AvatarFallback({ name, accent }: { name: string; accent: string }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl font-bold text-white"
      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}66)` }}
    >
      {initial}
    </span>
  );
}

function ResultRow({ item, highlighted, onPress }: { item: SearchItem; highlighted: boolean; onPress: () => void }) {
  return (
    <Link
      href={`/celebrity/${item.slug}`}
      onMouseEnter={onPress}
      onFocus={onPress}
      onClick={() => saveRecent(item.name)}
      className={`flex w-full items-center gap-3 border-b border-[#222d34] px-4 py-3 transition-colors sm:px-5 ${
        highlighted ? "bg-white/[0.05]" : "active:bg-white/[0.05]"
      }`}
    >
      {item.profileImageUrl ? (
        <Image
          src={item.profileImageUrl}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <AvatarFallback name={item.name} accent={item.accentColor} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[15px] font-bold text-white">{item.name}</span>
          {item.isVerified && <VerifiedBadge className="h-[1.1em] w-[1.1em] shrink-0" />}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-zinc-400">
          {item.category}
          {item.profession ? ` · ${item.profession}` : ""}
          {item.country ? ` · ${item.country}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2.5 text-right">
        <span className="text-[11px] font-bold text-zinc-500">{formatCount(item.fanCount)} fans</span>
        <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </span>
    </Link>
  );
}

type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export default function AppSearch({ placeholder = "Search any celebrity…" }: { placeholder?: string }) {
  const router = useRouter();
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [trending, setTrending] = useState(false);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [highlight, setHighlight] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [visual, setVisual] = useState<{ open: boolean; preview: string | null; busy: boolean; status: string | null; name: string | null }>({
    open: false,
    preview: null,
    busy: false,
    status: null,
    name: null,
  });
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const pushRecent = useCallback((term: string) => {
    saveRecent(term);
    setRecent(loadRecent());
  }, []);

  const runSearch = useCallback(
    (raw: string) => {
      const query = raw.trim();
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const url = query ? `/api/celebrities/search?q=${encodeURIComponent(query)}` : "/api/celebrities/search";
      setLoading(true);
      setNotice(null);
      fetch(url, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: { results: SearchItem[]; trending: boolean }) => {
          if (ctrl.signal.aborted) return;
          setResults(data.results);
          setTrending(data.trending);
          setLoading(false);
          setHighlight(0);
        })
        .catch(() => {
          if (ctrl.signal.aborted) return;
          setLoading(false);
          setNotice("Something went wrong. Check your connection and try again.");
        });
    },
    [],
  );

  const closeAll = () => {
    setOpen(false);
    setVisual((v) => ({ ...v, open: false }));
    setNotice(null);
    setListening(false);
    recogRef.current?.stop?.();
  };

  // Native-app behavior: full-screen search open = keyboard up + body locked.
  useEffect(() => {
    if (!open && !visual.open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => overlayInputRef.current?.focus(), 120);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open, visual.open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [q, results, visual.open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submitBrowse = (raw: string) => {
    const query = raw.trim();
    if (query) {
      pushRecent(query);
      router.push(`/celebrities?search=${encodeURIComponent(query)}`);
    } else {
      router.push("/celebrities");
    }
    closeAll();
  };

  const goTo = (item: SearchItem) => {
    pushRecent(item.name);
    closeAll();
    router.push(`/celebrity/${item.slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (results.length ? (h + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (results.length ? (h - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlight]) {
        goTo(results[highlight]);
      } else {
        submitBrowse(q);
      }
    }
  };

  const startVoice = () => {
    setOpen(true);
    setNotice(null);
    const w = window as unknown as {
      SpeechRecognition?: new () => VoiceRecognition;
      webkitSpeechRecognition?: new () => VoiceRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SR) {
      setNotice("Voice search isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    let rec: VoiceRecognition;
    try {
      rec = new SR();
    } catch {
      setNotice("Voice search couldn't start on this device.");
      return;
    }
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript ?? "";
      if (t) {
        pushRecent(t);
        setQ(t);
        runSearch(t);
      }
    };
    rec.onerror = (e) => setNotice(e.error === "not-allowed" ? "Microphone permission was denied." : `Voice search: ${e.error ?? "unavailable"}. Try typing instead.`);
    rec.onend = () => setListening(false);
    recogRef.current = rec;
    try {
      rec.start();
      setListening(true);
      setNotice("Listening… speak the celebrity name.");
    } catch {
      setNotice("Voice search couldn't start on this device.");
    }
  };

  const openPhotoSearch = () => {
    setOpen(true);
    setVisual((v) => ({ ...v, open: false }));
    window.setTimeout(() => fileInputRef.current?.click(), 150);
  };

  const pickImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const preview = String(reader.result);
      try {
        const small = await downscaleImage(preview);
        setVisual({ open: true, preview: small, busy: true, status: "Identifying the person in this photo…", name: null });
        const res = await fetchWithTimeout("/api/celebrities/visual-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: small }),
          timeoutMs: 30_000,
        });
        const data = (await res.json().catch(() => null)) as {
          outcome?: {
            status: "found" | "not_identified" | "not_found" | "provider_error";
            community?: { id: string; slug: string; name: string };
            reason?: string | null;
            name?: string | null;
            message?: string;
          };
        } | null;
        const o = data?.outcome;
        if (o?.status === "found" && o.community) {
          setVisual({ open: false, preview: null, busy: false, status: null, name: null });
          pushRecent(o.community.name);
          setQ(o.community.name);
          runSearch(o.community.name);
        } else if (o?.status === "not_found") {
          setVisual({ open: true, preview: small, busy: false, status: null, name: o?.name ?? null });
        } else if (o?.status === "not_identified") {
          setVisual({ open: true, preview: small, busy: false, status: o?.reason ?? "We couldn't clearly identify who's in this photo.", name: null });
        } else {
          setVisual({ open: true, preview: small, busy: false, status: o?.message ?? "Visual search isn't available right now. Try typing the name instead.", name: null });
        }
      } catch {
        setVisual({ open: true, preview, busy: false, status: "Couldn't run visual search on this image. Try typing the name instead.", name: null });
      }
    };
    reader.readAsDataURL(file);
  };

  const startQuery = (term: string) => {
    pushRecent(term);
    setQ(term);
    runSearch(term);
  };

  const overlayOpen = open || visual.open;
  const emptyIdle = open && !q.trim() && !visual.open;

  const headerIconCls =
    "grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-300 transition hover:bg-white/[0.07] active:bg-white/[0.1]";

  const hero = (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open search"
      onClick={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      className="relative z-20 mx-auto mt-9 flex w-full max-w-2xl cursor-pointer select-none items-center gap-2 rounded-3xl bg-white p-2 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition hover:bg-zinc-50 sm:p-2.5"
    >
      <svg className="ml-3 h-6 w-6 shrink-0 text-zinc-400 sm:ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
      <span className="w-full min-w-0 flex-1 truncate py-3.5 text-left text-base font-medium text-zinc-400 sm:text-lg">
        {placeholder}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          startVoice();
        }}
        aria-label="Voice search"
        title="Voice search"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-zinc-600 transition hover:bg-zinc-100 sm:h-11 sm:w-11"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a4 4 0 004-4V8a4 4 0 10-8 0v6a4 4 0 004 4zm5-4a5 5 0 01-10 0m5 4v3m-3 0h6" />
        </svg>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openPhotoSearch();
        }}
        aria-label="Search by photo"
        title="Search by photo"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-zinc-600 transition hover:bg-zinc-100 sm:h-11 sm:w-11"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.8 6.8h10.4A1.8 1.8 0 0119 8.6v9.6a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 18.2V8.6a1.8 1.8 0 011.8-1.8zm0 0l2.2-2.3a2 2 0 011.4-.6h3.2a2 2 0 011.4.6l2.2 2.3M12 16.2a3.3 3.3 0 100-6.6 3.3 3.3 0 000 6.6z" />
        </svg>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickImage(f);
          e.target.value = "";
        }}
      />
      <span className="mx-1 hidden h-6 w-px bg-zinc-200 sm:block" />
      <span className="btn-grad grid h-12 shrink-0 place-items-center rounded-2xl px-4 font-bold text-white sm:h-11 sm:px-5 sm:text-sm">
        Search
      </span>
    </div>
  );

  const overlay = overlayOpen
    ? createPortal(
        <div className="search-overlay fixed inset-0 z-[100] flex flex-col bg-[#0b141a]">
          {/* header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-[#222d34] bg-[#111b21] px-3 pb-2 pt-[max(env(safe-area-inset-top),0.625rem)] sm:gap-3 sm:px-4">
            <button type="button" onClick={closeAll} aria-label="Close search" className={headerIconCls}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[#202c33] px-3.5 py-1.5 ring-1 ring-inset ring-white/[0.06] transition focus-within:ring-white/20">
              <svg className="h-5 w-5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={overlayInputRef}
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setOpen(true);
                  setFetchedOnce(true);
                }}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                aria-label="Search celebrities"
                className="w-full min-w-0 flex-1 bg-transparent py-2 text-base font-medium text-white placeholder-zinc-400 outline-none sm:text-lg"
              />
              {q.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-zinc-300 transition hover:bg-white/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={startVoice}
              aria-label="Voice search"
              title="Voice search"
              className={`${headerIconCls} ${listening ? "bg-red-600 text-white hover:bg-red-600" : ""}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {listening ? <rect x="9" y="2" width="6" height="12" rx="3" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a4 4 0 004-4V8a4 4 0 10-8 0v6a4 4 0 004 4zm5-4a5 5 0 01-10 0m5 4v3m-3 0h6" />}
              </svg>
            </button>
            <button type="button" onClick={openPhotoSearch} aria-label="Search by photo" title="Search by photo" className={headerIconCls}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.8 6.8h10.4A1.8 1.8 0 0119 8.6v9.6a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 18.2V8.6a1.8 1.8 0 011.8-1.8zm0 0l2.2-2.3a2 2 0 011.4-.6h3.2a2 2 0 011.4.6l2.2 2.3M12 16.2a3.3 3.3 0 100-6.6 3.3 3.3 0 000 6.6z" />
              </svg>
            </button>
          </div>

          {/* body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {visual.open ? (
              /* ===== Visual search panel ===== */
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  {visual.preview && (
                    <Image
                      src={visual.preview}
                      alt="Selected photo"
                      width={112}
                      height={112}
                      className="h-28 w-28 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                      unoptimized
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-black text-white">Visual search</p>
                    {visual.busy ? (
                      <p className="mt-1.5 flex items-center gap-2 text-sm text-zinc-400">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-[#00a884]" />
                        {visual.status}
                      </p>
                    ) : visual.status ? (
                      <p className="mt-1.5 text-sm text-zinc-400">{visual.status}</p>
                    ) : (
                      <div className="mt-1.5">
                        <p className="text-sm text-zinc-400">
                          We recognized <span className="font-bold text-white">{visual.name ?? "this person"}</span>, but they
                          don&apos;t have a CelebrityPass community yet. Try another photo or type a name.
                        </p>
                        <button
                          type="button"
                          onClick={() => submitBrowse(q || (visual.name ?? ""))}
                          className="btn-grad mt-4 rounded-full px-5 py-2 text-sm font-bold text-white"
                        >
                          Search like this
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-h-full">
                {loading && !results.length && fetchedOnce && (
                  <div className="flex items-center gap-3 px-5 py-5">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-[#00a884]" />
                    <span className="text-sm font-medium text-zinc-400">Searching celebrities…</span>
                  </div>
                )}

                {!loading && q.trim() && results.length === 0 && (
                  <div className="px-5 py-14 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/[0.05]">
                      <svg className="h-7 w-7 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-lg font-bold text-white">No celebrity found</p>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-400">
                      Check the spelling or try another name — every celebrity on CelebrityPass is searchable here.
                    </p>
                    <button
                      type="button"
                      onClick={() => submitBrowse(q)}
                      className="btn-grad mt-5 rounded-full px-5 py-2 text-sm font-bold text-white"
                    >
                      Browse the directory instead
                    </button>
                  </div>
                )}

                {emptyIdle && !loading && (
                  <div className="pb-10">
                    {recent.length > 0 && (
                      <div>
                        <p className="px-4 pb-1 pt-5 text-xs font-bold uppercase tracking-wider text-zinc-500 sm:px-5">
                          Recent searches
                        </p>
                        {recent.map((r) => (
                          <div
                            key={r}
                            className="flex w-full items-center gap-3 border-b border-[#222d34] px-4 py-3.5 sm:px-5"
                          >
                            <button
                              type="button"
                              onClick={() => startQuery(r)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <svg className="h-5 w-5 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                              </svg>
                              <span className="truncate text-[15px] font-medium text-white">{r}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeRecent(r);
                                setRecent(loadRecent());
                              }}
                              aria-label={`Remove ${r} from recent searches`}
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-500 transition hover:bg-white/[0.07] hover:text-zinc-300"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="px-4 pb-1 pt-5 text-xs font-bold uppercase tracking-wider text-zinc-500 sm:px-5">Trending</p>
                    {results.length > 0 ? (
                      results.slice(0, 6).map((item, i) => (
                        <ResultRow key={item.id} item={item} highlighted={highlight === i && !loading} onPress={() => setHighlight(i)} />
                      ))
                    ) : (
                      <p className="px-4 py-8 text-center text-sm text-zinc-500 sm:px-5">No trending communities right now.</p>
                    )}

                    <div className="px-4 pt-8 sm:px-5">
                      <button
                        type="button"
                        onClick={() => submitBrowse("")}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                      >
                        Browse the directory
                      </button>
                    </div>
                  </div>
                )}

                {!emptyIdle && q.trim() && results.length > 0 && (
                  <div>
                    <p className="px-4 pb-1 pt-5 text-xs font-bold uppercase tracking-wider text-zinc-500 sm:px-5">
                      {trending ? "Trending celebrities" : "Matching celebrities"}
                    </p>
                    <div onMouseLeave={() => setHighlight(-1)}>
                      {results.map((item, i) => (
                        <ResultRow key={item.id} item={item} highlighted={highlight === i && !loading} onPress={() => setHighlight(i)} />
                      ))}
                    </div>
                  </div>
                )}

                {listening && (
                  <p className="flex items-center gap-2 px-5 py-3 text-sm font-medium text-zinc-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    Listening… speak the celebrity name.
                  </p>
                )}
                {notice && !listening && (
                  <p className="px-5 py-3 text-sm font-medium text-zinc-400">{notice}</p>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {hero}
      {overlay}
    </>
  );
}