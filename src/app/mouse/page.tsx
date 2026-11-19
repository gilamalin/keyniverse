import type { Metadata } from "next";
import { MouseTester } from "@/components/mouse/MouseTester";

export const metadata: Metadata = {
  title: "마우스 테스트 | KEYNIVERSE",
  description:
    "마우스 8K 폴링레이트(Hz) 측정 및 5버튼 스위치 더블클릭 정밀 테스트",
};

export default function MousePage() {
  return <MouseTester />;
}
