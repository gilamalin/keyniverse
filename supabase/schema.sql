-- ============================================================================
-- KEYNIVERSE PostgreSQL Schema & Row Level Security (RLS)
-- Supabase SQL Editor에 전체 복사 후 1회 실행하세요.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. profiles (auth.users 1:1 확장 프로필 + 닉네임 + 활동 포인트)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nickname text unique,
  points integer not null default 50 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nickname_format_check check (
    nickname is null or nickname ~ '^[가-힣a-zA-Z0-9]{2,6}$'
  )
);

-- 신규 가입 시 profiles 자동 생성 + 환영 포인트 50P 로그 기록
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname, points)
  values (new.id, coalesce(new.email, ''), null, 50)
  on conflict (id) do nothing;

  insert into public.point_logs (user_id, reason, delta)
  values (new.id, '신규 가입', 50);

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. point_logs (활동 포인트 적립 +delta / 소모 -delta 단일 구조)
-- ----------------------------------------------------------------------------
create table if not exists public.point_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  delta integer not null check (delta <> 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_point_logs_user_created
  on public.point_logs (user_id, created_at desc);

-- point_logs INSERT 시 profiles.points 자동 동기화 (환영 포인트 제외)
create or replace function public.sync_profile_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reason <> '신규 가입' then
    update public.profiles
    set points = greatest(0, points + new.delta),
        updated_at = now()
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_point_logs_sync on public.point_logs;
create trigger trg_point_logs_sync
  after insert on public.point_logs
  for each row execute function public.sync_profile_points();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. switches & mice (스펙 도감 공식 제원 마스터 테이블)
-- ----------------------------------------------------------------------------
create table if not exists public.switches (
  id text primary key,
  slug text not null unique,
  name text not null,
  name_en text not null,
  brand text not null,
  category text not null check (
    category in (
      'linear', 'tactile', 'silent_linear', 'silent_tactile',
      'clicky', 'electro_capacitive', 'magnetic'
    )
  ),
  operating_force_gf numeric(5,1) not null,
  bottom_out_force_gf numeric(5,1),
  pre_travel_mm numeric(4,2) not null,
  total_travel_mm numeric(4,2) not null,
  spring_length_mm numeric(4,1),
  spring_type text check (spring_type is null or spring_type in ('1단', '2단', '3단')),
  material_top text not null,
  material_bottom text not null,
  material_stem text not null,
  factory_lubed boolean not null default false,
  pins smallint not null check (pins in (0, 2, 3, 5)),
  color_top_hex text not null,
  color_bottom_hex text not null,
  color_stem_hex text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mice (
  id text primary key,
  slug text not null unique,
  name text not null,
  name_en text not null,
  brand text not null,
  max_polling_hz integer not null check (max_polling_hz in (1000, 2000, 4000, 8000)),
  connection text not null check (connection in ('wireless_wired', 'wired')),
  shape text not null check (shape in ('symmetrical', 'ergonomic')),
  length_mm numeric(5,1) not null,
  width_mm numeric(5,1) not null,
  height_mm numeric(5,1) not null,
  weight_grams numeric(5,1) not null,
  sensor text not null,
  switch_type text not null check (switch_type in ('optical', 'mechanical')),
  switch_model text not null,
  color_accent_hex text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. spec_votes (로그인 + 테스트 통과 인증 스펙 평가 · 한줄평, 1계정 1평가)
-- ----------------------------------------------------------------------------
create table if not exists public.spec_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('switch', 'mouse')),
  device_id text not null,
  slug text not null,
  rating smallint not null check (rating between 1 and 5),
  pitch text check (pitch is null or pitch in ('low', 'mid', 'high')),
  grip text check (grip is null or grip in ('palm', 'claw', 'finger')),
  hand_size text check (hand_size is null or hand_size in ('f1_f8', 'f9', 'f10', 'f11_plus')),
  one_line_review text check (one_line_review is null or char_length(one_line_review) <= 80),
  verification_proof jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists idx_spec_votes_device
  on public.spec_votes (device_id, updated_at desc);

-- ----------------------------------------------------------------------------
-- 5. posts (커뮤니티 게시글)
-- ----------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('notice', 'build', 'diagnosis', 'vs', 'deal')),
  notice_scope text check (notice_scope is null or notice_scope in ('all', 'diagnosis', 'build', 'vs', 'deal')),
  title text not null check (char_length(title) between 1 and 80),
  content text not null,
  content_html text,
  author_id uuid references public.profiles (id) on delete set null,
  author_nickname text not null,
  author_verified boolean not null default false,
  upvotes integer not null default 0 check (upvotes >= 0),
  views integer not null default 0 check (views >= 0),
  tagged_device_slugs text[] not null default '{}',
  build_meta jsonb,
  vs_meta jsonb,
  deal_meta jsonb,
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_posts_category_created
  on public.posts (category, created_at desc);
create index if not exists idx_posts_author
  on public.posts (author_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 6. comments (1-Depth 댓글 및 답글)
-- ----------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  reply_to_author text,
  author_id uuid references public.profiles (id) on delete set null,
  author_nickname text not null,
  author_verified boolean not null default false,
  content text not null check (char_length(content) between 1 and 500),
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comments_post_created
  on public.comments (post_id, created_at asc);

-- ----------------------------------------------------------------------------
-- 7. post_upvotes & vs_votes (중복 추천/투표 방지)
-- ----------------------------------------------------------------------------
create table if not exists public.post_upvotes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create or replace function public.sync_post_upvotes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set upvotes = upvotes + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set upvotes = greatest(0, upvotes - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_post_upvotes_sync on public.post_upvotes;
create trigger trg_post_upvotes_sync
  after insert or delete on public.post_upvotes
  for each row execute function public.sync_post_upvotes_count();

create table if not exists public.vs_votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  choice text not null check (choice in ('A', 'B')),
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ----------------------------------------------------------------------------
-- 8. reports (게시글 · 댓글 · 답글 신고 접수, 중복 신고 방지)
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'reply')),
  target_id text not null,
  reason text not null,
  detail text check (detail is null or char_length(detail) <= 100),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- ----------------------------------------------------------------------------
-- 9. Row Level Security (RLS) 정책
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.point_logs enable row level security;
alter table public.switches enable row level security;
alter table public.mice enable row level security;
alter table public.spec_votes enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_upvotes enable row level security;
alter table public.vs_votes enable row level security;
alter table public.reports enable row level security;

-- profiles: 본인 프로필만 조회 및 수정 (타인 이메일·포인트·권한 외부 노출 차단)
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- point_logs: 본인 내역만 조회, 본인 적립 기록 추가
create policy "point_logs_select_own" on public.point_logs
  for select using (auth.uid() = user_id);
create policy "point_logs_insert_own" on public.point_logs
  for insert with check (auth.uid() = user_id);

-- switches & mice: 누구나 조회 가능 (관리자만 쓰기)
create policy "switches_select_public" on public.switches
  for select using (true);
create policy "mice_select_public" on public.mice
  for select using (true);

-- spec_votes: 누구나 조회, 로그인 본인만 등록/수정/삭제
create policy "spec_votes_select_public" on public.spec_votes
  for select using (true);
create policy "spec_votes_insert_own" on public.spec_votes
  for insert with check (auth.uid() = user_id);
create policy "spec_votes_update_own" on public.spec_votes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "spec_votes_delete_own" on public.spec_votes
  for delete using (auth.uid() = user_id);

-- posts: 누구나 조회, 로그인 유저 일반 글 작성(공지 제외), 본인 글 수정/삭제
create policy "posts_select_public" on public.posts
  for select using (true);
create policy "posts_insert_auth" on public.posts
  for insert with check (auth.uid() = author_id and category <> 'notice');
create policy "posts_update_own" on public.posts
  for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id and category <> 'notice');
create policy "posts_delete_own" on public.posts
  for delete using (auth.uid() = author_id);

-- comments: 누구나 조회, 로그인 유저 작성, 본인 댓글 수정/삭제
create policy "comments_select_public" on public.comments
  for select using (true);
create policy "comments_insert_auth" on public.comments
  for insert with check (auth.uid() = author_id);
create policy "comments_update_own" on public.comments
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "comments_delete_own" on public.comments
  for delete using (auth.uid() = author_id);

-- post_upvotes & vs_votes: 누구나 조회, 본인만 추가/수정/삭제
create policy "post_upvotes_select_public" on public.post_upvotes
  for select using (true);
create policy "post_upvotes_insert_own" on public.post_upvotes
  for insert with check (auth.uid() = user_id);
create policy "post_upvotes_delete_own" on public.post_upvotes
  for delete using (auth.uid() = user_id);

create policy "vs_votes_select_public" on public.vs_votes
  for select using (true);
create policy "vs_votes_insert_own" on public.vs_votes
  for insert with check (auth.uid() = user_id);
create policy "vs_votes_update_own" on public.vs_votes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reports: 본인 신고 내역만 조회 및 접수
create policy "reports_select_own" on public.reports
  for select using (auth.uid() = reporter_id);
create policy "reports_insert_own" on public.reports
  for insert with check (auth.uid() = reporter_id);

-- ----------------------------------------------------------------------------
-- 10. Storage 버킷 (게시글 WebP 첨부 이미지)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-images', 'community-images', true)
on conflict (id) do nothing;

-- (참고) public = true 버킷은 공개 이미지 URL 조회에 별도 SELECT 정책이 필요하지 않으며,
-- 광범위한 SELECT 정책을 두면 클라이언트가 버킷 내 전체 파일 목록(list)을 조회할 수 있으므로 생략합니다.

create policy "community_images_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'community-images'
    and auth.role() = 'authenticated'
  );

create policy "community_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'community-images'
    and auth.uid() = owner
  );
