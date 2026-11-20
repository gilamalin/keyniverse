"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Filter,
  Keyboard,
  Mouse,
} from "lucide-react";
import { INITIAL_MICE, INITIAL_SWITCHES } from "@/data/specs-data";
import {
  MouseCommunityData,
  MouseSpec,
  SpecTabType,
  SwitchCommunityData,
  SwitchSpec,
} from "@/types/specs";
import {
  StoredVerifiedVote,
  computeEffectiveMouseCommunity,
  computeEffectiveSwitchCommunity,
  deleteStoredVote,
  getServerVoteStoreVersion,
  getVoteStoreVersion,
  readStoredVote,
  saveStoredVote,
  subscribeVoteStore,
} from "@/lib/spec-verification";
import { SwitchCatalogView } from "@/components/specs/SwitchCatalogView";
import { MouseCatalogView } from "@/components/specs/MouseCatalogView";
import {
  SpecCompareFloatingBar,
  SpecCompareModal,
} from "@/components/specs/SpecCompareModal";
import { SpecDetailModal } from "@/components/specs/SpecDetailModal";
import { cn } from "@/lib/utils";

interface SpecsCatalogProps {
  /** 추후 백엔드(Supabase) 연동 시 서버에서 조회한 스위치/마우스 데이터를 그대로 주입 가능 */
  initialSwitches?: SwitchSpec[];
  initialMice?: MouseSpec[];
}

export function SpecsCatalog({
  initialSwitches = INITIAL_SWITCHES,
  initialMice = INITIAL_MICE,
}: SpecsCatalogProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab: SpecTabType =
    searchParams.get("tab") === "mice" ? "mice" : "switches";
  const [activeTab, setActiveTab] = useState<SpecTabType>(initialTab);
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // 각 카테고리별 활성 필터 개수 (모바일 [필터 N ▾] 배지 표시용)
  const [filterCountByTab, setFilterCountByTab] = useState<
    Record<SpecTabType, number>
  >({
    switches: 0,
    mice: 0,
  });

  // 비교함 선택 상태 (최대 3개, 카테고리별 분리 관리)
  const [compareIdsByTab, setCompareIdsByTab] = useState<
    Record<SpecTabType, string[]>
  >({
    switches: [],
    mice: [],
  });
  const [compareLimitNotice, setCompareLimitNotice] = useState<boolean>(false);
  const [compareModalOpen, setCompareModalOpen] = useState<boolean>(false);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  // 로컬 스토리지 투표 상태 구독 (SSR Hydration-safe)
  const voteVersion = useSyncExternalStore(
    subscribeVoteStore,
    getVoteStoreVersion,
    getServerVoteStoreVersion
  );

  const switchCommunities = useMemo<Record<string, SwitchCommunityData>>(() => {
    const map: Record<string, SwitchCommunityData> = {};
    for (const sw of initialSwitches) {
      const userVote = voteVersion > 0 ? readStoredVote(sw.id) : null;
      map[sw.id] = computeEffectiveSwitchCommunity(sw, userVote);
    }
    return map;
  }, [initialSwitches, voteVersion]);

  const mouseCommunities = useMemo<Record<string, MouseCommunityData>>(() => {
    const map: Record<string, MouseCommunityData> = {};
    for (const ms of initialMice) {
      const userVote = voteVersion > 0 ? readStoredVote(ms.id) : null;
      map[ms.id] = computeEffectiveMouseCommunity(ms, userVote);
    }
    return map;
  }, [initialMice, voteVersion]);

  // ?open=슬러그 파라미터로 진입 시 해당 제품 상세 모달 자동 오픈
  const openSlugParam = searchParams.get("open");
  const openMatchedItem = useMemo(() => {
    if (!openSlugParam) return null;
    return (
      initialSwitches.find((sw) => sw.slug === openSlugParam) ??
      initialMice.find((ms) => ms.slug === openSlugParam) ??
      null
    );
  }, [initialSwitches, initialMice, openSlugParam]);

  const effectiveDetailId = detailItemId ?? openMatchedItem?.id ?? null;

  const handleCloseDetail = () => {
    setDetailItemId(null);
    if (openSlugParam) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("open");
      const qs = params.toString();
      router.replace(qs ? `/specs?${qs}` : "/specs", { scroll: false });
    }
  };

  const handleTabChange = (nextTab: SpecTabType) => {
    setActiveTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/specs?${params.toString()}`, { scroll: false });
  };

  const handleSwitchFilterCount = useCallback((count: number) => {
    setFilterCountByTab((prev) =>
      prev.switches === count ? prev : { ...prev, switches: count }
    );
  }, []);

  const handleMouseFilterCount = useCallback((count: number) => {
    setFilterCountByTab((prev) =>
      prev.mice === count ? prev : { ...prev, mice: count }
    );
  }, []);

  const toggleCompareItem = (id: string, tab: SpecTabType) => {
    setCompareIdsByTab((prev) => {
      const current = prev[tab];
      if (current.includes(id)) {
        return { ...prev, [tab]: current.filter((item) => item !== id) };
      }
      if (current.length >= 3) {
        setCompareLimitNotice(true);
        window.setTimeout(() => setCompareLimitNotice(false), 2200);
        return prev;
      }
      return { ...prev, [tab]: [...current, id] };
    });
  };

  const handleSubmitVote = (vote: StoredVerifiedVote) => {
    saveStoredVote(vote);
  };

  const handleDeleteVote = (deviceId: string) => {
    deleteStoredVote(deviceId);
  };

  const currentFilterCount = filterCountByTab[activeTab];

  const selectedCompareSwitches = useMemo(
    () =>
      compareIdsByTab.switches
        .map((id) => initialSwitches.find((sw) => sw.id === id))
        .filter((sw): sw is SwitchSpec => Boolean(sw)),
    [compareIdsByTab.switches, initialSwitches]
  );

  const selectedCompareMice = useMemo(
    () =>
      compareIdsByTab.mice
        .map((id) => initialMice.find((ms) => ms.id === id))
        .filter((ms): ms is MouseSpec => Boolean(ms)),
    [compareIdsByTab.mice, initialMice]
  );

  const activeDetailSwitch = useMemo(
    () => initialSwitches.find((sw) => sw.id === effectiveDetailId) ?? null,
    [initialSwitches, effectiveDetailId]
  );
  const activeDetailMouse = useMemo(
    () => initialMice.find((ms) => ms.id === effectiveDetailId) ?? null,
    [initialMice, effectiveDetailId]
  );
  const activeExistingVote = useMemo(() => {
    if (!effectiveDetailId || voteVersion === 0) return null;
    return readStoredVote(effectiveDetailId);
  }, [effectiveDetailId, voteVersion]);

  /**
   * 카테고리 탭 레지스트리 (추후 기성품 키보드·키캡·스피커 등 추가 시 항목만 등록)
   */
  const categoryTabs = useMemo(
    () =>
      [
        {
          id: "switches" as SpecTabType,
          label: "스위치",
          count: initialSwitches.length,
          icon: Keyboard,
        },
        {
          id: "mice" as SpecTabType,
          label: "마우스",
          count: initialMice.length,
          icon: Mouse,
        },
      ] as const,
    [initialSwitches.length, initialMice.length]
  );

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 상단 타이틀 (전 페이지 통일 규격) */}
      <div className="border-b border-[#282D2A] pb-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
            <Cpu className="size-3.5" />
            HARDWARE SPEC ARCHIVE
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#D5DBD6] sm:text-3xl">
          스펙 도감
        </h1>
        <p className="mt-1 text-sm text-[#8F9691]">
          하드웨어 스펙 조건별 검색 · 비교
        </p>
      </div>

      {/* 2. 통합 카테고리 탭 & 모바일/태블릿 필터 바 (좌측: 카테고리 탭 / 우측: lg 미만 [필터 ▾] 토글) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {categoryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors sm:text-sm",
                  active
                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                    : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
                )}
              >
                <Icon className="size-4 text-[#6B9080]" />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                    active
                      ? "bg-[#6B9080]/20 text-[#6B9080]"
                      : "bg-[#1A1D1B] text-[#8F9691]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 모바일/태블릿(lg 미만) 전용 우측 컴팩트 [필터 ▾] 토글 버튼 */}
        <button
          type="button"
          onClick={() => setMobileFilterOpen((prev) => !prev)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors lg:hidden sm:text-sm",
            mobileFilterOpen || currentFilterCount > 0
              ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
              : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
          )}
        >
          <Filter className="size-3.5 text-[#6B9080]" />
          <span>필터</span>
          {currentFilterCount > 0 && (
            <span className="rounded bg-[#6B9080]/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#6B9080] tabular-nums">
              {currentFilterCount}
            </span>
          )}
          {mobileFilterOpen ? (
            <ChevronUp className="size-3.5 text-[#8F9691]" />
          ) : (
            <ChevronDown className="size-3.5 text-[#8F9691]" />
          )}
        </button>
      </div>

      {/* 3. 선택된 카테고리 독립 모듈 뷰 (추후 KeyboardCatalogView 등 플러그인 추가 가능) */}
      {activeTab === "switches" ? (
        <SwitchCatalogView
          switches={initialSwitches}
          communities={switchCommunities}
          compareIds={compareIdsByTab.switches}
          compareLimitNotice={compareLimitNotice}
          mobileFilterOpen={mobileFilterOpen}
          onActiveFilterCountChange={handleSwitchFilterCount}
          onToggleCompare={(id) => toggleCompareItem(id, "switches")}
          onOpenDetail={(id) => setDetailItemId(id)}
        />
      ) : (
        <MouseCatalogView
          mice={initialMice}
          communities={mouseCommunities}
          compareIds={compareIdsByTab.mice}
          compareLimitNotice={compareLimitNotice}
          mobileFilterOpen={mobileFilterOpen}
          onActiveFilterCountChange={handleMouseFilterCount}
          onToggleCompare={(id) => toggleCompareItem(id, "mice")}
          onOpenDetail={(id) => setDetailItemId(id)}
        />
      )}

      {/* 4. 하단 플로팅 스펙 비교함 바 */}
      <SpecCompareFloatingBar
        items={
          activeTab === "switches"
            ? selectedCompareSwitches.map((sw) => ({
                id: sw.id,
                name: sw.name,
                brand: sw.brand,
              }))
            : selectedCompareMice.map((ms) => ({
                id: ms.id,
                name: ms.name,
                brand: ms.brand,
              }))
        }
        onRemoveItem={(id) => toggleCompareItem(id, activeTab)}
        onClearAll={() => {
          setCompareModalOpen(false);
          setCompareIdsByTab((prev) => ({ ...prev, [activeTab]: [] }));
        }}
        onOpenCompare={() => setCompareModalOpen(true)}
      />

      {/* 5. VS 스펙 비교 모달 */}
      <SpecCompareModal
        open={compareModalOpen}
        tab={activeTab}
        switches={selectedCompareSwitches}
        mice={selectedCompareMice}
        switchCommunities={switchCommunities}
        mouseCommunities={mouseCommunities}
        onClose={() => setCompareModalOpen(false)}
        onSelectDetail={(id) => setDetailItemId(id)}
      />

      {/* 6. 제품 상세 제원 & 테스트 인증 모달 */}
      <SpecDetailModal
        key={effectiveDetailId ?? "closed"}
        switchSpec={activeDetailSwitch}
        mouseSpec={activeDetailMouse}
        switchCommunity={
          activeDetailSwitch
            ? (switchCommunities[activeDetailSwitch.id] ??
              activeDetailSwitch.community)
            : null
        }
        mouseCommunity={
          activeDetailMouse
            ? (mouseCommunities[activeDetailMouse.id] ??
              activeDetailMouse.community)
            : null
        }
        existingVote={activeExistingVote}
        onSubmitVote={handleSubmitVote}
        onDeleteVote={handleDeleteVote}
        onClose={handleCloseDetail}
      />
    </div>
  );
}
