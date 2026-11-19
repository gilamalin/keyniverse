/**
 * 활동 포인트(적립/소모) & 신고 접수 경량 스토어
 * - 추후 Supabase `point_logs`, `reports` 테이블과 1:1 매핑되도록 설계
 * - `delta`는 양수(적립)와 음수(소모)를 모두 지원해 향후 포인트 소모처 추가 시 스키마 변경 불필요
 */

export interface PointLogEntry {
  id: string;
  reason: string;
  /** 양수: 적립 (+10), 음수: 소모 (-50) */
  delta: number;
  createdAt: string;
}

export type ReportTargetType = "post" | "comment" | "reply";

export type ReportReason =
  | "욕설 · 비하"
  | "스팸 · 홍보"
  | "도배 · 무의미한 내용"
  | "허위 정보"
  | "기타";

export const REPORT_REASONS: ReportReason[] = [
  "욕설 · 비하",
  "스팸 · 홍보",
  "도배 · 무의미한 내용",
  "허위 정보",
  "기타",
];

export interface ReportRecord {
  targetKey: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string;
  createdAt: string;
}

interface PersistedActivityState {
  pointLogs: PointLogEntry[];
  reports: ReportRecord[];
}

export const ACTIVITY_STORAGE_KEY = "keyniverse_activity_state_v1";

export const POINT_REWARDS = {
  CREATE_POST: 10,
  CREATE_COMMENT: 3,
  SUBMIT_SPEC_VOTE: 5,
} as const;

const DEFAULT_ACTIVITY_STATE: PersistedActivityState = {
  pointLogs: [
    {
      id: "pt-welcome",
      reason: "신규 가입",
      delta: 50,
      createdAt: "2026-11-18",
    },
  ],
  reports: [],
};

let activityStoreVersion = 1;
const activityListeners = new Set<() => void>();

function notifyActivityListeners(): void {
  activityStoreVersion += 1;
  for (const listener of activityListeners) {
    listener();
  }
}

export function subscribeActivityStore(listener: () => void): () => void {
  activityListeners.add(listener);
  const handleStorage = (e: StorageEvent) => {
    if (!e.key || e.key === ACTIVITY_STORAGE_KEY) {
      notifyActivityListeners();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    activityListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function getActivityStoreVersion(): number {
  return activityStoreVersion;
}

export function getServerActivityStoreVersion(): number {
  return 0;
}

function readActivityState(): PersistedActivityState {
  if (typeof window === "undefined") return DEFAULT_ACTIVITY_STATE;
  try {
    const raw = window.localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return DEFAULT_ACTIVITY_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedActivityState>;
    return {
      pointLogs: Array.isArray(parsed.pointLogs)
        ? parsed.pointLogs
        : DEFAULT_ACTIVITY_STATE.pointLogs,
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    };
  } catch {
    return DEFAULT_ACTIVITY_STATE;
  }
}

function writeActivityState(next: PersistedActivityState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  notifyActivityListeners();
}

function formatTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function readPointLogs(): PointLogEntry[] {
  return readActivityState().pointLogs;
}

export function readTotalPoints(): number {
  return Math.max(
    0,
    readActivityState().pointLogs.reduce((sum, entry) => sum + entry.delta, 0)
  );
}

/**
 * 포인트 적립(+delta) 또는 소모(-delta) 기록
 */
export function recordPointTransaction(reason: string, delta: number): void {
  if (delta === 0) return;
  const state = readActivityState();
  const entry: PointLogEntry = {
    id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reason,
    delta,
    createdAt: formatTodayDate(),
  };
  writeActivityState({
    ...state,
    pointLogs: [entry, ...state.pointLogs].slice(0, 100),
  });
}

/**
 * 타인(초기 더미 유저) 프로필용 활동 포인트 산출 헬퍼
 */
export function estimateAuthorPoints(
  postCount: number,
  commentCount: number
): number {
  return (
    50 +
    postCount * POINT_REWARDS.CREATE_POST +
    commentCount * POINT_REWARDS.CREATE_COMMENT
  );
}

export function buildReportKey(
  targetType: ReportTargetType,
  targetId: string
): string {
  return `${targetType}:${targetId}`;
}

export function hasReportedTarget(
  targetType: ReportTargetType,
  targetId: string
): boolean {
  const key = buildReportKey(targetType, targetId);
  return readActivityState().reports.some((r) => r.targetKey === key);
}

export function submitReport(params: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string;
}): { ok: boolean; alreadyReported?: boolean } {
  const key = buildReportKey(params.targetType, params.targetId);
  const state = readActivityState();
  if (state.reports.some((r) => r.targetKey === key)) {
    return { ok: false, alreadyReported: true };
  }

  const record: ReportRecord = {
    targetKey: key,
    targetType: params.targetType,
    targetId: params.targetId,
    reason: params.reason,
    detail: params.detail?.trim() || undefined,
    createdAt: formatTodayDate(),
  };

  writeActivityState({
    ...state,
    reports: [record, ...state.reports].slice(0, 200),
  });

  return { ok: true };
}

export function clearActivityStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  notifyActivityListeners();
}
