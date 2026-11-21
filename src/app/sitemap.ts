import type { MetadataRoute } from "next";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";

const SITE_URL = "https://keyniverse.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/specs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/keyboard`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/mouse`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const switchRoutes: MetadataRoute.Sitemap = INITIAL_SWITCHES.map((sw) => ({
    url: `${SITE_URL}/specs?tab=switches&amp;open=${encodeURIComponent(sw.slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const mouseRoutes: MetadataRoute.Sitemap = INITIAL_MICE.map((ms) => ({
    url: `${SITE_URL}/specs?tab=mice&amp;open=${encodeURIComponent(ms.slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...switchRoutes, ...mouseRoutes];
}
