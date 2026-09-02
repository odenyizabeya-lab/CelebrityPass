import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JoinForm from "@/components/JoinForm";
import { getCelebrityBySlug } from "@/lib/services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Get a Fan Card" };

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const celebrity = await getCelebrityBySlug(slug);
  if (!celebrity) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="mb-10 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: celebrity.accentColor }}>
          Join the fan community
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Get your <span style={{ color: celebrity.accentColor }}>{celebrity.name}</span> Fan Card
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-400">
          Enter your details below. In seconds you&apos;ll receive an official, QR-verified fan card with your own
          unique Fan ID — issued exclusively under {celebrity.name}&apos;s community.
        </p>
      </div>
      <JoinForm
        slug={celebrity.slug}
        celebrityName={celebrity.name}
        accent={celebrity.accentColor}
        memberships={celebrity.memberships}
      />
    </div>
  );
}