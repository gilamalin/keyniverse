"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  closeAuthModal,
  getAuthModalState,
  getAuthStoreVersion,
  getServerAuthStoreVersion,
  openAuthModal,
  signInWithGoogle,
  subscribeAuthStore,
} from "@/lib/auth-store";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";

export function GoogleGIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * 미니멀 Google 단일 소셜 로그인 모달
 */
export function AuthModal() {
  const version = useSyncExternalStore(
    subscribeAuthStore,
    getAuthStoreVersion,
    getServerAuthStoreVersion
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { open, reason } =
    version > 0 ? getAuthModalState() : { open: false, reason: null };

  // OAuth 콜백 오류(30일 재가입 쿨타임 등) 감지 시 로그인 모달에 안내 문구 자동 표시
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (!authError) return;

    if (authError === "withdrawn_cooldown") {
      openAuthModal("탈퇴 후 30일간 같은 계정으로 재가입할 수 없습니다.");
    } else {
      openAuthModal("로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }

    params.delete("auth_error");
    const nextSearch = params.toString();
    const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAuthModal();
      }
    };
    const releaseScrollLock = acquireBodyScrollLock();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      releaseScrollLock();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    const res = await signInWithGoogle();
    if (res.error) {
      setErrorMsg("로그인 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      onClick={closeAuthModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="로그인"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
      >
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between border-b border-[#282D2A] bg-[#151816] px-5 py-3.5">
          <h2 className="text-sm font-bold text-[#E4E6E1]">로그인</h2>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="로그인 모달 닫기"
            className="flex size-7 items-center justify-center rounded-lg border border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] transition-colors hover:border-[#6B9080] hover:text-[#E4E6E1]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-5">
          {reason && (
            <p className="mb-4 rounded-lg border border-[#6B9080]/40 bg-[#222623] px-3 py-2 text-xs text-[#E4E6E1]">
              {reason}
            </p>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleGoogleLogin()}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#6B9080] bg-[#222623] px-4 py-3 text-sm font-semibold text-[#E4E6E1] transition-colors hover:bg-[#6B9080] hover:text-[#121413] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleGIcon className="size-4 shrink-0" />
            <span>
              {loading ? "연결 중..." : "Google 계정으로 계속하기"}
            </span>
          </button>

          {errorMsg && (
            <p className="mt-3 text-center text-xs font-medium text-[#E06C75]">
              {errorMsg}
            </p>
          )}

          <p className="mt-4 text-center text-[11px] leading-relaxed text-[#8F9691]">
            계속 진행하면{" "}
            <Link
              href="/policy"
              onClick={closeAuthModal}
              className="underline underline-offset-2 transition-colors hover:text-[#E4E6E1]"
            >
              이용약관 및 개인정보처리방침
            </Link>
            에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
