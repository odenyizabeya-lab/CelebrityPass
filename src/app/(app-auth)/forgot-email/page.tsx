import type { Metadata } from "next";
import { Suspense } from "react";
import ForgotEmailForm from "@/components/ForgotEmailForm";

export const metadata: Metadata = {
  title: "Recover Account Email",
  robots: { index: false, follow: false },
};

export default function ForgotEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-full flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>
      }
    >
      <ForgotEmailForm />
    </Suspense>
  );
}