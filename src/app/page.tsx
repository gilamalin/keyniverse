import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { CommunityBoard } from "@/components/community/CommunityBoard";
import { createSupabasePublicClient } from "@/lib/supabase/public";

interface HomeSearchParams {
  post?: string | string[];
  category?: string | string[];
}

interface PostSeoRow {
  id: string;
  category: string;
  title: string;
  content: string;
  author_nickname: string;
  attachments: unknown;
  created_at: string;
  updated_at: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORY_TITLES: Record<string, string> = {
  notice: "공지사항",
  diagnosis: "자유 게시판",
  build: "빌드/셋업",
  vs: "투표",
  deal: "특가/드랍",
};

function getFirstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0] ?? null;
  return null;
}

function stripHtmlForSummary(raw: string, maxLen = 140): string {
  const plain = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}

function extractFirstPublicImageUrl(attachments: unknown): string | null {
  if (!Array.isArray(attachments)) return null;
  for (const item of attachments) {
    if (
      item &&
      typeof item === "object" &&
      "dataUrl" in item &&
      typeof (item as { dataUrl?: unknown }).dataUrl === "string"
    ) {
      const url = (item as { dataUrl: string }).dataUrl;
      if (url.startsWith("https://")) return url;
    }
  }
  return null;
}

const fetchPostForSeo = cache(async (postId: string): Promise<PostSeoRow | null> => {
  if (!UUID_REGEX.test(postId)) return null;
  const supabase = createSupabasePublicClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, category, title, content, author_nickname, attachments, created_at, updated_at"
      )
      .eq("id", postId)
      .maybeSingle();

    if (error || !data) return null;
    return data as PostSeoRow;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const postId = getFirstParam(params.post);
  const category = getFirstParam(params.category);

  if (postId) {
    const post = await fetchPostForSeo(postId);
    if (post) {
      const catLabel = CATEGORY_TITLES[post.category] ?? "커뮤니티";
      const title = `${post.title} | KEYNIVERSE`;
      const summary =
        stripHtmlForSummary(post.content) ||
        `KEYNIVERSE ${catLabel} · 작성자 ${post.author_nickname}`;
      const canonicalPath = `/?post=${encodeURIComponent(post.id)}`;
      const firstImg = extractFirstPublicImageUrl(post.attachments);

      return {
        title,
        description: summary,
        alternates: { canonical: canonicalPath },
        openGraph: {
          type: "article",
          locale: "ko_KR",
          url: canonicalPath,
          siteName: "KEYNIVERSE",
          title,
          description: summary,
          publishedTime: post.created_at,
          ...(firstImg ? { images: [{ url: firstImg }] } : {}),
        },
        twitter: {
          card: "summary_large_image",
          title,
          description: summary,
          ...(firstImg ? { images: [firstImg] } : {}),
        },
      };
    }
  }

  if (category && CATEGORY_TITLES[category]) {
    const label = CATEGORY_TITLES[category];
    return {
      title: `${label} | KEYNIVERSE`,
      description: `KEYNIVERSE ${label} — 게이밍 키보드·마우스 공식 하드웨어 커뮤니티`,
      alternates: { canonical: `/?category=${encodeURIComponent(category)}` },
    };
  }

  return {
    title: "KEYNIVERSE | 공식 하드웨어 커뮤니티 & 스펙 연구소",
    description:
      "키보드·마우스 자유 게시판, 커스텀 빌드·셋업 공유, 투표 및 특가/드랍 정보",
    alternates: { canonical: "/" },
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const params = await searchParams;
  const postId = getFirstParam(params.post);
  const post = postId ? await fetchPostForSeo(postId) : null;

  const jsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: post.title,
        text: stripHtmlForSummary(post.content, 300),
        author: {
          "@type": "Person",
          name: post.author_nickname,
        },
        datePublished: post.created_at,
        ...(post.updated_at ? { dateModified: post.updated_at } : {}),
        url: `https://keyniverse.vercel.app/?post=${encodeURIComponent(post.id)}`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <Suspense fallback={null}>
        <CommunityBoard />
      </Suspense>
    </>
  );
}
