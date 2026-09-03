import type { GoogleInfo } from "@/lib/google-info";

/**
 * Google-style knowledge panel for a single celebrity, rendered right under
 * the profile header (name ✓ / profession). Layout mirrors Google's search
 * cards: a details row (Age / Born / profession / notable works) and an
 * Overview paragraph. Shows nothing when facts aren't available —
 * never fabricates information.
 */
export default function GooglePanel({ info, category }: { info: GoogleInfo; category: string }) {
  const isMusician = /musician|singer|band|artist|songwriter/i.test(category) || /singer|songwriter|band/i.test(info.description ?? "");
  const isActor = /actor|film|cinema/i.test(info.occupations.join(" ") + " " + (info.description ?? ""));
  const worksLabel = isActor ? "Movies" : isMusician ? "Notable Releases" : "Known For";
  const profLabel = isMusician ? "Genre / Role" : "Profession";

  const hasDetails =
    info.age != null || info.born != null || info.films.length > 0 || info.occupations.length > 0;

  if (!info.overview && !hasDetails) return null;

  const detRow = (label: string, value: string) => (
    <div className="border-b border-white/[0.06] py-3 last:border-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
      <div className="grid sm:grid-cols-2">
        <div className="px-5 py-4">
          {info.born && detRow("Born", info.born.display)}
          {info.age != null && detRow("Age", `${info.age} years`)}
          {info.occupations.length > 0 && detRow(profLabel, info.occupations.slice(0, 4).join(", "))}
        </div>
        {info.films.length > 0 && (
          <div className="px-5 py-4 sm:border-l sm:border-white/[0.06]">
            {detRow(worksLabel, info.films.slice(0, 8).join(", "))}
          </div>
        )}
      </div>
      {info.overview && (
        <div className="border-t border-white/[0.06] px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Overview</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{info.overview}</p>
        </div>
      )}
    </div>
  );
}