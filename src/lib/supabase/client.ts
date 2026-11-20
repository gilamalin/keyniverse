import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * 클라이언트 컴포넌트용 Supabase 브라우저 클라이언트 (싱글톤)
 * - 환경변수(.env.local)가 아직 설정되지 않은 경우 null 반환
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;

  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
