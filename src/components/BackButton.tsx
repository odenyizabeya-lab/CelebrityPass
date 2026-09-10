"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ href = "/celebrities" }: { href?: string }) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace(href);
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back to the previous page"
      className="group inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-zinc-300 ring-1 ring-white/10 backdrop-blur transition hover:text-white hover:ring-white/25"
    >
      <svg
        className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>Back</span>
    </button>
  );
}