import type { Metadata } from "next";
import { KeyboardTester } from "@/components/keyboard/KeyboardTester";

export const metadata: Metadata = {
  title: "키보드 테스트 | KEYNIVERSE",
  description:
    "고정밀 키보드 채터링(Chattering) 감지 및 동시입력(NKRO) 진단 웹 테스트",
};

export default function KeyboardTesterPage() {
  return <KeyboardTester />;
}
