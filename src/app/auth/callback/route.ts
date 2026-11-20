import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google OAuth PKCE 인증 완료 후 세션 교환을 처리하는 콜백 라우트
 * - Cloudflare Tunnel / Vercel 등 리버스 프록시 환경의 x-forwarded-host 헤더를 우선 사용
 * - 탈퇴 30일 재가입 쿨타임 등 오류 발생 시 사유 코드를 쿼리로 전달
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error") ?? "";
  const errorDesc = searchParams.get("error_description") ?? "";
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const resolvedOrigin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : origin;

  if (errorParam || errorDesc) {
    const isCooldown =
      errorDesc.includes("WITHDRAWN_COOLDOWN") ||
      errorDesc.includes("Database error saving new user");
    const reasonCode = isCooldown ? "withdrawn_cooldown" : "1";
    return NextResponse.redirect(`${resolvedOrigin}/?auth_error=${reasonCode}`);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${resolvedOrigin}${safeNext}`);
      }
    }
  }

  return NextResponse.redirect(`${resolvedOrigin}/?auth_error=1`);
}
