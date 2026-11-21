import type { MetadataRoute } from "next";

const SITE_URL = "https://keyniverse.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth/", "/mypage"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
