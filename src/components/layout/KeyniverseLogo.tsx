import { cn } from "@/lib/utils";

interface KeyniverseLogoProps {
  className?: string;
}

/**
 * KEYNIVERSE 공식 심볼 마크 (컨셉 A-1 + K: 키캡 + 이니셜 K + 포레스트 세이지 궤도 & 위성)
 */
export function KeyniverseLogo({ className }: KeyniverseLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      {/* 1. 뒤쪽 궤도 (키캡 좌상단 뒤로 지나가는 구간) */}
      <g transform="rotate(-34 32 32)">
        <path
          d="M 5 32 A 27 11.5 0 0 1 59 32"
          stroke="#6B9080"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>

      {/* 2. 조각된 키캡 본체 */}
      <rect
        x="15"
        y="15"
        width="34"
        height="34"
        rx="6"
        fill="#1A1D1B"
        stroke="#E4E6E1"
        strokeWidth="2.3"
      />
      <rect
        x="21.5"
        y="21.5"
        width="21"
        height="21"
        rx="3.2"
        fill="#151816"
        stroke="#E4E6E1"
        strokeWidth="1.8"
      />
      {/* 모서리 베벨 4선 */}
      <line x1="16.8" y1="16.8" x2="22.4" y2="22.4" stroke="#E4E6E1" strokeWidth="1.6" />
      <line x1="47.2" y1="16.8" x2="41.6" y2="22.4" stroke="#E4E6E1" strokeWidth="1.6" />
      <line x1="16.8" y1="47.2" x2="22.4" y2="41.6" stroke="#E4E6E1" strokeWidth="1.6" />
      <line x1="47.2" y1="47.2" x2="41.6" y2="41.6" stroke="#E4E6E1" strokeWidth="1.6" />

      {/* 3. 중앙 기하학 이니셜 K */}
      <path
        d="M27.2 26.2V37.8M36.5 26.2L29.2 32L36.8 37.8"
        stroke="#E4E6E1"
        strokeWidth="2.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* 4. 앞쪽 궤도 (키캡 우하단 앞으로 가로지르는 구간 + 깔끔한 단차 컷) */}
      <g transform="rotate(-34 32 32)">
        <path
          d="M 59 32 A 27 11.5 0 0 1 5 32"
          stroke="#121413"
          strokeWidth="5.4"
          strokeLinecap="round"
        />
        <path
          d="M 59 32 A 27 11.5 0 0 1 5 32"
          stroke="#6B9080"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* 우상단 위성 점 */}
        <circle
          cx="56.2"
          cy="37.2"
          r="3.8"
          fill="#6B9080"
          stroke="#121413"
          strokeWidth="1.4"
        />
      </g>
    </svg>
  );
}
