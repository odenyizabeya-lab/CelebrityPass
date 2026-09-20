import Link from "next/link";
import { getCurrentFanId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const fanId = await getCurrentFanId();

  const items = [
    ...(fanId
      ? [{ href: "/invest/portfolio", label: "Portfolio", desc: "Holdings, orders and history" }]
      : [{ href: "/login?next=/invest/portfolio", label: "Portfolio", desc: "Sign in to see your portfolio" }]),
    { href: "/invest/deposit", label: "Deposit money", desc: "Add cash by Bank Transfer / ATM" },
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">More</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Everything about your CelebrityPass investing experience.</p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#0a0d13] ring-1 ring-white/[0.07]">
        {items.map((it, i) => (
          <Link
            key={i}
            href={it.href}
            className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3.5 transition last:border-0 hover:bg-white/[0.03]"
          >
            <span>
              <span className="block text-[14px] font-bold text-white">{it.label}</span>
              <span className="block text-[11px] text-zinc-500">{it.desc}</span>
            </span>
            <svg className="h-4 w-4 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        ))}
      </div>

      <p className="rounded-lg bg-white/[0.02] px-3 py-2 text-center text-[11px] leading-relaxed text-zinc-600 ring-1 ring-white/[0.05]">
        CelebrityPass does not provide investment advice. Nothing here is an offer or solicitation to buy or sell any
        security.
      </p>
    </div>
  );
}