-- ============================================================================
-- KEYNIVERSE 인앱 알림(댓글·답글) 및 ON/OFF 설정 마이그레이션
-- Supabase SQL Editor에 복사 후 1회 실행하세요.
-- ============================================================================

-- 1. profiles 테이블에 인앱 알림 수신 여부 컬럼 추가 (기본값 true)
alter table public.profiles
  add column if not exists notifications_enabled boolean not null default true;

-- 2. notifications 테이블 생성
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('comment', 'reply')),
  actor_nickname text not null,
  post_id uuid not null references public.posts (id) on delete cascade,
  post_title text not null,
  comment_id uuid references public.comments (id) on delete cascade,
  comment_preview text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- 3. RLS 활성화 및 본인 전용 정책 (INSERT는 트리거 전용으로 클라이언트 직접 삽입 차단)
alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);

-- 4. 댓글·답글 등록 시 자동 알림 생성 트리거 (notifications_enabled = true 인 수신자만)
create or replace function public.notify_on_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_author_id uuid;
  v_post_title text;
  v_parent_author_id uuid := null;
  v_preview text;
  v_enabled boolean;
begin
  select author_id, title
    into v_post_author_id, v_post_title
  from public.posts
  where id = new.post_id;

  if not found then
    return new;
  end if;

  v_preview := left(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'), 80);

  -- 4-1. 답글(대댓글)인 경우 원 댓글 작성자에게 'reply' 알림 발송
  if new.parent_id is not null then
    select author_id
      into v_parent_author_id
    from public.comments
    where id = new.parent_id;

    if v_parent_author_id is not null
       and v_parent_author_id is distinct from new.author_id then
      select notifications_enabled into v_enabled
      from public.profiles
      where id = v_parent_author_id;

      if coalesce(v_enabled, true) then
        insert into public.notifications (
          user_id,
          type,
          actor_nickname,
          post_id,
          post_title,
          comment_id,
          comment_preview
        ) values (
          v_parent_author_id,
          'reply',
          new.author_nickname,
          new.post_id,
          v_post_title,
          new.id,
          v_preview
        );
      end if;
    end if;
  end if;

  -- 4-2. 게시글 작성자에게 'comment' 알림 발송 (본인 및 이미 답글 알림을 받은 대상 제외)
  if v_post_author_id is not null
     and v_post_author_id is distinct from new.author_id
     and (v_parent_author_id is null or v_post_author_id is distinct from v_parent_author_id) then
    select notifications_enabled into v_enabled
    from public.profiles
    where id = v_post_author_id;

    if coalesce(v_enabled, true) then
      insert into public.notifications (
        user_id,
        type,
        actor_nickname,
        post_id,
        post_title,
        comment_id,
        comment_preview
      ) values (
        v_post_author_id,
        'comment',
        new.author_nickname,
        new.post_id,
        v_post_title,
        new.id,
        v_preview
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_comments_notify_insert on public.comments;
create trigger trg_comments_notify_insert
  after insert on public.comments
  for each row execute function public.notify_on_comment_insert();
