import webpush from "web-push";
import { prisma } from "@/lib/db";

export function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@celebritypass.app";
  return { publicKey, privateKey, subject };
}

function ensureVapidConfigured() {
  const { publicKey, privateKey, subject } = getVapidKeys();
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch {
    return false;
  }
}

export function vapidSupported(): boolean {
  return ensureVapidConfigured();
}

// Send a Web Push notification to every stored subscription for a fan.
// Invalid/expired subscriptions (410 Gone / 404 Not Found) are pruned.
export async function notifyFanPush(
  fanId: string,
  payload: { title: string; body: string; url: string }
): Promise<number> {
  if (!ensureVapidConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { fanId } });
  if (subs.length === 0) return 0;

  const json = JSON.stringify(payload);
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          json,
          { TTL: 60 * 60 * 24 }
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number } | null)?.statusCode;
        if (status === 410 || status === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );

  return sent;
}

// When a team message lands, push it to the fan's phone. The fan gets a
// notification whenever they're away OR the app is in the background — we skip
// one case only: they already read this exact message live, so a push would be
// noise. Always push otherwise, so backgrounded/app-suspended fans still see it.
export async function notifyFanOnTeamMessage(input: {
  conversationId: string;
  fanId: string;
  celebrityName: string;
  preview: string;
  messageCreatedAt?: Date;
}): Promise<number> {
  const fan = await prisma.fan.findUnique({ where: { id: input.fanId } });
  if (!fan || fan.chatNotify === false) return 0;

  if (input.messageCreatedAt) {
    const read = await prisma.chatReadState.findUnique({
      where: { conversationId: input.conversationId },
      select: { fanLastReadAt: true },
    });
    if (read?.fanLastReadAt && read.fanLastReadAt.getTime() >= input.messageCreatedAt.getTime()) return 0;
  }

  return notifyFanPush(input.fanId, {
    title: input.celebrityName,
    body: input.preview,
    url: `/chat/${input.conversationId}`,
  });
}