import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import {
  clearSyncedUserVotes,
  readStoredVote,
  readVerificationProof,
  syncUserVotesFromSupabase,
} from "@/lib/spec-verification";
import {
  clearSyncedActivity,
  syncActivityFromSupabase,
} from "@/lib/activity-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface GoogleUserSession {
  userId: string;
  nickname: string;
  email: string;
  provider: "google";
  signedInAt: string;
  /** 최초 Google 가입 직후 profiles.nickname이 아직 비어 있는 경우 true */
  needsNicknameSetup?: boolean;
  /** 마지막 닉네임 변경 시각 (ISO 문자열, 최초 1회 오타 수정 전까지는 null) */
  nicknameChangedAt?: string | null;
  /** Supabase profiles.points 실시간 스냅샷 */
  points?: number;
  /** 권한 ('user' | 'admin') */
  role?: "user" | "admin";
  /** 활동 정지 만료 시각 (ISO 문자열) */
  bannedUntil?: string | null;
}

export function isSessionAdmin(session: GoogleUserSession | null): boolean {
  return session?.role === "admin";
}

export function isSessionBanned(session: GoogleUserSession | null): boolean {
  if (!session?.bannedUntil) return false;
  const untilMs = new Date(session.bannedUntil).getTime();
  return !Number.isNaN(untilMs) && untilMs > Date.now();
}

const AUTH_STORAGE_KEY = "keyniverse_google_auth_v1";

let authStoreVersion = 1;
let authModalOpenState = false;
let authModalReasonState: string | null = null;
let liveSupabaseSession: GoogleUserSession | null = null;
let supabaseSyncInitialized = false;
let hasResolvedAuthSession = false;

export function isAuthSessionResolved(): boolean {
  return !isSupabaseConfigured() || hasResolvedAuthSession;
}

const authListeners = new Set<() => void>();

function notifyAuthListeners(): void {
  authStoreVersion += 1;
  for (const listener of authListeners) {
    listener();
  }
}

export function subscribeAuthStore(listener: () => void): () => void {
  authListeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (!e.key || e.key === AUTH_STORAGE_KEY || e.key.startsWith("verified_")) {
      notifyAuthListeners();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    authListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function getAuthStoreVersion(): number {
  return authStoreVersion;
}

export function getServerAuthStoreVersion(): number {
  return 0;
}

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 6;
export const NICKNAME_COOLDOWN_DAYS = 30;
const NICKNAME_ALLOWED_REGEX = /^[가-힣a-zA-Z0-9]+$/;

/** 사칭 방지 예약어 및 기본 비속어 (소문자 기준 부분 일치 차단) */
const RESERVED_NICKNAME_KEYWORDS = [
  "관리자",
  "운영자",
  "어드민",
  "admin",
  "root",
  "system",
  "시스템",
  "키니버스",
  "공지",
  "스태프",
  "staff",
  "매니저",
  "탈퇴",
  "master",
  "시발",
  "씨발",
  "병신",
  "개새끼",
  "섹스",
];

/**
 * 닉네임 재변경까지 남은 일수 계산 (0이면 변경 가능)
 */
export function getNicknameCooldownRemainingDays(
  nicknameChangedAt?: string | null
): number {
  if (!nicknameChangedAt) return 0;
  const changedMs = new Date(nicknameChangedAt).getTime();
  if (Number.isNaN(changedMs)) return 0;
  const unlockMs = changedMs + NICKNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remainingMs = unlockMs - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

/**
 * 닉네임 유효성 검증:
 * - 한글(완성형 가-힣), 영문(a-z, A-Z), 숫자(0-9)만 허용
 * - 공백(스페이스), 특수기호, 단독 자음/모음(ㄱ~ㅎ, ㅏ~ㅣ) 금지
 * - 길이: 2자 이상 ~ 6자 이하
 */
export function validateNickname(raw: string): {
  valid: boolean;
  error: string | null;
} {
  if (!raw) {
    return { valid: false, error: "닉네임을 입력해 주세요." };
  }
  if (/\s/.test(raw)) {
    return {
      valid: false,
      error: "공백은 사용할 수 없습니다.",
    };
  }
  if (!NICKNAME_ALLOWED_REGEX.test(raw)) {
    return {
      valid: false,
      error: "한글, 영문, 숫자만 사용할 수 있습니다.",
    };
  }
  if (raw.length < NICKNAME_MIN_LENGTH || raw.length > NICKNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자로 입력해 주세요.`,
    };
  }
  const lower = raw.toLowerCase();
  if (RESERVED_NICKNAME_KEYWORDS.some((word) => lower.includes(word))) {
    return {
      valid: false,
      error: "사용할 수 없는 닉네임입니다.",
    };
  }
  return { valid: true, error: null };
}

async function fetchAndCacheSupabaseSession(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const needsNotify =
      !hasResolvedAuthSession || liveSupabaseSession !== null;
    hasResolvedAuthSession = true;
    if (liveSupabaseSession !== null) {
      liveSupabaseSession = null;
      clearSyncedUserVotes();
      clearSyncedActivity();
    }
    if (needsNotify) {
      notifyAuthListeners();
    }
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, email, points, nickname_changed_at, role, banned_until")
    .eq("id", user.id)
    .maybeSingle();

  const resolvedEmail = profile?.email || user.email || "";
  const resolvedNickname = profile?.nickname ?? "";
  const needsNicknameSetup = !profile?.nickname;

  liveSupabaseSession = {
    userId: user.id,
    nickname: resolvedNickname,
    email: resolvedEmail,
    provider: "google",
    signedInAt: user.last_sign_in_at ?? new Date().toISOString(),
    needsNicknameSetup,
    nicknameChangedAt: profile?.nickname_changed_at ?? null,
    points: typeof profile?.points === "number" ? profile.points : 50,
    role: profile?.role === "admin" ? "admin" : "user",
    bannedUntil: profile?.banned_until ?? null,
  };
  hasResolvedAuthSession = true;
  notifyAuthListeners();
  void Promise.all([
    syncUserVotesFromSupabase(user.id),
    syncActivityFromSupabase(user.id),
  ]);
}

/**
 * 앱 마운트 시 1회 호출되어 Supabase Auth 세션 및 profiles 테이블을 실시간 동기화
 */
export function initSupabaseAuthSync(): void {
  if (typeof window === "undefined" || supabaseSyncInitialized) return;
  if (!isSupabaseConfigured()) return;

  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  supabaseSyncInitialized = true;
  void fetchAndCacheSupabaseSession();

  supabase.auth.onAuthStateChange(() => {
    void fetchAndCacheSupabaseSession();
  });
}

export function readGoogleSession(): GoogleUserSession | null {
  if (typeof window === "undefined") return null;

  if (isSupabaseConfigured()) {
    return liveSupabaseSession;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GoogleUserSession;
    if (parsed.provider !== "google" || !parsed.nickname) return null;
    if (parsed.nickname === "Botanical_Lab") {
      parsed.nickname = "보타니컬랩";
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 실제 Google OAuth 로그인 (Supabase 환경변수가 없을 때만 Mock fallback)
 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (typeof window === "undefined") return { error: null };

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return { error: "인증 클라이언트를 초기화할 수 없습니다." };

    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  signInWithGoogleMock("보타니컬랩");
  return { error: null };
}

export function signInWithGoogleMock(
  customNickname = "보타니컬랩"
): GoogleUserSession {
  const check = validateNickname(customNickname);
  const safeNickname = check.valid ? customNickname : "보타니컬랩";

  const session: GoogleUserSession = {
    userId: "google-oauth-botanical-lab",
    nickname: safeNickname,
    email: "botanical.lab@gmail.com",
    provider: "google",
    signedInAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage quota errors
    }
  }

  authModalOpenState = false;
  authModalReasonState = null;
  notifyAuthListeners();
  return session;
}

export async function signOutGoogle(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    liveSupabaseSession = null;
    clearSyncedUserVotes();
    clearSyncedActivity();
    notifyAuthListeners();
    return;
  }

  signOutGoogleMock();
}

export function signOutGoogleMock(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  notifyAuthListeners();
}

export async function updateSessionNicknameAsync(
  nextNickname: string
): Promise<{ valid: boolean; error: string | null; session?: GoogleUserSession }> {
  const check = validateNickname(nextNickname);
  if (!check.valid) {
    return { valid: false, error: check.error };
  }

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !liveSupabaseSession) {
      return { valid: false, error: "로그인이 필요합니다." };
    }

    const isInitialSetup = Boolean(liveSupabaseSession.needsNicknameSetup);
    if (!isInitialSetup && nextNickname === liveSupabaseSession.nickname) {
      return { valid: true, error: null, session: liveSupabaseSession };
    }

    if (!isInitialSetup) {
      const remaining = getNicknameCooldownRemainingDays(
        liveSupabaseSession.nicknameChangedAt
      );
      if (remaining > 0) {
        return {
          valid: false,
          error: `${remaining}일 후 변경할 수 있습니다.`,
        };
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        nickname: nextNickname,
        updated_at: new Date().toISOString(),
      })
      .eq("id", liveSupabaseSession.userId);

    if (error) {
      if (error.code === "23505") {
        return { valid: false, error: "이미 사용 중인 닉네임입니다." };
      }
      if (error.message?.includes("NICKNAME_COOLDOWN")) {
        return {
          valid: false,
          error: `닉네임은 ${NICKNAME_COOLDOWN_DAYS}일마다 변경할 수 있습니다.`,
        };
      }
      return { valid: false, error: "닉네임 저장 중 오류가 발생했습니다." };
    }

    liveSupabaseSession = {
      ...liveSupabaseSession,
      nickname: nextNickname,
      needsNicknameSetup: false,
      nicknameChangedAt: isInitialSetup
        ? liveSupabaseSession.nicknameChangedAt ?? null
        : new Date().toISOString(),
    };
    notifyAuthListeners();
    return { valid: true, error: null, session: liveSupabaseSession };
  }

  return updateSessionNickname(nextNickname);
}

export function updateSessionNickname(
  nextNickname: string
): { valid: boolean; error: string | null; session?: GoogleUserSession } {
  const check = validateNickname(nextNickname);
  if (!check.valid) {
    return { valid: false, error: check.error };
  }

  const current = readGoogleSession();
  if (!current) {
    return { valid: false, error: "로그인이 필요합니다." };
  }

  const updated: GoogleUserSession = {
    ...current,
    nickname: nextNickname,
    needsNicknameSetup: false,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  }
  notifyAuthListeners();
  return { valid: true, error: null, session: updated };
}

export async function withdrawAccount(): Promise<{ error: string | null }> {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) {
        return { error: "회원 탈퇴 처리 중 오류가 발생했습니다." };
      }
      await supabase.auth.signOut();
    }
    liveSupabaseSession = null;
    clearSyncedUserVotes();
    clearSyncedActivity();
  }
  withdrawAccountMock();
  return { error: null };
}

export function withdrawAccountMock(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      window.localStorage.removeItem("keyniverse_activity_state_v1");
      window.localStorage.removeItem("keyniverse_community_state_v1");
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (
          key &&
          (key.startsWith("verified_") || key.startsWith("spec_vote_"))
        ) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // Ignore storage errors
    }
  }
  notifyAuthListeners();
}

export function openAuthModal(reason?: string): void {
  authModalOpenState = true;
  authModalReasonState = reason ?? null;
  notifyAuthListeners();
}

export function closeAuthModal(): void {
  authModalOpenState = false;
  authModalReasonState = null;
  notifyAuthListeners();
}

export function getAuthModalState(): {
  open: boolean;
  reason: string | null;
} {
  return {
    open: authModalOpenState,
    reason: authModalReasonState,
  };
}

/**
 * 로컬 스토리지에 키보드 또는 마우스 무결점 실측 인증 통과 기록이 1건 이상 있는지 확인
 */
export function getUserVerifiedBadgeStatus(): {
  isVerifiedTester: boolean;
  verifiedCount: number;
  latestSnapshot: {
    deviceType: "keyboard" | "mouse";
    deviceSlug: string;
    deviceName: string;
    metricLabel: string;
  } | null;
} {
  if (typeof window === "undefined") {
    return {
      isVerifiedTester: false,
      verifiedCount: 0,
      latestSnapshot: null,
    };
  }

  let verifiedCount = 0;
  let latestSnapshot: {
    deviceType: "keyboard" | "mouse";
    deviceSlug: string;
    deviceName: string;
    metricLabel: string;
  } | null = null;

  for (const sw of INITIAL_SWITCHES) {
    const proof = readVerificationProof(sw.slug, "switch");
    if (proof && proof.kind === "switch") {
      verifiedCount += 1;
      latestSnapshot = {
        deviceType: "keyboard",
        deviceSlug: sw.slug,
        deviceName: sw.name,
        metricLabel: `${proof.totalKeyPresses}타 무결점 인증`,
      };
    }
  }

  for (const ms of INITIAL_MICE) {
    const proof = readVerificationProof(ms.slug, "mouse");
    if (proof && proof.kind === "mouse") {
      verifiedCount += 1;
      latestSnapshot = {
        deviceType: "mouse",
        deviceSlug: ms.slug,
        deviceName: ms.name,
        metricLabel: `Peak ${proof.peakHz.toLocaleString()}Hz 무결점`,
      };
    }
  }

  if (verifiedCount === 0) {
    for (const sw of INITIAL_SWITCHES) {
      if (readStoredVote(sw.id)) {
        verifiedCount += 1;
        break;
      }
    }
  }

  return {
    isVerifiedTester: verifiedCount > 0,
    verifiedCount,
    latestSnapshot,
  };
}
