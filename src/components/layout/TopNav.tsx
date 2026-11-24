"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Bell,
  BellOff,
  BookOpen,
  Coins,
  Keyboard,
  LogOut,
  Menu,
  MessageSquare,
  Mouse,
  Shield,
  User,
  X,
} from "lucide-react";
import { KeyniverseLogo } from "@/components/layout/KeyniverseLogo";
import {
  getAuthStoreVersion,
  getServerAuthStoreVersion,
  initSupabaseAuthSync,
  openAuthModal,
  readGoogleSession,
  signOutGoogle,
  subscribeAuthStore,
} from "@/lib/auth-store";
import {
  getActivityStoreVersion,
  getServerActivityStoreVersion,
  readPointLogs,
  readTotalPoints,
  subscribeActivityStore,
} from "@/lib/activity-store";
import { syncCommunityFromSupabase } from "@/lib/community-store";
import {
  deleteNotification,
  formatRelativeNotificationTime,
  getNotificationStoreVersion,
  getServerNotificationStoreVersion,
  markAllNotificationsRead,
  markNotificationRead,
  readNotifications,
  readNotificationsEnabled,
  readUnreadNotificationCount,
  setNotificationsEnabled,
  subscribeNotificationStore,
  syncNotificationsFromSupabase,
} from "@/lib/notification-store";
import { AuthModal } from "@/components/auth/AuthModal";
import { NicknameSetupModal } from "@/components/auth/NicknameSetupModal";
import { cn } from "@/lib/utils";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState<boolean>(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState<boolean>(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const profileContainerRef = useRef<HTMLDivElement | null>(null);
  const notifContainerRef = useRef<HTMLDivElement | null>(null);

  const authVersion = useSyncExternalStore(
    subscribeAuthStore,
    getAuthStoreVersion,
    getServerAuthStoreVersion
  );
  const activityVersion = useSyncExternalStore(
    subscribeActivityStore,
    getActivityStoreVersion,
    getServerActivityStoreVersion
  );
  const notifVersion = useSyncExternalStore(
    subscribeNotificationStore,
    getNotificationStoreVersion,
    getServerNotificationStoreVersion
  );

  const session = authVersion > 0 ? readGoogleSession() : null;
  const notifications = notifVersion > 0 ? readNotifications() : [];
  const notificationsEnabled =
    notifVersion > 0 ? readNotificationsEnabled() : true;
  const unreadNotifCount =
    notifVersion > 0 ? readUnreadNotificationCount() : 0;
  const displayPoints =
    session && activityVersion > 0
      ? readPointLogs().length > 0
        ? readTotalPoints()
        : (session.points ?? readTotalPoints())
      : (session?.points ?? 0);

  useEffect(() => {
    initSupabaseAuthSync();
  }, []);

  useEffect(() => {
    void syncNotificationsFromSupabase(session?.userId ?? null);
  }, [session?.userId, pathname]);

  useEffect(() => {
    if (!session?.userId) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncNotificationsFromSupabase(session.userId ?? null);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [session?.userId]);

  useEffect(() => {
    if (!mobileMenuOpen && !profileMenuOpen && !notifMenuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        mobileMenuOpen &&
        menuContainerRef.current &&
        !menuContainerRef.current.contains(target)
      ) {
        setMobileMenuOpen(false);
      }
      if (
        profileMenuOpen &&
        profileContainerRef.current &&
        !profileContainerRef.current.contains(target)
      ) {
        setProfileMenuOpen(false);
      }
      if (
        notifMenuOpen &&
        notifContainerRef.current &&
        !notifContainerRef.current.contains(target)
      ) {
        setNotifMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setProfileMenuOpen(false);
        setNotifMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen, profileMenuOpen, notifMenuOpen]);

  const isCommunity = pathname === "/" || pathname.startsWith("/community");
  const isSpecs = pathname.startsWith("/specs");
  const isKeyboard = pathname.startsWith("/keyboard");
  const isMouse = pathname.startsWith("/mouse");
  const isMyPage = pathname.startsWith("/mypage");
  const isAdmin = pathname.startsWith("/admin");

  const navItems = [
    {
      href: "/",
      label: "커뮤니티",
      active: isCommunity,
      icon: MessageSquare,
    },
    {
      href: "/specs",
      label: "스펙 도감",
      active: isSpecs,
      icon: BookOpen,
    },
    {
      href: "/keyboard",
      label: "키보드 테스트",
      active: isKeyboard,
      icon: Keyboard,
    },
    {
      href: "/mouse",
      label: "마우스 테스트",
      active: isMouse,
      icon: Mouse,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            onClick={(e) => {
              setMobileMenuOpen(false);
              setProfileMenuOpen(false);
              setNotifMenuOpen(false);
              if (pathname === "/" && typeof window !== "undefined") {
                e.preventDefault();
                window.history.pushState(null, "", "/");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="group flex shrink-0 items-center gap-2 focus:outline-none sm:gap-2.5"
          >
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-card transition-colors group-hover:border-sage group-hover:bg-surface-elevated">
              <KeyniverseLogo className="size-7" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-[#C9CFCB] transition-colors group-hover:text-[#E4E6E1]">
                KEYNIVERSE
              </span>
              <span className="rounded border border-[#6B9080]/40 bg-[#6B9080]/10 px-1.5 py-0.5 font-mono text-[9px] leading-none font-semibold tracking-wider text-[#6B9080]">
                BETA
              </span>
            </div>
          </Link>

          {/* 우측 통합 영역: 데스크톱(880px+) 메뉴 + 상시 노출 로그인/프로필 + 모바일(880px 미만) 햄버거 팝오버 */}
          <div className="flex items-center gap-1.5 lg:gap-2">
            {/* Desktop Fixed Navigation (880px 이상) */}
            <nav className="hidden items-center gap-1 min-[880px]:flex lg:gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => {
                      if (
                        item.href === "/" &&
                        pathname === "/" &&
                        typeof window !== "undefined"
                      ) {
                        e.preventDefault();
                        window.history.pushState(null, "", "/");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className={cn(
                      "relative flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors lg:gap-2 lg:px-2.5 lg:text-sm",
                      item.active
                        ? "border-sage bg-surface-elevated text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                    {item.active && (
                      <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-sage" />
                    )}
                  </Link>
                );
              })}
              <div className="mx-1 h-5 w-px bg-border" />
            </nav>

            {/* 상시 노출 로그인 / 원형 프로필 아바타 드롭다운 */}
            {!session ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileMenuOpen(false);
                  openAuthModal();
                }}
                className="flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#282D2A] bg-[#222623] px-3.5 text-xs font-semibold whitespace-nowrap text-[#E4E6E1] transition-colors hover:border-[#6B9080] hover:text-white"
              >
                <span>로그인</span>
              </button>
            ) : (
              <>
                {/* 인앱 알림 벨 버튼 + 모바일/PC 반응형 팝오버 */}
                <div ref={notifContainerRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setProfileMenuOpen(false);
                      setNotifMenuOpen((prev) => {
                        const next = !prev;
                        if (next) {
                          void syncNotificationsFromSupabase(
                            session.userId ?? null
                          );
                        }
                        return next;
                      });
                    }}
                    aria-label={
                      notificationsEnabled
                        ? unreadNotifCount > 0
                          ? `인앱 알림 (읽지 않은 알림 ${unreadNotifCount}건)`
                          : "인앱 알림"
                        : "인앱 알림 (꺼짐)"
                    }
                    aria-expanded={notifMenuOpen}
                    aria-haspopup="menu"
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-full border transition-colors",
                      notifMenuOpen
                        ? "border-[#6B9080] bg-[#222623] text-[#6B9080]"
                        : notificationsEnabled
                          ? "border-[#282D2A] bg-[#1A1D1B] text-[#B8BFBA] hover:border-[#6B9080] hover:text-[#E4E6E1]"
                          : "border-[#282D2A] bg-[#151816] text-[#8F9691]/60 hover:border-[#6B9080]/60 hover:text-[#B8BFBA]"
                    )}
                  >
                    {notificationsEnabled ? (
                      <Bell className="size-4" />
                    ) : (
                      <BellOff className="size-4" />
                    )}
                    {notificationsEnabled && unreadNotifCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#6B9080] px-1 font-mono text-[10px] leading-none font-bold text-[#121413] tabular-nums">
                        {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                      </span>
                    )}
                  </button>

                  {/* 알림 팝오버 (모바일: 화면 좌우 12px 여백 고정 / sm+: 벨 우측 정렬 320px) */}
                  <div
                    role="menu"
                    aria-hidden={!notifMenuOpen}
                    className={cn(
                      "fixed inset-x-3 top-[68px] z-50 origin-top rounded-xl border border-[#282D2A] bg-[#1A1D1B] shadow-xl transition-all duration-150 ease-out sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-80 sm:origin-top-right",
                      notifMenuOpen
                        ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                        : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                    )}
                  >
                    {/* 상단 헤더: 타이틀 + 모두 읽음 + ON/OFF 토글 */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#282D2A] bg-[#151816] px-3 py-2.5 rounded-t-xl">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-xs font-bold whitespace-nowrap text-[#E4E6E1]">
                          알림
                        </span>
                        {notificationsEnabled && unreadNotifCount > 0 && (
                          <span className="rounded bg-[#6B9080]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#6B9080] tabular-nums">
                            {unreadNotifCount}
                          </span>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {notificationsEnabled && unreadNotifCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              void markAllNotificationsRead(session.userId)
                            }
                            className="rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-[#8F9691] transition-colors hover:bg-[#222623] hover:text-[#E4E6E1]"
                          >
                            모두 읽음
                          </button>
                        )}

                        <button
                          type="button"
                          role="switch"
                          aria-checked={notificationsEnabled}
                          aria-label="인앱 알림 켜기/끄기"
                          onClick={() =>
                            void setNotificationsEnabled(
                              session.userId,
                              !notificationsEnabled
                            )
                          }
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#282D2A] bg-[#1A1D1B] px-1.5 py-0.5 transition-colors hover:border-[#6B9080]/60"
                        >
                          <span
                            className={cn(
                              "font-mono text-[10px] font-semibold whitespace-nowrap",
                              notificationsEnabled
                                ? "text-[#6B9080]"
                                : "text-[#8F9691]"
                            )}
                          >
                            {notificationsEnabled ? "ON" : "OFF"}
                          </span>
                          <span
                            className={cn(
                              "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
                              notificationsEnabled
                                ? "bg-[#6B9080]"
                                : "bg-[#282D2A]"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block size-3 rounded-full bg-[#121413] transition-transform",
                                notificationsEnabled
                                  ? "translate-x-3.5"
                                  : "translate-x-0.5"
                              )}
                            />
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 알림 꺼짐 안내 배너 */}
                    {!notificationsEnabled && (
                      <div className="border-b border-[#282D2A] bg-[#151816]/60 px-3 py-2 text-[11px] leading-relaxed break-keep text-[#8F9691]">
                        알림이 꺼져 있어 새 댓글·답글 알림이 저장되지 않습니다.
                      </div>
                    )}

                    {/* 알림 목록 */}
                    <div className="max-h-[60vh] overflow-y-auto overscroll-contain sm:max-h-96">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs break-keep text-[#8F9691]">
                          {notificationsEnabled
                            ? "새로운 알림이 없습니다."
                            : "표시할 알림이 없습니다."}
                        </div>
                      ) : (
                        <div className="divide-y divide-[#282D2A]">
                          {notifications.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[#222623]/70",
                                !item.isRead && "bg-[#6B9080]/[0.05]"
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  item.isRead
                                    ? "bg-transparent"
                                    : "bg-[#6B9080]"
                                )}
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  void markNotificationRead(item.id);
                                  void syncCommunityFromSupabase(
                                    session.userId ?? null
                                  );
                                  setNotifMenuOpen(false);
                                  const targetUrl = `/?post=${encodeURIComponent(item.postId)}`;
                                  if (pathname === "/" && typeof window !== "undefined") {
                                    window.history.pushState(null, "", targetUrl);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                  } else {
                                    router.push(targetUrl);
                                  }
                                }}
                                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                              >
                                <span className="truncate text-xs font-medium text-[#E4E6E1]">
                                  {item.type === "reply"
                                    ? "내 댓글에 답글이 달렸습니다"
                                    : "내 게시글에 댓글이 달렸습니다"}
                                </span>
                                <span className="shrink-0 font-sans text-[11px] leading-none whitespace-nowrap text-[#8F9691] tabular-nums">
                                  {formatRelativeNotificationTime(
                                    item.createdAt
                                  )}
                                </span>
                              </button>

                              <button
                                type="button"
                                aria-label="알림 삭제"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteNotification(item.id);
                                }}
                                className="flex size-6 shrink-0 items-center justify-center rounded text-[#8F9691] transition-colors hover:bg-[#282D2A] hover:text-[#E4E6E1]"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div ref={profileContainerRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setNotifMenuOpen(false);
                      setProfileMenuOpen((prev) => !prev);
                    }}
                  aria-label="내 프로필 메뉴"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border transition-colors",
                    profileMenuOpen || isMyPage || isAdmin
                      ? "border-[#6B9080] bg-[#222623] text-[#6B9080]"
                      : "border-[#282D2A] bg-[#1A1D1B] text-[#B8BFBA] hover:border-[#6B9080] hover:text-[#E4E6E1]"
                  )}
                >
                  <User className="size-4" />
                </button>

                {/* 원형 프로필 팝오버 (우측 정렬 · 150ms ease-out · 닫힘 시 pointer-events-none) */}
                <div
                  role="menu"
                  aria-hidden={!profileMenuOpen}
                  className={cn(
                    "absolute top-full right-0 z-50 mt-2 w-52 origin-top-right rounded-xl border border-[#282D2A] bg-[#1A1D1B] p-2 shadow-xl transition-all duration-150 ease-out",
                    profileMenuOpen
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                  )}
                >
                  {/* 상단 요약: 닉네임 + 보유 포인트 */}
                  <div className="mb-1.5 rounded-lg border border-[#282D2A] bg-[#151816] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-[#E4E6E1]">
                        {session.nickname || "닉네임 설정"}
                      </span>
                      {session.role === "admin" && (
                        <span className="shrink-0 rounded border border-[#6B9080]/40 bg-[#6B9080]/10 px-1.5 py-0.5 font-mono text-[9px] leading-none font-semibold text-[#6B9080]">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] font-semibold text-[#D4A373] tabular-nums">
                      <Coins className="size-3 shrink-0" />
                      <span>{displayPoints.toLocaleString()} P</span>
                    </div>
                  </div>

                  {/* 메뉴 항목 */}
                  <div className="flex flex-col gap-1">
                    <Link
                      href="/mypage"
                      role="menuitem"
                      tabIndex={profileMenuOpen ? 0 : -1}
                      onClick={() => setProfileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                        isMyPage
                          ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                          : "border-transparent text-[#C9CFCB] hover:border-[#282D2A] hover:bg-[#222623] hover:text-[#E4E6E1]"
                      )}
                    >
                      <User className="size-3.5 text-[#6B9080]" />
                      <span>마이페이지</span>
                    </Link>

                    {session.role === "admin" && (
                      <Link
                        href="/admin"
                        role="menuitem"
                        tabIndex={profileMenuOpen ? 0 : -1}
                        onClick={() => setProfileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                          isAdmin
                            ? "border-[#6B9080] bg-[#222623] text-[#E4E6E1]"
                            : "border-transparent text-[#C9CFCB] hover:border-[#282D2A] hover:bg-[#222623] hover:text-[#E4E6E1]"
                        )}
                      >
                        <Shield className="size-3.5 text-[#6B9080]" />
                        <span>관리자 대시보드</span>
                      </Link>
                    )}

                    <div className="my-1 border-t border-[#282D2A]" />

                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={profileMenuOpen ? 0 : -1}
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void signOutGoogle();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs font-medium text-[#8F9691] transition-colors hover:border-[#E06C75]/40 hover:bg-[#222623] hover:text-[#E06C75]"
                    >
                      <LogOut className="size-3.5" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                </div>
              </div>
              </>
            )}

            {/* Mobile / Narrow Window (< 880px) 햄버거 버튼 + 우측 고정폭 팝오버 */}
            <div ref={menuContainerRef} className="relative min-[880px]:hidden">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setNotifMenuOpen(false);
                  setMobileMenuOpen((prev) => !prev);
                }}
                aria-label={mobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
                aria-expanded={mobileMenuOpen}
                aria-haspopup="menu"
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg border bg-card transition-colors",
                  mobileMenuOpen
                    ? "border-sage bg-surface-elevated text-sage"
                    : "border-border text-foreground hover:border-sage hover:text-sage"
                )}
              >
                {mobileMenuOpen ? (
                  <X className="size-5" />
                ) : (
                  <Menu className="size-5" />
                )}
              </button>

              {/* 우측 상단 기준 150ms ease-out 고정폭 팝오버 메뉴 */}
              <div
                role="menu"
                aria-hidden={!mobileMenuOpen}
                className={cn(
                  "absolute top-full right-0 z-50 mt-2 w-56 origin-top-right rounded-xl border border-border bg-card p-2 shadow-xl transition-all duration-150 ease-out",
                  mobileMenuOpen
                    ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                    : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                )}
              >
                <nav className="flex flex-col gap-1">
                  {navItems.slice(0, 2).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        tabIndex={mobileMenuOpen ? 0 : -1}
                        onClick={(e) => {
                          setMobileMenuOpen(false);
                          if (
                            item.href === "/" &&
                            pathname === "/" &&
                            typeof window !== "undefined"
                          ) {
                            e.preventDefault();
                            window.history.pushState(null, "", "/");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          item.active
                            ? "border-sage bg-surface-elevated text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="size-4 text-sage" />
                          <span>{item.label}</span>
                        </span>
                        {item.active && (
                          <span className="size-1.5 rounded-full bg-sage" />
                        )}
                      </Link>
                    );
                  })}

                  <div className="my-1 h-px bg-border" />

                  {navItems.slice(2).map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        tabIndex={mobileMenuOpen ? 0 : -1}
                        onClick={(e) => {
                          setMobileMenuOpen(false);
                          if (
                            item.href === "/" &&
                            pathname === "/" &&
                            typeof window !== "undefined"
                          ) {
                            e.preventDefault();
                            window.history.pushState(null, "", "/");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          item.active
                            ? "border-sage bg-surface-elevated text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="size-4 text-sage" />
                          <span>{item.label}</span>
                        </span>
                        {item.active && (
                          <span className="size-1.5 rounded-full bg-sage" />
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 전역 Google 단일 로그인 & 최초 닉네임 설정 모달 */}
      <AuthModal />
      <NicknameSetupModal />
    </>
  );
}
