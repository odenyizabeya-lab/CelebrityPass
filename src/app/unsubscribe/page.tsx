import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Manage your CelebrityPass email notifications.",
  alternates: { canonical: "/unsubscribe" },
};

/**
 * One-click unsubscribe (GDPR/CAN-SPAM friendly). The email footer links to
 * /unsubscribe?fan=<id>&t=<signed-token>; the token is verified server-side,
 * then ALL optional notification categories are switched off.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ fan?: string; t?: string }>;
}) {
  const { fan, t } = await searchParams;
  let ok = false;

  if (fan && t && verifyToken(t) === fan) {
    const updated = await prisma.fan.updateMany({
      where: { id: fan },
      data: {
        notifyNewCelebrities: false,
        notifyUpdates: false,
        notifyCommunity: false,
        notifyPromotions: false,
        unsubscribedAt: new Date(),
      },
    });
    ok = updated.count > 0;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Notifications</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
        {ok ? "You're unsubscribed" : "Something went wrong"}
      </h1>
      {ok ? (
        <>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            You have been unsubscribed from CelebrityPass announcements. You will still receive essential messages about
            your account, security and payments. You can change your mind any time in account settings.
          </p>
          <Link href="/account" className="btn-grad mt-6 rounded-full px-6 py-3 text-sm font-bold text-white">
            Manage preferences
          </Link>
        </>
      ) : (
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          We couldn&rsquo;t verify that unsubscribe link. If the problem persists, sign in and update your preferences
          directly.
        </p>
      )}
    </div>
  );
}