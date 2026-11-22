"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Keyboard as KeyboardIcon,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trash2,
  Unlock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  FULL_KEY_CODES,
  getKeyDisplayLabel,
  KeyDef,
  MAIN_BLOCK_ROWS,
  NAV_BLOCK_ROWS,
  normalizeKeyEvent,
  NUMPAD_KEYS,
  TKL_KEY_CODES,
} from "@/lib/keyboard-layout";
import {
  KPI_CARD_BASE,
  KPI_CARD_DANGER,
  KPI_CARD_PRIMARY,
} from "@/lib/ui-tokens";
import {
  KeyboardDeviceCertBanner,
  TesterToSpecsCompactBanner,
} from "@/components/specs/TesterDeviceBridge";
import { cn } from "@/lib/utils";

type LayoutMode = "104" | "87";
type LogFilter = "all" | "chatter";

interface KeyState {
  isPressed: boolean;
  pressCount: number;
  chatterCount: number;
  lastIntervalMs: number | null;
  lastHoldMs: number | null;
}

interface KeyLogEntry {
  id: number;
  timestamp: string;
  code: string;
  label: string;
  holdMs: number | null;
  intervalMs: number | null;
  isChatter: boolean;
}

interface PressedEntry {
  downAt: number;
  logId: number;
}

function formatClockTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function formatMs(value: number | null): string {
  if (value === null) return "-";
  return `${value.toFixed(2)} ms`;
}

export function KeyboardTester() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("104");
  const [shortcutLock, setShortcutLock] = useState<boolean>(true);
  const [isWinKeyLocked, setIsWinKeyLocked] = useState<boolean>(false);
  const [thresholdMs, setThresholdMs] = useState<number>(20);
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [maxNkro, setMaxNkro] = useState<number>(0);
  const [lastIntervalMs, setLastIntervalMs] = useState<number | null>(null);
  const [logs, setLogs] = useState<KeyLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [lockLeds, setLockLeds] = useState({
    num: false,
    caps: false,
    scroll: false,
  });

  // Mutable refs for sub-ms performance.now() tracking without stale closures
  const thresholdMsRef = useRef(thresholdMs);
  const shortcutLockRef = useRef(shortcutLock);
  const pressedDownAtRef = useRef<Map<string, PressedEntry>>(new Map());
  const lastUpAtRef = useRef<Map<string, number>>(new Map());
  const imeTimeoutRef = useRef<Map<string, number>>(new Map());
  const printScreenTimerRef = useRef<number | null>(null);
  const nextLogIdRef = useRef<number>(0);

  useEffect(() => {
    thresholdMsRef.current = thresholdMs;
  }, [thresholdMs]);

  useEffect(() => {
    shortcutLockRef.current = shortcutLock;
  }, [shortcutLock]);

  const releaseAllHeldKeys = useCallback(() => {
    for (const timerId of imeTimeoutRef.current.values()) {
      window.clearTimeout(timerId);
    }
    imeTimeoutRef.current.clear();

    if (pressedDownAtRef.current.size === 0) return;
    pressedDownAtRef.current.clear();

    setKeyStates((prev) => {
      let changed = false;
      const next: Record<string, KeyState> = {};
      for (const [code, state] of Object.entries(prev)) {
        if (state.isPressed) {
          changed = true;
          next[code] = { ...state, isPressed: false };
        } else {
          next[code] = state;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const handleResetAll = useCallback(() => {
    for (const timerId of imeTimeoutRef.current.values()) {
      window.clearTimeout(timerId);
    }
    imeTimeoutRef.current.clear();
    if (printScreenTimerRef.current !== null) {
      window.clearTimeout(printScreenTimerRef.current);
      printScreenTimerRef.current = null;
    }
    pressedDownAtRef.current.clear();
    lastUpAtRef.current.clear();
    setKeyStates({});
    setMaxNkro(0);
    setLastIntervalMs(null);
    setLogs([]);
  }, []);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleToggleWinKeyLock = useCallback(async () => {
    type NavWithKeyboardLock = Navigator & {
      keyboard?: {
        lock?: (keyCodes?: string[]) => Promise<void>;
        unlock?: () => void;
      };
    };
    const nav = navigator as NavWithKeyboardLock;

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (nav.keyboard?.lock) {
          await nav.keyboard.lock();
        }
        setIsWinKeyLocked(true);
      } else {
        nav.keyboard?.unlock?.();
        await document.exitFullscreen();
        setIsWinKeyLocked(false);
      }
    } catch {
      // Fallback if fullscreen/keyboard lock is unsupported or dismissed
      setIsWinKeyLocked(Boolean(document.fullscreenElement));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsWinKeyLocked(active);
      if (!active) {
        type NavWithKeyboardLock = Navigator & {
          keyboard?: { unlock?: () => void };
        };
        (navigator as NavWithKeyboardLock).keyboard?.unlock?.();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const imeTimeouts = imeTimeoutRef.current;
    const syncLeds = (e: KeyboardEvent) => {
      setLockLeds({
        num: e.getModifierState("NumLock"),
        caps: e.getModifierState("CapsLock"),
        scroll: e.getModifierState("ScrollLock"),
      });
    };

    const finalizeKeyRelease = (
      code: string,
      releaseTime: number,
      isSynthetic = false
    ) => {
      const entry = pressedDownAtRef.current.get(code);
      if (!entry) return;

      const holdMs = Math.max(0, releaseTime - entry.downAt);
      if (!isSynthetic) {
        lastUpAtRef.current.set(code, releaseTime);
      }
      pressedDownAtRef.current.delete(code);

      setKeyStates((prev) => {
        const current = prev[code];
        if (!current) return prev;
        return {
          ...prev,
          [code]: {
            ...current,
            isPressed: false,
            lastHoldMs: holdMs,
          },
        };
      });

      setLogs((prev) =>
        prev.map((item) =>
          item.id === entry.logId ? { ...item, holdMs } : item
        )
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (shortcutLockRef.current) {
        e.preventDefault();
      }
      syncLeds(e);

      if (e.repeat) return;

      const { code, isImeKey } = normalizeKeyEvent(e);
      if (pressedDownAtRef.current.has(code)) {
        return;
      }

      const now = e.timeStamp > 0 ? e.timeStamp : performance.now();
      const prevUp = lastUpAtRef.current.get(code);
      const intervalMs = prevUp !== undefined ? Math.max(0, now - prevUp) : null;
      const isChatter =
        intervalMs !== null && intervalMs <= thresholdMsRef.current;

      const logId = ++nextLogIdRef.current;
      pressedDownAtRef.current.set(code, { downAt: now, logId });

      const activeCount = pressedDownAtRef.current.size;
      setMaxNkro((prevMax) => Math.max(prevMax, activeCount));
      if (intervalMs !== null) {
        setLastIntervalMs(intervalMs);
      }

      setKeyStates((prev) => {
        const current = prev[code] ?? {
          isPressed: false,
          pressCount: 0,
          chatterCount: 0,
          lastIntervalMs: null,
          lastHoldMs: null,
        };
        return {
          ...prev,
          [code]: {
            ...current,
            isPressed: true,
            pressCount: current.pressCount + 1,
            chatterCount: current.chatterCount + (isChatter ? 1 : 0),
            lastIntervalMs: intervalMs,
          },
        };
      });

      const entry: KeyLogEntry = {
        id: logId,
        timestamp: formatClockTime(new Date()),
        code,
        label: getKeyDisplayLabel(code),
        holdMs: null,
        intervalMs,
        isChatter,
      };
      setLogs((prev) => [entry, ...prev].slice(0, 200));

      // Guard for Korean Windows IME keys where OS may swallow keyup
      if (isImeKey) {
        const existingTimer = imeTimeoutRef.current.get(code);
        if (existingTimer !== undefined) {
          window.clearTimeout(existingTimer);
        }
        const timerId = window.setTimeout(() => {
          imeTimeoutRef.current.delete(code);
          finalizeKeyRelease(code, performance.now(), true);
        }, 150);
        imeTimeoutRef.current.set(code, timerId);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (shortcutLockRef.current) {
        e.preventDefault();
      }
      syncLeds(e);

      const { code } = normalizeKeyEvent(e);
      const pendingImeTimer = imeTimeoutRef.current.get(code);
      if (pendingImeTimer !== undefined) {
        window.clearTimeout(pendingImeTimer);
        imeTimeoutRef.current.delete(code);
      }

      const now = e.timeStamp > 0 ? e.timeStamp : performance.now();

      if (pressedDownAtRef.current.has(code)) {
        finalizeKeyRelease(code, now);
        return;
      }

      // Windows intercepts PrintScreen keydown and often delivers only keyup
      if (code === "PrintScreen") {
        const prevUp = lastUpAtRef.current.get("PrintScreen");
        const intervalMs =
          prevUp !== undefined ? Math.max(0, now - prevUp) : null;
        const isChatter =
          intervalMs !== null && intervalMs <= thresholdMsRef.current;

        lastUpAtRef.current.set("PrintScreen", now);
        if (intervalMs !== null) {
          setLastIntervalMs(intervalMs);
        }

        const logId = ++nextLogIdRef.current;
        setKeyStates((prev) => {
          const current = prev["PrintScreen"] ?? {
            isPressed: false,
            pressCount: 0,
            chatterCount: 0,
            lastIntervalMs: null,
            lastHoldMs: null,
          };
          return {
            ...prev,
            PrintScreen: {
              ...current,
              isPressed: true,
              pressCount: current.pressCount + 1,
              chatterCount: current.chatterCount + (isChatter ? 1 : 0),
              lastIntervalMs: intervalMs,
              lastHoldMs: 0,
            },
          };
        });

        setLogs((prev) =>
          [
            {
              id: logId,
              timestamp: formatClockTime(new Date()),
              code: "PrintScreen",
              label: getKeyDisplayLabel("PrintScreen"),
              holdMs: 0,
              intervalMs,
              isChatter,
            },
            ...prev,
          ].slice(0, 200)
        );

        if (printScreenTimerRef.current !== null) {
          window.clearTimeout(printScreenTimerRef.current);
        }
        printScreenTimerRef.current = window.setTimeout(() => {
          printScreenTimerRef.current = null;
          setKeyStates((prev) => {
            const current = prev["PrintScreen"];
            if (!current) return prev;
            return {
              ...prev,
              PrintScreen: { ...current, isPressed: false },
            };
          });
        }, 140);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      // Block keyboard-triggered ContextMenu key when shortcut lock is ON,
      // while allowing standard mouse right-click anywhere else.
      if (shortcutLockRef.current && e.button !== 2) {
        e.preventDefault();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        releaseAllHeldKeys();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("blur", releaseAllHeldKeys);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("blur", releaseAllHeldKeys);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      for (const timerId of imeTimeouts.values()) {
        window.clearTimeout(timerId);
      }
      imeTimeouts.clear();
      if (printScreenTimerRef.current !== null) {
        window.clearTimeout(printScreenTimerRef.current);
      }
    };
  }, [releaseAllHeldKeys]);

  const activeKeyCodes = layoutMode === "104" ? FULL_KEY_CODES : TKL_KEY_CODES;

  const stats = useMemo(() => {
    let currentlyPressed = 0;
    let testedCleanCount = 0;
    let totalChatterEvents = 0;
    let faultyKeyCount = 0;
    let totalKeyPresses = 0;

    for (const code of activeKeyCodes) {
      const state = keyStates[code];
      if (!state) continue;
      if (state.isPressed) currentlyPressed += 1;
      if (state.chatterCount > 0) {
        faultyKeyCount += 1;
      } else if (state.pressCount > 0) {
        testedCleanCount += 1;
      }
    }

    for (const state of Object.values(keyStates)) {
      totalChatterEvents += state.chatterCount;
      totalKeyPresses += state.pressCount;
    }

    return {
      currentlyPressed,
      testedCleanCount,
      totalKeys: activeKeyCodes.length,
      totalChatterEvents,
      faultyKeyCount,
      totalKeyPresses,
    };
  }, [activeKeyCodes, keyStates]);

  const visibleLogs = useMemo(() => {
    if (logFilter === "chatter") {
      return logs.filter((entry) => entry.isChatter);
    }
    return logs;
  }, [logFilter, logs]);

  const renderKeycap = (keyDef: KeyDef, styleOverride?: React.CSSProperties) => {
    const state = keyStates[keyDef.code];
    const isPressed = state?.isPressed ?? false;
    const chatterCount = state?.chatterCount ?? 0;
    const isFaulty = chatterCount > 0;
    const isClean = (state?.pressCount ?? 0) > 0 && !isFaulty;

    const unitWidth = keyDef.width ?? 1;
    const baseStyle: React.CSSProperties = styleOverride ?? {
      width: `calc(${unitWidth} * var(--key-u) + ${(unitWidth - 1) * 4}px)`,
      height: "var(--key-u)",
    };

    const isCompactText =
      keyDef.label.length > 2 || Boolean(keyDef.subLabel);

    return (
      <div
        key={keyDef.code}
        style={baseStyle}
        title={
          state?.lastIntervalMs !== null && state?.lastIntervalMs !== undefined
            ? `${keyDef.code} · 최근 간격 ${state.lastIntervalMs.toFixed(2)}ms`
            : keyDef.code
        }
        className={cn(
          "relative flex shrink-0 select-none flex-col items-center justify-center rounded-md border px-1 transition-all duration-75",
          // State priority: Pressed > Chattering Fault > Clean Tested > Untested
          isPressed &&
            !isFaulty &&
            "translate-y-[1px] border-[#88B09E] bg-[#6B9080] text-[#121413]",
          isPressed &&
            isFaulty &&
            "translate-y-[1px] border-[#F29CA3] bg-[#EB8A92] text-[#121413]",
          !isPressed &&
            isFaulty &&
            "border-[#F29CA3] bg-[#E06C75] text-[#121413]",
          !isPressed &&
            !isFaulty &&
            isClean &&
            "border-[#6B9080] border-b-2 bg-[#2C3832] text-[#E4E6E1]",
          !isPressed &&
            !isFaulty &&
            !isClean &&
            "border-[#282D2A] bg-[#1A1D1B] text-[#8F9691] hover:border-[#3A413D] hover:bg-[#222623] hover:text-[#E4E6E1]"
        )}
      >
        {keyDef.subLabel && (
          <span
            className={cn(
              "font-mono text-[9px] leading-none tracking-tight",
              isPressed || isFaulty
                ? "text-[#121413]/80"
                : isClean
                  ? "text-[#A8C6B8]"
                  : "text-[#8F9691]/75"
            )}
          >
            {keyDef.subLabel}
          </span>
        )}
        <span
          className={cn(
            "font-mono font-semibold leading-tight tracking-tight",
            isCompactText ? "text-[11px]" : "text-[13px]"
          )}
        >
          {keyDef.label}
        </span>
        {chatterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#E06C75] bg-[#121413] px-1 font-mono tabular-nums text-[9px] font-bold text-[#E06C75]">
            !{chatterCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <KeyboardDeviceCertBanner
          totalKeyPresses={stats.totalKeyPresses}
          chatterCount={stats.totalChatterEvents}
          onReset={handleResetAll}
        />
      </Suspense>

      {/* Header Title Row */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#282D2A] pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
              <KeyboardIcon className="size-3.5" />
              HIGH-PRECISION KEYBOARD TEST
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#D5DBD6] sm:text-3xl">
            키보드 테스트
          </h1>
          <p className="mt-1 text-sm text-[#8F9691]">
            키 입력 · 동시입력 · 채터링 실시간 진단
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleResetAll}
          className="w-fit shrink-0 border-border bg-surface-elevated text-foreground hover:border-sage hover:bg-[#2A302C]"
        >
          <RotateCcw className="size-4" />
          <span>초기화</span>
        </Button>
      </div>

      {/* Top Telemetry Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Card 1: Tier-1 Primary — Chattering Count */}
        <div
          className={
            stats.totalChatterEvents > 0
              ? KPI_CARD_DANGER
              : KPI_CARD_PRIMARY
          }
        >
          <div className="flex items-center justify-between text-xs font-medium text-foreground">
            <span>채터링 감지</span>
            <AlertTriangle
              className={cn(
                "size-4",
                stats.totalChatterEvents > 0 ? "text-coral" : "text-sage"
              )}
            />
          </div>
          <div className="mt-2.5 flex h-8 items-baseline gap-1.5 font-mono tabular-nums">
            <span
              className={cn(
                "text-3xl font-bold leading-none tracking-tight",
                stats.totalChatterEvents > 0 ? "text-coral" : "text-sage"
              )}
            >
              {stats.totalChatterEvents}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              건
            </span>
            <span className="ml-1 text-xs text-muted-foreground">
              ({stats.faultyKeyCount}키)
            </span>
          </div>
        </div>

        {/* Card 2: Tier-2 Secondary — Simultaneous Input / Max NKRO */}
        <div
          className={cn(
            KPI_CARD_BASE,
            stats.currentlyPressed > 0 && "border-sage"
          )}
        >
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>동시입력 / 최대</span>
            <Layers className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2.5 flex h-8 items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-2xl font-semibold leading-none tracking-tight text-foreground">
              {stats.currentlyPressed}
            </span>
            <span className="text-xs text-muted-foreground">키</span>
            <span className="mx-0.5 text-xs text-muted-foreground">/</span>
            <span className="text-xs font-medium text-sand">
              최대 {maxNkro}키
            </span>
          </div>
        </div>

        {/* Card 3: Tier-2 Secondary — Tested Clean Keys */}
        <div className={KPI_CARD_BASE}>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>확인된 키</span>
            <CheckCircle2 className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2.5 flex h-8 items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-2xl font-semibold leading-none tracking-tight text-foreground">
              {stats.testedCleanCount}
            </span>
            <span className="text-xs text-muted-foreground">
              / {stats.totalKeys} 키
            </span>
          </div>
        </div>

        {/* Card 4: Tier-2 Secondary — Last Interval (Up -> Down) */}
        <div className={KPI_CARD_BASE}>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>입력 간격</span>
            <Timer className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2.5 flex h-8 items-baseline gap-1.5 font-mono tabular-nums">
            <span
              className={cn(
                "text-2xl font-semibold leading-none tracking-tight",
                lastIntervalMs !== null && lastIntervalMs <= thresholdMs
                  ? "text-coral"
                  : "text-foreground"
              )}
            >
              {lastIntervalMs !== null ? lastIntervalMs.toFixed(2) : "-"}
            </span>
            {lastIntervalMs !== null && (
              <span className="text-xs text-muted-foreground">ms</span>
            )}
          </div>
        </div>
      </div>

      {/* Tier 2 — Control Bar */}
      <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Layout Selector */}
          <div className="flex items-center rounded-lg border border-border bg-surface-sunken p-1">
            <button
              type="button"
              onClick={() => setLayoutMode("104")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                layoutMode === "104"
                  ? "bg-sage text-[#121413]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              104키
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("87")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                layoutMode === "87"
                  ? "bg-sage text-[#121413]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              87키
            </button>
          </div>

          {/* Browser Shortcut Lock Toggle */}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs">
            {shortcutLock ? (
              <Lock className="size-3.5 text-sage" />
            ) : (
              <Unlock className="size-3.5 text-muted-foreground" />
            )}
            <span className="font-medium text-foreground">단축키 잠금</span>
            <Switch
              checked={shortcutLock}
              onCheckedChange={(checked) => setShortcutLock(checked)}
              aria-label="브라우저 단축키 잠금"
            />
          </label>

          {/* Fullscreen Hardware Win-Key Lock (Chromium Keyboard Lock API) */}
          <button
            type="button"
            onClick={handleToggleWinKeyLock}
            title="전체화면 모드에서 윈도우(Win) 키 시작 메뉴를 차단합니다 (ESC 길게 눌러 해제)"
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              isWinKeyLocked
                ? "border-sage bg-surface-elevated text-sage"
                : "border-border bg-surface-sunken text-foreground hover:bg-surface-elevated"
            )}
          >
            {isWinKeyLocked ? (
              <Minimize2 className="size-3.5 text-sage" />
            ) : (
              <Maximize2 className="size-3.5 text-sage" />
            )}
            <span>
              {isWinKeyLocked ? "잠금 중 (ESC 홀드)" : "Win키 잠금"}
            </span>
          </button>
        </div>

        {/* Chattering Threshold Slider */}
        <div className="flex w-full flex-col gap-1.5 lg:w-[280px] lg:shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">채터링 임계값</span>
            <Badge
              variant="outline"
              className="border-sand/45 bg-surface-elevated font-mono tabular-nums text-[11px] text-sand"
            >
              <span className="inline-block min-w-[2.2ch] text-right font-mono tabular-nums">
                {thresholdMs}
              </span>
              ms 이하
            </Badge>
          </div>
          <Slider
            min={5}
            max={50}
            step={1}
            value={[thresholdMs]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === "number") {
                setThresholdMs(next);
              }
            }}
          />
        </div>
      </div>

      {/* Virtual Mechanical Keyboard Deck */}
      <section className="lab-grid-bg rounded-2xl border border-border bg-surface-sunken p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <KeyboardIcon className="size-4 shrink-0 text-sage" />
            <span>
              <span className="font-mono text-foreground">한/영</span> ·{" "}
              <span className="font-mono text-foreground">한자</span> 키는 우측{" "}
              <span className="font-mono text-foreground">Alt</span> ·{" "}
              <span className="font-mono text-foreground">Ctrl</span>에 연동됩니다.
            </span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5">
              <span className="size-2 rounded-full bg-sage" />
              입력 중
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5">
              <span className="size-2 rounded-full border border-border-tested bg-surface-tested" />
              정상 확인
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5">
              <span className="size-2 rounded-full bg-coral" />
              채터링 경고
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 [container-type:inline-size]">
          <div
            className="mx-auto flex w-max items-start"
            style={
              {
                "--key-u":
                  layoutMode === "104"
                    ? "clamp(32px, calc((100cqw - 80px) / 22.9), 52px)"
                    : "clamp(32px, calc((100cqw - 68px) / 18.45), 52px)",
                gap: "calc(0.45 * var(--key-u))",
              } as React.CSSProperties
            }
          >
            {/* Main Block (15u) */}
            <div className="flex flex-col">
              {MAIN_BLOCK_ROWS.map((row, rowIdx) => (
                <div
                  key={`main-row-${rowIdx}`}
                  className="flex items-center gap-[4px]"
                  style={{
                    marginTop:
                      rowIdx === 0 ? 0 : rowIdx === 1 ? "12px" : "4px",
                  }}
                >
                  {row.map((slot, slotIdx) =>
                    slot.kind === "spacer" ? (
                      <div
                        key={`main-sp-${rowIdx}-${slotIdx}`}
                        style={{
                          width: `calc(${slot.width} * var(--key-u) + ${
                            (slot.width - 1) * 4
                          }px)`,
                          height: "var(--key-u)",
                        }}
                        className="shrink-0"
                      />
                    ) : (
                      renderKeycap(slot.key)
                    )
                  )}
                </div>
              ))}
            </div>

            {/* Navigation & Arrow Cluster (3u) */}
            <div className="flex flex-col">
              {NAV_BLOCK_ROWS.map((row, rowIdx) => (
                <div
                  key={`nav-row-${rowIdx}`}
                  className="flex items-center gap-[4px]"
                  style={{
                    marginTop:
                      rowIdx === 0 ? 0 : rowIdx === 1 ? "12px" : "4px",
                  }}
                >
                  {row.map((slot, slotIdx) =>
                    slot.kind === "spacer" ? (
                      <div
                        key={`nav-sp-${rowIdx}-${slotIdx}`}
                        style={{
                          width: `calc(${slot.width} * var(--key-u) + ${
                            (slot.width - 1) * 4
                          }px)`,
                          height: "var(--key-u)",
                        }}
                        className="shrink-0"
                      />
                    ) : (
                      renderKeycap(slot.key)
                    )
                  )}
                </div>
              ))}
            </div>

            {/* Numpad Cluster (4u) - 104-key Full only */}
            {layoutMode === "104" && (
              <div className="flex flex-col">
                {/* Row 1 aligned Lock LED Panel */}
                <div
                  className="flex items-center justify-around rounded-md border border-border bg-card px-2"
                  style={{
                    width: "calc(4 * var(--key-u) + 12px)",
                    height: "var(--key-u)",
                  }}
                >
                  {[
                    { label: "NUM", active: lockLeds.num },
                    { label: "CAPS", active: lockLeds.caps },
                    { label: "SCR", active: lockLeds.scroll },
                  ].map((led) => (
                    <div
                      key={led.label}
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full transition-colors",
                          led.active ? "bg-sage" : "bg-[#282D2A]"
                        )}
                      />
                      <span className="font-mono text-[9px] font-semibold text-muted-foreground">
                        {led.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rows 2-6 Numpad 4x5 Grid */}
                <div
                  className="mt-[12px] grid grid-cols-4 gap-[4px]"
                  style={{
                    width: "calc(4 * var(--key-u) + 12px)",
                  }}
                >
                  {NUMPAD_KEYS.map((keyDef) => {
                    const colSpan = keyDef.colSpan ?? 1;
                    const rowSpan = keyDef.rowSpan ?? 1;
                    return renderKeycap(keyDef, {
                      gridColumn:
                        colSpan > 1 ? `span ${colSpan} / span ${colSpan}` : undefined,
                      gridRow:
                        rowSpan > 1 ? `span ${rowSpan} / span ${rowSpan}` : undefined,
                      height:
                        rowSpan > 1
                          ? `calc(${rowSpan} * var(--key-u) + ${(rowSpan - 1) * 4}px)`
                          : "var(--key-u)",
                      width: "100%",
                    });
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tier 3 — Low-Saturation History Log Panel */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">입력 기록</h2>
            <span className="rounded border border-border bg-surface-sunken px-2 py-0.5 font-mono tabular-nums text-[11px] text-muted-foreground">
              {logs.length}건
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-surface-sunken p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLogFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  logFilter === "all"
                    ? "bg-surface-elevated text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                전체
              </button>
              <button
                type="button"
                onClick={() => setLogFilter("chatter")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  logFilter === "chatter"
                    ? "bg-[#2B1B1D] text-coral"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                채터링 (
                <span className="font-mono tabular-nums">
                  {stats.totalChatterEvents}
                </span>
                )
              </button>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleClearLogs}
              className="border-border bg-surface-sunken text-muted-foreground hover:border-[#3A413D] hover:bg-surface-elevated hover:text-foreground"
            >
              <Trash2 className="size-3.5" />
              <span>비우기</span>
            </Button>
          </div>
        </div>

        <div className="max-h-[320px] overflow-auto rounded-lg border border-border bg-surface-sunken">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-border bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-[18%] px-3.5 py-2.5 font-medium">시각</th>
                <th className="w-[28%] px-3.5 py-2.5 font-medium">키</th>
                <th className="w-[18%] px-3.5 py-2.5 font-medium">유지</th>
                <th className="w-[22%] px-3.5 py-2.5 font-medium">간격</th>
                <th className="w-[14%] px-3.5 py-2.5 font-medium">판정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono tabular-nums">
              {visibleLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center font-sans text-sm text-muted-foreground"
                  >
                    {logFilter === "chatter"
                      ? "감지된 채터링 기록이 없습니다."
                      : "키를 누르면 입력 기록이 표시됩니다."}
                  </td>
                </tr>
              ) : (
                visibleLogs.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      "transition-colors",
                      entry.isChatter
                        ? "bg-coral/12 hover:bg-coral/16"
                        : "hover:bg-surface-elevated/60"
                    )}
                  >
                    <td className="truncate px-3.5 py-2 text-muted-foreground">
                      {entry.timestamp}
                    </td>
                    <td
                      className="truncate px-3.5 py-2"
                      title={`${entry.label} (${entry.code})`}
                    >
                      <span className="font-semibold text-foreground">
                        {entry.label}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        ({entry.code})
                      </span>
                    </td>
                    <td className="truncate px-3.5 py-2 text-muted-foreground">
                      {entry.holdMs === null ? (
                        <span className="text-sage">누르는 중...</span>
                      ) : (
                        formatMs(entry.holdMs)
                      )}
                    </td>
                    <td
                      className={cn(
                        "truncate px-3.5 py-2 font-medium",
                        entry.isChatter
                          ? "text-coral"
                          : entry.intervalMs !== null
                            ? "text-foreground"
                            : "text-muted-foreground"
                      )}
                    >
                      {formatMs(entry.intervalMs)}
                    </td>
                    <td className="px-3.5 py-2 font-sans">
                      {entry.isChatter ? (
                        <Badge className="border border-coral/60 bg-[#2B1B1D] text-[11px] text-coral">
                          채터링 의심
                        </Badge>
                      ) : (
                        <Badge className="border border-border bg-surface-elevated text-[11px] text-muted-foreground">
                          정상
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <TesterToSpecsCompactBanner targetTab="switches" />
    </div>
  );
}
