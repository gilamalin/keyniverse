"use client";

import { MouseShape, SwitchColorway } from "@/types/specs";
import { cn } from "@/lib/utils";

interface SwitchCrossSectionIconProps {
  colorway: SwitchColorway;
  pins: 3 | 5;
  className?: string;
}

/**
 * 외부 이미지 URL 없이 스위치의 상부 하우징 / 하부 하우징 / 스템 컬러 조합과
 * 3핀·5핀 구조를 직관적으로 보여주는 매트 벡터 그래픽
 */
export function SwitchCrossSectionIcon({
  colorway,
  pins,
  className,
}: SwitchCrossSectionIconProps) {
  return (
    <div
      className={cn(
        "relative flex size-14 shrink-0 items-center justify-center rounded-lg border border-[#282D2A] bg-[#151816] p-1.5",
        className
      )}
      title={`상부 ${colorway.topHex} / 하부 ${colorway.bottomHex} / 스템 ${colorway.stemHex}`}
    >
      <svg
        viewBox="0 0 48 48"
        className="size-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* 스템 십자(+) 기둥 */}
        <rect
          x="20"
          y="5"
          width="8"
          height="11"
          rx="1.5"
          fill={colorway.stemHex}
          stroke="#121413"
          strokeWidth="1.2"
        />
        <rect
          x="17"
          y="8"
          width="14"
          height="4.5"
          rx="1"
          fill={colorway.stemHex}
        />

        {/* 상부 하우징 (사다리꼴 캡) */}
        <path
          d="M11 15.5L15.5 13H32.5L37 15.5V24H11V15.5Z"
          fill={colorway.topHex}
          stroke="#282D2A"
          strokeWidth="1.2"
        />

        {/* 중앙 걸쇠 플레이트 구분선 */}
        <rect x="8" y="23.5" width="32" height="2.5" rx="1" fill="#282D2A" />

        {/* 하부 하우징 */}
        <path
          d="M12 26H36L34 37.5H14L12 26Z"
          fill={colorway.bottomHex}
          stroke="#282D2A"
          strokeWidth="1.2"
        />

        {/* 중앙 기둥 및 양옆 가이드 핀 (3핀 vs 5핀) */}
        <rect x="21.5" y="37.5" width="5" height="6" rx="1.5" fill={colorway.bottomHex} />
        <rect x="14.5" y="37.5" width="2" height="5" rx="0.5" fill="#D4A373" />
        <rect x="31.5" y="37.5" width="2" height="5" rx="0.5" fill="#D4A373" />
        {pins === 5 && (
          <>
            <rect
              x="17.8"
              y="37.5"
              width="2"
              height="4"
              rx="0.5"
              fill={colorway.bottomHex}
            />
            <rect
              x="28.2"
              y="37.5"
              width="2"
              height="4"
              rx="0.5"
              fill={colorway.bottomHex}
            />
          </>
        )}
      </svg>
    </div>
  );
}

interface MouseSilhouetteIconProps {
  shape: MouseShape;
  accentHex: string;
  className?: string;
}

/**
 * 대칭형(Symmetrical) vs 비대칭형(Ergonomic) 마우스 쉘 실루엣 다이어그램
 */
export function MouseSilhouetteIcon({
  shape,
  accentHex,
  className,
}: MouseSilhouetteIconProps) {
  return (
    <div
      className={cn(
        "relative flex size-14 shrink-0 items-center justify-center rounded-lg border border-[#282D2A] bg-[#151816] p-1.5",
        className
      )}
    >
      <svg
        viewBox="0 0 48 48"
        className="size-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {shape === "symmetrical" ? (
          /* 대칭형 쉘 실루엣 */
          <path
            d="M24 5C16.5 5 13 10.5 13.5 18.5C14 24 14.5 27.5 13.5 33C12.7 37.8 16.5 43 24 43C31.5 43 35.3 37.8 34.5 33C33.5 27.5 34 24 34.5 18.5C35 10.5 31.5 5 24 5Z"
            fill="#222623"
            stroke="#6B9080"
            strokeWidth="1.4"
          />
        ) : (
          /* 비대칭형(에르고) 쉘 실루엣 - 좌측 엄지 파임과 우측 완만한 경사 */
          <path
            d="M23 5C15.5 5 12 10.5 13 18C13.8 23.5 15.2 26.8 13.2 32.5C11.8 36.8 15.8 43 23.8 43C32 43 36.2 38 35.5 32.5C34.8 27 35.8 22.5 35.5 17C35 10 30.5 5 23 5Z"
            fill="#222623"
            stroke="#D4A373"
            strokeWidth="1.4"
          />
        )}

        {/* 버튼 절개선 */}
        <line x1="24" y1="5.5" x2="24" y2="20" stroke="#282D2A" strokeWidth="1.2" />
        <path d="M14 19.5Q24 21.5 34 19.5" stroke="#282D2A" strokeWidth="1.2" />

        {/* 휠 포인트 */}
        <rect
          x="22.2"
          y="9.5"
          width="3.6"
          height="7.5"
          rx="1.8"
          fill={accentHex}
        />

        {/* 센서 위치 점선 십자 */}
        <circle cx="24" cy="27.5" r="2" fill="#8F9691" fillOpacity="0.6" />
      </svg>
    </div>
  );
}

interface SpecMiniBarProps {
  value: number;
  min: number;
  max: number;
  tone?: "sage" | "sand";
  className?: string;
}

/**
 * 스펙 수치를 직관적으로 비교하기 위한 매트 게이지 바 (광원 효과 없음)
 */
export function SpecMiniBar({
  value,
  min,
  max,
  tone = "sage",
  className,
}: SpecMiniBarProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-[#282D2A]",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-200",
          tone === "sand" ? "bg-[#D4A373]" : "bg-[#6B9080]"
        )}
        style={{ width: `${Math.max(6, Math.min(100, ratio))}%` }}
      />
    </div>
  );
}
