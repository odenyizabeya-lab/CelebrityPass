import type { Metadata } from "next";
import LegalShell from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Payments & Refunds",
  description: "How payments and refunds work on CelebrityPass, including Bank Transfer and ATM Card.",
};

export default function PaymentsPage() {
  return (
    <LegalShell title="Payments & Refunds" updated="September 2, 2026">
      <p>
        This page explains how payments work on CelebrityPass and how refunds are handled. CelebrityPass supports two
        customer-facing payment methods: <strong>Bank Transfer</strong> and <strong>ATM Card</strong>.
      </p>

      <h2 className="text-base font-bold text-white">1. Supported Payment Methods</h2>
      <h3 className="text-sm font-bold text-zinc-100">Bank Transfer</h3>
      <p>
        You can pay by transferring funds to the bank account shown at checkout for your currency. After you make the
        transfer, you upload your transfer receipt inside the app. Bank transfers are{" "}
        <strong>not automatically marked as paid</strong>. Your payment remains <strong>pending</strong> until a
        member of our team manually verifies the receipt. Only after real verification is your fan card issued or your
        ticket order confirmed.
      </p>

      <h3 className="text-sm font-bold text-zinc-100">ATM Card</h3>
      <p>
        You can pay with an ATM card. Card payments are processed securely through a third-party card merchant using
        their official integration. Your full card number is never stored on our servers.
      </p>

      <h2 className="text-base font-bold text-white">2. Confirmation &amp; Tickets/Cards</h2>
      <p>
        A fan card or event ticket is <strong>only issued after a payment is genuinely successful or verified</strong>.
        We never generate a ticket or confirmation from an unverified or unconfirmed payment. Once verified, you will
        receive your confirmation, ticket, or card through the app.
      </p>

      <h2 className="text-base font-bold text-white">3. Refund Policy</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Failed or duplicate payments:</strong> if a payment fails or is accidentally duplicated, we will
          reverse the error as soon as it is identified.
        </li>
        <li>
          <strong>Cancelled events and tickets:</strong> if an event is cancelled by the organizer, we will arrange a
          refund or credit in line with the organizer&apos;s policy.
        </li>
        <li>
          <strong>Membership / fan cards:</strong> because fan-card memberships begin earning benefits immediately,
          membership payments are generally non-refundable once granted. Contact us if you believe you are owed a refund.
        </li>
        <li>
          <strong>Verification disputes:</strong> if your bank-transfer receipt is rejected, contact support and we will
          review it promptly.
        </li>
      </ul>

      <h2 className="text-base font-bold text-white">4. Requesting a Refund</h2>
      <p>
        To request a refund, contact us through the{" "}
        <a href="/legal/contact" className="text-primary-400 underline">
          Contact &amp; Support
        </a>{" "}
        page with your order reference. Refunds are processed to the original payment method where possible. Refund
        times depend on the payment method and bank.
      </p>

      <h2 className="text-base font-bold text-white">5. Currency &amp; Pricing</h2>
      <p>
        Prices are shown at checkout in the applicable currency. Applicable taxes and fees are shown where required by
        law. We display the final amount before you confirm payment.
      </p>
    </LegalShell>
  );
}