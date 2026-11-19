"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Coins, FileText, MessageSquare, User, X } from "lucide-react";
import {
  COMMUNITY_CATEGORY_SHORT_LABELS,
  CommunityPost,
} from "@/types/community";
import {
  estimateAuthorPoints,
  getActivityStoreVersion,
  getServerActivityStoreVersion,
  readTotalPoints,
  subscribeActivityStore,
} from "@/lib/activity-store";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";

interface UserProfileModalProps {
  nickname: string | null;
  isCurrentUser: boolean;
  allPosts: CommunityPost[];
  onSelectPost: (postId: string) => void;
  onClose: () => void;
}

/**
 * 커뮤니티 내 작성자 닉네임 클릭 시 페이지 이탈 없이 팝업되는 유저 프로필 모달
 */
export function UserProfileModal({
  nickname,
  isCurrentUser,
  allPosts,
  onSelectPost,
  onClose,
}: UserProfileModalProps) {
  const activityVersion = useSyncExternalStore(
    subscribeActivityStore,
    getActivityStoreVersion,
    getServerActivityStoreVersion
  );

  useEffect(() => {
    if (!nickname) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const releaseScrollLock = acquireBodyScrollLock();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [nickname, onClose]);

  const profileStats = useMemo(() => {
    if (!nickname) return null;

    const authoredPosts = allPosts
      .filter((p) => p.author === nickname)
      .sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    let commentCount = 0;
    for (const post of allPosts) {
      for (const cmt of post.comments) {
        if (cmt.author === nickname) {
          commentCount += 1;
        }
      }
    }

    const points =
      isCurrentUser && activityVersion > 0
        ? readTotalPoints()
        : estimateAuthorPoints(authoredPosts.length, commentCount);

    return {
      postCount: authoredPosts.length,
      commentCount,
      points,
      recentPosts: authoredPosts.slice(0, 5),
    };
  }, [nickname, allPosts, isCurrentUser, activityVersion]);

  if (!nickname || !profileStats) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${nickname} 프로필`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[356px] overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-[#282D2A] bg-[#151816] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#282D2A] bg-[#222623] text-[#6B9080]">
              <User className="size-4" />
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <h2 className="truncate text-sm font-bold text-[#E4E6E1]">
                {nickname}
              </h2>
              {isCurrentUser && (
                <span className="shrink-0 rounded bg-[#6B9080] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#121413]">
                  MY
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="프로필 모달 닫기"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-col gap-4 p-5">
          {/* 활동 포인트 바 */}
          <div className="flex items-center justify-between rounded-lg border border-[#282D2A] bg-[#151816] px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8F9691]">
              <Coins className="size-3.5 text-[#D4A373]" />
              <span>활동 포인트</span>
            </span>
            <span className="font-mono text-sm font-bold text-[#D4A373] tabular-nums">
              {profileStats.points.toLocaleString()} P
            </span>
          </div>

          {/* 요약 2칸 (게시글 · 댓글) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col items-center justify-center rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-3">
              <span className="inline-flex items-center gap-1 text-[11px] text-[#8F9691]">
                <FileText className="size-3 text-[#6B9080]" />
                <span>게시글</span>
              </span>
              <span className="mt-1 font-mono text-base font-bold text-[#E4E6E1] tabular-nums">
                {profileStats.postCount}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-3">
              <span className="inline-flex items-center gap-1 text-[11px] text-[#8F9691]">
                <MessageSquare className="size-3 text-[#6B9080]" />
                <span>댓글</span>
              </span>
              <span className="mt-1 font-mono text-base font-bold text-[#E4E6E1] tabular-nums">
                {profileStats.commentCount}
              </span>
            </div>
          </div>

          {/* 최근 작성 글 */}
          <div>
            <h3 className="mb-2 text-xs font-semibold text-[#8F9691]">
              최근 작성 글
            </h3>
            {profileStats.recentPosts.length === 0 ? (
              <div className="rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-5 text-center text-xs text-[#8F9691]">
                작성한 게시글이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
                {profileStats.recentPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectPost(post.id);
                    }}
                    className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#222623]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="shrink-0 font-mono text-[10px] text-[#6B9080]">
                        [{COMMUNITY_CATEGORY_SHORT_LABELS[post.category]}]
                      </span>
                      <span className="truncate font-medium text-[#E4E6E1] group-hover:text-[#6B9080]">
                        {post.title}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-[#8F9691] tabular-nums">
                      {post.createdAt}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 본인 프로필인 경우 마이페이지 바로가기 */}
          {isCurrentUser && (
            <Link
              href="/mypage"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#222623] py-2 text-xs font-semibold text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
            >
              <span>마이페이지</span>
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
