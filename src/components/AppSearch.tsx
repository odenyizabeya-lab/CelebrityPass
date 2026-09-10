"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold text-white"
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
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        highlighted ? "bg-zinc-100" : "hover:bg-zinc-50"
      }`}
    >
      {item.profileImageUrl ? (
        <Image
          src={item.profileImageUrl}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <AvatarFallback name={item.name} accent={item.accentColor} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold text-zinc-900">{item.name}</span>
          {item.isVerified && (
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-sky-500" fill="currentColor" aria-label="Verified">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.6 2.2a2.5 2.5 0 013.5-.8l.9.6.9-.6a2.5 2.5 0 013.5.8l.6.9.7.4a2.5 2.5 0 012 2.8v1.1l.9.7a2.5 2.5 0 01.5 3.6l-.6.9.6.9a2.5 2.5 0 01-1 3l-.9.6v1a2.5 2.5 0 01-3 2.4l-1-.2-.9.7a2.5 2.5 0 01-3.6-.5l-.6-.9-1 .2a2.5 2.5 0 01-2.9-2.4v-1l-.9-.6a2.5 2.5 0 01-.5-3.6l.6-.9-.6-.9a2.5 2.5 0 011-3l.9-.6v-1a2.5 2.5 0 012.8-2.8l1 .2.8-.7a2.5 2.5 0 01.8-.6zM11 15.8l5.2-5.2-1.4-1.4L11 13l-2.2-2.2-1.4 1.4L11 15.8z"
              />
            </svg>
          )}
        </span>
        <span className="block truncate text-sm text-zinc-500">
          {item.category}
          {item.tagline ? ` · ${item.tagline}` : item.profession ? ` · ${item.profession}` : ""}
        </span>
      </span>
      <span className="ml-auto shrink-0 rounded-full bg-gradient-to-r from-primary-600 to-accent-500 px-3.5 py-1.5 text-xs font-bold text-white">
        View Profile
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

export default function AppSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const submitBrowse = (raw: string) => {
    const query = raw.trim();
    if (query) {
      pushRecent(query);
      router.push(`/celebrities?search=${encodeURIComponent(query)}`);
    } else {
      router.push("/celebrities");
    }
    setOpen(false);
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
        pushRecent(results[highlight].name);
        setOpen(false);
        router.push(`/celebrity/${results[highlight].slug}`);
      } else {
        submitBrowse(q);
      }
    }
  };

  const startVoice = () => {
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

  const pickImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const preview = String(reader.result);
      try {
        const small = await downscaleImage(preview);
        setVisual({ open: true, preview: small, busy: true, status: "Identifying the person in this photo…", name: null });
        const res = await fetch("/api/celebrities/visual-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: small }),
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

  const closeAll = () => {
    setOpen(false);
    setVisual((v) => ({ ...v, open: false }));
    setNotice(null);
  };

  const showState = open || visual.open;
  const emptyIdle = open && !q.trim() && !visual.open;

  return (
    <div ref={rootRef} className="relative z-20 mx-auto mt-9 w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitBrowse(q);
        }}
        className="flex items-center gap-2 rounded-3xl bg-white p-2 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5 sm:p-2.5"
        role="search"
      >
        <svg className="ml-3 h-6 w-6 shrink-0 text-zinc-400 sm:ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setFetchedOnce(true);
          }}
          onFocus={() => {
            setOpen(true);
            setFetchedOnce(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search any celebrity…"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search celebrities"
          className="w-full min-w-0 flex-1 bg-transparent py-3.5 text-base font-medium text-zinc-900 placeholder-zinc-400 outline-none sm:text-lg"
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={startVoice}
            aria-label="Voice search"
            title="Voice search"
            className={`grid h-12 w-12 place-items-center rounded-2xl transition sm:h-11 sm:w-11 ${
              listening ? "bg-red-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {listening ? (
                <rect x="9" y="2" width="6" height="12" rx="3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a4 4 0 004-4V8a4 4 0 10-8 0v6a4 4 0 004 4zm5-4a5 5 0 01-10 0m5 4v3m-3 0h6" />
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Search by photo"
            title="Search by photo"
            className="grid h-12 w-12 place-items-center rounded-2xl text-zinc-600 transition hover:bg-zinc-100 sm:h-11 sm:w-11"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.8 6.8h10.4A1.8 1.8 0 0119 8.6v9.6a1.8 1.8 0 01-1.8 1.8H6.8A1.8 1.8 0 015 18.2V8.6a1.8 1.8 0 011.8-1.8zm0 0l2.2-2.3a2 2 0 011.4-.6h3.2a2 2 0 011.4.6l2.2 2.3M12 16.2a3.3 3.3 0 100-6.6 3.3 3.3 0 000 6.6z" />
            </svg>
          </button>
          <input
            ref={(el) => {
              if (el) el.value = "";
            }}
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
          <button
            type="submit"
            className="btn-grad grid h-12 place-items-center rounded-2xl px-4 font-bold text-white sm:h-11 sm:px-5 sm:text-sm"
          >
            <span className="hidden sm:inline">Search</span>
            <svg className="h-5 w-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        </div>
      </form>

      {listening && (
        <p className="mt-2 flex items-center justify-center gap-2 text-sm font-medium text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
          Listening… speak the celebrity name.
        </p>
      )}
      {notice && !listening && (
        <p className="mt-2 rounded-full bg-white px-4 py-2 text-center text-sm font-medium text-zinc-900 shadow-lg">{notice}</p>
      )}

      {showState && (
        <div className="mt-2 overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-black/5">
          {visual.open ? (
            /* ===== Visual search panel ===== */
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                {visual.preview && (
                  <Image
                    src={visual.preview}
                    alt="Selected photo"
                    width={96}
                    height={96}
                    className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-zinc-200"
                    unoptimized
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-zinc-900">Visual search</p>
                  {visual.busy ? (
                    <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-primary-600" />
                      {visual.status}
                    </p>
                  ) : visual.status ? (
                    <p className="mt-1 text-sm text-zinc-500">{visual.status}</p>
                  ) : (
                    <div className="mt-1">
                      <p className="text-sm text-zinc-500">
                        We recognized <span className="font-bold text-zinc-900">{visual.name ?? "this person"}</span>, but they
                        don&apos;t have a CelebrityPass community yet. Try another photo or type a name.
                      </p>
                      <button
                        type="button"
                        onClick={() => submitBrowse(q || (visual.name ?? ""))}
                        className="mt-3 rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
                      >
                        Search like this
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeAll}
                  aria-label="Close visual search"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            /* ===== Autocomplete dropdown ===== */
            <div className="max-h-[70vh] overflow-y-auto p-1.5">
              {loading && !results.length && fetchedOnce && (
                <div className="flex items-center gap-3 px-4 py-4">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-primary-600" />
                  <span className="text-sm font-medium text-zinc-500">Searching celebrities…</span>
                </div>
              )}

              {!loading && q.trim() && results.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-base font-bold text-zinc-900">No celebrity found</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-500">
                    Check the spelling or try another name — every celebrity on CelebrityPass is searchable here.
                  </p>
                  <button
                    type="button"
                    onClick={() => submitBrowse(q)}
                    className="mt-3 rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
                  >
                    Browse the directory instead
                  </button>
                </div>
              )}

              {results.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {trending ? "Trending celebrities" : "Matching celebrities"}
                  </p>
                  <div onMouseLeave={() => setHighlight(-1)}>
                    {results.map((item, i) => (
                      <ResultRow key={item.id} item={item} highlighted={highlight === i && !loading} onPress={() => setHighlight(i)} />
                    ))}
                  </div>
                </div>
              )}

              {emptyIdle && !loading && (
                <div className="p-1.5">
                  <div className="px-2 pt-2">
                    {recent.length > 0 && (
                        <>
                          <p className="pb-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Recent searches</p>
                          <div className="flex flex-wrap gap-2">
                            {recent.map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  pushRecent(r);
                                  setQ(r);
                                  runSearch(r);
                                }}
                                className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                              >
                                <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                                </svg>
                                {r}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <p className="pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Trending</p>
                      <div className="flex flex-wrap gap-2 pb-2">
                        {results.slice(0, 6).map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              pushRecent(r.name);
                              setQ(r.name);
                              runSearch(r.name);
                            }}
                            className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}