"use client";

import { createBrowserSupabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm({
  initialEmail = "odenyizabeya@gmail.com",
  allowedEmails = [initialEmail.trim().toLowerCase()],
}: {
  initialEmail?: string;
  allowedEmails?: string[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedAllowed = allowedEmails.map((e) => e.trim().toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Fail fast: only attempt a Supabase sign-in for an authorized admin email.
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedAllowed.includes(normalizedEmail)) {
      setError("This account is not authorized to access the admin console.");
      return;
    }

    setLoading(true);
    const supabase = createBrowserSupabase();
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        setError(mapAuthError(signInError.message));
        setLoading(false);
        return;
      }

      // Belt and suspenders: confirm the signed-in email is on the allowlist.
      // (Server-side guards enforce this regardless; this is a UX check.)
      const userEmail = data.user?.email?.trim().toLowerCase();
      if (!userEmail || !normalizedAllowed.includes(userEmail)) {
        await supabase.auth.signOut().catch(() => {});
        setError("This account is not authorized to access the admin console.");
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
    <form onSubmit={handleSubmit} className="glass mx-auto max-w-sm rounded-3xl p-8 text-left">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 font-black text-white">
        A
      </div>
      <h1 className="mt-4 text-2xl font-black tracking-tight">Admin Console</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Sign in with your admin email and password to continue.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
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
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Password</label>
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 pr-24 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
              placeholder="••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-400 transition hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in to Admin"}
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-zinc-500">Authorized administrators only.</p>
    </form>
  );
}

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid email or password")) {
    return "Invalid email or password.";
  }
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return "Your email address has not been confirmed. Please check your inbox.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many login attempts. Please wait and try again.";
  }
  if (m.includes("user not found")) {
    return "No account found for this email.";
  }
  return message;
}
