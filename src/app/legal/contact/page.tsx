import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";
import ContactForm from "@/components/legal/ContactForm";

export const metadata: Metadata = {
  title: "Contact & Support",
  description: "How to contact the CelebrityPass support team.",
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact & Support" updated="September 4, 2026">
      <p>We&apos;re here to help. Send us a message below, or use the direct contact options that best match your question.</p>

      <ContactForm />

      <h2 className="text-base font-bold text-white">Direct contact options</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <h2 className="text-base font-bold text-white">General Support</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Account questions, orders, tickets, and fan cards.
          </p>
          <a href="mailto:support@celebritypass.app" className="mt-3 inline-block text-sm font-semibold text-primary-400 underline">
            support@celebritypass.app
          </a>
          <p className="mt-2 text-xs text-zinc-500">Response within 2 business days.</p>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <h2 className="text-base font-bold text-white">Payments &amp; Refunds</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Payment issues, bank-transfer verification, or refund requests. Include your order reference.
          </p>
          <a href="mailto:payments@celebritypass.app" className="mt-3 inline-block text-sm font-semibold text-primary-400 underline">
            payments@celebritypass.app
          </a>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <h2 className="text-base font-bold text-white">Privacy &amp; Data</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Requests to access, correct, or delete your personal data.
          </p>
          <a href="/legal/rights" className="mt-3 inline-block text-sm font-semibold text-primary-400 underline">
            User Rights &amp; Data Requests
          </a>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
          <h2 className="text-base font-bold text-white">Business &amp; Events</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Event organizers, ticketing partners, and celebrity community requests.
          </p>
          <a href="mailto:events@celebritypass.app" className="mt-3 inline-block text-sm font-semibold text-primary-400 underline">
            events@celebritypass.app
          </a>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        For urgent account-security issues, choose the <strong>Security</strong> category in the form above, or email
        support with the subject line &quot;Security&quot;, and we will prioritize your request.
      </p>
    </LegalShell>
  );
}