import Link from "next/link";
import { NativeCard, SectionTitle } from "@/components/invest-app/native";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Market information",
    body: "CelebrityPass displays real-time market data for publicly traded companies provided by an external market-data provider. Prices, ranges, volume and statistics are informational and are not recommendations.",
  },
  {
    title: "Orders",
    body: "Orders are sent to an authorized brokerage/custody provider that issues, holds and settles the securities. An order only becomes an execution when that provider confirms it — CelebrityPass never invents or back-dates executions.",
  },
  {
    title: "Ownership",
    body: "You own shares only when the brokerage reports a filled execution in your account. A database record or deposit is never presented as stock ownership. Holdings on your portfolio always mirror the brokerage account.",
  },
  {
    title: "Fees",
    body: "Order estimates show the estimated price, estimated shares and estimated fees before you confirm. Actual execution prices and fees come from the order report supplied by the brokerage.",
  },
  {
    title: "Current status",
    body: "A brokerage connection is not yet active. Until an authorized integration exists, the app shows market information and any order you place is held as pending or rejected with an honest explanation — nothing is executed or charged.",
  },
  {
    title: "Accounts & money",
    body: "Buying power shown on your portfolio reflects your connected brokerage account. Deposits to CelebrityPass are not investments and are not presented as holdings.",
  },
];

export default async function InvestingInfoPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/invest/more" className="text-[14px] font-bold text-sky-400">
          ← More
        </Link>
        <h1 className="mt-2 text-[26px] font-black tracking-tight text-white">Investing &amp; brokerage</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
          How securities work on CelebrityPass — plainly, without overclaiming.
        </p>
      </div>

      {sections.map((s, i) => (
        <section key={s.title} className="fade-up">
          <SectionTitle>{i + 1}. {s.title}</SectionTitle>
          <NativeCard className="mt-3 p-5">
            <p className="text-[14px] leading-relaxed text-zinc-300">{s.body}</p>
          </NativeCard>
        </section>
      ))}

      <NativeCard className="border border-sky-500/25 bg-sky-500/[0.08] p-5 ring-sky-500/20">
        <p className="text-[16px] font-extrabold text-white">Risk disclosure</p>
        <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
          Investing involves risk. The value of an investment can go down as well as up. Past performance does not
          guarantee future results. Securities are not insured against market loss. Review the full{" "}
          <Link href="/legal/terms" className="font-bold text-sky-400 underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/security" className="font-bold text-sky-400 underline underline-offset-2">Security</Link> pages
          before investing.
        </p>
      </NativeCard>
    </div>
  );
}