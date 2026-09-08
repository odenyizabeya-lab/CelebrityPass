"use client";

import { useCallback, useEffect, useState } from "react";
import { api, EmptyState } from "./SocialUI";

interface Platform {
  key: string;
  name: string;
  color: string;
  enabled: boolean;
  supportsText: boolean;
  supportsImage: boolean;
  supportsVideo: boolean;
  accounts: { id: string; username: string | null; isConnected: boolean }[];
}

const inputCls = "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";

export default function ManualComposer() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [platformKey, setPlatformKey] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ platforms: Platform[] }>("/api/social/admin/accounts");
      setPlatforms(d.platforms);
      const connected = d.platforms.filter((p) => p.accounts.length) || d.platforms;
      if (connected[0]) setPlatformKey((k) => k || connected[0].key);
    } catch {
      setPlatforms([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const selected = platformKey ? platforms.find((p) => p.key === platformKey) : undefined;
  const hasAccount = Boolean(selected?.accounts.length);

  const publishNow = async () => {
    if (!platformKey) return setError("Choose a platform.");
    if (!caption.trim()) return setError("Write a caption first.");
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const media = mediaUrl.trim()
        ? [{ kind: mediaUrl.match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? "video" : "image", url: mediaUrl.trim(), fileName: "manual-upload", mimeType: null }]
        : [];
      await api<{ postId: string; externalUrl: string | null }>("/api/social/manual/publish", {
        method: "POST",
        body: JSON.stringify({ platformKey, title: title.trim() || undefined, caption: caption.trim(), linkUrl: linkUrl.trim() || undefined, media }),
      });
      setResult({ url: null });
      setTitle("");
      setCaption("");
      setLinkUrl("");
      setMediaUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  const queue = async (status: "DRAFT" | "SCHEDULED") => {
    if (!platformKey) return setError("Choose a platform.");
    if (!title.trim()) return setError("A title is needed to save it to the queue.");
    if (status === "SCHEDULED" && !scheduledFor) return setError("Pick a date/time for a scheduled post.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/social/admin/queue", {
        method: "POST",
        body: JSON.stringify({
          platformKey,
          contentType: "promo",
          source: "MANUAL",
          status,
          title: title.trim(),
          caption: caption.trim() || undefined,
          linkUrl: linkUrl.trim() || undefined,
          mediaJson: mediaUrl.trim() ? [{ kind: mediaUrl.match(/\.(mp4|mov|webm|m4v)(\?|$)/i) ? "video" : "image", url: mediaUrl.trim(), fileName: "manual-upload", mimeType: null }] : undefined,
          scheduledFor: scheduledFor || undefined,
        }),
      });
      setResult({ url: null });
      setTitle("");
      setCaption("");
      setLinkUrl("");
      setMediaUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save to queue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Manual Posting</h1>
        <p className="mt-1 text-sm text-zinc-400">Publish a post right now, or save it as a draft / scheduled item for the queue.</p>      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}
      {result && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">Done{result.url ? ` — ${result.url}` : ""}. Check the Posts page.</div>}

      <div className="glass rounded-3xl p-7">
        <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Platform</label>
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => {
            const connected = p.accounts.length > 0;
            return (
              <button
                key={p.key}
                onClick={() => setPlatformKey(p.key)}
                disabled={!connected}
                className={`rounded-full px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                  platformKey === p.key ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" : connected ? "ring-1 ring-white/10 text-zinc-400 hover:bg-white/5" : "ring-1 ring-white/10 text-zinc-600"
                }`}
              >
                {p.name}
                {!connected && <span className="ml-1.5 text-[10px] font-black text-zinc-600">not connected</span>}
              </button>
            );
          })}
        </div>
        {selected && !hasAccount && (
          <p className="mt-3 text-sm text-amber-300">Connect a {selected.name} account on the Accounts page before publishing.</p>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Title (used for queue/approval)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Meet Kiden on the marketplace" maxLength={160} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Caption *</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className={inputCls}
              placeholder="Write the post text — the platform's real caption rules apply (hashtags, links…)"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Link URL</label>
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={inputCls} placeholder="https://yourplatform.com/…" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Media URL (image/video)</label>
              <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} className={inputCls} placeholder="https://…  (optional)" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button onClick={publishNow} disabled={busy || !hasAccount} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Publishing…" : "Publish now"}
            </button>
            <button onClick={() => queue("DRAFT")} disabled={busy} className="rounded-full border border-white/10 px-6 py-2.5 text-sm font-bold text-zinc-300 hover:bg-white/5 disabled:opacity-50">
              Save draft
            </button>
            <div className="flex items-center gap-2">
              <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className={`${inputCls} w-auto`} />
              <button onClick={() => queue("SCHEDULED")} disabled={busy} className="rounded-full border border-indigo-400/40 px-6 py-2.5 text-sm font-bold text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50">
                Schedule
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">What happens next</p>
        <p className="mt-2 text-sm text-zinc-400">
          <b className="text-white">Publish now</b> sends straight through the platform&apos;s official API and records it in Posts.
          <br />
          <b className="text-white">Draft / Schedule</b> adds an item to the queue (scheduled items fire even when automation is
          paused). Find it under Queue — you can approve, edit or cancel it there.
        </p>
        {!platforms.length && <EmptyState text="No platforms loaded." />}
      </div>
    </div>
  );
}