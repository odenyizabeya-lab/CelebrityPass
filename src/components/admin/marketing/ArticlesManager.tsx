"use client";

import { useCallback, useEffect, useState } from "react";
import { api, EmptyState, fmtDate, StatusBadge } from "./SocialUI";

interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  author: string | null;
  category: string | null;
  coverImage: string | null;
  status: string;
  autoPostEnabled: boolean;
  linkedCelebrity: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

const inputCls = "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";

export default function ArticlesManager() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<{ articles: Article[] }>("/api/social/admin/articles");
      setArticles(d.articles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Title required.");
    setSaving(true);
    setError(null);
    try {
      await api("/api/social/admin/articles", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), summary: summary.trim() || undefined, author: author.trim() || undefined, category: category.trim() || undefined }),
      });
      setTitle("");
      setSummary("");
      setAuthor("");
      setCategory("");
      setShowForm(false);
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not create article");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, patchBody: Record<string, unknown>) => {
    setError(null);
    try {
      await api(`/api/social/admin/articles/${id}`, { method: "PUT", body: JSON.stringify(patchBody) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    await fetch(`/api/social/admin/articles/${id}`, { method: "DELETE" }).catch(() => undefined);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">News &amp; Articles</h1>
          <p className="mt-1 text-sm text-zinc-400">Marketplace news that can be auto-posted to your platforms when schedules run.</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white">
          {showForm ? "Cancel" : "New article"}
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="glass rounded-3xl p-6">
          <div className="space-y-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Article title *" />
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={inputCls} placeholder="Summary for the auto-generated caption…" />
            <div className="grid gap-4 sm:grid-cols-2">
              <input value={author} onChange={(e) => setAuthor(e.target.value)} className={inputCls} placeholder="Author" />
              <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls} placeholder="Category (News)" />
            </div>
            <button type="submit" disabled={saving} className="rounded-full bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
              {saving ? "Creating…" : "Create draft"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-16 text-center text-zinc-500">Loading…</p>
      ) : articles.length === 0 ? (
        <div className="glass rounded-3xl"><EmptyState text="No articles yet. Create your first one." /></div>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <article key={a.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-white">{a.title}</h3>
                    <StatusBadge status={a.status} />
                    {a.autoPostEnabled ? (
                      <span className="rounded-full bg-fuchsia-500/15 px-2.5 py-1 text-[11px] font-bold text-fuchsia-300">auto-post on</span>
                    ) : (
                      <span className="rounded-full bg-zinc-500/15 px-2.5 py-1 text-[11px] font-bold text-zinc-400">auto-post off</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {[a.category, a.author, a.linkedCelebrity].filter(Boolean).join(" · ") || "Draft"} · created {fmtDate(a.createdAt)}
                    {a.publishedAt ? ` · published ${fmtDate(a.publishedAt)}` : ""}
                  </p>
                  {a.summary && <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-zinc-400">{a.summary}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => patch(a.id, { autoPostEnabled: !a.autoPostEnabled })} className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">
                    Toggle auto-post
                  </button>
                  {a.status !== "PUBLISHED" && (
                    <button onClick={() => patch(a.id, { status: "PUBLISHED" })} className="rounded-full border border-emerald-400/40 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10">
                      Publish
                    </button>
                  )}
                  {a.status === "PUBLISHED" && (
                    <button onClick={() => patch(a.id, { status: "DRAFT" })} className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5">
                      Unpublish
                    </button>
                  )}
                  <button onClick={() => remove(a.id)} className="rounded-full border border-rose-500/30 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10">
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}