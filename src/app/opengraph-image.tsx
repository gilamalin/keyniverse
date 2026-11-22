import { ImageResponse } from "next/og";

export const alt = "KEYNIVERSE — 게이밍 키보드·마우스 공식 커뮤니티 & 스펙 연구소";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#121413",
          padding: "72px 84px",
          fontFamily: "sans-serif",
          border: "1px solid #282D2A",
        }}
      >
        {/* 좌측 브랜드 텍스트 영역 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: "700px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(107, 144, 128, 0.45)",
              backgroundColor: "#1A1D1B",
              color: "#6B9080",
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              marginBottom: "24px",
              alignSelf: "flex-start",
            }}
          >
            HARDWARE COMMUNITY &amp; SPEC LAB
          </div>

          <div
            style={{
              fontSize: "74px",
              fontWeight: 800,
              letterSpacing: "0.01em",
              color: "#F4F6F2",
              lineHeight: 1.05,
            }}
          >
            KEYNIVERSE
          </div>

          <div
            style={{
              marginTop: "20px",
              fontSize: "26px",
              color: "#8F9691",
              lineHeight: 1.45,
            }}
          >
            Gaming Keyboard &amp; Mouse Community, Spec Archive &amp; 8K Test Lab
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "36px",
            }}
          >
            {["120+ Switches", "80+ Mice", "NKRO & Chatter", "8K Polling"].map(
              (chip) => (
                <div
                  key={chip}
                  style={{
                    display: "flex",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #282D2A",
                    backgroundColor: "#1A1D1B",
                    color: "#C9CFCB",
                    fontSize: "18px",
                    fontWeight: 600,
                  }}
                >
                  {chip}
                </div>
              )
            )}
          </div>
        </div>

        {/* 우측 KEYNIVERSE A-1 + K 심볼 마크 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "280px",
            height: "280px",
            borderRadius: "36px",
            border: "1px solid #282D2A",
            backgroundColor: "#151816",
          }}
        >
          <svg
            width="220"
            height="220"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g transform="rotate(-34 32 32)">
              <path
                d="M 6 32 A 26 11 0 0 1 58 32"
                stroke="#6B9080"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </g>
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
            <line x1="16.8" y1="16.8" x2="22.4" y2="22.4" stroke="#E4E6E1" strokeWidth="1.6" />
            <line x1="47.2" y1="16.8" x2="41.6" y2="22.4" stroke="#E4E6E1" strokeWidth="1.6" />
            <line x1="16.8" y1="47.2" x2="22.4" y2="41.6" stroke="#E4E6E1" strokeWidth="1.6" />
            <line x1="47.2" y1="47.2" x2="41.6" y2="41.6" stroke="#E4E6E1" strokeWidth="1.6" />
            <path
              d="M27.2 26.2V37.8M36.5 26.2L29.2 32L36.8 37.8"
              stroke="#E4E6E1"
              strokeWidth="2.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <g transform="rotate(-34 32 32)">
              <path
                d="M 58 32 A 26 11 0 0 1 6 32"
                stroke="#151816"
                strokeWidth="5.4"
                strokeLinecap="round"
              />
              <path
                d="M 58 32 A 26 11 0 0 1 6 32"
                stroke="#6B9080"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle
                cx="55.2"
                cy="37"
                r="3.8"
                fill="#6B9080"
                stroke="#151816"
                strokeWidth="1.4"
              />
            </g>
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
