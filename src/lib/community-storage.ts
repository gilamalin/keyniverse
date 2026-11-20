import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const COMMUNITY_IMAGES_BUCKET = "community-images";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/webp";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * 압축된 WebP dataUrl을 Supabase Storage `community-images` 버킷에 업로드하고 공개 CDN URL 반환
 * - Supabase 미설정 또는 업로드 실패 시 원본 dataUrl로 안전하게 fallback
 */
export async function uploadCommunityImage(
  dataUrl: string,
  userId?: string | null
): Promise<string> {
  if (!isSupabaseConfigured()) return dataUrl;

  const supabase = createSupabaseBrowserClient();
  if (!supabase) return dataUrl;

  try {
    let resolvedUserId = userId ?? null;
    if (!resolvedUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedUserId = user?.id ?? null;
    }
    if (!resolvedUserId) return dataUrl;

    const blob = dataUrlToBlob(dataUrl);
    const filePath = `${resolvedUserId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.webp`;

    const { error } = await supabase.storage
      .from(COMMUNITY_IMAGES_BUCKET)
      .upload(filePath, blob, {
        contentType: "image/webp",
        upsert: false,
      });

    if (error) {
      return dataUrl;
    }

    const { data } = supabase.storage
      .from(COMMUNITY_IMAGES_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl || dataUrl;
  } catch {
    return dataUrl;
  }
}
