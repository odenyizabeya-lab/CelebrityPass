import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import UniversalCheckout from "@/components/payments/UniversalCheckout";
import { buildPaymentMethods } from "@/lib/ticketing/universal";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const fanId = await getCurrentFanId();
  if (!fanId) redirect(`/login?next=/checkout/${id}`);

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      celebrity: { select: { name: true, slug: true, accentColor: true } },
      membershipLevel: { select: { name: true } },
    },
  });
  if (!payment || payment.fanId !== fanId) notFound();

  if (payment.status === "PAID" && payment.cardId) {
    const card = await prisma.fanCard.findUnique({ where: { id: payment.cardId } });
    if (card) {
      redirect(`/celebrity/${payment.celebrity!.slug}/fan/${card.fanNumber}`);
    }
  }

  const label = payment.membershipLevel?.name ?? "Fan Membership";
  const plan = {
    kind: "FAN_CARD" as const,
    id: payment.id,
    ref: payment.description ?? "Fan Card",
    title: payment.description ?? `${payment.celebrity!.name} — ${label}`,
    amountCents: Math.round(payment.amount * 100),
    currency: payment.currency || "USD",
  };
  const { methods, defaultMethod } = await buildPaymentMethods(plan);

  // If the customer already has an unverified Bank Transfer proof, show it
  // instead of letting them pay again.
  const pendingProof = await prisma.bankTransferProof.findFirst({
    where: { paymentId: payment.id, status: "PENDING_VERIFICATION" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: payment.celebrity!.accentColor }}>
          Secure checkout
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Complete your purchase</h1>
        <p className="mx-auto mt-3 max-w-lg text-zinc-400">
          You&apos;re one step away from your official {payment.celebrity!.name} fan card. Your card page is issued once
          your payment is verified.
        </p>
      </div>

      {/* Order summary */}
      <div
        className="mb-6 overflow-hidden rounded-3xl p-6 text-white shadow-xl ring-1 ring-white/15"
        style={{ background: `linear-gradient(130deg, ${payment.celebrity!.accentColor}, #27104a 45%, #0b0c10)` }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Order Summary</p>
            <h2 className="mt-1 text-xl font-black">Your {payment.celebrity!.name} Fan Card</h2>
            <p className="text-sm text-white/70">{plan.title}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/60">Total due</p>
            <p className="text-3xl font-black">{new Intl.NumberFormat("en", { style: "currency", currency: payment.currency || "USD" }).format(payment.amount)}</p>
          </div>
        </div>
      </div>

      {pendingProof ? (
        <div className="glass rounded-3xl p-7">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-2xl font-black text-emerald-900">✓</div>
            <h2 className="mt-4 text-xl font-black text-white">Transfer submitted for verification</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-emerald-200/80">
              We&apos;ve received your transfer details and proof (reference{" "}
              <span className="font-mono">{pendingProof.reference ?? "n/a"}</span>). Your purchase stays{" "}
              <span className="font-semibold text-emerald-200">Pending Verification</span> until we confirm the funds
              have arrived.
            </p>
            <a
              href={`/celebrity/${payment.celebrity!.slug}`}
              className="mt-6 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
            >
              Back to {payment.celebrity!.name}
            </a>
          </div>
        </div>
      ) : (
        <div className="glass rounded-3xl p-7">
          <UniversalCheckout
            kind="FAN_CARD"
            methods={methods}
            defaultMethod={defaultMethod}
            amountCents={Math.round(payment.amount * 100)}
            currency={payment.currency || "USD"}
            purchaseTitle={plan.title}
            accent={payment.celebrity!.accentColor}
            redirectUrl={`/celebrity/${payment.celebrity!.slug}`}
            purchaseId={payment.id}
          />
        </div>
      )}
    </div>
  );
}