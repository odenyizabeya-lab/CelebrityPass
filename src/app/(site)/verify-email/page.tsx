import type { Metadata } from "next";
import Link from "next/link";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { safeAsync } from "@/lib/safe-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Confirm your CelebrityPass email address.",
  alternates: { canonical: "/verify-email" },
};

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let state: "missing" | "invalid" | "verified" = "missing";
  let email = "";

  if (token) {
    const tokenHash = hashToken(token);
    const result = await safeAsync(
      async () => {
        const row = await prisma.emailVerificationToken.findUnique({
          where: { tokenHash },
          include: { fan: true },
        });
        if (row && !row.usedAt && row.expiresAt > new Date()) {
          await prisma.emailVerificationToken.update({
            where: { id: row.id },
            data: { usedAt: new Date() },
          });
          await prisma.fan.update({
            where: { id: row.fanId },
            data: { emailVerified: true, emailVerifiedAt: new Date() },
          });
          return { state: "verified" as const, email: row.fan.email };
        }
        return { state: "invalid" as const, email: "" };
      },
      { state: "invalid" as const, email: "" },
    );
    state = result.state;
    email = result.email;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400">Account</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
        {state === "verified" ? "Email verified ✓" : state === "invalid" ? "Link invalid or expired" : "Verify your email"}
      </h1>

      {state === "verified" && (
        <>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Your email {email && <span className="text-zinc-200">{email} </span>}has been verified. You can now receive
            account &amp; security notifications reliably.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="btn-grad rounded-full px-6 py-3 text-sm font-bold text-white">
              Go to dashboard
            </Link>
            <Link href="/account" className="rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/5">
              Preferences
            </Link>
          </div>
        </>
      )}

      {state === "invalid" && (
        <>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            This verification link is invalid or has expired. Please sign in and you can re-verify your email from your
            account settings.
          </p>
          <Link href="/account" className="btn-grad mt-6 rounded-full px-6 py-3 text-sm font-bold text-white">
            Sign in
          </Link>
        </>
      )}

      {state === "missing" && (
        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
          You need a verification link. Sign in to check your verification status.
        </p>
      )}
    </div>
  );
}