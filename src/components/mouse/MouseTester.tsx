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
  Activity,
  AlertTriangle,
  Crosshair,
  Gauge,
  Lock,
  Mouse as MouseIcon,
  MousePointerClick,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
  Unlock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { KPI_CARD_BASE, KPI_CARD_PRIMARY } from "@/lib/ui-tokens";
import {
  MouseDeviceCertBanner,
  TesterToSpecsCompactBanner,
} from "@/components/specs/TesterDeviceBridge";
import { cn } from "@/lib/utils";

interface PollingFrame {
  ts: number;
  perfNow: number;
  count: number;
}

interface GraphPoint {
  t: number;
  hz: number;
}

type MouseButtonId = 0 | 2 | 1 | 3 | 4;

interface SwitchButtonMeta {
  id: MouseButtonId;
  shortLabel: string;
  label: string;
  codeLabel: string;
}

const SWITCH_BUTTONS: SwitchButtonMeta[] = [
  { id: 0, shortLabel: "LMB", label: "좌클릭", codeLabel: "Button 0" },
  { id: 2, shortLabel: "RMB", label: "우클릭", codeLabel: "Button 2" },
  { id: 1, shortLabel: "MMB", label: "휠클릭", codeLabel: "Button 1" },
  { id: 3, shortLabel: "M4", label: "사이드 (뒤로)", codeLabel: "Button 3" },
  { id: 4, shortLabel: "M5", label: "사이드 (앞으로)", codeLabel: "Button 4" },
];

const SWITCH_BUTTON_MAP = new Map<number, SwitchButtonMeta>(
  SWITCH_BUTTONS.map((btn) => [btn.id, btn])
);

interface SwitchButtonState {
  isPressed: boolean;
  clickCount: number;
  faultCount: number;
  lastIntervalMs: number | null;
  lastHoldMs: number | null;
}

interface SwitchLogEntry {
  id: number;
  timestamp: string;
  buttonId: number;
  buttonLabel: string;
  shortLabel: string;
  holdMs: number | null;
  intervalMs: number | null;
  isDoubleClickFault: boolean;
}

function formatClockTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function createInitialSwitchStates(): Record<number, SwitchButtonState> {
  const initial: Record<number, SwitchButtonState> = {};
  for (const btn of SWITCH_BUTTONS) {
    initial[btn.id] = {
      isPressed: false,
      clickCount: 0,
      faultCount: 0,
      lastIntervalMs: null,
      lastHoldMs: null,
    };
  }
  return initial;
}

export function MouseTester() {
  // Polling rate display states (synced at ~20Hz from high-frequency refs)
  const [liveHz, setLiveHz] = useState<number>(0);
  const [peakHz, setPeakHz] = useState<number>(0);
  const [avgHz, setAvgHz] = useState<number>(0);
  const [totalMoveSamples, setTotalMoveSamples] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Switch double-click states
  const [switchThresholdMs, setSwitchThresholdMs] = useState<number>(20);
  const [switchStates, setSwitchStates] = useState<
    Record<number, SwitchButtonState>
  >(createInitialSwitchStates);
  const [switchLogs, setSwitchLogs] = useState<SwitchLogEntry[]>([]);
  const [backBlockedNotice, setBackBlockedNotice] = useState<boolean>(false);

  // High-precision DOM & telemetry refs
  const trackingBoxRef = useRef<HTMLDivElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const framesRef = useRef<PollingFrame[]>([]);
  const liveHzRef = useRef<number>(0);
  const peakHzRef = useRef<number>(0);
  const avgHzRef = useRef<number>(0);
  const totalMoveSamplesRef = useRef<number>(0);
  const activeSamplesRef = useRef<number[]>([]);
  const lastSampleRecordedAtRef = useRef<number>(0);
  const lastMovePerfNowRef = useRef<number>(0);
  const lastPointerLockChangePerfRef = useRef<number>(0);

  const graphPointsRef = useRef<GraphPoint[]>([]);
  const currentMaxYRef = useRef<number>(1200);
  const lastUiSyncAtRef = useRef<number>(0);

  // Radar reticle coordinates inside Tracking Box
  const reticlePosRef = useRef<{ x: number; y: number; initialized: boolean }>({
    x: 0,
    y: 0,
    initialized: false,
  });
  const reticleTrailRef = useRef<Array<{ x: number; y: number; t: number }>>([]);

  // Switch tester refs
  const switchThresholdRef = useRef<number>(switchThresholdMs);
  const buttonDownAtRef = useRef<Map<number, { downAt: number; logId: number }>>(
    new Map()
  );
  const buttonLastUpAtRef = useRef<Map<number, number>>(new Map());
  const nextSwitchLogIdRef = useRef<number>(0);
  const isInsideSwitchPadRef = useRef<boolean>(false);
  const hasHistoryGuardRef = useRef<boolean>(false);
  const lastSideClickAtRef = useRef<number>(0);
  const backNoticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    switchThresholdRef.current = switchThresholdMs;
  }, [switchThresholdMs]);

  const handleResetPolling = useCallback(() => {
    framesRef.current = [];
    liveHzRef.current = 0;
    peakHzRef.current = 0;
    avgHzRef.current = 0;
    totalMoveSamplesRef.current = 0;
    activeSamplesRef.current = [];
    lastSampleRecordedAtRef.current = 0;
    lastMovePerfNowRef.current = 0;
    graphPointsRef.current = [];
    currentMaxYRef.current = 1200;
    reticleTrailRef.current = [];

    setLiveHz(0);
    setPeakHz(0);
    setAvgHz(0);
    setTotalMoveSamples(0);
  }, []);

  const handleResetSwitches = useCallback(() => {
    buttonDownAtRef.current.clear();
    buttonLastUpAtRef.current.clear();
    setSwitchStates(createInitialSwitchStates());
    setSwitchLogs([]);
  }, []);

  const handleEnterPointerLock = useCallback(async () => {
    const boxEl = trackingBoxRef.current;
    if (!boxEl || document.pointerLockElement === boxEl) return;

    try {
      const lockFn = boxEl.requestPointerLock as unknown as (options?: {
        unadjustedMovement?: boolean;
      }) => Promise<void> | void;
      await lockFn.call(boxEl, { unadjustedMovement: true });
    } catch {
      try {
        boxEl.requestPointerLock();
      } catch {
        // Ignore if user/browser disallows pointer lock
      }
    }
  }, []);

  // Pointer Lock state & raw 8K pointermove tracking
  useEffect(() => {
    const boxEl = trackingBoxRef.current;
    if (!boxEl) return;

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === boxEl;
      lastPointerLockChangePerfRef.current = performance.now();
      setIsLocked(locked);

      const rect = boxEl.getBoundingClientRect();
      if (!reticlePosRef.current.initialized) {
        reticlePosRef.current = {
          x: rect.width / 2,
          y: rect.height / 2,
          initialized: true,
        };
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const nowPerf = performance.now();
      if (
        nowPerf - lastPointerLockChangePerfRef.current < 30 &&
        e.movementX === 0 &&
        e.movementY === 0
      ) {
        return;
      }

      const coalesced =
        typeof e.getCoalescedEvents === "function"
          ? e.getCoalescedEvents()
          : [];
      const count = coalesced.length > 0 ? coalesced.length : 1;
      const rawLastTs =
        coalesced.length > 0 && coalesced[coalesced.length - 1].timeStamp > 0
          ? coalesced[coalesced.length - 1].timeStamp
          : nowPerf;

      const frames = framesRef.current;
      const lastFrame = frames[frames.length - 1];
      const lastEventTs =
        lastFrame && rawLastTs < lastFrame.ts ? nowPerf : rawLastTs;

      if (lastFrame && lastEventTs - lastFrame.ts > 90) {
        framesRef.current = [];
      }

      framesRef.current.push({
        ts: lastEventTs,
        perfNow: nowPerf,
        count,
      });

      while (
        framesRef.current.length > 2 &&
        lastEventTs - framesRef.current[1].ts >= 450
      ) {
        framesRef.current.shift();
      }

      lastMovePerfNowRef.current = nowPerf;
      totalMoveSamplesRef.current += count;

      const curFrames = framesRef.current;
      if (curFrames.length >= 2) {
        const spanMs = curFrames[curFrames.length - 1].ts - curFrames[0].ts;
        let totalEvents = 0;
        for (let i = 1; i < curFrames.length; i += 1) {
          totalEvents += curFrames[i].count;
        }

        if (spanMs >= 50) {
          const hz = Math.round((totalEvents / spanMs) * 1000);
          liveHzRef.current = hz;

          if (spanMs >= 120) {
            if (hz > peakHzRef.current) {
              peakHzRef.current = hz;
            }

            if (
              hz >= 100 &&
              nowPerf - lastSampleRecordedAtRef.current >= 100
            ) {
              lastSampleRecordedAtRef.current = nowPerf;
              activeSamplesRef.current.push(hz);
              if (activeSamplesRef.current.length > 300) {
                activeSamplesRef.current.shift();
              }

              const cutoff = Math.max(100, peakHzRef.current * 0.6);
              const validSamples = activeSamplesRef.current.filter(
                (sample) => sample >= cutoff
              );
              const pool =
                validSamples.length > 0
                  ? validSamples
                  : activeSamplesRef.current;
              const sum = pool.reduce((acc, v) => acc + v, 0);
              avgHzRef.current = Math.round(sum / pool.length);
            }
          }
        }
      }

      // Update reticle coordinates for visual feedback inside Tracking Box
      const rect = boxEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        let nextX: number;
        let nextY: number;

        if (document.pointerLockElement === boxEl) {
          if (!reticlePosRef.current.initialized) {
            reticlePosRef.current = {
              x: rect.width / 2,
              y: rect.height / 2,
              initialized: true,
            };
          }
          nextX =
            (((reticlePosRef.current.x + e.movementX * 0.55) % rect.width) +
              rect.width) %
            rect.width;
          nextY =
            (((reticlePosRef.current.y + e.movementY * 0.55) % rect.height) +
              rect.height) %
            rect.height;
        } else {
          nextX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          nextY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        }

        reticlePosRef.current = { x: nextX, y: nextY, initialized: true };
        reticleTrailRef.current.push({ x: nextX, y: nextY, t: nowPerf });
        if (reticleTrailRef.current.length > 24) {
          reticleTrailRef.current.shift();
        }
      }
    };

    document.addEventListener("pointerlockchange", handlePointerLockChange);
    boxEl.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      boxEl.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  // 60FPS+ Real-time Canvas Graph & Tracking Reticle Loop
  useEffect(() => {
    let rafId = 0;

    const renderLoop = () => {
      const now = performance.now();

      // Idle decay for liveHz only; Peak Hz & Avg Hz remain preserved
      if (now - lastMovePerfNowRef.current > 120 && liveHzRef.current > 0) {
        liveHzRef.current =
          liveHzRef.current < 20 ? 0 : Math.round(liveHzRef.current * 0.65);
      }

      graphPointsRef.current.push({ t: now, hz: liveHzRef.current });
      const cutoffTime = now - 5000;
      while (
        graphPointsRef.current.length > 0 &&
        graphPointsRef.current[0].t < cutoffTime
      ) {
        graphPointsRef.current.shift();
      }

      // Sync React numeric metrics at ~20Hz so React never bottlenecks 8K tracking
      if (now - lastUiSyncAtRef.current >= 50) {
        lastUiSyncAtRef.current = now;
        setLiveHz(liveHzRef.current);
        setPeakHz(peakHzRef.current);
        setAvgHz(avgHzRef.current);
        setTotalMoveSamples(totalMoveSamplesRef.current);
      }

      // 1) Draw Radar / Trail Canvas inside Tracking Box
      const radarCanvas = radarCanvasRef.current;
      if (radarCanvas) {
        const rect = radarCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));

        if (
          radarCanvas.width !== Math.floor(w * dpr) ||
          radarCanvas.height !== Math.floor(h * dpr)
        ) {
          radarCanvas.width = Math.floor(w * dpr);
          radarCanvas.height = Math.floor(h * dpr);
        }

        const ctx = radarCanvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);

          // Center crosshair rings
          const cx = w / 2;
          const cy = h / 2;
          ctx.strokeStyle = "#282D2A";
          ctx.lineWidth = 1;
          for (const r of [38, 76, 114]) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Prune stale trail points (> 280ms)
          reticleTrailRef.current = reticleTrailRef.current.filter(
            (pt) => now - pt.t < 280
          );
          const trail = reticleTrailRef.current;

          if (trail.length > 1) {
            for (let i = 1; i < trail.length; i += 1) {
              const p0 = trail[i - 1];
              const p1 = trail[i];
              // Skip wrap-around lines in Pointer Lock
              if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 140) continue;
              const ageRatio = 1 - (now - p1.t) / 280;
              ctx.strokeStyle = `rgba(107, 144, 128, ${Math.max(0.08, ageRatio * 0.8)})`;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y);
              ctx.lineTo(p1.x, p1.y);
              ctx.stroke();
            }
          }

          if (reticlePosRef.current.initialized && liveHzRef.current > 0) {
            const { x, y } = reticlePosRef.current;
            ctx.fillStyle = "#D4A373";
            ctx.beginPath();
            ctx.arc(x, y, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 2) Draw 60FPS Real-time Polling Rate Oscilloscope Canvas
      const graphCanvas = graphCanvasRef.current;
      if (graphCanvas) {
        const rect = graphCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));

        if (
          graphCanvas.width !== Math.floor(w * dpr) ||
          graphCanvas.height !== Math.floor(h * dpr)
        ) {
          graphCanvas.width = Math.floor(w * dpr);
          graphCanvas.height = Math.floor(h * dpr);
        }

        const ctx = graphCanvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);

          const targetMaxY =
            peakHzRef.current > 4500
              ? 8800
              : peakHzRef.current > 2300
                ? 4500
                : peakHzRef.current > 1150
                  ? 2400
                  : 1200;

          currentMaxYRef.current +=
            (targetMaxY - currentMaxYRef.current) * 0.14;
          const maxY = currentMaxYRef.current;

          const padLeft = 56;
          const padRight = 14;
          const padTop = 14;
          const padBottom = 22;
          const plotW = Math.max(10, w - padLeft - padRight);
          const plotH = Math.max(10, h - padTop - padBottom);

          const hzToY = (hz: number) =>
            padTop + plotH - Math.min(1, Math.max(0, hz / maxY)) * plotH;

          // Reference horizontal dashed grid lines
          const referenceTicks =
            maxY <= 1400
              ? [250, 500, 1000]
              : [1000, 2000, 4000, 8000].filter((tick) => tick <= maxY * 0.98);

          ctx.font = '11px "JetBrains Mono", ui-monospace, monospace';
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";

          for (const tick of referenceTicks) {
            const y = hzToY(tick);
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "#282D2A";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + plotW, y);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = "#8F9691";
            ctx.fillText(`${tick}Hz`, padLeft - 8, y);
          }

          // Baseline 0 Hz
          ctx.strokeStyle = "#282D2A";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padLeft, padTop + plotH);
          ctx.lineTo(padLeft + plotW, padTop + plotH);
          ctx.stroke();

          // Average Hz reference line
          if (avgHzRef.current > 0) {
            const avgY = hzToY(avgHzRef.current);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = "#D4A373";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(padLeft, avgY);
            ctx.lineTo(padLeft + plotW, avgY);
            ctx.stroke();
            ctx.restore();
          }

          // Time axis labels (-5s ... Live)
          ctx.fillStyle = "#8F9691";
          ctx.textAlign = "left";
          ctx.fillText("-5.0s", padLeft, h - 8);
          ctx.textAlign = "center";
          ctx.fillText("-2.5s", padLeft + plotW / 2, h - 8);
          ctx.textAlign = "right";
          ctx.fillStyle = "#6B9080";
          ctx.fillText("LIVE", padLeft + plotW, h - 8);

          // Waveform curve + matte solid 10% fill
          const points = graphPointsRef.current;
          if (points.length > 1) {
            const windowStart = now - 5000;

            ctx.beginPath();
            for (let i = 0; i < points.length; i += 1) {
              const pt = points[i];
              const x = padLeft + ((pt.t - windowStart) / 5000) * plotW;
              const y = hzToY(pt.hz);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }

            // Fill under curve
            const lastPt = points[points.length - 1];
            const firstPt = points[0];
            const lastX = padLeft + ((lastPt.t - windowStart) / 5000) * plotW;
            const firstX = padLeft + ((firstPt.t - windowStart) / 5000) * plotW;

            ctx.save();
            ctx.lineTo(lastX, padTop + plotH);
            ctx.lineTo(firstX, padTop + plotH);
            ctx.closePath();
            ctx.fillStyle = "rgba(107, 144, 128, 0.10)";
            ctx.fill();
            ctx.restore();

            // Stroke Forest Sage Green line
            ctx.beginPath();
            for (let i = 0; i < points.length; i += 1) {
              const pt = points[i];
              const x = padLeft + ((pt.t - windowStart) / 5000) * plotW;
              const y = hzToY(pt.hz);
              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.strokeStyle = "#6B9080";
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.stroke();
          }
        }
      }

      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // History popstate guard while cursor is inside the Switch Test Pad
  useEffect(() => {
    const handlePopState = () => {
      if (
        isInsideSwitchPadRef.current ||
        performance.now() - lastSideClickAtRef.current < 600
      ) {
        window.history.pushState({ switchPadGuard: true }, "");
        setBackBlockedNotice(true);
        if (backNoticeTimerRef.current !== null) {
          window.clearTimeout(backNoticeTimerRef.current);
        }
        backNoticeTimerRef.current = window.setTimeout(() => {
          setBackBlockedNotice(false);
        }, 2000);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (backNoticeTimerRef.current !== null) {
        window.clearTimeout(backNoticeTimerRef.current);
      }
    };
  }, []);

  const handleSwitchPadPointerEnter = () => {
    isInsideSwitchPadRef.current = true;
    if (!hasHistoryGuardRef.current) {
      hasHistoryGuardRef.current = true;
      window.history.pushState({ switchPadGuard: true }, "");
    }
  };

  const handleSwitchPadPointerLeave = () => {
    isInsideSwitchPadRef.current = false;
  };

  const handleSwitchMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const meta = SWITCH_BUTTON_MAP.get(e.button);
    if (!meta) return;

    if (e.button === 3 || e.button === 4) {
      lastSideClickAtRef.current = performance.now();
    }

    if (buttonDownAtRef.current.has(e.button)) return;

    const now = performance.now();
    const prevUp = buttonLastUpAtRef.current.get(e.button);
    const intervalMs = prevUp !== undefined ? Math.max(0, now - prevUp) : null;
    const isFault =
      intervalMs !== null && intervalMs <= switchThresholdRef.current;

    const logId = ++nextSwitchLogIdRef.current;
    buttonDownAtRef.current.set(e.button, { downAt: now, logId });

    setSwitchStates((prev) => {
      const current = prev[e.button];
      if (!current) return prev;
      return {
        ...prev,
        [e.button]: {
          ...current,
          isPressed: true,
          clickCount: current.clickCount + 1,
          faultCount: current.faultCount + (isFault ? 1 : 0),
          lastIntervalMs: intervalMs,
        },
      };
    });

    setSwitchLogs((prev) =>
      [
        {
          id: logId,
          timestamp: formatClockTime(new Date()),
          buttonId: e.button,
          buttonLabel: meta.label,
          shortLabel: meta.shortLabel,
          holdMs: null,
          intervalMs,
          isDoubleClickFault: isFault,
        },
        ...prev,
      ].slice(0, 100)
    );
  };

  const handleSwitchMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.button === 3 || e.button === 4) {
      lastSideClickAtRef.current = performance.now();
    }

    const entry = buttonDownAtRef.current.get(e.button);
    if (!entry) return;

    const now = performance.now();
    const holdMs = Math.max(0, now - entry.downAt);
    buttonLastUpAtRef.current.set(e.button, now);
    buttonDownAtRef.current.delete(e.button);

    setSwitchStates((prev) => {
      const current = prev[e.button];
      if (!current) return prev;
      return {
        ...prev,
        [e.button]: {
          ...current,
          isPressed: false,
          lastHoldMs: holdMs,
        },
      };
    });

    setSwitchLogs((prev) =>
      prev.map((log) => (log.id === entry.logId ? { ...log, holdMs } : log))
    );
  };

  const releaseAllSwitchButtons = useCallback(() => {
    if (buttonDownAtRef.current.size === 0) return;
    buttonDownAtRef.current.clear();
    setSwitchStates((prev) => {
      const next: Record<number, SwitchButtonState> = {};
      for (const [id, st] of Object.entries(prev)) {
        next[Number(id)] = { ...st, isPressed: false };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("blur", releaseAllSwitchButtons);
    return () => window.removeEventListener("blur", releaseAllSwitchButtons);
  }, [releaseAllSwitchButtons]);

  const totalSwitchFaults = useMemo(
    () =>
      Object.values(switchStates).reduce(
        (sum, st) => sum + st.faultCount,
        0
      ),
    [switchStates]
  );

  const totalSwitchClicks = useMemo(
    () =>
      Object.values(switchStates).reduce(
        (sum, st) => sum + st.clickCount,
        0
      ),
    [switchStates]
  );

  const handleResetAllForCert = useCallback(() => {
    handleResetPolling();
    handleResetSwitches();
  }, [handleResetPolling, handleResetSwitches]);

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <MouseDeviceCertBanner
          moveSamples={totalMoveSamples}
          peakHz={peakHz}
          clickCount={totalSwitchClicks}
          doubleClickFaults={totalSwitchFaults}
          onResetAll={handleResetAllForCert}
        />
      </Suspense>

      {/* Header Title Row */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#282D2A] pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#6B9080]/40 bg-[#1A1D1B] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#6B9080]">
              <MouseIcon className="size-3.5" />
              HIGH-PRECISION MOUSE TEST
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#D5DBD6] sm:text-3xl">
            마우스 테스트
          </h1>
          <p className="mt-1 text-sm text-[#8F9691]">
            폴링레이트 · 5버튼 더블클릭 실시간 진단
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleResetPolling}
          className="w-fit shrink-0 border-border bg-surface-elevated text-foreground hover:border-sage hover:bg-[#2A302C]"
        >
          <RotateCcw className="size-4" />
          <span>초기화</span>
        </Button>
      </div>

      {/* Primary Polling Rate Readouts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Card 1: Tier-1 Primary — Live Hz */}
        <div className={KPI_CARD_PRIMARY}>
          <div className="flex items-center justify-between text-xs font-medium text-foreground">
            <span>실시간</span>
            <Activity className="size-4 text-sage" />
          </div>
          <div className="mt-2.5 flex h-8 items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-3xl font-bold leading-none tracking-tight text-sage">
              {liveHz.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              Hz
            </span>
          </div>
        </div>

        {/* Card 2: Tier-2 Secondary — Peak Hz */}
        <div className={KPI_CARD_BASE}>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>최대 (Peak)</span>
            <TrendingUp className="size-4 text-sand" />
          </div>
          <div className="mt-2.5 flex h-8 items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-2xl font-semibold leading-none tracking-tight text-foreground">
              {peakHz.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Hz</span>
          </div>
        </div>

        {/* Card 3: Tier-2 Secondary — Avg Hz */}
        <div className={KPI_CARD_BASE}>
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>평균 (Avg)</span>
            <Gauge className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2.5 flex h-8 items-baseline gap-1.5 font-mono tabular-nums">
            <span className="text-2xl font-semibold leading-none tracking-tight text-foreground">
              {avgHz.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">Hz</span>
          </div>
        </div>
      </div>

      {/* Tier 2 — 8K Tracking Box + 60FPS Real-time Canvas Oscilloscope */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Hybrid Tracking Box */}
        <div className="flex flex-col gap-2 lg:col-span-5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Crosshair className="size-4 text-sage" />
              센서 트래킹
            </span>
            {isLocked ? (
              <Badge className="border border-sage bg-surface-elevated font-mono text-[11px] text-sage">
                <Lock className="size-3" />
                잠금 활성 (ESC)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-border bg-card font-mono text-[11px] text-muted-foreground"
              >
                <Unlock className="size-3" />
                일반 측정
              </Badge>
            )}
          </div>

          <div
            ref={trackingBoxRef}
            onClick={handleEnterPointerLock}
            className={cn(
              "lab-grid-bg relative flex h-[300px] cursor-crosshair flex-col items-center justify-center overflow-hidden rounded-2xl border bg-surface-sunken select-none transition-colors",
              isLocked
                ? "border-sage"
                : "border-border hover:border-sage/60"
            )}
          >
            <canvas
              ref={radarCanvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            <div className="pointer-events-none relative z-10 flex flex-col items-center px-6 text-center">
              <div
                className={cn(
                  "mb-3 flex size-12 items-center justify-center rounded-full border transition-colors",
                  isLocked
                    ? "border-sage bg-surface-elevated text-sage"
                    : "border-border bg-card text-muted-foreground"
                )}
              >
                <MouseIcon className="size-5" />
              </div>
              {isLocked ? (
                <>
                  <p className="text-sm font-semibold text-sage">
                    커서 잠금 중 — 원을 그리며 측정하세요
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-mono text-sand">ESC</span>로 해제
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    마우스를 빠르게 움직여 측정하세요
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    클릭 시 커서 잠금 (ESC로 해제)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 60FPS Real-time Canvas Graph */}
        <div className="flex flex-col gap-2 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Activity className="size-4 text-sage" />
              폴링레이트 그래프
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-sage" />
                실시간
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 border-t border-dashed border-sand" />
                평균
              </span>
            </div>
          </div>

          <div className="relative h-[300px] overflow-hidden rounded-2xl border border-border bg-surface-sunken p-2">
            <canvas ref={graphCanvasRef} className="h-full w-full" />
          </div>
        </div>
      </div>

      {/* Tier 3 — Mouse 5-Button Switch Double-Click (Chattering) Tester */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex shrink-0 items-center gap-2">
            <MousePointerClick className="size-5 text-sage" />
            <h2 className="text-base font-bold text-foreground sm:text-lg">
              버튼 더블클릭 테스트
            </h2>
            {totalSwitchFaults > 0 && (
              <Badge className="border border-coral/60 bg-[#2B1B1D] font-mono tabular-nums text-xs text-coral">
                <AlertTriangle className="size-3" />
                더블클릭 {totalSwitchFaults}건
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:justify-end">
            <div className="flex w-full flex-col gap-1.5 sm:w-[240px]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">더블클릭 임계값</span>
                <Badge
                  variant="outline"
                  className="border-sand/45 bg-surface-elevated font-mono tabular-nums text-[11px] text-sand"
                >
                  <span className="inline-block min-w-[2.2ch] text-right font-mono tabular-nums">
                    {switchThresholdMs}
                  </span>
                  ms 이하
                </Badge>
              </div>
              <Slider
                min={5}
                max={80}
                step={1}
                value={[switchThresholdMs]}
                onValueChange={(value) => {
                  const next = Array.isArray(value) ? value[0] : value;
                  if (typeof next === "number") {
                    setSwitchThresholdMs(next);
                  }
                }}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleResetSwitches}
              className="w-fit shrink-0 self-end border-border bg-surface-elevated text-foreground hover:border-sage hover:bg-[#2A302C] sm:self-auto"
            >
              <RotateCcw className="size-4" />
              <span>초기화</span>
            </Button>
          </div>
        </div>

        {/* Dedicated Click Pad (isolated from Pointer Lock) */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col gap-3 lg:col-span-7">
            <div
              onPointerEnter={handleSwitchPadPointerEnter}
              onPointerLeave={handleSwitchPadPointerLeave}
              onMouseDown={handleSwitchMouseDown}
              onMouseUp={handleSwitchMouseUp}
              onAuxClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="lab-grid-bg relative flex min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-sunken p-6 text-center select-none transition-colors hover:border-sage"
            >
              <MousePointerClick className="mb-2 size-8 text-sage" />
              <p className="text-sm font-semibold text-foreground">
                버튼 클릭 테스트 영역
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                좌 · 우 · 휠 · 사이드 (뒤로가기 자동 차단)
              </p>
              {backBlockedNotice && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sand/50 bg-surface-elevated px-3 py-1 text-[11px] text-sand">
                  <ShieldAlert className="size-3.5" />
                  뒤로가기 동작 차단됨
                </div>
              )}
            </div>

            {/* 5 Button Telemetry Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {SWITCH_BUTTONS.map((btn) => {
                const st = switchStates[btn.id];
                const isFault = st.faultCount > 0;
                const isClean = st.clickCount > 0 && !isFault;

                return (
                  <div
                    key={btn.id}
                    className={cn(
                      "relative flex flex-col justify-between rounded-xl border border-b-2 p-3 transition-colors duration-75",
                      st.isPressed &&
                        !isFault &&
                        "border-[#88B09E] bg-[#6B9080] text-[#121413]",
                      st.isPressed &&
                        isFault &&
                        "border-[#F29CA3] bg-[#EB8A92] text-[#121413]",
                      !st.isPressed &&
                        isFault &&
                        "border-[#E06C75] bg-[#26191B] text-[#E4E6E1]",
                      !st.isPressed &&
                        !isFault &&
                        isClean &&
                        "border-[#6B9080] bg-[#2C3832] text-[#E4E6E1]",
                      !st.isPressed &&
                        !isFault &&
                        !isClean &&
                        "border-[#282D2A] bg-[#151816] text-[#8F9691]"
                    )}
                  >
                    <div className="flex h-4 items-center justify-between">
                      <span
                        className={cn(
                          "font-mono text-[11px] font-bold leading-none",
                          st.isPressed
                            ? "text-[#121413]/85"
                            : isFault
                              ? "text-coral"
                              : "text-sage"
                        )}
                      >
                        {btn.shortLabel}
                      </span>
                      {isFault && (
                        <span className="rounded-full border border-coral bg-[#121413] px-1.5 py-0.5 font-mono tabular-nums text-[9px] leading-none font-bold text-coral">
                          !{st.faultCount}
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "mt-1.5 text-xs font-semibold",
                        st.isPressed ? "text-[#121413]" : "text-foreground"
                      )}
                    >
                      {btn.label}
                    </div>
                    <div
                      className={cn(
                        "mt-2 flex flex-col gap-0.5 font-mono tabular-nums text-[11px]",
                        st.isPressed
                          ? "text-[#121413]/80"
                          : "text-muted-foreground"
                      )}
                    >
                      <span className="whitespace-nowrap">
                        클릭 {st.clickCount}회
                      </span>
                      <span
                        className={cn(
                          "whitespace-nowrap",
                          st.isPressed
                            ? "text-[#121413]"
                            : isFault
                              ? "text-coral"
                              : "text-foreground"
                        )}
                      >
                        {st.lastIntervalMs === null
                          ? "-"
                          : st.lastIntervalMs >= 1000
                            ? `${(st.lastIntervalMs / 1000).toFixed(1)}s`
                            : `${st.lastIntervalMs.toFixed(1)}ms`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Low-Saturation Switch Click History Log (좌측 컬럼 높이에 100% 고정되어 스크롤 시에도 박스 팽창 없음) */}
          <div className="lg:relative lg:col-span-5">
            <div className="flex h-[260px] flex-col overflow-hidden rounded-xl border border-border bg-surface-sunken lg:absolute lg:inset-0 lg:h-auto">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3.5 py-2.5 text-xs">
                <span className="font-semibold text-foreground">클릭 기록</span>
                <span className="font-mono tabular-nums text-[11px] text-muted-foreground">
                  {switchLogs.length}건
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <thead className="sticky top-0 border-b border-border bg-card text-[11px] text-muted-foreground">
                  <tr>
                    <th className="w-[32%] px-3 py-2 font-medium">버튼</th>
                    <th className="w-[22%] px-3 py-2 font-medium">유지</th>
                    <th className="w-[26%] px-3 py-2 font-medium">간격</th>
                    <th className="w-[20%] px-3 py-2 font-medium">판정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono tabular-nums">
                  {switchLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-10 text-center font-sans text-xs text-muted-foreground"
                      >
                        테스트 영역에서 클릭하면 기록이 표시됩니다.
                      </td>
                    </tr>
                  ) : (
                    switchLogs.map((log) => (
                      <tr
                        key={log.id}
                        className={cn(
                          log.isDoubleClickFault
                            ? "bg-coral/12"
                            : "hover:bg-surface-elevated/60"
                        )}
                      >
                        <td className="truncate px-3 py-2 font-sans text-foreground">
                          <span className="font-mono text-[11px] text-sage">
                            {log.shortLabel}
                          </span>{" "}
                          {log.buttonLabel}
                        </td>
                        <td className="truncate px-3 py-2 text-muted-foreground">
                          {log.holdMs === null
                            ? "누름..."
                            : `${log.holdMs.toFixed(1)}ms`}
                        </td>
                        <td
                          className={cn(
                            "truncate px-3 py-2",
                            log.isDoubleClickFault
                              ? "font-semibold text-coral"
                              : "text-foreground"
                          )}
                        >
                          {log.intervalMs !== null
                            ? `${log.intervalMs.toFixed(2)}ms`
                            : "-"}
                        </td>
                        <td className="px-3 py-2 font-sans">
                          {log.isDoubleClickFault ? (
                            <Badge className="border border-coral/60 bg-[#2B1B1D] text-[10px] text-coral">
                              더블클릭
                            </Badge>
                          ) : (
                            <Badge className="border border-border bg-surface-elevated text-[10px] text-muted-foreground">
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
            </div>
          </div>
        </div>
      </section>

      <TesterToSpecsCompactBanner targetTab="mice" />
    </div>
  );
}
