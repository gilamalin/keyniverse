import { INITIAL_COMMUNITY_POSTS } from "@/data/community-data";
import { CommunityComment, CommunityPost } from "@/types/community";

/** 댓글·답글 및 게시글 외형 테러 방지 상수 규격 */
export const COMMENT_MAX_LENGTH = 500;
export const COMMENT_MAX_LINES = 15;
export const COMMENT_CLAMP_LINES = 5;
export const POST_TITLE_MAX_LENGTH = 80;
export const POST_HTML_MAX_LENGTH = 65535;
export const POST_MAX_LINES = 200;

/**
 * 로컬 Base64 이미지 데이터를 실제 백엔드 스토리지 CDN URL 길이 규격으로 치환해
 * 텍스트 + 글자 서식 + 줄바꿈 태그 + 이미지 링크 + 이모티콘 태그가 모두 포함된 HTML 기준 글자 수를 계산
 */
export function measurePostHtmlLength(rawHtml: string): number {
  const trimmed = rawHtml.trim();
  if (!trimmed) return 0;
  const normalizedForCount = trimmed.replace(
    /src="data:image\/[^"]*"/gi,
    'src="https://cdn.keyniverse.kr/uploads/post-image.webp"'
  );
  return normalizedForCount.length;
}

/**
 * 게시글 본문의 전체 줄 수 계산 (세로 줄바꿈 도배 방지용)
 */
export function countPostLines(rawText: string): number {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return 1;
  return normalized.split("\n").length;
}

/**
 * 댓글/답글 입력 중 실시간 제한 (최대 15줄, 최대 500자)
 */
export function clampCommentDraftInput(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const lineClamped =
    lines.length > COMMENT_MAX_LINES
      ? lines.slice(0, COMMENT_MAX_LINES).join("\n")
      : normalized;
  return lineClamped.slice(0, COMMENT_MAX_LENGTH);
}

/**
 * 댓글/답글 저장 시점 정규화:
 * 1) 앞뒤 공백·빈 줄 제거(trim)
 * 2) 연속 3줄 이상의 줄바꿈(\n{3,})을 최대 2줄(\n\n, 빈 줄 1칸)로 자동 압축
 * 3) 전체 최대 15줄 및 최대 500자 제한
 */
export function sanitizeCommentContent(raw: string): string {
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
  const lines = normalized.split("\n").slice(0, COMMENT_MAX_LINES);
  return lines.join("\n").slice(0, COMMENT_MAX_LENGTH).trim();
}

/**
 * 게시글 제목 정규화: 연속 공백 단일화 + 앞뒤 공백 제거 + 최대 80자 제한
 */
export function sanitizePostTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, POST_TITLE_MAX_LENGTH);
}

/**
 * 게시글 일반 텍스트 정규화: 연속 3줄 이상 빈 줄을 최대 2줄로 압축 + 최대 200줄 제한
 */
export function sanitizePostContent(raw: string): string {
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
  const lines = normalized.split("\n").slice(0, POST_MAX_LINES);
  return lines.join("\n").slice(0, POST_HTML_MAX_LENGTH);
}

/**
 * 게시글 리치 텍스트 HTML 정규화: 에디터에서 엔터 연타로 생성된 연속 3줄 이상의 빈 블록을 최대 2줄로 자동 압축
 */
export function sanitizePostHtmlContent(rawHtml: string): string {
  return rawHtml
    .trim()
    .replace(/(?:<div>\s*<br\s*\/?>\s*<\/div>\s*){3,}/gi, "<div><br></div><div><br></div>")
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
 * 초기 더미 게시글 12종과 localStorage의 사용자 작성글/수정글/추천/댓글/답글/VS투표/특가상태를 병합
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
      posts: INITIAL_COMMUNITY_POSTS.map((p) => ({
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
  const upvotedSet = new Set(state.upvotedPostIds);

  const rawAll = [...state.customPosts, ...INITIAL_COMMUNITY_POSTS].filter(
    (p) => !deletedPostSet.has(p.id)
  );

  const merged = rawAll.map((rawPost) => {
    const postPatch = state.editedPosts[rawPost.id];
    const post: CommunityPost = postPatch
      ? { ...rawPost, ...postPatch, isEdited: true }
      : rawPost;

    const isUpvoted = upvotedSet.has(post.id);
    const userVsChoice = state.vsChoices[post.id];
    const dealOverride = state.dealStatusOverrides[post.id];
    const extraComments = state.addedComments[post.id] ?? [];
    const extraView = state.extraViews[post.id] ?? 0;

    const mergedComments = [...post.comments, ...extraComments]
      .filter((c) => !deletedCommentSet.has(c.id))
      .map((c) => {
        const editedText = state.editedComments[c.id];
        return {
          ...c,
          content: editedText !== undefined ? editedText : c.content,
          isEdited: Boolean(c.isEdited || editedText !== undefined),
          isMyComment: Boolean(
            c.isMyComment || (currentNickname && c.author === currentNickname)
          ),
        };
      });

    const nextVsMeta = post.vsMeta
      ? {
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
      upvotes: post.upvotes + (isUpvoted ? 1 : 0),
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
    vsChoices: state.vsChoices,
  };
}

export function incrementPostView(postId: string): void {
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
  const cur = readPersistedCommunityState();
  const prevList = cur.addedComments[postId] ?? [];
  writePersistedCommunityState({
    ...cur,
    addedComments: {
      ...cur.addedComments,
      [postId]: [
        ...prevList,
        {
          ...comment,
          content: sanitizeCommentContent(comment.content),
        },
      ],
    },
  });
}

export function updateCommunityComment(
  commentId: string,
  newContent: string
): void {
  const sanitized = sanitizeCommentContent(newContent);
  if (!sanitized) return;
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
  const cur = readPersistedCommunityState();
  if (cur.deletedCommentIds.includes(commentId)) return;
  writePersistedCommunityState({
    ...cur,
    deletedCommentIds: [...cur.deletedCommentIds, commentId],
  });
}

export function createCommunityPost(newPost: CommunityPost): void {
  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    customPosts: [
      {
        ...newPost,
        title: sanitizePostTitle(newPost.title),
        content: sanitizePostContent(newPost.content),
        contentHtml: newPost.contentHtml
          ? sanitizePostHtmlContent(newPost.contentHtml)
          : undefined,
      },
      ...cur.customPosts,
    ],
  });
}

export function updateCommunityPost(
  postId: string,
  updatedFields: Partial<CommunityPost>
): void {
  const cur = readPersistedCommunityState();
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
  const cur = readPersistedCommunityState();
  writePersistedCommunityState({
    ...cur,
    customPosts: cur.customPosts.filter((p) => p.id !== postId),
    deletedPostIds: cur.deletedPostIds.includes(postId)
      ? cur.deletedPostIds
      : [...cur.deletedPostIds, postId],
  });
}
