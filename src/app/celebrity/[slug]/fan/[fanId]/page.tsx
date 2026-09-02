import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FanCardView, { type CardViewData } from "@/components/FanCardView";
import CopyLinkButton from "@/components/CopyLinkButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string; fanId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fanId } = await params;
  return { title: `${fanId} — Verified Fan Card` };
}

export default async function FanCardPage({ params }: Props) {
  const { slug, fanId } = await params;
  const { getFanCardByNumber } = await import("@/lib/services");
  const card = await getFanCardByNumber(fanId);

  // A card always belongs to exactly one celebrity. If the URL slug does not
  // match the card's actual celebrity, we do not serve it.
  if (!card) notFound();
  if (card.celebrity.slug !== slug) notFound();

  const viewData: CardViewData = {
    fanNumber: card.fanNumber,
    status: card.status,
    registeredAt: card.registeredAt,
    cardUrl: card.cardUrl,
    qrCode: card.qrCode,
    fanName: card.fan.name,
    fanCountry: card.fan.country,
    membershipName: card.membershipLevel?.name ?? null,
    celebrity: {
      name: card.celebrity.name,
      slug: card.celebrity.slug,
      accentColor: card.celebrity.accentColor,
      cardDesign: card.celebrity.cardDesign,
      profileImage: card.celebrity.profileImage,
      coverImage: card.celebrity.coverImage,
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href={`/celebrity/${card.celebrity.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 transition hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {card.celebrity.name}&apos;s Community
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Verified Fan Card</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {card.fanNumber} · issued to {card.fan.name} under {card.celebrity.name}&apos;s fan community
          </p>
        </div>
        <div className="flex gap-3">
          <CopyLinkButton url={card.cardUrl ?? `/celebrity/${card.celebrity.slug}/fan/${card.fanNumber}`} label="Copy Card Link" />
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <FanCardView card={viewData} />
      </div>

      <div className="mx-auto mt-8 max-w-2xl space-y-3 text-sm leading-relaxed text-zinc-500">
        <p>
          This page is the official, QR-verifiable record of <strong className="text-zinc-300">{card.fanNumber}</strong>.
          Scanning the QR code on the card opens this exact URL, proving membership in{" "}
          <strong className="text-zinc-300">{card.celebrity.name}&apos;s</strong> fan community.
        </p>
        <p>
          Card status: <strong className="text-zinc-300">{card.status.toLowerCase()}</strong> · Registered on{" "}
          <strong className="text-zinc-300">{card.registeredAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong>
        </p>
      </div>
    </div>
  );
}