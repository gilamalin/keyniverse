"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  ExternalLink,
  FileText,
  Search,
  Shield,
  Siren,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface AdminKpiStats {
  totalUsers: number;
  todayUsers: number;
  totalPosts: number;
  todayPosts: number;
  pendingReports: number;
  bannedUsers: number;
}

export interface AdminReportItem {
  id: string;
  targetType: "post" | "comment" | "reply";
  targetId: string;
  reason: string;
  detail: string | null;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
  reporterNickname: string;
  targetAuthorId: string | null;
  targetAuthorNickname: string;
  targetTitle: string | null;
  targetPreview: string;
  targetHref: string | null;
  targetExists: boolean;
}

export interface AdminUserItem {
  id: string;
  nickname: string;
  email: string;
  role: "user" | "admin";
  points: number;
  bannedUntil: string | null;
  createdAt: string;
}

interface AdminDashboardClientProps {
  currentAdminId: string;
  initialStats: AdminKpiStats;
  initialReports: AdminReportItem[];
  initialUsers: AdminUserItem[];
}

type AdminTab = "reports" | "users";
type ReportStatusFilter = "pending" | "resolved" | "dismissed";

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

function formatBanLabel(bannedUntil: string | null): string | null {
  if (!bannedUntil) return null;
  const d = new Date(bannedUntil);
  if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return null;
  if (d.getFullYear() >= 2090) return "영구 정지";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}까지`;
}

export function AdminDashboardClient({
  currentAdminId,
  initialStats,
  initialReports,
  initialUsers,
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("reports");
  const [reportFilter, setReportFilter] =
    useState<ReportStatusFilter>("pending");
  const [reports, setReports] = useState<AdminReportItem[]>(initialReports);
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [userSearch, setUserSearch] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status === "pending").length,
    [reports]
  );

  const bannedCount = useMemo(
    () => users.filter((u) => Boolean(formatBanLabel(u.bannedUntil))).length,
    [users]
  );

  const filteredReports = useMemo(
    () => reports.filter((r) => r.status === reportFilter),
    [reports, reportFilter]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nickname.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const handleResolveReport = async (
    report: AdminReportItem,
    nextStatus: "resolved" | "dismissed",
    deleteTarget: boolean
  ) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setBusyId(report.id);
    setNotice(null);
    const { error } = await supabase.rpc("admin_resolve_report", {
      target_report_id: report.id,
      next_status: nextStatus,
      delete_target: deleteTarget,
    });
    setBusyId(null);

    if (error) {
      setNotice(`처리 실패: ${error.message}`);
      return;
    }

    setReports((prev) =>
      prev.map((item) => {
        if (item.id === report.id) {
          return {
            ...item,
            status: nextStatus,
            targetExists: deleteTarget ? false : item.targetExists,
          };
        }
        if (
          deleteTarget &&
          item.targetType === report.targetType &&
          item.targetId === report.targetId &&
          item.status === "pending"
        ) {
          return { ...item, status: nextStatus, targetExists: false };
        }
        return item;
      })
    );
    setNotice(
      deleteTarget
        ? "신고 대상 콘텐츠를 삭제하고 처리 완료했습니다."
        : "신고를 기각 처리했습니다."
    );
  };

  const handleSetUserBan = async (userId: string, banDays: number) => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setBusyId(userId);
    setNotice(null);
    const { data, error } = await supabase.rpc("admin_set_user_ban", {
      target_user_id: userId,
      ban_days: banDays,
    });
    setBusyId(null);

    if (error) {
      setNotice(`제재 실패: ${error.message}`);
      return;
    }

    const nextUntil = typeof data === "string" ? data : null;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, bannedUntil: nextUntil } : u))
    );
    setNotice(
      banDays === 0
        ? "활동 정지를 해제했습니다."
        : banDays < 0
          ? "영구 정지를 적용했습니다."
          : `${banDays}일 활동 정지를 적용했습니다.`
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* 상단 페이지 헤더 */}
      <div className="border-b border-[#282D2A] pb-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
            <Shield className="size-3.5" />
            ADMIN CONSOLE
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#D5DBD6] sm:text-3xl">
          관리자 대시보드
        </h1>
      </div>

      {/* 1. 상단 KPI 4카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4">
          <div className="flex items-center justify-between text-xs text-[#8F9691]">
            <span>총 회원</span>
            <Users className="size-3.5 text-[#6B9080]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-[#E4E6E1]">
              {users.length}
            </span>
            {initialStats.todayUsers > 0 && (
              <span className="text-xs text-[#6B9080]">
                +{initialStats.todayUsers}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4">
          <div className="flex items-center justify-between text-xs text-[#8F9691]">
            <span>총 게시글</span>
            <FileText className="size-3.5 text-[#6B9080]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-[#E4E6E1]">
              {initialStats.totalPosts}
            </span>
            {initialStats.todayPosts > 0 && (
              <span className="text-xs text-[#6B9080]">
                +{initialStats.todayPosts}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4">
          <div className="flex items-center justify-between text-xs text-[#8F9691]">
            <span>미처리 신고</span>
            <Siren className="size-3.5 text-[#E06C75]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#E06C75]">
            {pendingCount}
          </div>
        </div>

        <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4">
          <div className="flex items-center justify-between text-xs text-[#8F9691]">
            <span>활동 정지</span>
            <Ban className="size-3.5 text-[#D4A373]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#D4A373]">
            {bannedCount}
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-[#6B9080]/50 bg-[#1A1D1B] px-3.5 py-2 text-xs text-[#E4E6E1]">
          {notice}
        </div>
      )}

      {/* 2. 메인 탭 바 */}
      <div className="flex items-center gap-2 rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-2">
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors",
            activeTab === "reports"
              ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
              : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
          )}
        >
          <Siren className="size-3.5 text-[#E06C75]" />
          <span>신고 처리함</span>
          <span className="rounded bg-[#151816] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#E06C75]">
            {pendingCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors",
            activeTab === "users"
              ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
              : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
          )}
        >
          <Users className="size-3.5 text-[#6B9080]" />
          <span>회원 관리</span>
          <span className="rounded bg-[#151816] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#8F9691]">
            {users.length}
          </span>
        </button>
      </div>

      {/* 3-A. 신고 처리함 탭 */}
      {activeTab === "reports" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: "pending", label: "미처리" },
                { id: "resolved", label: "처리완료" },
                { id: "dismissed", label: "기각" },
              ] as Array<{ id: ReportStatusFilter; label: string }>
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setReportFilter(f.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                  reportFilter === f.id
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] py-14 text-center text-xs text-[#8F9691]">
              해당 상태의 신고 내역이 없습니다.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredReports.map((r) => {
                const isBusy = busyId === r.id;
                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-3 rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-[#282D2A] bg-[#151816] px-2 py-0.5 font-mono text-[11px] text-[#8F9691]">
                          {r.targetType === "post"
                            ? "게시글"
                            : r.targetType === "reply"
                              ? "답글"
                              : "댓글"}
                        </span>
                        <span className="font-semibold text-[#E06C75]">
                          {r.reason}
                        </span>
                        <span className="text-[#8F9691]">
                          신고자 {r.reporterNickname} · 작성자{" "}
                          <strong className="text-[#C9CFCB]">
                            {r.targetAuthorNickname}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[11px] text-[#8F9691] tabular-nums">
                        <span>{formatDateShort(r.createdAt)}</span>
                        {r.targetHref && (
                          <Link
                            href={r.targetHref}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#151816] px-2 py-0.5 text-[#6B9080] hover:border-[#6B9080]"
                          >
                            <span>원문</span>
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#282D2A] bg-[#151816] p-3 text-xs">
                      {r.targetTitle && (
                        <p className="mb-1 font-semibold text-[#E4E6E1]">
                          {r.targetTitle}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-[#B5BCB7]">
                        {r.targetPreview || "(내용 없음)"}
                      </p>
                      {r.detail && (
                        <p className="mt-2 border-t border-[#282D2A] pt-2 text-[11px] text-[#8F9691]">
                          신고 메모: {r.detail}
                        </p>
                      )}
                    </div>

                    {r.status === "pending" && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {r.targetAuthorId && r.targetAuthorId !== currentAdminId && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleSetUserBan(r.targetAuthorId!, 7)
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-[#D4A373]/50 bg-[#151816] px-2.5 py-1.5 text-xs font-semibold text-[#D4A373] transition-colors hover:bg-[#D4A373] hover:text-[#121413] disabled:opacity-50"
                          >
                            <Ban className="size-3.5" />
                            <span>작성자 7일 정지</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleResolveReport(r, "dismissed", false)
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-[#282D2A] bg-[#151816] px-2.5 py-1.5 text-xs font-semibold text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1] disabled:opacity-50"
                        >
                          <XCircle className="size-3.5" />
                          <span>기각</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleResolveReport(r, "resolved", true)
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-[#E06C75]/60 bg-[#E06C75]/15 px-3 py-1.5 text-xs font-bold text-[#E06C75] transition-colors hover:bg-[#E06C75] hover:text-[#121413] disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                          <span>콘텐츠 삭제 · 처리</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* 3-B. 회원 관리 탭 */}
      {activeTab === "users" && (
        <section className="flex flex-col gap-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#8F9691]" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="닉네임 또는 이메일 검색..."
              className="h-9 w-full rounded-lg border border-[#282D2A] bg-[#151816] pr-3 pl-8 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]">
            <div className="divide-y divide-[#282D2A]">
              {filteredUsers.map((u) => {
                const banLabel = formatBanLabel(u.bannedUntil);
                const isSelfOrAdmin =
                  u.id === currentAdminId || u.role === "admin";
                const isBusy = busyId === u.id;
                return (
                  <div
                    key={u.id}
                    className="flex flex-col justify-between gap-2.5 p-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#E4E6E1]">
                          {u.nickname}
                        </span>
                        {u.role === "admin" && (
                          <span className="rounded border border-[#6B9080]/50 bg-[#6B9080]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#6B9080]">
                            ADMIN
                          </span>
                        )}
                        {banLabel && (
                          <span className="rounded border border-[#E06C75]/50 bg-[#E06C75]/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#E06C75]">
                            정지 ({banLabel})
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#8F9691] tabular-nums">
                        <span>{u.email}</span>
                        <span>·</span>
                        <span>{u.points.toLocaleString()}P</span>
                        <span>·</span>
                        <span>가입 {formatDateShort(u.createdAt)}</span>
                      </div>
                    </div>

                    {!isSelfOrAdmin && (
                      <div className="flex flex-wrap items-center gap-1">
                        {banLabel ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSetUserBan(u.id, 0)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#6B9080] bg-[#222623] px-2.5 py-1 text-xs font-semibold text-[#6B9080] hover:bg-[#6B9080] hover:text-[#121413] disabled:opacity-50"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>정지 해제</span>
                          </button>
                        ) : (
                          [
                            { days: 1, label: "1일" },
                            { days: 7, label: "7일" },
                            { days: 30, label: "30일" },
                            { days: -1, label: "영구" },
                          ].map((opt) => (
                            <button
                              key={opt.days}
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleSetUserBan(u.id, opt.days)
                              }
                              className="rounded-md border border-[#282D2A] bg-[#151816] px-2 py-1 font-mono text-[11px] font-medium text-[#8F9691] transition-colors hover:border-[#E06C75] hover:text-[#E06C75] disabled:opacity-50"
                            >
                              {opt.label}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
