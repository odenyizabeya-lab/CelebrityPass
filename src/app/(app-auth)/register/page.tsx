import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import RegisterForm from "@/components/RegisterForm";
import { getCurrentFanId } from "@/lib/auth";
import { POST_AUTH_DEFAULT, sanitizeNext } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Account Registration",
  description: "Create a free CelebrityPass account.",
  alternates: { canonical: "/register" },
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // An existing session must never be sent back through registration.
  const fanId = await getCurrentFanId().catch(() => null);
  if (fanId) redirect(sanitizeNext(next) ?? POST_AUTH_DEFAULT);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-full flex-1 items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
