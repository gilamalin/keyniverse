-- ============================================================================
-- KEYNIVERSE 외부 데이터 노출 차단 및 RLS 보안 강화 마이그레이션
-- Supabase SQL Editor에 복사 후 1회 실행하세요.
-- ============================================================================

-- 1. Storage (community-images): 전체 파일 목록(list) 열람 정책 제거
--    - public = true 버킷은 공개 URL(/object/public/...)로 이미지 표시가 정상 동작하며,
--      광범위한 SELECT 정책을 제거해야 외부에서 버킷 내 전체 파일 목록을 조회하는 것을 막고
--      Supabase Storage 보안 경고를 해소할 수 있습니다.
drop policy if exists "community_images_public_read" on storage.objects;

-- 2. profiles 테이블: 전체 공개 조회(profiles_select_public) 차단 → 본인 & 관리자만 조회
--    - 기존 using (true) 정책은 외부 anon/authenticated API 호출로 전체 회원의
--      이메일(email), 권한(role), 정지 만료일(banned_until), 포인트(points)가 노출될 수 있음.
--    - 게시글/댓글 작성자 닉네임은 posts/comments.author_nickname 컬럼을 사용하며,
--      관리자 닉네임 색상 판별은 get_admin_author_ids() RPC만 사용하므로 서비스 영향 0%.
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- (참고: admin_migration.sql의 profiles_admin_select 정책이 관리자 전체 조회를 보장합니다.)

-- 3. posts 테이블 UPDATE 정책 보강: 일반 유저가 본인 글을 UPDATE로 공지(notice)로 승격하거나
--    author_id를 변조하는 우회 차단
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts
  for update
  using (auth.uid() = author_id or public.is_admin())
  with check (
    (
      auth.uid() = author_id
      and not public.is_banned()
      and category <> 'notice'
    )
    or public.is_admin()
  );
