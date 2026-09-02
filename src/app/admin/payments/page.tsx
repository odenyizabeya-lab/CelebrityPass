import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/payments";
import PaymentRowActions from "@/components/admin/PaymentRowActions";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? undefined;
  const q = sp.q?.trim().toLowerCase();

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  let payments = await prisma.payment.findMany({
    where,
    include: { fan: { select: { name: true, email: true } }, card: { select: { fanNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (q) {
    payments = payments.filter((p) =>
      [p.fan.name, p.fan.email, p.description, p.gatewayRef, p.card?.fanNumber]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }

  const revenue = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === "PENDING").length;
  const statusOptions = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Payments</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {payments.length} transaction{payments.length === 1 ? "" : "s"} ·{" "}
        <span className="text-emerald-300">collected {formatMoney(revenue)}</span> · {pendingCount} pending
        {q ? ` matching "${sp.q}"` : ""}
        {status ? ` · status ${status}` : ""}.
      </p>

      <form method="GET" className="mt-6 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          className="w-full max-w-sm rounded-full border border-white/10 bg-ink-800 px-5 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-primary-500"
          placeholder="Search fan, email, description, reference…"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-full border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white outline-none focus:border-primary-500"
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20">
          Filter
        </button>
        {(sp.q || sp.status) && (
          <a href="/admin/payments" className="rounded-full px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:text-white">
            Clear
          </a>
        )}
      </form>

      <div className="glass mt-6 overflow-hidden rounded-3xl">
        {payments.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-zinc-500">No payments match these filters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Fan</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                  <th className="px-5 py-3 font-semibold">Reference</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {payments.map((p) => (
                  <tr key={p.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-white">{p.description}</p>
                      <p className="text-xs text-zinc-500">
                        {p.card ? <a href={`#`} className="font-mono text-primary-300">{p.card.fanNumber}</a> : "card not issued"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-white">{p.fan.name}</p>
                      <p className="text-xs text-zinc-500">{p.fan.email}</p>
                    </td>
                    <td className="px-5 py-3.5 font-black text-white">{formatMoney(p.amount, p.currency)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-zinc-400">{p.gatewayRef ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <PaymentStatus status={p.status} />
                    </td>
                    <td className="px-5 py-3.5 text-zinc-400">
                      {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <PaymentRowActions id={p.id} status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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