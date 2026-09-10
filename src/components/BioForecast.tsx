import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { calculateTrend, calculateLabComposite, type TrendResult } from "@/lib/bioSyncLogic";
import { useSimulatedVitals } from "@/features/dashboard/hooks/useSimulatedVitals";

/* ── Warm Earth Palette ── */
const W = {
  sage: "#7CB68E",
  terra: "#E8976C",
  sky: "#6BA3BE",
  gold: "#C4A46C",
  rose: "#D4847A",
  sand: "#E8E0D8",
  sandFaint: "rgba(232,224,216,0.08)",
  cardBg: "rgba(26,24,22,0.75)",
  cardBorder: "rgba(42,38,34,0.6)",
  textPrimary: "#E8E0D8",
  textSecondary: "#B0A89E",
  textDim: "#8A7E72",
  indigo: "#7B8CDE",
  violet: "#B8A9C9",
};

/* ── Correction Protocol Suggestions ── */
interface CorrectionProtocol {
  marker: string;
  status: "poor" | "suboptimal";
  icon: string;
  title: string;
  actions: string[];
  urgency: "high" | "moderate";
  color: string;
}

function getCorrectionProtocols(bioVault: {
  crp: number | null;
  hba1c: number | null;
  vitaminD: number | null;
  ferritin: number | null;
} | null): CorrectionProtocol[] {
  if (!bioVault) return [];
  const protocols: CorrectionProtocol[] = [];

  if (bioVault.crp != null) {
    if (bioVault.crp >= 10.0) {
      protocols.push({
        marker: "CRP",
        status: "poor",
        icon: "\u{1F525}",
        title: "Inflammation Critical",
        actions: [
          "Eliminate processed foods and seed oils for 14 days",
          "Add 2g EPA/DHA omega-3 daily",
          "Prioritize 8+ hours sleep to lower systemic inflammation",
          "Consider curcumin 500mg with black pepper extract",
        ],
        urgency: "high",
        color: W.rose,
      });
    } else if (bioVault.crp >= 3.0) {
      protocols.push({
        marker: "CRP",
        status: "suboptimal",
        icon: "\u{1F525}",
        title: "Inflammation Elevated",
        actions: [
          "Increase anti-inflammatory foods (berries, leafy greens, fatty fish)",
          "Add 1g omega-3 EPA/DHA daily",
          "Reduce refined sugar intake below 25g/day",
        ],
        urgency: "moderate",
        color: W.gold,
      });
    }
  }

  if (bioVault.hba1c != null) {
    if (bioVault.hba1c >= 6.5) {
      protocols.push({
        marker: "HbA1c",
        status: "poor",
        icon: "\u{1F4C9}",
        title: "Glucose Control Critical",
        actions: [
          "Implement 16:8 intermittent fasting protocol",
          "Walk 15 min after every meal to blunt glucose spikes",
          "Limit net carbs to under 100g/day",
          "Add berberine 500mg before meals or consult physician",
        ],
        urgency: "high",
        color: W.rose,
      });
    } else if (bioVault.hba1c >= 5.7) {
      protocols.push({
        marker: "HbA1c",
        status: "suboptimal",
        icon: "\u{1F4C9}",
        title: "Glucose Trending High",
        actions: [
          "Front-load protein and fiber before carbs at meals",
          "Add 10-min post-meal walks",
          "Consider chromium picolinate 200mcg daily",
        ],
        urgency: "moderate",
        color: W.gold,
      });
    }
  }

  if (bioVault.vitaminD != null) {
    if (bioVault.vitaminD < 20) {
      protocols.push({
        marker: "Vitamin D",
        status: "poor",
        icon: "\u2600\uFE0F",
        title: "Vitamin D Deficient",
        actions: [
          "Supplement 5000 IU D3 with K2 daily for 8 weeks",
          "Get 15 min midday sun exposure when possible",
          "Retest in 60 days to verify levels rising",
        ],
        urgency: "high",
        color: W.rose,
      });
    } else if (bioVault.vitaminD < 30) {
      protocols.push({
        marker: "Vitamin D",
        status: "suboptimal",
        icon: "\u2600\uFE0F",
        title: "Vitamin D Low",
        actions: [
          "Supplement 2000-3000 IU D3 with K2 daily",
          "Include vitamin D-rich foods (salmon, eggs, mushrooms)",
        ],
        urgency: "moderate",
        color: W.gold,
      });
    }
  }

  if (bioVault.ferritin != null) {
    if (bioVault.ferritin < 20) {
      protocols.push({
        marker: "Ferritin",
        status: "poor",
        icon: "\u{1FA78}",
        title: "Iron Stores Depleted",
        actions: [
          "Add iron bisglycinate 25mg with vitamin C on empty stomach",
          "Increase red meat, liver, or dark leafy greens",
          "Avoid coffee/tea within 1 hour of iron-rich meals",
          "Consult physician if symptoms persist",
        ],
        urgency: "high",
        color: W.rose,
      });
    } else if (bioVault.ferritin < 40) {
      protocols.push({
        marker: "Ferritin",
        status: "suboptimal",
        icon: "\u{1FA78}",
        title: "Iron Stores Low",
        actions: [
          "Pair iron-rich foods with vitamin C sources",
          "Consider low-dose iron bisglycinate 18mg every other day",
        ],
        urgency: "moderate",
        color: W.gold,
      });
    }
  }

  return protocols;
}

/* ── Pulse Keyframes (injected once) ── */
const PULSE_STYLE = `
@keyframes bioForecastPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(107,163,190,0.15); }
  50% { box-shadow: 0 0 20px 4px rgba(107,163,190,0.08); }
}
@keyframes bioForecastGlow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
@keyframes forecastSlideIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes shutdownArcPulse {
  0%, 100% { opacity: 0.7; filter: drop-shadow(0 0 4px rgba(184,169,201,0.3)); }
  50% { opacity: 1; filter: drop-shadow(0 0 10px rgba(184,169,201,0.5)); }
}
@keyframes recoveryWindowFadeIn {
  from { opacity: 0; transform: translateY(6px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`;

/* ══════════════════════════════════════════════════════════════ */
/*  Recovery Window Engine                                       */
/*  Predicts optimal sleep time based on real-time HR, stress,   */
/*  recovery, and activity load throughout the day.              */
/* ══════════════════════════════════════════════════════════════ */

interface RecoveryWindow {
  /** Recommended bedtime as hour (e.g. 22.5 = 10:30 PM) */
  bedtimeHour: number;
  /** Recommended wake time */
  wakeHour: number;
  /** Recommended sleep duration in hours */
  sleepDuration: number;
  /** Confidence 0-100 */
  confidence: number;
  /** Urgency: how soon should they wind down */
  urgency: "now" | "soon" | "later" | "optimal";
  /** Human-readable bedtime string */
  bedtimeLabel: string;
  /** Human-readable wake string */
  wakeLabel: string;
  /** Color for the shutdown arc */
  arcColor: string;
  /** Glow color */
  glowColor: string;
  /** Advisory message */
  advisory: string;
  /** Countdown to bedtime */
  countdownLabel: string;
  /** Minutes until wind-down phase */
  windDownMinutes: number;
  /** Circadian pressure score 0-20 */
  circadianPressure: number;
  /** Whether SpO2 is impacting the prediction */
  spo2Impact: boolean;
}

function formatHour(h: number): string {
  const hour24 = Math.floor(h) % 24;
  const mins = Math.round((h - Math.floor(h)) * 60);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12}:${mins.toString().padStart(2, "0")} ${period}`;
}

function calculateRecoveryWindow(
  hr: number,
  stress: number,
  recovery: number,
  spo2: number,
): RecoveryWindow {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  /* ── Activity Load Score (0-100) ── */
  /* Higher HR + higher stress + lower recovery = higher load */
  const hrLoad = Math.min(100, Math.max(0, ((hr - 55) / 50) * 100));
  const stressLoad = stress;
  const recoveryDeficit = 100 - recovery;
  /* SpO2 below 96% signals respiratory stress → increases load */
  const spo2Penalty = spo2 < 96 ? (96 - spo2) * 12 : 0;
  const activityLoad = hrLoad * 0.30 + stressLoad * 0.30 + recoveryDeficit * 0.25 + spo2Penalty * 0.15;

  /* ── Circadian rhythm factor ── */
  /* Natural melatonin onset ~9PM. Closer to evening = body wants sleep sooner */
  const circadianPressure = currentHour >= 20 ? Math.min(20, (currentHour - 20) * 5)
    : currentHour >= 17 ? (currentHour - 17) * 1.5
    : 0;

  /* ── Base sleep need: 7-9h depending on load ── */
  const baseSleep = 7.0;
  const loadBonus = (activityLoad / 100) * 1.5;
  const recoveryBonus = recovery < 60 ? 0.5 : recovery < 75 ? 0.25 : 0;
  const spo2Bonus = spo2 < 95 ? 0.5 : spo2 < 97 ? 0.25 : 0;
  const sleepDuration = Math.round((baseSleep + loadBonus + recoveryBonus + spo2Bonus) * 2) / 2;

  /* ── Optimal bedtime calculation ── */
  const baseBedtime = 22.0;
  const loadShift = -(activityLoad / 100) * 1.5;
  const stressShift = stress > 60 ? -0.5 : stress > 40 ? -0.25 : 0;
  const circadianShift = -(circadianPressure / 20) * 0.5;
  let bedtimeHour = baseBedtime + loadShift + stressShift + circadianShift;
  bedtimeHour = Math.max(20.0, Math.min(23.5, bedtimeHour));
  bedtimeHour = Math.round(bedtimeHour * 2) / 2;

  const wakeHour = (bedtimeHour + sleepDuration) % 24;

  /* ── Wind-down phase: 45min before bedtime ── */
  const windDownHour = bedtimeHour - 0.75;
  const hoursUntilWindDown = windDownHour - currentHour;

  /* ── Urgency based on current time vs bedtime ── */
  const hoursUntilBed = bedtimeHour - currentHour;
  let urgency: RecoveryWindow["urgency"];
  if (hoursUntilBed <= 0) urgency = "now";
  else if (hoursUntilBed <= 1.5) urgency = "soon";
  else if (hoursUntilBed <= 3) urgency = "later";
  else urgency = "optimal";

  /* ── Confidence — SpO2 stability adds confidence ── */
  const confidence = Math.round(
    55 + (recovery > 50 ? 15 : 5) + (stress < 70 ? 12 : 4) + (hr < 90 ? 10 : 0) + (spo2 >= 97 ? 8 : spo2 >= 95 ? 4 : 0)
  );

  /* ── Colors based on urgency ── */
  const colorMap = {
    now: { arc: W.rose, glow: "rgba(212,132,122,0.5)" },
    soon: { arc: W.gold, glow: "rgba(196,164,108,0.4)" },
    later: { arc: W.violet, glow: "rgba(184,169,201,0.35)" },
    optimal: { arc: W.indigo, glow: "rgba(123,140,222,0.3)" },
  };

  /* ── Advisory message — includes SpO2 and circadian context ── */
  const spo2Note = spo2 < 96 ? " Low SpO2 detected — extra recovery time added." : "";
  const circadianNote = circadianPressure > 10 ? " Circadian pressure is high — your body is primed for sleep." : "";
  const windDownNote = hoursUntilWindDown > 0 && hoursUntilWindDown <= 1
    ? ` Wind-down phase begins in ${Math.round(hoursUntilWindDown * 60)}min — dim screens, reduce stimulation.`
    : "";

  const advisories = {
    now: `Your body is signaling shutdown. Begin wind-down protocol immediately for ${sleepDuration}h recovery.${spo2Note}${circadianNote}`,
    soon: `Optimal shutdown window opens in ${Math.max(0.5, Math.round(hoursUntilBed * 2) / 2)}h.${windDownNote}${spo2Note}`,
    later: `Recovery window at ${formatHour(bedtimeHour)}. Current load suggests ${sleepDuration}h sleep needed tonight.${spo2Note}`,
    optimal: `Systems nominal. Projected ${sleepDuration}h recovery window starting ${formatHour(bedtimeHour)}.${circadianNote}`,
  };

  /* ── Countdown string for HUD display ── */
  const countdownMins = Math.max(0, Math.round(hoursUntilBed * 60));
  const countdownLabel = hoursUntilBed <= 0
    ? "NOW"
    : countdownMins >= 60
      ? `${Math.floor(countdownMins / 60)}h ${countdownMins % 60}m`
      : `${countdownMins}m`;

  return {
    bedtimeHour,
    wakeHour,
    sleepDuration,
    confidence: Math.min(100, confidence),
    urgency,
    bedtimeLabel: formatHour(bedtimeHour),
    wakeLabel: formatHour(wakeHour),
    arcColor: colorMap[urgency].arc,
    glowColor: colorMap[urgency].glow,
    advisory: advisories[urgency],
    countdownLabel,
    windDownMinutes: Math.max(0, Math.round(hoursUntilWindDown * 60)),
    circadianPressure: Math.round(circadianPressure),
    spo2Impact: spo2Penalty > 0,
  };
}

/* ══════════════════════════════════════════════════════════════ */
/*  Shutdown Arc — Glowing arc on the HUDProtocolRing            */
/*  Shows the recommended sleep window as a visual arc segment   */
/* ══════════════════════════════════════════════════════════════ */

function ShutdownArc({ window }: { window: RecoveryWindow }) {
  const size = 110;
  const r = 44;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  /* Map bedtime/wake to arc positions on a 24h clock face */
  /* 0 degrees = 12:00 (midnight/noon top), clockwise */
  const bedAngle = ((window.bedtimeHour % 24) / 24) * 360 - 90;
  const wakeAngle = ((window.wakeHour % 24) / 24) * 360 - 90;

  /* Calculate arc length as fraction of full circle */
  let arcFraction = (window.sleepDuration / 24);
  if (arcFraction > 0.5) arcFraction = 0.5;
  const arcLength = c * arcFraction;
  const arcOffset = c - arcLength;

  /* Hour markers for the 24h clock */
  const hourMarkers = [0, 6, 12, 18].map(h => {
    const angle = ((h / 24) * 360 - 90) * (Math.PI / 180);
    const mx = cx + (r + 8) * Math.cos(angle);
    const my = cy + (r + 8) * Math.sin(angle);
    const labels = ["12A", "6A", "12P", "6P"];
    return { x: mx, y: my, label: labels[[0, 6, 12, 18].indexOf(h)] };
  });

  /* Current time indicator */
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const nowAngle = ((currentHour / 24) * 360 - 90) * (Math.PI / 180);
  const nowX = cx + r * Math.cos(nowAngle);
  const nowY = cy + r * Math.sin(nowAngle);

  /* Urgency badge */
  const urgencyMeta = {
    now: { label: "SHUTDOWN NOW", icon: "\u{1F6D1}", bg: `${W.rose}20`, border: `${W.rose}40` },
    soon: { label: "WIND DOWN", icon: "\u{1F319}", bg: `${W.gold}18`, border: `${W.gold}35` },
    later: { label: "SCHEDULED", icon: "\u{1F554}", bg: `${W.violet}15`, border: `${W.violet}30` },
    optimal: { label: "ON TRACK", icon: "\u2728", bg: `${W.indigo}12`, border: `${W.indigo}25` },
  };
  const badge = urgencyMeta[window.urgency];

  return (
    <div
      className="relative flex flex-col items-center"
      style={{ animation: "recoveryWindowFadeIn 0.6s ease both 0.2s" }}
    >
      {/* Urgency Badge + Countdown */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{
            background: badge.bg,
            border: `1px solid ${badge.border}`,
          }}
        >
          <span className="text-[10px]">{badge.icon}</span>
          <span
            className="text-[9px] font-bold tracking-[0.12em]"
            style={{ color: window.arcColor }}
          >
            {badge.label}
          </span>
        </div>
        {/* Live countdown */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full"
          style={{
            background: "rgba(232,224,216,0.04)",
            border: "1px solid rgba(232,224,216,0.08)",
          }}
        >
          <span className="text-[9px]">⏱</span>
          <span
            className="text-[9px] font-bold font-mono tabular-nums"
            style={{ color: window.urgency === "now" ? W.rose : W.textSecondary }}
          >
            {window.countdownLabel}
          </span>
        </div>
        {/* SpO2 impact indicator */}
        {window.spo2Impact && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
            style={{ background: `${W.sky}12`, border: `1px solid ${W.sky}20` }}
          >
            <span className="text-[8px]">🩸</span>
            <span className="text-[7px] font-bold" style={{ color: W.sky }}>SpO2</span>
          </div>
        )}
      </div>

      {/* 24h Clock with Shutdown Arc */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          {/* Background track — 24h clock */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(232,224,216,0.04)"
            strokeWidth="6"
          />

          {/* Subtle hour ticks */}
          {Array.from({ length: 24 }, (_, i) => {
            const angle = ((i / 24) * 360 - 90) * (Math.PI / 180);
            const inner = r - (i % 6 === 0 ? 5 : 2);
            const outer = r + (i % 6 === 0 ? 2 : 0);
            return (
              <line
                key={i}
                x1={cx + inner * Math.cos(angle)}
                y1={cy + inner * Math.sin(angle)}
                x2={cx + outer * Math.cos(angle)}
                y2={cy + outer * Math.sin(angle)}
                stroke={i % 6 === 0 ? "rgba(232,224,216,0.15)" : "rgba(232,224,216,0.06)"}
                strokeWidth={i % 6 === 0 ? 1.5 : 0.8}
                strokeLinecap="round"
              />
            );
          })}

          {/* Shutdown Arc — the recommended sleep window */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={window.arcColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${c - arcLength}`}
            strokeDashoffset={-((window.bedtimeHour % 24) / 24) * c + c * 0.25}
            style={{
              animation: "shutdownArcPulse 3s ease-in-out infinite",
              transition: "stroke-dasharray 1.5s cubic-bezier(0.4,0,0.2,1), stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)",
            }}
            transform={`rotate(0 ${cx} ${cy})`}
          />

          {/* Inner glow ring */}
          <circle
            cx={cx} cy={cy} r={r - 3}
            fill="none"
            stroke={window.arcColor}
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray={`${arcLength * 0.85} ${c - arcLength * 0.85}`}
            strokeDashoffset={-((window.bedtimeHour % 24) / 24) * c + c * 0.25}
            opacity="0.2"
          />

          {/* Hour labels */}
          {hourMarkers.map((m) => (
            <text
              key={m.label}
              x={m.x} y={m.y}
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontSize: 7,
                fontFamily: "monospace",
                fontWeight: 600,
                fill: "rgba(232,224,216,0.25)",
              }}
            >
              {m.label}
            </text>
          ))}

          {/* Current time dot */}
          <circle
            cx={nowX} cy={nowY} r="3.5"
            fill={W.terra}
            stroke="rgba(26,24,22,0.8)"
            strokeWidth="1.5"
          >
            <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Center info */}
          <text
            x={cx} y={cy - 8}
            textAnchor="middle"
            style={{ fontSize: 16, fontWeight: 900, fill: window.arcColor, fontFamily: "system-ui" }}
          >
            {window.sleepDuration}h
          </text>
          <text
            x={cx} y={cy + 5}
            textAnchor="middle"
            style={{ fontSize: 7, fontWeight: 700, fill: W.textDim, letterSpacing: "0.1em", fontFamily: "monospace" }}
          >
            RECOVERY
          </text>
          <text
            x={cx} y={cy + 16}
            textAnchor="middle"
            style={{ fontSize: 7, fontWeight: 600, fill: "rgba(232,224,216,0.3)", fontFamily: "monospace" }}
          >
            {window.confidence}% conf
          </text>
        </svg>
      </div>

      {/* Time Labels */}
      <div className="flex items-center justify-between w-full mt-1.5 px-1">
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-mono tracking-wider" style={{ color: W.textDim }}>SLEEP</span>
          <span className="text-[12px] font-bold font-mono tabular-nums" style={{ color: window.arcColor }}>
            {window.bedtimeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-px" style={{ background: `${window.arcColor}30` }} />
          <span className="text-[9px]">{"\uD83C\uDF19"}</span>
          <div className="w-6 h-px" style={{ background: `${window.arcColor}30` }} />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[8px] font-mono tracking-wider" style={{ color: W.textDim }}>WAKE</span>
          <span className="text-[12px] font-bold font-mono tabular-nums" style={{ color: W.sage }}>
            {window.wakeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  Recovery Window Card                                         */
/*  Wraps the ShutdownArc with vitals context and advisory       */
/* ══════════════════════════════════════════════════════════════ */

function RecoveryWindowCard({ vitals }: { vitals: { hr: number; stress: number; recovery: number; spo2: number } }) {
  const [expanded, setExpanded] = useState(true);

  const window = useMemo(
    () => calculateRecoveryWindow(vitals.hr, vitals.stress, vitals.recovery, vitals.spo2),
    [vitals.hr, vitals.stress, vitals.recovery, vitals.spo2]
  );

  /* Broadcast recovery window for HUDProtocolRing overlay */
  useEffect(() => {
    globalThis.dispatchEvent(
      new CustomEvent("vive-recovery-window", {
        detail: {
          bedtimeHour: window.bedtimeHour,
          wakeHour: window.wakeHour,
          sleepDuration: window.sleepDuration,
          urgency: window.urgency,
          arcColor: window.arcColor,
          glowColor: window.glowColor,
          countdownLabel: window.countdownLabel,
          windDownMinutes: window.windDownMinutes,
          circadianPressure: window.circadianPressure,
          spo2Impact: window.spo2Impact,
          confidence: window.confidence,
        },
      })
    );
  }, [window]);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: W.sandFaint,
        border: `1px solid ${window.arcColor}20`,
      }}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${window.arcColor}15`, border: `1px solid ${window.arcColor}25` }}
        >
          <span className="text-sm">{"\uD83C\uDF19"}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold" style={{ color: W.textPrimary }}>
              Recovery Window
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
              style={{
                background: `${window.arcColor}18`,
                color: window.arcColor,
                border: `1px solid ${window.arcColor}30`,
              }}
            >
              {window.bedtimeLabel}
            </span>
          </div>
          <span className="text-[9px]" style={{ color: W.textDim }}>
            Optimal shutdown prediction based on real-time vitals
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={W.textDim} strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3" style={{ animation: "forecastSlideIn 0.3s ease both" }}>
          {/* Shutdown Arc Visualizer */}
          <ShutdownArc window={window} />

          {/* Live Vitals Driving the Prediction */}
          <div
            className="grid grid-cols-4 gap-1.5 mt-3 px-1"
            style={{ animation: "recoveryWindowFadeIn 0.5s ease both 0.3s" }}
          >
            {[
              { label: "HR", value: `${vitals.hr}`, unit: "bpm", color: vitals.hr > 85 ? W.rose : W.terra },
              { label: "STRESS", value: `${vitals.stress}`, unit: "%", color: vitals.stress > 60 ? W.rose : vitals.stress > 40 ? W.gold : W.sage },
              { label: "RECOV", value: `${vitals.recovery}`, unit: "%", color: vitals.recovery < 60 ? W.rose : vitals.recovery < 75 ? W.gold : W.sage },
              { label: "SpO2", value: `${vitals.spo2}`, unit: "%", color: vitals.spo2 < 96 ? W.gold : W.sky },
            ].map((m) => (
              <div key={m.label} className="flex flex-col items-center py-1.5 rounded-lg" style={{ background: `${m.color}08` }}>
                <span className="text-[7px] font-mono tracking-[0.1em] font-semibold" style={{ color: W.textDim }}>{m.label}</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[13px] font-black tabular-nums" style={{ color: m.color }}>{m.value}</span>
                  <span className="text-[7px] font-mono" style={{ color: `${m.color}70` }}>{m.unit}</span>
                </div>
              </div>
            ))}
          </div>

      {/* Wind-down progress bar */}
      {window.windDownMinutes > 0 && window.windDownMinutes <= 90 && (
        <div
          className="mt-2.5 px-2.5 py-2 rounded-lg"
          style={{
            background: `${W.violet}08`,
            border: `1px solid ${W.violet}15`,
            animation: "recoveryWindowFadeIn 0.5s ease both 0.35s",
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px]">🌙</span>
              <span className="text-[9px] font-bold" style={{ color: W.violet }}>Wind-Down Phase</span>
            </div>
            <span className="text-[8px] font-mono font-bold tabular-nums" style={{ color: W.textDim }}>
              {window.windDownMinutes}min
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(232,224,216,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(5, 100 - (window.windDownMinutes / 90) * 100)}%`,
                background: `linear-gradient(90deg, ${W.violet}, ${W.indigo})`,
                boxShadow: `0 0 8px ${W.violet}40`,
              }}
            />
          </div>
        </div>
      )}

      {/* Advisory */}
      <div
        className="mt-2.5 px-2.5 py-2 rounded-lg"
        style={{
          background: `${window.arcColor}06`,
          border: `1px solid ${window.arcColor}12`,
          animation: "recoveryWindowFadeIn 0.5s ease both 0.4s",
        }}
      >
        <p className="text-[10px] leading-relaxed" style={{ color: W.textSecondary }}>
          {window.advisory}
        </p>
      </div>
        </div>
      )}
    </div>
  );
}

/* ── Forecast Ring ── */
function ForecastRing({ projected, current }: { projected: number; current: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, projected));
  const offset = c - (pct / 100) * c;
  const delta = projected - current;
  const ringColor = delta >= 5 ? W.sage : delta >= 0 ? W.sky : delta >= -5 ? W.gold : W.rose;
  const glowColor = delta >= 5 ? "rgba(124,182,142,0.3)" : delta >= 0 ? "rgba(107,163,190,0.3)" : delta >= -5 ? "rgba(196,164,108,0.3)" : "rgba(212,132,122,0.3)";

  return (
    <div className="relative" style={{ width: 92, height: 92 }}>
      <svg viewBox="0 0 92 92" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(232,224,216,0.06)" strokeWidth="5" />
        <circle
          cx="46" cy="46" r={r} fill="none" stroke={ringColor} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1), stroke 0.5s",
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums" style={{ color: ringColor, textShadow: `0 0 10px ${glowColor}` }}>
          {projected}
        </span>
        <span className="text-[8px] font-semibold tracking-wider" style={{ color: W.textDim }}>
          PROJECTED
        </span>
      </div>
    </div>
  );
}

/* ── Mini Sparkline ── */
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={parseFloat(points.split(" ").pop()!.split(",")[0])} cy={parseFloat(points.split(" ").pop()!.split(",")[1])} r="2.5" fill={color} opacity="0.9" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  90-Day Split Path — Biological Drift vs Optimized Trajectory */
/* ══════════════════════════════════════════════════════════════ */

interface SplitPathData {
  day: number;
  drift: number;
  optimized: number;
}

function compute90DaySplitPath(
  currentScore: number,
  avgCompliance: number,
): { path: SplitPathData[]; agingScore: number; gapAt90: number; driftLabel: string } {
  const path: SplitPathData[] = [];
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  /* Drift: continues at current compliance (with decay if < 60%) */
  /* Optimized: 100% compliance with compounding improvement */
  let driftVal = currentScore;
  let optVal = currentScore;
  const dailyOptGain = 0.18; // ~0.18 pts/day at 100%
  const complianceFactor = avgCompliance / 100;
  const decayRate = complianceFactor < 0.6 ? 0.08 * (1 - complianceFactor) : 0;

  for (let d = 0; d <= 90; d++) {
    path.push({ day: d, drift: Math.round(driftVal * 10) / 10, optimized: Math.round(optVal * 10) / 10 });
    if (d < 90) {
      /* Drift trajectory: gains proportional to compliance, minus decay */
      const driftGain = dailyOptGain * complianceFactor * Math.max(0.3, (100 - driftVal) / 100);
      driftVal = clamp(driftVal + driftGain - decayRate);
      /* Add subtle noise */
      driftVal += Math.sin(d * 0.7) * 0.15;
      driftVal = clamp(driftVal);

      /* Optimized trajectory: full compliance, diminishing returns near 100 */
      const optGain = dailyOptGain * Math.max(0.2, (100 - optVal) / 100);
      optVal = clamp(optVal + optGain);
    }
  }

  const gapAt90 = path[90].optimized - path[90].drift;
  /* Accelerated Aging Score: 0-100, increases as gap widens */
  /* Based on the area between curves normalized to max possible area */
  let areaGap = 0;
  for (let i = 1; i <= 90; i++) {
    areaGap += Math.max(0, path[i].optimized - path[i].drift);
  }
  const maxPossibleArea = 90 * 50; // theoretical max gap
  const agingScore = Math.min(100, Math.round((areaGap / maxPossibleArea) * 100));

  const driftLabel = complianceFactor >= 0.85 ? "Minimal Drift" :
    complianceFactor >= 0.65 ? "Moderate Drift" :
    complianceFactor >= 0.4 ? "Significant Drift" : "Critical Drift";

  return { path, agingScore, gapAt90: Math.round(gapAt90 * 10) / 10, driftLabel };
}

function SplitPathChart({ data, agingScore, gapAt90, driftLabel }: {
  data: SplitPathData[];
  agingScore: number;
  gapAt90: number;
  driftLabel: string;
}) {
  const W_CHART = 320;
  const H_CHART = 140;
  const PAD = { top: 12, right: 12, bottom: 22, left: 32 };
  const plotW = W_CHART - PAD.left - PAD.right;
  const plotH = H_CHART - PAD.top - PAD.bottom;

  const allVals = data.flatMap(d => [d.drift, d.optimized]);
  const minV = Math.floor(Math.min(...allVals) - 2);
  const maxV = Math.ceil(Math.max(...allVals) + 2);
  const rangeV = maxV - minV || 1;

  const toX = (day: number) => PAD.left + (day / 90) * plotW;
  const toY = (val: number) => PAD.top + plotH - ((val - minV) / rangeV) * plotH;

  const driftPoints = data.map(d => `${toX(d.day)},${toY(d.drift)}`).join(" ");
  const optPoints = data.map(d => `${toX(d.day)},${toY(d.optimized)}`).join(" ");

  /* Fill area between curves */
  const fillPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(d.day)},${toY(d.optimized)}`).join(" ")
    + data.slice().reverse().map((d) => `L${toX(d.day)},${toY(d.drift)}`).join(" ") + "Z";

  /* Aging color: green → amber → red */
  const agingColor = agingScore <= 20 ? W.sage : agingScore <= 45 ? W.gold : agingScore <= 70 ? W.terra : W.rose;
  const agingGlow = agingScore <= 20 ? "rgba(124,182,142,0.3)" : agingScore <= 45 ? "rgba(196,164,108,0.3)" : agingScore <= 70 ? "rgba(232,151,108,0.3)" : "rgba(212,132,122,0.4)";

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: W.sandFaint,
        border: `1px solid ${agingColor}20`,
        animation: "recoveryWindowFadeIn 0.6s ease both 0.1s",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: `${W.indigo}15`, border: `1px solid ${W.indigo}25` }}
          >
            <span className="text-[11px]">🧬</span>
          </div>
          <div>
            <span className="text-[11px] font-bold" style={{ color: W.textPrimary }}>90-Day Split Path</span>
            <p className="text-[8px]" style={{ color: W.textDim }}>Biological Drift vs Optimized Trajectory</p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{ background: `${agingColor}15`, border: `1px solid ${agingColor}30` }}
        >
          <span className="text-[8px]">⏳</span>
          <span className="text-[9px] font-bold" style={{ color: agingColor }}>{driftLabel}</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="px-2 pb-1">
        <svg viewBox={`0 0 ${W_CHART} ${H_CHART}`} className="w-full" style={{ height: 140 }}>
          <defs>
            <linearGradient id="splitGapFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={W.indigo} stopOpacity="0.12" />
              <stop offset="100%" stopColor={W.rose} stopOpacity="0.04" />
            </linearGradient>
            <filter id="optGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {[0, 30, 60, 90].map(d => (
            <line key={`g${d}`} x1={toX(d)} y1={PAD.top} x2={toX(d)} y2={PAD.top + plotH}
              stroke="rgba(232,224,216,0.06)" strokeWidth="0.5" strokeDasharray="2,3" />
          ))}
          {Array.from({ length: 4 }, (_, i) => {
            const v = minV + (rangeV / 3) * i;
            return (
              <g key={`yl${i}`}>
                <line x1={PAD.left} y1={toY(v)} x2={PAD.left + plotW} y2={toY(v)}
                  stroke="rgba(232,224,216,0.04)" strokeWidth="0.5" />
                <text x={PAD.left - 4} y={toY(v)} textAnchor="end" dominantBaseline="central"
                  style={{ fontSize: 7, fill: "rgba(232,224,216,0.25)", fontFamily: "monospace" }}>
                  {Math.round(v)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {[0, 30, 60, 90].map(d => (
            <text key={`xl${d}`} x={toX(d)} y={H_CHART - 4} textAnchor="middle"
              style={{ fontSize: 7, fill: "rgba(232,224,216,0.3)", fontFamily: "monospace" }}>
              {d === 0 ? "Now" : `D${d}`}
            </text>
          ))}

          {/* Gap fill */}
          <path d={fillPath} fill="url(#splitGapFill)" />

          {/* Drift line (solid) */}
          <polyline points={driftPoints} fill="none" stroke={W.terra} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />

          {/* Optimized line (glowing dotted) */}
          <polyline points={optPoints} fill="none" stroke={W.indigo} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3"
            filter="url(#optGlow)" opacity="0.9" />

          {/* End markers */}
          <circle cx={toX(90)} cy={toY(data[90].drift)} r="3" fill={W.terra} stroke="rgba(26,24,22,0.6)" strokeWidth="1" />
          <circle cx={toX(90)} cy={toY(data[90].optimized)} r="3" fill={W.indigo} stroke="rgba(26,24,22,0.6)" strokeWidth="1">
            <animate attributeName="r" values="3;4.5;3" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Gap annotation at day 90 */}
          <line x1={toX(90) + 6} y1={toY(data[90].optimized)} x2={toX(90) + 6} y2={toY(data[90].drift)}
            stroke={W.rose} strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
        </svg>
      </div>

      {/* Legend + Aging Score */}
      <div className="px-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-full" style={{ background: W.terra }} />
              <span className="text-[8px] font-semibold" style={{ color: W.textDim }}>Current Drift</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded-full" style={{ background: W.indigo, boxShadow: `0 0 4px ${W.indigo}` }} />
              <span className="text-[8px] font-semibold" style={{ color: W.textDim }}>Optimized Path</span>
            </div>
          </div>
          <span className="text-[9px] font-bold tabular-nums" style={{ color: W.rose }}>
            \u0394 {gapAt90} pts
          </span>
        </div>

        {/* Accelerated Aging Score */}
        <div
          className="rounded-lg px-3 py-2.5"
          style={{ background: `${agingColor}08`, border: `1px solid ${agingColor}15` }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">{"\u{1F9D3}"}</span>
              <span className="text-[10px] font-bold" style={{ color: agingColor }}>Accelerated Aging Index</span>
            </div>
            <span
              className="text-[14px] font-black tabular-nums"
              style={{ color: agingColor, textShadow: `0 0 8px ${agingGlow}` }}
            >
              {agingScore}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(232,224,216,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${agingScore}%`,
                background: `linear-gradient(90deg, ${W.sage}, ${agingColor})`,
                boxShadow: `0 0 6px ${agingGlow}`,
              }}
            />
          </div>
          <p className="text-[9px] leading-relaxed" style={{ color: W.textSecondary }}>
            {agingScore <= 20
              ? "Minimal biological drift. Your protocols are keeping you on the optimized aging curve."
              : agingScore <= 45
                ? "Moderate drift detected. Closing the compliance gap could recover 2-4 years of biological age over 90 days."
                : agingScore <= 70
                  ? "Significant drift. Each missed protocol compounds aging acceleration. The gap widens daily without intervention."
                  : "Critical aging acceleration. Your current trajectory diverges sharply from your biological potential. Immediate protocol adherence is essential."}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  BioForecast — 30-Day Outlook + Recovery Window               */
/* ══════════════════════════════════════════════════════════════ */
export function BioForecast({ sessionId }: { sessionId: string }) {
  const [expandedProtocol, setExpandedProtocol] = useState<string | null>(null);
  const [pulseActive, setPulseActive] = useState(true);

  /* ── Pull real-time vitals from useSimulatedVitals ── */
  const vitals = useSimulatedVitals();

  useEffect(() => {
    const t = setInterval(() => setPulseActive((p) => !p), 3000);
    return () => clearInterval(t);
  }, []);

  const velocityData = useQuery(api.logs.getBiomarkerVelocity30d, sessionId ? { sessionId } : "skip");
  const scores14d = useQuery(api.queries.getVitalityScores14d, sessionId ? { sessionId } : "skip");
  const adherenceData = useQuery(api.correlationEngine.getProtocolAdherenceHistory, sessionId ? { sessionId, days: 14 } : "skip");

  /* ── 30-day projection via linear regression ── */
  const projection = useMemo(() => {
    if (!velocityData?.dailyData || velocityData.dailyData.length < 3) return null;
    const pts = velocityData.dailyData
      .filter((d) => d.avgScore != null)
      .map((d, i) => ({ x: i, y: d.avgScore! }));
    if (pts.length < 3) return null;

    const n = pts.length;
    const sumX = pts.reduce((s, p) => s + p.x, 0);
    const sumY = pts.reduce((s, p) => s + p.y, 0);
    const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const projected30 = Math.max(0, Math.min(100, Math.round(intercept + slope * (n + 30))));
    const projected7 = Math.max(0, Math.min(100, Math.round(intercept + slope * (n + 7))));
    const current = Math.round(pts[pts.length - 1].y);
    const delta30 = projected30 - current;
    const delta7 = projected7 - current;
    const trajectory = slope > 0.3 ? "accelerating" : slope > 0 ? "climbing" : slope > -0.3 ? "plateauing" : "declining";

    return { projected30, projected7, current, delta30, delta7, slope, trajectory };
  }, [velocityData]);

  /* ── Score sparkline data ── */
  const scoreHistory = useMemo(() => {
    if (!velocityData?.dailyData) return [];
    return velocityData.dailyData
      .filter((d) => d.avgScore != null)
      .map((d) => d.avgScore!);
  }, [velocityData]);

  /* ── Adherence sparkline ── */
  const adherenceHistory = useMemo(() => {
    if (!velocityData?.dailyData) return [];
    return velocityData.dailyData
      .filter((d) => d.avgAdherence != null)
      .map((d) => d.avgAdherence!);
  }, [velocityData]);

  /* ── Wellness trend ── */
  const wellnessTrend = useMemo<TrendResult>(() => {
    if (!scores14d || scores14d.length < 2) {
      return { deltaPct: 0, deltaAbs: 0, delta: 0, percentage: 0, direction: "flat" as const, label: "—", color: W.gold, isFavorable: true };
    }
    const vals = scores14d.map((s) => s.score);
    return calculateTrend(vals[vals.length - 1], vals.slice(0, -1), true);
  }, [scores14d]);

  /* ── Lab composite score ── */
  const labComposite = useMemo(() => {
    return calculateLabComposite(velocityData?.bioVault ?? null);
  }, [velocityData]);

  /* ── Correction protocols ── */
  const corrections = useMemo(() => {
    return getCorrectionProtocols(velocityData?.bioVault ?? null);
  }, [velocityData]);

  /* ── 90-Day Split Path computation ── */
  const splitPath = useMemo(() => {
    const currentScore = projection?.current ?? 50;
    const avgComp = adherenceData?.avgDailyRate ?? (projection ? Math.round(50 + projection.slope * 10) : 50);
    return compute90DaySplitPath(currentScore, avgComp);
  }, [projection, adherenceData]);

  /* ── Outlook message ── */
  const outlookMessage = useMemo(() => {
    if (!projection) return "Log consistently for 3+ days to unlock your 30-day forecast.";
    if (projection.trajectory === "accelerating") return "Your biology is responding powerfully. This trajectory puts you in the top tier within 30 days.";
    if (projection.trajectory === "climbing") return "Steady upward momentum. Maintain your current protocols to reach your projected score.";
    if (projection.trajectory === "plateauing") return "You have hit a plateau. Review your correction protocols below to reignite progress.";
    return "Downward trend detected. Prioritize the correction protocols below to reverse course.";
  }, [projection]);

  const isLoading = velocityData === undefined;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: W.cardBg,
        border: `1px solid ${W.cardBorder}`,
        backdropFilter: "blur(20px)",
        animation: pulseActive ? "bioForecastPulse 3s ease-in-out infinite" : "none",
      }}
    >
      <style>{PULSE_STYLE}</style>

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center relative"
              style={{ background: `${W.sky}15`, border: `1px solid ${W.sky}25` }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={W.sky} strokeWidth="2" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <div
                className="absolute inset-0 rounded-lg"
                style={{ animation: "bioForecastGlow 3s ease-in-out infinite", background: `${W.sky}08` }}
              />
            </div>
            <div>
              <h3 className="text-[13px] font-bold tracking-tight" style={{ color: W.textPrimary }}>
                30-Day Outlook
              </h3>
              <p className="text-[10px]" style={{ color: W.textDim }}>
                Predictive Wellness Trajectory
              </p>
            </div>
          </div>
          {wellnessTrend.direction !== "flat" && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: `${wellnessTrend.color}18`,
                color: wellnessTrend.color,
                border: `1px solid ${wellnessTrend.color}30`,
              }}
            >
              {wellnessTrend.direction === "up" ? "\u2191" : "\u2193"} {wellnessTrend.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${W.sky}40`, borderTopColor: "transparent" }} />
          </div>
        ) : !projection ? (
          /* ── Empty State ── */
          <div className="text-center py-8">
            <div className="text-3xl mb-3">{"\u{1F52E}"}</div>
            <p className="text-[12px] font-semibold mb-1" style={{ color: W.textPrimary }}>Forecast Calibrating</p>
            <p className="text-[10px] leading-relaxed max-w-[240px] mx-auto" style={{ color: W.textDim }}>
              {outlookMessage}
            </p>
          </div>
        ) : (
          <>
            {/* ── Projection Ring + Stats ── */}
            <div className="flex items-center gap-4 mb-4" style={{ animation: "forecastSlideIn 0.5s ease both" }}>
              <ForecastRing projected={projection.projected30} current={projection.current} />
              <div className="flex-1 space-y-2.5">
                {/* Current */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: W.textDim }}>Current</span>
                  <div className="flex items-center gap-2">
                    <MiniSparkline values={scoreHistory.slice(-14)} color={W.sky} />
                    <span className="text-sm font-bold tabular-nums" style={{ color: W.textPrimary }}>{projection.current}</span>
                  </div>
                </div>
                {/* 7-Day */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: W.textDim }}>7-Day</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tabular-nums" style={{ color: projection.delta7 >= 0 ? W.sage : W.rose }}>
                      {projection.projected7}
                    </span>
                    <span className="text-[9px] font-semibold" style={{ color: projection.delta7 >= 0 ? W.sage : W.rose }}>
                      {projection.delta7 >= 0 ? "+" : ""}{projection.delta7}
                    </span>
                  </div>
                </div>
                {/* 30-Day */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: W.textDim }}>30-Day</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tabular-nums" style={{ color: projection.delta30 >= 0 ? W.sage : W.rose }}>
                      {projection.projected30}
                    </span>
                    <span className="text-[9px] font-semibold" style={{ color: projection.delta30 >= 0 ? W.sage : W.rose }}>
                      {projection.delta30 >= 0 ? "+" : ""}{projection.delta30}
                    </span>
                  </div>
                </div>
                {/* Lab Composite */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: W.textDim }}>Lab Score</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(232,224,216,0.08)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${labComposite.score}%`,
                          background: labComposite.score >= 80 ? W.sage : labComposite.score >= 55 ? W.gold : W.rose,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: labComposite.score >= 80 ? W.sage : labComposite.score >= 55 ? W.gold : W.rose }}>
                      {labComposite.score}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Trajectory Label ── */}
            <div
              className="rounded-lg px-3 py-2 mb-3"
              style={{
                background: projection.slope >= 0 ? `${W.sage}08` : `${W.rose}08`,
                border: `1px solid ${projection.slope >= 0 ? `${W.sage}15` : `${W.rose}15`}`,
              }}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold tracking-wide" style={{ color: projection.slope >= 0 ? W.sage : W.rose }}>
                  {projection.trajectory.toUpperCase()}
                </span>
                {adherenceHistory.length > 3 && (
                  <MiniSparkline values={adherenceHistory.slice(-10)} color={W.sage} />
                )}
              </div>
              <p className="text-[10px] leading-relaxed" style={{ color: W.textSecondary }}>
                {outlookMessage}
              </p>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/*  90-DAY SPLIT PATH — Drift vs Optimized             */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="mb-3">
              <SplitPathChart
                data={splitPath.path}
                agingScore={splitPath.agingScore}
                gapAt90={splitPath.gapAt90}
                driftLabel={splitPath.driftLabel}
              />
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/*  RECOVERY WINDOW — Optimal Sleep Prediction         */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="mb-3">
              <RecoveryWindowCard vitals={vitals} />
            </div>

            {/* ── Correction Protocols ── */}
            {corrections.length > 0 && (
              <div className="space-y-2" style={{ animation: "forecastSlideIn 0.6s ease both 0.15s" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={W.terra} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span className="text-[11px] font-bold" style={{ color: W.terra }}>Correction Protocols</span>
                </div>

                {corrections.map((cp) => {
                  const isExpanded = expandedProtocol === cp.marker;
                  return (
                    <button
                      key={cp.marker}
                      onClick={() => setExpandedProtocol(isExpanded ? null : cp.marker)}
                      className="w-full text-left rounded-xl overflow-hidden transition-all duration-300"
                      style={{
                        background: W.sandFaint,
                        border: `1px solid ${cp.color}20`,
                      }}
                    >
                      <div className="flex items-center gap-2.5 px-3 py-2.5">
                        <span className="text-sm">{cp.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold" style={{ color: W.textPrimary }}>{cp.title}</span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
                              style={{
                                background: `${cp.color}18`,
                                color: cp.color,
                                border: `1px solid ${cp.color}30`,
                              }}
                            >
                              {cp.urgency === "high" ? "URGENT" : "MODERATE"}
                            </span>
                          </div>
                          <span className="text-[9px]" style={{ color: W.textDim }}>
                            {cp.marker} \u2022 {cp.status === "poor" ? "Outside safe range" : "Below optimal"}
                          </span>
                        </div>
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={W.textDim} strokeWidth="2" strokeLinecap="round"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>

                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-1.5" style={{ animation: "forecastSlideIn 0.3s ease both" }}>
                          {cp.actions.map((action, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ background: `${cp.color}15`, border: `1px solid ${cp.color}25` }}
                              >
                                <span className="text-[8px] font-bold" style={{ color: cp.color }}>{i + 1}</span>
                              </div>
                              <span className="text-[10px] leading-relaxed" style={{ color: W.textSecondary }}>
                                {action}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Streak Encouragement ── */}
            {corrections.length === 0 && (
              <div
                className="rounded-lg px-3 py-2.5 text-center"
                style={{ background: `${W.sage}08`, border: `1px solid ${W.sage}15` }}
              >
                <div className="text-lg mb-1">\u{2728}</div>
                <p className="text-[11px] font-semibold" style={{ color: W.sage }}>All Markers On Track</p>
                <p className="text-[10px] mt-0.5" style={{ color: W.textSecondary }}>
                  No correction protocols needed. Your consistency is compounding. Keep the streak alive.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default BioForecast;
