-- ============================================================================
-- KEYNIVERSE 관리자 작성자 닉네임 색상 표시용 읽기 전용 RPC (개인정보 노출 0%)
-- Supabase SQL Editor에서 1회 실행하세요.
-- ============================================================================

create or replace function public.get_admin_author_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where role = 'admin';
$$;

revoke all on function public.get_admin_author_ids() from public;
grant execute on function public.get_admin_author_ids() to anon, authenticated;
