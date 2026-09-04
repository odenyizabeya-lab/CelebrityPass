import type { Metadata } from "next";
import { Suspense } from "react";
import RegisterForm from "@/components/RegisterForm";

export const metadata: Metadata = {
  title: "Account Registration",
  description: "Create a free CelebrityPass account.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <div className="px-4 py-20 sm:px-6">
      <Suspense fallback={<div className="glass mx-auto max-w-md rounded-3xl p-8 text-center text-sm text-zinc-400">Loading…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
