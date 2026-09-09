"use client";

import { useState } from "react";
import type { MembershipLevel } from "@prisma/client";

export default function MembershipsManager({
  celebrityId,
  initial,
}: {
  celebrityId: string;
  initial: MembershipLevel[];
}) {
  const [items, setItems] = useState<MembershipLevel[]>(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/celebrities/${celebrityId}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          benefits,
          price: price === "" ? null : Number(price),
          currency,
          displayOrder: items.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add level.");
        setBusy(false);
        return;
      }
      setItems((prev) => [...prev, data.membership]);
      setName("");
      setDescription("");
      setBenefits("");
      setPrice("");
      setBusy(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/memberships/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) return false;
    const json = await res.json();
    setItems((prev) => prev.map((m) => (m.id === id ? json.membership : m)));
    return true;
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this membership level? Existing cards will keep their level reference.")) return;
    const res = await fetch(`/api/memberships/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((m) => m.id !== id));
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500";

  return (
    <div className="glass rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black tracking-tight">Membership Levels</h2>
        <span className="text-xs text-zinc-500">These tiers show on the community page and during registration.</span>
      </div>
      {saved && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
          ✓ Level saved successfully
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {items.length > 0 && (
        <ul className="mt-5 divide-y divide-white/[0.05]">
          {items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-white">
                    <span className="mr-2 text-xs font-black uppercase text-zinc-500">Lv {m.displayOrder + 1}</span>
                    {m.name}
                  </p>
                  {!m.isActive && <span className="rounded-full bg-zinc-600/20 px-2 py-0.5 text-[10px] font-bold text-zinc-400">Hidden</span>}
                </div>
                <p className="truncate text-xs text-zinc-500">{m.description ?? m.benefits ?? "No description"}</p>
                <LevelPriceEditor level={m} onSave={(d) => patch(m.id, d)} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => patch(m.id, { isActive: !m.isActive })}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white"
                >
                  {m.isActive ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => remove(m.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-400/80 ring-1 ring-rose-500/20 transition hover:text-rose-300"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="mt-5 grid gap-3 border-t border-white/[0.06] pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Level name (e.g. VIP)" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="Tagline / one-line description" />
        <textarea
          value={benefits}
          onChange={(e) => setBenefits(e.target.value)}
          className={`${inputCls} resize-y sm:col-span-2 lg:col-span-3`}
          rows={4}
          placeholder={"Benefits list — one per line:\nPrivate one-on-one meet & greet\nSigned collector's photo\nPriority event access"}
        />
        <div className="flex gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} placeholder="Price (USD) *" type="number" min="0.01" step="0.01" required />
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputCls} w-20`} placeholder="USD" />
        </div>
        <button type="submit" disabled={busy} className="btn-grad rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Adding…" : "+ Add Level"}
        </button>
      </form>
      <p className="mt-3 text-xs text-zinc-500">
        Levels priced at <strong>$2,500+</strong> render as premium Signature Experience tiers with the benefit list above
        shown as bullets. Example: <strong>Red Carpet</strong> $2,500 · <strong>The Immortal</strong> $3,000,000.
      </p>
    </div>
  );
}

function LevelPriceEditor({ level, onSave }: { level: MembershipLevel; onSave: (data: { price: number | null; currency: string }) => void }) {
  const [price, setPrice] = useState(level.price == null ? "" : String(level.price));
  const [currency, setCurrency] = useState(level.currency);
  const [saved, setSaved] = useState(false);

  const save = () => {
    onSave({
      price: price.trim() === "" ? null : Number(price),
      currency: currency.trim() || "USD",
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Price</span>
      <input
        type="number"
        min={0.01}
        step="0.01"
        value={price}
        placeholder="0.00"
        onChange={(e) => setPrice(e.target.value)}
        onBlur={save}
        className="w-28 rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
      />
      <input
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        onBlur={save}
        className="w-16 rounded-lg border border-white/10 bg-ink-800 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary-500"
      />
      <button
        type="button"
        onClick={save}
        className="rounded-lg px-3 py-1.5 text-xs font-bold text-white ring-1 ring-white/15 transition hover:bg-white/10"
      >
        Update
      </button>
      {saved && <span className="text-xs font-semibold text-emerald-300">Saved ✓</span>}
      <span className="text-[11px] text-zinc-500">Base tiers below $2,500; ladder uses $2,500+.</span>
    </div>
  );
}