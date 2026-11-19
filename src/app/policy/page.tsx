import { Suspense } from "react";
import type { Metadata } from "next";
import { PolicyViewer } from "@/components/layout/PolicyViewer";

export const metadata: Metadata = {
  title: "약관 · 개인정보 · 제휴 안내 | KEYNIVERSE",
  description:
    "KEYNIVERSE 서비스 이용약관, 개인정보처리방침 및 공식 광고/제휴 안내",
};

export default function PolicyPage() {
  return (
    <Suspense fallback={null}>
      <PolicyViewer />
    </Suspense>
  );
}
