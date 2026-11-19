import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "KEYNIVERSE | 8K 게이밍 기어 정밀 계측 연구소",
  description:
    "고정밀 키보드 채터링·동시입력(NKRO) 테스트 및 8K 마우스 폴링레이트·더블클릭 진단 웹 유틸리티",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${notoSansKr.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full bg-background text-foreground font-sans antialiased selection:bg-[#6B9080]/35 selection:text-[#E4E6E1] flex flex-col"
      >
        <TopNav />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
