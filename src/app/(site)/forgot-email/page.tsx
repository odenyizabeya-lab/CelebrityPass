import type { Metadata } from "next";
import { Suspense } from "react";
import ForgotEmailForm from "@/components/ForgotEmailForm";

export const metadata: Metadata = {
  title: "Recover Account Email",
  robots: { index: false, follow: false },
};

export default function ForgotEmailPage() {
  return (
    <div className="px-4 py-20 sm:px-6">
      <Suspense fallback={<div className="glass mx-auto max-w-md rounded-3xl p-8 text-center text-sm text-zinc-400">Loading…</div>}>
        <ForgotEmailForm />
      </Suspense>
    </div>
  );
}