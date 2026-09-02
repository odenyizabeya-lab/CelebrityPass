import Link from "next/link";
import AdminPayments from "@/components/tickets/AdminPayments";
import { prisma } from "@/lib/db";
import { listSettlementRecords } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

export default async function AdminTicketPaymentsPage() {
  const methods = await prisma.paymentMethod.findMany({ orderBy: { createdAt: "asc" } });
  const settlements = await listSettlementRecords();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Ticket payments</h1>
          <p className="mt-1 text-sm text-zinc-400">Payment method configuration (names only, never credentials) and settlement records.</p>
        </div>
        <Link href="/admin/tickets" className="text-sm font-semibold text-zinc-400 transition hover:text-white">← Tickets</Link>
      </div>

      <div className="mt-6">
        <AdminPayments
          methods={methods.map((m) => ({
            id: m.id,
            key: m.key,
            name: m.name,
            kind: m.kind,
            isEnabled: m.isEnabled,
            isDefault: m.isDefault,
            currency: m.currency,
            credentialEnvKeys: m.credentialEnvKeysJson ? (JSON.parse(m.credentialEnvKeysJson) as string[]) : [],
            hasCredentials: m.hasCredentials,
            hasSettlementAccount: m.hasSettlementAccount,
            settlementAccountLabel: m.settlementAccountLabel,
            settlementAccountLast4: m.settlementAccountLast4,
          }))}
          settlements={settlements.map((s) => ({
            id: s.id,
            amountCents: s.amountCents,
            currency: s.currency,
            periodStart: s.periodStart ? s.periodStart.toISOString() : null,
            periodEnd: s.periodEnd ? s.periodEnd.toISOString() : null,
            reference: s.reference,
            note: s.note,
            paymentMethodName: s.paymentMethod?.name ?? null,
            createdAt: s.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}