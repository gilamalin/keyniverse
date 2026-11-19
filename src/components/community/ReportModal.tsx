"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Siren, X } from "lucide-react";
import {
  REPORT_REASONS,
  ReportReason,
  ReportTargetType,
  hasReportedTarget,
  submitReport,
} from "@/lib/activity-store";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";
import { cn } from "@/lib/utils";

export interface ReportTargetInfo {
  targetType: ReportTargetType;
  targetId: string;
}

interface ReportModalProps {
  target: ReportTargetInfo | null;
  onClose: () => void;
}

const TARGET_LABEL: Record<ReportTargetType, string> = {
  post: "게시글",
  comment: "댓글",
  reply: "답글",
};

const REPORT_DETAIL_MAX_LENGTH = 100;

export function ReportModal({ target, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [detail, setDetail] = useState<string>("");
  const [submitted, setSubmitted] = useState<boolean>(false);

  const alreadyReported = target
    ? hasReportedTarget(target.targetType, target.targetId)
    : false;

  useEffect(() => {
    if (!target) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const releaseScrollLock = acquireBodyScrollLock();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [target, onClose]);

  if (!target) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadyReported) return;
    const res = submitReport({
      targetType: target.targetType,
      targetId: target.targetId,
      reason,
      detail,
    });
    if (res.ok) {
      setSubmitted(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${TARGET_LABEL[target.targetType]} 신고`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-[#282D2A] bg-[#151816] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Siren className="size-4 text-[#E06C75]" />
            <h2 className="text-sm font-bold text-[#E4E6E1]">
              {TARGET_LABEL[target.targetType]} 신고
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="신고 모달 닫기"
            className="flex size-7 items-center justify-center rounded-lg border border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5">
          {submitted ? (
            <div className="flex flex-col items-center py-3 text-center">
              <CheckCircle2 className="size-7 text-[#6B9080]" />
              <p className="mt-2.5 text-sm font-semibold text-[#E4E6E1]">
                신고가 접수되었습니다.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-lg border border-[#6B9080] bg-[#222623] py-2 text-xs font-semibold text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
              >
                확인
              </button>
            </div>
          ) : alreadyReported ? (
            <div className="flex flex-col items-center py-3 text-center">
              <p className="text-xs font-medium text-[#8F9691]">
                이미 신고한 {TARGET_LABEL[target.targetType]}입니다.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-lg border border-[#282D2A] bg-[#222623] py-2 text-xs font-semibold text-[#E4E6E1] transition-colors hover:border-[#6B9080]"
              >
                닫기
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                {REPORT_REASONS.map((item) => {
                  const active = reason === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setReason(item)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                        active
                          ? "border-[#E06C75] bg-[#222623] text-[#E4E6E1]"
                          : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                      )}
                    >
                      <span>{item}</span>
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          active ? "bg-[#E06C75]" : "bg-[#282D2A]"
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-[#8F9691]">
                  <label htmlFor="report-detail-input">상세 사유 (선택)</label>
                  <span className="font-mono tabular-nums">
                    {detail.length}/{REPORT_DETAIL_MAX_LENGTH}
                  </span>
                </div>
                <input
                  id="report-detail-input"
                  type="text"
                  maxLength={REPORT_DETAIL_MAX_LENGTH}
                  value={detail}
                  onChange={(e) =>
                    setDetail(e.target.value.slice(0, REPORT_DETAIL_MAX_LENGTH))
                  }
                  placeholder="간단한 내용을 입력하세요..."
                  className="h-9 w-full rounded-lg border border-[#282D2A] bg-[#151816] px-3 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#E06C75] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#282D2A] bg-[#151816] px-3.5 py-1.5 text-xs font-semibold text-[#8F9691] transition-colors hover:text-[#E4E6E1]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-[#E06C75] bg-[#E06C75] px-4 py-1.5 text-xs font-bold text-[#121413] transition-colors hover:opacity-90"
                >
                  신고 접수
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
