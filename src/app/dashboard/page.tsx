import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/payments";
import FanCardView, { type CardViewData } from "@/components/FanCardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/dashboard");

  const fan = await prisma.fan.findUnique({
    where: { id: fanId },
    include: {
      cards: { include: { celebrity: true, membershipLevel: true }, orderBy: { createdAt: "desc" } },
      payments: {
        include: { celebrity: { select: { name: true, slug: true, accentColor: true } }, membershipLevel: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!fan) redirect("/login?next=/dashboard");

  const pending = fan.payments.filter((p) => p.status === "PENDING");

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Fan Dashboard</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Welcome back, {fan.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {fan.email} · member since{" "}
            {fan.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short" })}
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold text-white">Your Fan Communities</h2>
        {fan.cards.length === 0 ? (
          <div className="glass mt-6 rounded-3xl border-dashed px-6 py-16 text-center">
            <h3 className="text-lg font-bold text-white">You don&apos;t have any fan cards yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
              Join any celebrity community and get your first official fan card in under a minute.
            </p>
            <Link
              href="/celebrities"
              className="btn-grad mt-6 inline-block rounded-full px-6 py-3 text-sm font-bold text-white"
            >
              Browse Communities
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-10 gap-y-12 lg:grid-cols-2">
            {fan.cards.map((card) => {
              const viewData: CardViewData = {
                fanNumber: card.fanNumber,
                status: card.status,
                registeredAt: card.registeredAt,
                cardUrl: card.cardUrl,
                qrCode: card.qrCode,
                fanName: fan.name,
                fanCountry: fan.country,
                membershipName: card.membershipLevel?.name ?? null,
                celebrity: {
                  name: card.celebrity.name,
                  slug: card.celebrity.slug,
                  accentColor: card.celebrity.accentColor,
                  cardDesign: card.celebrity.cardDesign,
                  profileImage: card.celebrity.profileImage,
                  coverImage: card.celebrity.coverImage,
                },
              };
              return (
                <div key={card.id} className="glass rounded-3xl p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-xl">
                      {card.celebrity.profileImage ? (
                        <Image
                          src={card.celebrity.profileImage}
                          alt={card.celebrity.name}
                          width={48}
                          height={60}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div
                          className="grid h-full w-full place-items-center text-sm font-bold text-white"
                          style={{ backgroundColor: card.celebrity.accentColor }}
                        >
                          {card.celebrity.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-widest text-zinc-500">Your Fan Community</p>
                      <h3 className="truncate text-xl font-black text-white">{card.celebrity.name}</h3>
                    </div>
                  </div>
                  <FanCardView card={viewData} />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/celebrity/${card.celebrity.slug}/fan/${card.fanNumber}`}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5"
                    >
                      View Card Page
                    </Link>
                    <Link
                      href={`/celebrity/${card.celebrity.slug}`}
                      className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:text-white"
                    >
                      Community →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== Pending payments ===== */}
      {pending.length > 0 && (
        <div className="mt-14">
          <h2 className="text-lg font-bold text-white">Complete Your Purchase</h2>
          <p className="mt-1 text-sm text-zinc-400">
            You started these orders but haven&apos;t finished paying. Complete checkout to receive your card.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {pending.map((p) => (
              <div key={p.id} className="glass flex items-center justify-between gap-4 rounded-2xl p-5">
                <div className="min-w-0">
                  <p className="font-bold text-white">{p.celebrity?.name ?? "Community"}</p>
                  <p className="text-sm text-zinc-400">{p.description}</p>
                  <p className="mt-1 text-sm font-black" style={{ color: p.celebrity?.accentColor ?? "#8b5cf6" }}>
                    {formatMoney(p.amount, p.currency)}
                  </p>
                </div>
                <Link
                  href={`/checkout/${p.id}`}
                  className="btn-grad shrink-0 rounded-full px-6 py-2.5 text-sm font-bold text-white"
                >
                  Complete Purchase
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Purchase history ===== */}
      {fan.payments.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-bold text-white">Purchase History</h2>
          <div className="glass mt-4 overflow-hidden rounded-2xl">
            <ul className="divide-y divide-white/[0.05]">
              {fan.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{p.description}</p>
                    <p className="text-xs text-zinc-500">
                      {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-white">{formatMoney(p.amount, p.currency)}</span>
                    <PaymentStatus status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: "bg-emerald-500/15 text-emerald-300",
    PENDING: "bg-amber-500/15 text-amber-300",
    FAILED: "bg-rose-500/15 text-rose-300",
    REFUNDED: "bg-zinc-500/15 text-zinc-400",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${map[status] ?? map.PENDING}`}>{status}</span>;
}

function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        const { clearFanSession } = await import("@/lib/auth");
        await clearFanSession();
        redirect("/");
      }}
    >
      <button className="rounded-full px-4 py-2 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white hover:ring-white/30">
        Sign out
      </button>
    </form>
  );
}