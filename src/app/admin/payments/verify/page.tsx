import Link from "next/link";
import AdminVerifyTransfers from "@/components/tickets/AdminVerifyTransfers";
import { listPendingBankTransferProofs } from "@/lib/ticketing/universal-proofs";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsVerifyPage() {
  const proofs = await listPendingBankTransferProofs();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Verify Bank Transfers</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Review each submitted transfer against your real receipts before confirming. Nothing is auto-paid.
          </p>
        </div>
        <Link href="/admin/payments/bank" className="text-sm font-semibold text-zinc-400 transition hover:text-white">
          ← Bank & Card payments
        </Link>
      </div>

      <div className="mt-6">
        <AdminVerifyTransfers proofs={proofs} />
      </div>
    </div>
  );
}