import type { Metadata } from "next";
import Link from "next/link";
import LegalShell from "@/components/legal/LegalShell";
import DataRequestForm from "@/components/legal/DataRequestForm";

export const metadata: Metadata = {
  title: "User Rights & Data Requests",
  description:
    "How to request access to, correction of, export of, or deletion of your personal data on CelebrityPass.",
  alternates: { canonical: "/legal/rights" },
};

export default function RightsPage() {
  return (
    <LegalShell title="User Rights & Data Requests" updated="September 4, 2026">
      <p>
        You have choices about the personal data we hold about you. This page explains what you can request and how to
        submit a request. Requests are handled by our team; we review and act on them in a reasonable time.
      </p>

      <h2 className="text-base font-bold text-white">Your rights</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Access:</strong> request a summary of the personal data we hold about you.
        </li>
        <li>
          <strong>Correction:</strong> ask us to correct inaccurate or incomplete information.
        </li>
        <li>
          <strong>Deletion:</strong> request deletion of your account and associated personal data.
        </li>
        <li>
          <strong>Export:</strong> request a copy or export of your information where supported.
        </li>
      </ul>

      <h2 className="text-base font-bold text-white">How to submit a request</h2>
      <p>
        Fill in the form below, or if you are signed in you can update your details or delete your account from{" "}
        <Link href="/account" className="text-primary-400 underline">Account Settings</Link>.
      </p>

      <h2 className="text-base font-bold text-white">What happens next</h2>
      <p>
        Your request is recorded and reviewed by our team. Please note that requests are <strong>not</strong> completed
        automatically; deletion of an account is permanent and cannot be undone. We may need to confirm your identity
        before acting on a request.
      </p>

      <p className="text-xs text-zinc-500">
        Learn more about what data we collect in our{" "}
        <Link href="/legal/privacy" className="text-primary-400 underline">Privacy Policy</Link>.
      </p>

      <div className="mt-6">
        <DataRequestForm />
      </div>
    </LegalShell>
  );
}
