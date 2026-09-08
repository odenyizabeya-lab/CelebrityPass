"use client";

import { useCallback, useEffect, useState } from "react";
import { CopyUrl, EmptyState, fmtDate, PlatformMark, SourceBadge, StatusBadge, api } from "./SocialUI";

interface Post {
  id: string;
  title: string;
  caption: string;
  platformKey: string;
  platformName: string;
  platformColor: string;
  accountUsername: string | null;
  source: string;
  contentType: string;
  externalPostId: string | null;
  externalUrl: string | null;
  status: string;
  error: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

export default function PostsList({ failedOnly = false }: { failedOnly?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("");

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (platform) qs.set("platform", platform);
      if (failedOnly) qs.set("status", "FAILED");
      const d = await api<{ posts: Post[] }>(`/api/social/admin/posts?${qs.toString()}`);
      setPosts(d.posts);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [platform, failedOnly]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">{failedOnly ? "Failed Posts" : "Published Posts"}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {failedOnly ? "Posts the platform rejected. Retry them from the Queue." : "Every post published through the platform APIs."}
          </p>
        </div>
        <input
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          placeholder="Filter by platform…"
          className="w-56 rounded-xl border border-white/10 bg-ink-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
        />
      </div>

      {loading ? (
        <p className="py-16 text-center text-zinc-500">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState text={failedOnly ? "No failed posts. You're all clear." : "Nothing published yet."} />
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <article key={p.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <PlatformMark name={p.platformName} color={p.platformColor} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-white">{p.title}</h3>
                      <StatusBadge status={p.status} />
                      <SourceBadge source={p.source} />
                    </div>
                    <p className="mt-0.5 text-xs capitalize text-zinc-500">
                      {p.contentType} · {p.platformName}
                      {p.accountUsername ? ` · @${p.accountUsername}` : ""} · {p.publishedAt ? `published ${fmtDate(p.publishedAt)}` : `created ${fmtDate(p.createdAt)}`}
                    </p>
                  </div>
                </div>
                <CopyUrl value={p.externalUrl} />
              </div>
              {p.caption && <p className="mt-3 line-clamp-3 max-w-3xl text-sm text-zinc-400">{p.caption}</p>}
              {p.error && <p className="mt-2 rounded-xl bg-rose-500/10 px-4 py-2 text-xs text-rose-300">{p.error}</p>}
              {p.externalPostId && <p className="mt-2 text-[11px] text-zinc-600">post id: {p.externalPostId}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}