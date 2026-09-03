import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of the CelebrityPass platform.",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="September 2, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the{" "}
        <strong>CelebrityPass</strong> application, website, and services. By creating an account or using
        CelebrityPass, you agree to these Terms. Please read them carefully.
      </p>

      <h2 className="text-base font-bold text-white">1. Eligibility</h2>
      <p>
        You must be at least 13 years old to use CelebrityPass. By using the service you represent that you meet this
        requirement and that your use complies with the laws of your jurisdiction.
      </p>

      <h2 className="text-base font-bold text-white">2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity that
        occurs under your account. You agree to provide accurate information and to notify us of any unauthorized use.
      </p>

      <h2 className="text-base font-bold text-white">3. Fan Cards &amp; Membership</h2>
      <p>
        Fan cards are digital membership cards issued by a celebrity&apos;s fan community through the platform. They
        represent membership in that community. Fan cards and memberships are <strong>not</strong> contracts with, and{" "}
        <strong>do not</strong> imply endorsement by, any celebrity.
      </p>

      <h2 className="text-base font-bold text-white">4. Events &amp; Tickets</h2>
      <p>
        We list event and ticket information sourced from authorized providers and our team. We aim to keep this
        information accurate, but event details and ticket availability can change. Tickets are valid only through the
        approved payment and fulfillment process described on the Payments &amp; Refunds page. A ticket or card is
        never issued until its payment has genuinely succeeded.
      </p>

      <h2 className="text-base font-bold text-white">5. Acceptable Use</h2>
      <p>
        You agree not to: misuse or attempt to gain unauthorized access to the service or any account; make yourself an
        administrator or modify payment verification without authorization; submit false payment receipts; interfere
        with other users&apos; accounts or data; or use the service for unlawful purposes.
      </p>

      <h2 className="text-base font-bold text-white">6. Payment Terms</h2>
      <p>
        Payments are made via Bank Transfer or ATM Card. Bank-transfer payments remain pending until verified manually;
        they are never automatically marked paid. Card payments are processed securely by an external merchant. Prices
        are shown at checkout in the applicable currency. Refunds are handled as described on the Payments &amp;
        Refunds page.
      </p>

      <h2 className="text-base font-bold text-white">7. Intellectual Property</h2>
      <p>
        The CelebrityPass name, logo, software, and platform content are our property or the property of our
        licensors. You may not reproduce, modify, or distribute them without permission.
      </p>

      <h2 className="text-base font-bold text-white">8. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, CelebrityPass and its operators are not liable for indirect, incidental,
        special, consequential, or punitive damages arising from your use of the service. The service is provided
        &ldquo;as is&rdquo; without warranties of any kind.
      </p>

      <h2 className="text-base font-bold text-white">9. Termination</h2>
      <p>
        We may suspend or terminate your account if you violate these Terms or misuse the service. You may stop using
        the service at any time.
      </p>

      <h2 className="text-base font-bold text-white">10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date reflects the latest revision.
        Continued use after changes constitutes acceptance of the updated Terms.
      </p>

      <h2 className="text-base font-bold text-white">11. Contact</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href="mailto:support@celebritypass.app" className="text-primary-400 underline">
          support@celebritypass.app
        </a>
        .
      </p>
    </LegalShell>
  );
}