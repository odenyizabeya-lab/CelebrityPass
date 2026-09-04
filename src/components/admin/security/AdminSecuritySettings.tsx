"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-primary-500";
const errCls = "mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300";
const okCls = "mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300";

export default function AdminSecuritySettings({ initialEmail }: { initialEmail: string }) {
  return (
    <section className="max-w-2xl space-y-6">
      <PasswordPane />
      <EmailPane initialEmail={initialEmail} />
      <TwoFactorPane />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Change password                                                            */
/* -------------------------------------------------------------------------- */
function PasswordPane() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not change the password.");
      setOk(data.message || "Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-black text-white">Change password</h2>
      <p className="mt-1 text-sm text-zinc-400">Choose a new password after confirming your current one.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Current password</label>
          <input type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">New password</label>
          <input type="password" autoComplete="new-password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} placeholder="At least 10 characters" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Confirm new password</label>
          <input type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <div className={errCls}>{error}</div>}
        {ok && <div className={okCls}>{ok}</div>}
        <button type="submit" disabled={busy} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Change email (two-step: password then a confirmation code)                 */
/* -------------------------------------------------------------------------- */
function EmailPane({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [current, setCurrent] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", currentPassword: current, newEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the email change.");
      setPending(data.pending);
      setStep("confirm");
      setCode("");
      setOk(`A confirmation step is open for ${data.pending}. Use the code below to finish.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the email change.");
    } finally {
      setBusy(false);
    }
  };

  const confirmChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not confirm the email change.");
      setEmail(data.email);
      setPending(null);
      setStep("idle");
      setCurrent("");
      setNewEmail("");
      setCode("");
      setOk("Primary admin email updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the email change.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "confirm") {
    return (
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-black text-white">Confirm email change</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Finish switching the primary email to <span className="font-semibold text-white">{pending}</span>. Enter the confirmation code below.
        </p>
        <form onSubmit={confirmChange} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Confirmation code</label>
            <input inputMode="numeric" autoComplete="one-time-code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <p className="mt-1.5 rounded-lg bg-zinc-900/60 px-3 py-2 font-mono text-xs tracking-widest text-zinc-300">Your code: {code || "——————"}</p>
            <p className="mt-1 text-[11px] text-zinc-500">This code is valid for 10 minutes and expires after one use. When email delivery is enabled it will be sent instead of shown here.</p>
          </div>
          {error && <div className={errCls}>{error}</div>}
          {ok && <div className={okCls}>{ok}</div>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || code.length !== 6} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {busy ? "Confirming…" : "Confirm email"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("idle");
                setCurrent("");
                setNewEmail("");
                setCode("");
                setError(null);
                setOk(null);
              }}
              className="rounded-full px-4 py-2 text-sm text-zinc-400 ring-1 ring-white/10 transition hover:text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-black text-white">Primary email</h2>
      <p className="mt-1 text-sm text-zinc-400">The permanent admin sign-in email is currently:</p>
      <p className="mt-2 rounded-lg bg-ink-800 px-4 py-3 text-sm font-semibold text-white">{email}</p>
      <form onSubmit={requestChange} className="mt-4 space-y-4">
        <p className="text-xs text-zinc-500">
          To change it, enter your current password and the new email. You will then confirm the change with a one-time code — a deployment can
          never reset this back to a demo or generated address on its own.
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Current password</label>
          <input type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-300">New email address</label>
          <input type="email" className={inputCls} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@yourdomain.com" />
        </div>
        {error && <div className={errCls}>{error}</div>}
        {ok && <div className={okCls}>{ok}</div>}
        <button type="submit" disabled={busy} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          {busy ? "Checking…" : "Start email change"}
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Two-step verification (TOTP)                                               */
/* -------------------------------------------------------------------------- */
function TwoFactorPane() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [provisioningUri, setProvisioningUri] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/security/two-factor");
        const d = await res.json();
        if (!active) return;
        setEnabled(Boolean(d.enabled));
        setProvisioningUri(d.provisioningUri ?? null);
        setManualSecret(d.manualSecret ?? null);
        if (d.provisioningUri) {
          const uri = await QRCode.toDataURL(d.provisioningUri, { width: 240, margin: 1 });
          if (active) setQrDataUri(uri);
        } else {
          setQrDataUri(null);
        }
      } catch {
        if (active) {
          setEnabled(false);
          setProvisioningUri(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable", currentPassword: current, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not enable two-step verification.");
      setEnabled(true);
      setOk(data.message || "Two-step verification enabled.");
      setProvisioningUri(null);
      setManualSecret(null);
      setQrDataUri(null);
      setCurrent("");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable two-step verification.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", currentPassword: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disable two-step verification.");
      setEnabled(false);
      setOk(data.message || "Two-step verification is off.");
      setCurrent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable two-step verification.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3">
        <span className={`grid h-3 w-3 rounded-full ${enabled ? "bg-emerald-400" : "bg-zinc-600"}`} />
        <h2 className="text-lg font-black text-white">Two-step verification (2FA)</h2>
      </div>
      <p className="mt-2 text-sm text-zinc-400">
        {enabled
          ? "Two-step verification is ON. Sign-in now also requires a 6-digit code from your authenticator app."
          : loading
            ? "Checking status…"
            : "Two-step verification is OFF. Turning it on adds an extra code step to every admin sign-in."}
      </p>

      {error && <div className={errCls}>{error}</div>}
      {ok && <div className={okCls}>{ok}</div>}

      {!enabled && provisioningUri && !loading && (
        <form onSubmit={enable} className="mt-4 space-y-4">
          <div className="rounded-xl bg-white p-3 ring-4 ring-ink-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUri ?? undefined} alt="Scan with your authenticator app" className="mx-auto h-56 w-56" />
          </div>
          <p className="text-xs text-zinc-400">
            1. Scan the code with Google Authenticator, Authy, or your built-in authenticator, <span className="text-zinc-300">or</span> enter the
            key manually:
          </p>
          {manualSecret && (
            <p className="rounded-lg bg-zinc-900/60 px-3 py-2 font-mono text-xs tracking-widest text-zinc-200 select-all">{manualSecret}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Current password</label>
              <input type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-300">6-digit code from your app</label>
              <input inputMode="numeric" autoComplete="one-time-code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />
            </div>
          </div>
          <button type="submit" disabled={busy || code.length !== 6 || !current} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "Enabling…" : "Enable two-step verification"}
          </button>
        </form>
      )}

      {enabled && (
        <form onSubmit={disable} className="mt-4 max-w-md space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-300">Enter your current password to turn 2FA off</label>
            <input type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <button type="submit" disabled={busy || !current} className="rounded-full px-6 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 transition hover:ring-rose-500/30 disabled:opacity-50">
            {busy ? "Disabling…" : "Turn off two-step verification"}
          </button>
        </form>
      )}
    </div>
  );
}