-- ============================================================================
-- KEYNIVERSE 게시글 조회수 실시간 DB 증가 RPC (비로그인/로그인 모두 허용)
-- - posts 테이블의 RLS(본인 글만 수정)는 그대로 유지하면서 views 컬럼만 +1 안전하게 증가
-- Supabase SQL Editor에 복사 후 1회 실행하세요.
-- ============================================================================

create or replace function public.increment_post_view(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set views = views + 1
  where id = target_post_id;
end;
$$;

revoke all on function public.increment_post_view(uuid) from public;
grant execute on function public.increment_post_view(uuid) to anon, authenticated;
