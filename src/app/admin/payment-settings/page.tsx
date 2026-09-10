import PaymentSettingsPane from "@/components/admin/payments/PaymentSettingsPane";

export const dynamic = "force-dynamic";

export default function PaymentSettingsPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-black tracking-tight">Payment Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configure the card processor behind the customer-facing &quot;ATM Card&quot; option. Credentials live
          server-side only — they are never exposed to the browser, never logged, and encrypted at rest when an
          encryption key is set. Live payments only ever run in Live mode with live keys.
        </p>
      </div>
      <div className="mt-6 max-w-3xl">
        <PaymentSettingsPane />
      </div>
    </div>
  );
}