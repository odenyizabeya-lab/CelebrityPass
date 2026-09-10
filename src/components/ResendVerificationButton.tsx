"use client";

import { useState } from "react";

export default function ResendVerificationButton() {
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/account/verify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send the verification email.");
        setSending(false);
        return;
      }
      setNotice("Verification email sent. Check your inbox.");
      setSending(false);
    } catch {
      setError("Network error. Please try again.");
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={resend}
        disabled={sending}
        className="rounded-full border border-primary-500/40 px-4 py-1 text-xs font-bold text-primary-300 transition hover:bg-primary-500/10 disabled:opacity-60"
      >
        {sending ? "Sending…" : "Resend verification email"}
      </button>
      {notice && <span className="text-xs text-emerald-300">{notice}</span>}
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </>
  );
}