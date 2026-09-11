import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentFanId } from "@/lib/auth";
import CelebrityPicker from "@/components/onboarding/CelebrityPicker";

export const metadata: Metadata = {
  title: "Choose Your Celebrities — CelebrityPass",
  description:
    "Pick the celebrities you want to follow. You can change your choices anytime.",
};

export default async function OnboardingCelebritiesPage() {
  const fanId = await getCurrentFanId();
  if (!fanId) redirect("/login?next=/onboarding/celebrities");

  const existing = await prisma.fanCelebritySelection.count({ where: { fanId } });
  if (existing > 0) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary-300">
          Onboarding
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Choose Your <span className="gradient-text">Celebrities</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
          Select the communities you want to stay close to. This personalizes your
          feed and chat suggestions — you can update it anytime.
        </p>
      </div>

      <div className="mt-10">
        <CelebrityPicker />
      </div>
    </div>
  );
}