-- ============================================================================
-- KEYNIVERSE 관리자 권한 · 활동 정지 · DB 이중 보안 잠금 마이그레이션
-- Supabase SQL Editor에서 1회 실행하세요.
-- ============================================================================

-- 1. profiles 테이블에 role, banned_until 컬럼 추가
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin')),
  add column if not exists banned_until timestamptz;

-- 2. 관리자 / 활동 정지 판별 함수 (RLS & RPC 공용)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and banned_until is not null
      and banned_until > now()
  );
$$;

-- 3. 일반 유저의 role / banned_until / points 셀프 변조 원천 차단 트리거
create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Supabase SQL Editor(postgres/service_role) 또는 내부 트리거가 아닌 일반 클라이언트 요청 검증
  if auth.role() in ('authenticated', 'anon') and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception '권한(role)은 변경할 수 없습니다.';
    end if;
    if new.banned_until is distinct from old.banned_until then
      raise exception '정지 상태는 변경할 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_sensitive on public.profiles;
create trigger trg_protect_profile_sensitive
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_columns();

-- 4. RLS 정책 보강 (관리자 전체 관리 + 정지 유저 글/댓글 작성 차단 + 공지사항 관리자 전용)
-- profiles: 관리자는 전체 회원 조회/수정 가능
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select using (public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update using (public.is_admin());

-- posts: 정지 유저 작성 차단, 공지사항은 관리자만 작성, 관리자는 모든 글 수정/삭제 가능
drop policy if exists "posts_insert_auth" on public.posts;
create policy "posts_insert_auth" on public.posts
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
    and (category <> 'notice' or public.is_admin())
  );

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts
  for update using (auth.uid() = author_id or public.is_admin());

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = author_id or public.is_admin());

-- comments: 정지 유저 작성 차단, 관리자는 모든 댓글 삭제 가능
drop policy if exists "comments_insert_auth" on public.comments;
create policy "comments_insert_auth" on public.comments
  for insert with check (
    auth.uid() = author_id
    and not public.is_banned()
  );

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = author_id or public.is_admin());

-- reports: 관리자는 전체 신고 열람/상태 변경/삭제 가능
drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter_id or public.is_admin());

drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update using (public.is_admin());

drop policy if exists "reports_admin_delete" on public.reports;
create policy "reports_admin_delete" on public.reports
  for delete using (public.is_admin());

-- 5. 관리자 전용 RPC: 회원 활동 정지 / 해제 (ban_days: 0=해제, -1=영구, 양수=일수)
create or replace function public.admin_set_user_ban(
  target_user_id uuid,
  ban_days integer
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if target_user_id = auth.uid() then
    raise exception '본인 계정은 정지할 수 없습니다.';
  end if;

  if ban_days = 0 then
    v_until := null;
  elsif ban_days < 0 then
    v_until := '2099-12-31T23:59:59Z'::timestamptz;
  else
    v_until := now() + make_interval(days => ban_days);
  end if;

  update public.profiles
  set banned_until = v_until,
      updated_at = now()
  where id = target_user_id
    and role <> 'admin';

  return v_until;
end;
$$;

revoke all on function public.admin_set_user_ban(uuid, integer) from public;
grant execute on function public.admin_set_user_ban(uuid, integer) to authenticated;

-- 6. 관리자 전용 RPC: 신고 처리 (콘텐츠 삭제 포함 원자적 처리)
create or replace function public.admin_resolve_report(
  target_report_id uuid,
  next_status text,
  delete_target boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report record;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if next_status not in ('pending', 'resolved', 'dismissed') then
    raise exception '잘못된 상태값입니다.';
  end if;

  select * into v_report
  from public.reports
  where id = target_report_id;

  if not found then
    return;
  end if;

  if delete_target then
    if v_report.target_type = 'post' then
      delete from public.posts where id::text = v_report.target_id;
    elsif v_report.target_type in ('comment', 'reply') then
      delete from public.comments where id::text = v_report.target_id;
    end if;
  end if;

  -- 동일 대상에 접수된 미처리 신고도 함께 일괄 처리
  update public.reports
  set status = next_status
  where id = target_report_id
     or (delete_target and target_type = v_report.target_type and target_id = v_report.target_id and status = 'pending');
end;
$$;

revoke all on function public.admin_resolve_report(uuid, text, boolean) from public;
grant execute on function public.admin_resolve_report(uuid, text, boolean) to authenticated;

-- ============================================================================
-- [필수] 아래 주석을 풀고 본인 Google 계정 이메일로 바꿔서 함께 실행하세요:
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL@gmail.com';
-- ============================================================================
