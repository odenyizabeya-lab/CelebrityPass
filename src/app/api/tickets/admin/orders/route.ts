import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/auth";
import { listAdminOrders } from "@/lib/ticketing/service";

export const dynamic = "force-dynamic";

// GET /api/tickets/admin/orders?status=&search=
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const rows = await listAdminOrders({ status: sp.get("status"), search: sp.get("search") });
  return NextResponse.json({ orders: rows });
}