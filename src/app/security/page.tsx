import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security & Trust",
  description:
    "The security measures CelebrityPass actually implements, explained honestly — including HTTPS, authentication, rate limiting, and how to report a concern.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <nav className="text-sm text-zinc-400">
        <Link href="/" className="transition hover:text-white">Home</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">Security</span>
      </nav>

      <div className="mt-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Security &amp; Trust</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">How we protect your data</h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-zinc-300">
          This page describes the security measures CelebrityPass actually implements today. We do not claim to be
          &ldquo;100% secure&rdquo; or &ldquo;impossible to hack&rdquo; — no service can promise that. Instead, we are
          transparent about what we do and how you can hold us accountable.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Measure
          title="Encrypted connections (HTTPS/TLS)"
          body="All traffic between your device and CelebrityPass is served over HTTPS with valid TLS certificates, protecting data in transit."
        />
        <Measure
          title="Hashed passwords"
          body="Account passwords are never stored in plain text. They are hashed with a per-account salt using scrypt, and verified in constant time."
        />
        <Measure
          title="Signed session cookies"
          body="Login sessions use cryptographically signed cookies that are HttpOnly, SameSite=Lax, and flagged Secure in production so they only travel over HTTPS."
        />
        <Measure
          title="Protected admin access"
          body="Admin areas require a separate login with password and two-factor authentication (TOTP). Admin-only server actions check the session server-side."
        />
        <Measure
          title="Rate limiting"
          body="Login, registration, contact, and data-request endpoints are rate limited per IP to slow automated abuse and brute-force attempts."
        />
        <Measure
          title="Server-side database access"
          body="The database is accessed only through server-side code. Client code never receives database credentials."
        />
        <Measure
          title="Manual payment verification"
          body="Bank-transfer payments are never automatically marked paid. A staff member verifies the receipt before a card or ticket is issued."
        />
        <Measure
          title="Controlled error handling"
          body="Server errors are handled without exposing database details or personal information to users."
        />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-white">What we do not claim</h2>
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="max-w-prose text-sm leading-relaxed text-zinc-300">
            We do <strong>not</strong> claim CelebrityPass is certified, government-approved, or officially verified by
            any third party. We do <strong>not</strong> use phrases like &ldquo;military-grade&rdquo; or
            &ldquo;100% secure.&rdquo; No method of transmission or storage is completely secure, and we encourage you
            to use a strong, unique password and to enable two-factor authentication on your accounts where available.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-white">Your responsibilities</h2>
        <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5 leading-relaxed text-zinc-300">
          <li>Use a strong, unique password and do not reuse it elsewhere.</li>
          <li>Never share your password or authentication codes with anyone.</li>
          <li>Notify us promptly if you believe your account has been compromised.</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-white">Account deletion and your data</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          You can request access to, correction of, export of, or deletion of your personal data through our{" "}
          <Link href="/legal/rights" className="text-primary-400 underline">User Rights &amp; Data Requests</Link> page.
          If you are signed in, you can also delete your account directly from{" "}
          <Link href="/account" className="text-primary-400 underline">Account Settings</Link>.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-white">Reporting a security concern</h2>
        <p className="mt-3 max-w-prose leading-relaxed text-zinc-300">
          If you believe you have found a security issue or a vulnerability, or if you suspect your account has been
          compromised, please contact us through our{" "}
          <Link href="/legal/contact" className="text-primary-400 underline">Contact &amp; Support</Link> page and
          choose the <strong>Security</strong> category. We will prioritize and review your report.
        </p>
      </section>
    </div>
  );
}

function Measure({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass card-hover rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{body}</p>
        </div>
      </div>
    </div>
  );
}
