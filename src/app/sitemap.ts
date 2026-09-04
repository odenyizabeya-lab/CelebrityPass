import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BASE = appUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const celebrities = await prisma.celebrity.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    orderBy: { name: "asc" },
  });

  return [
    {
      url: `${BASE}/`,
      lastModified: new Date(),
      priority: 1,
      changeFrequency: "weekly",
    },
    {
      url: `${BASE}/celebrities`,
      lastModified: new Date(),
      priority: 0.9,
      changeFrequency: "daily",
    },
    ...celebrities.map((c) => ({
      url: `${BASE}/celebrity/${c.slug}`,
      lastModified: c.updatedAt,
      priority: 0.8,
      changeFrequency: "weekly" as const,
    })),
    ...([
      { path: "/about", priority: 0.5 },
      { path: "/security", priority: 0.4 },
      { path: "/help", priority: 0.5 },
      { path: "/download", priority: 0.4 },
      { path: "/register", priority: 0.3 },
    ] as const).map((p) => ({
      url: `${BASE}${p.path}`,
      lastModified: new Date(),
      priority: p.priority,
      changeFrequency: "monthly" as const,
    })),
    ...(["terms", "privacy", "contact", "payments", "rights"] as const).map((page) => ({
      url: `${BASE}/legal/${page}`,
      lastModified: new Date(),
      priority: 0.3,
      changeFrequency: "monthly" as const,
    })),
  ];
}