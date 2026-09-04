"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || name.length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (!email || !/.+@.+\..+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, country }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass mx-auto max-w-md rounded-3xl p-8">
      <h1 className="text-2xl font-black tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-400">Join CelebrityPass for free. One account, many fan communities.</p>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-cp"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-cp"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Password</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-cp"
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Country (optional)</label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="field-cp"
            placeholder="Your country"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-grad w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </div>

      <p className="mt-5 text-center text-xs text-zinc-500">
        Already have an account? <a href="/login" className="text-primary-400 hover:text-primary-300">Sign in</a>
      </p>
      <p className="mt-3 text-center text-xs text-zinc-600">
        By creating an account you agree to our{" "}
        <a href="/legal/terms" className="text-zinc-500 underline">Terms of Service</a> and{" "}
        <a href="/legal/privacy" className="text-zinc-500 underline">Privacy Policy</a>.
      </p>
    </form>
  );
}
