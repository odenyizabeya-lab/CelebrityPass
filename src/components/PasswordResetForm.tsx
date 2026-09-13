"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { fetchWithTimeout } from "@/lib/client-http";
import AuthScreen from "@/components/auth/AuthScreen";
import AuthField from "@/components/auth/AuthField";
import {
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  AlertIcon,
  Spinner,
  ArrowLeftIcon,
} from "@/components/auth/AuthIcons";
import {
  appScreenLinkClass,
  appPrimaryButtonClass,
  appErrorBannerClass,
  appSuccessBannerClass,
} from "@/components/auth/authStyles";

export default function PasswordResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const hasToken = Boolean(token);

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const res = await fetchWithTimeout("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setLoading(false);
      setNotice(data.message ?? "If an account exists for that email, a reset link has been sent.");
      if (data.emailUnconfigured) {
        setNotice(
          "A reset link could not be emailed right now because email delivery has not been configured. Please contact support for help resetting your password."
        );
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
      const res = await fetchWithTimeout("/api/auth/reset-password/confirm", {
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
      setLoading(false);
      setError(null);
      setNotice("Your password has been reset. You're now signed in.");
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      footer={
        <p className="text-sm text-zinc-500">
          Remembered your password?{" "}
          <a href="/login" className={appScreenLinkClass}>
            Sign in
          </a>
        </p>
      }
    >
      <div className="app-screen-in">
        <a
          href="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition hover:text-white"
        >
          <ArrowLeftIcon />
          Back
        </a>
        <h1 className="text-3xl font-black tracking-tight sm:text-[2rem]">
          {hasToken ? "Choose a new password" : "Reset your password"}
        </h1>
        <p className="mt-1.5 text-[15px] text-zinc-400">
          {hasToken
            ? "Enter a new password for your account."
            : "Enter the email linked to your account and we'll send a reset link."}
        </p>

        {error && (
          <div role="alert" className={appErrorBannerClass}>
            <span className="mt-0.5 shrink-0"><AlertIcon /></span>
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className={appSuccessBannerClass}>
            <span>{notice}</span>
          </div>
        )}

        {hasToken ? (
          <form onSubmit={confirmReset} className="mt-7 space-y-5" noValidate>
            <AuthField
              id="reset-pass"
              label="New password"
              icon={<LockIcon />}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              after={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                  className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition hover:text-white"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
            <AuthField
              id="reset-confirm"
              label="Confirm password"
              icon={<LockIcon />}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} className={appPrimaryButtonClass}>
              {loading ? (
                <>
                  <Spinner />
                  Resetting…
                </>
              ) : (
                "Reset password"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={requestReset} className="mt-7 space-y-5" noValidate>
            <AuthField
              id="reset-email"
              label="Email"
              icon={<MailIcon />}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" disabled={loading} className={appPrimaryButtonClass}>
              {loading ? (
                <>
                  <Spinner />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>
          </form>
        )}
      </div>
    </AuthScreen>
  );
}