import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EmptyState from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import TicketQrDisplay from "@/components/tickets/TicketQrDisplay";
import { safeLocalDate } from "@/lib/utils";
import { safeAsync } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ref } = await params;
  return { title: `Ticket — Order ${ref}` };
}

export default async function TicketPage({ params, searchParams }: Props) {
  const { ref } = await params;
  const { t: token } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <EmptyState title="Access required" message="Sign in with your order link to view your ticket." />
      </div>
    );
  }

  const order = await safeAsync(async () =>
    prisma.ticketOrder.findUnique({
      where: { orderRef: ref },
      select: {
        id: true,
        orderRef: true,
        accessToken: true,
        status: true,
        ticketCode: true,
        customerName: true,
        customerEmail: true,
        totalCents: true,
        currency: true,
        event: {
          select: {
            eventId: true,
            name: true,
            startAt: true,
            endAt: true,
            timezone: true,
            venue: true,
            city: true,
            country: true,
            celebrity: { select: { slug: true, name: true } },
          },
        },
      },
    }),
    null,
  );

  if (!order || order.accessToken !== token) notFound();
  if (order.status !== "CONFIRMED") {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
        <EmptyState title="Order not confirmed" message="Your ticket will appear here once your order is confirmed." />
      </div>
    );
  }

  const ticketCode = order.ticketCode;
  const registration = ticketCode
    ? await safeAsync(async () =>
        prisma.eventRegistration.findUnique({
          where: { ticketCode },
          select: { ticketCode: true, checkedIn: true, checkedInAt: true },
        }),
        null,
      )
    : null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 ring-1 ring-emerald-400/25">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Your Ticket</h1>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
            CONFIRMED
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">Order {order.orderRef}</p>
      </div>

      {/* QR Code */}
      {registration?.ticketCode && (
        <div className="mt-6 flex justify-center">
          <TicketQrDisplay ticketCode={registration.ticketCode} />
        </div>
      )}

      {registration?.checkedIn && (
        <p className="mt-4 text-center text-sm text-emerald-300">
          ✓ Checked in {registration.checkedInAt ? `at ${safeLocalDate(registration.checkedInAt)}` : ""}
        </p>
      )}

      {/* Event Details */}
      <div className="mt-6 glass rounded-2xl p-5">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Event</p>
        <p className="mt-1 text-lg font-bold text-white">{order.event.name}</p>
        <p className="text-sm text-zinc-400">
          {order.event.celebrity.name}
        </p>
        <p className="text-sm text-zinc-400">
          {safeLocalDate(order.event.startAt, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {order.event.startAt && (
            <> · {safeLocalDate(order.event.startAt, { hour: "2-digit", minute: "2-digit" })}</>
          )}
        </p>
        {(order.event.venue || order.event.city) && (
          <p className="text-sm text-zinc-400">
            {[order.event.venue, order.event.city, order.event.country].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      {/* Attendee */}
      <div className="mt-6 glass rounded-2xl p-5">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Attendee</p>
        <p className="mt-1 text-sm font-semibold text-white">{order.customerName}</p>
        <p className="text-xs text-zinc-400">{order.customerEmail}</p>
      </div>

      {/* Instructions */}
      <div className="mt-6 glass rounded-2xl p-5">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Instructions</p>
        <ul className="mt-2 space-y-2 text-sm text-zinc-300">
          <li>• Save this page or take a screenshot of the QR code.</li>
          <li>• Show this QR code at the entrance / check-in desk.</li>
          <li>• Each QR code is unique and can only be scanned once.</li>
        </ul>
      </div>

      {order.totalCents === 0 && (
        <p className="mt-4 text-center text-xs text-zinc-500">
          This was a free registration. No payment was required.
        </p>
      )}
    </div>
  );
}
