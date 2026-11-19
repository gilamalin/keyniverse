"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Coins,
  FileText,
  LogIn,
  MessageSquare,
  Pencil,
  Star,
  User,
  X,
} from "lucide-react";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import { COMMUNITY_CATEGORY_SHORT_LABELS } from "@/types/community";
import {
  NICKNAME_MAX_LENGTH,
  getAuthStoreVersion,
  getServerAuthStoreVersion,
  openAuthModal,
  readGoogleSession,
  subscribeAuthStore,
  updateSessionNickname,
  withdrawAccountMock,
} from "@/lib/auth-store";
import {
  computeEffectiveCommunityPosts,
  getCommunityStoreVersion,
  getServerCommunityStoreVersion,
  subscribeCommunityStore,
} from "@/lib/community-store";
import {
  StoredVerifiedVote,
  getServerVoteStoreVersion,
  getVoteStoreVersion,
  readStoredVote,
  subscribeVoteStore,
} from "@/lib/spec-verification";
import {
  getActivityStoreVersion,
  getServerActivityStoreVersion,
  readPointLogs,
  readTotalPoints,
  subscribeActivityStore,
} from "@/lib/activity-store";
import { cn } from "@/lib/utils";

type MyPageTab = "posts" | "comments" | "votes" | "points";

export function MyPageClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MyPageTab>("posts");
  const [editingNickname, setEditingNickname] = useState<boolean>(false);
  const [nicknameDraft, setNicknameDraft] = useState<string>("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);

  const authVersion = useSyncExternalStore(
    subscribeAuthStore,
    getAuthStoreVersion,
    getServerAuthStoreVersion
  );
  const communityVersion = useSyncExternalStore(
    subscribeCommunityStore,
    getCommunityStoreVersion,
    getServerCommunityStoreVersion
  );
  const voteVersion = useSyncExternalStore(
    subscribeVoteStore,
    getVoteStoreVersion,
    getServerVoteStoreVersion
  );
  const activityVersion = useSyncExternalStore(
    subscribeActivityStore,
    getActivityStoreVersion,
    getServerActivityStoreVersion
  );

  const session = authVersion > 0 ? readGoogleSession() : null;

  const { myPosts, myComments } = useMemo(() => {
    if (!session) return { myPosts: [], myComments: [] };
    const { posts } = computeEffectiveCommunityPosts(
      communityVersion > 0 || authVersion > 0,
      session.nickname
    );
    const authoredPosts = posts
      .filter((p) => p.isMyPost || p.author === session.nickname)
      .sort((a, b) => b.sortTimestamp - a.sortTimestamp);

    const authoredComments: Array<{
      id: string;
      postId: string;
      postTitle: string;
      content: string;
      createdAt: string;
      isReply: boolean;
    }> = [];

    for (const post of posts) {
      for (const cmt of post.comments) {
        if (cmt.isMyComment || cmt.author === session.nickname) {
          authoredComments.push({
            id: cmt.id,
            postId: post.id,
            postTitle: post.title,
            content: cmt.content,
            createdAt: cmt.createdAt,
            isReply: Boolean(cmt.parentId),
          });
        }
      }
    }

    return { myPosts: authoredPosts, myComments: authoredComments };
  }, [session, communityVersion, authVersion]);

  const myVotes = useMemo(() => {
    if (!session || voteVersion === 0) return [];
    const list: Array<{
      vote: StoredVerifiedVote;
      name: string;
      brand: string;
      href: string;
    }> = [];

    for (const sw of INITIAL_SWITCHES) {
      const vote = readStoredVote(sw.id);
      if (vote) {
        list.push({
          vote,
          name: sw.name,
          brand: sw.brand,
          href: `/specs?tab=switches&open=${encodeURIComponent(sw.slug)}`,
        });
      }
    }
    for (const ms of INITIAL_MICE) {
      const vote = readStoredVote(ms.id);
      if (vote) {
        list.push({
          vote,
          name: ms.name,
          brand: ms.brand,
          href: `/specs?tab=mice&open=${encodeURIComponent(ms.slug)}`,
        });
      }
    }

    return list.sort((a, b) =>
      b.vote.updatedAt.localeCompare(a.vote.updatedAt)
    );
  }, [session, voteVersion]);

  const { totalPoints, pointLogs } = useMemo(() => {
    if (!session || activityVersion === 0) {
      return { totalPoints: 0, pointLogs: [] };
    }
    return {
      totalPoints: readTotalPoints(),
      pointLogs: readPointLogs(),
    };
  }, [session, activityVersion]);

  const handleStartEditNickname = () => {
    if (!session) return;
    setNicknameDraft(session.nickname);
    setNicknameError(null);
    setEditingNickname(true);
  };

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    const res = updateSessionNickname(nicknameDraft);
    if (!res.valid) {
      setNicknameError(res.error);
      return;
    }
    setNicknameError(null);
    setEditingNickname(false);
  };

  const handleConfirmWithdraw = () => {
    withdrawAccountMock();
    setWithdrawModalOpen(false);
    router.push("/");
  };

  if (!session) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-[#282D2A] bg-[#1A1D1B] p-8 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl border border-[#282D2A] bg-[#222623] text-[#6B9080]">
            <User className="size-5" />
          </div>
          <h1 className="text-base font-bold text-[#E4E6E1]">
            로그인이 필요합니다
          </h1>
          <p className="mt-1 text-xs text-[#8F9691]">
            마이페이지는 로그인 후 이용할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#6B9080] px-4 py-2 text-xs font-bold text-[#121413] transition-colors hover:bg-[#7CA291]"
          >
            <LogIn className="size-3.5" />
            <span>로그인</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* 1. 상단 페이지 헤더 */}
      <div className="border-b border-[#282D2A] pb-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
            <User className="size-3.5" />
            MY PAGE
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#E4E6E1] sm:text-3xl">
          마이페이지
        </h1>
        <p className="mt-1 text-sm text-[#8F9691]">내 정보 · 활동 내역 관리</p>
      </div>

      {/* 2. 프로필 요약 카드 */}
      <section className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3.5 min-[460px]:flex-row min-[460px]:items-center">
          <div className="min-w-0 flex-1">
            {editingNickname ? (
              <form
                onSubmit={handleSaveNickname}
                className="flex flex-col gap-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    maxLength={NICKNAME_MAX_LENGTH}
                    value={nicknameDraft}
                    onChange={(e) => {
                      setNicknameDraft(
                        e.target.value
                          .replace(/\s+/g, "")
                          .slice(0, NICKNAME_MAX_LENGTH)
                      );
                      if (nicknameError) setNicknameError(null);
                    }}
                    placeholder="2~6자 입력"
                    className="h-8 w-36 rounded-lg border border-[#6B9080] bg-[#151816] px-2.5 text-xs font-semibold text-[#E4E6E1] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#6B9080] bg-[#6B9080] px-3 text-xs font-bold text-[#121413] transition-colors hover:bg-[#7CA291]"
                  >
                    <Check className="size-3.5" />
                    <span>저장</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNickname(false);
                      setNicknameError(null);
                    }}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-[#282D2A] bg-[#151816] px-2.5 text-xs text-[#8F9691] transition-colors hover:text-[#E4E6E1]"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {nicknameError && (
                  <p className="text-[11px] font-medium text-[#E06C75]">
                    {nicknameError}
                  </p>
                )}
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[#E4E6E1]">
                  {session.nickname}
                </h2>
                <button
                  type="button"
                  onClick={handleStartEditNickname}
                  className="inline-flex items-center gap-1 rounded-md border border-[#282D2A] bg-[#151816] px-2 py-0.5 text-[11px] font-medium text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
                >
                  <Pencil className="size-3" />
                  <span>닉네임 변경</span>
                </button>
              </div>
            )}
            <p className="mt-1 font-mono text-xs text-[#8F9691]">
              {session.email}
            </p>
          </div>

          {/* 활동 포인트 배지 */}
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-[#282D2A] bg-[#151816] px-4 py-2.5 min-[460px]:justify-end">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#8F9691]">
              <Coins className="size-4 text-[#D4A373]" />
              <span>포인트</span>
            </span>
            <span className="font-mono text-base font-bold text-[#D4A373] tabular-nums">
              {totalPoints.toLocaleString()} P
            </span>
          </div>
        </div>

        {/* 요약 3칸 타일 */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 border-t border-[#282D2A] pt-4">
          <button
            type="button"
            onClick={() => setActiveTab("posts")}
            className={cn(
              "flex flex-col items-center rounded-lg border px-3 py-2.5 transition-colors",
              activeTab === "posts"
                ? "border-[#6B9080] bg-[#222623]"
                : "border-[#282D2A] bg-[#151816] hover:border-[#6B9080]/50"
            )}
          >
            <span className="text-[11px] text-[#8F9691]">작성 글</span>
            <span className="mt-0.5 font-mono text-base font-bold text-[#E4E6E1] tabular-nums">
              {myPosts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={cn(
              "flex flex-col items-center rounded-lg border px-3 py-2.5 transition-colors",
              activeTab === "comments"
                ? "border-[#6B9080] bg-[#222623]"
                : "border-[#282D2A] bg-[#151816] hover:border-[#6B9080]/50"
            )}
          >
            <span className="text-[11px] text-[#8F9691]">작성 댓글</span>
            <span className="mt-0.5 font-mono text-base font-bold text-[#E4E6E1] tabular-nums">
              {myComments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("votes")}
            className={cn(
              "flex flex-col items-center rounded-lg border px-3 py-2.5 transition-colors",
              activeTab === "votes"
                ? "border-[#6B9080] bg-[#222623]"
                : "border-[#282D2A] bg-[#151816] hover:border-[#6B9080]/50"
            )}
          >
            <span className="text-[11px] text-[#8F9691]">스펙 평가</span>
            <span className="mt-0.5 font-mono text-base font-bold text-[#E4E6E1] tabular-nums">
              {myVotes.length}
            </span>
          </button>
        </div>
      </section>

      {/* 3. 활동 내역 탭 & 리스트 */}
      <section className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4 sm:p-5">
        <div className="mb-4 flex flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-[#282D2A] pb-3">
          {(
            [
              { id: "posts", label: "작성 글", icon: FileText },
              { id: "comments", label: "작성 댓글", icon: MessageSquare },
              { id: "votes", label: "스펙 평가", icon: Star },
              { id: "points", label: "포인트 내역", icon: Coins },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                <Icon className="size-3.5 text-[#6B9080]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 탭 1: 작성 글 */}
        {activeTab === "posts" &&
          (myPosts.length === 0 ? (
            <EmptyActivityBox message="작성한 게시글이 없습니다." />
          ) : (
            <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
              {myPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/?post=${encodeURIComponent(post.id)}`}
                  className="group flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors hover:bg-[#222623]"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 font-mono text-[11px] text-[#6B9080]">
                      [{COMMUNITY_CATEGORY_SHORT_LABELS[post.category]}]
                    </span>
                    <span className="truncate font-medium text-[#E4E6E1] group-hover:text-[#6B9080]">
                      {post.title}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5 font-mono text-[11px] text-[#8F9691] tabular-nums">
                    <span>{post.createdAt}</span>
                    <span className="text-[#D4A373]">추천 {post.upvotes}</span>
                  </div>
                </Link>
              ))}
            </div>
          ))}

        {/* 탭 2: 작성 댓글 */}
        {activeTab === "comments" &&
          (myComments.length === 0 ? (
            <EmptyActivityBox message="작성한 댓글이 없습니다." />
          ) : (
            <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
              {myComments.map((cmt) => (
                <Link
                  key={cmt.id}
                  href={`/?post=${encodeURIComponent(cmt.postId)}`}
                  className="group flex flex-col gap-1 px-3.5 py-2.5 text-xs transition-colors hover:bg-[#222623]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-[#E4E6E1] group-hover:text-[#6B9080]">
                      {cmt.content}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-[#8F9691] tabular-nums">
                      {cmt.createdAt}
                    </span>
                  </div>
                  <span className="truncate text-[11px] text-[#8F9691]">
                    {cmt.isReply ? "답글" : "댓글"} · {cmt.postTitle}
                  </span>
                </Link>
              ))}
            </div>
          ))}

        {/* 탭 3: 스펙 평가 */}
        {activeTab === "votes" &&
          (myVotes.length === 0 ? (
            <EmptyActivityBox message="남긴 스펙 평가가 없습니다." />
          ) : (
            <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
              {myVotes.map(({ vote, name, brand, href }) => (
                <Link
                  key={vote.deviceId}
                  href={href}
                  className="group flex flex-col justify-between gap-2 px-3.5 py-2.5 text-xs transition-colors hover:bg-[#222623] sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-[#6B9080]">
                        {brand}
                      </span>
                      <span className="truncate font-semibold text-[#E4E6E1] group-hover:text-[#6B9080]">
                        {name}
                      </span>
                    </div>
                    {vote.oneLineReview && (
                      <p className="mt-0.5 truncate text-[11px] text-[#8F9691]">
                        {vote.oneLineReview}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-2.5 font-mono text-[11px] tabular-nums">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#D4A373]">
                      <Star className="size-3 fill-[#D4A373] text-[#D4A373]" />
                      {vote.rating}.0
                    </span>
                    <span className="text-[#8F9691]">{vote.updatedAt}</span>
                    <ArrowUpRight className="size-3.5 text-[#8F9691] group-hover:text-[#6B9080]" />
                  </div>
                </Link>
              ))}
            </div>
          ))}

        {/* 탭 4: 포인트 내역 (양수 적립 + 음수 소모 모두 지원) */}
        {activeTab === "points" &&
          (pointLogs.length === 0 ? (
            <EmptyActivityBox message="포인트 내역이 없습니다." />
          ) : (
            <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
              {pointLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="truncate font-medium text-[#E4E6E1]">
                      {log.reason}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 font-mono tabular-nums">
                    <span
                      className={cn(
                        "font-bold",
                        log.delta > 0 ? "text-[#6B9080]" : "text-[#E06C75]"
                      )}
                    >
                      {log.delta > 0 ? `+${log.delta}` : log.delta} P
                    </span>
                    <span className="text-[11px] text-[#8F9691]">
                      {log.createdAt}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </section>

      {/* 4. 하단 계정 관리 (회원 탈퇴) */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setWithdrawModalOpen(true)}
          className="rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-1.5 text-xs font-medium text-[#8F9691] transition-colors hover:border-[#E06C75] hover:text-[#E06C75]"
        >
          회원 탈퇴
        </button>
      </div>

      {/* 회원 탈퇴 확인 모달 */}
      {withdrawModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="회원 탈퇴"
          onClick={() => setWithdrawModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-5"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#E06C75]/40 bg-[#222623] text-[#E06C75]">
                <AlertTriangle className="size-4" />
              </div>
              <h3 className="text-sm font-bold text-[#E4E6E1]">회원 탈퇴</h3>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-[#8F9691]">
              탈퇴 시 계정 정보와 활동 내역이 삭제되며 복구할 수 없습니다.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setWithdrawModalOpen(false)}
                className="rounded-lg border border-[#282D2A] bg-[#151816] px-3.5 py-1.5 text-xs font-semibold text-[#8F9691] transition-colors hover:text-[#E4E6E1]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdraw}
                className="rounded-lg border border-[#E06C75] bg-[#E06C75] px-4 py-1.5 text-xs font-bold text-[#121413] transition-colors hover:opacity-90"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyActivityBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#282D2A] bg-[#151816] px-4 py-8 text-center text-xs text-[#8F9691]">
      {message}
    </div>
  );
}
