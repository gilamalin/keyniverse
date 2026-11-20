-- ============================================================================
-- KEYNIVERSE 회원 탈퇴(delete_own_account) & 30일 재가입 쿨타임(이메일 SHA-256 해시)
-- Supabase SQL Editor에 복사 후 1회 실행하세요.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. 탈퇴 계정 단방향 해시 보관 테이블 (30일 쿨타임 · RLS로 외부 직접 접근 전면 차단)
create table if not exists public.withdrawn_hashes (
  email_hash text primary key,
  blocked_until timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.withdrawn_hashes enable row level security;

-- 2. 신규 가입 트리거 보강: 30일 이내 탈퇴한 이메일 해시인 경우 재가입 차단
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_hash text;
begin
  v_email := lower(trim(coalesce(new.email, '')));
  v_hash := encode(digest(v_email, 'sha256'), 'hex');

  -- 만료된 쿨타임 해시 자동 정리
  delete from public.withdrawn_hashes where blocked_until <= now();

  if v_email <> '' and exists (
    select 1
    from public.withdrawn_hashes
    where email_hash = v_hash
      and blocked_until > now()
  ) then
    raise exception 'WITHDRAWN_COOLDOWN: 탈퇴 후 30일간 재가입할 수 없습니다.';
  end if;

  insert into public.profiles (id, email, nickname, points)
  values (new.id, coalesce(new.email, ''), null, 50)
  on conflict (id) do nothing;

  insert into public.point_logs (user_id, reason, delta)
  values (new.id, '신규 가입', 50);

  return new;
end;
$$;

-- 3. 본인 회원 탈퇴 RPC (이메일 해시 30일 저장 + 작성 글/댓글 익명화 + auth.users 즉시 파기)
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid;
  v_email text;
  v_hash text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = v_uid;

  if v_email is not null and trim(v_email) <> '' then
    v_hash := encode(digest(lower(trim(v_email)), 'sha256'), 'hex');
    insert into public.withdrawn_hashes (email_hash, blocked_until)
    values (v_hash, now() + interval '30 days')
    on conflict (email_hash)
    do update set blocked_until = excluded.blocked_until;
  end if;

  -- 기존 게시글·댓글은 토론 흐름 및 신고 증거 보존을 위해 익명화
  update public.posts
  set author_id = null,
      author_nickname = '탈퇴한 사용자'
  where author_id = v_uid;

  update public.comments
  set author_id = null,
      author_nickname = '탈퇴한 사용자'
  where author_id = v_uid;

  -- auth.users 즉시 파기 (profiles, point_logs, spec_votes, post_upvotes, vs_votes 연쇄 삭제)
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
