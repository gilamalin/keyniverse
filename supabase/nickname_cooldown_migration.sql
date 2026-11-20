-- ============================================================================
-- KEYNIVERSE 닉네임 변경 30일 쿨타임 & 작성자명 자동 동기화 마이그레이션
-- - 최초 가입 닉네임 설정(null -> 값)은 쿨타임 미적용 (오타 수정용 1회 변경 허용)
-- - 이후 닉네임 변경부터 30일 쿨타임 적용 + 기존 게시글/댓글 작성자명 자동 동기화
-- Supabase SQL Editor에 복사 후 1회 실행하세요.
-- ============================================================================

alter table public.profiles
  add column if not exists nickname_changed_at timestamptz;

create or replace function public.enforce_nickname_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 최초 닉네임 설정(null -> 값)은 쿨타임 기록 없이 통과 (오타 수정용 1회 허용)
  if old.nickname is null then
    return new;
  end if;

  -- 닉네임이 실제로 변경되는 경우에만 30일 쿨타임 검사
  if new.nickname is distinct from old.nickname then
    if old.nickname_changed_at is not null
       and old.nickname_changed_at + interval '30 days' > now() then
      raise exception 'NICKNAME_COOLDOWN: 닉네임은 30일마다 변경할 수 있습니다.';
    end if;

    new.nickname_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_nickname_cooldown on public.profiles;
create trigger trg_profiles_nickname_cooldown
  before update on public.profiles
  for each row execute function public.enforce_nickname_cooldown();

create or replace function public.sync_author_nickname_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nickname is not null and new.nickname is distinct from old.nickname then
    update public.posts
    set author_nickname = new.nickname
    where author_id = new.id;

    update public.comments
    set author_nickname = new.nickname
    where author_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_author_nickname on public.profiles;
create trigger trg_profiles_sync_author_nickname
  after update on public.profiles
  for each row execute function public.sync_author_nickname_on_change();
