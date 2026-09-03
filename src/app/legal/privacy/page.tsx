import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How CelebrityPass collects, uses, stores, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="September 2, 2026">
      <p>
        This Privacy Policy explains how <strong>CelebrityPass</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
        &ldquo;our&rdquo;) collects, uses, stores, protects, and shares information when you use the CelebrityPass
        application and website. By using CelebrityPass, you agree to the practices described here.
      </p>

      <h2 className="text-base font-bold text-white">1. Information We Collect</h2>
      <p>We collect the following categories of information in order to provide and operate the service:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Account information:</strong> your name, email address, and (optionally) phone number and country
          when you register for a CelebrityPass account.
        </li>
        <li>
          <strong>Fan card information:</strong> your digital fan card number, the celebrity communities you join, your
          chosen membership level, and your fan card design preferences.
        </li>
        <li>
          <strong>Order information:</strong> your order reference, ticket selection, event attendance details,
          customer name, email, phone, and country entered at checkout.
        </li>
        <li>
          <strong>Payment information:</strong> For Bank Transfer payments we store the transfer amount, currency, your
          payment reference, and your uploaded transfer receipt. Payment card details are processed by an external
          card merchant and are not stored on our servers.
        </li>
        <li>
          <strong>Usage information:</strong> standard web and app logs (device type, pages visited, timestamps) used to
          operate, secure, and improve the service.
        </li>
      </ul>

      <h2 className="text-base font-bold text-white">2. How We Use Information</h2>
      <p>We use the information we collect to:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Create and manage your account and fan cards.</li>
        <li>Process and fulfill your event ticket orders and membership purchases.</li>
        <li>Facilitate and verify Bank Transfer and card payments, including manual verification of bank-transfer receipts.</li>
        <li>Send order confirmations, tickets, and account notifications.</li>
        <li>Provide customer support and respond to inquiries.</li>
        <li>Maintain security, prevent fraud, and comply with legal obligations.</li>
      </ul>

      <h2 className="text-base font-bold text-white">3. How We Share Information</h2>
      <p>
        We do <strong>not</strong> sell your personal data. We share information only as needed to run the service:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>With payment processors and card merchants to process your payments securely.</li>
        <li>With trusted service providers that host the application and its database.</li>
        <li>Where required by law, regulation, or a valid legal request.</li>
        <li>With your consent, or as otherwise described at the time you provide the information.</li>
      </ul>

      <h2 className="text-base font-bold text-white">4. Data Retention</h2>
      <p>
        We retain your account and order data for as long as your account is active or as needed to provide the
        service, satisfy legal or tax obligations, resolve disputes, and enforce our agreements. Bank-transfer receipt
        uploads are retained for the verification period and as legally required.
      </p>

      <h2 className="text-base font-bold text-white">5. Data Security</h2>
      <p>
        We apply appropriate technical and organizational measures to protect your data, including secure
        transmission (HTTPS), hashed account credentials, restricted server-side access to payment verification tools,
        and least-privilege access to sensitive data. No method of transmission or storage is completely secure, so we
        cannot guarantee absolute security.
      </p>

      <h2 className="text-base font-bold text-white">6. Children&apos;s Privacy</h2>
      <p>
        CelebrityPass is not directed to children under 13, and we do not knowingly collect personal information from
        children under 13. If you believe a child has provided us personal data, please contact us so we can delete it.
      </p>

      <h2 className="text-base font-bold text-white">7. Your Rights &amp; Choices</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or restrict the processing of your
        personal data, and to withdraw consent. To exercise these rights, contact us at the address below. We will
        respond within a reasonable time.
      </p>

      <h2 className="text-base font-bold text-white">8. Contact Us</h2>
      <p>
        For privacy questions or requests, contact us at{" "}
        <a href="mailto:privacy@celebritypass.app" className="text-primary-400 underline">
          privacy@celebritypass.app
        </a>
        . See the{" "}
        <a href="/legal/contact" className="text-primary-400 underline">
          Contact &amp; Support
        </a>{" "}
        page for more information.
      </p>
    </LegalShell>
  );
}