/**
 * 활동 포인트(적립/소모) & 신고 접수 스토어
 * - Supabase 연결 시 `point_logs`, `reports` 테이블과 실시간 동기화
 * - 환경변수 미설정 시 localStorage fallback 유지
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

let liveActivityUserId: string | null = null;
let livePointLogs: PointLogEntry[] = [];
let liveReports: ReportRecord[] = [];

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

function readLocalActivityState(): PersistedActivityState {
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

function writeLocalActivityState(next: PersistedActivityState): void {
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

export async function syncActivityFromSupabase(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return;

  liveActivityUserId = userId;

  const [{ data: ptRows }, { data: repRows }] = await Promise.all([
    supabase
      .from("point_logs")
      .select("id, reason, delta, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("reports")
      .select("target_type, target_id, reason, detail, created_at")
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (Array.isArray(ptRows)) {
    livePointLogs = ptRows.map((row) => ({
      id: String(row.id),
      reason: String(row.reason),
      delta: Number(row.delta),
      createdAt:
        typeof row.created_at === "string"
          ? row.created_at.slice(0, 10)
          : formatTodayDate(),
    }));
  }

  if (Array.isArray(repRows)) {
    liveReports = repRows.map((row) => ({
      targetKey: buildReportKey(
        row.target_type as ReportTargetType,
        String(row.target_id)
      ),
      targetType: row.target_type as ReportTargetType,
      targetId: String(row.target_id),
      reason: row.reason as ReportReason,
      detail: row.detail ?? undefined,
      createdAt:
        typeof row.created_at === "string"
          ? row.created_at.slice(0, 10)
          : formatTodayDate(),
    }));
  }

  notifyActivityListeners();
}

export function clearSyncedActivity(): void {
  liveActivityUserId = null;
  livePointLogs = [];
  liveReports = [];
  notifyActivityListeners();
}

export function readPointLogs(): PointLogEntry[] {
  if (isSupabaseConfigured()) {
    return livePointLogs;
  }
  return readLocalActivityState().pointLogs;
}

export function readTotalPoints(): number {
  const logs = readPointLogs();
  return Math.max(
    0,
    logs.reduce((sum, entry) => sum + entry.delta, 0)
  );
}

/**
 * 포인트 적립(+delta) 또는 소모(-delta) 기록
 */
export function recordPointTransaction(reason: string, delta: number): void {
  if (delta === 0) return;

  const entry: PointLogEntry = {
    id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reason,
    delta,
    createdAt: formatTodayDate(),
  };

  if (isSupabaseConfigured()) {
    livePointLogs = [entry, ...livePointLogs].slice(0, 100);
    notifyActivityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        let userId = liveActivityUserId;
        if (!userId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          userId = user?.id ?? null;
          if (userId) liveActivityUserId = userId;
        }
        if (!userId) return;
        await supabase.from("point_logs").insert({
          user_id: userId,
          reason,
          delta,
        });
      })();
    }
    return;
  }

  const state = readLocalActivityState();
  writeLocalActivityState({
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
  const reports = isSupabaseConfigured()
    ? liveReports
    : readLocalActivityState().reports;
  return reports.some((r) => r.targetKey === key);
}

export function submitReport(params: {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string;
}): { ok: boolean; alreadyReported?: boolean } {
  const key = buildReportKey(params.targetType, params.targetId);

  if (hasReportedTarget(params.targetType, params.targetId)) {
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

  if (isSupabaseConfigured()) {
    liveReports = [record, ...liveReports].slice(0, 200);
    notifyActivityListeners();

    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void (async () => {
        let userId = liveActivityUserId;
        if (!userId) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          userId = user?.id ?? null;
          if (userId) liveActivityUserId = userId;
        }
        if (!userId) return;
        await supabase.from("reports").insert({
          reporter_id: userId,
          target_type: params.targetType,
          target_id: params.targetId,
          reason: params.reason,
          detail: record.detail ?? null,
        });
      })();
    }
    return { ok: true };
  }

  const state = readLocalActivityState();
  writeLocalActivityState({
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
