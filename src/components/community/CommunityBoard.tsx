"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  PenSquare,
  Search,
  Swords,
  TrendingUp,
  X,
} from "lucide-react";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import { IN_FEED_SPONSOR_ITEM } from "@/data/community-data";
import {
  COMMUNITY_CATEGORY_LABELS,
  COMMUNITY_CATEGORY_SHORT_LABELS,
  CommunityCategory,
  CommunityPost,
} from "@/types/community";
import {
  getServerVoteStoreVersion,
  getVoteStoreVersion,
  subscribeVoteStore,
} from "@/lib/spec-verification";
import {
  getAuthStoreVersion,
  getServerAuthStoreVersion,
  getUserVerifiedBadgeStatus,
  openAuthModal,
  readGoogleSession,
  subscribeAuthStore,
} from "@/lib/auth-store";
import {
  addCommunityComment,
  computeEffectiveCommunityPosts,
  createCommunityPost,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityStoreVersion,
  getServerCommunityStoreVersion,
  incrementPostView,
  isCommunitySynced,
  selectVsPollOption,
  subscribeCommunityStore,
  syncCommunityFromSupabase,
  toggleDealPostStatus,
  togglePostUpvote,
  updateCommunityComment,
  updateCommunityPost,
} from "@/lib/community-store";
import {
  POINT_REWARDS,
  recordPointTransaction,
} from "@/lib/activity-store";
import { SwitchCrossSectionIcon } from "@/components/specs/SpecVisuals";
import { PostDetailModal } from "@/components/community/PostDetailModal";
import { PostWriteModal } from "@/components/community/PostWriteModal";
import { UserProfileModal } from "@/components/community/UserProfileModal";
import { cn } from "@/lib/utils";

type CommunityFilterTab = "all" | CommunityCategory;
type CommunitySortMode = "latest" | "upvotes";
type CommunityDurationFilter =
  | "all"
  | "1d"
  | "3d"
  | "7d"
  | "30d"
  | "90d"
  | "custom";

interface DurationOptionItem {
  id: CommunityDurationFilter;
  label: string;
  days: number | null;
}

const DURATION_OPTIONS: DurationOptionItem[] = [
  { id: "all", label: "전체", days: null },
  { id: "1d", label: "1일", days: 1 },
  { id: "3d", label: "3일", days: 3 },
  { id: "7d", label: "7일", days: 7 },
  { id: "30d", label: "30일", days: 30 },
  { id: "90d", label: "90일", days: 90 },
  { id: "custom", label: "직접 설정", days: null },
];

const CALENDAR_YEARS = [2024, 2025, 2026, 2027];
const CALENDAR_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const BASE_ANCHOR_TIMESTAMP = new Date("2026-11-18T23:59:59+09:00").getTime();

function parseLocalStartOfDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function parseLocalEndOfDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return Number.MAX_SAFE_INTEGER;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function formatYmdString(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function formatShortRangeLabel(startYmd: string, endYmd: string): string {
  const s = startYmd.slice(2).replace(/-/g, ".");
  const e = endYmd.slice(2).replace(/-/g, ".");
  return s === e ? s : `${s}~${e}`;
}

function buildCalendarGrid(
  year: number,
  month: number
): Array<{ day: number | null; ymd: string | null }> {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number | null; ymd: string | null }> = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null, ymd: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, ymd: formatYmdString(year, month, d) });
  }
  return cells;
}

interface DeviceLookupItem {
  slug: string;
  name: string;
  tab: "switches" | "mice";
}

const POSTS_PER_PAGE = 10;

const VALID_CATEGORY_TABS = new Set<CommunityFilterTab>([
  "all",
  "notice",
  "diagnosis",
  "build",
  "vs",
  "deal",
]);

function buildCategoryListUrl(category: CommunityFilterTab): string {
  return category === "all" ? "/" : `/?category=${encodeURIComponent(category)}`;
}

function navigateShallow(url: string, replace = false): void {
  if (typeof window === "undefined") return;
  if (replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }
}

export function CommunityBoard() {
  const searchParams = useSearchParams();
  const postParam = searchParams.get("post");
  const modeParam = searchParams.get("mode");
  const editParam = searchParams.get("edit");
  const categoryParam = searchParams.get("category");

  const activeCategory: CommunityFilterTab =
    categoryParam && VALID_CATEGORY_TABS.has(categoryParam as CommunityFilterTab)
      ? (categoryParam as CommunityFilterTab)
      : "all";
  const [sortMode, setSortMode] = useState<CommunitySortMode>("latest");

  // 검색창 입력값(searchInput)과 엔터/검색 버튼 클릭 시 실제 적용되는 검색어(appliedSearchQuery) 분리
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState<string>("");

  // 기간(duration) 필터 및 '직접 설정' 달력 상태
  const [durationFilter, setDurationFilter] =
    useState<CommunityDurationFilter>("all");
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState<boolean>(false);
  const [isCustomCalendarOpen, setIsCustomCalendarOpen] =
    useState<boolean>(false);
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(11);
  const [draftStartDate, setDraftStartDate] = useState<string>("2026-11-01");
  const [draftEndDate, setDraftEndDate] = useState<string>("2026-11-18");
  const [appliedStartDate, setAppliedStartDate] =
    useState<string>("2026-11-01");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("2026-11-18");
  const [rangePickStep, setRangePickStep] = useState<"start" | "end">("start");
  const durationMenuRef = useRef<HTMLDivElement | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [profileNickname, setProfileNickname] = useState<string | null>(null);

  useEffect(() => {
    if (!isDurationMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        durationMenuRef.current &&
        !durationMenuRef.current.contains(e.target as Node)
      ) {
        setIsDurationMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isDurationMenuOpen]);

  // 로컬 스토리지의 실측 인증/투표 상태 구독 (SSR Hydration-safe)
  const voteVersion = useSyncExternalStore(
    subscribeVoteStore,
    getVoteStoreVersion,
    getServerVoteStoreVersion
  );

  // Google 로그인 상태 구독
  const authVersion = useSyncExternalStore(
    subscribeAuthStore,
    getAuthStoreVersion,
    getServerAuthStoreVersion
  );
  const session = authVersion > 0 ? readGoogleSession() : null;

  useEffect(() => {
    void syncCommunityFromSupabase(session?.userId ?? null);
  }, [session?.userId]);

  const verifiedStatus = useMemo(
    () =>
      voteVersion > 0 || authVersion > 0
        ? getUserVerifiedBadgeStatus()
        : { isVerifiedTester: false, verifiedCount: 0, latestSnapshot: null },
    [voteVersion, authVersion]
  );

  // 커뮤니티 게시글/댓글/추천/VS투표 상태 구독
  const communityVersion = useSyncExternalStore(
    subscribeCommunityStore,
    getCommunityStoreVersion,
    getServerCommunityStoreVersion
  );

  // 전체 유효 게시글 리스트 (초기 12개 + 내가 작성한 글 - 삭제된 글 + 실시간 추천/투표/댓글 반영)
  const {
    posts: effectivePosts,
    upvotedPostIds,
    vsChoices,
  } = useMemo(
    () =>
      computeEffectiveCommunityPosts(
        communityVersion > 0 || authVersion > 0,
        session?.nickname ?? null
      ),
    [communityVersion, authVersion, session?.nickname]
  );

  const selectedPost = useMemo(
    () =>
      postParam
        ? effectivePosts.find((p) => p.id === postParam) ?? null
        : null,
    [effectivePosts, postParam]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (selectedPost) {
      document.title = `${selectedPost.title} | KEYNIVERSE`;
    } else if (activeCategory !== "all") {
      document.title = `${COMMUNITY_CATEGORY_LABELS[activeCategory]} | KEYNIVERSE`;
    } else {
      document.title = "KEYNIVERSE | 공식 하드웨어 커뮤니티 & 스펙 연구소";
    }
  }, [selectedPost, activeCategory]);

  const editingPost = useMemo(
    () =>
      editParam
        ? effectivePosts.find((p) => p.id === editParam) ?? null
        : null,
    [effectivePosts, editParam]
  );

  const isWriteMode = modeParam === "write" && Boolean(session);
  const isCommunityLoading = communityVersion === 0 || !isCommunitySynced();
  const isLoadingSelectedPost =
    Boolean(postParam) && !selectedPost && isCommunityLoading;

  // 도감 장비 슬러그 -> 이름·탭 매핑 테이블
  const deviceLookupMap = useMemo(() => {
    const map = new Map<string, DeviceLookupItem>();
    for (const sw of INITIAL_SWITCHES) {
      map.set(sw.slug, { slug: sw.slug, name: sw.name, tab: "switches" });
    }
    for (const ms of INITIAL_MICE) {
      map.set(ms.slug, { slug: ms.slug, name: ms.name, tab: "mice" });
    }
    return map;
  }, []);

  // 우측 위젯 1: 인기글 (최근 7일 내 일반 게시글 우선 → 5개 미만이면 전체 기간으로 보충)
  const popularTopPosts = useMemo(() => {
    const nonNotice = effectivePosts.filter((p) => p.category !== "notice");
    const byPopularity = (a: CommunityPost, b: CommunityPost) =>
      b.upvotes - a.upvotes ||
      (b.views ?? 0) - (a.views ?? 0) ||
      b.sortTimestamp - a.sortTimestamp;

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const latestTs = nonNotice.reduce(
      (max, p) => Math.max(max, p.sortTimestamp),
      0
    );
    const recentCutoff = latestTs > 0 ? latestTs - sevenDaysMs : 0;

    const recentSorted = nonNotice
      .filter((p) => p.sortTimestamp >= recentCutoff)
      .sort(byPopularity);
    if (recentSorted.length >= 5) {
      return recentSorted.slice(0, 5);
    }

    const recentIds = new Set(recentSorted.map((p) => p.id));
    const olderSorted = nonNotice
      .filter((p) => !recentIds.has(p.id))
      .sort(byPopularity);
    return [...recentSorted, ...olderSorted].slice(0, 5);
  }, [effectivePosts]);

  // 우측 위젯 2: 인기 투표 (최근 7일 내 VS 게시글 우선 → 없으면 전체 기간 중 최다 투표)
  const featuredVsPost = useMemo(() => {
    const vsPosts = effectivePosts.filter(
      (p) => p.category === "vs" && p.vsMeta
    );
    if (vsPosts.length === 0) return null;

    const byVotes = (a: CommunityPost, b: CommunityPost) => {
      const totalA =
        (a.vsMeta?.optionAVotes ?? 0) + (a.vsMeta?.optionBVotes ?? 0);
      const totalB =
        (b.vsMeta?.optionAVotes ?? 0) + (b.vsMeta?.optionBVotes ?? 0);
      return totalB - totalA || b.sortTimestamp - a.sortTimestamp;
    };

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const latestTs = vsPosts.reduce(
      (max, p) => Math.max(max, p.sortTimestamp),
      0
    );
    const recentVs = vsPosts.filter(
      (p) => p.sortTimestamp >= latestTs - sevenDaysMs
    );
    const pool = recentVs.length > 0 ? recentVs : vsPosts;
    return [...pool].sort(byVotes)[0] ?? null;
  }, [effectivePosts]);

  // 카테고리별 게시글 개수 집계
  const categoryCounts = useMemo(() => {
    const counts: Record<CommunityFilterTab, number> = {
      all: 0,
      notice: 0,
      build: 0,
      diagnosis: 0,
      vs: 0,
      deal: 0,
    };
    for (const post of effectivePosts) {
      counts[post.category] += 1;
      if (post.category !== "notice") {
        counts.all += 1;
      }
    }
    return counts;
  }, [effectivePosts]);

  // 현재 탭(전체/자유/빌드/투표/특가)에 맞는 최상단 고정 공지글 1건 매칭
  const pinnedNoticePost = useMemo(() => {
    if (activeCategory === "notice") return null;
    if (appliedSearchQuery.trim().length > 0 || durationFilter !== "all") {
      return null;
    }
    return (
      effectivePosts.find(
        (p) => p.category === "notice" && p.noticeScope === activeCategory
      ) ?? null
    );
  }, [effectivePosts, activeCategory, appliedSearchQuery, durationFilter]);

  // 좌측 메인 피드 필터링 및 정렬
  const filteredPosts = useMemo(() => {
    const q = appliedSearchQuery.trim().toLowerCase();
    const latestTimestamp = effectivePosts.reduce(
      (maxTs, p) => Math.max(maxTs, p.sortTimestamp),
      BASE_ANCHOR_TIMESTAMP
    );
    const activeDurationOption = DURATION_OPTIONS.find(
      (opt) => opt.id === durationFilter
    );
    const presetCutoffMs =
      activeDurationOption?.days != null
        ? latestTimestamp - activeDurationOption.days * 24 * 60 * 60 * 1000
        : null;
    const customStartMs =
      durationFilter === "custom"
        ? parseLocalStartOfDayMs(appliedStartDate)
        : null;
    const customEndMs =
      durationFilter === "custom"
        ? parseLocalEndOfDayMs(appliedEndDate)
        : null;

    const list = effectivePosts.filter((post) => {
      if (activeCategory === "notice") {
        if (post.category !== "notice") return false;
      } else if (activeCategory === "all") {
        // 전체 탭에서는 일반 게시글만 아래 목록에 표시 (공지는 최상단 고정 슬롯에 노출)
        if (post.category === "notice") return false;
      } else if (post.category !== activeCategory) {
        return false;
      }

      if (presetCutoffMs != null && post.sortTimestamp < presetCutoffMs) {
        return false;
      }

      if (
        customStartMs != null &&
        customEndMs != null &&
        (post.sortTimestamp < customStartMs || post.sortTimestamp > customEndMs)
      ) {
        return false;
      }

      if (q.length > 0) {
        const deviceNames = post.taggedDeviceSlugs
          .map((slug) => deviceLookupMap.get(slug)?.name ?? slug)
          .join(" ");
        const haystack =
          `${post.title} ${post.author} ${COMMUNITY_CATEGORY_LABELS[post.category]} ${deviceNames}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortMode === "upvotes") {
        return b.upvotes - a.upvotes || b.sortTimestamp - a.sortTimestamp;
      }
      return b.sortTimestamp - a.sortTimestamp;
    });
  }, [
    effectivePosts,
    activeCategory,
    appliedSearchQuery,
    durationFilter,
    appliedStartDate,
    appliedEndDate,
    sortMode,
    deviceLookupMap,
  ]);

  const calendarCells = useMemo(
    () => buildCalendarGrid(calendarYear, calendarMonth),
    [calendarYear, calendarMonth]
  );

  const handleStepCalendarMonth = (delta: number) => {
    let nextYear = calendarYear;
    let nextMonth = calendarMonth + delta;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear = Math.max(CALENDAR_YEARS[0], nextYear - 1);
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = Math.min(
        CALENDAR_YEARS[CALENDAR_YEARS.length - 1],
        nextYear + 1
      );
    }
    setCalendarYear(nextYear);
    setCalendarMonth(nextMonth);
  };

  const handleSelectCalendarDate = (ymd: string) => {
    if (rangePickStep === "start") {
      setDraftStartDate(ymd);
      setDraftEndDate(ymd);
      setRangePickStep("end");
    } else {
      if (ymd < draftStartDate) {
        setDraftEndDate(draftStartDate);
        setDraftStartDate(ymd);
      } else {
        setDraftEndDate(ymd);
      }
      setRangePickStep("start");
    }
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPosts = useMemo(() => {
    const startIdx = (safePage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(startIdx, startIdx + POSTS_PER_PAGE);
  }, [filteredPosts, safePage]);

  const handleSelectCategory = (tab: CommunityFilterTab) => {
    setCurrentPage(1);
    navigateShallow(buildCategoryListUrl(tab), true);
  };

  const handleOpenPost = (postId: string) => {
    incrementPostView(postId);
    const categoryQuery =
      activeCategory !== "all"
        ? `category=${encodeURIComponent(activeCategory)}&`
        : "";
    navigateShallow(`/?${categoryQuery}post=${encodeURIComponent(postId)}`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBackToList = () => {
    navigateShallow(buildCategoryListUrl(activeCategory));
  };

  const handleOpenWritePage = () => {
    if (!session) {
      openAuthModal("게시글 작성은 로그인 후 이용할 수 있습니다.");
      return;
    }
    const categoryQuery =
      activeCategory !== "all"
        ? `category=${encodeURIComponent(activeCategory)}&`
        : "";
    navigateShallow(`/?${categoryQuery}mode=write`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 상단 페이지 헤더 (목록 화면에서만 표시 · 게시글 상세/로딩/작성 뷰에서는 시선 분산을 막기 위해 숨김) */}
      {!selectedPost && !isLoadingSelectedPost && !isWriteMode && (
        <div className="border-b border-[#282D2A] pb-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
              <MessageSquare className="size-3.5" />
              HARDWARE COMMUNITY LAB
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#D5DBD6] sm:text-3xl">
            KEYNIVERSE 공식 커뮤니티
          </h1>
          <p className="mt-1 text-sm text-[#8F9691]">
            생각을 자유롭게 나누는 공간
          </p>
        </div>
      )}

      {/* 2. 본문 레이아웃: 좌측 70% 메인 터미널 리스트 + 우측 320px Sticky 대시보드 사이드바 */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* === 좌측 메인 영역 (flex-1 min-w-0) === */}
        <section className="flex min-w-0 flex-1 flex-col gap-4">
          {isWriteMode ? (
            /* 글쓰기/글수정 페이지 뷰 (좌측 메인 영역 전환 · 우측 사이드바는 그대로 유지) */
            <PostWriteModal
              key={editingPost?.id ?? "new-post"}
              open={true}
              session={session}
              isVerifiedTester={verifiedStatus.isVerifiedTester}
              latestSnapshot={verifiedStatus.latestSnapshot}
              editingPost={editingPost}
              onCreatePost={(newPost) => {
                createCommunityPost(newPost);
                recordPointTransaction(
                  "게시글 작성",
                  POINT_REWARDS.CREATE_POST
                );
                setSortMode("latest");
                setCurrentPage(1);
                navigateShallow(`/?post=${encodeURIComponent(newPost.id)}`);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              onUpdatePost={(postId, updatedFields) => {
                updateCommunityPost(postId, updatedFields);
                navigateShallow(`/?post=${encodeURIComponent(postId)}`);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              onClose={() => {
                if (editingPost) {
                  navigateShallow(`/?post=${encodeURIComponent(editingPost.id)}`);
                } else {
                  handleBackToList();
                }
              }}
            />
          ) : (
            <>
              {/* 게시글 상세 로딩 스켈레톤 (새로고침 시 DB 동기화 전 목록이 위로 튀는 현상 방지) */}
              {isLoadingSelectedPost && (
                <div
                  aria-busy="true"
                  aria-label="게시글 불러오는 중"
                  className="flex w-full flex-col overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
                >
                  <div className="border-b border-[#282D2A] bg-[#151816] px-5 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="h-5 w-16 animate-pulse rounded bg-[#222623]" />
                      <div className="h-7 w-20 animate-pulse rounded-lg bg-[#222623]" />
                    </div>
                    <div className="h-6 w-2/3 animate-pulse rounded bg-[#222623]" />
                    <div className="mt-3 flex items-center justify-between border-t border-[#282D2A] pt-2.5">
                      <div className="h-3.5 w-20 animate-pulse rounded bg-[#222623]" />
                      <div className="h-3.5 w-32 animate-pulse rounded bg-[#222623]" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 p-5">
                    <div className="h-4 w-full animate-pulse rounded bg-[#222623]" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-[#222623]" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[#222623]" />
                    <div className="mt-2 h-24 w-full animate-pulse rounded-xl bg-[#151816]" />
                  </div>
                </div>
              )}

              {/* 게시글 상세 뷰 (선택된 글이 있을 때 상단에 표시되고, 바로 아래에 전체 글 목록이 이어서 표시됨) */}
              {selectedPost && (
                <PostDetailModal
                  key={selectedPost.id}
                  post={selectedPost}
                  session={session}
                  isVerifiedTester={verifiedStatus.isVerifiedTester}
                  isUpvoted={upvotedPostIds.has(selectedPost.id)}
                  userVsChoice={vsChoices[selectedPost.id]}
                  onToggleUpvote={(postId) => togglePostUpvote(postId)}
                  onSelectVsOption={(postId, choice) =>
                    selectVsPollOption(postId, choice)
                  }
                  onToggleDealStatus={(postId, nextStatus) =>
                    toggleDealPostStatus(postId, nextStatus)
                  }
                  onAddComment={(postId, comment) => {
                    addCommunityComment(postId, comment);
                    recordPointTransaction(
                      comment.parentId ? "답글 작성" : "댓글 작성",
                      POINT_REWARDS.CREATE_COMMENT
                    );
                  }}
                  onUpdateComment={(commentId, newContent) =>
                    updateCommunityComment(commentId, newContent)
                  }
                  onDeleteComment={(commentId) =>
                    deleteCommunityComment(commentId)
                  }
                  onOpenUserProfile={(nickname) => setProfileNickname(nickname)}
                  onEditPost={(postId) => {
                    navigateShallow(
                      `/?mode=write&edit=${encodeURIComponent(postId)}`
                    );
                    if (typeof window !== "undefined") {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  onDeletePost={(postId) => {
                    deleteCommunityPost(postId);
                    handleBackToList();
                  }}
                  onClose={handleBackToList}
                />
              )}

              {/* 상단 툴바: 카테고리 탭 (화면이 좁아져도 1줄 고정 + 좌우 스크롤) */}
              <div className="flex items-center rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-3">
                <div className="flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto">
                  {(
                    [
                      { id: "all", label: "전체" },
                      { id: "notice", label: "공지사항" },
                      { id: "diagnosis", label: "자유 게시판" },
                      { id: "build", label: "빌드/셋업" },
                      { id: "vs", label: "투표" },
                      { id: "deal", label: "특가/드랍" },
                    ] as Array<{ id: CommunityFilterTab; label: string }>
                  ).map((tab) => {
                    const active = activeCategory === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleSelectCategory(tab.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                          active
                            ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                            : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
                        )}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                            active
                              ? "bg-[#6B9080]/20 text-[#6B9080]"
                              : "bg-[#1A1D1B] text-[#8F9691]"
                          )}
                        >
                          {categoryCounts[tab.id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 고밀도 터미널 리스트 뷰 */}
              <div className="overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]">
                {/* 컬럼 헤더 바 (780px 이상에서 표시): 분류, 제목(좌측) / 작성자(우측) / 작성일, 조회수, 추천수(중앙 정렬) */}
                <div className="hidden items-center justify-between gap-3 border-b border-[#282D2A] bg-[#151816] px-3.5 py-2 text-[11px] font-semibold text-[#8F9691] whitespace-nowrap min-[780px]:flex">
                  <div className="flex items-center gap-2.5">
                    <span className="w-[48px] shrink-0 text-center">분류</span>
                    <span>제목</span>
                  </div>
                  <div className="flex shrink-0 items-center font-mono tabular-nums">
                    <span className="w-[116px] pr-2 text-right">작성자</span>
                    <span className="w-[64px] text-center">작성일</span>
                    <span className="w-[60px] text-center">조회수</span>
                    <span className="w-[56px] text-center">추천수</span>
                  </div>
                </div>

                <div className="divide-y divide-[#282D2A]">
                  {/* 1번째 줄 고정 (1페이지 & 비검색 상태): 현재 게시판 탭에 맞는 필독 [공지] 행 */}
                  {pinnedNoticePost && safePage === 1 && (
                    <CommunityPostRow
                      post={pinnedNoticePost}
                      isPinnedNotice={true}
                      isActive={selectedPost?.id === pinnedNoticePost.id}
                      onSelectPost={() => handleOpenPost(pinnedNoticePost.id)}
                    />
                  )}

                  {/* 2번째 줄 고정: 인피드(In-Feed) 네이티브 스폰서 행 (#1D211E 배경 + 볼드 유지로 일반 글과 차별화) */}
                  <Link
                    href={IN_FEED_SPONSOR_ITEM.href}
                    className="group flex flex-col justify-between gap-1.5 bg-[#1D211E] px-3.5 py-2.5 whitespace-nowrap transition-colors hover:bg-[#222623] min-[780px]:flex-row min-[780px]:items-center min-[780px]:gap-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
                      <span className="inline-flex w-[48px] shrink-0 items-center justify-center rounded border border-[#D4A373]/60 bg-[#222623] py-0.5 font-mono text-[11px] font-bold text-[#D4A373]">
                        {IN_FEED_SPONSOR_ITEM.badgeLabel}
                      </span>

                      <span className="truncate text-xs font-semibold text-[#E4E6E1] group-hover:text-[#D4A373] min-[780px]:text-[13px]">
                        {IN_FEED_SPONSOR_ITEM.title}
                      </span>
                    </div>

                    {/* 우측 끝 고정폭 스폰서 단가/링크 */}
                    <div className="flex shrink-0 items-center justify-end min-[780px]:w-[296px]">
                      <span className="inline-flex items-center gap-1 rounded border border-[#D4A373]/40 bg-[#151816] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#D4A373] transition-colors group-hover:border-[#D4A373] tabular-nums">
                        {IN_FEED_SPONSOR_ITEM.ctaLabel}
                      </span>
                    </div>
                  </Link>

                  {/* 일반 게시글 리스트 (1줄 고정 가로 행 · 제목만 온전히 표시) */}
                  {isCommunityLoading ? (
                    <div className="divide-y divide-[#282D2A]" aria-busy="true">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <div
                          key={`row-skeleton-${idx}`}
                          className="flex items-center justify-between gap-3 px-3.5 py-3"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <div className="h-5 w-[48px] shrink-0 animate-pulse rounded bg-[#222623]" />
                            <div className="h-4 w-2/3 animate-pulse rounded bg-[#222623]" />
                          </div>
                          <div className="hidden h-3.5 w-36 animate-pulse rounded bg-[#151816] min-[780px]:block" />
                        </div>
                      ))}
                    </div>
                  ) : paginatedPosts.length === 0 ? (
                    <div className="px-6 py-14 text-center text-xs text-[#8F9691]">
                      조건에 일치하는 커뮤니티 게시글이 없습니다.
                    </div>
                  ) : (
                    paginatedPosts.map((post) => (
                      <CommunityPostRow
                        key={post.id}
                        post={post}
                        isActive={selectedPost?.id === post.id}
                        onSelectPost={() => handleOpenPost(post.id)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 게시글 목록과 하단 검색바 사이 우측: [게시글 작성] 버튼 (게시글 상세 페이지 하단 목록에서는 숨김) */}
              {!selectedPost && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleOpenWritePage}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#6B9080] bg-[#6B9080] px-4 py-2 text-xs font-bold text-[#121413] transition-colors hover:bg-[#7CA291]"
                  >
                    <PenSquare className="size-3.5" />
                    <span>게시글 작성</span>
                  </button>
                </div>
              )}

              {/* 하단 컨트롤 박스: 상단(검색창 + 기간 필터 드롭다운 + 최신순/추천순) + 하단(페이지 표시기) */}
              <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-3.5">
                <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
                  {/* 검색창: 텍스트 입력 후 엔터(Enter) 또는 [검색] 버튼 클릭 시 검색 실행 */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setAppliedSearchQuery(searchInput.trim());
                      setCurrentPage(1);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-sm"
                  >
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#8F9691]" />
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="제목, 작성자, 장비 검색..."
                        className="h-8 w-full rounded-lg border border-[#282D2A] bg-[#151816] pr-7 pl-8 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
                      />
                      {(searchInput || appliedSearchQuery) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchInput("");
                            setAppliedSearchQuery("");
                            setCurrentPage(1);
                          }}
                          aria-label="검색어 초기화"
                          className="absolute top-1/2 right-2 -translate-y-1/2 text-[#8F9691] hover:text-[#E4E6E1]"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[#282D2A] bg-[#222623] px-3 text-xs font-semibold whitespace-nowrap text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                    >
                      검색
                    </button>
                  </form>

                  {/* 우측 컨트롤 그룹: 640px 미만에서는 좌측 [기간 범위] ↔ 우측 [최신순/추천순] 양끝 분산 정렬 */}
                  <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-end">
                    {/* 기간 범위(Duration) 드롭다운 */}
                    <div ref={durationMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setIsDurationMenuOpen((prev) => !prev)
                        }
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                          durationFilter !== "all" || isDurationMenuOpen
                            ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                            : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
                        )}
                      >
                        <Calendar className="size-3.5 text-[#6B9080]" />
                        <span>
                          {durationFilter === "custom"
                            ? `직접 설정 (${formatShortRangeLabel(appliedStartDate, appliedEndDate)})`
                            : (DURATION_OPTIONS.find(
                                (o) => o.id === durationFilter
                              )?.label ?? "전체")}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-[#8F9691] transition-transform",
                            isDurationMenuOpen && "rotate-180"
                          )}
                        />
                      </button>

                      {isDurationMenuOpen && (
                        <div className="absolute left-0 bottom-full z-30 mb-2 w-[140px] overflow-hidden rounded-xl border border-[#282D2A] bg-[#151816] p-1.5 shadow-lg divide-y divide-[#282D2A]/60 sm:right-0 sm:left-auto">
                          {DURATION_OPTIONS.map((opt) => {
                            const isSelected = durationFilter === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  if (opt.id === "custom") {
                                    setDraftStartDate(appliedStartDate);
                                    setDraftEndDate(appliedEndDate);
                                    const [y, m] = appliedEndDate
                                      .split("-")
                                      .map(Number);
                                    if (y && m) {
                                      setCalendarYear(y);
                                      setCalendarMonth(m);
                                    }
                                    setRangePickStep("start");
                                    setIsDurationMenuOpen(false);
                                    setIsCustomCalendarOpen(true);
                                  } else {
                                    setDurationFilter(opt.id);
                                    setIsCustomCalendarOpen(false);
                                    setIsDurationMenuOpen(false);
                                    setCurrentPage(1);
                                  }
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs whitespace-nowrap transition-colors",
                                  isSelected
                                    ? "bg-[#222623] font-semibold text-[#6B9080]"
                                    : "text-[#E4E6E1] hover:bg-[#222623]"
                                )}
                              >
                                <span>{opt.label}</span>
                                {isSelected && (
                                  <Check className="size-3.5 text-[#6B9080]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* [최신순 / 추천순] 정렬 */}
                    <div className="flex shrink-0 items-center rounded-lg border border-[#282D2A] bg-[#151816] p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSortMode("latest");
                          setCurrentPage(1);
                        }}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                          sortMode === "latest"
                            ? "bg-[#222623] font-semibold text-[#6B9080]"
                            : "text-[#8F9691] hover:text-[#E4E6E1]"
                        )}
                      >
                        최신순
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortMode("upvotes");
                          setCurrentPage(1);
                        }}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                          sortMode === "upvotes"
                            ? "bg-[#222623] font-semibold text-[#D4A373]"
                            : "text-[#8F9691] hover:text-[#E4E6E1]"
                        )}
                      >
                        추천순
                      </button>
                    </div>
                  </div>
                </div>

                {/* 검색창 영역 하단: 페이지 표시기 (Pagination) */}
                <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-[#282D2A] pt-3 font-mono text-xs tabular-nums">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    aria-label="이전 페이지"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                      safePage <= 1
                        ? "cursor-not-allowed border-[#282D2A] bg-[#151816] text-[#8F9691]/40"
                        : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080] hover:text-[#E4E6E1]"
                    )}
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => {
                      const active = pageNum === safePage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors",
                            active
                              ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                              : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                  )}

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, safePage + 1))
                    }
                    aria-label="다음 페이지"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                      safePage >= totalPages
                        ? "cursor-not-allowed border-[#282D2A] bg-[#151816] text-[#8F9691]/40"
                        : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080] hover:text-[#E4E6E1]"
                    )}
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* === 우측 Sticky 대시보드 사이드바 (1024px+ 320px 세로 / 640~1023px 2열 + 하단 가로형 AD) === */}
        <aside className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:sticky lg:top-20 lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col">
          {/* 위젯 1: 인기글 TOP 5 */}
          <div className="flex flex-col rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4">
            <div className="mb-3 flex items-center border-b border-[#282D2A] pb-2.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="size-4 text-[#D4A373]" />
                <h2 className="text-xs font-bold text-[#E4E6E1]">
                  인기글
                </h2>
              </div>
            </div>

            <div className="flex-1 divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
              {popularTopPosts.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-[#8F9691]">
                  등록된 인기글이 없습니다.
                </div>
              ) : (
                popularTopPosts.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpenPost(item.id)}
                    className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs whitespace-nowrap transition-colors hover:bg-[#222623]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={cn(
                          "w-4 shrink-0 font-mono text-[11px] font-bold tabular-nums",
                          idx === 0 ? "text-[#D4A373]" : "text-[#6B9080]"
                        )}
                      >
                        0{idx + 1}
                      </span>
                      <span className="truncate font-medium text-[#E4E6E1] group-hover:text-[#6B9080]">
                        {item.title}
                      </span>
                    </div>

                    <span className="shrink-0 font-mono text-[11px] font-semibold text-[#D4A373] tabular-nums">
                      {item.upvotes}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 위젯 2: 인기 투표 미리보기 */}
          <div className="flex flex-col rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4">
            <div className="mb-3 flex items-center border-b border-[#282D2A] pb-2.5">
              <div className="flex items-center gap-1.5">
                <Swords className="size-4 text-[#6B9080]" />
                <h2 className="text-xs font-bold text-[#E4E6E1]">인기 투표</h2>
              </div>
            </div>

            {featuredVsPost && featuredVsPost.vsMeta ? (
              <>
                <p className="mb-3 line-clamp-1 text-xs font-medium text-[#E4E6E1]">
                  {featuredVsPost.title}
                </p>

                {(() => {
                  const aVotes = featuredVsPost.vsMeta.optionAVotes;
                  const bVotes = featuredVsPost.vsMeta.optionBVotes;
                  const sum = aVotes + bVotes;
                  const aPct = sum === 0 ? 50 : Math.round((aVotes / sum) * 100);
                  const bPct = 100 - aPct;

                  return (
                    <div className="flex flex-1 flex-col justify-between rounded-lg border border-[#282D2A] bg-[#151816] p-3">
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2 text-xs whitespace-nowrap">
                          <span className="truncate font-semibold text-[#6B9080]">
                            {featuredVsPost.vsMeta.optionAName}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#6B9080] tabular-nums">
                            {aPct}% ({aVotes}표)
                          </span>
                        </div>

                        {/* 매트 2-톤 대결 비율 바 (#6B9080 vs #D4A373) */}
                        <div className="my-2 flex h-2 w-full overflow-hidden rounded-full bg-[#282D2A]">
                          <div
                            className="h-full bg-[#6B9080]"
                            style={{ width: `${aPct}%` }}
                          />
                          <div className="h-full w-[2px] shrink-0 bg-[#121413]" />
                          <div
                            className="h-full flex-1 bg-[#D4A373]"
                            style={{ width: `${bPct}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 text-xs whitespace-nowrap">
                          <span className="truncate font-semibold text-[#D4A373]">
                            {featuredVsPost.vsMeta.optionBName}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#D4A373] tabular-nums">
                            {bPct}% ({bVotes}표)
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenPost(featuredVsPost.id)}
                        className="mt-3 w-full rounded-md border border-[#282D2A] bg-[#222623] py-1.5 text-center text-[11px] font-semibold text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                      >
                        투표 참여 →
                      </button>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-6 text-center">
                <p className="text-xs text-[#8F9691]">
                  진행 중인 투표가 없습니다.
                </p>
                <button
                  type="button"
                  onClick={handleOpenWritePage}
                  className="rounded-md border border-[#282D2A] bg-[#222623] px-3 py-1.5 text-[11px] font-semibold text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                >
                  투표 만들기 →
                </button>
              </div>
            )}
          </div>

          {/* 위젯 3: 우측 사이드바 하단 스폰서 배너 예시 슬롯 */}
          <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4 sm:col-span-2 lg:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded border border-[#D4A373]/60 bg-[#D4A373]/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#D4A373]">
                SPONSORED AD
              </span>
              <span className="rounded border border-[#282D2A] bg-[#151816] px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-wider text-[#8F9691]">
                SAMPLE
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-center md:flex md:flex-row md:items-center md:justify-between md:gap-4 lg:flex lg:flex-col lg:items-stretch lg:gap-3">
              {/* 미니 도식 그래픽 + 타이틀 */}
              <div className="flex min-w-0 items-center gap-3 md:flex-1">
                <SwitchCrossSectionIcon
                  colorway={{
                    topHex: "#4A5D52",
                    bottomHex: "#2C3832",
                    stemHex: "#D4A373",
                  }}
                  pins={5}
                  className="size-12 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-[#E4E6E1]">
                    파트너 스폰서 카드 예시
                  </h3>
                  <p className="truncate font-mono text-[11px] text-[#8F9691]">
                    Partner Product Showcase
                  </p>
                </div>
              </div>

              {/* 안내 요약 2줄 */}
              <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816] text-xs md:w-[248px] md:shrink-0 lg:w-full">
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 whitespace-nowrap">
                  <span className="text-[#8F9691]">노출 위치</span>
                  <span className="font-mono font-semibold text-[#E4E6E1]">
                    커뮤니티 사이드바
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 whitespace-nowrap">
                  <span className="text-[#8F9691]">대상</span>
                  <span className="font-mono font-semibold text-[#D4A373]">
                    키보드·마우스 브랜드
                  </span>
                </div>
              </div>

              <Link
                href="/policy?tab=partnership"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#222623] px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080] sm:col-span-2 md:w-auto md:shrink-0 lg:w-full"
              >
                <span>광고/제휴 안내</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* '직접 설정' 클릭 시 화면 중앙에 열리는 달력 다이얼로그 모달 (좁은 모바일 화면에서도 화면 이탈 0%) */}
      {isCustomCalendarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="기간 직접 설정 달력"
          onClick={() => setIsCustomCalendarOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[320px] overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B] shadow-2xl"
          >
            {/* 모달 상단 타이틀 바 */}
            <div className="flex items-center justify-between border-b border-[#282D2A] bg-[#151816] px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#E4E6E1]">
                <Calendar className="size-3.5 text-[#6B9080]" />
                <span>기간 직접 설정</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomCalendarOpen(false)}
                aria-label="달력 모달 닫기"
                className="flex size-6 items-center justify-center rounded border border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="p-4">
              {/* 연도(Year) 및 월(Month) 선택 헤더 */}
              <div className="mb-3 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStepCalendarMonth(-1)}
                  aria-label="이전 달"
                  className="flex size-7 items-center justify-center rounded-md border border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080] hover:text-[#E4E6E1]"
                >
                  <ChevronLeft className="size-3.5" />
                </button>

                <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                  <select
                    aria-label="연도 선택"
                    value={calendarYear}
                    onChange={(e) => setCalendarYear(Number(e.target.value))}
                    className="h-7 rounded-md border border-[#282D2A] bg-[#151816] px-2 text-xs font-semibold text-[#E4E6E1] focus:border-[#6B9080] focus:outline-none"
                  >
                    {CALENDAR_YEARS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}년
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="월 선택"
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(Number(e.target.value))}
                    className="h-7 rounded-md border border-[#282D2A] bg-[#151816] px-1.5 text-xs font-semibold text-[#E4E6E1] focus:border-[#6B9080] focus:outline-none"
                  >
                    {CALENDAR_MONTHS.map((mo) => (
                      <option key={mo} value={mo}>
                        {mo}월
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepCalendarMonth(1)}
                  aria-label="다음 달"
                  className="flex size-7 items-center justify-center rounded-md border border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080] hover:text-[#E4E6E1]"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>

              {/* 요일 헤더 */}
              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-[#8F9691]">
                {WEEKDAY_LABELS.map((w) => (
                  <span key={w} className="py-1">
                    {w}
                  </span>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-1 font-mono text-xs tabular-nums">
                {calendarCells.map((cell, idx) => {
                  if (!cell.day || !cell.ymd) {
                    return <span key={`empty-${idx}`} className="h-8" />;
                  }
                  const isStart = cell.ymd === draftStartDate;
                  const isEnd = cell.ymd === draftEndDate;
                  const isBetween =
                    cell.ymd > draftStartDate && cell.ymd < draftEndDate;

                  return (
                    <button
                      key={cell.ymd}
                      type="button"
                      onClick={() => handleSelectCalendarDate(cell.ymd!)}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md transition-colors",
                        isStart || isEnd
                          ? "bg-[#6B9080] font-bold text-[#121413]"
                          : isBetween
                            ? "bg-[#6B9080]/20 text-[#E4E6E1]"
                            : "text-[#E4E6E1] hover:bg-[#222623]"
                      )}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>

              {/* 선택된 시작일 ~ 종료일 표시 및 적용 버튼 */}
              <div className="mt-3 border-t border-[#282D2A] pt-3">
                <div className="mb-3 flex items-center justify-between rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-2 font-mono text-xs text-[#E4E6E1] tabular-nums">
                  <span>{draftStartDate}</span>
                  <span className="text-[#8F9691]">~</span>
                  <span>{draftEndDate}</span>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomCalendarOpen(false)}
                    className="rounded-lg border border-[#282D2A] bg-[#151816] px-3.5 py-1.5 text-xs font-semibold text-[#8F9691] transition-colors hover:text-[#E4E6E1]"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedStartDate(draftStartDate);
                      setAppliedEndDate(draftEndDate);
                      setDurationFilter("custom");
                      setIsCustomCalendarOpen(false);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-[#6B9080] bg-[#6B9080] px-4 py-1.5 text-xs font-bold text-[#121413] transition-colors hover:bg-[#7CA291]"
                  >
                    적용
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 작성자 닉네임 클릭 시 팝업되는 유저 프로필 모달 */}
      <UserProfileModal
        nickname={profileNickname}
        isCurrentUser={Boolean(session && profileNickname === session.nickname)}
        allPosts={effectivePosts}
        onSelectPost={handleOpenPost}
        onClose={() => setProfileNickname(null)}
      />
    </div>
  );
}

interface CommunityPostRowProps {
  post: CommunityPost;
  isActive?: boolean;
  isPinnedNotice?: boolean;
  onSelectPost: () => void;
}

function CommunityPostRow({
  post,
  isActive = false,
  isPinnedNotice = false,
  onSelectPost,
}: CommunityPostRowProps) {
  const isNotice = post.category === "notice" || isPinnedNotice;

  const categoryBadgeClass = isNotice
    ? "border-[#6B9080] bg-[#222623] font-bold text-[#6B9080]"
    : "border-[#282D2A] bg-[#151816] text-[#8F9691]";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelectPost}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectPost();
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col justify-between gap-1.5 px-3.5 py-2.5 whitespace-nowrap transition-colors hover:bg-[#222623] min-[780px]:flex-row min-[780px]:items-center min-[780px]:gap-3",
        isPinnedNotice && "bg-[#171B18]",
        isActive && "bg-[#222623]"
      )}
    >
      {/* 좌측(또는 780px 미만 1번째 줄): 2글자 [분류] 배지 + 게시글 제목 + 댓글 수 [N] */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        <span
          className={cn(
            "inline-flex w-[48px] shrink-0 items-center justify-center rounded border py-0.5 text-[11px]",
            !isNotice && "font-normal",
            categoryBadgeClass
          )}
        >
          [{COMMUNITY_CATEGORY_SHORT_LABELS[post.category]}]
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span
            className={cn(
              "truncate text-xs min-[780px]:text-[13px]",
              isNotice ? "font-semibold" : "font-normal",
              post.dealMeta?.status === "ended"
                ? "text-[#8F9691] line-through"
                : isNotice
                  ? "text-[#88B09E] group-hover:text-[#A3C9B8]"
                  : isActive
                    ? "text-[#6B9080]"
                    : "text-[#E4E6E1] group-hover:text-white"
            )}
          >
            {post.title}
          </span>

          {post.comments.length > 0 && (
            <span className="shrink-0 font-mono text-xs font-normal text-[#6B9080] tabular-nums">
              [{post.comments.length}]
            </span>
          )}
        </div>
      </div>

      {/* 780px 미만(min-[780px]:hidden) 전용 2번째 줄: 우측 하단에 '작성자 | 작성일 | 조회 : N | 추천 : N' */}
      <div className="flex items-center justify-end gap-1.5 text-[11px] font-normal text-[#8F9691] min-[780px]:hidden">
        {post.isMyPost && (
          <span className="shrink-0 rounded border border-[#6B9080]/40 bg-[#6B9080]/10 px-1 py-0.5 font-mono text-[9px] font-semibold text-[#6B9080]">
            MY
          </span>
        )}
        <span
          className={cn(
            "truncate",
            post.authorIsAdmin
              ? "font-semibold text-[#6B9080]"
              : "font-normal text-[#8F9691]"
          )}
        >
          {post.author}
        </span>
        <span className="font-mono text-[#282D2A]">·</span>
        <div className="shrink-0 font-mono text-[11px] font-normal text-[#8F9691] tabular-nums">
          <span>{post.createdAt}</span>
          <span className="mx-1.5 text-[#282D2A]">·</span>
          <span>조회 {(post.views ?? 42).toLocaleString()}</span>
          <span className="mx-1.5 text-[#282D2A]">·</span>
          <span>
            추천 <span className="text-[#D4A373]">{post.upvotes}</span>
          </span>
        </div>
      </div>

      {/* 780px 이상(min-[780px]:flex) 우측 고정폭 메타 열: 작성자(우측 정렬) · 작성일/조회수/추천수(중앙 정렬, 볼드 해제) */}
      <div className="hidden shrink-0 items-center font-mono text-xs font-normal tabular-nums min-[780px]:flex">
        {/* 작성자 (w-[116px] 우측 정렬) */}
        <div className="flex w-[116px] items-center justify-end gap-1.5 pr-2">
          {post.isMyPost && (
            <span className="shrink-0 rounded border border-[#6B9080]/40 bg-[#6B9080]/10 px-1 py-0.5 font-mono text-[9px] font-semibold text-[#6B9080]">
              MY
            </span>
          )}
          <span
            className={cn(
              "truncate font-sans text-xs",
              post.authorIsAdmin
                ? "font-semibold text-[#6B9080]"
                : "font-normal text-[#8F9691]"
            )}
          >
            {post.author}
          </span>
        </div>

        {/* 작성일 (w-[64px] 중앙 정렬) */}
        <span className="w-[64px] text-center text-[11px] font-normal text-[#8F9691]">
          {post.createdAt}
        </span>

        {/* 조회수 (w-[60px] 중앙 정렬) */}
        <span className="w-[60px] text-center text-[11px] font-normal text-[#8F9691]">
          {(post.views ?? 42).toLocaleString()}
        </span>

        {/* 추천수 (w-[56px] 중앙 정렬) */}
        <span className="w-[56px] text-center font-normal text-[#D4A373]">
          {post.upvotes}
        </span>
      </div>
    </div>
  );
}
