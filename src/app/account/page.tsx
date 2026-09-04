import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFanId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AccountSettingsForm from "@/components/AccountSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your CelebrityPass account, password, and data.",
  alternates: { canonical: "/account" },
};

export default async function AccountPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/account");

  const fan = await prisma.fan.findUnique({ where: { id: fanId } });
  if (!fan || !fan.isActive) redirect("/login?next=/account");

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
      </div>

      <div className="mt-8">
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
      </div>
    </div>
  );
}
