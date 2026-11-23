import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * 쿠키·세션에 의존하지 않는 공개 데이터 전용 Supabase 서버 클라이언트
 * - `unstable_cache`, `generateMetadata`, `sitemap.ts` 등 비로그인 공개 읽기 전용
 */
export function createSupabasePublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
