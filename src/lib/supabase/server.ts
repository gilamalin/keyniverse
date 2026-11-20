import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Server Component / Route Handler용 Supabase 서버 클라이언트
 * - Next.js 16 비동기 `await cookies()` 규격 준수
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component 렌더 중 setAll 호출 시 무시 (proxy.ts에서 갱신 처리)
        }
      },
    },
  });
}
