import Link from "next/link";
import { KeyniverseLogo } from "@/components/layout/KeyniverseLogo";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-[#282D2A] bg-[#151816]">
      <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        {/* 좌측: 브랜드 로고 + 슬로건 + 카피라이트 */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 focus:outline-none"
            >
              <div className="flex size-7 items-center justify-center rounded-md border border-[#282D2A] bg-[#1A1D1B] transition-colors group-hover:border-[#6B9080] group-hover:bg-[#222623]">
                <KeyniverseLogo className="size-5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-[#C9CFCB] transition-colors group-hover:text-[#E4E6E1]">
                KEYNIVERSE
              </span>
              <span className="rounded border border-[#6B9080]/40 bg-[#6B9080]/10 px-1 py-0.5 font-mono text-[9px] leading-none font-semibold tracking-wider text-[#6B9080]">
                BETA
              </span>
            </Link>
            <span className="text-[#282D2A]" aria-hidden="true">
              |
            </span>
            <span className="text-xs text-[#8F9691]">
              키보드·마우스 하드웨어 커뮤니티
            </span>
          </div>

          <p className="font-mono text-[11px] text-[#8F9691] tabular-nums">
            © 2026 KEYNIVERSE. All rights reserved.
          </p>
        </div>

        {/* 우측: 약관 · 개인정보처리방침 · 광고/제휴 안내 (동일 폰트색 통일) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs lg:justify-end">
          <Link
            href="/policy?tab=terms"
            className="font-semibold text-[#E4E6E1]/85 transition-colors hover:text-[#E4E6E1]"
          >
            이용약관
          </Link>
          <span className="text-[#282D2A]" aria-hidden="true">
            ·
          </span>
          <Link
            href="/policy?tab=privacy"
            className="font-semibold text-[#E4E6E1]/85 transition-colors hover:text-[#E4E6E1]"
          >
            개인정보처리방침
          </Link>
          <span className="text-[#282D2A]" aria-hidden="true">
            ·
          </span>
          <Link
            href="/policy?tab=partnership"
            className="font-semibold text-[#E4E6E1]/85 transition-colors hover:text-[#E4E6E1]"
          >
            광고/제휴 문의
          </Link>
        </div>
      </div>
    </footer>
  );
}
