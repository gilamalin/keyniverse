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
  metadataBase: new URL("https://keyniverse.vercel.app"),
  title: {
    default: "KEYNIVERSE | 게이밍 키보드·마우스 커뮤니티 & 스펙 연구소",
    template: "%s",
  },
  description:
    "게이밍 키보드 스위치·마우스 스펙 도감, 8K 폴링레이트·채터링 정밀 웹 테스트, 하드웨어 공식 커뮤니티 KEYNIVERSE",
  keywords: [
    "KEYNIVERSE",
    "키니버스",
    "게이밍 마우스 스펙",
    "키보드 스위치 도감",
    "자석축 스위치",
    "키보드 채터링 테스트",
    "마우스 8K 폴링레이트 테스트",
    "마우스 더블클릭 테스트",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "KEYNIVERSE",
    title: "KEYNIVERSE | 게이밍 키보드·마우스 커뮤니티 & 스펙 연구소",
    description:
      "스위치 61종 · 마우스 40종 스펙 도감, 8K 폴링레이트·채터링 정밀 테스트, 하드웨어 커뮤니티",
  },
  twitter: {
    card: "summary_large_image",
    title: "KEYNIVERSE | 게이밍 키보드·마우스 커뮤니티 & 스펙 연구소",
    description:
      "스위치 61종 · 마우스 40종 스펙 도감, 8K 폴링레이트·채터링 정밀 테스트, 하드웨어 커뮤니티",
  },
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
