"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  CornerDownRight,
  ExternalLink,
  MessageSquare,
  Pencil,
  Send,
  Siren,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import {
  COMMUNITY_CATEGORY_LABELS,
  CommunityComment,
  CommunityPost,
} from "@/types/community";
import { GoogleUserSession, openAuthModal } from "@/lib/auth-store";
import {
  COMMENT_CLAMP_LINES,
  COMMENT_MAX_LENGTH,
  COMMENT_MAX_LINES,
  clampCommentDraftInput,
  createEntityId,
  sanitizeCommentContent,
} from "@/lib/community-store";
import {
  computeEffectiveMouseCommunity,
  computeEffectiveSwitchCommunity,
  deleteStoredVote,
  getServerVoteStoreVersion,
  getVoteStoreVersion,
  readStoredVote,
  saveStoredVote,
  subscribeVoteStore,
} from "@/lib/spec-verification";
import { SpecDetailModal } from "@/components/specs/SpecDetailModal";
import {
  ReportModal,
  ReportTargetInfo,
} from "@/components/community/ReportModal";
import { cn } from "@/lib/utils";

interface PostDetailModalProps {
  post: CommunityPost | null;
  session: GoogleUserSession | null;
  isVerifiedTester: boolean;
  isUpvoted: boolean;
  userVsChoice: "A" | "B" | undefined;
  onToggleUpvote: (postId: string) => void;
  onSelectVsOption: (postId: string, choice: "A" | "B") => void;
  onToggleDealStatus: (postId: string, nextStatus: "active" | "ended") => void;
  onAddComment: (postId: string, comment: CommunityComment) => void;
  onUpdateComment: (commentId: string, newContent: string) => void;
  onDeleteComment: (commentId: string) => void;
  onEditPost: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onOpenUserProfile: (nickname: string) => void;
  onClose: () => void;
}

interface ReplyTargetState {
  /** 클릭한 댓글/답글의 ID (답글 입력창이 바로 아래에 열릴 대상) */
  anchorCommentId: string;
  /** 실제 1단계 들여쓰기 그룹의 루트 원댓글 ID */
  rootParentId: string;
  /** 답글 대상 작성자 닉네임 */
  targetAuthor: string;
  /** 답글에 또 답글(대댓글, Depth 2+)을 다는지 여부 -> true면 @닉네임 멘션 태그 자동 표시 */
  isNestedReply: boolean;
}

type ConfirmDeleteTarget =
  | { kind: "post"; postId: string; title: string }
  | {
      kind: "comment";
      commentId: string;
      isReply: boolean;
      preview: string;
    };

function formatNowTime(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getCurrentCommentId(): string {
  return createEntityId("cmt");
}

function countLines(text: string): number {
  if (!text) return 1;
  return text.split("\n").length;
}

/**
 * 댓글 본문이 5줄(COMMENT_CLAMP_LINES)을 초과하는지 판별하고,
 * 접힌 상태일 때 처음 5줄까지만 반환하는 헬퍼
 */
function getClampedCommentView(
  content: string,
  isExpanded: boolean
): {
  needsClamp: boolean;
  visibleText: string;
  totalLines: number;
} {
  const lines = content.split("\n");
  const needsClamp =
    lines.length > COMMENT_CLAMP_LINES || content.length > 260;

  if (!needsClamp || isExpanded) {
    return {
      needsClamp,
      visibleText: content,
      totalLines: lines.length,
    };
  }

  if (lines.length > COMMENT_CLAMP_LINES) {
    return {
      needsClamp: true,
      visibleText: lines.slice(0, COMMENT_CLAMP_LINES).join("\n"),
      totalLines: lines.length,
    };
  }

  return {
    needsClamp: true,
    visibleText: `${content.slice(0, 260)}...`,
    totalLines: lines.length,
  };
}

export function PostDetailModal({
  post,
  session,
  isVerifiedTester,
  isUpvoted,
  userVsChoice,
  onToggleUpvote,
  onSelectVsOption,
  onToggleDealStatus,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  onEditPost,
  onDeletePost,
  onOpenUserProfile,
  onClose,
}: PostDetailModalProps) {
  const [commentText, setCommentText] = useState<string>("");
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 답글(대댓글) 인라인 작성 상태
  const [replyTarget, setReplyTarget] = useState<ReplyTargetState | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 댓글/답글 인라인 수정 상태
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>("");
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncAutoResize = (
    el: HTMLTextAreaElement | null,
    minHeightPx: number,
    maxHeightPx = 150
  ) => {
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(
      maxHeightPx,
      Math.max(minHeightPx, el.scrollHeight)
    );
    el.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    syncAutoResize(commentTextareaRef.current, 60, 150);
  }, [commentText]);

  useEffect(() => {
    syncAutoResize(replyTextareaRef.current, 54, 150);
  }, [replyText, replyTarget]);

  useEffect(() => {
    syncAutoResize(editTextareaRef.current, 64, 150);
  }, [editingCommentText, editingCommentId]);

  // 5줄 초과 댓글/답글의 [더보기 ▾ / 접기 ▴] 토글 상태
  const [expandedCommentIds, setExpandedCommentIds] = useState<
    Record<string, boolean>
  >({});

  // 게시글/댓글/답글 삭제 확인(Confirm) 모달 상태
  const [confirmDeleteTarget, setConfirmDeleteTarget] =
    useState<ConfirmDeleteTarget | null>(null);

  // 게시글/댓글/답글 신고 모달 상태
  const [reportTarget, setReportTarget] = useState<ReportTargetInfo | null>(
    null
  );

  // 게시글 내 장비 버튼 클릭 시 페이지 이동 없이 팝업되는 스펙 모달 상태
  const [previewDeviceSlug, setPreviewDeviceSlug] = useState<string | null>(
    null
  );

  // 인플레이스 스펙 모달의 별점/체감 투표 실시간 반영 구독
  const voteVersion = useSyncExternalStore(
    subscribeVoteStore,
    getVoteStoreVersion,
    getServerVoteStoreVersion
  );

  const previewSwitchSpec = useMemo(
    () =>
      previewDeviceSlug
        ? INITIAL_SWITCHES.find((sw) => sw.slug === previewDeviceSlug) ?? null
        : null,
    [previewDeviceSlug]
  );

  const previewMouseSpec = useMemo(
    () =>
      previewDeviceSlug
        ? INITIAL_MICE.find((ms) => ms.slug === previewDeviceSlug) ?? null
        : null,
    [previewDeviceSlug]
  );

  const previewDeviceId =
    previewSwitchSpec?.id ?? previewMouseSpec?.id ?? null;

  const previewExistingVote = useMemo(() => {
    if (!previewDeviceId || voteVersion === 0) return null;
    return readStoredVote(previewDeviceId);
  }, [previewDeviceId, voteVersion]);

  const previewSwitchCommunity = useMemo(() => {
    if (!previewSwitchSpec) return null;
    const userVote =
      voteVersion > 0 ? readStoredVote(previewSwitchSpec.id) : null;
    return computeEffectiveSwitchCommunity(previewSwitchSpec, userVote);
  }, [previewSwitchSpec, voteVersion]);

  const previewMouseCommunity = useMemo(() => {
    if (!previewMouseSpec) return null;
    const userVote =
      voteVersion > 0 ? readStoredVote(previewMouseSpec.id) : null;
    return computeEffectiveMouseCommunity(previewMouseSpec, userVote);
  }, [previewMouseSpec, voteVersion]);

  /**
   * 대형 커뮤니티 표준 1단계 들여쓰기(1-Depth Flat Threading) 정렬:
   * - 원댓글(parentId 없음)을 기준으로 바로 아래에 해당 원댓글에 속한 답글·대댓글(parentId === root.id)을 시간순으로 묶어 배치
   * - 원댓글이 삭제된 경우에도 남은 답글이 유실되지 않도록 안전하게 포함
   */
  const orderedComments = useMemo(() => {
    const comments = post?.comments ?? [];
    const rootComments = comments.filter((c) => !c.parentId);
    const rootIds = new Set(rootComments.map((c) => c.id));
    const repliesByRoot = new Map<string, CommunityComment[]>();
    const orphanReplies: CommunityComment[] = [];

    for (const c of comments) {
      if (!c.parentId) continue;
      if (rootIds.has(c.parentId)) {
        const list = repliesByRoot.get(c.parentId) ?? [];
        list.push(c);
        repliesByRoot.set(c.parentId, list);
      } else {
        orphanReplies.push(c);
      }
    }

    const result: CommunityComment[] = [];
    for (const root of rootComments) {
      result.push(root);
      const children = repliesByRoot.get(root.id);
      if (children && children.length > 0) {
        result.push(...children);
      }
    }
    if (orphanReplies.length > 0) {
      result.push(...orphanReplies);
    }
    return result;
  }, [post?.comments]);

  if (!post) return null;

  const categoryBadgeClass =
    post.category === "notice"
      ? "border-[#6B9080] bg-[#222623] font-bold text-[#6B9080]"
      : "border-[#282D2A] bg-[#151816] text-[#8F9691]";

  const handleUpvoteClick = () => {
    if (!session) {
      openAuthModal("추천은 로그인 후 이용할 수 있습니다.");
      return;
    }
    onToggleUpvote(post.id);
  };

  const handleVsVoteClick = (choice: "A" | "B") => {
    if (!session) {
      openAuthModal("투표는 로그인 후 참여할 수 있습니다.");
      return;
    }
    onSelectVsOption(post.id, choice);
  };

  const submitCommentNow = () => {
    if (!session) {
      openAuthModal("댓글은 로그인 후 작성할 수 있습니다.");
      return;
    }
    const sanitized = sanitizeCommentContent(commentText);
    if (!sanitized) return;

    onAddComment(post.id, {
      id: getCurrentCommentId(),
      author: session.nickname,
      authorVerified: isVerifiedTester,
      content: sanitized,
      createdAt: formatNowTime(),
      isMyComment: true,
    });
    setCommentText("");
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCommentNow();
  };

  const submitReplyNow = () => {
    if (!session) {
      openAuthModal("답글은 로그인 후 작성할 수 있습니다.");
      return;
    }
    if (!replyTarget) return;
    const sanitized = sanitizeCommentContent(replyText);
    if (!sanitized) return;

    onAddComment(post.id, {
      id: getCurrentCommentId(),
      author: session.nickname,
      authorVerified: isVerifiedTester,
      content: sanitized,
      createdAt: formatNowTime(),
      isMyComment: true,
      parentId: replyTarget.rootParentId,
      replyToAuthor: replyTarget.isNestedReply
        ? replyTarget.targetAuthor
        : undefined,
    });
    setReplyText("");
    setReplyTarget(null);
  };

  const submitEditCommentNow = (commentId: string) => {
    const sanitized = sanitizeCommentContent(editingCommentText);
    if (!sanitized) return;
    onUpdateComment(commentId, sanitized);
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  // 태그된 스위치·마우스 상세 데이터 조회
  const taggedSwitchSpecs = post.taggedDeviceSlugs
    .map((slug) => INITIAL_SWITCHES.find((sw) => sw.slug === slug))
    .filter((sw): sw is NonNullable<typeof sw> => Boolean(sw));

  const taggedMouseSpecs = post.taggedDeviceSlugs
    .map((slug) => INITIAL_MICE.find((ms) => ms.slug === slug))
    .filter((ms): ms is NonNullable<typeof ms> => Boolean(ms));

  return (
    <article
      aria-label={post.title}
      className="flex w-full flex-col overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
    >
      {/* 1. 상단 헤더: 말머리 + 제목 + 좌측 작성자 + 우측 작성일/조회수 + 목록으로 돌아가기 */}
      <div className="border-b border-[#282D2A] bg-[#151816] px-5 py-4">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded border px-2 py-0.5 text-xs font-semibold",
                categoryBadgeClass
              )}
            >
              [{COMMUNITY_CATEGORY_LABELS[post.category]}]
            </span>
            {post.dealMeta && (
              <span
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
                  post.dealMeta.status === "active"
                    ? "border-[#D4A373]/50 bg-[#222623] text-[#D4A373]"
                    : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691]"
                )}
              >
                {post.dealMeta.status === "active" ? "진행중" : "종료"} ·{" "}
                {post.dealMeta.priceLabel}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 py-1.5 text-xs font-semibold text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
          >
            <ArrowLeft className="size-3.5" />
            <span>목록으로</span>
          </button>
        </div>

        <h2 className="text-lg font-bold text-[#F4F6F2] sm:text-xl">
          {post.title}
        </h2>

        {/* 메타 행: 좌측 작성자(클릭 시 프로필 모달) + 우측 작성일·조회수·수정/삭제/신고 버튼 */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#282D2A] pt-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenUserProfile(post.author)}
              className="font-semibold text-[#B5BCB7] underline-offset-2 transition-colors hover:text-[#6B9080] hover:underline"
            >
              {post.author}
            </button>
            {post.isMyPost && (
              <span className="rounded border border-[#6B9080]/40 bg-[#6B9080]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#6B9080]">
                MY
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs text-[#8F9691] tabular-nums">
            <span>
              작성일 {post.createdAt}
              {post.isEdited && (
                <span className="ml-1 font-sans text-[11px] text-[#8F9691]">
                  (수정됨)
                </span>
              )}
            </span>
            <span>·</span>
            <span>조회 {(post.views ?? 42).toLocaleString()}</span>

            {post.isMyPost && post.category !== "notice" && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onEditPost(post.id)}
                  title="내 게시글 수정"
                  aria-label="내 게시글 수정"
                  className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#1A1D1B] px-2 py-1 font-sans text-[11px] font-medium text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                >
                  <Pencil className="size-3 text-[#6B9080]" />
                  <span>수정</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setConfirmDeleteTarget({
                      kind: "post",
                      postId: post.id,
                      title: post.title,
                    })
                  }
                  title="내 게시글 삭제"
                  aria-label="내 게시글 삭제"
                  className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#1A1D1B] px-2 py-1 font-sans text-[11px] font-medium text-[#8F9691] transition-colors hover:border-[#E06C75] hover:text-[#E06C75]"
                >
                  <Trash2 className="size-3.5 text-[#E06C75]" />
                  <span>삭제</span>
                </button>
              </div>
            )}

            {!post.isMyPost && post.category !== "notice" && (
              <button
                type="button"
                onClick={() => {
                  if (!session) {
                    openAuthModal("신고는 로그인 후 이용할 수 있습니다.");
                    return;
                  }
                  setReportTarget({ targetType: "post", targetId: post.id });
                }}
                title="게시글 신고"
                aria-label="게시글 신고"
                className="flex size-6 shrink-0 items-center justify-center rounded border border-[#282D2A] bg-[#1A1D1B] text-[#E06C75]/75 transition-colors hover:border-[#E06C75]/70 hover:text-[#E06C75]"
              >
                <Siren className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

        {/* 2. 본문 스크롤 영역 */}
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {/* === [특가/드랍] 전용 단가·상태 스위치·구매처 박스 (상단 유지) === */}
          {post.category === "deal" && post.dealMeta && (
            <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <span className="block text-[11px] text-[#8F9691]">
                      단가
                    </span>
                    <span
                      className={cn(
                        "font-mono text-lg font-bold tabular-nums",
                        post.dealMeta.status === "active"
                          ? "text-[#D4A373]"
                          : "text-[#8F9691] line-through"
                      )}
                    >
                      {post.dealMeta.priceLabel}
                    </span>
                  </div>

                  <div className="h-7 w-px bg-[#282D2A]" />

                  <div>
                    <span className="block text-[11px] text-[#8F9691]">
                      판매처
                    </span>
                    <span className="text-xs font-semibold text-[#E4E6E1]">
                      {post.dealMeta.vendor}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {post.isMyPost && (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleDealStatus(
                          post.id,
                          post.dealMeta!.status === "active"
                            ? "ended"
                            : "active"
                        )
                      }
                      className="rounded-lg border border-[#6B9080] bg-[#222623] px-3 py-1.5 text-xs font-semibold text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
                    >
                      {post.dealMeta.status === "active"
                        ? "종료 처리"
                        : "재오픈"}
                    </button>
                  )}

                  {post.dealMeta.storeUrl && (
                    <a
                      href={post.dealMeta.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4A373]/50 bg-[#222623] px-3 py-1.5 font-mono text-xs font-semibold text-[#D4A373] transition-colors hover:bg-[#D4A373] hover:text-[#121413]"
                    >
                      <span>스토어 이동</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}

                  {taggedSwitchSpecs.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() => setPreviewDeviceSlug(sw.slug)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#282D2A] bg-[#222623] px-3 py-1.5 text-xs font-semibold text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                    >
                      <span>{sw.name}</span>
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  ))}

                  {taggedMouseSpecs.map((ms) => (
                    <button
                      key={ms.id}
                      type="button"
                      onClick={() => setPreviewDeviceSlug(ms.slug)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#282D2A] bg-[#222623] px-3 py-1.5 text-xs font-semibold text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                    >
                      <span>{ms.name}</span>
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 게시글 본문 텍스트 (반응형 최소 높이 적용 + 리치 서식/인라인 이미지 렌더링) */}
          {post.contentHtml ? (
            <div
              className="min-h-[140px] py-2 text-sm leading-relaxed text-[#E4E6E1] sm:min-h-[220px] lg:min-h-[340px] [&_h3]:my-2 [&_h3]:text-base [&_h3]:font-bold [&_hr]:my-3 [&_hr]:border-[#282D2A] [&_img]:my-3 [&_img]:max-h-[480px] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-[#282D2A] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          ) : (
            <div className="min-h-[140px] py-2 text-sm leading-relaxed whitespace-pre-line text-[#E4E6E1] sm:min-h-[220px] lg:min-h-[340px]">
              {post.content}
            </div>
          )}

          {/* === 본문 하단 0: [투표] 전용 양자택일 실시간 매치업 투표 위젯 === */}
          {post.category === "vs" && post.vsMeta && (
            <VsPollDetailWidget
              postId={post.id}
              vsMeta={post.vsMeta}
              userVsChoice={userVsChoice}
              onVote={handleVsVoteClick}
              onPreviewDevice={(slug) => setPreviewDeviceSlug(slug)}
            />
          )}

          {/* === 본문 하단 1: [빌드/셋업] 컴팩트 빌드 요약 & 태그 장비 (가로 여백 최소화 w-fit 구조) === */}
          {post.category === "build" && (
            <div className="w-fit max-w-full rounded-xl border border-[#282D2A] bg-[#151816] p-3.5">
              <div className="mb-2.5 flex items-center border-b border-[#282D2A] pb-2">
                <span className="text-xs font-bold text-[#6B9080]">
                  빌드
                </span>
              </div>

              {post.buildMeta && (
                <div className="mb-2.5 grid w-fit grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 py-2 text-xs">
                  <span className="text-[#8F9691]">하우징</span>
                  <span className="font-mono font-semibold text-[#E4E6E1]">
                    {post.buildMeta.boardName}
                  </span>
                  <span className="text-[#8F9691]">보강판</span>
                  <span className="font-semibold text-[#E4E6E1]">
                    {post.buildMeta.plateMaterial}
                  </span>
                  <span className="text-[#8F9691]">키캡</span>
                  <span className="font-semibold text-[#E4E6E1]">
                    {post.buildMeta.keycapProfile}
                  </span>
                </div>
              )}

              {(taggedSwitchSpecs.length > 0 || taggedMouseSpecs.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {taggedSwitchSpecs.map((sw) => (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() => setPreviewDeviceSlug(sw.slug)}
                      className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#222623] px-2.5 py-1 text-xs font-medium text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                    >
                      <span>{sw.name}</span>
                      <ArrowUpRight className="size-3 text-[#6B9080]" />
                    </button>
                  ))}

                  {taggedMouseSpecs.map((ms) => (
                    <button
                      key={ms.id}
                      type="button"
                      onClick={() => setPreviewDeviceSlug(ms.slug)}
                      className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#222623] px-2.5 py-1 text-xs font-medium text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                    >
                      <span>{ms.name}</span>
                      <ArrowUpRight className="size-3 text-[#6B9080]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === 본문 하단 2: [자유 게시판] 컴팩트 태그 도감 장비 칩 (가로 여백 최소화 w-fit 구조) === */}
          {post.category === "diagnosis" &&
            (taggedSwitchSpecs.length > 0 || taggedMouseSpecs.length > 0) && (
              <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-2 rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-2 text-xs">
                <span className="mr-1 font-semibold text-[#8F9691]">
                  태그 장비:
                </span>
                {taggedSwitchSpecs.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => setPreviewDeviceSlug(sw.slug)}
                    className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#222623] px-2.5 py-1 text-xs font-medium text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                  >
                    <span>{sw.name}</span>
                    <ArrowUpRight className="size-3 text-[#6B9080]" />
                  </button>
                ))}
                {taggedMouseSpecs.map((ms) => (
                  <button
                    key={ms.id}
                    type="button"
                    onClick={() => setPreviewDeviceSlug(ms.slug)}
                    className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#222623] px-2.5 py-1 text-xs font-medium text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
                  >
                    <span>{ms.name}</span>
                    <ArrowUpRight className="size-3 text-[#6B9080]" />
                  </button>
                ))}
              </div>
            )}

          {/* 게시글 [추천 (N)] 토글 버튼 (따봉 아이콘만 유지, 삼각형 제거) */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleUpvoteClick}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 font-mono text-xs font-bold transition-colors tabular-nums",
                isUpvoted
                  ? "border-[#D4A373] bg-[#222623] text-[#D4A373]"
                  : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#D4A373]/60 hover:text-[#E4E6E1]"
              )}
            >
              <ThumbsUp className="size-3.5" />
              <span>추천 ({post.upvotes})</span>
            </button>
          </div>

          {/* 하단 댓글/답글 리스트 & 작성 폼 */}
          <section className="border-t border-[#282D2A] pt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E4E6E1]">
                <MessageSquare className="size-3.5 text-[#6B9080]" />
                댓글 ({orderedComments.length})
              </span>
            </div>

            {orderedComments.length === 0 ? (
              <div className="mb-3 rounded-lg border border-[#282D2A] bg-[#151816] px-4 py-6 text-center text-xs text-[#8F9691]">
                아직 댓글이 없습니다.
              </div>
            ) : (
              <div className="mb-3 divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
                {orderedComments.map((cmt) => {
                  const isReply = Boolean(cmt.parentId);
                  const isEditingThis = editingCommentId === cmt.id;
                  const isReplyingBelowThis =
                    replyTarget?.anchorCommentId === cmt.id;
                  const isExpanded = Boolean(expandedCommentIds[cmt.id]);
                  const { needsClamp, visibleText } = getClampedCommentView(
                    cmt.content,
                    isExpanded
                  );

                  return (
                    <div
                      key={cmt.id}
                      className={cn(
                        "flex flex-col gap-2 px-3.5 py-2.5 text-xs",
                        isReply && "bg-[#131614] pl-6 sm:pl-8"
                      )}
                    >
                      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5">
                          {isReply && (
                            <CornerDownRight
                              aria-label="답글"
                              className="mr-0.5 size-3.5 shrink-0 translate-y-0.5 text-[#6B9080]"
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenUserProfile(cmt.author)}
                            className="shrink-0 font-semibold text-[#E4E6E1] underline-offset-2 transition-colors hover:text-[#6B9080] hover:underline"
                          >
                            {cmt.author}
                          </button>

                          {cmt.isMyComment && (
                            <span className="shrink-0 rounded bg-[#6B9080] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#121413]">
                              MY
                            </span>
                          )}

                          {!isEditingThis && (
                            <div className="min-w-0 flex-1">
                              {cmt.replyToAuthor && (
                                <span className="mr-1.5 inline-flex items-center rounded border border-[#6B9080]/40 bg-[#222623] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#6B9080]">
                                  @{cmt.replyToAuthor}
                                </span>
                              )}
                              <span className="break-words whitespace-pre-line text-[#E4E6E1]/90">
                                {visibleText}
                              </span>

                              {needsClamp && (
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedCommentIds((prev) => ({
                                        ...prev,
                                        [cmt.id]: !isExpanded,
                                      }))
                                    }
                                    className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#222623] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#6B9080] transition-colors hover:border-[#6B9080]"
                                  >
                                    {isExpanded ? "[접기 ▴]" : "[더보기 ▾]"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 우측 액션 바: 날짜 + (수정됨) + [답글] + 내 댓글 [수정] / [삭제] */}
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 font-mono text-[11px] text-[#8F9691] tabular-nums">
                          <span>
                            {cmt.createdAt}
                            {cmt.isEdited && (
                              <span className="ml-1 font-sans text-[10px] text-[#8F9691]">
                                (수정됨)
                              </span>
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              if (!session) {
                                openAuthModal(
                                  "답글은 로그인 후 작성할 수 있습니다."
                                );
                                return;
                              }
                              if (isReplyingBelowThis) {
                                setReplyTarget(null);
                                setReplyText("");
                              } else {
                                setReplyTarget({
                                  anchorCommentId: cmt.id,
                                  rootParentId: cmt.parentId ?? cmt.id,
                                  targetAuthor: cmt.author,
                                  isNestedReply: Boolean(cmt.parentId),
                                });
                                setReplyText("");
                              }
                            }}
                            className={cn(
                              "rounded border px-1.5 py-0.5 font-sans text-[11px] font-medium transition-colors",
                              isReplyingBelowThis
                                ? "border-[#6B9080] bg-[#222623] text-[#6B9080]"
                                : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:border-[#6B9080] hover:text-[#E4E6E1]"
                            )}
                          >
                            답글
                          </button>

                          {cmt.isMyComment ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditingThis) {
                                    setEditingCommentId(null);
                                    setEditingCommentText("");
                                  } else {
                                    setEditingCommentId(cmt.id);
                                    setEditingCommentText(cmt.content);
                                  }
                                }}
                                title="댓글 수정"
                                aria-label="댓글 수정"
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#8F9691] transition-colors hover:text-[#6B9080]"
                              >
                                <Pencil className="size-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmDeleteTarget({
                                    kind: "comment",
                                    commentId: cmt.id,
                                    isReply,
                                    preview: cmt.content.slice(0, 40),
                                  })
                                }
                                title="댓글 삭제"
                                aria-label="댓글 삭제"
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#8F9691] transition-colors hover:text-[#E06C75]"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (!session) {
                                  openAuthModal(
                                    "신고는 로그인 후 이용할 수 있습니다."
                                  );
                                  return;
                                }
                                setReportTarget({
                                  targetType: isReply ? "reply" : "comment",
                                  targetId: cmt.id,
                                });
                              }}
                              title={isReply ? "답글 신고" : "댓글 신고"}
                              aria-label={isReply ? "답글 신고" : "댓글 신고"}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#E06C75]/75 transition-colors hover:text-[#E06C75]"
                            >
                              <Siren className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 인라인 댓글/답글 수정 폼 */}
                      {isEditingThis && (
                        <div className="mt-1 rounded-lg border border-[#6B9080]/50 bg-[#1A1D1B] p-2.5">
                          <textarea
                            ref={editTextareaRef}
                            rows={2}
                            value={editingCommentText}
                            onChange={(e) =>
                              setEditingCommentText(
                                clampCommentDraftInput(e.target.value)
                              )
                            }
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                !e.nativeEvent.isComposing
                              ) {
                                e.preventDefault();
                                submitEditCommentNow(cmt.id);
                              } else if (e.key === "Escape") {
                                setEditingCommentId(null);
                                setEditingCommentText("");
                              }
                            }}
                            className="w-full resize-none overflow-y-auto rounded border border-[#282D2A] bg-[#151816] px-2.5 py-2 text-xs leading-relaxed text-[#E4E6E1] focus:border-[#6B9080] focus:outline-none"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-[#8F9691] tabular-nums">
                              {editingCommentText.length}/{COMMENT_MAX_LENGTH}자 ·{" "}
                              {countLines(editingCommentText)}/{COMMENT_MAX_LINES}줄
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditingCommentText("");
                                }}
                                className="rounded border border-[#282D2A] bg-[#151816] px-2.5 py-1 text-[11px] font-medium text-[#8F9691] hover:text-[#E4E6E1]"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                disabled={!editingCommentText.trim()}
                                onClick={() => submitEditCommentNow(cmt.id)}
                                className={cn(
                                  "rounded border px-2.5 py-1 text-[11px] font-bold transition-colors",
                                  editingCommentText.trim()
                                    ? "border-[#6B9080] bg-[#6B9080] text-[#121413] hover:bg-[#7CA291]"
                                    : "cursor-not-allowed border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] opacity-60"
                                )}
                              >
                                수정 완료
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 인라인 답글(대댓글) 작성 폼 (통합 입력 박스 + 하단 우측 컴팩트 버튼) */}
                      {isReplyingBelowThis && replyTarget && (
                        <div className="mt-1 overflow-hidden rounded-lg border border-[#282D2A] bg-[#151816] focus-within:border-[#6B9080]">
                          <div className="flex items-center justify-between border-b border-[#282D2A]/70 bg-[#1A1D1B] px-3 py-1.5 text-[11px]">
                            <span className="inline-flex items-center gap-1 font-semibold text-[#6B9080]">
                              <CornerDownRight className="size-3" />@
                              {replyTarget.targetAuthor}님에게 답글 작성
                            </span>
                          </div>
                          <textarea
                            ref={replyTextareaRef}
                            rows={2}
                            value={replyText}
                            onChange={(e) =>
                              setReplyText(
                                clampCommentDraftInput(e.target.value)
                              )
                            }
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                !e.nativeEvent.isComposing
                              ) {
                                e.preventDefault();
                                submitReplyNow();
                              } else if (e.key === "Escape") {
                                setReplyTarget(null);
                                setReplyText("");
                              }
                            }}
                            placeholder="(Enter : 등록 / Shift+Enter : 줄바꿈)"
                            className="block min-h-[54px] max-h-[150px] w-full resize-none overflow-y-auto bg-transparent px-3 py-2 text-xs leading-relaxed text-[#E4E6E1] placeholder:text-[#8F9691] focus:outline-none"
                          />
                          <div className="flex items-center justify-between gap-2 border-t border-[#282D2A]/70 bg-[#1A1D1B]/60 px-3 py-1.5">
                            <span className="font-mono text-[10px] text-[#8F9691] tabular-nums">
                              {replyText.length}/{COMMENT_MAX_LENGTH}자 ·{" "}
                              {countLines(replyText)}/{COMMENT_MAX_LINES}줄
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyTarget(null);
                                  setReplyText("");
                                }}
                                className="rounded border border-[#282D2A] bg-[#151816] px-2.5 py-1 text-[11px] font-medium text-[#8F9691] transition-colors hover:text-[#E4E6E1]"
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                disabled={!replyText.trim()}
                                onClick={submitReplyNow}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded border px-3 py-1 text-[11px] font-bold whitespace-nowrap transition-colors",
                                  replyText.trim()
                                    ? "border-[#6B9080] bg-[#6B9080] text-[#121413] hover:bg-[#7CA291]"
                                    : "cursor-not-allowed border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] opacity-60"
                                )}
                              >
                                <Send className="size-3" />
                                <span>등록</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 원댓글 입력 폼 (통합 입력 박스: 상단 가로 100% 입력창 + 하단 카운터 & 우측 컴팩트 [등록] 버튼) */}
            <form
              onSubmit={handleCommentSubmit}
              className="overflow-hidden rounded-lg border border-[#282D2A] bg-[#151816] transition-colors focus-within:border-[#6B9080]"
            >
              <textarea
                ref={commentTextareaRef}
                rows={2}
                value={commentText}
                onFocus={() => {
                  if (!session) {
                    openAuthModal("댓글은 로그인 후 작성할 수 있습니다.");
                  }
                }}
                onChange={(e) =>
                  setCommentText(clampCommentDraftInput(e.target.value))
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    submitCommentNow();
                  }
                }}
                placeholder="(Enter : 등록 / Shift+Enter : 줄바꿈)"
                className="block min-h-[60px] max-h-[150px] w-full resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-xs leading-relaxed text-[#E4E6E1] placeholder:text-[#8F9691] focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2 border-t border-[#282D2A]/80 bg-[#1A1D1B]/60 px-3 py-2">
                <span className="font-mono text-[11px] text-[#8F9691] tabular-nums">
                  {commentText.length}/{COMMENT_MAX_LENGTH}자 ·{" "}
                  {countLines(commentText)}/{COMMENT_MAX_LINES}줄
                </span>
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3.5 py-1 text-xs font-bold whitespace-nowrap transition-colors",
                    commentText.trim()
                      ? "border-[#6B9080] bg-[#6B9080] text-[#121413] hover:bg-[#7CA291]"
                      : "cursor-not-allowed border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] opacity-60"
                  )}
                >
                  <Send className="size-3" />
                  <span>등록</span>
                </button>
              </div>
            </form>
          </section>
        </div>

      {/* 삭제 확인(Confirm) 다크 매트 다이얼로그 모달 */}
      {confirmDeleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-sm rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#E06C75]/40 bg-[#222623] text-[#E06C75]">
                <AlertTriangle className="size-4" />
              </div>
              <h3
                id="confirm-delete-title"
                className="text-sm font-bold text-[#E4E6E1]"
              >
                {confirmDeleteTarget.kind === "post"
                  ? "게시글 삭제"
                  : confirmDeleteTarget.isReply
                    ? "답글 삭제"
                    : "댓글 삭제"}
              </h3>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-[#8F9691]">
              삭제한 내용은 복구할 수 없습니다.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteTarget(null)}
                className="rounded-lg border border-[#282D2A] bg-[#151816] px-3.5 py-1.5 text-xs font-semibold text-[#8F9691] transition-colors hover:text-[#E4E6E1]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmDeleteTarget.kind === "post") {
                    const targetPostId = confirmDeleteTarget.postId;
                    setConfirmDeleteTarget(null);
                    onDeletePost(targetPostId);
                  } else {
                    const targetCommentId = confirmDeleteTarget.commentId;
                    setConfirmDeleteTarget(null);
                    onDeleteComment(targetCommentId);
                  }
                }}
                className="rounded-lg border border-[#E06C75] bg-[#E06C75] px-3.5 py-1.5 text-xs font-bold text-[#121413] transition-colors hover:opacity-90"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 게시글 내 장비 스펙 인플레이스 모달 팝업 (ESC / 닫기 X / 바깥 클릭으로 닫힘 · 페이지 이탈 없음) */}
      <SpecDetailModal
        key={previewDeviceId ?? "spec-closed"}
        switchSpec={previewSwitchSpec}
        mouseSpec={previewMouseSpec}
        switchCommunity={previewSwitchCommunity}
        mouseCommunity={previewMouseCommunity}
        existingVote={previewExistingVote}
        onSubmitVote={(vote) => saveStoredVote(vote)}
        onDeleteVote={(deviceId) => deleteStoredVote(deviceId)}
        onClose={() => setPreviewDeviceSlug(null)}
      />

      {/* 게시글/댓글/답글 신고 모달 */}
      <ReportModal
        key={
          reportTarget
            ? `${reportTarget.targetType}:${reportTarget.targetId}`
            : "report-closed"
        }
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </article>
  );
}

function VsPollDetailWidget({
  postId,
  vsMeta,
  userVsChoice,
  onVote,
  onPreviewDevice,
}: {
  postId: string;
  vsMeta: NonNullable<CommunityPost["vsMeta"]>;
  userVsChoice: "A" | "B" | undefined;
  onVote: (choice: "A" | "B") => void;
  onPreviewDevice: (slug: string) => void;
}) {
  const total = Math.max(1, vsMeta.optionAVotes + vsMeta.optionBVotes);
  const aPct = Math.round((vsMeta.optionAVotes / total) * 100);
  const bPct = 100 - aPct;

  const resolveDeviceLink = (slug: string) => {
    const sw = INITIAL_SWITCHES.find((item) => item.slug === slug);
    if (sw) {
      return {
        tab: "switches" as const,
        slug: sw.slug,
      };
    }
    const ms = INITIAL_MICE.find((item) => item.slug === slug);
    if (ms) {
      return {
        tab: "mice" as const,
        slug: ms.slug,
      };
    }
    return null;
  };

  const linkA = resolveDeviceLink(vsMeta.optionASlug);
  const linkB = resolveDeviceLink(vsMeta.optionBSlug);

  return (
    <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-4">
      <div className="mb-3 flex items-center border-b border-[#282D2A] pb-2">
        <span className="text-xs font-bold text-[#D4A373]">
          투표
        </span>
      </div>

      {/* 양자택일 투표 버튼 그리드 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 후보 A (#6B9080 포레스트 세이지) */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-lg border p-3.5 transition-colors",
            userVsChoice === "A"
              ? "border-[#6B9080] bg-[#222623]"
              : "border-[#282D2A] bg-[#1A1D1B]"
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold text-[#6B9080]">
                OPTION A
              </span>
              {linkA && (
                <button
                  type="button"
                  onClick={() => onPreviewDevice(linkA.slug)}
                  className="inline-flex items-center gap-0.5 text-[11px] text-[#8F9691] transition-colors hover:text-[#6B9080]"
                >
                  <span>스펙</span>
                  <ArrowUpRight className="size-3" />
                </button>
              )}
            </div>
            <h4 className="mt-1 text-sm font-bold text-[#E4E6E1]">
              {vsMeta.optionAName}
            </h4>
          </div>

          <button
            type="button"
            data-post-id={postId}
            onClick={() => onVote("A")}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-colors",
              userVsChoice === "A"
                ? "border-[#6B9080] bg-[#6B9080] text-[#121413]"
                : "border-[#6B9080]/50 bg-[#151816] text-[#6B9080] hover:bg-[#6B9080] hover:text-[#121413]"
            )}
          >
            {userVsChoice === "A" && <CheckCircle2 className="size-3.5" />}
            <span>{userVsChoice === "A" ? "선택됨" : "선택"}</span>
          </button>
        </div>

        {/* 후보 B (#D4A373 우드 샌드) */}
        <div
          className={cn(
            "flex flex-col justify-between rounded-lg border p-3.5 transition-colors",
            userVsChoice === "B"
              ? "border-[#D4A373] bg-[#222623]"
              : "border-[#282D2A] bg-[#1A1D1B]"
          )}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-bold text-[#D4A373]">
                OPTION B
              </span>
              {linkB && (
                <button
                  type="button"
                  onClick={() => onPreviewDevice(linkB.slug)}
                  className="inline-flex items-center gap-0.5 text-[11px] text-[#8F9691] transition-colors hover:text-[#D4A373]"
                >
                  <span>스펙</span>
                  <ArrowUpRight className="size-3" />
                </button>
              )}
            </div>
            <h4 className="mt-1 text-sm font-bold text-[#E4E6E1]">
              {vsMeta.optionBName}
            </h4>
          </div>

          <button
            type="button"
            data-post-id={postId}
            onClick={() => onVote("B")}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-colors",
              userVsChoice === "B"
                ? "border-[#D4A373] bg-[#D4A373] text-[#121413]"
                : "border-[#D4A373]/50 bg-[#151816] text-[#D4A373] hover:bg-[#D4A373] hover:text-[#121413]"
            )}
          >
            {userVsChoice === "B" && <CheckCircle2 className="size-3.5" />}
            <span>{userVsChoice === "B" ? "선택됨" : "선택"}</span>
          </button>
        </div>
      </div>

      {/* 실시간 양자택일 투표 바 (#6B9080 vs #D4A373) */}
      <div className="mt-3.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] p-3">
        <div className="mb-1.5 flex items-center justify-between font-mono text-xs font-bold tabular-nums">
          <span className="text-[#6B9080]">
            A: {aPct}% ({vsMeta.optionAVotes}표)
          </span>
          <span className="text-[#D4A373]">
            B: {bPct}% ({vsMeta.optionBVotes}표)
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#282D2A]">
          <div
            className="h-full bg-[#6B9080] transition-all duration-200"
            style={{ width: `${aPct}%` }}
          />
          <div className="h-full w-[2px] shrink-0 bg-[#121413]" />
          <div
            className="h-full flex-1 bg-[#D4A373] transition-all duration-200"
            style={{ width: `${bPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
