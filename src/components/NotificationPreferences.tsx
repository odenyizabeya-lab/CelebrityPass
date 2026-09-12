"use client";

import { useState } from "react";
import { fetchWithTimeout } from "@/lib/client-http";

type Prefs = {
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  notifyNewCelebrities: boolean;
  notifyUpdates: boolean;
  notifyCommunity: boolean;
  notifyPromotions: boolean;
  unsubscribedAt: string | null;
};

const CATEGORIES: Array<{
  key: "notifyNewCelebrities" | "notifyUpdates" | "notifyCommunity" | "notifyPromotions";
  label: string;
  description: string;
}> = [
  { key: "notifyNewCelebrities", label: "New celebrity announcements", description: "When a new celebrity joins CelebrityPass." },
  { key: "notifyUpdates", label: "Important CelebrityPass updates", description: "Security and platform-wide news." },
  { key: "notifyCommunity", label: "Community & news updates", description: "Updates about your fav communities and events." },
  { key: "notifyPromotions", label: "Promotional emails", description: "Optional offers and highlights. Off by default on re-subscribe." },
];

export default function NotificationPreferences({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (next: Prefs) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetchWithTimeout("/api/account/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyNewCelebrities: next.notifyNewCelebrities,
          notifyUpdates: next.notifyUpdates,
          notifyCommunity: next.notifyCommunity,
          notifyPromotions: next.notifyPromotions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save preferences.");
        setSaving(false);
        return;
      }
      setPrefs(data.preferences);
      setNotice("Your email preferences have been saved.");
      setSaving(false);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8">
      <h2 className="text-lg font-bold text-white">Email notifications</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Account, security and payment confirmations are always sent. Choose what else you&rsquo;d like to receive.
      </p>

      {!prefs.emailVerified && (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Your email isn&rsquo;t verified yet — check your inbox for the confirmation link from your registration.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {CATEGORIES.map((cat) => {
          const enabled = prefs[cat.key];
          return (
            <div key={cat.key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-200">{cat.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{cat.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => save({ ...prefs, [cat.key]: !enabled })}
                disabled={saving}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                  enabled ? "bg-primary-500" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${enabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {notice && <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}
    </div>
  );
}