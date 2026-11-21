import {
  MouseCommunityData,
  MouseGripChoice,
  MouseHandSizeChoice,
  MouseSpec,
  SwitchCommunityData,
  SwitchPitchChoice,
  SwitchSpec,
  TelemetryBadgeTone,
  VerifiedTelemetryLog,
} from "@/types/specs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const KEYBOARD_MIN_KEY_PRESSES = 50;
export const MOUSE_MIN_MOVE_SAMPLES = 1500;
export const MOUSE_MIN_PEAK_HZ = 800;
export const MOUSE_MIN_CLICKS = 30;
export const MIN_SAMPLE_THRESHOLD = 5;
export const ONE_LINE_REVIEW_MAX_LENGTH = 80;

export interface SwitchVerificationProof {
  kind: "switch";
  slug: string;
  totalKeyPresses: number;
  chatterCount: 0;
  verifiedAt: string;
  badgeText: string;
  badgeTone: TelemetryBadgeTone;
}

export interface MouseVerificationProof {
  kind: "mouse";
  slug: string;
  moveSamples: number;
  peakHz: number;
  clickCount: number;
  doubleClickFaults: 0;
  verifiedAt: string;
  badgeText: string;
  badgeTone: TelemetryBadgeTone;
}

export type DeviceVerificationProof =
  | SwitchVerificationProof
  | MouseVerificationProof;

export interface StoredSwitchVote {
  kind: "switch";
  deviceId: string;
  slug: string;
  rating: number;
  pitch: SwitchPitchChoice;
  oneLineReview?: string;
  badgeText: string;
  badgeTone: TelemetryBadgeTone;
  updatedAt: string;
}

export interface StoredMouseVote {
  kind: "mouse";
  deviceId: string;
  slug: string;
  rating: number;
  grip: MouseGripChoice;
  handSize: MouseHandSizeChoice;
  oneLineReview?: string;
  badgeText: string;
  badgeTone: TelemetryBadgeTone;
  updatedAt: string;
}

export type StoredVerifiedVote = StoredSwitchVote | StoredMouseVote;

function formatTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getProofStorageKey(slug: string): string {
  return `verified_proof_${slug}`;
}

export function getGlobalProofStorageKey(kind: "switch" | "mouse"): string {
  return `verified_proof_global_${kind}`;
}

export function getVoteStorageKey(deviceId: string): string {
  return `verified_votes_${deviceId}`;
}

/**
 * 마우스 테스트 인증 통과 여부 판정 (800Hz 미만 허수 차단)
 */
export function resolveMouseBandwidthBadge(peakHz: number): {
  badgeText: string;
  badgeTone: TelemetryBadgeTone;
} | null {
  if (peakHz >= MOUSE_MIN_PEAK_HZ) {
    return {
      badgeText: "테스트 인증",
      badgeTone: "sand",
    };
  }
  return null;
}

/**
 * 키보드 테스트 인증 통과 여부 검증 및 로컬 스토리지 발급
 */
export function saveSwitchVerificationProof(params: {
  slug: string;
  totalKeyPresses: number;
  chatterCount: number;
}): SwitchVerificationProof | null {
  if (
    typeof window === "undefined" ||
    params.chatterCount > 0 ||
    params.totalKeyPresses < KEYBOARD_MIN_KEY_PRESSES
  ) {
    return null;
  }

  const proof: SwitchVerificationProof = {
    kind: "switch",
    slug: params.slug,
    totalKeyPresses: params.totalKeyPresses,
    chatterCount: 0,
    verifiedAt: formatTodayDate(),
    badgeText: "테스트 인증",
    badgeTone: "sand",
  };

  try {
    const serialized = JSON.stringify(proof);
    window.localStorage.setItem(getProofStorageKey(params.slug), serialized);
    window.localStorage.setItem(getGlobalProofStorageKey("switch"), serialized);
  } catch {
    // Ignore storage quota errors
  }

  return proof;
}

/**
 * 마우스 테스트 인증 통과 여부 검증 및 로컬 스토리지 발급
 */
export function saveMouseVerificationProof(params: {
  slug: string;
  moveSamples: number;
  peakHz: number;
  clickCount: number;
  doubleClickFaults: number;
}): MouseVerificationProof | null {
  if (
    typeof window === "undefined" ||
    params.doubleClickFaults > 0 ||
    params.moveSamples < MOUSE_MIN_MOVE_SAMPLES ||
    params.peakHz < MOUSE_MIN_PEAK_HZ ||
    params.clickCount < MOUSE_MIN_CLICKS
  ) {
    return null;
  }

  const badge = resolveMouseBandwidthBadge(params.peakHz);
  if (!badge) return null;

  const proof: MouseVerificationProof = {
    kind: "mouse",
    slug: params.slug,
    moveSamples: params.moveSamples,
    peakHz: params.peakHz,
    clickCount: params.clickCount,
    doubleClickFaults: 0,
    verifiedAt: formatTodayDate(),
    badgeText: badge.badgeText,
    badgeTone: badge.badgeTone,
  };

  try {
    const serialized = JSON.stringify(proof);
    window.localStorage.setItem(getProofStorageKey(params.slug), serialized);
    window.localStorage.setItem(getGlobalProofStorageKey("mouse"), serialized);
  } catch {
    // Ignore storage quota errors
  }

  return proof;
}

/**
 * 저장된 테스트 인증 증명서 조회 (조작·오염 방지를 위해 읽을 때도 기준 재검증)
 */
export function readVerificationProof(
  slug: string,
  expectedKind: "switch" | "mouse"
): DeviceVerificationProof | null {
  if (typeof window === "undefined") return null;

  try {
    const raw =
      window.localStorage.getItem(getProofStorageKey(slug)) ??
      window.localStorage.getItem(getGlobalProofStorageKey(expectedKind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceVerificationProof;

    if (parsed.kind !== expectedKind) return null;

    if (parsed.kind === "switch") {
      if (
        parsed.chatterCount !== 0 ||
        parsed.totalKeyPresses < KEYBOARD_MIN_KEY_PRESSES
      ) {
        return null;
      }
      return parsed;
    }

    if (
      parsed.doubleClickFaults !== 0 ||
      parsed.moveSamples < MOUSE_MIN_MOVE_SAMPLES ||
      parsed.peakHz < MOUSE_MIN_PEAK_HZ ||
      parsed.clickCount < MOUSE_MIN_CLICKS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

let liveVoteUserId: string | null = null;
const liveSupabaseVotes = new Map<string, StoredVerifiedVote>();

function notifyVoteListeners(): void {
  voteStoreVersion += 1;
  for (const listener of voteListeners) {
    listener();
  }
}

export async function syncUserVotesFromSupabase(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  liveVoteUserId = userId;
  const { data, error } = await supabase
    .from("spec_votes")
    .select("*")
    .eq("user_id", userId);

  if (error || !data) return;

  liveSupabaseVotes.clear();
  for (const row of data) {
    const updatedAt =
      typeof row.updated_at === "string"
        ? row.updated_at.slice(0, 10)
        : formatTodayDate();
    if (row.kind === "switch") {
      liveSupabaseVotes.set(row.device_id, {
        kind: "switch",
        deviceId: row.device_id,
        slug: row.slug,
        rating: row.rating,
        pitch: (row.pitch as SwitchPitchChoice) ?? "high",
        oneLineReview: row.one_line_review ?? undefined,
        badgeText: "테스트 인증",
        badgeTone: "sand",
        updatedAt,
      });
    } else if (row.kind === "mouse") {
      liveSupabaseVotes.set(row.device_id, {
        kind: "mouse",
        deviceId: row.device_id,
        slug: row.slug,
        rating: row.rating,
        grip: (row.grip as MouseGripChoice) ?? "claw",
        handSize: (row.hand_size as MouseHandSizeChoice) ?? "f9",
        oneLineReview: row.one_line_review ?? undefined,
        badgeText: "테스트 인증",
        badgeTone: "sand",
        updatedAt,
      });
    }
  }
  notifyVoteListeners();
}

export function clearSyncedUserVotes(): void {
  liveVoteUserId = null;
  liveSupabaseVotes.clear();
  notifyVoteListeners();
}

export function readStoredVote(deviceId: string): StoredVerifiedVote | null {
  if (typeof window === "undefined") return null;

  if (isSupabaseConfigured()) {
    return liveSupabaseVotes.get(deviceId) ?? null;
  }

  try {
    const raw = window.localStorage.getItem(getVoteStorageKey(deviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredVerifiedVote;
    if (parsed.deviceId !== deviceId) return null;
    if (parsed.rating < 1 || parsed.rating > 5) return null;
    return parsed;
  } catch {
    return null;
  }
}

let voteStoreVersion = 1;
const voteListeners = new Set<() => void>();

export function subscribeVoteStore(listener: () => void): () => void {
  voteListeners.add(listener);
  const handleStorage = () => {
    voteStoreVersion += 1;
    listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    voteListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function getVoteStoreVersion(): number {
  return voteStoreVersion;
}

export function getServerVoteStoreVersion(): number {
  return 0;
}

export function saveStoredVote(vote: StoredVerifiedVote): void {
  if (typeof window === "undefined") return;

  const normalizedVote: StoredVerifiedVote = {
    ...vote,
    badgeText: "테스트 인증",
    badgeTone: "sand",
    updatedAt: formatTodayDate(),
  };

  if (isSupabaseConfigured()) {
    liveSupabaseVotes.set(vote.deviceId, normalizedVote);
    notifyVoteListeners();

    const supabase = createSupabaseBrowserClient();
    const userId = liveVoteUserId;
    if (supabase && userId) {
      const payload =
        normalizedVote.kind === "switch"
          ? {
              user_id: userId,
              kind: "switch",
              device_id: normalizedVote.deviceId,
              slug: normalizedVote.slug,
              rating: normalizedVote.rating,
              pitch: normalizedVote.pitch,
              grip: null,
              hand_size: null,
              one_line_review: normalizedVote.oneLineReview ?? null,
              updated_at: new Date().toISOString(),
            }
          : {
              user_id: userId,
              kind: "mouse",
              device_id: normalizedVote.deviceId,
              slug: normalizedVote.slug,
              rating: normalizedVote.rating,
              pitch: null,
              grip: normalizedVote.grip,
              hand_size: normalizedVote.handSize,
              one_line_review: normalizedVote.oneLineReview ?? null,
              updated_at: new Date().toISOString(),
            };

      void (async () => {
        const { error } = await supabase
          .from("spec_votes")
          .upsert(payload, { onConflict: "user_id,device_id" });
        if (error) {
          console.error("[KEYNIVERSE] saveStoredVote failed:", error);
        }
      })();
    }
    return;
  }

  try {
    window.localStorage.setItem(
      getVoteStorageKey(vote.deviceId),
      JSON.stringify(normalizedVote)
    );
    notifyVoteListeners();
  } catch {
    // Ignore storage quota errors
  }
}

export function deleteStoredVote(deviceId: string): void {
  if (typeof window === "undefined") return;

  if (isSupabaseConfigured()) {
    liveSupabaseVotes.delete(deviceId);
    notifyVoteListeners();

    const supabase = createSupabaseBrowserClient();
    const userId = liveVoteUserId;
    if (supabase && userId) {
      void (async () => {
        const { error } = await supabase
          .from("spec_votes")
          .delete()
          .eq("user_id", userId)
          .eq("device_id", deviceId);
        if (error) {
          console.error("[KEYNIVERSE] deleteStoredVote failed:", error);
        }
      })();
    }
    return;
  }

  try {
    window.localStorage.removeItem(getVoteStorageKey(deviceId));
    notifyVoteListeners();
  } catch {
    // Ignore storage errors
  }
}

/**
 * 기기당 1인 1회 투표(재제출 시 기존 표 덮어쓰기)가 반영된 스위치 커뮤니티 데이터 산출
 */
export function computeEffectiveSwitchCommunity(
  spec: SwitchSpec,
  userVote: StoredVerifiedVote | null
): SwitchCommunityData {
  const base = spec.community;
  if (!userVote || userVote.kind !== "switch" || userVote.deviceId !== spec.id) {
    return base;
  }

  const nextCount = base.reviewCount + 1;
  const nextRatingAvg =
    Math.round(
      ((base.ratingAvg * base.reviewCount + userVote.rating) / nextCount) * 10
    ) / 10;

  const nextPitchVotes = {
    ...base.pitchVotes,
    [userVote.pitch]: base.pitchVotes[userVote.pitch] + 1,
  };

  const cleanedReview = userVote.oneLineReview
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, ONE_LINE_REVIEW_MAX_LENGTH);

  const nextLogs: VerifiedTelemetryLog[] = cleanedReview
    ? [
        {
          id: `local-vote-${spec.id}`,
          createdAt: userVote.updatedAt,
          rating: userVote.rating,
          structuredSummary: cleanedReview,
          badgeText: "테스트 인증",
          badgeTone: "sand",
          isCurrentUser: true,
        },
        ...base.telemetryLogs,
      ]
    : base.telemetryLogs;

  return {
    ratingAvg: nextRatingAvg,
    reviewCount: nextCount,
    pitchVotes: nextPitchVotes,
    telemetryLogs: nextLogs,
  };
}

/**
 * 기기당 1인 1회 투표(재제출 시 기존 표 덮어쓰기)가 반영된 마우스 커뮤니티 데이터 산출
 */
export function computeEffectiveMouseCommunity(
  spec: MouseSpec,
  userVote: StoredVerifiedVote | null
): MouseCommunityData {
  const base = spec.community;
  if (!userVote || userVote.kind !== "mouse" || userVote.deviceId !== spec.id) {
    return base;
  }

  const nextCount = base.reviewCount + 1;
  const nextRatingAvg =
    Math.round(
      ((base.ratingAvg * base.reviewCount + userVote.rating) / nextCount) * 10
    ) / 10;

  const nextGripVotes = {
    ...base.gripVotes,
    [userVote.grip]: base.gripVotes[userVote.grip] + 1,
  };

  const nextHandSizeVotes = {
    ...base.handSizeVotes,
    [userVote.handSize]: base.handSizeVotes[userVote.handSize] + 1,
  };

  const cleanedReview = userVote.oneLineReview
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, ONE_LINE_REVIEW_MAX_LENGTH);

  const nextLogs: VerifiedTelemetryLog[] = cleanedReview
    ? [
        {
          id: `local-vote-${spec.id}`,
          createdAt: userVote.updatedAt,
          rating: userVote.rating,
          structuredSummary: cleanedReview,
          badgeText: "테스트 인증",
          badgeTone: "sand",
          isCurrentUser: true,
        },
        ...base.telemetryLogs,
      ]
    : base.telemetryLogs;

  return {
    ratingAvg: nextRatingAvg,
    reviewCount: nextCount,
    gripVotes: nextGripVotes,
    handSizeVotes: nextHandSizeVotes,
    telemetryLogs: nextLogs,
  };
}
