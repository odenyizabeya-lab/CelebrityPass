import Link from "next/link";
import BankAccountsManager from "@/components/payments/admin/BankAccountsManager";
import AtmCardConfig from "@/components/payments/admin/AtmCardConfig";
import { listAllBankAccounts } from "@/lib/ticketing/banking";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsBankPage() {
  const accounts = await listAllBankAccounts();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Bank & Card payments</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Admin-managed bank accounts for Bank Transfer, and the ATM Card processor connection status.
          </p>
        </div>
        <Link href="/admin/payments" className="text-sm font-semibold text-zinc-400 transition hover:text-white">
          ← Cash payments
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
          Bank Transfer accounts ({accounts.length})
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-zinc-400">
          Add or edit a bank account per currency. Customers who choose Bank Transfer are shown the account for the
          order&apos;s currency in a realistic bank-app view. Add more countries anytime — nothing here is hardcoded.
        </p>
        <BankAccountsManager accounts={accounts} />
      </div>

      <div className="mt-12">
        <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-zinc-500">ATM Card processor</h2>
        <AtmCardConfig />
      </div>
    </div>
  );
}