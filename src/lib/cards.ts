import { prisma } from "./db";
import { cardUrlFor, fanNumberFromSeq, nextFanSeq } from "./utils";
import { qrSvgDataUri } from "./qr";

/**
 * Issue a new fan card for (fan, celebrity).
 * - Allocates the next global FC-XXXXXX number.
 * - Builds the card URL + QR from the request origin.
 * - Retries on the rare fanNumber collision (race between two requests).
 */
export async function issueFanCard(params: {
  fanId: string;
  celebrityId: string;
  membershipLevelId?: string | null;
  origin?: string | null;
}) {
  return issueCard(params.fanId, params.celebrityId, params.membershipLevelId, params.origin);
}

/** Resolve the celebrity slug + origin into a full createdAt card row. */
async function issueCard(
  fanId: string,
  celebrityId: string,
  membershipLevelId?: string | null,
  origin?: string | null
) {
  const celebrity = await prisma.celebrity.findUnique({ where: { id: celebrityId }, select: { slug: true } });
  if (!celebrity) throw new Error("Celebrity not found");

  const seq = await nextFanSeq();
  const fanNumber = fanNumberFromSeq(seq);
  const cardUrl = cardUrlFor(celebrity.slug, fanNumber);

  const card = await registerCard(fanId, celebrityId, membershipLevelId, fanNumber);

  const baseOrigin = origin || "http://localhost:3000";
  const qrCode = await qrSvgDataUri(`${baseOrigin}${cardUrl}`);

  const final = await prisma.fanCard.update({
    where: { id: card.id },
    data: { cardUrl, qrCode },
    include: { celebrity: true, fan: true, membershipLevel: true },
  });
  return final;
}

async function registerCard(
  fanId: string,
  celebrityId: string,
  membershipLevelId: string | null | undefined,
  fanNumber: string
) {
  try {
    return await prisma.fanCard.create({
      data: {
        fanId,
        celebrityId,
        membershipLevelId: membershipLevelId ?? null,
        fanNumber,
        status: "ACTIVE",
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      const collision = await prisma.fanCard.findFirst({ where: { fanId, celebrityId } });
      if (collision) return collision;
      const newSeq = await nextFanSeq();
      return registerCard(fanId, celebrityId, membershipLevelId, fanNumberFromSeq(newSeq));
    }
    throw e;
  }
}