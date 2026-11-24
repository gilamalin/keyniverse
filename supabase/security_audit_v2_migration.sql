-- ============================================================================
-- KEYNIVERSE 종합 보안 감사 1순위 패치 (H-2 · H-3: 컬럼 무결성 · 정지 우회 차단 · Storage 제한)
-- Supabase SQL Editor에 전체 복사 후 1회 실행하세요.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles: 닉네임 쿨타임 우회 차단 & 민감 컬럼(points, email, role 등) 직접 변조 차단
--    - SECURITY INVOKER + current_user 조건을 사용하여 내부 SECURITY DEFINER 트리거/RPC
--      (포인트 적립 trg_point_logs_sync, 관리자 정지 admin_set_user_ban 등)와는 충돌하지 않습니다.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_nickname_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 최초 닉네임 설정(null -> 값): 클라이언트가 임의의 과거 시각을 주입하지 못하도록 기존 값 유지
  if old.nickname is null then
    new.nickname_changed_at := old.nickname_changed_at;
    return new;
  end if;

  -- 이후 닉네임 변경 시 30일 쿨타임 검사 및 서버 시각(now()) 강제 기록
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

create or replace function public.protect_profile_sensitive_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and pg_trigger_depth() <= 1 then
    if not public.is_admin() then
      if new.role is distinct from old.role then
        raise exception '권한(role)은 변경할 수 없습니다.';
      end if;
      if new.banned_until is distinct from old.banned_until then
        raise exception '정지 상태는 변경할 수 없습니다.';
      end if;
      if new.points is distinct from old.points then
        raise exception '포인트(points)는 직접 변경할 수 없습니다.';
      end if;
      if new.email is distinct from old.email then
        raise exception '이메일(email)은 직접 변경할 수 없습니다.';
      end if;
      if new.created_at is distinct from old.created_at then
        raise exception '가입일(created_at)은 변경할 수 없습니다.';
      end if;
      if new.nickname is not distinct from old.nickname
         and new.nickname_changed_at is distinct from old.nickname_changed_at then
        raise exception '닉네임 변경 시각은 직접 수정할 수 없습니다.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_sensitive on public.profiles;
create trigger trg_protect_profile_sensitive
  before update on public.profiles
  for each row execute function public.protect_profile_sensitive_columns();

-- ----------------------------------------------------------------------------
-- 2. point_logs: 클라이언트 직접 INSERT 시 허용 적립폭(3, 5, 10) 및 비정지 유저만 허용
--    - 신규 가입 +50P는 handle_new_user(SECURITY DEFINER)가 삽입하므로 영향 없음
-- ----------------------------------------------------------------------------
drop policy if exists "point_logs_insert_own" on public.point_logs;
create policy "point_logs_insert_own" on public.point_logs
  for insert
  with check (
    auth.uid() = user_id
    and not public.is_banned()
    and delta in (3, 5, 10)
  );

-- ----------------------------------------------------------------------------
-- 3. posts & comments: 추천수·조회수·작성자명·인증배지 사칭/변조 원천 차단 트리거
--    - 내부 SECURITY DEFINER 트리거/RPC(추천수 동기화, 조회수 증가, 닉네임 동기화, 회원 탈퇴)는
--      current_user = 'postgres'로 실행되므로 정상 통과합니다.
-- ----------------------------------------------------------------------------
create or replace function public.enforce_posts_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nickname text;
begin
  if current_user in ('authenticated', 'anon') and pg_trigger_depth() <= 1 then
    if tg_op = 'INSERT' then
      select nickname into v_nickname
      from public.profiles
      where id = auth.uid();

      if v_nickname is null or btrim(v_nickname) = '' then
        raise exception '닉네임 설정 후 게시글을 작성할 수 있습니다.';
      end if;

      new.author_id := auth.uid();
      new.author_nickname := v_nickname;
      new.author_verified := false;
      new.upvotes := 0;
      new.views := 1;
      new.is_edited := false;
    elsif tg_op = 'UPDATE' then
      new.author_id := old.author_id;
      new.author_nickname := old.author_nickname;
      new.author_verified := old.author_verified;
      new.upvotes := old.upvotes;
      new.views := old.views;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_posts_integrity on public.posts;
create trigger trg_enforce_posts_integrity
  before insert or update on public.posts
  for each row execute function public.enforce_posts_integrity();

create or replace function public.enforce_comments_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nickname text;
begin
  if current_user in ('authenticated', 'anon') and pg_trigger_depth() <= 1 then
    if tg_op = 'INSERT' then
      select nickname into v_nickname
      from public.profiles
      where id = auth.uid();

      if v_nickname is null or btrim(v_nickname) = '' then
        raise exception '닉네임 설정 후 댓글을 작성할 수 있습니다.';
      end if;

      new.author_id := auth.uid();
      new.author_nickname := v_nickname;
      new.author_verified := false;
      new.is_edited := false;
    elsif tg_op = 'UPDATE' then
      new.post_id := old.post_id;
      new.parent_id := old.parent_id;
      new.author_id := old.author_id;
      new.author_nickname := old.author_nickname;
      new.author_verified := old.author_verified;
      new.created_at := old.created_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_comments_integrity on public.comments;
create trigger trg_enforce_comments_integrity
  before insert or update on public.comments
  for each row execute function public.enforce_comments_integrity();

-- ----------------------------------------------------------------------------
-- 4. 활동 정지(is_banned) 누락 RLS 보강 (댓글 수정 · 스펙 평가 · 신고 · 추천 · 투표)
-- ----------------------------------------------------------------------------
drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update
  using (auth.uid() = author_id and not public.is_banned())
  with check (auth.uid() = author_id and not public.is_banned());

drop policy if exists "spec_votes_insert_own" on public.spec_votes;
create policy "spec_votes_insert_own" on public.spec_votes
  for insert
  with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists "spec_votes_update_own" on public.spec_votes;
create policy "spec_votes_update_own" on public.spec_votes
  for update
  using (auth.uid() = user_id and not public.is_banned())
  with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert
  with check (auth.uid() = reporter_id and not public.is_banned());

drop policy if exists "post_upvotes_insert_own" on public.post_upvotes;
create policy "post_upvotes_insert_own" on public.post_upvotes
  for insert
  with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists "vs_votes_insert_own" on public.vs_votes;
create policy "vs_votes_insert_own" on public.vs_votes
  for insert
  with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists "vs_votes_update_own" on public.vs_votes;
create policy "vs_votes_update_own" on public.vs_votes
  for update
  using (auth.uid() = user_id and not public.is_banned())
  with check (auth.uid() = user_id and not public.is_banned());

-- ----------------------------------------------------------------------------
-- 5. Storage (community-images): 버킷 파일 크기(5MB)·이미지 MIME 제한 + 본인 UID 폴더 강제 + 정지 차단
-- ----------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
where id = 'community-images';

drop policy if exists "community_images_auth_upload" on storage.objects;
create policy "community_images_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'community-images'
    and auth.role() = 'authenticated'
    and not public.is_banned()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
