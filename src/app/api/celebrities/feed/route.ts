import { NextResponse, type NextRequest } from "next/server";
import { getCelebritySummaries, toCardCelebrity } from "@/lib/services";

export const dynamic = "force-dynamic";

// Infinite scroll feed for the home screen: returns one page of celebrity
// card data at a time, so scrolling never has to stop at a Browse-all button.
export async function GET(request: NextRequest) {
  const offset = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(24, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "12", 10) || 12));
  const exclude = new Set(
    (request.nextUrl.searchParams.get("exclude") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  try {
    const all = await getCelebritySummaries();
    const pool = all.filter((c) => !exclude.has(c.id));
    const page = pool.slice(offset, offset + limit);
    return NextResponse.json({
      items: page.map(toCardCelebrity),
      total: pool.length,
      done: offset + page.length >= pool.length,
    });
  } catch {
    return NextResponse.json({ items: [], total: 0, done: true }, { status: 500 });
  }
}