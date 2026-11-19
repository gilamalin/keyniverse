import type { Metadata } from "next";
import { MyPageClient } from "@/components/mypage/MyPageClient";

export const metadata: Metadata = {
  title: "마이페이지 | KEYNIVERSE",
  description: "KEYNIVERSE 내 정보 · 활동 내역 관리",
};

export default function MyPage() {
  return <MyPageClient />;
}
