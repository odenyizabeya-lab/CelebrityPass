import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getCurrentFanId } from "@/lib/auth";
import { POST_LOGIN_DEFAULT, sanitizeNext } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Fan Login",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Never bounce an already-signed-in fan back through registration. A missing
  // or corrupt session cookie simply resolves to null, which shows the form.
  const fanId = await getCurrentFanId().catch(() => null);
  if (fanId) redirect(sanitizeNext(next) ?? POST_LOGIN_DEFAULT);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-full flex-1 items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
