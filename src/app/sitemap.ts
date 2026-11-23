import type { MetadataRoute } from "next";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import { createSupabasePublicClient } from "@/lib/supabase/public";

const SITE_URL = "https://keyniverse.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  let postRoutes: MetadataRoute.Sitemap = [];
  const supabase = createSupabasePublicClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error && data) {
        postRoutes = data.map((row) => ({
          url: `${SITE_URL}/?post=${encodeURIComponent(String(row.id))}`,
          lastModified: new Date(
            (row.updated_at as string | null) ?? (row.created_at as string)
          ),
          changeFrequency: "weekly",
          priority: 0.7,
        }));
      }
    } catch {
      // 일시적 DB 오류 시 정적/도감 URL만으로 안전하게 응답
    }
  }

  return [...staticRoutes, ...postRoutes, ...switchRoutes, ...mouseRoutes];
}
