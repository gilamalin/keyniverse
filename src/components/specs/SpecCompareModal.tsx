"use client";

import { useEffect } from "react";
import { ArrowLeftRight, Star, Trash2, X } from "lucide-react";
import {
  MOUSE_CONNECTION_LABELS,
  MOUSE_SHAPE_LABELS,
  MOUSE_SWITCH_TYPE_LABELS,
  MouseCommunityData,
  MouseSpec,
  SWITCH_CATEGORY_LABELS,
  SpecTabType,
  SwitchCommunityData,
  SwitchSpec,
} from "@/types/specs";
import { MIN_SAMPLE_THRESHOLD } from "@/lib/spec-verification";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";
import {
  MouseSilhouetteIcon,
  SwitchCrossSectionIcon,
} from "@/components/specs/SpecVisuals";
import { cn } from "@/lib/utils";

interface CompareChipItem {
  id: string;
  name: string;
  brand: string;
}

interface SpecCompareFloatingBarProps {
  items: CompareChipItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onOpenCompare: () => void;
}

/**
 * 화면 하단 중앙 플로팅 비교함 바 (#222623 배경 + #6B9080 1px 실선 테두리)
 */
export function SpecCompareFloatingBar({
  items,
  onRemoveItem,
  onClearAll,
  onOpenCompare,
}: SpecCompareFloatingBarProps) {
  if (items.length === 0) return null;

  const canCompare = items.length >= 2;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 mx-auto max-w-4xl px-3 sm:bottom-5 sm:px-4">
      <div className="pointer-events-auto flex flex-col justify-between gap-2.5 rounded-xl border border-[#6B9080] bg-[#222623] p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        {/* 좌측: 선택 카운트 & 선택된 제품명 칩 (모바일 1줄 가로 스크롤) */}
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:gap-2">
          <span className="shrink-0 rounded bg-[#6B9080] px-2 py-0.5 font-mono text-xs font-bold whitespace-nowrap text-[#121413] tabular-nums">
            비교 {items.length}/3
          </span>

          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex max-w-[150px] shrink-0 items-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-2.5 py-1 text-xs font-medium text-[#E4E6E1] sm:max-w-[200px]"
            >
              <span className="truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                aria-label={`${item.name} 비교함에서 제거`}
                className="shrink-0 rounded text-[#8F9691] transition-colors hover:text-[#E06C75]"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}

          {!canCompare && (
            <span className="shrink-0 text-xs whitespace-nowrap text-[#8F9691]">
              1개 더 선택하세요
            </span>
          )}
        </div>

        {/* 우측: [비우기] & [비교하기] */}
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClearAll}
            className="flex items-center gap-1 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#8F9691] transition-colors hover:border-[#E06C75] hover:text-[#E06C75] sm:py-2"
          >
            <Trash2 className="size-3.5" />
            <span>비우기</span>
          </button>

          <button
            type="button"
            disabled={!canCompare}
            onClick={onOpenCompare}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors sm:py-2",
              canCompare
                ? "border-[#6B9080] bg-[#6B9080] text-[#121413] hover:bg-[#7CA291]"
                : "cursor-not-allowed border-[#282D2A] bg-[#151816] text-[#8F9691] opacity-60"
            )}
          >
            <ArrowLeftRight className="size-3.5" />
            <span>비교하기</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface LowestMetricCell {
  isLowest: boolean;
  deltaText: string | null;
}

function formatMetricNumber(val: number, maxDecimals: number): string {
  if (maxDecimals === 0) return String(Math.round(val));
  const rounded = Math.round(val * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function evaluateLowestMetric(
  values: Array<number | null>,
  unit: string,
  maxDecimals: number
): LowestMetricCell[] {
  if (values.length < 2 || values.some((v) => v === null)) {
    return values.map(() => ({ isLowest: false, deltaText: null }));
  }

  const nums = values as number[];
  const minVal = Math.min(...nums);
  const maxVal = Math.max(...nums);

  if (Math.abs(maxVal - minVal) < 0.001) {
    return values.map(() => ({ isLowest: false, deltaText: null }));
  }

  return nums.map((v) => {
    const diff = v - minVal;
    if (Math.abs(diff) < 0.001) {
      return { isLowest: true, deltaText: null };
    }
    return {
      isLowest: false,
      deltaText: `+${formatMetricNumber(diff, maxDecimals)}${unit}`,
    };
  });
}

function evaluateHighestObjective(values: Array<number | null>): boolean[] {
  if (values.length < 2 || values.some((v) => v === null)) {
    return values.map(() => false);
  }
  const nums = values as number[];
  const minVal = Math.min(...nums);
  const maxVal = Math.max(...nums);

  if (Math.abs(maxVal - minVal) < 0.001) {
    return values.map(() => false);
  }

  return nums.map((v) => Math.abs(v - maxVal) < 0.001);
}

interface SpecCompareModalProps {
  open: boolean;
  tab: SpecTabType;
  switches: SwitchSpec[];
  mice: MouseSpec[];
  switchCommunities: Record<string, SwitchCommunityData>;
  mouseCommunities: Record<string, MouseCommunityData>;
  onClose: () => void;
  onSelectDetail: (id: string) => void;
}

export function SpecCompareModal({
  open,
  tab,
  switches,
  mice,
  switchCommunities,
  mouseCommunities,
  onClose,
  onSelectDetail,
}: SpecCompareModalProps) {
  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  if (!open) return null;

  const isSwitchMode = tab === "switches";
  const count = isSwitchMode ? switches.length : mice.length;
  if (count < 2) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2.5 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isSwitchMode ? "스위치 비교" : "마우스 비교"}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
      >
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between gap-4 border-b border-[#282D2A] bg-[#151816] px-4 py-3.5 sm:px-5">
          <h2 className="text-base font-bold text-[#E4E6E1] sm:text-lg">
            {isSwitchMode ? "스위치 비교" : "마우스 비교"}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="비교 모달 닫기"
            className="flex size-8 items-center justify-center rounded-lg border border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 스크롤 본문 테이블 (내부 overflow-x-auto 래퍼 기준으로 좌측 '항목' 열 sticky 고정) */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div className="overflow-x-auto rounded-xl border border-[#282D2A]">
            {isSwitchMode ? (
              <SwitchCompareTable
                switches={switches}
                communities={switchCommunities}
                onSelectDetail={(id) => {
                  onClose();
                  onSelectDetail(id);
                }}
              />
            ) : (
              <MouseCompareTable
                mice={mice}
                communities={mouseCommunities}
                onSelectDetail={(id) => {
                  onClose();
                  onSelectDetail(id);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const STICKY_LABEL_CELL =
  "sticky left-0 z-10 border-r border-[#282D2A] bg-[#151816] px-2.5 py-2.5 font-medium text-[#8F9691] whitespace-nowrap sm:px-4 sm:py-3";
const DATA_CELL = "px-2.5 py-2.5 sm:px-4 sm:py-3";
const COMPARE_TABLE_BASE =
  "w-full table-fixed border-separate border-spacing-0 text-xs [&_thead_th]:border-b [&_thead_th]:border-[#282D2A] [&_tbody_tr:not(:last-child)_td]:border-b [&_tbody_tr:not(:last-child)_td]:border-[#282D2A]";

function SwitchCompareTable({
  switches,
  communities,
  onSelectDetail,
}: {
  switches: SwitchSpec[];
  communities: Record<string, SwitchCommunityData>;
  onSelectDetail: (id: string) => void;
}) {
  const ratingValues = switches.map((sw) => {
    const comm = communities[sw.id] ?? sw.community;
    return comm.reviewCount >= MIN_SAMPLE_THRESHOLD ? comm.ratingAvg : null;
  });
  const ratingWinners = evaluateHighestObjective(ratingValues);

  const opForceCells = evaluateLowestMetric(
    switches.map((sw) => sw.operatingForceGf),
    "gf",
    0
  );
  const bottomForceCells = evaluateLowestMetric(
    switches.map((sw) => sw.bottomOutForceGf),
    "gf",
    0
  );
  const preTravelCells = evaluateLowestMetric(
    switches.map((sw) => sw.preTravelMm),
    "mm",
    1
  );
  const totalTravelCells = evaluateLowestMetric(
    switches.map((sw) => sw.totalTravelMm),
    "mm",
    1
  );
  const springLenCells = evaluateLowestMetric(
    switches.map((sw) => sw.springLengthMm),
    "mm",
    1
  );

  return (
    <table
      className={cn(
        COMPARE_TABLE_BASE,
        switches.length >= 3 ? "min-w-[540px]" : "min-w-[400px]"
      )}
    >
      <thead>
        <tr className="border-b border-[#282D2A] bg-[#151816]">
          <th className="sticky left-0 z-20 w-[88px] border-r border-[#282D2A] bg-[#151816] px-2.5 py-3 text-left font-semibold text-[#8F9691] sm:w-[130px] sm:px-4 sm:py-3.5">
            항목
          </th>
          {switches.map((sw) => (
            <th
              key={sw.id}
              className="px-2.5 py-3 text-left align-top sm:px-4 sm:py-3.5"
            >
              <div className="flex items-center gap-2.5">
                <SwitchCrossSectionIcon
                  colorway={sw.colorway}
                  pins={sw.pins}
                  className="hidden size-10 shrink-0 sm:block"
                />
                <div className="min-w-0 flex-1">
                  <span className="block font-mono text-[10px] font-semibold text-[#6B9080]">
                    {sw.brand}
                  </span>
                  <span className="block truncate text-xs font-bold text-[#E4E6E1] sm:text-sm">
                    {sw.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectDetail(sw.id)}
                    className="mt-1 inline-block font-mono text-[11px] font-medium text-[#8F9691] underline-offset-2 hover:text-[#D4A373] hover:underline"
                  >
                    상세 보기 →
                  </button>
                </div>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#282D2A] bg-[#1A1D1B]">
        {/* 1. 평점 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>평점</td>
          {switches.map((sw, idx) => {
            const comm = communities[sw.id] ?? sw.community;
            const enoughSample = comm.reviewCount >= MIN_SAMPLE_THRESHOLD;
            const isWin = ratingWinners[idx];
            return (
              <td
                key={sw.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                {enoughSample ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        isWin ? "text-[#D4A373]" : "text-[#E4E6E1]"
                      )}
                    >
                      <Star className="size-3.5 fill-[#D4A373] text-[#D4A373]" />
                      {comm.ratingAvg.toFixed(1)}
                    </span>
                    <span className="text-[#8F9691]">({comm.reviewCount})</span>
                    {isWin && (
                      <span className="rounded border border-[#D4A373]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#D4A373]">
                        최고
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[#8F9691]">
                    표본 부족 ({comm.reviewCount}/{MIN_SAMPLE_THRESHOLD})
                  </span>
                )}
              </td>
            );
          })}
        </tr>

        {/* 2. 분류 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>분류</td>
          {switches.map((sw) => (
            <td
              key={sw.id}
              className={cn(DATA_CELL, "font-medium text-[#E4E6E1]")}
            >
              {SWITCH_CATEGORY_LABELS[sw.category]}
            </td>
          ))}
        </tr>

        {/* 3. 입력압 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>입력압</td>
          {switches.map((sw, idx) => {
            const cell = opForceCells[idx];
            return (
              <td
                key={sw.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold",
                      cell.isLowest ? "text-[#6B9080]" : "text-[#E4E6E1]"
                    )}
                  >
                    {sw.operatingForceGf}gf
                  </span>
                  {cell.isLowest && (
                    <span className="rounded border border-[#6B9080]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#6B9080]">
                      최저
                    </span>
                  )}
                  {cell.deltaText && (
                    <span className="text-[11px] text-[#8F9691]">
                      ({cell.deltaText})
                    </span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>

        {/* 4. 바닥압 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>바닥압</td>
          {switches.map((sw, idx) => {
            const cell = bottomForceCells[idx];
            if (sw.bottomOutForceGf === null) {
              return (
                <td key={sw.id} className={cn(DATA_CELL, "text-[#8F9691]")}>
                  미공개
                </td>
              );
            }
            return (
              <td
                key={sw.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold",
                      cell.isLowest ? "text-[#6B9080]" : "text-[#E4E6E1]"
                    )}
                  >
                    {sw.bottomOutForceGf}gf
                  </span>
                  {cell.isLowest && (
                    <span className="rounded border border-[#6B9080]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#6B9080]">
                      최저
                    </span>
                  )}
                  {cell.deltaText && (
                    <span className="text-[11px] text-[#8F9691]">
                      ({cell.deltaText})
                    </span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>

        {/* 5. 입력 지점 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>입력 지점</td>
          {switches.map((sw, idx) => {
            const cell = preTravelCells[idx];
            return (
              <td
                key={sw.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold",
                      cell.isLowest ? "text-[#6B9080]" : "text-[#E4E6E1]"
                    )}
                  >
                    {sw.preTravelMm.toFixed(1)}mm
                  </span>
                  {cell.isLowest && (
                    <span className="rounded border border-[#6B9080]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#6B9080]">
                      최단
                    </span>
                  )}
                  {cell.deltaText && (
                    <span className="text-[11px] text-[#8F9691]">
                      ({cell.deltaText})
                    </span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>

        {/* 6. 총 스트로크 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>총 스트로크</td>
          {switches.map((sw, idx) => {
            const cell = totalTravelCells[idx];
            return (
              <td
                key={sw.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold",
                      cell.isLowest ? "text-[#6B9080]" : "text-[#E4E6E1]"
                    )}
                  >
                    {sw.totalTravelMm.toFixed(1)}mm
                  </span>
                  {cell.isLowest && (
                    <span className="rounded border border-[#6B9080]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#6B9080]">
                      최단
                    </span>
                  )}
                  {cell.deltaText && (
                    <span className="text-[11px] text-[#8F9691]">
                      ({cell.deltaText})
                    </span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>

        {/* 7. 스프링 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>스프링</td>
          {switches.map((sw, idx) => {
            const cell = springLenCells[idx];
            if (sw.springLengthMm === null) {
              return (
                <td key={sw.id} className={cn(DATA_CELL, "text-[#8F9691]")}>
                  미공개
                </td>
              );
            }
            return (
              <td
                key={sw.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold",
                      cell.isLowest ? "text-[#6B9080]" : "text-[#E4E6E1]"
                    )}
                  >
                    {formatMetricNumber(sw.springLengthMm, 1)}mm (
                    {sw.springType ?? "표준"})
                  </span>
                  {cell.isLowest && (
                    <span className="rounded border border-[#6B9080]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#6B9080]">
                      최단
                    </span>
                  )}
                  {cell.deltaText && (
                    <span className="text-[11px] text-[#8F9691]">
                      ({cell.deltaText})
                    </span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>

        {/* 8~10. 소재 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>상부 하우징</td>
          {switches.map((sw) => (
            <td
              key={sw.id}
              className={cn(DATA_CELL, "font-mono font-medium text-[#E4E6E1]")}
            >
              {sw.materials.top}
            </td>
          ))}
        </tr>
        <tr>
          <td className={STICKY_LABEL_CELL}>하부 하우징</td>
          {switches.map((sw) => (
            <td
              key={sw.id}
              className={cn(DATA_CELL, "font-mono font-medium text-[#E4E6E1]")}
            >
              {sw.materials.bottom}
            </td>
          ))}
        </tr>
        <tr>
          <td className={STICKY_LABEL_CELL}>스템</td>
          {switches.map((sw) => (
            <td
              key={sw.id}
              className={cn(DATA_CELL, "font-mono font-medium text-[#E4E6E1]")}
            >
              {sw.materials.stem}
            </td>
          ))}
        </tr>

        {/* 11. 윤활 · 핀 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>윤활 · 핀</td>
          {switches.map((sw) => (
            <td key={sw.id} className={cn(DATA_CELL, "text-[#E4E6E1]")}>
              {sw.factoryLubed ? "윤활" : "비윤활"} ·{" "}
              <span className="font-mono tabular-nums">{sw.pins}핀</span>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function MouseCompareTable({
  mice,
  communities,
  onSelectDetail,
}: {
  mice: MouseSpec[];
  communities: Record<string, MouseCommunityData>;
  onSelectDetail: (id: string) => void;
}) {
  const pollingWinners = evaluateHighestObjective(
    mice.map((ms) => ms.maxPollingHz)
  );

  const ratingValues = mice.map((ms) => {
    const comm = communities[ms.id] ?? ms.community;
    return comm.reviewCount >= MIN_SAMPLE_THRESHOLD ? comm.ratingAvg : null;
  });
  const ratingWinners = evaluateHighestObjective(ratingValues);

  const weightCells = evaluateLowestMetric(
    mice.map((ms) => ms.weightGrams),
    "g",
    1
  );

  return (
    <table
      className={cn(
        COMPARE_TABLE_BASE,
        mice.length >= 3 ? "min-w-[540px]" : "min-w-[400px]"
      )}
    >
      <thead>
        <tr className="border-b border-[#282D2A] bg-[#151816]">
          <th className="sticky left-0 z-20 w-[88px] border-r border-[#282D2A] bg-[#151816] px-2.5 py-3 text-left font-semibold text-[#8F9691] sm:w-[130px] sm:px-4 sm:py-3.5">
            항목
          </th>
          {mice.map((ms) => (
            <th
              key={ms.id}
              className="px-2.5 py-3 text-left align-top sm:px-4 sm:py-3.5"
            >
              <div className="flex items-center gap-2.5">
                <MouseSilhouetteIcon
                  shape={ms.shape}
                  accentHex={ms.colorAccentHex}
                  className="hidden size-10 shrink-0 sm:block"
                />
                <div className="min-w-0 flex-1">
                  <span className="block font-mono text-[10px] font-semibold text-[#6B9080]">
                    {ms.brand}
                  </span>
                  <span className="block truncate text-xs font-bold text-[#E4E6E1] sm:text-sm">
                    {ms.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectDetail(ms.id)}
                    className="mt-1 inline-block font-mono text-[11px] font-medium text-[#8F9691] underline-offset-2 hover:text-[#D4A373] hover:underline"
                  >
                    상세 보기 →
                  </button>
                </div>
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#282D2A] bg-[#1A1D1B]">
        {/* 1. 평점 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>평점</td>
          {mice.map((ms, idx) => {
            const comm = communities[ms.id] ?? ms.community;
            const enoughSample = comm.reviewCount >= MIN_SAMPLE_THRESHOLD;
            const isWin = ratingWinners[idx];
            return (
              <td
                key={ms.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                {enoughSample ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        isWin ? "text-[#D4A373]" : "text-[#E4E6E1]"
                      )}
                    >
                      <Star className="size-3.5 fill-[#D4A373] text-[#D4A373]" />
                      {comm.ratingAvg.toFixed(1)}
                    </span>
                    <span className="text-[#8F9691]">({comm.reviewCount})</span>
                    {isWin && (
                      <span className="rounded border border-[#D4A373]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#D4A373]">
                        최고
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[#8F9691]">
                    표본 부족 ({comm.reviewCount}/{MIN_SAMPLE_THRESHOLD})
                  </span>
                )}
              </td>
            );
          })}
        </tr>

        {/* 2. 폴링레이트 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>폴링레이트</td>
          {mice.map((ms, idx) => {
            const isWin = pollingWinners[idx];
            return (
              <td
                key={ms.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold",
                      isWin ? "text-[#D4A373]" : "text-[#E4E6E1]"
                    )}
                  >
                    {ms.maxPollingHz.toLocaleString()}Hz
                  </span>
                  {isWin && (
                    <span className="rounded border border-[#D4A373]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#D4A373]">
                      최고
                    </span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>

        {/* 3. 무게 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>무게</td>
          {mice.map((ms, idx) => {
            const cell = weightCells[idx];
            return (
              <td
                key={ms.id}
                className={cn(DATA_CELL, "font-mono tabular-nums")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "font-semibold",
                      cell.isLowest ? "text-[#6B9080]" : "text-[#E4E6E1]"
                    )}
                  >
                    {formatMetricNumber(ms.weightGrams, 1)}g
                  </span>
                  {cell.isLowest && (
                    <span className="rounded border border-[#6B9080]/50 bg-[#222623] px-1.5 py-0.5 font-sans text-[10px] font-semibold text-[#6B9080]">
                      최경량
                    </span>
                  )}
                  {cell.deltaText && (
                    <span className="text-[11px] text-[#8F9691]">
                      ({cell.deltaText})
                    </span>
                  )}
                </div>
              </td>
            );
          })}
        </tr>

        {/* 4. 쉘 · 연결 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>쉘 · 연결</td>
          {mice.map((ms) => (
            <td key={ms.id} className={cn(DATA_CELL, "text-[#E4E6E1]")}>
              {MOUSE_SHAPE_LABELS[ms.shape]} ·{" "}
              {MOUSE_CONNECTION_LABELS[ms.connection]}
            </td>
          ))}
        </tr>

        {/* 5. 크기 (L×W×H) */}
        <tr>
          <td className={STICKY_LABEL_CELL}>크기 (L×W×H)</td>
          {mice.map((ms) => (
            <td
              key={ms.id}
              className={cn(
                DATA_CELL,
                "font-mono font-medium text-[#E4E6E1] tabular-nums"
              )}
            >
              {ms.dimensionsMm.length} × {ms.dimensionsMm.width} ×{" "}
              <span className="text-[#6B9080]">
                {ms.dimensionsMm.height}mm
              </span>
            </td>
          ))}
        </tr>

        {/* 6. 센서 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>센서</td>
          {mice.map((ms) => (
            <td
              key={ms.id}
              className={cn(DATA_CELL, "font-mono font-semibold text-[#E4E6E1]")}
            >
              {ms.sensor}
            </td>
          ))}
        </tr>

        {/* 7. 스위치 */}
        <tr>
          <td className={STICKY_LABEL_CELL}>스위치</td>
          {mice.map((ms) => (
            <td key={ms.id} className={cn(DATA_CELL, "text-[#E4E6E1]")}>
              {ms.switchModel} ({MOUSE_SWITCH_TYPE_LABELS[ms.switchType]})
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
