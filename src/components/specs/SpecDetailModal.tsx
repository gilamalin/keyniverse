"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Link2,
  Lock,
  LogIn,
  ShieldCheck,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import {
  getAuthStoreVersion,
  getServerAuthStoreVersion,
  openAuthModal,
  readGoogleSession,
  subscribeAuthStore,
} from "@/lib/auth-store";
import {
  POINT_REWARDS,
  recordPointTransaction,
} from "@/lib/activity-store";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";
import {
  MOUSE_CONNECTION_LABELS,
  MOUSE_GRIP_LABELS,
  MOUSE_HAND_SIZE_LABELS,
  MOUSE_SHAPE_LABELS,
  MOUSE_SWITCH_TYPE_LABELS,
  MouseCommunityData,
  MouseGripChoice,
  MouseHandSizeChoice,
  MouseSpec,
  SWITCH_CATEGORY_LABELS,
  SWITCH_PITCH_LABELS,
  SwitchCommunityData,
  SwitchPitchChoice,
  SwitchSpec,
  formatSwitchPins,
} from "@/types/specs";
import {
  KEYBOARD_MIN_KEY_PRESSES,
  MIN_SAMPLE_THRESHOLD,
  MOUSE_MIN_CLICKS,
  MOUSE_MIN_MOVE_SAMPLES,
  MOUSE_MIN_PEAK_HZ,
  ONE_LINE_REVIEW_MAX_LENGTH,
  StoredVerifiedVote,
  readVerificationProof,
} from "@/lib/spec-verification";
import {
  MouseSilhouetteIcon,
  SwitchCrossSectionIcon,
} from "@/components/specs/SpecVisuals";
import { cn } from "@/lib/utils";

interface SpecDetailModalProps {
  switchSpec: SwitchSpec | null;
  mouseSpec: MouseSpec | null;
  switchCommunity: SwitchCommunityData | null;
  mouseCommunity: MouseCommunityData | null;
  existingVote: StoredVerifiedVote | null;
  onSubmitVote: (vote: StoredVerifiedVote) => void;
  onDeleteVote: (deviceId: string) => void;
  onClose: () => void;
}

export function SpecDetailModal({
  switchSpec,
  mouseSpec,
  switchCommunity,
  mouseCommunity,
  existingVote,
  onSubmitVote,
  onDeleteVote,
  onClose,
}: SpecDetailModalProps) {
  const activeKind = switchSpec ? "switch" : mouseSpec ? "mouse" : null;
  const activeSlug = switchSpec?.slug ?? mouseSpec?.slug ?? null;
  const activeDeviceId = switchSpec?.id ?? mouseSpec?.id ?? null;

  // 모달이 열릴 때 로컬 스토리지의 테스트 인증 증명서를 조회
  const proof =
    activeKind && activeSlug
      ? readVerificationProof(activeSlug, activeKind)
      : null;

  // 평가 & 한줄평 입력 폼 상태 (기존 평가가 있으면 불러오기)
  const [rating, setRating] = useState<number>(() =>
    existingVote ? existingVote.rating : 5
  );
  const [pitchChoice, setPitchChoice] = useState<SwitchPitchChoice>(() =>
    existingVote && existingVote.kind === "switch" ? existingVote.pitch : "high"
  );
  const [gripChoice, setGripChoice] = useState<MouseGripChoice>(() =>
    existingVote && existingVote.kind === "mouse" ? existingVote.grip : "claw"
  );
  const [handChoice, setHandChoice] = useState<MouseHandSizeChoice>(() =>
    existingVote && existingVote.kind === "mouse"
      ? existingVote.handSize
      : "f9"
  );
  const [oneLineReview, setOneLineReview] = useState<string>("");
  const [savedNotice, setSavedNotice] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopySpecLink = async () => {
    if (!activeKind || !activeSlug || typeof window === "undefined") return;
    const tabParam = activeKind === "switch" ? "switches" : "mice";
    const shareUrl = `${window.location.origin}/specs?tab=${tabParam}&open=${encodeURIComponent(activeSlug)}`;
    const ok = await copyTextToClipboard(shareUrl);
    if (!ok) return;
    setCopiedLink(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedLink(false);
    }, 1800);
  };

  const authVersion = useSyncExternalStore(
    subscribeAuthStore,
    getAuthStoreVersion,
    getServerAuthStoreVersion
  );
  const session = authVersion > 0 ? readGoogleSession() : null;

  useEffect(() => {
    if (!activeKind) return;

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
  }, [activeKind, onClose]);

  if (!activeKind) return null;

  const isSwitch = activeKind === "switch" && switchSpec && switchCommunity;
  const isMouse = activeKind === "mouse" && mouseSpec && mouseCommunity;

  const handleSaveVote = () => {
    if (!session || !proof) return;

    const isFirstVote = !existingVote;
    const cleanedReview = oneLineReview
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, ONE_LINE_REVIEW_MAX_LENGTH);
    const nextOneLineReview =
      cleanedReview || existingVote?.oneLineReview || undefined;

    if (isSwitch) {
      onSubmitVote({
        kind: "switch",
        deviceId: switchSpec.id,
        slug: switchSpec.slug,
        rating,
        pitch: pitchChoice,
        oneLineReview: nextOneLineReview,
        badgeText: "테스트 인증",
        badgeTone: "sand",
        updatedAt: "",
      });
    } else if (isMouse) {
      onSubmitVote({
        kind: "mouse",
        deviceId: mouseSpec.id,
        slug: mouseSpec.slug,
        rating,
        grip: gripChoice,
        handSize: handChoice,
        oneLineReview: nextOneLineReview,
        badgeText: "테스트 인증",
        badgeTone: "sand",
        updatedAt: "",
      });
    }

    if (isFirstVote) {
      recordPointTransaction(
        `스펙 평가 (${isSwitch ? switchSpec.name : mouseSpec!.name})`,
        POINT_REWARDS.SUBMIT_SPEC_VOTE
      );
    }

    setOneLineReview("");
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2400);
  };

  const testerHref = isSwitch
    ? `/keyboard?device=${encodeURIComponent(switchSpec.slug)}`
    : isMouse
      ? `/mouse?device=${encodeURIComponent(mouseSpec.slug)}`
      : "/keyboard";

  const community = isSwitch ? switchCommunity : mouseCommunity!;
  const hasEnoughSample = community.reviewCount >= MIN_SAMPLE_THRESHOLD;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/75 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="제품 상세 스펙"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
      >
        {/* 모달 상단 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-[#282D2A] bg-[#151816] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {isSwitch ? (
              <SwitchCrossSectionIcon
                colorway={switchSpec.colorway}
                pins={switchSpec.pins}
                className="size-12 shrink-0 sm:size-14"
              />
            ) : (
              isMouse && (
                <MouseSilhouetteIcon
                  shape={mouseSpec.shape}
                  accentHex={mouseSpec.colorAccentHex}
                  className="size-12 shrink-0 sm:size-14"
                />
              )
            )}

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded border border-[#282D2A] bg-[#1A1D1B] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#E4E6E1]">
                  {isSwitch ? switchSpec.brand : mouseSpec!.brand}
                </span>
                <span className="rounded border border-[#6B9080]/40 bg-[#222623] px-2 py-0.5 text-[11px] font-medium text-[#6B9080]">
                  {isSwitch
                    ? SWITCH_CATEGORY_LABELS[switchSpec.category]
                    : MOUSE_SHAPE_LABELS[mouseSpec!.shape]}
                </span>
                {hasEnoughSample ? (
                  <span className="inline-flex items-center gap-1 rounded border border-[#D4A373]/40 bg-[#1A1D1B] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#D4A373] tabular-nums">
                    <Star className="size-3 fill-[#D4A373] text-[#D4A373]" />
                    {community.ratingAvg.toFixed(1)} ({community.reviewCount})
                  </span>
                ) : (
                  <span className="rounded border border-[#282D2A] bg-[#1A1D1B] px-2 py-0.5 font-mono text-[11px] text-[#8F9691] tabular-nums">
                    표본 수집 중 ({community.reviewCount}/{MIN_SAMPLE_THRESHOLD})
                  </span>
                )}
              </div>

              <h2 className="truncate text-base font-bold text-[#E4E6E1] sm:text-xl">
                {isSwitch ? switchSpec.name : mouseSpec!.name}
              </h2>
              <p className="truncate font-mono text-xs text-[#8F9691]">
                {isSwitch ? switchSpec.nameEn : mouseSpec!.nameEn}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopySpecLink()}
              title={copiedLink ? "링크 복사됨" : "스펙 링크 복사"}
              aria-label={copiedLink ? "링크 복사됨" : "스펙 링크 복사"}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors sm:w-auto sm:px-2.5",
                copiedLink
                  ? "border-[#6B9080] bg-[#222623] text-[#6B9080]"
                  : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:border-[#6B9080] hover:text-[#E4E6E1]"
              )}
            >
              {copiedLink ? (
                <Check className="size-3.5 shrink-0 text-[#6B9080]" />
              ) : (
                <Link2 className="size-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {copiedLink ? "복사됨" : "링크 복사"}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="상세 모달 닫기"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 스크롤 본문: ① 공식 스펙 -> ② 유저 지표 & 평가 등록 -> ③ 한줄평 */}
        <div className="flex flex-col gap-6 overflow-y-auto p-4 sm:p-5">
          {/* ① 공식 스펙 */}
          <section>
            <h3 className="mb-2.5 text-sm font-bold text-[#E4E6E1]">
              공식 스펙
            </h3>

            {isSwitch ? (
              <div className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2">
                <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
                  <SpecRow
                    label="분류"
                    value={SWITCH_CATEGORY_LABELS[switchSpec.category]}
                  />
                  <SpecRow
                    label="입력압"
                    value={`${switchSpec.operatingForceGf}gf`}
                    mono
                  />
                  <SpecRow
                    label="바닥압"
                    value={
                      switchSpec.bottomOutForceGf !== null
                        ? `${switchSpec.bottomOutForceGf}gf`
                        : "미공개"
                    }
                    muted={switchSpec.bottomOutForceGf === null}
                    accent={switchSpec.bottomOutForceGf !== null}
                    mono={switchSpec.bottomOutForceGf !== null}
                  />
                  <SpecRow
                    label="입력 지점"
                    value={`${switchSpec.preTravelMm.toFixed(1)}mm`}
                    mono
                  />
                  <SpecRow
                    label="총 스트로크"
                    value={`${switchSpec.totalTravelMm.toFixed(1)}mm`}
                    accent
                    mono
                  />
                  <SpecRow
                    label="스프링"
                    value={
                      switchSpec.springLengthMm !== null
                        ? `${switchSpec.springLengthMm}mm (${switchSpec.springType ?? "표준"})`
                        : "미공개"
                    }
                    muted={switchSpec.springLengthMm === null}
                    mono={switchSpec.springLengthMm !== null}
                  />
                </div>

                <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#222623]">
                  <SpecRow
                    label="상부 하우징"
                    value={switchSpec.materials.top}
                    mono
                  />
                  <SpecRow
                    label="하부 하우징"
                    value={switchSpec.materials.bottom}
                    mono
                  />
                  <SpecRow
                    label="스템"
                    value={switchSpec.materials.stem}
                    mono
                  />
                  <SpecRow
                    label="공장 윤활"
                    value={switchSpec.factoryLubed ? "윤활" : "비윤활"}
                  />
                  <SpecRow
                    label="핀"
                    value={formatSwitchPins(switchSpec.pins)}
                    mono
                  />
                </div>
              </div>
            ) : (
              isMouse && (
                <div className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-2">
                  <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
                    <SpecRow
                      label="무게"
                      value={`${mouseSpec.weightGrams}g`}
                      mono
                    />
                    <SpecRow
                      label="폴링레이트"
                      value={`${mouseSpec.maxPollingHz.toLocaleString()}Hz`}
                      accent
                      mono
                    />
                    <SpecRow
                      label="연결 방식"
                      value={MOUSE_CONNECTION_LABELS[mouseSpec.connection]}
                    />
                    <SpecRow
                      label="쉘 형태"
                      value={MOUSE_SHAPE_LABELS[mouseSpec.shape]}
                    />
                  </div>

                  <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#222623]">
                    <SpecRow
                      label="크기 (L×W×H)"
                      value={`${mouseSpec.dimensionsMm.length} × ${mouseSpec.dimensionsMm.width} × ${mouseSpec.dimensionsMm.height}mm`}
                      mono
                    />
                    <SpecRow
                      label="등 높이"
                      value={`${mouseSpec.dimensionsMm.height}mm`}
                      accent
                      mono
                    />
                    <SpecRow label="센서" value={mouseSpec.sensor} mono />
                    <SpecRow
                      label="스위치"
                      value={`${mouseSpec.switchModel} (${MOUSE_SWITCH_TYPE_LABELS[mouseSpec.switchType]})`}
                    />
                  </div>
                </div>
              )
            )}
          </section>

          {/* ② 유저 지표 & 평가/한줄평 등록 */}
          <section className="border-t border-[#282D2A] pt-5">
            <h3 className="mb-3 text-sm font-bold text-[#E4E6E1]">유저 지표</h3>

            {/* 정형 선택지별 득표율(%) 컴팩트 타일 그리드 */}
            {isSwitch ? (
              <VoteRatioTiles
                totalCount={switchCommunity.reviewCount}
                hasEnoughSample={hasEnoughSample}
                columns={3}
                rows={[
                  { label: "로우피치", count: switchCommunity.pitchVotes.low },
                  { label: "미들피치", count: switchCommunity.pitchVotes.mid },
                  { label: "하이피치", count: switchCommunity.pitchVotes.high },
                ]}
              />
            ) : (
              isMouse && (
                <div className="flex flex-col gap-2">
                  <VoteRatioTiles
                    totalCount={mouseCommunity.reviewCount}
                    hasEnoughSample={hasEnoughSample}
                    columns={3}
                    rows={[
                      { label: "팜 그립", count: mouseCommunity.gripVotes.palm },
                      {
                        label: "클로 그립",
                        count: mouseCommunity.gripVotes.claw,
                      },
                      {
                        label: "핑거 그립",
                        count: mouseCommunity.gripVotes.finger,
                      },
                    ]}
                  />
                  <VoteRatioTiles
                    totalCount={mouseCommunity.reviewCount}
                    hasEnoughSample={hasEnoughSample}
                    columns={4}
                    rows={[
                      {
                        label: "F1~F8",
                        count: mouseCommunity.handSizeVotes.f1_f8,
                      },
                      { label: "F9", count: mouseCommunity.handSizeVotes.f9 },
                      { label: "F10", count: mouseCommunity.handSizeVotes.f10 },
                      {
                        label: "F11+",
                        count: mouseCommunity.handSizeVotes.f11_plus,
                      },
                    ]}
                  />
                </div>
              )
            )}

            {/* 로그인 + 테스트 인증 게이트 */}
            <div className="mt-4">
              {!session ? (
                <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-3.5 sm:p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#E4E6E1]">
                      <Lock className="size-3.5 shrink-0 text-[#D4A373]" />
                      <span>로그인 후 평가를 남길 수 있습니다.</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openAuthModal("스펙 평가는 로그인 후 이용할 수 있습니다.")
                      }
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#222623] px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
                    >
                      <LogIn className="size-3.5 text-[#6B9080]" />
                      <span>로그인</span>
                    </button>
                  </div>
                </div>
              ) : !proof ? (
                <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-3.5 sm:p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#E4E6E1]">
                        <Lock className="size-3.5 shrink-0 text-[#D4A373]" />
                        <span>
                          테스트 통과 후 평가·한줄평을 남길 수 있습니다.
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-[#8F9691] tabular-nums">
                        {isSwitch
                          ? `키 ${KEYBOARD_MIN_KEY_PRESSES}타 · 채터링 0회`
                          : `샘플 ${MOUSE_MIN_MOVE_SAMPLES.toLocaleString()}+ · ${MOUSE_MIN_PEAK_HZ}Hz+ · 클릭 ${MOUSE_MIN_CLICKS}회 · 더블클릭 0회`}
                      </p>
                    </div>

                    <Link
                      href={testerHref}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#222623] px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
                    >
                      <Zap className="size-3.5 text-[#D4A373]" />
                      <span>테스트하러 가기</span>
                    </Link>
                  </div>
                </div>
              ) : (
                /* 테스트 인증 통과자 전용 평가 & 한줄평 등록 폼 */
                <div className="rounded-xl border border-[#6B9080] bg-[#151816] p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center gap-1.5 border-b border-[#282D2A] pb-2 text-xs font-semibold text-[#E4E6E1]">
                    <ShieldCheck className="size-4 text-[#6B9080]" />
                    <span>평가 등록</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* 별점 (1~5) */}
                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-[#8F9691]">
                        별점
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((score) => {
                          const active = score <= rating;
                          return (
                            <button
                              key={score}
                              type="button"
                              onClick={() => setRating(score)}
                              className={cn(
                                "flex h-8 flex-1 items-center justify-center gap-1 rounded-md border font-mono text-xs font-semibold transition-colors tabular-nums",
                                score === rating
                                  ? "border-[#D4A373] bg-[#222623] text-[#D4A373]"
                                  : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:border-[#D4A373]/50"
                              )}
                            >
                              <Star
                                className={cn(
                                  "size-3",
                                  active
                                    ? "fill-[#D4A373] text-[#D4A373]"
                                    : "text-[#8F9691]"
                                )}
                              />
                              <span>{score}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 피치 or 그립 */}
                    {isSwitch ? (
                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-[#8F9691]">
                          피치
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["low", "mid", "high"] as SwitchPitchChoice[]).map(
                            (p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setPitchChoice(p)}
                                className={cn(
                                  "h-8 rounded-md border text-xs font-semibold transition-colors",
                                  pitchChoice === p
                                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                                    : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:text-[#E4E6E1]"
                                )}
                              >
                                {SWITCH_PITCH_LABELS[p]}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-[#8F9691]">
                          그립
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["palm", "claw", "finger"] as MouseGripChoice[]).map(
                            (g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => setGripChoice(g)}
                                className={cn(
                                  "h-8 rounded-md border text-xs font-semibold transition-colors",
                                  gripChoice === g
                                    ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                                    : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:text-[#E4E6E1]"
                                )}
                              >
                                {MOUSE_GRIP_LABELS[g]}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 마우스 손 크기 */}
                  {isMouse && (
                    <div className="mt-3">
                      <span className="mb-1.5 block text-xs font-medium text-[#8F9691]">
                        손 크기 (F열)
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(
                          [
                            "f1_f8",
                            "f9",
                            "f10",
                            "f11_plus",
                          ] as MouseHandSizeChoice[]
                        ).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setHandChoice(h)}
                            className={cn(
                              "h-8 rounded-md border font-mono text-xs font-semibold transition-colors tabular-nums",
                              handChoice === h
                                ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                                : "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:text-[#E4E6E1]"
                            )}
                          >
                            {MOUSE_HAND_SIZE_LABELS[h]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 한줄평 입력란 (선택 입력 · 최대 80자) */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <label
                        htmlFor="spec-oneline-review"
                        className="font-medium text-[#8F9691]"
                      >
                        한줄평 (선택)
                      </label>
                      <span className="font-mono text-[11px] text-[#8F9691] tabular-nums">
                        {oneLineReview.length}/{ONE_LINE_REVIEW_MAX_LENGTH}자
                      </span>
                    </div>
                    <input
                      id="spec-oneline-review"
                      type="text"
                      maxLength={ONE_LINE_REVIEW_MAX_LENGTH}
                      value={oneLineReview}
                      onChange={(e) =>
                        setOneLineReview(
                          e.target.value.slice(0, ONE_LINE_REVIEW_MAX_LENGTH)
                        )
                      }
                      placeholder="실사용 한줄평을 남겨보세요..."
                      className="h-9 w-full rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    {savedNotice && (
                      <span className="font-mono text-xs font-medium text-[#6B9080]">
                        ✓ 반영됨
                      </span>
                    )}
                    {existingVote && activeDeviceId && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteVote(activeDeviceId);
                          setOneLineReview("");
                        }}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#8F9691] transition-colors hover:border-[#E06C75] hover:text-[#E06C75]"
                      >
                        <Trash2 className="size-3.5" />
                        <span>삭제</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveVote}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#6B9080] px-4 py-1.5 text-xs font-bold whitespace-nowrap text-[#121413] transition-colors hover:bg-[#7CA291]"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>{existingVote ? "수정" : "등록"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ③ 한줄평 */}
          <section className="border-t border-[#282D2A] pt-5">
            <h3 className="mb-2.5 text-sm font-bold text-[#E4E6E1]">한줄평</h3>

            {community.telemetryLogs.length === 0 ? (
              <div className="rounded-lg border border-[#282D2A] bg-[#151816] px-4 py-6 text-center text-xs text-[#8F9691]">
                아직 등록된 한줄평이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-[#282D2A] rounded-lg border border-[#282D2A] bg-[#151816]">
                {community.telemetryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col justify-between gap-2 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center"
                  >
                    {/* 좌측: 한줄 리뷰 텍스트 + 내 리뷰인 경우 [MY] 배지 */}
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                      {log.isCurrentUser && (
                        <span className="shrink-0 rounded bg-[#6B9080] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#121413]">
                          MY
                        </span>
                      )}
                      <span className="min-w-0 break-words font-sans text-xs font-medium text-[#E4E6E1]">
                        {log.structuredSummary}
                      </span>
                    </div>

                    {/* 우측: ★ 별점 / 날짜 */}
                    <div className="flex shrink-0 items-center justify-end gap-2.5 font-mono tabular-nums">
                      <span className="inline-flex items-center gap-1 font-semibold text-[#D4A373]">
                        <Star className="size-3 fill-[#D4A373] text-[#D4A373]" />
                        {log.rating}.0
                      </span>
                      <span className="text-[11px] text-[#8F9691]">
                        {log.createdAt}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SpecRow({
  label,
  value,
  mono,
  accent,
  muted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2 text-xs">
      <span className="shrink-0 text-[#8F9691]">{label}</span>
      <span
        className={cn(
          "min-w-0 break-words text-right",
          mono && "font-mono tabular-nums",
          muted
            ? "font-normal text-[#8F9691]"
            : accent
              ? "font-semibold text-[#6B9080]"
              : "font-semibold text-[#E4E6E1]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function VoteRatioTiles({
  totalCount,
  hasEnoughSample,
  columns,
  rows,
}: {
  totalCount: number;
  hasEnoughSample: boolean;
  columns: 3 | 4;
  rows: Array<{ label: string; count: number }>;
}) {
  const maxCount = Math.max(...rows.map((r) => r.count), 0);

  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 3 ? "grid-cols-3" : "grid-cols-2 min-[460px]:grid-cols-4"
      )}
    >
      {rows.map((row) => {
        const pct =
          totalCount > 0 ? Math.round((row.count / totalCount) * 100) : 0;
        const isTop = hasEnoughSample && maxCount > 0 && row.count === maxCount;

        return (
          <div
            key={row.label}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border px-2.5 py-2 text-center",
              isTop
                ? "border-[#6B9080]/60 bg-[#222623]"
                : "border-[#282D2A] bg-[#151816]"
            )}
          >
            <span
              className={cn(
                "text-[11px] font-medium whitespace-nowrap",
                isTop ? "text-[#6B9080]" : "text-[#8F9691]"
              )}
            >
              {row.label}
            </span>
            <span
              className={cn(
                "mt-0.5 font-mono text-xs tabular-nums whitespace-nowrap",
                isTop
                  ? "font-bold text-[#6B9080]"
                  : "font-semibold text-[#E4E6E1]"
              )}
            >
              {hasEnoughSample ? (
                <>
                  {pct}%{" "}
                  <span className="text-[11px] font-normal text-[#8F9691]">
                    ({row.count})
                  </span>
                </>
              ) : (
                `${row.count}명`
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
