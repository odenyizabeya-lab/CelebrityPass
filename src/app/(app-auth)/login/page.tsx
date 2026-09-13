import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getCurrentFanId } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Fan Login",
  robots: { index: false, follow: false },
};

/** Only same-site relative paths may carry the ?next= redirect target. */
function sanitizeNext(next: string | undefined): string | null {
  if (!next) return null;
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const fanId = await getCurrentFanId().catch(() => null);
  if (fanId) redirect(sanitizeNext(next) ?? "/dashboard");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-full flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}