import Image from "next/image";
import { liveAge, type GoogleInfo, type PanelImage, type PanelWork } from "@/lib/google-info";

/**
 * Google-style knowledge panel for one celebrity — the exact layout of
 * Google's search panel: search-bar query, header image with attribution,
 * an "Age / born" quick-facts card, a category-aware Works card (Movies for
 * actors, Albums for musicians) with thumbnails + dropdown, the Wikipedia
 * Overview paragraph with a "Wikipedia ›" link, and a media carousel.
 *
 * Every piece of data carries its real source label (Wikipedia / Deezer).
 * The panel shows nothing when facts aren't available — it never fabricates.
 */
export default function GooglePanel({ info, category }: { info: GoogleInfo; category: string }) {
  const kind = info.kind !== "other" ? info.kind : detectKind(category, info);
  const worksLabel = kind === "actor" ? "Movies" : kind === "musician" ? "Albums" : kind === "athlete" ? "Teams" : "Known For";

  // The age is derived live from the stored birth date on EVERY page render —
  // exactly like Google — so it stays correct automatically as birthdays pass,
  // with no re-fetch ever needed. `info.age` is only a fallback for the rare
  // entries that have no birth date at all.
  const age = liveAge(info.born?.iso ?? null) ?? info.age;

  const works: PanelWork[] =
    info.works.length > 0
      ? info.works
      : info.films.map((f) => ({ title: f, year: undefined, source: "Wikipedia" } satisfies PanelWork));
  const hasDetails =
    age != null || info.born != null || info.occupations.length > 0 || works.length > 0;
  const hasMedia = info.images.length > 0 || info.image != null;

  if (!info.overview && !hasDetails && !hasMedia) return null;

  return (
    <div className="mt-6 overflow-hidden rounded-2xl bg-ink-900/70 ring-1 ring-white/10">
      {/* Google search-bar header */}
      <div className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3 rounded-full bg-white/[0.93] px-4 py-2.5 shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">{info.name}</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-zinc-500" fill="currentColor" aria-hidden>
            <path d="M12 14a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM7 14a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
          </svg>
        </div>
      </div>

      {/* Facts + Works cards, side by side like Google */}
      <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2">
        <div className="bg-ink-950/80 p-5">
          {info.image && <LeadImage image={info.image} name={info.name} />}
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Quick facts</p>
          <div className="mt-2 space-y-3">
            {age != null && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Age</p>
                <p className="mt-0.5 text-2xl font-black text-white">{age} years</p>
                {info.born && <p className="mt-0.5 text-sm text-zinc-400">{info.born.display}</p>}
              </div>
            )}
            {age == null && info.born && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Born</p>
                <p className="mt-0.5 text-base font-semibold text-white">{info.born.display}</p>
              </div>
            )}
            {info.occupations.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Also known for</p>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-300">{info.occupations.slice(0, 4).join(", ")}</p>
              </div>
            )}
          </div>
        </div>

        {works.length > 0 && (
          <div className="bg-ink-950/80 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{worksLabel}</p>
              <p className="text-[11px] text-zinc-500">{works[0].source}</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {works.slice(0, 6).map((w) => (
                <WorkTile key={`${w.title}-${w.year ?? ""}`} work={w} />
              ))}
            </div>
            {works.length > 6 && (
              <details className="mt-3 group">
                <summary className="cursor-pointer select-none text-sm font-bold text-sky-400 transition hover:text-sky-300">
                  View all {works.length} <span className="text-xs text-zinc-500">›</span>
                </summary>
                <ul className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2">
                  {works.map((w) => (
                    <li key={w.title} className="flex items-baseline justify-between gap-3 text-sm text-zinc-300">
                      <span className="min-w-0 truncate">{w.title}</span>
                      {w.year && <span className="shrink-0 text-xs text-zinc-500">{w.year}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Overview — the Wikipedia lead, same text Google shows */}
      {info.overview && (
        <div className="border-t border-white/[0.06] bg-ink-950/80 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Overview</p>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-zinc-300">{info.overview}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {info.wikipediaUrl && (
              <a
                href={info.wikipediaUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold text-sky-400 transition hover:text-sky-300"
              >
                Wikipedia <span aria-hidden>›</span>
              </a>
            )}
            <span className="text-zinc-600">Source: Wikipedia, the free encyclopedia</span>
          </div>
        </div>
      )}

      {/* Media carousel */}
      {info.images.length > 1 && (
        <div className="border-t border-white/[0.06] bg-ink-950/80 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Media</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {info.images.map((img, i) => (
              <figure key={`${img.url}-${i}`} className="w-44 shrink-0">
                <div className="relative h-28 w-44 overflow-hidden rounded-xl bg-ink-800 ring-1 ring-white/10">
                  <Image src={img.url} alt="" fill sizes="176px" className="object-cover" unoptimized />
                </div>
                <figcaption className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                  Source: {img.source}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadImage({ image, name }: { image: PanelImage; name: string }) {
  return (
    <figure className="mb-4">
      <div className="relative h-40 w-full overflow-hidden rounded-xl bg-ink-800 ring-1 ring-white/10 sm:h-44">
        <Image
          src={image.url}
          alt={`${name} — ${image.source}`}
          fill
          sizes="(max-width: 640px) 100vw, 420px"
          className="object-cover"
          priority
          unoptimized
        />
      </div>
      <figcaption className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">Source: {image.source}</figcaption>
    </figure>
  );
}

function WorkTile({ work }: { work: PanelWork }) {
  return (
    <div>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-ink-800 ring-1 ring-white/10">
        {work.imageUrl ? (
          <Image src={work.imageUrl} alt={work.title} fill sizes="120px" className="object-cover" loading="lazy" unoptimized />
        ) : (
          <div className="grid h-full w-full place-items-center px-1 text-center text-[10px] font-bold text-white/70">
            {work.title.slice(0, 26)}
          </div>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-tight text-zinc-300">{work.title}</p>
      {work.year && <p className="text-[10px] text-zinc-500">{work.year}</p>}
    </div>
  );
}

/** Fallback category detection when the fetched panel has no explicit kind. */
function detectKind(category: string, info: GoogleInfo): GoogleInfo["kind"] {
  const cat = category.toLowerCase();
  if (/actor|actress/.test(cat)) return "actor";
  if (/music|musician|sing|rapper|rap|artist/.test(cat)) return "musician";
  if (/athlet|football|cricket|soccer|basket|tennis|sport|player/.test(cat)) return "athlete";
  const ctx = `${info.occupations.join(" ")} ${info.description ?? ""}`.toLowerCase();
  if (/sing|music|rapper|vocal|songwriter/.test(ctx)) return "musician";
  if (/actor|actress/.test(ctx)) return "actor";
  if (/football|cricket|soccer|basket|tennis|athlet|player|sport/.test(ctx)) return "athlete";
  return "other";
}