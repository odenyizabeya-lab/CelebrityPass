import type { Metadata } from "next";
import { Suspense } from "react";
import PasswordResetForm from "@/components/PasswordResetForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your CelebrityPass password.",
};

export default function ResetPasswordPage() {
  return (
    <div className="px-4 py-20 sm:px-6">
      <Suspense fallback={<div className="glass mx-auto max-w-md rounded-3xl p-8 text-center text-sm text-zinc-400">Loading…</div>}>
        <PasswordResetForm />
      </Suspense>
    </div>
  );
}
