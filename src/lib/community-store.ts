import { INITIAL_COMMUNITY_POSTS } from "@/data/community-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  CommunityCategory,
  CommunityComment,
  CommunityPost,
} from "@/types/community";

/** 댓글·답글 및 게시글 외형 테러 방지 상수 규격 */
export const COMMENT_MAX_LENGTH = 500;
export const COMMENT_MAX_LINES = 15;
export const COMMENT_CLAMP_LINES = 5;
export const POST_TITLE_MAX_LENGTH = 80;
export const POST_HTML_MAX_LENGTH = 65535;
export const POST_MAX_LINES = 200;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function createEntityId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function measurePostHtmlLength(rawHtml: string): number {
  const trimmed = rawHtml.trim();
  if (!trimmed) return 0;
  const normalizedForCount = trimmed.replace(
    /src="data:image\/[^"]*"/gi,
    'src="https://cdn.keyniverse.kr/uploads/post-image.webp"'
  );
  return normalizedForCount.length;
}

export function countPostLines(rawText: string): number {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return 1;
  return normalized.split("\n").length;
}

export function clampCommentDraftInput(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const lineClamped =
    lines.length > COMMENT_MAX_LINES
      ? lines.slice(0, COMMENT_MAX_LINES).join("\n")
      : normalized;
  return lineClamped.slice(0, COMMENT_MAX_LENGTH);
}

export function sanitizeCommentContent(raw: string): string {
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
  const lines = normalized.split("\n").slice(0, COMMENT_MAX_LINES);
  return lines.join("\n").slice(0, COMMENT_MAX_LENGTH).trim();
}

export function sanitizePostTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, POST_TITLE_MAX_LENGTH);
}

export function sanitizePostContent(raw: string): string {
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
  const lines = normalized.split("\n").slice(0, POST_MAX_LINES);
  return lines.join("\n").slice(0, POST_HTML_MAX_LENGTH);
}

export function sanitizePostHtmlContent(rawHtml: string): string {
  return rawHtml
    .trim()
    .replace(
      /(?:<div>\s*<br\s*\/?>\s*<\/div>\s*){3,}/gi,
      "<div><br></div><div><br></div>"
    )
    .replace(/(?:<p>\s*<br\s*\/?>\s*<\/p>\s*){3,}/gi, "<p><br></p><p><br></p>")
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>");
}

interface PersistedCommunityState {
  customPosts: CommunityPost[];
  editedPosts: Record<string, Partial<CommunityPost>>;
  deletedPostIds: string[];
  upvotedPostIds: string[];
  vsChoices: Record<string, "A" | "B">;
  dealStatusOverrides: Record<string, "active" | "ended">;
  addedComments: Record<string, CommunityComment[]>;
  editedComments: Record<string, string>;
  deletedCommentIds: string[];
  extraViews: Record<string, number>;
}

const COMMUNITY_STORAGE_KEY = "keyniverse_community_state_v1";

const DEFAULT_PERSISTED_STATE: PersistedCommunityState = {
  customPosts: [],
  editedPosts: {},
  deletedPostIds: [],
  upvotedPostIds: [],
  vsChoices: {},
  dealStatusOverrides: {},
  addedComments: {},
  editedComments: {},
  deletedCommentIds: [],
  extraViews: {},
};

let communityStoreVersion = 1;
const communityListeners = new Set<() => void>();

// Supabase 실시간 캐시
let liveSupabasePosts: CommunityPost[] = [];
let liveSupabaseUpvotedIds = new Set<string>();
let liveSupabaseVsChoices: Record<string, "A" | "B"> = {};
let liveCommunityUserId: string | null = null;
let hasSyncedCommunityFromSupabase = false;

export function isCommunitySynced(): boolean {
  return !isSupabaseConfigured() || hasSyncedCommunityFromSupabase;
}

function notifyCommunityListeners(): void {
  communityStoreVersion += 1;
  for (const listener of communityListeners) {
    listener();
  }
}

export function subscribeCommunityStore(listener: () => void): () => void {
  communityListeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (!e.key || e.key === COMMUNITY_STORAGE_KEY) {
      notifyCommunityListeners();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    communityListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function getCommunityStoreVersion(): number {
  return communityStoreVersion;
}

export function getServerCommunityStoreVersion(): number {
  return 0;
}

function formatDbTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

/**
 * Supabase `posts`, `comments`, `post_upvotes`, `vs_votes` 실시간 동기화
 */
export async function syncCommunityFromSupabase(
  userId?: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  if (userId !== undefined) {
    liveCommunityUserId = userId;
  } else if (!liveCommunityUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    liveCommunityUserId = user?.id ?? null;
  }

  const [{ data: postRows }, { data: commentRows }, { data: vsRows }] =
    await Promise.all([
      supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("comments")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500),
      supabase.from("vs_votes").select("post_id, user_id, choice"),
    ]);

  let myUpvoted = new Set<string>();
  const myVs: Record<string, "A" | "B"> = {};

  if (liveCommunityUserId) {
    const { data: upvoteRows } = await supabase
      .from("post_upvotes")
      .select("post_id")
      .eq("user_id", liveCommunityUserId);
    if (Array.isArray(upvoteRows)) {
      myUpvoted = new Set(upvoteRows.map((r) => String(r.post_id)));
    }
  }

  // VS 투표 집계 (전체 유저 표 합산 + 본인 선택 기록)
  const vsTallies = new Map<string, { a: number; b: number }>();
  if (Array.isArray(vsRows)) {
    for (const row of vsRows) {
      const pid = String(row.post_id);
      const cur = vsTallies.get(pid) ?? { a: 0, b: 0 };
      if (row.choice === "A") cur.a += 1;
      else if (row.choice === "B") cur.b += 1;
      vsTallies.set(pid, cur);

      if (liveCommunityUserId && row.user_id === liveCommunityUserId) {
        myVs[pid] = row.choice === "A" ? "A" : "B";
      }
    }
  }

  // 댓글 매핑
  const commentsByPost = new Map<string, CommunityComment[]>();
  if (Array.isArray(commentRows)) {
    for (const row of commentRows) {
      const pid = String(row.post_id);
      const list = commentsByPost.get(pid) ?? [];
      list.push({
        id: String(row.id),
        author: String(row.author_nickname),
        authorVerified: Boolean(row.author_verified),
        content: String(row.content),
        createdAt: formatDbTimestamp(String(row.created_at)),
        isMyComment: Boolean(
          liveCommunityUserId && row.author_id === liveCommunityUserId
        ),
        isEdited: Boolean(row.is_edited),
        parentId: row.parent_id ? String(row.parent_id) : undefined,
        replyToAuthor: row.reply_to_author
          ? String(row.reply_to_author)
          : undefined,
      });
      commentsByPost.set(pid, list);
    }
  }

  if (Array.isArray(postRows)) {
    liveSupabasePosts = postRows.map((row) => {
      const pid = String(row.id);
      const createdIso = String(row.created_at);
      const rawVsMeta = row.vs_meta as CommunityPost["vsMeta"] | null;
      const tally = vsTallies.get(pid);

      return {
        id: pid,
        category: row.category as CommunityCategory,
        noticeScope: row.notice_scope ?? undefined,
        title: String(row.title),
        content: String(row.content),
        contentHtml: row.content_html ? String(row.content_html) : undefined,
        author: String(row.author_nickname),
        authorVerified: Boolean(row.author_verified),
        upvotes: Number(row.upvotes ?? 0),
        views: Number(row.views ?? 1),
        createdAt: formatDbTimestamp(createdIso),
        sortTimestamp: new Date(createdIso).getTime() || Date.now(),
        taggedDeviceSlugs: Array.isArray(row.tagged_device_slugs)
          ? (row.tagged_device_slugs as string[])
          : [],
        buildMeta: (row.build_meta as CommunityPost["buildMeta"]) ?? undefined,
        vsMeta: rawVsMeta
          ? {
              ...rawVsMeta,
              optionAVotes: tally?.a ?? rawVsMeta.optionAVotes ?? 0,
              optionBVotes: tally?.b ?? rawVsMeta.optionBVotes ?? 0,
            }
          : undefined,
        dealMeta: (row.deal_meta as CommunityPost["dealMeta"]) ?? undefined,
        comments: commentsByPost.get(pid) ?? [],
        isMyPost: Boolean(
          liveCommunityUserId && row.author_id === liveCommunityUserId
        ),
        isEdited: Boolean(row.is_edited),
      };
    });
  }

  liveSupabaseUpvotedIds = myUpvoted;
  liveSupabaseVsChoices = myVs;
  hasSyncedCommunityFromSupabase = true;
  notifyCommunityListeners();
}

export function readPersistedCommunityState(): PersistedCommunityState {
  if (typeof window === "undefined") return DEFAULT_PERSISTED_STATE;
  try {
    const raw = window.localStorage.getItem(COMMUNITY_STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedCommunityState>;
    return {
      customPosts: Array.isArray(parsed.customPosts) ? parsed.customPosts : [],
      editedPosts: parsed.editedPosts ?? {},
      deletedPostIds: Array.isArray(parsed.deletedPostIds)
        ? parsed.deletedPostIds
        : [],
      upvotedPostIds: Array.isArray(parsed.upvotedPostIds)
        ? parsed.upvotedPostIds
        : [],
      vsChoices: parsed.vsChoices ?? {},
      dealStatusOverrides: parsed.dealStatusOverrides ?? {},
      addedComments: parsed.addedComments ?? {},
      editedComments: parsed.editedComments ?? {},
      deletedCommentIds: Array.isArray(parsed.deletedCommentIds)
        ? parsed.deletedCommentIds
        : [],
      extraViews: parsed.extraViews ?? {},
    };
  } catch {
    return DEFAULT_PERSISTED_STATE;
  }
}

function writePersistedCommunityState(next: PersistedCommunityState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(next));
    notifyCommunityListeners();
  } catch {
    // Ignore storage quota errors
  }
}

function getBaseViewCount(post: CommunityPost): number {
  if (typeof post.views === "number") return post.views;
  return post.upvotes * 9 + post.comments.length * 14 + 42;
}

/**
 * Supabase 실시간 게시글 + 초기 공지/쇼케이스 게시글 + 로컬 상태를 통합 병합
 */
export function computeEffectiveCommunityPosts(
  isClientReady: boolean,
  currentNickname: string | null
): {
  posts: CommunityPost[];
  upvotedPostIds: Set<string>;
  vsChoices: Record<string, "A" | "B">;
} {
  if (!isClientReady) {
    return {
      posts: isSupabaseConfigured()
        ? []
        : INITIAL_COMMUNITY_POSTS.map((p) => ({
            ...p,
            views: getBaseViewCount(p),
          })),
      upvotedPostIds: new Set<string>(),
      vsChoices: {},
    };
  }

  const state = readPersistedCommunityState();
  const deletedPostSet = new Set(state.deletedPostIds);
  const deletedCommentSet = new Set(state.deletedCommentIds);

  const upvotedSet = new Set<string>([
    ...state.upvotedPostIds,
    ...liveSupabaseUpvotedIds,
  ]);
  const combinedVsChoices: Record<string, "A" | "B"> = {
    ...state.vsChoices,
    ...liveSupabaseVsChoices,
  };

  // Supabase 연동 시 실제 DB 게시글만 표시 (더미 게시글 제거)
  const dbPostIds = new Set(liveSupabasePosts.map((p) => p.id));
  const rawAll = isSupabaseConfigured()
    ? [...liveSupabasePosts].filter((p) => !deletedPostSet.has(p.id))
    : [...state.customPosts, ...INITIAL_COMMUNITY_POSTS].filter(
        (p) => !deletedPostSet.has(p.id)
      );

  const merged = rawAll.map((rawPost) => {
    const isDbPost = dbPostIds.has(rawPost.id);
    const postPatch = !isDbPost ? state.editedPosts[rawPost.id] : undefined;
    const post: CommunityPost = postPatch
      ? { ...rawPost, ...postPatch, isEdited: true }
      : rawPost;

    const isUpvoted = upvotedSet.has(post.id);
    const userVsChoice = combinedVsChoices[post.id];
    const dealOverride = !isDbPost
      ? state.dealStatusOverrides[post.id]
      : undefined;
    const extraComments = !isDbPost ? (state.addedComments[post.id] ?? []) : [];
    const extraView = !isDbPost ? (state.extraViews[post.id] ?? 0) : 0;

    const mergedComments = [...post.comments, ...extraComments]
      .filter((c) => !deletedCommentSet.has(c.id))
      .map((c) => {
        const editedText = !isDbPost ? state.editedComments[c.id] : undefined;
        return {
          ...c,
          content: editedText !== undefined ? editedText : c.content,
          isEdited: Boolean(c.isEdited || editedText !== undefined),
          isMyComment: Boolean(
            c.isMyComment || (currentNickname && c.author === currentNickname)
          ),
        };
      });

    // DB 게시글의 upvotes/vsMeta는 이미 서버/낙관적 캐시에 반영되어 있음
    const nextVsMeta = post.vsMeta
      ? isDbPost
        ? post.vsMeta
        : {
            ...post.vsMeta,
            optionAVotes:
              post.vsMeta.optionAVotes + (userVsChoice === "A" ? 1 : 0),
            optionBVotes:
              post.vsMeta.optionBVotes + (userVsChoice === "B" ? 1 : 0),
          }
      : undefined;

    const nextDealMeta = post.dealMeta
      ? {
          ...post.dealMeta,
          status: dealOverride ?? post.dealMeta.status,
        }
      : undefined;

    return {
      ...post,
      upvotes: isDbPost ? post.upvotes : post.upvotes + (isUpvoted ? 1 : 0),
      views: getBaseViewCount(post) + extraView,
      vsMeta: nextVsMeta,
      dealMeta: nextDealMeta,
      comments: mergedComments,
      isMyPost: Boolean(
        post.isMyPost || (currentNickname && post.author === currentNickname)
      ),
    };
  });

  return {
    posts: merged,
    upvotedPostIds: upvotedSet,
    vsChoices: combinedVsChoices,
  };
}

async function resolveCurrentUserId(): Promise<string | null> {
  if (liveCommunityUserId) return liveCommunityUserId;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  liveCommunityUserId = user?.id ?? null;
  return liveCommunityUserId;
}

const VIEWED_SESSION_STORAGE_KEY = "keyniverse_viewed_posts_session_v1";

function markPostViewedInSession(postId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(VIEWED_SESSION_STORAGE_KEY);
    const viewed = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    if (viewed.has(postId)) {
      return false;
    }
    viewed.add(postId);
    window.sessionStorage.setItem(
      VIEWED_SESSION_STORAGE_KEY,
      JSON.stringify(Array.from(viewed).slice(-200))
    );
    return true;
  } catch {
    return true;
  }
}

export function incrementPostView(postId: string): void {
  // 세션당 1회만 조회수 카운트 (F5/반복 클릭 조회수 복사 방지)
  if (!markPostViewedInSession(postId)) return;

  if (isSupabaseConfigured() && isUuid(postId)) {
    liveSupabasePosts = liveSupabasePosts.map((p) =>
      p.id === postId ? { ...p, views: (p.views ?? 1) + 1 } : p
    );
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const { error } = await supabase.rpc("increment_post_view", {
          target_post_id: postId,
        });
        if (error) {
          console.error("[KEYNIVERSE] increment_post_view failed:", error);
        }
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    extraViews: {
      ...cur.extraViews,
      [postId]: (cur.extraViews[postId] ?? 0) + 1,
    },
  });
}

export function togglePostUpvote(postId: string): void {
  if (isSupabaseConfigured() && isUuid(postId)) {
    const wasUpvoted = liveSupabaseUpvotedIds.has(postId);
    const nextSet = new Set(liveSupabaseUpvotedIds);
    if (wasUpvoted) nextSet.delete(postId);
    else nextSet.add(postId);
    liveSupabaseUpvotedIds = nextSet;

    liveSupabasePosts = liveSupabasePosts.map((p) =>
      p.id === postId
        ? { ...p, upvotes: Math.max(0, p.upvotes + (wasUpvoted ? -1 : 1)) }
        : p
    );
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const userId = await resolveCurrentUserId();
        if (!userId) return;
        if (wasUpvoted) {
          await supabase
            .from("post_upvotes")
            .delete()
            .eq("user_id", userId)
            .eq("post_id", postId);
        } else {
          await supabase
            .from("post_upvotes")
            .insert({ user_id: userId, post_id: postId });
        }
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  const exists = cur.upvotedPostIds.includes(postId);
  const nextUpvoted = exists
    ? cur.upvotedPostIds.filter((id) => id !== postId)
    : [...cur.upvotedPostIds, postId];

  writePersistedCommunityState({
    ...cur,
    upvotedPostIds: nextUpvoted,
  });
}

export function selectVsPollOption(postId: string, choice: "A" | "B"): void {
  if (isSupabaseConfigured() && isUuid(postId)) {
    const prevChoice = liveSupabaseVsChoices[postId];
    if (prevChoice === choice) return;

    liveSupabaseVsChoices = { ...liveSupabaseVsChoices, [postId]: choice };
    liveSupabasePosts = liveSupabasePosts.map((p) => {
      if (p.id !== postId || !p.vsMeta) return p;
      let a = p.vsMeta.optionAVotes;
      let b = p.vsMeta.optionBVotes;
      if (prevChoice === "A") a = Math.max(0, a - 1);
      if (prevChoice === "B") b = Math.max(0, b - 1);
      if (choice === "A") a += 1;
      else b += 1;
      return {
        ...p,
        vsMeta: { ...p.vsMeta, optionAVotes: a, optionBVotes: b },
      };
    });
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const userId = await resolveCurrentUserId();
        if (!userId) return;
        await supabase.from("vs_votes").upsert(
          {
            user_id: userId,
            post_id: postId,
            choice,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,post_id" }
        );
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    vsChoices: {
      ...cur.vsChoices,
      [postId]: choice,
    },
  });
}

export function toggleDealPostStatus(
  postId: string,
  nextStatus: "active" | "ended"
): void {
  if (isSupabaseConfigured() && isUuid(postId)) {
    let nextDealMeta: CommunityPost["dealMeta"] | undefined;
    liveSupabasePosts = liveSupabasePosts.map((p) => {
      if (p.id !== postId || !p.dealMeta) return p;
      nextDealMeta = { ...p.dealMeta, status: nextStatus };
      return { ...p, dealMeta: nextDealMeta };
    });
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase && nextDealMeta) {
      void (async () => {
        const { error } = await supabase
          .from("posts")
          .update({
            deal_meta: nextDealMeta,
            updated_at: new Date().toISOString(),
          })
          .eq("id", postId);
        if (error) {
          console.error("[KEYNIVERSE] toggleDealPostStatus failed:", error);
        }
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    dealStatusOverrides: {
      ...cur.dealStatusOverrides,
      [postId]: nextStatus,
    },
  });
}

export function addCommunityComment(
  postId: string,
  comment: CommunityComment
): void {
  const sanitizedComment: CommunityComment = {
    ...comment,
    content: sanitizeCommentContent(comment.content),
  };

  if (isSupabaseConfigured() && isUuid(postId)) {
    liveSupabasePosts = liveSupabasePosts.map((p) =>
      p.id === postId
        ? { ...p, comments: [...p.comments, sanitizedComment] }
        : p
    );
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const userId = await resolveCurrentUserId();
        if (!userId) return;
        await supabase.from("comments").insert({
          id: isUuid(sanitizedComment.id)
            ? sanitizedComment.id
            : createEntityId("cmt"),
          post_id: postId,
          parent_id:
            sanitizedComment.parentId && isUuid(sanitizedComment.parentId)
              ? sanitizedComment.parentId
              : null,
          reply_to_author: sanitizedComment.replyToAuthor ?? null,
          author_id: userId,
          author_nickname: sanitizedComment.author,
          author_verified: sanitizedComment.authorVerified,
          content: sanitizedComment.content,
        });
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  const prevList = cur.addedComments[postId] ?? [];
  writePersistedCommunityState({
    ...cur,
    addedComments: {
      ...cur.addedComments,
      [postId]: [...prevList, sanitizedComment],
    },
  });
}

export function updateCommunityComment(
  commentId: string,
  newContent: string
): void {
  const sanitized = sanitizeCommentContent(newContent);
  if (!sanitized) return;

  if (isSupabaseConfigured() && isUuid(commentId)) {
    liveSupabasePosts = liveSupabasePosts.map((p) => ({
      ...p,
      comments: p.comments.map((c) =>
        c.id === commentId ? { ...c, content: sanitized, isEdited: true } : c
      ),
    }));
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const { error } = await supabase
          .from("comments")
          .update({
            content: sanitized,
            is_edited: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", commentId);
        if (error) {
          console.error("[KEYNIVERSE] updateCommunityComment failed:", error);
        }
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    editedComments: {
      ...cur.editedComments,
      [commentId]: sanitized,
    },
  });
}

export function deleteCommunityComment(commentId: string): void {
  if (isSupabaseConfigured() && isUuid(commentId)) {
    liveSupabasePosts = liveSupabasePosts.map((p) => ({
      ...p,
      comments: p.comments.filter(
        (c) => c.id !== commentId && c.parentId !== commentId
      ),
    }));
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const { error } = await supabase
          .from("comments")
          .delete()
          .eq("id", commentId);
        if (error) {
          console.error("[KEYNIVERSE] deleteCommunityComment failed:", error);
        }
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  if (cur.deletedCommentIds.includes(commentId)) return;
  writePersistedCommunityState({
    ...cur,
    deletedCommentIds: [...cur.deletedCommentIds, commentId],
  });
}

export function createCommunityPost(newPost: CommunityPost): void {
  const normalized: CommunityPost = {
    ...newPost,
    title: sanitizePostTitle(newPost.title),
    content: sanitizePostContent(newPost.content),
    contentHtml: newPost.contentHtml
      ? sanitizePostHtmlContent(newPost.contentHtml)
      : undefined,
  };

  // 글 작성 직후 기본 조회수 1에 본인 첫 열람이 포함되므로, 같은 세션 내 재클릭 시 2로 중복 증가 방지
  markPostViewedInSession(normalized.id);

  if (isSupabaseConfigured()) {
    liveSupabasePosts = [normalized, ...liveSupabasePosts];
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const userId = await resolveCurrentUserId();
        if (!userId) return;
        await supabase.from("posts").insert({
          id: isUuid(normalized.id) ? normalized.id : createEntityId("post"),
          category: normalized.category,
          notice_scope: normalized.noticeScope ?? null,
          title: normalized.title,
          content: normalized.content,
          content_html: normalized.contentHtml ?? null,
          author_id: userId,
          author_nickname: normalized.author,
          author_verified: normalized.authorVerified,
          upvotes: 0,
          views: 1,
          tagged_device_slugs: normalized.taggedDeviceSlugs,
          build_meta: normalized.buildMeta ?? null,
          vs_meta: normalized.vsMeta ?? null,
          deal_meta: normalized.dealMeta ?? null,
        });
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    customPosts: [normalized, ...cur.customPosts],
  });
}

export function updateCommunityPost(
  postId: string,
  updatedFields: Partial<CommunityPost>
): void {
  const normalizedPatch: Partial<CommunityPost> = {
    ...updatedFields,
    ...(updatedFields.title !== undefined
      ? { title: sanitizePostTitle(updatedFields.title) }
      : {}),
    ...(updatedFields.content !== undefined
      ? { content: sanitizePostContent(updatedFields.content) }
      : {}),
    ...(updatedFields.contentHtml !== undefined
      ? {
          contentHtml: updatedFields.contentHtml
            ? sanitizePostHtmlContent(updatedFields.contentHtml)
            : undefined,
        }
      : {}),
    isEdited: true,
  };

  if (isSupabaseConfigured() && isUuid(postId)) {
    liveSupabasePosts = liveSupabasePosts.map((p) =>
      p.id === postId ? { ...p, ...normalizedPatch } : p
    );
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const { error } = await supabase
          .from("posts")
          .update({
            ...(normalizedPatch.category !== undefined
              ? { category: normalizedPatch.category }
              : {}),
            ...(normalizedPatch.category !== undefined ||
            normalizedPatch.noticeScope !== undefined
              ? {
                  notice_scope:
                    normalizedPatch.category &&
                    normalizedPatch.category !== "notice"
                      ? null
                      : (normalizedPatch.noticeScope ?? null),
                }
              : {}),
            ...(normalizedPatch.title !== undefined
              ? { title: normalizedPatch.title }
              : {}),
            ...(normalizedPatch.content !== undefined
              ? { content: normalizedPatch.content }
              : {}),
            ...(normalizedPatch.contentHtml !== undefined
              ? { content_html: normalizedPatch.contentHtml ?? null }
              : {}),
            ...(normalizedPatch.taggedDeviceSlugs !== undefined
              ? { tagged_device_slugs: normalizedPatch.taggedDeviceSlugs }
              : {}),
            ...(normalizedPatch.buildMeta !== undefined
              ? { build_meta: normalizedPatch.buildMeta ?? null }
              : {}),
            ...(normalizedPatch.vsMeta !== undefined
              ? { vs_meta: normalizedPatch.vsMeta ?? null }
              : {}),
            ...(normalizedPatch.dealMeta !== undefined
              ? { deal_meta: normalizedPatch.dealMeta ?? null }
              : {}),
            is_edited: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", postId);
        if (error) {
          console.error("[KEYNIVERSE] updateCommunityPost failed:", error);
        }
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  const nextCustomPosts = cur.customPosts.map((p) =>
    p.id === postId ? { ...p, ...normalizedPatch } : p
  );

  writePersistedCommunityState({
    ...cur,
    customPosts: nextCustomPosts,
    editedPosts: {
      ...cur.editedPosts,
      [postId]: {
        ...(cur.editedPosts[postId] ?? {}),
        ...normalizedPatch,
      },
    },
  });
}

export function deleteCommunityPost(postId: string): void {
  if (isSupabaseConfigured() && isUuid(postId)) {
    liveSupabasePosts = liveSupabasePosts.filter((p) => p.id !== postId);
    notifyCommunityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        const { error } = await supabase
          .from("posts")
          .delete()
          .eq("id", postId);
        if (error) {
          console.error("[KEYNIVERSE] deleteCommunityPost failed:", error);
        }
      })();
    }
    return;
  }

  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    customPosts: cur.customPosts.filter((p) => p.id !== postId),
    deletedPostIds: cur.deletedPostIds.includes(postId)
      ? cur.deletedPostIds
      : [...cur.deletedPostIds, postId],
  });
}
