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

const PARTNER_EMAIL = "partner@keyniverse.kr";

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
      await navigator.clipboard.writeText(PARTNER_EMAIL);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2200);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 상단 페이지 헤더 (전 페이지 통일 규격) */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#282D2A] pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
              <ShieldCheck className="size-3.5" />
              POLICY &amp; PARTNERSHIP
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#E4E6E1] sm:text-3xl">
            KEYNIVERSE 약관 · 개인정보 · 제휴 안내
          </h1>
          <p className="mt-1 text-sm text-[#8F9691]">
            서비스 이용약관, Google 단일 인증 개인정보처리방침 및 공식 파트너십·광고 문의를 안내합니다.
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
              시행일자: 2026. 11. 16
            </p>
          </div>

          <div className="flex flex-col gap-5 text-xs leading-relaxed text-[#8F9691] sm:text-sm">
            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제1조 (목적)
              </h3>
              <p>
                본 약관은 KEYNIVERSE(이하 &ldquo;서비스&rdquo;)가 제공하는 키보드·마우스 하드웨어 커뮤니티, 스펙 도감 데이터베이스 및 웹 브라우저 기반 입력 테스트 서비스의 이용 조건과 운영 기준을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제2조 (계정 인증 및 보안)
              </h3>
              <p>
                서비스는 다계정 생성을 통한 여론·투표 조작 및 매크로 도배를 방지하기 위해 Google OAuth 2.0 기반 단일 소셜 로그인 방식을 채택합니다. 회원은 본인의 Google 계정을 안전하게 관리할 책임이 있으며, 타인의 계정을 도용할 수 없습니다.
              </p>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제3조 (커뮤니티 게시물 운영 기준)
              </h3>
              <p>
                회원이 작성한 게시글, 댓글, 투표, 첨부 이미지의 저작권은 작성자 본인에게 귀속됩니다. 단, 다음 각 호에 해당하는 게시물은 사전 통보 없이 삭제되거나 계정 이용이 제한될 수 있습니다.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>타 회원 또는 특정 집단에 대한 욕설, 비방, 명예훼손 게시물</li>
                <li>사전 협의되지 않은 상업적 홍보, 바이럴 마케팅, 제휴 수익(어필리에이트) 링크 도배</li>
                <li>음란물, 불법 촬영물 또는 저작권을 침해하는 이미지 첨부</li>
                <li>자동화 매크로·스크립트를 이용한 투표 및 추천수 조작 행위</li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                제4조 (웹 테스트 계측 수치 및 스펙 도감 데이터의 면책)
              </h3>
              <p>
                1. 서비스 내 키보드 채터링·동시입력 테스트 및 마우스 8K 폴링레이트·더블클릭 테스트는 사용자의 OS, 웹 브라우저 환경, USB 포트 절전 설정에 따라 오차가 발생할 수 있으므로 하드웨어 불량 여부를 확정하는 법적·공식 감정서로 사용될 수 없습니다.
                <br />
                2. 스펙 도감(/specs)에 기재된 키압(gf), 스트로크(mm), 무게(g), 치수 데이터는 제조사 공식 발표 제원을 기준으로 제공되며, 제조사 금형 리비전(Revision) 및 배치에 따라 실물과 미세한 편차가 있을 수 있습니다.
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
              시행일자: 2026. 11. 16 · Google OAuth 2.0 단일 인증 기준
            </p>
          </div>

          <div className="flex flex-col gap-5 text-xs leading-relaxed text-[#8F9691] sm:text-sm">
            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                1. 개인정보의 수집 항목 및 수집 방법 (비밀번호 미수집 원칙)
              </h3>
              <p>
                KEYNIVERSE는 자체 회원가입 폼이나 비밀번호를 일절 수집·저장하지 않으며, 오직 Google OAuth 2.0 단일 소셜 로그인을 통해 아래의 최소 식별 정보만 제공받습니다.
              </p>
              <div className="mt-2.5 rounded-lg border border-[#282D2A] bg-[#151816] p-3.5 font-mono text-xs text-[#E4E6E1]">
                • 수집 항목: Google 계정 고유 식별자(UID), 이메일 주소, 커뮤니티 표시 닉네임
                <br />• 수집하지 않는 항목: 비밀번호, 주민등록번호, 전화번호, 실물 주소
              </div>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                2. 개인정보의 수집 및 이용 목적
              </h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>커뮤니티 게시글·댓글 작성자 식별 및 본인 게시물 수정·삭제 권한 확인</li>
                <li>스펙 도감 체감 투표 및 커뮤니티 양자택일 투표의 1인 1회 참여 제한(다계정 어뷰징 방지)</li>
                <li>약관 위반 및 불법 도배 계정에 대한 서비스 이용 제한 조치</li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                3. 브라우저 로컬 스토리지(localStorage) 활용 안내
              </h3>
              <p>
                서비스는 원활한 사용자 경험을 위해 사용자 브라우저의 로컬 스토리지(`localStorage`)에 키보드/마우스 테스트 인증 통과 상태 및 로그인 세션을 저장합니다. 사용자는 언제든지 브라우저 설정 또는 로그아웃 버튼을 통해 로컬 데이터를 초기화할 수 있습니다.
              </p>
            </section>

            <section>
              <h3 className="mb-1.5 font-bold text-[#E4E6E1]">
                4. 개인정보의 보유 기간 및 파기 절차
              </h3>
              <p>
                회원의 개인정보는 원칙적으로 회원 탈퇴 시까지 보유·이용되며, 회원이 계정 연동 해제 또는 탈퇴를 요청할 경우 지체 없이 복구 불가능한 방법으로 영구 파기합니다.
              </p>
            </section>
          </div>
        </article>
      )}

      {activeTab === "partnership" && (
        <article className="rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-6 text-sm leading-relaxed text-[#E4E6E1]">
          <div className="mb-5 border-b border-[#282D2A] pb-4">
            <h2 className="text-lg font-bold text-[#E4E6E1]">
              공식 광고 · 스토어 파트너십 · 도감 DB 등재 문의
            </h2>
            <p className="mt-1 text-xs text-[#8F9691]">
              커스텀 키보드·스위치·게이밍 마우스 브랜드 및 국내외 공식 벤더/스토어와의 제휴를 환영합니다.
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
                메인 홈(`/`) 게시글 목록 최상단에 고정 노출되는 1줄 네이티브 배너입니다. 사이트 고유의 차콜 &amp; 세이지 감성을 해치지 않으면서 신규 특주축 입고, 공동구매(Group Buy), 할인 이벤트를 가장 높은 주목도로 전달합니다.
              </p>
            </div>

            {/* 구좌 2 */}
            <div className="rounded-xl border border-[#282D2A] bg-[#151816] p-4">
              <span className="inline-block rounded border border-[#6B9080]/50 bg-[#222623] px-2 py-0.5 font-mono text-[11px] font-bold text-[#6B9080]">
                SLOT 02 · SIDEBAR SPEC CARD AD
              </span>
              <h3 className="mt-2 text-sm font-bold text-[#E4E6E1]">
                우측 사이드바 다크 매트 스펙 카드 배너
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#8F9691]">
                커뮤니티 목록·상세·글쓰기 모든 화면 우측에 상시 고정(Sticky)되는 스펙 요약형 배너입니다. 제품 도트 그래픽과 핵심 스펙(키압/무게), 공제 단가 및 파트너 스토어 직결 버튼을 제공합니다.
              </p>
            </div>
          </div>

          {/* 도감 DB 등록 & 이메일 복사 박스 */}
          <div className="mt-4 flex flex-col justify-between gap-4 rounded-xl border border-[#282D2A] bg-[#151816] p-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-[#E4E6E1]">
                광고 구좌 문의 및 신규 장비 스펙 도감(/specs) 등재 요청
              </h3>
              <p className="mt-1 text-xs text-[#8F9691]">
                제조사 공식 데이터시트와 함께 아래 이메일로 문의해 주시면 담당팀에서 빠르게 회신드립니다.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#282D2A] bg-[#1A1D1B] px-3 py-2 font-mono text-xs font-semibold text-[#D4A373]">
                <Mail className="size-3.5" />
                {PARTNER_EMAIL}
              </span>
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
