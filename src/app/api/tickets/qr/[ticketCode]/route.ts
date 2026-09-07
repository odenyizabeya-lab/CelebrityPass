import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> },
) {
  const { ticketCode } = await params;

  if (!ticketCode || ticketCode.length > 64) {
    return NextResponse.json({ error: "Invalid ticket code" }, { status: 400 });
  }

  const registration = await prisma.eventRegistration.findUnique({
    where: { ticketCode },
    select: { ticketQrData: true, checkedIn: true },
  });

  if (!registration) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const buffer = await QRCode.toBuffer(registration.ticketQrData, {
    type: "png",
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
