import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import CheckoutForm from "@/components/tickets/CheckoutForm";
import { getEventById } from "@/lib/events/service";
import { getEventTicketView } from "@/lib/ticketing/service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ eventId?: string; sel?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { eventId } = await searchParams;
  const event = eventId ? await getEventById(eventId) : null;
  return { title: event ? `Checkout — ${event.name}` : "Checkout" };
}

export default async function CheckoutPage({ searchParams }: Props) {
  const { eventId, sel } = await searchParams;
  if (!eventId) notFound();

  const event = await getEventById(eventId);
  if (!event) notFound();

  const view = await getEventTicketView(eventId);
  if (!view || view.eventStatus !== "UPCOMING") notFound();

  const selection = parseSelection(sel ?? "");
  if (selection.length === 0) notFound();
  const validSelection = selection.filter((s) => view.tickets.some((t) => t.inventoryId === s.inventoryId && t.sellable));
  if (validSelection.length === 0) notFound();

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { isEnabled: true, hasCredentials: true },
    select: { id: true, name: true, kind: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
      <Link href={`/celebrity/${event.celebritySlug}/event/${event.eventId}/tickets`} className="text-sm font-semibold text-zinc-400 transition hover:text-white">
        ← Back to ticket selection
      </Link>
      <h1 className="mt-4 text-3xl font-black tracking-tight">Checkout</h1>
      <p className="mt-1 text-zinc-400">
        {event.celebrityName} · {event.name}
      </p>

      <div className="mt-8">
        {validSelection.length > 0 ? (
          <CheckoutForm
            eventId={event.eventId}
            eventName={event.name}
            tickets={view.tickets}
            selection={validSelection}
            officialTicketUrl={event.ticketUrl}
            paymentMethods={paymentMethods}
          />
        ) : (
          <EmptyState title="Tickets are no longer available" message="The tickets you selected are no longer available for this event." />
        )}
      </div>
    </div>
  );
}

function parseSelection(raw: string): { inventoryId: string; quantity: number }[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [inventoryId, qty] = part.split(":");
      return { inventoryId: inventoryId ?? "", quantity: Math.max(1, Math.min(Number(qty) || 1, 8)) };
    })
    .filter((s) => s.inventoryId);
}