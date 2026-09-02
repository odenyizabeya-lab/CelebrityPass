import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Fan Login" };

export default function LoginPage() {
  return (
    <div className="px-4 py-20 sm:px-6">
      <Suspense fallback={<div className="glass mx-auto max-w-md rounded-3xl p-8 text-center text-sm text-zinc-400">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}