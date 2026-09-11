import { prisma } from "@/lib/db"

export async function touchFanPresence(fanId: string): Promise<void> {
  try {
    await prisma.fan.update({
      where: { id: fanId },
      data: { lastSeenAt: new Date() },
    })
  } catch (err) {
    console.error("Failed to touch fan presence", err)
  }
}

export async function touchTeamPresence(celebrityId: string): Promise<void> {
  try {
    await prisma.celebrity.update({
      where: { id: celebrityId },
      data: { chatLastSeenAt: new Date() },
    })
  } catch (err) {
    console.error("Failed to touch team presence", err)
  }
}

export async function isCelebrityOnline(celebrityId: string): Promise<boolean> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const celebrity = await prisma.celebrity.findUnique({
      where: { id: celebrityId },
      select: { chatLastSeenAt: true },
    })
    return !!celebrity?.chatLastSeenAt && celebrity.chatLastSeenAt > fiveMinutesAgo
  } catch (err) {
    console.error("Failed to check celebrity online status", err)
    return false
  }
}