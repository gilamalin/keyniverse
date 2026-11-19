import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import {
  readStoredVote,
  readVerificationProof,
} from "@/lib/spec-verification";

export interface GoogleUserSession {
  userId: string;
  nickname: string;
  email: string;
  provider: "google";
  signedInAt: string;
}

const AUTH_STORAGE_KEY = "keyniverse_google_auth_v1";

let authStoreVersion = 1;
let authModalOpenState = false;
let authModalReasonState: string | null = null;
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
const NICKNAME_ALLOWED_REGEX = /^[가-힣a-zA-Z0-9]+$/;

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
      error: "닉네임에 공백(스페이스)은 사용할 수 없습니다.",
    };
  }
  if (!NICKNAME_ALLOWED_REGEX.test(raw)) {
    return {
      valid: false,
      error: "한글(완성형), 영문, 숫자만 사용할 수 있습니다. (특수기호·자모 단독 불가)",
    };
  }
  if (raw.length < NICKNAME_MIN_LENGTH || raw.length > NICKNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자 이내로 입력해 주세요.`,
    };
  }
  return { valid: true, error: null };
}

export function readGoogleSession(): GoogleUserSession | null {
  if (typeof window === "undefined") return null;
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
    const vote = readStoredVote(sw.id);
    if (proof || vote) {
      verifiedCount += 1;
      if (proof && proof.kind === "switch" && !latestSnapshot) {
        latestSnapshot = {
          deviceType: "keyboard",
          deviceSlug: sw.slug,
          deviceName: sw.name,
          metricLabel: `무결점 확인 (${proof.totalKeyPresses}타 · 채터링 0회)`,
        };
      }
    }
  }

  for (const ms of INITIAL_MICE) {
    const proof = readVerificationProof(ms.slug, "mouse");
    const vote = readStoredVote(ms.id);
    if (proof || vote) {
      verifiedCount += 1;
      if (proof && proof.kind === "mouse") {
        latestSnapshot = {
          deviceType: "mouse",
          deviceSlug: ms.slug,
          deviceName: ms.name,
          metricLabel: `Peak ${proof.peakHz.toLocaleString()}Hz · 더블클릭 0회 (${proof.clickCount}클릭 검증)`,
        };
      }
    }
  }

  return {
    isVerifiedTester: verifiedCount > 0,
    verifiedCount,
    latestSnapshot,
  };
}
