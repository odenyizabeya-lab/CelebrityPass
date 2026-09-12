import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import RecoveryPanel from "@/components/RecoveryPanel";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeAsync } from "@/lib/safe-data";
import AccountSettingsForm from "@/components/AccountSettingsForm";
import NotificationPreferences from "@/components/NotificationPreferences";
import ResendVerificationButton from "@/components/ResendVerificationButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your CelebrityPass account, password, and notifications.",
  alternates: { canonical: "/account" },
};

export default async function AccountPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/account");

  // DB failure shows the shell with a recovery panel instead of a crash.
  const fan = await safeAsync(async () => prisma.fan.findUnique({ where: { id: fanId } }), null);
  if (!fan || !fan.isActive) {
    if (fan && !fan.isActive) redirect("/login?next=/account");
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <RecoveryPanel message="We couldn't load your account right now. Check your connection and try again." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <nav className="text-sm text-zinc-400">
        <Link href="/dashboard" className="transition hover:text-white">Dashboard</Link>
        <span aria-hidden> · </span>
        <span className="text-zinc-200">Account Settings</span>
      </nav>

      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Account</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Account Settings</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {fan.email} · member since{" "}
          {fan.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short" })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              fan.emailVerified
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            {fan.emailVerified ? "Email verified" : "Email not verified"}
          </span>
          {!fan.emailVerified && <ResendVerificationButton />}
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <AccountSettingsForm
          initialFan={{
            id: fan.id,
            name: fan.name,
            email: fan.email,
            phone: fan.phone,
            country: fan.country,
            createdAt: fan.createdAt.toISOString(),
            hasPassword: Boolean(fan.password),
          }}
        />
        <NotificationPreferences
          initial={{
            emailVerified: fan.emailVerified,
            emailVerifiedAt: fan.emailVerifiedAt?.toISOString() ?? null,
            notifyNewCelebrities: fan.notifyNewCelebrities,
            notifyUpdates: fan.notifyUpdates,
            notifyCommunity: fan.notifyCommunity,
            notifyPromotions: fan.notifyPromotions,
            unsubscribedAt: fan.unsubscribedAt?.toISOString() ?? null,
          }}
        />
      </div>
    </div>
  );
}