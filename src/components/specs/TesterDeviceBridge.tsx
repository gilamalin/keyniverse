"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Zap,
} from "lucide-react";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import {
  KEYBOARD_MIN_KEY_PRESSES,
  MOUSE_MIN_CLICKS,
  MOUSE_MIN_MOVE_SAMPLES,
  MOUSE_MIN_PEAK_HZ,
  saveMouseVerificationProof,
  saveSwitchVerificationProof,
} from "@/lib/spec-verification";
import { cn } from "@/lib/utils";

interface KeyboardDeviceCertBannerProps {
  totalKeyPresses: number;
  chatterCount: number;
  onReset: () => void;
}

/**
 * URL ?device=슬러그 파라미터가 있을 때만 키보드 테스터 최상단에 표시되는 실측 인증 진행 바
 */
export function KeyboardDeviceCertBanner({
  totalKeyPresses,
  chatterCount,
  onReset,
}: KeyboardDeviceCertBannerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceSlug = searchParams.get("device");

  if (!deviceSlug) return null;

  const targetSwitch = INITIAL_SWITCHES.find((sw) => sw.slug === deviceSlug);
  if (!targetSwitch) return null;

  const hasFault = chatterCount > 0;
  const isPassed =
    !hasFault && totalKeyPresses >= KEYBOARD_MIN_KEY_PRESSES;

  const handleSaveAndReturn = () => {
    const saved = saveSwitchVerificationProof({
      slug: targetSwitch.slug,
      totalKeyPresses,
      chatterCount,
    });
    if (saved) {
      router.push(
        `/specs?tab=switches&open=${encodeURIComponent(targetSwitch.slug)}`
      );
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-xl border px-4 py-3 lg:flex-row lg:items-center",
        hasFault
          ? "border-[#E06C75] bg-[#1A1D1B]"
          : isPassed
            ? "border-[#D4A373] bg-[#222623]"
            : "border-[#6B9080] bg-[#1A1D1B]"
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded bg-[#222623] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#D4A373]">
            <Zap className="size-3" />
            테스트 인증 모드
          </span>
          <span className="font-mono text-[#8F9691] tabular-nums">
            타건{" "}
            <strong
              className={cn(
                totalKeyPresses >= KEYBOARD_MIN_KEY_PRESSES
                  ? "text-[#6B9080]"
                  : "text-[#E4E6E1]"
              )}
            >
              {totalKeyPresses}/{KEYBOARD_MIN_KEY_PRESSES}회
            </strong>{" "}
            · 채터링{" "}
            <strong
              className={cn(hasFault ? "text-[#E06C75]" : "text-[#6B9080]")}
            >
              {chatterCount}회
            </strong>
          </span>
        </div>

        {hasFault && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#E06C75]">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>오류 감지 — 초기화 후 재측정이 필요합니다.</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {hasFault ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E06C75] bg-[#222623] px-3 py-1.5 text-xs font-semibold text-[#E06C75] transition-colors hover:bg-[#E06C75] hover:text-[#121413]"
          >
            <RotateCcw className="size-3.5" />
            <span>초기화 후 재측정</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!isPassed}
            onClick={handleSaveAndReturn}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              isPassed
                ? "border-[#D4A373] bg-[#D4A373] text-[#121413] hover:bg-[#DFB387]"
                : "cursor-not-allowed border-[#282D2A] bg-[#151816] text-[#8F9691] opacity-65"
            )}
          >
            <CheckCircle2 className="size-3.5" />
            <span>
              {isPassed ? "인증 완료 · 도감으로" : "50타 달성 시 인증"}
            </span>
          </button>
        )}

        <Link
          href={`/specs?tab=switches&open=${encodeURIComponent(targetSwitch.slug)}`}
          className="rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-1.5 text-xs font-medium text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
        >
          도감으로
        </Link>
      </div>
    </div>
  );
}

interface MouseDeviceCertBannerProps {
  moveSamples: number;
  peakHz: number;
  clickCount: number;
  doubleClickFaults: number;
  onResetAll: () => void;
}

/**
 * URL ?device=슬러그 파라미터가 있을 때만 마우스 테스터 최상단에 표시되는 실측 인증 진행 바
 */
export function MouseDeviceCertBanner({
  moveSamples,
  peakHz,
  clickCount,
  doubleClickFaults,
  onResetAll,
}: MouseDeviceCertBannerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deviceSlug = searchParams.get("device");

  if (!deviceSlug) return null;

  const targetMouse = INITIAL_MICE.find((ms) => ms.slug === deviceSlug);
  if (!targetMouse) return null;

  const hasFault = doubleClickFaults > 0;
  const sampleOk = moveSamples >= MOUSE_MIN_MOVE_SAMPLES;
  const peakOk = peakHz >= MOUSE_MIN_PEAK_HZ;
  const clickOk = clickCount >= MOUSE_MIN_CLICKS;
  const isPassed = !hasFault && sampleOk && peakOk && clickOk;

  const handleSaveAndReturn = () => {
    const saved = saveMouseVerificationProof({
      slug: targetMouse.slug,
      moveSamples,
      peakHz,
      clickCount,
      doubleClickFaults,
    });
    if (saved) {
      router.push(
        `/specs?tab=mice&open=${encodeURIComponent(targetMouse.slug)}`
      );
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-xl border px-4 py-3 lg:flex-row lg:items-center",
        hasFault
          ? "border-[#E06C75] bg-[#1A1D1B]"
          : isPassed
            ? "border-[#D4A373] bg-[#222623]"
            : "border-[#6B9080] bg-[#1A1D1B]"
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 rounded bg-[#222623] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#D4A373]">
            <Zap className="size-3" />
            테스트 인증 모드
          </span>
          <span className="font-mono text-[#8F9691] tabular-nums">
            샘플{" "}
            <strong className={sampleOk ? "text-[#6B9080]" : "text-[#E4E6E1]"}>
              {moveSamples.toLocaleString()}/
              {MOUSE_MIN_MOVE_SAMPLES.toLocaleString()}
            </strong>{" "}
            · 클릭{" "}
            <strong className={clickOk ? "text-[#6B9080]" : "text-[#E4E6E1]"}>
              {clickCount}/{MOUSE_MIN_CLICKS}회
            </strong>{" "}
            · Peak{" "}
            <strong className={peakOk ? "text-[#6B9080]" : "text-[#E4E6E1]"}>
              {peakOk
                ? `${peakHz.toLocaleString()}Hz (800Hz+ 달성)`
                : `${peakHz.toLocaleString()}/${MOUSE_MIN_PEAK_HZ}Hz`}
            </strong>{" "}
            · 더블클릭{" "}
            <strong
              className={hasFault ? "text-[#E06C75]" : "text-[#6B9080]"}
            >
              {doubleClickFaults}회
            </strong>
          </span>
        </div>

        {hasFault && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#E06C75]">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>오류 감지 — 초기화 후 재측정이 필요합니다.</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {hasFault ? (
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E06C75] bg-[#222623] px-3 py-1.5 text-xs font-semibold text-[#E06C75] transition-colors hover:bg-[#E06C75] hover:text-[#121413]"
          >
            <RotateCcw className="size-3.5" />
            <span>초기화 후 재측정</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!isPassed}
            onClick={handleSaveAndReturn}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors",
              isPassed
                ? "border-[#D4A373] bg-[#D4A373] text-[#121413] hover:bg-[#DFB387]"
                : "cursor-not-allowed border-[#282D2A] bg-[#151816] text-[#8F9691] opacity-65"
            )}
          >
            <CheckCircle2 className="size-3.5" />
            <span>
              {isPassed ? "인증 완료 · 도감으로" : "기준 달성 시 인증"}
            </span>
          </button>
        )}

        <Link
          href={`/specs?tab=mice&open=${encodeURIComponent(targetMouse.slug)}`}
          className="rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-1.5 text-xs font-medium text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
        >
          도감으로
        </Link>
      </div>
    </div>
  );
}

interface TesterToSpecsCompactBannerProps {
  targetTab: "switches" | "mice";
}

/**
 * 기존 테스터 페이지 하단 여백에 배치되는 컴팩트 스펙 도감 이동 배너
 */
export function TesterToSpecsCompactBanner({
  targetTab,
}: TesterToSpecsCompactBannerProps) {
  const isSwitches = targetTab === "switches";

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#282D2A] bg-[#1A1D1B] px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2.5 text-xs text-[#8F9691]">
        <BookOpen className="size-4 shrink-0 text-[#6B9080]" />
        <span>
          {isSwitches
            ? "스위치 공식 스펙과 유저 평가를 확인해 보세요."
            : "마우스 공식 스펙과 유저 평가를 확인해 보세요."}
        </span>
      </div>

      <Link
        href={isSwitches ? "/specs?tab=switches" : "/specs?tab=mice"}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#222623] px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-[#6B9080]"
      >
        <span>{isSwitches ? "스위치 도감" : "마우스 도감"}</span>
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
