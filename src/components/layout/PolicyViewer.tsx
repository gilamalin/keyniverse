"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Handshake,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PolicyTab = "terms" | "privacy" | "partnership";

const CONTACT_EMAIL = "keyniverse.official@gmail.com";

export function PolicyViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");

  const activeTab: PolicyTab =
    rawTab === "privacy" || rawTab === "partnership" ? rawTab : "terms";

  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  const handleSelectTab = (tab: PolicyTab) => {
    router.push(`/policy?tab=${tab}`, { scroll: false });
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2200);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 상단 페이지 헤더 */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#282D2A] pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
              <ShieldCheck className="size-3.5" />
              POLICY &amp; PARTNERSHIP
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#D5DBD6] sm:text-3xl">
            약관 · 개인정보 · 제휴 안내
          </h1>
          <p className="mt-1 text-sm text-[#8F9691]">
            서비스 이용약관, 개인정보처리방침 및 공식 제휴 문의
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3.5 py-2 text-xs font-semibold text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1] sm:self-auto"
        >
          <ArrowLeft className="size-3.5" />
          <span>커뮤니티 홈으로</span>
        </Link>
      </div>

      {/* 2. 상단 탭 전환 바 */}
      <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-3">
        {(
          [
            { id: "terms", label: "이용약관", icon: FileText },
            { id: "privacy", label: "개인정보처리방침", icon: ShieldCheck },
            { id: "partnership", label: "광고/제휴 문의", icon: Handshake },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectTab(tab.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                active
                  ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                  : "border-[#282D2A] bg-[#151816] text-[#8F9691] hover:border-[#6B9080]/50 hover:text-[#E4E6E1]"
              )}
            >
              <Icon className="size-3.5 text-[#6B9080]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. 탭별 본문 컨텐츠 */}
      {activeTab === "terms" && (
        <article className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-6 text-sm leading-relaxed text-[#E4E6E1]">
          <div className="mb-5 border-b border-[#282D2A] pb-4">
            <h2 className="text-lg font-bold text-[#E4E6E1]">
              KEYNIVERSE 서비스 이용약관
            </h2>
            <p className="mt-1 font-mono text-xs text-[#8F9691] tabular-nums">
              시행일자: 2026. 11. 22 · BETA 운영 기준
            </p>
          </div>

          <div className="flex flex-col gap-5 text-xs leading-relaxed text-[#8F9691] sm:text-sm">
            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제1조 (목적 및 베타 서비스 안내)
              </h3>
              <p>
                본 약관은 KEYNIVERSE(이하 &ldquo;서비스&rdquo;)가 제공하는 키보드·마우스 하드웨어 커뮤니티, 스펙 도감 및 웹 기반 입력 테스트 서비스의 이용 조건과 운영 기준을 규정합니다. 현재 서비스는 BETA 단계로 운영 중이며, 기능 개선 및 안정화를 위해 사전 안내 후 일부 기능이 변경될 수 있습니다.
              </p>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제2조 (계정 인증 · 닉네임 · 탈퇴 정책)
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  서비스는 다계정 여론·투표 조작 및 도배를 방지하기 위해 Google OAuth 2.0 기반 단일 소셜 로그인 방식을 채택합니다.
                </li>
                <li>
                  닉네임은 한글·영문·숫자 2~6자로 설정할 수 있으며, 운영진 사칭 예약어 및 비속어는 사용할 수 없습니다. 최초 설정 후 오타 수정을 위한 1회 변경 이후에는 <strong className="text-[#E4E6E1]">30일 간격</strong>으로 변경이 제한됩니다.
                </li>
                <li>
                  탈퇴 후 재가입을 반복하는 어뷰징을 방지하기 위해 회원 탈퇴 시 동일 계정의 재가입은 <strong className="text-[#E4E6E1]">30일간 제한</strong>됩니다.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제3조 (커뮤니티 게시물 운영 및 이용 제한)
              </h3>
              <p>
                회원이 작성한 게시글, 댓글, 투표, 첨부 이미지의 저작권은 작성자 본인에게 귀속됩니다. 단, 아래 행위에 해당하는 경우 사전 통보 없이 게시물이 삭제되거나 계정 활동이 일정 기간(1일·7일·30일) 또는 영구 제한될 수 있습니다.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>타 회원 또는 특정 집단에 대한 욕설, 비방, 명예훼손 게시물</li>
                <li>사전 협의되지 않은 상업적 홍보, 바이럴 마케팅, 제휴 수익 링크 도배</li>
                <li>음란물, 불법 촬영물 또는 타인의 저작권을 침해하는 이미지 첨부</li>
                <li>자동화 매크로·스크립트를 이용한 투표 및 추천수 조작 행위</li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제4조 (웹 테스트 수치 및 스펙 도감 데이터의 면책)
              </h3>
              <p>
                1. 키보드 채터링·동시입력 테스트 및 마우스 8K 폴링레이트·더블클릭 테스트는 사용자의 OS, 웹 브라우저, USB 포트 환경에 따라 오차가 발생할 수 있으므로 하드웨어 불량 여부를 확정하는 공식 감정서로 사용될 수 없습니다.
                <br />
                2. 스펙 도감에 기재된 키압(gf), 스트로크(mm), 무게(g), 치수 데이터는 제조사 공식 발표 제원을 기준으로 제공되며, 제조사 리비전 및 생산 배치에 따라 실물과 미세한 편차가 있을 수 있습니다.
              </p>
            </section>
          </div>
        </article>
      )}

      {activeTab === "privacy" && (
        <article className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-6 text-sm leading-relaxed text-[#E4E6E1]">
          <div className="mb-5 border-b border-[#282D2A] pb-4">
            <h2 className="text-lg font-bold text-[#E4E6E1]">
              KEYNIVERSE 개인정보처리방침
            </h2>
            <p className="mt-1 font-mono text-xs text-[#8F9691] tabular-nums">
              시행일자: 2026. 11. 22 · Google OAuth 2.0 단일 인증 기준
            </p>
          </div>

          <div className="flex flex-col gap-5 text-xs leading-relaxed text-[#8F9691] sm:text-sm">
            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                1. 개인정보의 수집 항목 및 수집 방법 (비밀번호 미수집 원칙)
              </h3>
              <p>
                KEYNIVERSE는 자체 비밀번호를 일절 수집·저장하지 않으며, Google OAuth 2.0 소셜 로그인을 통해 아래의 최소 정보만 수집합니다.
              </p>
              <div className="mt-2.5 rounded-lg border border-[#282D2A] bg-[#151816] p-3.5 font-mono text-xs text-[#E4E6E1]">
                • 수집 항목: Google 계정 고유 식별자(UID), 이메일 주소, 커뮤니티 닉네임
                <br />• 미수집 항목: 비밀번호, 주민등록번호, 전화번호, 실물 주소
              </div>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                2. 개인정보의 수집 및 이용 목적
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>커뮤니티 게시글·댓글 작성자 식별 및 본인 게시물 수정·삭제 권한 확인</li>
                <li>스펙 도감 평가 및 커뮤니티 투표의 1인 1회 참여 보장(다계정 어뷰징 방지)</li>
                <li>신고 접수 처리 및 약관 위반 계정에 대한 이용 제한 조치</li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                3. 쿠키(Cookie) 및 브라우저 저장소 활용 안내
              </h3>
              <p>
                서비스는 로그인 세션 유지를 위해 인증 쿠키(Cookie)를 사용하며, 게시글 조회수 중복 집계 방지를 위해 브라우저 세션 저장소(sessionStorage), 키보드·마우스 테스트 인증 기록 유지를 위해 로컬 저장소(localStorage)를 활용합니다. 사용자는 브라우저 설정 또는 로그아웃을 통해 언제든 삭제할 수 있습니다.
              </p>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                4. 개인정보의 보유 기간, 탈퇴 처리 및 파기 절차
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  회원 개인정보(계정 정보·프로필·이메일)는 회원 탈퇴 요청 시 지체 없이 영구 파기됩니다.
                </li>
                <li>
                  단, 탈퇴 후 반복 재가입을 통한 포인트·투표 어뷰징을 방지하기 위해 원본 복원이 불가능한 <strong className="text-[#E4E6E1]">단방향 암호화 해시값(SHA-256)</strong>만 탈퇴일로부터 <strong className="text-[#E4E6E1]">30일간</strong> 보관 후 자동 만료됩니다.
                </li>
                <li>
                  탈퇴 시 기존에 작성된 커뮤니티 게시글 및 댓글은 토론 흐름과 신고 기록 보존을 위해 작성자명이 <strong className="text-[#E4E6E1]">&lsquo;탈퇴한 사용자&rsquo;</strong>로 익명화되어 유지됩니다. 삭제를 원하는 게시물은 탈퇴 전 직접 삭제해 주세요.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                5. 클라우드 인프라 및 국외 처리 위탁
              </h3>
              <p>
                서비스는 안정적인 운영을 위해 글로벌 클라우드 인프라인 <strong className="text-[#E4E6E1]">Vercel Inc.</strong>(웹 호스팅) 및 <strong className="text-[#E4E6E1]">Supabase Inc.</strong>(데이터베이스·인증·이미지 스토리지)를 통해 데이터를 처리·보관합니다.
              </p>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                6. 개인정보 보호 문의처
              </h3>
              <p>
                개인정보 열람·삭제 요청 및 관련 문의는 아래 공식 운영 이메일로 접수해 주시면 확인 후 신속히 안내해 드립니다.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-1.5 font-mono text-xs font-semibold text-[#6B9080]">
                <Mail className="size-3.5" />
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </section>
          </div>
        </article>
      )}

      {activeTab === "partnership" && (
        <article className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-6 text-sm leading-relaxed text-[#E4E6E1]">
          <div className="mb-5 border-b border-[#282D2A] pb-4">
            <h2 className="text-lg font-bold text-[#E4E6E1]">
              공식 광고 · 스토어 파트너십 · 스펙 도감 등재 문의
            </h2>
            <p className="mt-1 text-xs text-[#8F9691]">
              커스텀 키보드·스위치·게이밍 마우스 브랜드 및 국내외 공식 스토어와의 제휴를 환영합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 구좌 1 */}
            <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-4">
              <span className="inline-block rounded border border-[#D4A373]/50 bg-[#222623] px-2 py-0.5 font-mono text-[11px] font-bold text-[#D4A373]">
                SLOT 01 · IN-FEED NATIVE AD
              </span>
              <h3 className="mt-2 text-sm font-bold text-[#E4E6E1]">
                커뮤니티 최상단 인피드 [AD] 스폰서 행
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#8F9691]">
                커뮤니티 게시글 목록 상단에 고정 노출되는 1줄 네이티브 배너입니다. 사이트 디자인 톤을 해치지 않으면서 신규 스위치 입고, 공동구매(Group Buy), 특가 이벤트를 자연스럽게 전달합니다.
              </p>
            </div>

            {/* 구좌 2 */}
            <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-4">
              <span className="inline-block rounded border border-[#6B9080]/50 bg-[#222623] px-2 py-0.5 font-mono text-[11px] font-bold text-[#6B9080]">
                SLOT 02 · SIDEBAR SPEC CARD AD
              </span>
              <h3 className="mt-2 text-sm font-bold text-[#E4E6E1]">
                우측 사이드바 스펙 카드 배너
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#8F9691]">
                커뮤니티 목록·상세·글쓰기 화면 우측에 상시 노출되는 스펙 요약형 배너입니다. 제품 핵심 제원(키압·무게), 공제 일정 및 공식 스토어 바로가기 버튼을 함께 제공합니다.
              </p>
            </div>
          </div>

          {/* 도감 DB 등록 & 이메일 복사 박스 */}
          <div className="mt-4 flex flex-col justify-between gap-4 rounded-xl border border-[#282D2A] bg-[#151816] p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-[#E4E6E1]">
                광고 구좌 문의 및 신규 장비 스펙 도감 등재 요청
              </h3>
              <p className="mt-1 text-xs text-[#8F9691]">
                제조사 공식 스펙 시트와 함께 아래 이메일로 문의해 주시면 확인 후 회신드립니다.
              </p>
            </div>

            <div className="flex flex-wrap shrink-0 items-center gap-2">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 py-2 font-mono text-xs font-semibold text-[#D4A373] transition-colors hover:border-[#D4A373]/60"
              >
                <Mail className="size-3.5" />
                <span>{CONTACT_EMAIL}</span>
              </a>
              <button
                type="button"
                onClick={() => void handleCopyEmail()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#6B9080] bg-[#222623] px-3 py-2 text-xs font-semibold whitespace-nowrap text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413]"
              >
                {copiedEmail ? (
                  <>
                    <Check className="size-3.5 text-[#6B9080]" />
                    <span>복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>이메일 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
