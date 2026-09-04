// POST /api/events/search — Multi-source event search endpoint.
//
// Searches all enabled providers and returns deduplicated results.
// This endpoint is safe for public use — no credentials are exposed.
import { NextResponse, type NextRequest } from "next/server";
import { searchAllProviders, searchCelebrityEvents } from "@/lib/events/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = sp.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing required parameter: q" }, { status: 400 });
  }

  const country = sp.get("country") ?? undefined;
  const city = sp.get("city") ?? undefined;
  const dateFrom = sp.get("dateFrom") ?? undefined;
  const dateTo = sp.get("dateTo") ?? undefined;
  const limit = sp.get("limit") ? parseInt(sp.get("limit")!, 10) : undefined;

  try {
    const result = await searchAllProviders(query, { country, city, dateFrom, dateTo, limit });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.query) {
    return NextResponse.json({ error: "Missing required field: query" }, { status: 400 });
  }

  const query = String(body.query).trim();
  const country = body.country ? String(body.country) : undefined;
  const city = body.city ? String(body.city) : undefined;
  const dateFrom = body.dateFrom ? String(body.dateFrom) : undefined;
  const dateTo = body.dateTo ? String(body.dateTo) : undefined;
  const limit = typeof body.limit === "number" ? body.limit : undefined;

  try {
    // Use targeted celebrity search if the query looks like a celebrity name.
    const result = await searchCelebrityEvents(query, { country, city, dateFrom, dateTo, limit });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed" }, { status: 500 });
  }
}
