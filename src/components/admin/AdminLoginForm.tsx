'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setLoading(false);
        return;
      }
      router.push("/admin/overview");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass mx-auto max-w-sm rounded-3xl p-8 text-left">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 font-black text-white">
        A
      </div>
      <h1 className="mt-4 text-2xl font-black tracking-tight">Admin Console</h1>
      <p className="mt-1 text-sm text-zinc-400">Enter the platform admin password to continue.</p>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-6">
        <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Admin Password</label>
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
          placeholder="••••••••••"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-grad mt-5 w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Sign in to Admin"}
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-zinc-500">Default password is stored in the .env file (ADMIN_PASSWORD).</p>
    </form>
  );
}