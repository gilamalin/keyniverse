"use client";

import { useState } from "react";
import { ArrowUpDown, Filter, RotateCcw, Search, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface CatalogSidebarShellProps {
  title: string;
  activeFilterCount: number;
  mobileFilterOpen: boolean;
  onResetFilters: () => void;
  children: React.ReactNode;
}

/**
 * 스펙 도감 전 카테고리(스위치 · 마우스 · 추후 기성품 키보드 등) 공용 좌측 Sticky 필터 사이드바 껍데기
 */
export function CatalogSidebarShell({
  title,
  activeFilterCount,
  mobileFilterOpen,
  onResetFilters,
  children,
}: CatalogSidebarShellProps) {
  return (
    <aside
      className={cn(
        "w-full rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-4 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-5.5rem)] lg:w-[280px] lg:shrink-0 lg:overflow-y-auto",
        mobileFilterOpen ? "block" : "hidden"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#282D2A] pb-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <Filter className="size-4 shrink-0 text-[#6B9080]" />
          <h2 className="text-sm font-semibold text-[#E4E6E1]">{title}</h2>
          {activeFilterCount > 0 && (
            <span className="rounded bg-[#6B9080]/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#6B9080] tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onResetFilters}
          disabled={activeFilterCount === 0}
          className="flex shrink-0 items-center gap-1 rounded-md border border-[#282D2A] bg-[#151816] px-2 py-1 text-xs font-medium text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="size-3" />
          <span>필터 초기화</span>
        </button>
      </div>

      <div className="flex flex-col gap-3.5">{children}</div>
    </aside>
  );
}

export interface CatalogSortOption<T extends string> {
  value: T;
  label: string;
}

interface CatalogSearchSortBarProps<T extends string> {
  searchQuery: string;
  onSearchChange: (next: string) => void;
  searchPlaceholder: string;
  totalCount: number;
  sortAriaLabel: string;
  sortValue: T;
  sortOptions: ReadonlyArray<CatalogSortOption<T>>;
  onSortChange: (next: T) => void;
}

/**
 * 스펙 도감 전 카테고리 공용 상단 검색창 · 총 건수 · 정렬 드롭다운 바
 */
export function CatalogSearchSortBar<T extends string>({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  totalCount,
  sortAriaLabel,
  sortValue,
  sortOptions,
  onSortChange,
}: CatalogSearchSortBarProps<T>) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-3.5 sm:flex-row sm:items-center">
      {/* 검색 입력창 */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#8F9691]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-lg border border-[#282D2A] bg-[#151816] pr-8 pl-9 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="검색어 지우기"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[#8F9691] hover:text-[#E4E6E1]"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* 검색 결과 건수 + 정렬 드롭다운 */}
      <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-[#282D2A] bg-[#151816] px-2.5 py-1.5 text-xs whitespace-nowrap text-[#8F9691]">
          <span>총</span>
          <span className="font-mono font-bold text-[#6B9080] tabular-nums">
            {totalCount}
          </span>
          <span>개</span>
        </div>

        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="size-3.5 shrink-0 text-[#8F9691]" />
          <select
            aria-label={sortAriaLabel}
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value as T)}
            className="h-9 rounded-lg border border-[#282D2A] bg-[#151816] px-2 text-xs font-medium text-[#E4E6E1] focus:border-[#6B9080] focus:outline-none"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function EmptyFilterState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#282D2A] bg-[#1A1D1B] px-6 py-16 text-center">
      <p className="text-sm font-semibold text-[#E4E6E1]">
        선택한 다중 필터 조건에 일치하는 기기가 없습니다.
      </p>
      <p className="mt-1 text-xs text-[#8F9691]">
        슬라이더 범위를 넓히거나 일부 필터 조건을 해제해 보세요.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#222623] px-3.5 py-2 text-xs font-semibold text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
      >
        <RotateCcw className="size-3.5" />
        <span>필터 전체 초기화</span>
      </button>
    </div>
  );
}

interface RangeSliderWithInputsProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  allowDecimals?: boolean;
  fixedDecimals?: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
  midLabel: string;
}

/**
 * 슬라이더 조작 + 직접 수치 입력을 동시에 지원하는 공용 범위 필터 컨트롤
 */
export function RangeSliderWithInputs({
  label,
  unit,
  min,
  max,
  step,
  allowDecimals = false,
  fixedDecimals,
  value,
  onChange,
  midLabel,
}: RangeSliderWithInputsProps) {
  const [editingSide, setEditingSide] = useState<"min" | "max" | null>(null);
  const [draftText, setDraftText] = useState<string>("");

  const formatNum = (n: number) => {
    if (fixedDecimals !== undefined) {
      return n.toFixed(fixedDecimals);
    }
    return allowDecimals
      ? Number.isInteger(n)
        ? String(n)
        : n.toFixed(1)
      : String(Math.round(n));
  };

  const commitDraft = (side: "min" | "max") => {
    const trimmed = draftText.trim();
    const parsed = Number.parseFloat(trimmed);

    if (trimmed === "" || Number.isNaN(parsed)) {
      setEditingSide(null);
      setDraftText("");
      return;
    }

    const rounded = allowDecimals
      ? Math.round(parsed * 10) / 10
      : Math.round(parsed);
    const clampedToBounds = Math.max(min, Math.min(max, rounded));

    if (side === "min") {
      const safeMin = Math.min(clampedToBounds, value[1]);
      onChange([safeMin, value[1]]);
    } else {
      const safeMax = Math.max(clampedToBounds, value[0]);
      onChange([value[0], safeMax]);
    }

    setEditingSide(null);
    setDraftText("");
  };

  const handleInputChange = (raw: string) => {
    const pattern = allowDecimals ? /^\d*\.?\d*$/ : /^\d*$/;
    if (pattern.test(raw)) {
      setDraftText(raw);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span className="shrink-0 text-xs font-semibold text-[#E4E6E1]">
          {label}
        </span>

        <div className="flex items-center gap-1 font-mono text-xs tabular-nums">
          <input
            type="text"
            inputMode={allowDecimals ? "decimal" : "numeric"}
            aria-label={`${label} 최솟값 (${unit})`}
            value={editingSide === "min" ? draftText : formatNum(value[0])}
            onFocus={(e) => {
              setEditingSide("min");
              setDraftText(formatNum(value[0]));
              e.currentTarget.select();
            }}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={() => commitDraft("min")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setEditingSide(null);
                setDraftText("");
              }
            }}
            className="h-6 w-12 rounded border border-[#282D2A] bg-[#151816] px-1.5 text-center font-mono text-xs font-semibold text-[#6B9080] tabular-nums focus:border-[#6B9080] focus:text-[#E4E6E1] focus:outline-none"
          />
          <span className="text-[#8F9691]">~</span>
          <input
            type="text"
            inputMode={allowDecimals ? "decimal" : "numeric"}
            aria-label={`${label} 최댓값 (${unit})`}
            value={editingSide === "max" ? draftText : formatNum(value[1])}
            onFocus={(e) => {
              setEditingSide("max");
              setDraftText(formatNum(value[1]));
              e.currentTarget.select();
            }}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={() => commitDraft("max")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setEditingSide(null);
                setDraftText("");
              }
            }}
            className="h-6 w-12 rounded border border-[#282D2A] bg-[#151816] px-1.5 text-center font-mono text-xs font-semibold text-[#6B9080] tabular-nums focus:border-[#6B9080] focus:text-[#E4E6E1] focus:outline-none"
          />
          <span className="text-[11px] font-medium text-[#8F9691]">{unit}</span>
        </div>
      </div>

      <div className="px-2 py-1.5">
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={(val) => {
            if (Array.isArray(val) && val.length === 2) {
              onChange([
                allowDecimals
                  ? Math.round(val[0] * 10) / 10
                  : Math.round(val[0]),
                allowDecimals
                  ? Math.round(val[1] * 10) / 10
                  : Math.round(val[1]),
              ]);
            }
          }}
        />
      </div>

      <div className="mt-0.5 flex justify-between font-mono text-[10px] text-[#8F9691] tabular-nums">
        <span>
          {formatNum(min)}
          {unit}
        </span>
        <span>{midLabel}</span>
        <span>
          {formatNum(max)}
          {unit}
        </span>
      </div>
    </div>
  );
}
