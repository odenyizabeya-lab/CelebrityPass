import Link from "next/link";
import { getCurrentFanId } from "@/lib/auth";
import { Chevron, NativeCard } from "@/components/invest-app/native";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const fanId = await getCurrentFanId();

  const items = [
    ...(fanId
      ? [{ href: "/invest/portfolio", label: "Portfolio", desc: "Holdings, orders and history" }]
      : [{ href: "/login?next=/invest/portfolio", label: "Portfolio", desc: "Sign in to see your portfolio" }]),
    { href: "/invest/deposit", label: "Deposit money", desc: "Add cash by bank transfer or ATM deposit" },
    { href: "/invest/markets", label: "Markets", desc: "Eligible publicly traded securities" },
    { href: "/invest/news", label: "News", desc: "Official company news sources" },
    { href: "/account", label: "Account & security", desc: "Profile, security and preferences" },
    { href: "/invest/more/investing", label: "Investing & brokerage", desc: "How investing on CelebrityPass works" },
    { href: "/legal/terms", label: "Terms", desc: "Services agreement" },
    { href: "/legal/privacy", label: "Privacy", desc: "How your data is handled" },
    { href: "/security", label: "Security", desc: "Our security practices" },
    { href: "/help", label: "Help & support", desc: "Get assistance" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">More</p>
        <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">Settings &amp; info</h1>
      </div>

      <NativeCard className="divide-y divide-white/[0.06]">
        {items.map((it, i) => (
          <Link
            key={i}
            href={it.href}
            className="flex items-center justify-between gap-3 px-4 py-4 transition active:bg-white/[0.04]"
          >
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-white">{it.label}</span>
              <span className="block text-[12px] text-zinc-500">{it.desc}</span>
            </span>
            <Chevron />
          </Link>
        ))}
      </NativeCard>

      <p className="rounded-2xl bg-white/[0.02] px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        CelebrityPass does not provide investment advice. Nothing here is an offer or solicitation to buy or sell any
        security.
      </p>
    </div>
  );
}