import type { Metadata } from "next";
import { Suspense } from "react";
import PasswordResetForm from "@/components/PasswordResetForm";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your CelebrityPass password.",
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh w-full flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>
      }
    >
      <PasswordResetForm />
    </Suspense>
  );
}