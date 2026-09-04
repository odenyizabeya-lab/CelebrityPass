"use client";

import { useState } from "react";

const CATEGORIES = [
  "General",
  "Account",
  "Payments",
  "Tickets",
  "Privacy",
  "Security",
  "Other",
];

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("General");
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email || !/.+@.+\..+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (message.length < 10) {
      setError("Please write a message of at least 10 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, category, subject, reference, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sorry, we couldn't send your message. Please try again.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setReference("");
      setMessage("");
      setLoading(false);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <h3 className="font-bold text-emerald-300">Message sent</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-100/80">
          Thank you for contacting CelebrityPass. Your message has been received, and our team will respond to the
          email you provided, usually within 2 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-ink-800/60 p-5 sm:p-6">
      <h3 className="font-bold text-white">Send us a message</h3>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="field-cp" placeholder="Your name (optional)" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Email *</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field-cp" placeholder="you@example.com" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Category *</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-cp">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Subject</span>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="field-cp" placeholder="Short subject (optional)" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Account / order reference</span>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className="field-cp" placeholder="e.g. FC-000001 or TCK-xxxx (optional)" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-zinc-300">Message *</span>
          <textarea required value={message} onChange={(e) => setMessage(e.target.value)} className="field-cp min-h-[120px]" placeholder="How can we help? (at least 10 characters)" />
        </label>
      </div>

      <button type="submit" disabled={loading} className="btn-grad mt-5 w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60">
        {loading ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
