"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Star } from "lucide-react";
import {
  formatSwitchPins,
  SWITCH_CATEGORY_LABELS,
  SwitchCategory,
  SwitchCommunityData,
  SwitchPinCount,
  SwitchSpec,
} from "@/types/specs";
import { SwitchCrossSectionIcon } from "@/components/specs/SpecVisuals";
import {
  CATALOG_ITEMS_PER_PAGE,
  CatalogPagination,
  CatalogSearchSortBar,
  CatalogSidebarShell,
  CatalogSortOption,
  EmptyFilterState,
  RangeSliderWithInputs,
} from "@/components/specs/CatalogSharedUI";
import { cn } from "@/lib/utils";

type SwitchSortOption =
  | "rating_desc"
  | "force_asc"
  | "force_desc"
  | "pretravel_asc"
  | "name_asc";

const SWITCH_SORT_OPTIONS: ReadonlyArray<CatalogSortOption<SwitchSortOption>> = [
  { value: "rating_desc", label: "별점순" },
  { value: "force_asc", label: "입력압 낮은순" },
  { value: "force_desc", label: "입력압 높은순" },
  { value: "pretravel_asc", label: "입력지점순" },
  { value: "name_asc", label: "이름순" },
];

const ALL_SWITCH_CATEGORIES: SwitchCategory[] = [
  "linear",
  "tactile",
  "silent_linear",
  "silent_tactile",
  "clicky",
  "magnetic",
  "electro_capacitive",
];

const SWITCH_MATERIAL_KEYWORDS = [
  "ALL",
  "POM",
  "LY",
  "Nylon",
  "PC",
  "PA66",
  "PA12",
] as const;

const FORCE_MIN = 20;
const FORCE_MAX = 80;
const STROKE_MIN = 2.5;
const STROKE_MAX = 4.0;

interface SwitchCatalogViewProps {
  switches: SwitchSpec[];
  communities: Record<string, SwitchCommunityData>;
  compareIds: string[];
  compareLimitNotice: boolean;
  mobileFilterOpen: boolean;
  onCloseMobileFilter: () => void;
  onActiveFilterCountChange: (count: number) => void;
  onToggleCompare: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

export function SwitchCatalogView({
  switches,
  communities,
  compareIds,
  compareLimitNotice,
  mobileFilterOpen,
  onCloseMobileFilter,
  onActiveFilterCountChange,
  onToggleCompare,
  onOpenDetail,
}: SwitchCatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<
    SwitchCategory[]
  >([]);
  const [forceRange, setForceRange] = useState<[number, number]>([
    FORCE_MIN,
    FORCE_MAX,
  ]);
  const [strokeRange, setStrokeRange] = useState<[number, number]>([
    STROKE_MIN,
    STROKE_MAX,
  ]);
  const [lubeFilter, setLubeFilter] = useState<"all" | "lubed" | "unlubed">(
    "all"
  );
  const [pinFilter, setPinFilter] = useState<"all" | SwitchPinCount>("all");
  const [springLengthFilter, setSpringLengthFilter] = useState<
    "all" | "long_20_plus" | "under_20"
  >("all");
  const [materialKeyword, setMaterialKeyword] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<SwitchSortOption>("rating_desc");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 전달받은 스위치 목록에서 제조사(Brand) 동적 추출 (하드코딩 제거)
  const availableBrands = useMemo(
    () => Array.from(new Set(switches.map((sw) => sw.brand))),
    [switches]
  );

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand)
        ? prev.filter((item) => item !== brand)
        : [...prev, brand]
    );
  };

  const toggleCategory = (cat: SwitchCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat]
    );
  };

  const resetFilters = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setForceRange([FORCE_MIN, FORCE_MAX]);
    setStrokeRange([STROKE_MIN, STROKE_MAX]);
    setLubeFilter("all");
    setPinFilter("all");
    setSpringLengthFilter("all");
    setMaterialKeyword("ALL");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedBrands.length > 0) count += 1;
    if (selectedCategories.length > 0) count += 1;
    if (forceRange[0] > FORCE_MIN || forceRange[1] < FORCE_MAX) count += 1;
    if (strokeRange[0] > STROKE_MIN || strokeRange[1] < STROKE_MAX) count += 1;
    if (lubeFilter !== "all") count += 1;
    if (pinFilter !== "all") count += 1;
    if (springLengthFilter !== "all") count += 1;
    if (materialKeyword !== "ALL") count += 1;
    if (searchQuery.trim().length > 0) count += 1;
    return count;
  }, [
    selectedBrands,
    selectedCategories,
    forceRange,
    strokeRange,
    lubeFilter,
    pinFilter,
    springLengthFilter,
    materialKeyword,
    searchQuery,
  ]);

  useEffect(() => {
    onActiveFilterCountChange(activeFilterCount);
  }, [activeFilterCount, onActiveFilterCountChange]);

  const filteredSwitches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = switches.filter((sw) => {
      if (selectedBrands.length > 0 && !selectedBrands.includes(sw.brand)) {
        return false;
      }

      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(sw.category)
      ) {
        return false;
      }

      if (
        sw.operatingForceGf < forceRange[0] ||
        sw.operatingForceGf > forceRange[1]
      ) {
        return false;
      }

      if (
        sw.totalTravelMm < strokeRange[0] - 0.01 ||
        sw.totalTravelMm > strokeRange[1] + 0.01
      ) {
        return false;
      }

      if (lubeFilter === "lubed" && !sw.factoryLubed) return false;
      if (lubeFilter === "unlubed" && sw.factoryLubed) return false;

      if (pinFilter !== "all" && sw.pins !== pinFilter) return false;

      if (springLengthFilter === "long_20_plus") {
        if (sw.springLengthMm === null || sw.springLengthMm < 20) return false;
      } else if (springLengthFilter === "under_20") {
        if (sw.springLengthMm === null || sw.springLengthMm >= 20) return false;
      }

      if (materialKeyword !== "ALL") {
        const kw = materialKeyword.toLowerCase();
        const combinedMat = `${sw.materials.top} ${sw.materials.bottom} ${sw.materials.stem}`.toLowerCase();
        if (!combinedMat.includes(kw)) return false;
      }

      if (q.length > 0) {
        const haystack =
          `${sw.name} ${sw.nameEn} ${sw.brand} ${SWITCH_CATEGORY_LABELS[sw.category]} ${sw.materials.top} ${sw.materials.bottom} ${sw.materials.stem}`.toLowerCase();
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
      if (sortOption === "force_asc") {
        return a.operatingForceGf - b.operatingForceGf;
      }
      if (sortOption === "force_desc") {
        return b.operatingForceGf - a.operatingForceGf;
      }
      if (sortOption === "pretravel_asc") {
        return a.preTravelMm - b.preTravelMm;
      }
      return a.name.localeCompare(b.name, "ko");
    });
  }, [
    switches,
    selectedBrands,
    selectedCategories,
    forceRange,
    strokeRange,
    lubeFilter,
    pinFilter,
    springLengthFilter,
    materialKeyword,
    searchQuery,
    sortOption,
    communities,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSwitches.length / CATALOG_ITEMS_PER_PAGE)
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSwitches = useMemo(() => {
    const startIdx = (safePage - 1) * CATALOG_ITEMS_PER_PAGE;
    return filteredSwitches.slice(startIdx, startIdx + CATALOG_ITEMS_PER_PAGE);
  }, [filteredSwitches, safePage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* 좌측 스위치 전용 Sticky 필터 사이드바 */}
      <CatalogSidebarShell
        title="스위치 필터"
        activeFilterCount={activeFilterCount}
        resultCount={filteredSwitches.length}
        mobileFilterOpen={mobileFilterOpen}
        onCloseMobileFilter={onCloseMobileFilter}
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

        {/* 1. 스위치 분류 */}
        <div className="border-t border-[#282D2A] pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#E4E6E1]">
              스위치 분류
            </span>
            <span className="font-mono text-[11px] text-[#8F9691]">
              다중 선택
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {ALL_SWITCH_CATEGORIES.map((cat) => {
              const active = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                      : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
                  )}
                >
                  {SWITCH_CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 입력압 범위 */}
        <div className="border-t border-[#282D2A] pt-3">
          <RangeSliderWithInputs
            label="입력압 범위"
            unit="gf"
            min={FORCE_MIN}
            max={FORCE_MAX}
            step={1}
            value={forceRange}
            onChange={setForceRange}
            midLabel="45gf (표준)"
          />
        </div>

        {/* 3. 총 스트로크 */}
        <div className="border-t border-[#282D2A] pt-3">
          <RangeSliderWithInputs
            label="총 스트로크"
            unit="mm"
            min={STROKE_MIN}
            max={STROKE_MAX}
            step={0.1}
            allowDecimals
            fixedDecimals={1}
            value={strokeRange}
            onChange={setStrokeRange}
            midLabel="3.4mm"
          />
        </div>

        {/* 4. 스프링 길이 */}
        <div className="border-t border-[#282D2A] pt-3">
          <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
            스프링 길이
          </span>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: "all", label: "전체" },
              { id: "long_20_plus", label: "20mm+ 롱" },
              { id: "under_20", label: "20mm 미만" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setSpringLengthFilter(
                    opt.id as "all" | "long_20_plus" | "under_20"
                  )
                }
                className={cn(
                  "rounded-md border py-1 font-mono text-xs font-medium transition-colors tabular-nums",
                  springLengthFilter === opt.id
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. 하우징 / 스템 소재 */}
        <div className="border-t border-[#282D2A] pt-3">
          <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
            하우징 · 스템 소재
          </span>
          <div className="flex flex-wrap gap-1">
            {SWITCH_MATERIAL_KEYWORDS.map((mat) => (
              <button
                key={mat}
                type="button"
                onClick={() => setMaterialKeyword(mat)}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-xs font-medium transition-colors",
                  materialKeyword === mat
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                )}
              >
                {mat === "ALL" ? "전체" : mat}
              </button>
            ))}
          </div>
        </div>

        {/* 6. 공장 윤활 & 핀 방식 */}
        <div className="flex flex-col gap-2.5 border-t border-[#282D2A] pt-3">
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
              공장 윤활
            </span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: "all", label: "전체" },
                { id: "lubed", label: "윤활" },
                { id: "unlubed", label: "비윤활" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setLubeFilter(opt.id as "all" | "lubed" | "unlubed")
                  }
                  className={cn(
                    "rounded-md border py-1 text-center text-xs font-medium transition-colors",
                    lubeFilter === opt.id
                      ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                      : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold text-[#E4E6E1]">
              핀 방식
            </span>
            <div className="grid grid-cols-5 gap-1">
              {(
                [
                  { id: "all", label: "전체" },
                  { id: 5, label: "5핀" },
                  { id: 3, label: "3핀" },
                  { id: 2, label: "2핀" },
                  { id: 0, label: "무핀" },
                ] as Array<{ id: "all" | SwitchPinCount; label: string }>
              ).map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => {
                    setPinFilter(opt.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    "rounded-md border py-1 text-center font-mono text-[11px] font-medium transition-colors tabular-nums",
                    pinFilter === opt.id
                      ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                      : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:text-[#E4E6E1]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CatalogSidebarShell>

      {/* 우측 메인 콘텐츠: 검색·건수·정렬 바 + 3열 스위치 스펙 카드 그리드 */}
      <section className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-[calc(100vh-5.5rem)]">
        <CatalogSearchSortBar
          searchQuery={searchQuery}
          onSearchChange={(next) => {
            setSearchQuery(next);
            setCurrentPage(1);
          }}
          searchPlaceholder="스위치명, 브랜드(HMX, 체리, 게이트론), 소재(POM, LY) 검색..."
          totalCount={filteredSwitches.length}
          sortAriaLabel="스위치 정렬 기준"
          sortValue={sortOption}
          sortOptions={SWITCH_SORT_OPTIONS}
          onSortChange={(next) => {
            setSortOption(next);
            setCurrentPage(1);
          }}
        />

        {compareLimitNotice && (
          <div className="flex items-center justify-between rounded-lg border border-[#E06C75] bg-[#1A1D1B] px-3.5 py-2 text-xs text-[#E06C75]">
            <span>
              스펙 비교함에는 한 번에 최대 3개 제품까지만 담을 수 있습니다.
            </span>
          </div>
        )}

        {filteredSwitches.length === 0 ? (
          <EmptyFilterState onReset={resetFilters} />
        ) : (
          <div className={cn("flex flex-col gap-4", compareIds.length > 0 && "pb-20")}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(275px,1fr))] gap-4">
              {paginatedSwitches.map((sw) => (
                <SwitchSpecCard
                  key={sw.id}
                  spec={sw}
                  community={communities[sw.id] ?? sw.community}
                  isCompared={compareIds.includes(sw.id)}
                  onToggleCompare={() => onToggleCompare(sw.id)}
                  onOpenDetail={() => onOpenDetail(sw.id)}
                />
              ))}
            </div>
            <CatalogPagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </section>
    </div>
  );
}

interface SwitchSpecCardProps {
  spec: SwitchSpec;
  community: SwitchCommunityData;
  isCompared: boolean;
  onToggleCompare: () => void;
  onOpenDetail: () => void;
}

function SwitchSpecCard({
  spec,
  community,
  isCompared,
  onToggleCompare,
  onOpenDetail,
}: SwitchSpecCardProps) {
  return (
    <article
      onClick={onOpenDetail}
      className={cn(
        "group flex cursor-pointer flex-col rounded-xl border bg-[#1A1D1B] p-4 transition-colors hover:bg-[#222623]",
        isCompared ? "border-[#6B9080]" : "border-[#282D2A]"
      )}
    >
      {/* 상단 메타: 좌측 [제조사 · 분류] + 우측 [비교 담기] */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-nowrap items-center gap-1.5 whitespace-nowrap">
          <span className="shrink-0 rounded border border-[#282D2A] bg-[#151816] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#E4E6E1]">
            {spec.brand}
          </span>
          <span className="shrink-0 rounded border border-[#6B9080]/40 bg-[#222623] px-2 py-0.5 text-[11px] font-medium text-[#6B9080]">
            {SWITCH_CATEGORY_LABELS[spec.category]}
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

      {/* 스위치 컬러웨이 단면 아이콘 + 제품명 + 별점/핀/윤활 메타 줄 */}
      <div className="mb-3.5 flex items-center gap-3">
        <SwitchCrossSectionIcon colorway={spec.colorway} pins={spec.pins} />
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
            <span className="rounded bg-[#151816] px-1.5 py-0.5 font-mono text-[10px] text-[#8F9691] tabular-nums">
              {formatSwitchPins(spec.pins)}
            </span>
            <span className="rounded bg-[#151816] px-1.5 py-0.5 text-[10px] text-[#8F9691]">
              {spec.factoryLubed ? "공장 윤활" : "비윤활"}
            </span>
          </div>
        </div>
      </div>

      {/* 핵심 수치 영역 */}
      <div className="mb-3 divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">입력압 / 바닥압</span>
          <span className="font-mono text-xs font-semibold text-[#E4E6E1] tabular-nums">
            {spec.operatingForceGf}gf /{" "}
            {spec.bottomOutForceGf !== null ? (
              <span className="text-[#6B9080]">{spec.bottomOutForceGf}gf</span>
            ) : (
              <span className="font-normal text-[#8F9691]">미공개</span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">스트로크 (입력 / 총)</span>
          <span className="font-mono text-xs font-semibold text-[#E4E6E1] tabular-nums">
            {spec.preTravelMm.toFixed(1)}mm /{" "}
            <span className="text-[#6B9080]">
              {spec.totalTravelMm.toFixed(1)}mm
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">스프링 사양</span>
          <span className="font-mono font-semibold text-[#E4E6E1] tabular-nums">
            {spec.springLengthMm !== null
              ? `${spec.springLengthMm}mm (${spec.springType ?? "표준"})`
              : "미공개"}
          </span>
        </div>
      </div>

      {/* 소재 3요소 */}
      <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#222623]">
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">상부 하우징</span>
          <span className="text-right font-mono font-semibold text-[#E4E6E1]">
            {spec.materials.top}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">하부 하우징</span>
          <span className="text-right font-mono font-semibold text-[#E4E6E1]">
            {spec.materials.bottom}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs whitespace-nowrap">
          <span className="shrink-0 text-[#8F9691]">스템 소재</span>
          <span className="text-right font-mono font-semibold text-[#E4E6E1]">
            {spec.materials.stem}
          </span>
        </div>
      </div>
    </article>
  );
}
