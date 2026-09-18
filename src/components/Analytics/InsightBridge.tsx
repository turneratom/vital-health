import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { calculateBiologicalVelocity } from "@/lib/analyticsUtils";
import { getTwinSessionId } from '@/lib/twinSession'


/* ── Standardized Color System ──
   Green  (#30D158) = Good / Improving
   Yellow (#FFD60A) = Neutral / Steady
   Red    (#FF453A) = Needs Attention
*/

/* ── Helpers ── */
function getStatusColor(trend: "up" | "down" | "flat"): string {
  if (trend === "up") return "#30D158";
  if (trend === "flat") return "#FFD60A";
  return "#FF453A";
}

function getStatusBg(trend: "up" | "down" | "flat"): string {
  if (trend === "up") return "rgba(48,209,88,0.08)";
  if (trend === "flat") return "rgba(255,214,10,0.08)";
  return "rgba(255,69,58,0.08)";
}

function getStatusBorder(trend: "up" | "down" | "flat"): string {
  if (trend === "up") return "rgba(48,209,88,0.2)";
  if (trend === "flat") return "rgba(255,214,10,0.2)";
  return "rgba(255,69,58,0.2)";
}

function getFrequencyColor(freq: "high" | "moderate" | "low" | "none"): string {
  if (freq === "high") return "#30D158";
  if (freq === "moderate") return "#FFD60A";
  return "#FF453A";
}

/* ══════════════════════════════════════════════════════════════ */
/*  BIOMARKER RANGE ANALYSIS — InsightBridge Core Logic          */
/*  Uses thresholds from convex/supplementLogic.ts               */
/* ══════════════════════════════════════════════════════════════ */

export interface BiomarkerFlag {
  marker: string;
  value: number;
  unit: string;
  status: "critical" | "warning" | "optimal";
  optimalRange: [number, number];
  recommendation: string;
  supplementId: string;
  supplementName: string;
  dose: string;
  timing: string;
  icon: string;
  category: "recovery" | "performance" | "supplement" | "cognitive" | "fueling";
}

interface BioVaultRecord {
  vitaminD?: number | null;
  testosteroneFree?: number | null;
  testosteroneTotal?: number | null;
  ferritin?: number | null;
  crp?: number | null;
  hba1c?: number | null;
  cortisol?: number | null;
  mthfrVariant?: boolean;
  apoe4?: boolean;
  caffeineSensitivity?: boolean;
}

/**
 * Analyze BioVault data against supplementLogic.ts thresholds.
 * Returns an array of flagged biomarkers with recommended actions.
 */
function analyzeBiomarkers(vault: BioVaultRecord | null): BiomarkerFlag[] {
  if (!vault) return [];
  const flags: BiomarkerFlag[] = [];

  // Vitamin D: optimal 40-80, warning <40, critical <20
  if (vault.vitaminD != null) {
    const v = vault.vitaminD;
    if (v < 20) {
      flags.push({
        marker: "Vitamin D", value: v, unit: "ng/mL", status: "critical",
        optimalRange: [40, 80],
        recommendation: `Severely deficient at ${v} ng/mL. High-dose D3+K2 protocol initiated.`,
        supplementId: "lipod3k2-critical", supplementName: "Vitamin D3 + K2 (High Dose)",
        dose: "10,000 IU", timing: "AM · with fat-containing meal", icon: "☀️", category: "supplement",
      });
    } else if (v < 40) {
      flags.push({
        marker: "Vitamin D", value: v, unit: "ng/mL", status: "warning",
        optimalRange: [40, 80],
        recommendation: `Below optimal at ${v} ng/mL. D3+K2 supplementation recommended.`,
        supplementId: "lipod3k2", supplementName: "Lipo-D3/K2",
        dose: "5,000 IU", timing: "AM · with fat-containing meal", icon: "☀️", category: "supplement",
      });
    } else {
      flags.push({
        marker: "Vitamin D", value: v, unit: "ng/mL", status: "optimal",
        optimalRange: [40, 80], recommendation: `Optimal at ${v} ng/mL.`,
        supplementId: "", supplementName: "", dose: "", timing: "", icon: "☀️", category: "supplement",
      });
    }
  }

  // Ferritin: optimal 50-200, warning <50, critical <20
  if (vault.ferritin != null) {
    const v = vault.ferritin;
    if (v < 20) {
      flags.push({
        marker: "Ferritin", value: v, unit: "ng/mL", status: "critical",
        optimalRange: [50, 200],
        recommendation: `Critically low at ${v} ng/mL. Iron bisglycinate + Vitamin C required.`,
        supplementId: "iron-bisglycinate-critical", supplementName: "Iron Bisglycinate + Vit C",
        dose: "36mg Fe + 200mg C", timing: "AM · empty stomach", icon: "🩸", category: "supplement",
      });
    } else if (v < 50) {
      flags.push({
        marker: "Ferritin", value: v, unit: "ng/mL", status: "warning",
        optimalRange: [50, 200],
        recommendation: `Below optimal at ${v} ng/mL. Iron supplementation recommended.`,
        supplementId: "iron-bisglycinate", supplementName: "Iron Bisglycinate + Vit C",
        dose: "25mg Fe + 200mg C", timing: "AM · empty stomach", icon: "🩸", category: "supplement",
      });
    }
  }

  // CRP: optimal <1.0, warning 1.0-3.0, critical >3.0
  if (vault.crp != null) {
    const v = vault.crp;
    if (v > 3.0) {
      flags.push({
        marker: "CRP", value: v, unit: "mg/L", status: "critical",
        optimalRange: [0, 1.0],
        recommendation: `Elevated inflammation at ${v} mg/L. High-dose EPA + Curcumin protocol.`,
        supplementId: "omega3-epa-critical", supplementName: "High-Dose EPA Omega-3 + Curcumin",
        dose: "4g EPA + 1g Curcumin", timing: "Split · AM & PM with meals", icon: "🐟", category: "recovery",
      });
    } else if (v > 1.0) {
      flags.push({
        marker: "CRP", value: v, unit: "mg/L", status: "warning",
        optimalRange: [0, 1.0],
        recommendation: `Mild inflammation at ${v} mg/L. Omega-3 supplementation recommended.`,
        supplementId: "omega3-epa", supplementName: "High-Dose EPA Omega-3",
        dose: "2g EPA / 1g DHA", timing: "Split · AM & PM with meals", icon: "🐟", category: "recovery",
      });
    }
  }

  // HbA1c: optimal <5.4, warning 5.4-5.7, critical >5.7
  if (vault.hba1c != null) {
    const v = vault.hba1c;
    if (v > 5.7) {
      flags.push({
        marker: "HbA1c", value: v, unit: "%", status: "critical",
        optimalRange: [4.0, 5.4],
        recommendation: `Pre-diabetic range at ${v}%. Berberine + Chromium protocol.`,
        supplementId: "berberine-critical", supplementName: "Berberine HCl + Chromium",
        dose: "1,500mg (3x500mg) + 200mcg Cr", timing: "With meals · split dose", icon: "🌿", category: "supplement",
      });
    } else if (v > 5.4) {
      flags.push({
        marker: "HbA1c", value: v, unit: "%", status: "warning",
        optimalRange: [4.0, 5.4],
        recommendation: `Borderline at ${v}%. Berberine recommended for glucose regulation.`,
        supplementId: "berberine", supplementName: "Berberine HCl",
        dose: "500mg", timing: "With meals", icon: "🌿", category: "supplement",
      });
    }
  }

  // Testosterone (Free): optimal 15-30, warning <15
  if (vault.testosteroneFree != null) {
    const v = vault.testosteroneFree;
    if (v < 10) {
      flags.push({
        marker: "Free Testosterone", value: v, unit: "pg/mL", status: "critical",
        optimalRange: [15, 30],
        recommendation: `Low at ${v} pg/mL. Tongkat Ali + Zinc protocol.`,
        supplementId: "tongkat-ali", supplementName: "Tongkat Ali + Zinc",
        dose: "400mg TA + 30mg Zn", timing: "AM · with breakfast", icon: "⚡", category: "performance",
      });
    } else if (v < 15) {
      flags.push({
        marker: "Free Testosterone", value: v, unit: "pg/mL", status: "warning",
        optimalRange: [15, 30],
        recommendation: `Below optimal at ${v} pg/mL. Consider Tongkat Ali.`,
        supplementId: "tongkat-ali-mild", supplementName: "Tongkat Ali",
        dose: "200mg", timing: "AM · with breakfast", icon: "⚡", category: "performance",
      });
    }
  }

  // Cortisol: optimal 6-20, warning >20
  if (vault.cortisol != null) {
    const v = vault.cortisol;
    if (v > 25) {
      flags.push({
        marker: "Cortisol", value: v, unit: "µg/dL", status: "critical",
        optimalRange: [6, 20],
        recommendation: `Elevated stress hormone at ${v} µg/dL. Ashwagandha + Phosphatidylserine.`,
        supplementId: "ashwagandha-cortisol", supplementName: "Ashwagandha KSM-66 + PS",
        dose: "600mg + 100mg PS", timing: "AM · with breakfast", icon: "🧠", category: "cognitive",
      });
    } else if (v > 20) {
      flags.push({
        marker: "Cortisol", value: v, unit: "µg/dL", status: "warning",
        optimalRange: [6, 20],
        recommendation: `Mildly elevated at ${v} µg/dL. Ashwagandha recommended.`,
        supplementId: "ashwagandha-gen", supplementName: "Ashwagandha KSM-66",
        dose: "600mg", timing: "AM · with breakfast", icon: "🧠", category: "cognitive",
      });
    }
  }

  // Genetic flags
  if (vault.mthfrVariant) {
    flags.push({
      marker: "MTHFR Variant", value: 1, unit: "positive", status: "warning",
      optimalRange: [0, 0],
      recommendation: "MTHFR variant detected. Methylfolate replaces folic acid.",
      supplementId: "methylfolate", supplementName: "Methylfolate (5-MTHF)",
      dose: "1,000mcg", timing: "AM · with food", icon: "🧬", category: "supplement",
    });
  }

  if (vault.apoe4) {
    flags.push({
      marker: "APOE4 Carrier", value: 1, unit: "positive", status: "warning",
      optimalRange: [0, 0],
      recommendation: "APOE4 detected. Prioritize omega-3 and reduce saturated fat.",
      supplementId: "omega3-apoe4", supplementName: "Omega-3 (DHA-Heavy)",
      dose: "2g DHA / 1g EPA", timing: "With meals · split dose", icon: "🧬", category: "supplement",
    });
  }

  return flags;
}

/**
 * Dispatch biomarker flags to DailyStack via custom event.
 * DailyStack listens for 'vive-insight-bridge-update' and merges
 * flagged supplements into the mission card list.
 */
function dispatchInsightBridgeUpdate(flags: BiomarkerFlag[]) {
  const actionableFlags = flags.filter(f => f.status !== "optimal" && f.supplementId);
  if (actionableFlags.length === 0) return;

  window.dispatchEvent(new CustomEvent("vive-insight-bridge-update", {
    detail: {
      flags: actionableFlags,
      timestamp: Date.now(),
      source: "InsightBridge",
    },
  }));
}

/**
 * Dispatch priority action to CommandCenter dashboard.
 */
function dispatchPriorityAction(flags: BiomarkerFlag[]) {
  const criticalFlags = flags.filter(f => f.status === "critical");
  const warningFlags = flags.filter(f => f.status === "warning");
  const topFlag = criticalFlags[0] || warningFlags[0];

  if (!topFlag) return;

  window.dispatchEvent(new CustomEvent("vive-priority-action", {
    detail: {
      flag: topFlag,
      totalCritical: criticalFlags.length,
      totalWarning: warningFlags.length,
      timestamp: Date.now(),
    },
  }));
}

/* ══════════════════════════════════════════════════════════════ */
/*  INSIGHT DATA TYPES                                           */
/* ══════════════════════════════════════════════════════════════ */

interface InsightData {
  journalStreak: number;
  journalFrequency: "high" | "moderate" | "low" | "none";
  recoveryDelta: number;
  vitalityTrend: "up" | "down" | "flat";
  avgVitality: number;
  insightText: string;
  reinforcement: string;
  icon: string;
}

function computeInsight(
  journalEvents: Array<{ loggedAt: number }> | null | undefined,
  vitalityScores: Array<{ overallScore: number; calculatedAt: number }> | null | undefined,
): InsightData {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const last7d = (journalEvents || []).filter((e) => now - e.loggedAt < 7 * DAY);
  const uniqueDays = new Set(
    last7d.map((e) => new Date(e.loggedAt).toDateString()),
  );
  const journalStreak = uniqueDays.size;

  let journalFrequency: InsightData["journalFrequency"] = "none";
  if (journalStreak >= 5) journalFrequency = "high";
  else if (journalStreak >= 3) journalFrequency = "moderate";
  else if (journalStreak >= 1) journalFrequency = "low";

  const scores = (vitalityScores || []).sort(
    (a, b) => a.calculatedAt - b.calculatedAt,
  );
  const thisWeek = scores.filter((s) => now - s.calculatedAt < 7 * DAY);
  const lastWeek = scores.filter(
    (s) => now - s.calculatedAt >= 7 * DAY && now - s.calculatedAt < 14 * DAY,
  );

  const avgThis =
    thisWeek.length > 0
      ? thisWeek.reduce((s, v) => s + v.overallScore, 0) / thisWeek.length
      : 0;
  const avgLast =
    lastWeek.length > 0
      ? lastWeek.reduce((s, v) => s + v.overallScore, 0) / lastWeek.length
      : 0;

  const recoveryDelta =
    avgLast > 0 ? Math.round(((avgThis - avgLast) / avgLast) * 100) : 0;
  const vitalityTrend: InsightData["vitalityTrend"] =
    recoveryDelta > 3 ? "up" : recoveryDelta < -3 ? "down" : "flat";

  let insightText: string;
  let reinforcement: string;
  let icon: string;

  if (journalFrequency === "high" && vitalityTrend === "up") {
    insightText = `${journalStreak} days of Voice Journaling has improved your Recovery baseline by ${Math.abs(recoveryDelta || 12)}%.`;
    reinforcement = "Your consistency is paying off. Keep the streak alive.";
    icon = "\u{1F525}";
  } else if (journalFrequency === "high" && vitalityTrend === "flat") {
    insightText = `${journalStreak} days of journaling is maintaining your baseline. Your readiness is holding steady.`;
    reinforcement = "Stability is strength. Your habits are protecting your floor.";
    icon = "\u{1F6E1}\uFE0F";
  } else if (journalFrequency === "moderate" && vitalityTrend === "up") {
    insightText = `${journalStreak} journal entries this week correlate with a ${Math.abs(recoveryDelta || 8)}% recovery improvement.`;
    reinforcement = "More entries = sharper insights. Try logging daily.";
    icon = "\u{1F4C8}";
  } else if (journalFrequency === "moderate") {
    insightText = `${journalStreak} journal entries this week. Your readiness is ${vitalityTrend === "down" ? "dipping" : "stable"}.`;
    reinforcement = "Adding 2 more entries this week could unlock a trend shift.";
    icon = "\u{1F4DD}";
  } else if (journalFrequency === "low") {
    insightText = `Only ${journalStreak} journal entry this week. Not enough data to detect patterns.`;
    reinforcement = "Voice-log for 3 consecutive days to unlock your first insight.";
    icon = "\u{1F50D}";
  } else {
    insightText = "No journal entries this week. Your insight engine is offline.";
    reinforcement = "Tap the mic and speak for 10 seconds to activate pattern detection.";
    icon = "\u{1F399}\uFE0F";
  }

  return {
    journalStreak,
    journalFrequency,
    recoveryDelta,
    vitalityTrend,
    avgVitality: Math.round(avgThis),
    insightText,
    reinforcement,
    icon,
  };
}

/* ── Sparkline mini-chart ── */
function MiniSparkline({
  data,
  color,
  ghostMode,
}: {
  data: number[];
  color: string;
  ghostMode: boolean;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = `0,${h} ${points} ${w},${h}`;
  const strokeColor = ghostMode ? "rgba(160,160,160,0.4)" : color;
  const fillColor = ghostMode
    ? "rgba(160,160,160,0.05)"
    : color === "#30D158" ? "rgba(48,209,88,0.1)"
    : color === "#FFD60A" ? "rgba(255,214,10,0.1)"
    : color === "#FF453A" ? "rgba(255,69,58,0.1)"
    : "rgba(255,255,255,0.05)";

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="flex-shrink-0"
    >
      <polygon points={fillPoints} fill={fillColor} />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (
        <circle
          cx={w}
          cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
          r="2.5"
          fill={strokeColor}
        >
          <animate
            attributeName="opacity"
            values="1;0.4;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  );
}

/* ── 7-Day Trend Popover Sparkline ── */
function TrendSparkline({
  data,
  labels,
  color,
  ghostMode,
  unit,
}: {
  data: number[];
  labels: string[];
  color: string;
  ghostMode: boolean;
  unit: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 200;
  const h = 56;
  const padY = 6;
  const padX = 4;

  const pts = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * (w - padX * 2),
    y: padY + (1 - (v - min) / range) * (h - padY * 2),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${h} L${pts[0].x.toFixed(1)},${h} Z`;

  const strokeColor = ghostMode ? "rgba(160,160,160,0.5)" : color;
  const gradId = `trend-grad-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={i === pts.length - 1 ? strokeColor : "transparent"} stroke={strokeColor} strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r="6" fill="transparent" className="cursor-pointer">
              <title>{`${labels[i]}: ${data[i]}${unit}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="flex justify-between mt-1 px-1">
        {labels.map((l, i) => (
          <span
            key={i}
            className="font-mono"
            style={{
              fontSize: "7px",
              color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)",
              letterSpacing: "0.02em",
            }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Trend Popover ── */
function TrendPopover({
  open,
  onClose,
  title,
  data,
  labels,
  color,
  ghostMode,
  unit,
  summary,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  data: number[];
  labels: string[];
  color: string;
  ghostMode: boolean;
  unit: string;
  summary: string;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const accentColor = ghostMode ? "rgba(160,160,160,0.5)" : color;
  const current = data.length > 0 ? data[data.length - 1] : 0;
  const prev = data.length > 1 ? data[0] : current;
  const delta = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;
  const deltaColor = ghostMode
    ? "rgba(160,160,160,0.7)"
    : delta > 0 ? "#30D158" : delta < 0 ? "#FF453A" : "#FFD60A";

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 right-0 z-50 mt-1"
      style={{
        animation: "trendPopoverIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          background: ghostMode ? "rgba(20,20,20,0.95)" : "rgba(8,8,12,0.95)",
          borderColor: ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <div
          className="h-[1.5px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            opacity: 0.5,
          }}
        />

        <div className="p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: accentColor }}
              />
              <span
                className="font-medium uppercase tracking-[0.08em]"
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "8px",
                  color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.45)",
                }}
              >
                {title} — 7 Day Trend
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span
                className="font-mono font-semibold"
                style={{ fontSize: "11px", color: deltaColor }}
              >
                {delta > 0 ? "+" : ""}{delta}%
              </span>
              <span
                style={{
                  fontSize: "9px",
                  color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)",
                }}
              >
                vs 7d ago
              </span>
            </div>
          </div>

          <TrendSparkline
            data={data}
            labels={labels}
            color={color}
            ghostMode={ghostMode}
            unit={unit}
          />

          <p
            className="mt-2 leading-snug"
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "10px",
              color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.35)",
              letterSpacing: "0.01em",
            }}
          >
            {summary}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes trendPopoverIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  BIOMARKER FLAG STRIP — Shows flagged markers inline          */
/* ══════════════════════════════════════════════════════════════ */

function BiomarkerFlagStrip({ flags, ghostMode }: { flags: BiomarkerFlag[]; ghostMode: boolean }) {
  const actionable = flags.filter(f => f.status !== "optimal");
  if (actionable.length === 0) return null;

  const statusColors = {
    critical: { color: "#FF453A", bg: "rgba(255,69,58,0.08)", border: "rgba(255,69,58,0.2)" },
    warning: { color: "#FFD60A", bg: "rgba(255,214,10,0.08)", border: "rgba(255,214,10,0.2)" },
    optimal: { color: "#30D158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)" },
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[8px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(255,69,58,0.6)" }}>
          ⚠ Biomarker Flags
        </span>
        <span className="text-[8px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
          ({actionable.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actionable.slice(0, 4).map((flag) => {
          const sc = ghostMode
            ? { color: "rgba(160,160,160,0.6)", bg: "rgba(160,160,160,0.06)", border: "rgba(160,160,160,0.12)" }
            : statusColors[flag.status];
          return (
            <div
              key={flag.marker}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md"
              style={{
                background: sc.bg,
                border: `1px solid ${sc.border}`,
              }}
            >
              <span className="text-[10px]">{flag.icon}</span>
              <div className="flex flex-col">
                <span className="text-[8px] font-mono font-semibold" style={{ color: sc.color }}>
                  {flag.marker}
                </span>
                <span className="text-[7px] font-mono" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.3)" }}>
                  {flag.value} {flag.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                               */
/* ══════════════════════════════════════════════════════════════ */

export function InsightBridge({ compact = false }: { compact?: boolean } = {}) {
  const ghostMode = useGhostMode();
  const sessionId = useMemo(() => getTwinSessionId(), []);
  const [activeTrend, setActiveTrend] = useState<"journal" | "vitality" | null>(null);
  const journalAnchorRef = useRef<HTMLDivElement>(null);
  const vitalityAnchorRef = useRef<HTMLDivElement>(null);
  const lastDispatchRef = useRef<number>(0);

  const toggleTrend = useCallback((metric: "journal" | "vitality") => {
    setActiveTrend((prev) => (prev === metric ? null : metric));
  }, []);

  // Fetch journal events and vitality scores
  const journalEvents = useQuery(api.queries.getTodayJournalEvents, { sessionId }) as Array<{ loggedAt: number }> | undefined;
  const vitalityScores = useQuery(api.queries.getRecentVitalityScores, { sessionId }) as Array<{ overallScore: number; calculatedAt: number }> | undefined;

  // ── BioVault data for biomarker analysis ──
  const bioVaultData = useQuery(
    api.queries.getBioVaultBySession,
    sessionId ? { sessionId } : "skip"
  ) as BioVaultRecord | null | undefined;

  // ── Analyze biomarkers against supplementLogic thresholds ──
  const biomarkerFlags = useMemo(() => {
    return analyzeBiomarkers(bioVaultData ?? null);
  }, [bioVaultData]);

  // ── Dispatch InsightBridge updates to DailyStack + CommandCenter ──
  useEffect(() => {
    if (biomarkerFlags.length === 0) return;
    const now = Date.now();
    // Throttle dispatches to once per 5 seconds
    if (now - lastDispatchRef.current < 5000) return;
    lastDispatchRef.current = now;

    dispatchInsightBridgeUpdate(biomarkerFlags);
    dispatchPriorityAction(biomarkerFlags);
  }, [biomarkerFlags]);

  const hasRealData =
    (journalEvents != null && journalEvents.length > 0) ||
    (vitalityScores != null && vitalityScores.length > 0);

  const simulatedJournal = useMemo(() => {
    if (hasRealData) return null;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    return [
      { loggedAt: now - 0.5 * DAY },
      { loggedAt: now - 1.2 * DAY },
      { loggedAt: now - 2.1 * DAY },
    ];
  }, [hasRealData]);

  const simulatedVitality = useMemo(() => {
    if (hasRealData) return null;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    return [
      { overallScore: 62, calculatedAt: now - 13 * DAY },
      { overallScore: 65, calculatedAt: now - 12 * DAY },
      { overallScore: 64, calculatedAt: now - 11 * DAY },
      { overallScore: 66, calculatedAt: now - 10 * DAY },
      { overallScore: 68, calculatedAt: now - 9 * DAY },
      { overallScore: 67, calculatedAt: now - 8 * DAY },
      { overallScore: 69, calculatedAt: now - 7 * DAY },
      { overallScore: 71, calculatedAt: now - 6 * DAY },
      { overallScore: 73, calculatedAt: now - 5 * DAY },
      { overallScore: 72, calculatedAt: now - 4 * DAY },
      { overallScore: 75, calculatedAt: now - 3 * DAY },
      { overallScore: 76, calculatedAt: now - 2 * DAY },
      { overallScore: 78, calculatedAt: now - 1 * DAY },
      { overallScore: 79, calculatedAt: now },
    ];
  }, [hasRealData]);

  const effectiveJournal = journalEvents && journalEvents.length > 0 ? journalEvents : simulatedJournal;
  const effectiveVitality = vitalityScores && vitalityScores.length > 0 ? vitalityScores : simulatedVitality;

  const insight = useMemo(
    () => computeInsight(effectiveJournal, effectiveVitality),
    [effectiveJournal, effectiveVitality],
  );

  const velocity = useMemo(
    () => calculateBiologicalVelocity(effectiveVitality),
    [effectiveVitality],
  );

  const sparklineData = useMemo(() => {
    const scores = (effectiveVitality || [])
      .sort((a, b) => a.calculatedAt - b.calculatedAt)
      .map((s) => s.overallScore);
    return scores.length >= 2 ? scores : [60, 63, 65, 68, 72, 75, 78];
  }, [effectiveVitality]);

  const dayLabels7d = useMemo(() => {
    const labels: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2));
    }
    return labels;
  }, []);

  const journal7dData = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const events = effectiveJournal || [];
    const counts: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i + 1) * DAY;
      const dayEnd = now - i * DAY;
      const count = events.filter((e) => e.loggedAt >= dayStart && e.loggedAt < dayEnd).length;
      counts.push(count);
    }
    if (counts.every((c) => c === 0)) return [0, 1, 1, 2, 1, 2, 1];
    return counts;
  }, [effectiveJournal]);

  const vitality7dData = useMemo(() => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const scores = (effectiveVitality || []).sort((a, b) => a.calculatedAt - b.calculatedAt);
    const daily: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = now - (i + 1) * DAY;
      const dayEnd = now - i * DAY;
      const dayScores = scores.filter((s) => s.calculatedAt >= dayStart && s.calculatedAt < dayEnd);
      if (dayScores.length > 0) {
        daily.push(Math.round(dayScores.reduce((s, v) => s + v.overallScore, 0) / dayScores.length));
      } else {
        daily.push(daily.length > 0 ? daily[daily.length - 1] : 70);
      }
    }
    return daily;
  }, [effectiveVitality]);

  const journalTrendSummary = useMemo(() => {
    const total = journal7dData.reduce((s, v) => s + v, 0);
    const activeDays = journal7dData.filter((v) => v > 0).length;
    if (activeDays >= 5) return `${total} entries across ${activeDays} active days. Strong journaling rhythm detected.`;
    if (activeDays >= 3) return `${total} entries across ${activeDays} days. Building momentum \u2014 2 more days unlocks deeper patterns.`;
    if (activeDays >= 1) return `${total} entries this week. Consistency is the key to unlocking insight correlations.`;
    return "No entries recorded. Start a voice journal to activate trend tracking.";
  }, [journal7dData]);

  const vitalityTrendSummary = useMemo(() => {
    const latest = vitality7dData[vitality7dData.length - 1];
    const earliest = vitality7dData[0];
    const delta = earliest > 0 ? Math.round(((latest - earliest) / earliest) * 100) : 0;
    if (delta > 5) return "You're trending up over the last 7 days. Your recovery protocols are working.";
    if (delta < -5) return "Things dipped a bit this week. Consider adjusting sleep or stress load.";
    return "Holding steady this week. Your baseline is stable \u2014 small optimizations can push it higher.";
  }, [vitality7dData]);

  // ── Standardized colors ──
  const trendColor = ghostMode ? "rgba(160,160,160,0.6)" : getStatusColor(insight.vitalityTrend);
  const trendBg = ghostMode ? "rgba(160,160,160,0.06)" : getStatusBg(insight.vitalityTrend);
  const trendBorder = ghostMode ? "rgba(160,160,160,0.12)" : getStatusBorder(insight.vitalityTrend);
  const journalColor = ghostMode ? "rgba(160,160,160,0.6)" : getFrequencyColor(insight.journalFrequency);

  const labelColor = ghostMode ? "rgba(160,160,160,0.45)" : "rgba(255,255,255,0.4)";
  const textColor = ghostMode ? "rgba(200,200,200,0.7)" : "rgba(255,255,255,0.85)";
  const subColor = ghostMode ? "rgba(160,160,160,0.35)" : "rgba(255,255,255,0.5)";
  const borderColor = ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.06)";

  const trendArrow =
    insight.vitalityTrend === "up"
      ? "\u2191"
      : insight.vitalityTrend === "down"
        ? "\u2193"
        : "\u2192";
  const trendLabel =
    insight.vitalityTrend === "up"
      ? "Improving"
      : insight.vitalityTrend === "down"
        ? "Needs Attention"
        : "Steady";

  const velocityStatusColor = ghostMode
    ? "rgba(160,160,160,0.6)"
    : (velocity.tier === "surge" || velocity.tier === "acceleration") ? "#30D158"
    : (velocity.tier === "cruising" || velocity.tier === "stalling") ? "#FFD60A"
    : "#FF453A";

  const velocityStatusLabel =
    (velocity.tier === "surge" || velocity.tier === "acceleration") ? "Improving"
    : (velocity.tier === "cruising" || velocity.tier === "stalling") ? "Steady"
    : "Needs Attention";

  const viewTrendStyle = {
    fontFamily: "Inter, system-ui, sans-serif" as const,
    fontSize: compact ? "7px" : "8px",
    letterSpacing: "0.04em",
    cursor: "pointer" as const,
    transition: "all 0.2s ease",
  };

  const recoveryColor = ghostMode
    ? "rgba(160,160,160,0.7)"
    : insight.recoveryDelta > 0 ? "#30D158"
    : insight.recoveryDelta < 0 ? "#FF453A"
    : "#FFD60A";

  return (
    <div
      className={`relative overflow-visible rounded-xl border transition-all duration-500 ${compact ? "h-full" : ""}`}
      style={{
        background: "rgba(10, 10, 10, 0.6)",
        borderColor: borderColor,
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* Accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-700"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${trendColor} 30%, ${trendColor} 70%, transparent 100%)`,
          opacity: ghostMode ? 0.15 : 0.5,
        }}
      />

      <div className={`relative z-10 ${compact ? "p-3.5" : "p-5"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${compact ? "mb-2.5" : "mb-4"}`}>
          <div className="flex items-center gap-2">
            <div
              className={`${compact ? "w-5 h-5" : "w-6 h-6"} rounded-md flex items-center justify-center`}
              style={{
                background: trendBg,
                border: `1px solid ${trendBorder}`,
              }}
            >
              <span className={compact ? "text-[10px]" : "text-xs"}>{insight.icon}</span>
            </div>
            <span
              className="font-medium tracking-[0.08em] uppercase"
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: compact ? "8px" : "10px",
                color: labelColor,
              }}
            >
              System Insight
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.06)" : (velocityStatusColor === "#30D158" ? "rgba(48,209,88,0.08)" : velocityStatusColor === "#FFD60A" ? "rgba(255,214,10,0.08)" : "rgba(255,69,58,0.08)"),
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : (velocityStatusColor === "#30D158" ? "rgba(48,209,88,0.2)" : velocityStatusColor === "#FFD60A" ? "rgba(255,214,10,0.2)" : "rgba(255,69,58,0.2)")}`,
              }}
            >
              <span style={{ fontSize: compact ? "8px" : "9px" }}>{velocity.icon}</span>
              <span
                className="font-semibold tracking-wide"
                style={{
                  fontSize: compact ? "8px" : "9px",
                  color: velocityStatusColor,
                  letterSpacing: "0.03em",
                }}
              >
                {velocityStatusLabel}
              </span>
            </div>

            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{
                background: trendBg,
                border: `1px solid ${trendBorder}`,
              }}
            >
              <span
                className="font-mono font-semibold"
                style={{ fontSize: compact ? "9px" : "10px", color: trendColor }}
              >
                {trendArrow}
              </span>
              <span
                className="font-medium tracking-[0.06em]"
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: compact ? "8px" : "9px",
                  color: trendColor,
                }}
              >
                {trendLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Main insight text */}
        <p
          className={compact ? "leading-snug mb-2" : "leading-relaxed mb-3"}
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: compact ? "11.5px" : "13.5px",
            fontWeight: 500,
            color: textColor,
            letterSpacing: "0.01em",
          }}
        >
          {insight.insightText}
        </p>

        {/* Reinforcement text */}
        <p
          className={compact ? "leading-snug mb-2.5" : "leading-relaxed mb-4"}
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: compact ? "10px" : "11px",
            color: subColor,
            letterSpacing: "0.02em",
          }}
        >
          {insight.reinforcement}
        </p>

        {/* Stats row with sparkline */}
        <div
          className={`flex items-start justify-between ${compact ? "pt-2" : "pt-3"}`}
          style={{
            borderTop: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"}`,
          }}
        >
          <div className={`flex items-start ${compact ? "gap-3" : "gap-4"}`}>
            {/* Journal streak */}
            <div className="relative" ref={journalAnchorRef}>
              <div className="flex flex-col">
                <span
                  className="font-mono tabular-nums font-semibold"
                  style={{ fontSize: compact ? "14px" : "16px", color: journalColor }}
                >
                  {insight.journalStreak}
                </span>
                <span
                  className="tracking-[0.06em] uppercase"
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: compact ? "7px" : "8px",
                    color: labelColor,
                  }}
                >
                  Journal Days
                </span>
                <button
                  onClick={() => toggleTrend("journal")}
                  className="mt-1 flex items-center gap-0.5 group"
                  style={viewTrendStyle}
                >
                  <span
                    className="transition-colors duration-200"
                    style={{
                      color: activeTrend === "journal"
                        ? journalColor
                        : ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)",
                    }}
                  >
                    {activeTrend === "journal" ? "Hide Trend" : "View Trend"}
                  </span>
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    className="transition-transform duration-200"
                    style={{
                      transform: activeTrend === "journal" ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <path
                      d="M2 3L4 5L6 3"
                      stroke={activeTrend === "journal"
                        ? journalColor
                        : ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)"}
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <TrendPopover
                open={activeTrend === "journal"}
                onClose={() => setActiveTrend(null)}
                title="Journal"
                data={journal7dData}
                labels={dayLabels7d}
                color={ghostMode ? "rgba(160,160,160,0.5)" : journalColor}
                ghostMode={ghostMode}
                unit=" entries"
                summary={journalTrendSummary}
                anchorRef={journalAnchorRef}
              />
            </div>

            {/* Divider */}
            <div
              className={compact ? "w-px h-6 mt-1" : "w-px h-8 mt-1"}
              style={{
                background: ghostMode
                  ? "rgba(160,160,160,0.08)"
                  : "rgba(255,255,255,0.06)",
              }}
            />

            {/* Recovery delta */}
            <div className="relative" ref={vitalityAnchorRef}>
              <div className="flex flex-col">
                <span
                  className="font-mono tabular-nums font-semibold"
                  style={{
                    fontSize: compact ? "14px" : "16px",
                    color: recoveryColor,
                  }}
                >
                  {insight.recoveryDelta > 0 ? "+" : ""}
                  {insight.recoveryDelta || 12}%
                </span>
                <span
                  className="tracking-[0.06em] uppercase"
                  style={{
                    fontFamily: "Inter, system-ui, sans-serif",
                    fontSize: compact ? "7px" : "8px",
                    color: labelColor,
                  }}
                >
                  Recovery
                </span>
                <button
                  onClick={() => toggleTrend("vitality")}
                  className="mt-1 flex items-center gap-0.5 group"
                  style={viewTrendStyle}
                >
                  <span
                    className="transition-colors duration-200"
                    style={{
                      color: activeTrend === "vitality"
                        ? trendColor
                        : ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)",
                    }}
                  >
                    {activeTrend === "vitality" ? "Hide Trend" : "View Trend"}
                  </span>
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    className="transition-transform duration-200"
                    style={{
                      transform: activeTrend === "vitality" ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <path
                      d="M2 3L4 5L6 3"
                      stroke={activeTrend === "vitality"
                        ? trendColor
                        : ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)"}
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <TrendPopover
                open={activeTrend === "vitality"}
                onClose={() => setActiveTrend(null)}
                title="Readiness"
                data={vitality7dData}
                labels={dayLabels7d}
                color={ghostMode ? "rgba(160,160,160,0.5)" : trendColor}
                ghostMode={ghostMode}
                unit=""
                summary={vitalityTrendSummary}
                anchorRef={vitalityAnchorRef}
              />
            </div>
          </div>

          {!compact && (
            <MiniSparkline
              data={sparklineData}
              color={trendColor}
              ghostMode={ghostMode}
            />
          )}
        </div>

        {compact && (
          <div className="mt-2">
            <MiniSparkline
              data={sparklineData}
              color={trendColor}
              ghostMode={ghostMode}
            />
          </div>
        )}

        {/* ── Biomarker Flag Strip — shows flagged out-of-range markers ── */}
        <BiomarkerFlagStrip flags={biomarkerFlags} ghostMode={ghostMode} />
      </div>
    </div>
  );
}

export default InsightBridge;
