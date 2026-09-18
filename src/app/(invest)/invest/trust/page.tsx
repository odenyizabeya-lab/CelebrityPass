import Link from "next/link";
import { isGlobalLedgerBalanced } from "@/lib/invest/ledger";

export const dynamic = "force-dynamic";

export default async function InvestTrustPage() {
  const balanced = await isGlobalLedgerBalanced();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Investor Hub</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Trust &amp; security</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Every balance on this hub is ledger-verified — deposits are only credited after a real bank transfer is manually
        confirmed against the bank statement.
      </p>

      <div className="mt-8 space-y-5">
        <Section
          title="How money is recorded"
          body={`Every financial movement is written as a balanced set of double-entry ledger rows. Your cash balance,
          invested amount, and the platform total are never stored as single mutable numbers — they are derived by
          summing the ledger. A posting that does not balance to exactly zero is rejected by the backend, never
          partially applied. A live check of every recorded entry ${
            balanced
              ? "currently sums to $0.00, the invariant a double-entry ledger must always satisfy."
              : "is currently reporting a non-zero balance. This is a serious control issue that is being worked and blocks all new flows until resolved."
          }`}
          badge={balanced ? "Ledger balanced" : "Ledger NOT balanced"}
          badOk={balanced}
        />

        <Section
          title="No fabricated performance"
          body="This platform does not show gains or losses. You will never see an estimated mark-to-market, a projected
          profit, or a made-up portfolio value — those would be misleading. The only numbers you see are ledger-verified
          facts: what you deposited, what you invested, what you withdrew, and any documented distribution once one is
          recorded by the backend. Until a distribution exists, the honest statement is: NO PERFORMANCE DATA
          AVAILABLE."
        />

        <Section
          title="How your money moves"
          body="Deposits start as a PENDING bank-transfer intent with a unique deposit reference. You pay from any bank app
          or ATM and upload a photo of your receipt. A human administrator compares your submitted receipt against the
          real bank statement and — only after they match — the deposit settles into your ledger as a credited balance.
          The interface only ever submits a request; it can never declare something successful. Withdrawals are
          requested, reviewed, and completed by the backend and bank — rejected or completed only after all checks run.
          Staff cannot credit balances: there is no 'add money' function anywhere for administrators, only the audited
          deposit, subscription, distribution, and withdrawal processes."
        />

        <Section
          title="Identity and AML checks"
          body="Identity verification (KYC) is reviewed manually. Nothing is auto-approved: an administrator records every
          decision, and the status moves PENDING, UNDER_REVIEW, VERIFIED or REJECTED with a time-stamped audit trail.
          Large subscriptions and withdrawals are flagged for manual wallet review through compliance alerts, and the
          review history is retained."
        />

        <Section
          title="Your data"
          body="Your investor account is scoped to your sign-in (fan) account and is separate from the fan-card product.
          Every notable action writes an audit record. You can request an export or deletion of your investor data by
          contacting support, and the ledger honors a documented reversal process rather than ad-hoc deletions of
          financial rows."
        />

        <Section
          title="What is not here"
          body="This is the honest list of what this product intentionally does not claim: no promises of returns, no auto
          gains, no admin money creation, and no 'guaranteed' yields. Every deposit requires a real matching bank
          transfer before any balance moves, and payouts require real funds that exist in the ledger."
        />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
          Questions or concerns? Reach out through the fan account&apos;s support channel. Every claim on this page is a
          code-level fact about how balances are computed, not marketing.
        </div>
      </div>

      <div className="mt-8">
        <Link href="/invest" className="text-sm font-bold text-primary-400 hover:text-primary-300">
          ← Back to your account
        </Link>
      </div>
    </main>
  );
}

function Section({
  title,
  body,
  badge,
  badOk,
}: {
  title: string;
  body: string;
  badge?: string;
  badOk?: boolean;
}) {
  return (
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-white">{title}</h2>
        {badge && (
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${
              badOk ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-300">{body}</p>
    </section>
  );
}