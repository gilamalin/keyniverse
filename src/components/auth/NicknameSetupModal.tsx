"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LogOut } from "lucide-react";
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  getAuthStoreVersion,
  getServerAuthStoreVersion,
  readGoogleSession,
  signOutGoogle,
  subscribeAuthStore,
  updateSessionNicknameAsync,
} from "@/lib/auth-store";
import { acquireBodyScrollLock } from "@/lib/body-scroll-lock";

/**
 * 최초 Google OAuth 가입 직후 닉네임이 비어 있는(profiles.nickname IS NULL) 유저에게
 * 자동으로 표시되는 닉네임 설정 모달
 */
export function NicknameSetupModal() {
  const version = useSyncExternalStore(
    subscribeAuthStore,
    getAuthStoreVersion,
    getServerAuthStoreVersion
  );

  const session = version > 0 ? readGoogleSession() : null;
  const open = Boolean(session?.needsNicknameSetup);

  const [nickname, setNickname] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    const releaseScrollLock = acquireBodyScrollLock();
    return () => releaseScrollLock();
  }, [open]);

  if (!open || !session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const res = await updateSessionNicknameAsync(nickname);
    setSubmitting(false);

    if (!res.valid) {
      setErrorMsg(res.error);
      return;
    }
    setNickname("");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="닉네임 설정"
        className="w-full max-w-sm overflow-hidden rounded-xl border border-[#282D2A] bg-[#1A1D1B]"
      >
        <div className="flex items-center justify-between border-b border-[#282D2A] bg-[#151816] px-5 py-3.5">
          <h2 className="text-sm font-bold text-[#E4E6E1]">닉네임 설정</h2>
          <button
            type="button"
            onClick={() => void signOutGoogle()}
            className="inline-flex items-center gap-1 rounded border border-[#282D2A] bg-[#1A1D1B] px-2 py-1 text-[11px] font-medium text-[#8F9691] transition-colors hover:border-[#E06C75] hover:text-[#E06C75]"
          >
            <LogOut className="size-3" />
            <span>로그아웃</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5">
          <p className="mb-3 text-xs text-[#8F9691]">
            사용할 닉네임을 입력해 주세요. ({NICKNAME_MIN_LENGTH}~
            {NICKNAME_MAX_LENGTH}자 · 한글/영문/숫자)
          </p>

          <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#8F9691]">
            <label htmlFor="setup-nickname-input" className="font-medium">
              닉네임
            </label>
            <span className="font-mono tabular-nums">
              {nickname.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>

          <input
            id="setup-nickname-input"
            type="text"
            autoFocus
            maxLength={NICKNAME_MAX_LENGTH}
            value={nickname}
            onChange={(e) => {
              setNickname(
                e.target.value
                  .replace(/\s+/g, "")
                  .slice(0, NICKNAME_MAX_LENGTH)
              );
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="2~6자 입력"
            className="h-9 w-full rounded-lg border border-[#282D2A] bg-[#151816] px-3 text-xs text-[#E4E6E1] placeholder:text-[#8F9691] focus:border-[#6B9080] focus:outline-none"
          />

          {errorMsg && (
            <p className="mt-2 text-xs font-medium text-[#E06C75]">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || nickname.length < NICKNAME_MIN_LENGTH}
            className="mt-4 w-full rounded-lg border border-[#6B9080] bg-[#6B9080] py-2.5 text-xs font-bold text-[#121413] transition-colors hover:bg-[#7CA291] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "저장 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
