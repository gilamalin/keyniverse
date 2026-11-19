import { Suspense } from "react";
import type { Metadata } from "next";
import { CommunityBoard } from "@/components/community/CommunityBoard";

export const metadata: Metadata = {
  title: "KEYNIVERSE | 공식 하드웨어 커뮤니티 & 스펙 연구소",
  description:
    "키보드·마우스 자유 게시판, 커스텀 빌드·셋업 공유, 투표 및 특가/드랍 정보",
};

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CommunityBoard />
    </Suspense>
  );
}
