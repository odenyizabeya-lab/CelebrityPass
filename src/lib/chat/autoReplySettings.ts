import { prisma } from "@/lib/db";

export const GLOBAL_AUTO_REPLY_KEY = "chatAutoReplyGlobalEnabled";

// Global kill-switch for the always-on AI chat. Missing key = enabled.
export async function isGlobalAutoReplyEnabled(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: GLOBAL_AUTO_REPLY_KEY } });
    return row?.value !== "false";
  } catch (err) {
    console.error("[autoReplySettings] failed to read global toggle:", err);
    return true;
  }
}

// Per-celebrity switch. Defaults to enabled when unset.
export async function isCelebrityAutoReplyEnabled(celebrityId: string): Promise<boolean> {
  try {
    const row = await prisma.celebrity.findUnique({
      where: { id: celebrityId },
      select: { chatAutoReplyEnabled: true },
    });
    return row?.chatAutoReplyEnabled !== false;
  } catch (err) {
    console.error("[autoReplySettings] failed to read celebrity toggle:", err);
    return true;
  }
}

export async function setGlobalAutoReplyEnabled(enabled: boolean): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: GLOBAL_AUTO_REPLY_KEY },
    update: { value: enabled ? "true" : "false" },
    create: { key: GLOBAL_AUTO_REPLY_KEY, value: enabled ? "true" : "false" },
  });
}

export async function setCelebrityAutoReplyEnabled(
  celebrityId: string,
  enabled: boolean,
): Promise<void> {
  await prisma.celebrity.update({
    where: { id: celebrityId },
    data: { chatAutoReplyEnabled: enabled },
  });
}