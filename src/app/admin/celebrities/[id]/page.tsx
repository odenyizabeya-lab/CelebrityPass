import Link from "next/link";
import CountUp from "@/components/CountUp";
import CelebrityForm from "@/components/admin/CelebrityForm";
import MembershipsManager from "@/components/admin/MembershipsManager";
import DeleteCelebrityButton from "@/components/admin/DeleteCelebrityButton";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditCelebrityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const celebrity = await prisma.celebrity.findUnique({
    where: { id },
    include: {
      memberships: { orderBy: { displayOrder: "asc" } },
      _count: { select: { fans: true, memberships: true } },
    },
  });
  if (!celebrity) notFound();

  const fans = await prisma.fan.findMany({
    where: { cards: { some: { celebrityId: id } } },
    select: { country: true },
  });
  const countries = new Set(fans.map((f) => f.country).filter(Boolean));
  const distinctFanCount = new Set(fans.map(() => true)).size;

  return (
    <div>
      <Link href="/admin/celebrities" className="text-sm font-semibold text-zinc-400 transition hover:text-white">
        ← Back to celebrities
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{celebrity.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            /celebrity/{celebrity.slug} · {celebrity.category} · {celebrity.country}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/celebrity/${celebrity.slug}`}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-300 ring-1 ring-white/15 transition hover:text-white"
          >
            View community →
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl px-5 py-4">
          <p className="text-2xl font-black text-white"><CountUp value={distinctFanCount} /></p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Registered Fans</p>
        </div>
        <div className="glass rounded-2xl px-5 py-4">
          <p className="text-2xl font-black text-white"><CountUp value={countries.size} /></p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Countries Represented</p>
        </div>
        <div className="glass rounded-2xl px-5 py-4">
          <p className="text-2xl font-black text-white">{celebrity._count.memberships}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-500">Membership Levels</p>
        </div>
      </div>

      <div className="mt-8">
        <CelebrityForm mode="edit" celebrity={celebrity} />
      </div>

      <div className="mt-8">
        <MembershipsManager celebrityId={celebrity.id} initial={celebrity.memberships} initialPhoto={celebrity.profileImage} />
      </div>

      <div className="glass mt-8 rounded-3xl border-rose-500/20 p-6 sm:p-8">
        <h2 className="text-lg font-black tracking-tight text-rose-300">Danger Zone</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Deleting this community permanently removes the celebrity, its membership levels, and all issued fan cards.
          This cannot be undone.
        </p>
        <div className="mt-4">
          <DeleteCelebrityButton id={celebrity.id} name={celebrity.name} cardCount={celebrity._count.fans} />
        </div>
      </div>
    </div>
  );
}