import { Suspense } from "react";
import type { Metadata } from "next";
import { SpecsCatalog } from "@/components/specs/SpecsCatalog";

export const metadata: Metadata = {
  title: "스위치 & 마우스 스펙 도감 | KEYNIVERSE",
  description:
    "공식 스펙 시트 기반의 키보드 스위치 및 게이밍 마우스 다중 조건 실시간 필터 도감",
};

export default function SpecsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-8 text-center font-mono text-xs text-[#8F9691]">
          스펙 도감 데이터를 불러오는 중...
        </div>
      }
    >
      <SpecsCatalog />
    </Suspense>
  );
}
