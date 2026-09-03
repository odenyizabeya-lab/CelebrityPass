import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/checkout", "/order"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}