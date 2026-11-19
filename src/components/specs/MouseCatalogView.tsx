"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Star } from "lucide-react";
import {
  MOUSE_SHAPE_LABELS,
  MOUSE_SWITCH_TYPE_LABELS,
  MouseCommunityData,
  MouseConnection,
  MousePollingHz,
  MouseShape,
  MouseSpec,
  MouseSwitchType,
} from "@/types/specs";
import { MouseSilhouetteIcon } from "@/components/specs/SpecVisuals";
import {
  CatalogSearchSortBar,
  CatalogSidebarShell,
  CatalogSortOption,
  EmptyFilterState,
  RangeSliderWithInputs,
} from "@/components/specs/CatalogSharedUI";
import { cn } from "@/lib/utils";

type MouseSortOption =
  | "rating_desc"
  | "weight_asc"
  | "weight_desc"
  | "polling_desc"
  | "name_asc";

const MOUSE_SORT_OPTIONS: ReadonlyArray<CatalogSortOption<MouseSortOption>> = [
  { value: "rating_desc", label: "별점순" },
  { value: "weight_asc", label: "무게 가벼운순" },
  { value: "weight_desc", label: "무게 무거운순" },
  { value: "polling_desc", label: "폴링레이트순" },
  { value: "name_asc", label: "이름순" },
];

const ALL_POLLING_RATES: MousePollingHz[] = [8000, 4000, 1000];

const SENSOR_KEYWORDS = [
  "ALL",
  "PAW3950",
  "PAW3395",
  "Focus Pro",
  "HERO 2",
] as const;

const WEIGHT_MIN = 25;
const WEIGHT_MAX = 140;

interface MouseCatalogViewProps {
  mice: MouseSpec[];
  communities: Record<string, MouseCommunityData>;
  compareIds: string[];
  compareLimitNotice: boolean;
  mobileFilterOpen: boolean;
  onActiveFilterCountChange: (count: number) => void;
  onToggleCompare: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

export function MouseCatalogView({
  mice,
  communities,
  compareIds,
  compareLimitNotice,
  mobileFilterOpen,
  onActiveFilterCountChange,
  onToggleCompare,
  onOpenDetail,
}: MouseCatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedPollingRates, setSelectedPollingRates] = useState<
    MousePollingHz[]
  >([]);
  const [connectionFilter, setConnectionFilter] = useState<
    "all" | MouseConnection
  >("all");
  const [shapeFilter, setShapeFilter] = useState<"all" | MouseShape>("all");
  const [weightRange, setWeightRange] = useState<[number, number]>([
    WEIGHT_MIN,
    WEIGHT_MAX,
  ]);
  const [mouseSwitchFilter, setMouseSwitchFilter] = useState<
    "all" | MouseSwitchType
  >("all");
  const [sensorKeyword, setSensorKeyword] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<MouseSortOption>("rating_desc");

  // 전달받은 마우스 목록에서 제조사(Brand) 동적 추출 (하드코딩 제거)
  const availableBrands = useMemo(
    () => Array.from(new Set(mice.map((ms) => ms.brand))),
    [mice]
  );

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((item) => item !== brand)
        : [...prev, brand]
    );
  };

  const togglePollingRate = (hz: MousePollingHz) => {
    setSelectedPollingRates((prev) =>
      prev.includes(hz) ? prev.filter((item) => item !== hz) : [...prev, hz]
    );
  };

  const resetFilters = () => {
    setSelectedBrands([]);
    setSelectedPollingRates([]);
    setConnectionFilter("all");
    setShapeFilter("all");
    setWeightRange([WEIGHT_MIN, WEIGHT_MAX]);
    setMouseSwitchFilter("all");
    setSensorKeyword("ALL");
    setSearchQuery("");
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedBrands.length > 0) count += 1;
    if (selectedPollingRates.length > 0) count += 1;
    if (connectionFilter !== "all") count += 1;
    if (shapeFilter !== "all") count += 1;
    if (weightRange[0] > WEIGHT_MIN || weightRange[1] < WEIGHT_MAX) count += 1;
    if (mouseSwitchFilter !== "all") count += 1;
    if (sensorKeyword !== "ALL") count += 1;
    if (searchQuery.trim().length > 0) count += 1;
    return count;
  }, [
    selectedBrands,
    selectedPollingRates,
    connectionFilter,
    shapeFilter,
    weightRange,
    mouseSwitchFilter,
    sensorKeyword,
    searchQuery,
  ]);

  useEffect(() => {
    onActiveFilterCountChange(activeFilterCount);
  }, [activeFilterCount, onActiveFilterCountChange]);

  const filteredMice = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = mice.filter((ms) => {
      if (selectedBrands.length > 0 && !selectedBrands.includes(ms.brand)) {
        return false;
      }

      if (
        selectedPollingRates.length > 0 &&
        !selectedPollingRates.includes(ms.maxPollingHz)
      ) {
        return false;
      }

      if (connectionFilter !== "all" && ms.connection !== connectionFilter) {
        return false;
      }

      if (shapeFilter !== "all" && ms.shape !== shapeFilter) {
        return false;
      }

      if (ms.weightGrams < weightRange[0] || ms.weightGrams > weightRange[1]) {
        return false;
      }

      if (
        mouseSwitchFilter !== "all" &&
        ms.switchType !== mouseSwitchFilter
      ) {
        return false;
      }

      if (sensorKeyword !== "ALL") {
        if (!ms.sensor.toLowerCase().includes(sensorKeyword.toLowerCase())) {
          return false;
        }
      }

      if (q.length > 0) {
        const haystack =
          `${ms.name} ${ms.nameEn} ${ms.brand} ${MOUSE_SHAPE_LABELS[ms.shape]} ${ms.sensor} ${ms.switchModel}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortOption === "rating_desc") {
        const ca = communities[a.id] ?? a.community;
        const cb = communities[b.id] ?? b.community;
        return cb.ratingAvg - ca.ratingAvg || cb.reviewCount - ca.reviewCount;
      }
      if (sortOption === "weight_asc") {
        return a.weightGrams - b.weightGrams;
      }
      if (sortOption === "weight_desc") {
        return b.weightGrams - a.weightGrams;
      }
      if (sortOption === "polling_desc") {
        return b.maxPollingHz - a.maxPollingHz || a.weightGrams - b.weightGrams;
      }
      return a.name.localeCompare(b.name, "ko");
    });
  }, [
    mice,
    selectedBrands,
    selectedPollingRates,
    connectionFilter,
    shapeFilter,
    weightRange,
    mouseSwitchFilter,
    sensorKeyword,
    searchQuery,
    sortOption,
    communities,
  ]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* 좌측 마우스 전용 Sticky 필터 사이드바 */}
      <CatalogSidebarShell
        title="마우스 필터"
        activeFilterCount={activeFilterCount}
        mobileFilterOpen={mobileFilterOpen}
        onResetFilters={resetFilters}
      >
        {/* 0. 제조사 (Brand) */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#E4E6E1]">
              제조사 (Brand)
            </span>
            <span className="font-mono text-[11px] text-[#8F9691]">
              다중 선택
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {availableBrands.map((brand) => {
              const active = selectedBrands.includes(brand);
              return (
                <button
                  key={brand}
                  type="button"
                  onClick={() => toggleBrand(brand)}
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-xs font-medium transition-colors",
                    active
                      ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                      : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
                  )}
                >
                  {brand}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. 최대 폴링레이트 */}
        <div className="border-t border-[#282D2A] pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#E4E6E1]">
              최대 폴링레이트
            </span>
            <span className="font-mono text-[11px] text-[#8F9691]">
              다중 선택
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {ALL_POLLING_RATES.map((hz) => {
              const active = selectedPollingRates.includes(hz);
              return (
                <button
                  key={hz}
                  type="button"
                  onClick={() => togglePollingRate(hz)}
                  className={cn(
                    "rounded-md border py-1 font-mono text-xs font-semibold transition-colors tabular-nums",
                    active
                      ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                      : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
                  )}
                >
                  {hz === 8000
                    ? "8,000Hz"
                    : hz === 4000
                      ? "4,000Hz"
                      : "1,000Hz"}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 무게 범위 */}
        <div className="border-t border-[#282D2A] pt-3">
          <RangeSliderWithInputs
            label="무게 범위"
            unit="g"
            min={WEIGHT_MIN}
            max={WEIGHT_MAX}
            step={1}
            value={weightRange}
            onChange={setWeightRange}
            midLabel="60g"
          />
        </div>

        {/* 3. 쉘 형태 */}
        <div className="border-t border-[#282D2A] pt-3">
          <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
            쉘 형태 (공식 설계)
          </span>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: "all", label: "전체" },
              { id: "symmetrical", label: "대칭형" },
              { id: "ergonomic", label: "비대칭형" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setShapeFilter(opt.id as "all" | MouseShape)}
                className={cn(
                  "rounded-md border py-1 text-xs font-medium transition-colors",
                  shapeFilter === opt.id
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. 연결 방식 */}
        <div className="border-t border-[#282D2A] pt-3">
          <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
            연결 방식
          </span>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: "all", label: "전체" },
              { id: "wireless_wired", label: "유무선" },
              { id: "wired", label: "유선 전용" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setConnectionFilter(opt.id as "all" | MouseConnection)
                }
                className={cn(
                  "rounded-md border py-1 text-xs font-medium transition-colors",
                  connectionFilter === opt.id
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. 클릭 스위치 방식 */}
        <div className="border-t border-[#282D2A] pt-3">
          <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
            클릭 스위치 방식
          </span>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: "all", label: "전체" },
              { id: "optical", label: "광학식" },
              { id: "mechanical", label: "기계식" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setMouseSwitchFilter(opt.id as "all" | MouseSwitchType)
                }
                className={cn(
                  "rounded-md border py-1 text-xs font-medium transition-colors",
                  mouseSwitchFilter === opt.id
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6. 탑재 센서 */}
        <div className="border-t border-[#282D2A] pt-3">
          <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
            탑재 센서
          </span>
          <div className="flex flex-wrap gap-1">
            {SENSOR_KEYWORDS.map((sen) => (
              <button
                key={sen}
                type="button"
                onClick={() => setSensorKeyword(sen)}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-xs font-medium transition-colors",
                  sensorKeyword === sen
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                {sen === "ALL" ? "전체" : sen}
              </button>
            ))}
          </div>
        </div>
      </CatalogSidebarShell>

      {/* 우측 메인 콘텐츠: 검색·건수·정렬 바 + 3열 마우스 스펙 카드 그리드 */}
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <CatalogSearchSortBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="마우스명, 브랜드(Razer, 지슈라, Lamzu), 센서(PAW3950) 검색..."
          totalCount={filteredMice.length}
          sortAriaLabel="마우스 정렬 기준"
          sortValue={sortOption}
          sortOptions={MOUSE_SORT_OPTIONS}
          onSortChange={setSortOption}
        />

        {compareLimitNotice && (
          <div className="flex items-center justify-between rounded-lg border border-[#E06C75] bg-[#1A1D1B] px-3.5 py-2 text-xs text-[#E06C75]">
            <span>
              스펙 비교함에는 한 번에 최대 3개 제품까지만 담을 수 있습니다.
            </span>
          </div>
        )}

        {filteredMice.length === 0 ? (
          <EmptyFilterState onReset={resetFilters} />
        ) : (
          <div
            className={cn(
              "grid grid-cols-[repeat(auto-fill,minmax(275px,1fr))] gap-4",
              compareIds.length > 0 && "pb-20"
            )}
          >
            {filteredMice.map((ms) => (
              <MouseSpecCard
                key={ms.id}
                spec={ms}
                community={communities[ms.id] ?? ms.community}
                isCompared={compareIds.includes(ms.id)}
                onToggleCompare={() => onToggleCompare(ms.id)}
                onOpenDetail={() => onOpenDetail(ms.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface MouseSpecCardProps {
  spec: MouseSpec;
  community: MouseCommunityData;
  isCompared: boolean;
  onToggleCompare: () => void;
  onOpenDetail: () => void;
}

function MouseSpecCard({
  spec,
  community,
  isCompared,
  onToggleCompare,
  onOpenDetail,
}: MouseSpecCardProps) {
  return (
    <article
      onClick={onOpenDetail}
      className={cn(
        "group flex cursor-pointer flex-col rounded-xl border bg-[#1A1D1B] p-4 transition-colors hover:bg-[#222623]",
        isCompared ? "border-[#6B9080]" : "border-[#282D2A]"
      )}
    >
      {/* 상단 메타: 좌측 [제조사 · 쉘 형태] + 우측 [비교 담기] */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-nowrap items-center gap-1.5 whitespace-nowrap">
          <span className="shrink-0 rounded border border-[#282D2A] bg-[#151816] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#E4E6E1]">
            {spec.brand}
          </span>
          <span className="shrink-0 rounded border border-[#6B9080]/40 bg-[#222623] px-2 py-0.5 text-[11px] font-medium text-[#6B9080]">
            {MOUSE_SHAPE_LABELS[spec.shape]}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompare();
          }}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-colors",
            isCompared
              ? "border-[#6B9080] bg-[#6B9080] text-[#121413]"
              : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080] hover:text-[#E4E6E1]"
          )}
        >
          <Check className="size-3" />
          <span>{isCompared ? "비교중" : "비교 담기"}</span>
        </button>
      </div>

      {/* 마우스 실루엣 아이콘 + 제품명 + 별점/폴링레이트/연결 메타 줄 */}
      <div className="mb-3.5 flex items-center gap-3">
        <MouseSilhouetteIcon
          shape={spec.shape}
          accentHex={spec.colorAccentHex}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-[#E4E6E1]">
            {spec.name}
          </h3>
          <p className="truncate font-mono text-xs text-[#8F9691]">
            {spec.nameEn}
          </p>
          <div className="mt-1 flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
            <span className="inline-flex items-center gap-1 rounded bg-[#151816] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#D4A373] tabular-nums">
              <Star className="size-2.5 fill-[#D4A373] text-[#D4A373]" />
              {community.ratingAvg.toFixed(1)}
              <span className="text-[#8F9691]">({community.reviewCount})</span>
            </span>
            <span className="rounded bg-[#151816] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#6B9080] tabular-nums">
              {spec.maxPollingHz / 1000}K
            </span>
            <span className="rounded bg-[#151816] px-1.5 py-0.5 text-[10px] text-[#8F9691]">
              {spec.connection === "wireless_wired" ? "유무선" : "유선"}
            </span>
          </div>
        </div>
      </div>

      {/* 핵심 수치 영역 */}
      <div className="mb-3 divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">공식 무게 (케이블 제외)</span>
          <span className="font-mono text-xs font-semibold text-[#E4E6E1] tabular-nums">
            {spec.weightGrams}g
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">치수 (L×W×H)</span>
          <span className="font-mono text-xs font-semibold text-[#E4E6E1] tabular-nums">
            {spec.dimensionsMm.length} × {spec.dimensionsMm.width} ×{" "}
            <span className="text-[#6B9080]">
              {spec.dimensionsMm.height}mm
            </span>
          </span>
        </div>
      </div>

      {/* 센서 & 스위치 정형 스펙 */}
      <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#222623]">
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">탑재 센서</span>
          <span className="text-right font-mono font-semibold text-[#E4E6E1]">
            {spec.sensor}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">클릭 스위치</span>
          <span className="text-right font-medium text-[#E4E6E1]">
            {spec.switchModel} ({MOUSE_SWITCH_TYPE_LABELS[spec.switchType]})
          </span>
        </div>
      </div>
    </article>
  );
}
