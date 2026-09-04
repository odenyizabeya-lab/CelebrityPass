"use client";

import { useState } from "react";

const TYPES = [
  { value: "ACCESS", label: "Request access to my data" },
  { value: "CORRECTION", label: "Correct information" },
  { value: "DELETION", label: "Delete my data / account" },
  { value: "EXPORT", label: "Export a copy of my data" },
];

export default function DataRequestForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("ACCESS");
  const [ref, setRef] = useState("");
  const [details, setDetails] = useState("");
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

    setLoading(true);
    try {
      const res = await fetch("/api/rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          requestType: type,
          reference: ref,
          description: details,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sorry, we couldn't submit your request. Please try again.");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setEmail("");
      setName("");
      setRef("");
      setDetails("");
      setLoading(false);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <h3 className="font-bold text-emerald-300">Request received</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-100/80">
          Thank you. Your request has been recorded and will be reviewed by our team. We will respond to the email you
          provided in a reasonable time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-ink-800/60 p-5 sm:p-6">
      <h3 className="font-bold text-white">Submit a data request</h3>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Email *">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-cp"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-cp"
            placeholder="Your name (optional)"
          />
        </Field>
        <Field label="Request type *">
          <select value={type} onChange={(e) => setType(e.target.value)} className="field-cp">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account / order reference">
          <input
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="field-cp"
            placeholder="e.g. FC-000001 (optional)"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Details">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="field-cp min-h-[96px]"
              placeholder="Tell us more about your request (optional)"
            />
          </Field>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-grad mt-5 w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
