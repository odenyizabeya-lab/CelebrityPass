"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Fan = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  createdAt: string;
  hasPassword: boolean;
};

export default function AccountSettingsForm({ initialFan }: { initialFan: Fan }) {
  const router = useRouter();
  const [fan, setFan] = useState<Fan>(initialFan);
  const [name, setName] = useState(fan.name);
  const [country, setCountry] = useState(fan.country ?? "");
  const [phone, setPhone] = useState(fan.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Refresh from server to be safe (account may have changed).
  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.fan) setFan(d.fan);
      })
      .catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          country,
          phone,
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update your account.");
        setSaving(false);
        return;
      }
      setFan(data.fan);
      setCurrentPassword("");
      setNewPassword("");
      setNotice("Your account has been updated.");
      setSaving(false);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      "Delete your account permanently? This removes your account and associated fan cards and cannot be undone.",
    );
    if (!ok) return;
    setError(null);
    setNotice(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not delete your account.");
        setDeleting(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="text-lg font-bold text-white">Profile</h2>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}
        {notice && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field-cp" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Email</span>
            <input value={fan.email} disabled className="field-cp opacity-60" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Country</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} className="field-cp" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Phone (optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field-cp" />
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-grad mt-6 rounded-full px-6 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form onSubmit={save} className="glass rounded-3xl p-6 sm:p-8">
        <h2 className="text-lg font-bold text-white">Change password</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {fan.hasPassword ? "Enter your current password and a new password." : "This account has no password yet. Set one now."}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Current password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="field-cp" placeholder="Your current password" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-zinc-300">New password</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field-cp" placeholder="At least 6 characters" />
          </label>
        </div>
        <button type="submit" disabled={saving} className="mt-6 rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5">
          {saving ? "Saving…" : "Update password"}
        </button>
      </form>

      <div className="rounded-3xl border border-rose-500/20 bg-rose-500/[0.04] p-6 sm:p-8">
        <h2 className="text-lg font-bold text-white">Delete account</h2>
        <p className="mt-1 max-w-lg text-sm text-zinc-400">
          Deleting your account removes your account, fan cards, and associated data. This is permanent and cannot be
          undone.
        </p>
        {fan.hasPassword && (
          <p className="mt-3 text-sm text-zinc-500">Enter your password to confirm.</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {fan.hasPassword && (
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="field-cp w-64"
              placeholder="Your password"
            />
          )}
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="rounded-full bg-rose-600/90 px-6 py-3 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Prefer not to sign in? You can also submit a deletion request via our{" "}
          <a href="/legal/rights" className="text-primary-400 underline">User Rights &amp; Data Requests</a> page.
        </p>
      </div>
    </div>
  );
}
