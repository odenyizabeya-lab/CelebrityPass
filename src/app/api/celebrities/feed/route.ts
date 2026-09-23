import { NextResponse, type NextRequest } from "next/server";
import { getCelebrityFeedPage } from "@/lib/services";

export const dynamic = "force-dynamic";

// Infinite-scroll feed for the home screen: returns one page of celebrity
// card data at a time, paginated directly in the database so each request is a
// single small query (no full-775-slice or in-memory-cache dependency that can
// go stale across server instances).
export async function GET(request: NextRequest) {
  const offset = Math.max(0, Number.parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(24, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "12", 10) || 12));
  const exclude = (request.nextUrl.searchParams.get("exclude") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const { items, done } = await getCelebrityFeedPage({ offset, limit, excludeIds: exclude });
    return NextResponse.json({ items, done });
  } catch {
    return NextResponse.json({ items: [], done: true }, { status: 500 });
  }
}