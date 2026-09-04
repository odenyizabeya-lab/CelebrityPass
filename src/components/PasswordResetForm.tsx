"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function PasswordResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const hasToken = Boolean(token);

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email || !/.+@.+\..+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setNotice(data.message ?? "If an account exists for that email, a reset link has been sent.");
      setLoading(false);
      if (data.emailUnconfigured) {
        // Be transparent that email delivery isn't configured yet.
        setNotice("A reset link could not be emailed right now because email delivery has not been configured. Please contact support for help resetting your password.");
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not reset your password.");
        setLoading(false);
        return;
      }
      setError(null);
      setNotice("Your password has been reset. You're now signed in.");
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="glass mx-auto max-w-md rounded-3xl p-8">
      {hasToken ? (
        <>
          <h1 className="text-2xl font-black tracking-tight">Choose a new password</h1>
          <p className="mt-1 text-sm text-zinc-400">Enter a new password for your account.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-black tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Enter the email linked to your account and we&apos;ll send a reset link.
          </p>
        </>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}
      {notice && (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
          {!hasToken && (
            <div className="mt-2">
              <a href="/login" className="text-emerald-200 underline">Back to login</a>
            </div>
          )}
        </div>
      )}

      {hasToken ? (
        <form onSubmit={confirmReset} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="field-cp" placeholder="At least 6 characters" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field-cp" placeholder="Re-enter your password" />
          </div>
          <button type="submit" disabled={loading} className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60">
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </form>
      ) : (
        <form onSubmit={requestReset} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-cp" placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={loading} className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-xs text-zinc-500">
        Remembered your password? <a href="/login" className="text-primary-400 hover:text-primary-300">Sign in</a>
      </p>
    </div>
  );
}
