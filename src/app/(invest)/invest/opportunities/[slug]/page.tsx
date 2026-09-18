import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import { getOpportunityBySlug, parseDisclosures, parseEligibility } from "@/lib/invest/opportunities";
import { getOrCreateInvestorAccount } from "@/lib/invest/account";
import { isAcceptingFunds } from "@/lib/invest/opportunities";
import { formatMoney } from "@/lib/invest/mode";
import SubscribeForm from "@/components/invest/SubscribeForm";
import DisclosureAccept from "@/components/invest/DisclosureAccept";

export const dynamic = "force-dynamic";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const opp = await getOpportunityBySlug(slug);
  if (!opp) notFound();

  const fanId = await getCurrentFanId();
  let kycStatus = "NOT_STARTED";
  let disclosures: Array<{ key: string; version: string; title: string; accepted: boolean }> = [];
  if (fanId) {
    const account = await getOrCreateInvestorAccount(fanId);
    kycStatus = account.kycStatus;
    const accepted = await prisma.disclosureAcceptance.findMany({
      where: { investorId: account.id, opportunityId: opp.id },
      select: { documentKey: true, documentVersion: true },
    });
    disclosures = parseDisclosures(opp.disclosuresJson).map((d) => ({
      key: d.key,
      version: d.version,
      title: d.title ?? d.key,
      accepted: accepted.some((a) => a.documentKey === d.key && a.documentVersion === d.version),
    }));
  }

  const open = isAcceptingFunds(opp);
  const acceptFunds = open;
  const remaining = opp.targetAmount && opp.targetAmount.gt(0) ? opp.targetAmount.minus(opp.raisedAmount) : null;
  const eligibility = parseEligibility(opp.eligibilityJson);
  const period = safeParse(opp.investmentPeriodJson);
  const fees = safeParse(opp.feesJson);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/invest/opportunities" className="text-sm text-zinc-400 hover:text-white">← All opportunities</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{opp.investmentType.replaceAll("_", " ")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{opp.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">{opp.companyName}</p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-bold ${open ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
          {open ? "Accepting funds" : "Not accepting funds"}
        </span>
      </div>

      {opp.description && <p className="mt-6 max-w-3xl text-zinc-300">{opp.description}</p>}

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <DetailStat label="Minimum" value={opp.minAmount ? formatMoney(opp.minAmount) : "—"} />
        <DetailStat label="Maximum per investor" value={opp.maxAmount ? formatMoney(opp.maxAmount) : "—"} />
        <DetailStat label="Raised" value={formatMoney(opp.raisedAmount)} />
        <DetailStat label="Target" value={opp.targetAmount ? formatMoney(opp.targetAmount) : "—"} />
        <DetailStat
          label="Remaining capacity"
          value={remaining !== null && remaining.lte(0) ? "Filled" : remaining !== null ? formatMoney(remaining) : "Not capped"}
        />
      </div>

      {opp.expectedReturnText && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Expected return</p>
          <p className="mt-2 text-sm text-zinc-300">{opp.expectedReturnText}</p>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {opp.risksText && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-400">Risks</p>
            <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">{opp.risksText}</p>
          </div>
        )}
        {opp.liquidityText && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Liquidity</p>
            <p className="mt-2 text-sm text-zinc-300">{opp.liquidityText}</p>
          </div>
        )}
      </div>

      {opp.legalTermsText && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Legal terms</p>
          <p className="mt-2 whitespace-pre-line text-sm text-zinc-300">{opp.legalTermsText}</p>
        </div>
      )}

      {period ? (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Investment period</p>
          <pre className="mt-2 text-sm text-zinc-300">{formatPeriod(period)}</pre>
        </div>
      ) : null}

      {eligibility && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Eligibility</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-300">
            {eligibility.text && <li>{eligibility.text}</li>}
            {eligibility.minAgeYears && <li>Minimum age: {eligibility.minAgeYears} years</li>}
            {eligibility.countries && <li>Available in: {eligibility.countries.join(", ")}</li>}
            {eligibility.kycRequired && <li>KYC verification required</li>}
          </ul>
        </div>
      )}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-extrabold text-white">Invest in this opportunity</h2>
          {fanId ? (
            acceptFunds ? (
              <>
                <p className="mt-1 text-sm text-zinc-400">
                  {kycStatus === "VERIFIED" ? "Identity verified." : `Your KYC status: ${kycStatus}. You will be blocked server-side if this investment requires verified identity.`}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  Pay by bank transfer or ATM, upload your receipt, and wait for manual verification. Nothing is credited until the real transfer is confirmed.
                </p>
                <div className="mt-4">
                  <SubscribeForm
                    opportunityId={opp.id}
                    slug={opp.slug}
                    minAmount={opp.minAmount && !opp.minAmount.isZero() ? opp.minAmount.toNumber() : 100}
                    maxAmount={opp.maxAmount ? opp.maxAmount.toNumber() : null}
                    currency={opp.currency}
                  />
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">This investment is not currently open to new subscriptions.</p>
            )
          ) : (
            <p className="mt-2 text-sm text-zinc-400">
              <Link href="/login" className="font-bold text-primary-400 hover:underline">Sign in</Link> to subscribe.
            </p>
          )}
          {fees ? (
            <p className="mt-4 text-xs text-zinc-600">Fees: {formatFees(fees)}</p>
          ) : null}
        </section>

        {fanId && <DisclosureAccept slug={opp.slug} disclosures={disclosures} />}
      </div>
    </main>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function formatPeriod(period: unknown): string {
  if (Array.isArray(period)) return period.map(String).join(" • ");
  if (period && typeof period === "object") {
    return Object.entries(period as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(" • ");
  }
  return String(period);
}

function formatFees(fees: unknown): string {
  if (!fees || typeof fees !== "object") return "—";
  const f = fees as Record<string, unknown>;
  const rate = f.subscriptionRate;
  return rate != null ? `${rate}% subscription fee` : "—";
}