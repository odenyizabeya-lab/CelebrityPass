"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm({ initialEmail = "odenyizabeya@gmail.com" }: { initialEmail?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "1", email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setLoading(false);
        return;
      }
      if (data.next === "2fa") {
        setStep(2);
        setPassword("");
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

  const submitStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "2", code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
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

  if (step === 2) {
    return (
      <form onSubmit={submitStep2} className="glass mx-auto max-w-sm rounded-3xl p-8 text-left">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 font-black text-white">
          A
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight">Two-step verification</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Enter the 6-digit code from your authenticator app to finish signing in.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Verification code</label>
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-center text-xl tracking-[0.5em] text-white placeholder-zinc-500 outline-none focus:border-primary-500"
            placeholder="000000"
          />
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="btn-grad mt-5 w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify and sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setCode("");
              setError(null);
            }}
            className="mt-3 w-full rounded-full py-2 text-sm text-zinc-400 transition hover:text-white"
          >
            ← Back to sign-in
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitStep1} className="glass mx-auto max-w-sm rounded-3xl p-8 text-left">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 font-black text-white">
        A
      </div>
      <h1 className="mt-4 text-2xl font-black tracking-tight">Admin Console</h1>
      <p className="mt-1 text-sm text-zinc-400">Sign in with your admin email and password to continue.</p>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Admin email</label>
          <input
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Password</label>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
            placeholder="••••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Sign in to Admin"}
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-zinc-500">Authorized administrators only.</p>
    </form>
  );
}