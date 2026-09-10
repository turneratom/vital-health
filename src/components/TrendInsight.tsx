import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { calculateTrend, type TrendResult } from "@/lib/bioSyncLogic";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

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
};

type VelocityTab = "wellness" | "adherence" | "biomarkers";

interface MarkerVelocity {
  name: string;
  key: string;
  value: number | null;
  optimal: [number, number];
  unit: string;
  lowerIsBetter: boolean;
  color: string;
  score: number;
}

function getMarkerScore(value: number, optimal: [number, number], lowerIsBetter: boolean): number {
  if (value >= optimal[0] && value <= optimal[1]) return 100;
  if (lowerIsBetter) {
    if (value < optimal[0]) return 90;
    const excess = (value - optimal[1]) / optimal[1];
    return Math.max(10, Math.round(85 - excess * 120));
  }
  if (value < optimal[0]) {
    const deficit = (optimal[0] - value) / optimal[0];
    return Math.max(10, Math.round(85 - deficit * 120));
  }
  const excess = (value - optimal[1]) / optimal[1];
  return Math.max(10, Math.round(85 - excess * 120));
}

/* ── Custom Tooltip ── */
function VelocityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: "rgba(20,18,16,0.95)",
        border: `1px solid ${W.cardBorder}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ color: W.textDim }} className="mb-1 font-medium">
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color }}
          />
          <span style={{ color: W.textSecondary }}>{p.name}:</span>
          <span style={{ color: W.textPrimary }} className="font-semibold">
            {typeof p.value === "number" ? p.value.toFixed(1) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Velocity Badge ── */
function VelocityBadge({ trend }: { trend: TrendResult }) {
  const arrow = trend.direction === "up" ? "\u2191" : trend.direction === "down" ? "\u2193" : "\u2194";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
      style={{
        background: `${trend.color}18`,
        color: trend.color,
        border: `1px solid ${trend.color}30`,
      }}
    >
      {arrow} {trend.label}
    </span>
  );
}

/* ── Marker Gauge ── */
function MarkerGauge({ marker }: { marker: MarkerVelocity }) {
  const pct = Math.max(0, Math.min(100, marker.score));
  const barColor = pct >= 80 ? W.sage : pct >= 55 ? W.gold : W.rose;
  return (
    <div
      className="rounded-xl p-3"
      style={{ background: W.sandFaint, border: `1px solid ${W.cardBorder}` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold" style={{ color: W.textPrimary }}>
          {marker.name}
        </span>
        <span className="text-[10px] font-mono" style={{ color: marker.color }}>
          {marker.value != null ? `${marker.value} ${marker.unit}` : "—"}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(232,224,216,0.08)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px]" style={{ color: W.textDim }}>
          Optimal: {marker.optimal[0]}–{marker.optimal[1]} {marker.unit}
        </span>
        <span
          className="text-[9px] font-bold"
          style={{ color: barColor }}
        >
          {pct >= 80 ? "Optimal" : pct >= 55 ? "Moderate" : "Needs Focus"}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/*  TrendInsight — 7-Day Velocity + Biomarker     */
/* ══════════════════════════════════════════════ */
export function TrendInsight({ sessionId }: { sessionId: string }) {
  const [activeTab, setActiveTab] = useState<VelocityTab>("wellness");

  const velocityData = useQuery(api.logs.getBiomarkerVelocity30d, { sessionId });
  const scores14d = useQuery(api.queries.getVitalityScores14d, { sessionId });

  /* ── Compute wellness trend ── */
  const wellnessTrend = useMemo<TrendResult>(() => {
    if (!scores14d || scores14d.length < 2) {
      return { deltaPct: 0, deltaAbs: 0, delta: 0, percentage: 0, direction: "flat" as const, label: "—", color: W.gold, isFavorable: true };
    }
    const vals = scores14d.map((s) => s.score);
    const current = vals[vals.length - 1];
    const history = vals.slice(0, -1);
    return calculateTrend(current, history, true);
  }, [scores14d]);

  /* ── Projected next-week score via linear regression ── */
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
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const projected = Math.max(0, Math.min(100, Math.round(intercept + slope * (n + 7))));
    const current = pts[pts.length - 1].y;
    const delta = projected - current;

    return { projected, current: Math.round(current), delta: Math.round(delta), slope };
  }, [velocityData]);

  /* ── Chart data ── */
  const chartData = useMemo(() => {
    if (!velocityData?.dailyData) return [];
    return velocityData.dailyData.map((d) => ({
      date: d.dateKey.slice(5),
      score: d.avgScore,
      adherence: d.avgAdherence,
      calories: d.totalCalories ? Math.round(d.totalCalories) : null,
      protein: d.totalProtein ? Math.round(d.totalProtein) : null,
      activity: d.totalActivityMin ? Math.round(d.totalActivityMin) : null,
    }));
  }, [velocityData]);

  /* ── Adherence trend ── */
  const adherenceTrend = useMemo<TrendResult>(() => {
    const vals = chartData.filter((d) => d.adherence != null).map((d) => d.adherence!);
    if (vals.length < 2) return { deltaPct: 0, deltaAbs: 0, delta: 0, percentage: 0, direction: "flat" as const, label: "—", color: W.gold, isFavorable: true };
    return calculateTrend(vals[vals.length - 1], vals.slice(0, -1), true);
  }, [chartData]);

  /* ── Biomarker gauges ── */
  const markers = useMemo<MarkerVelocity[]>(() => {
    const bv = velocityData?.bioVault;
    if (!bv) return [];
    const list: MarkerVelocity[] = [];
    if (bv.crp != null) {
      const s = getMarkerScore(bv.crp, [0, 1.0], true);
      list.push({ name: "CRP", key: "crp", value: bv.crp, optimal: [0, 1.0], unit: "mg/L", lowerIsBetter: true, color: s >= 80 ? W.sage : s >= 55 ? W.gold : W.rose, score: s });
    }
    if (bv.hba1c != null) {
      const s = getMarkerScore(bv.hba1c, [4.0, 5.4], true);
      list.push({ name: "HbA1c", key: "hba1c", value: bv.hba1c, optimal: [4.0, 5.4], unit: "%", lowerIsBetter: true, color: s >= 80 ? W.sage : s >= 55 ? W.gold : W.rose, score: s });
    }
    if (bv.vitaminD != null) {
      const s = getMarkerScore(bv.vitaminD, [40, 60], false);
      list.push({ name: "Vitamin D", key: "vitaminD", value: bv.vitaminD, optimal: [40, 60], unit: "ng/mL", lowerIsBetter: false, color: s >= 80 ? W.sage : s >= 55 ? W.gold : W.rose, score: s });
    }
    if (bv.ferritin != null) {
      const s = getMarkerScore(bv.ferritin, [40, 150], false);
      list.push({ name: "Ferritin", key: "ferritin", value: bv.ferritin, optimal: [40, 150], unit: "ng/mL", lowerIsBetter: false, color: s >= 80 ? W.sage : s >= 55 ? W.gold : W.rose, score: s });
    }
    return list;
  }, [velocityData]);

  /* ── Motivational message ── */
  const motivation = useMemo(() => {
    if (!projection) return "Keep logging to unlock your trajectory.";
    if (projection.delta > 5) return "Your trajectory is accelerating. Maintain this momentum.";
    if (projection.delta > 0) return "Steady climb detected. Your consistency is compounding.";
    if (projection.delta === 0) return "Holding steady. Small protocol tweaks can reignite growth.";
    return "Slight dip projected. Tighten adherence to reverse course.";
  }, [projection]);

  const tabs: { key: VelocityTab; label: string }[] = [
    { key: "wellness", label: "Wellness" },
    { key: "adherence", label: "Adherence" },
    { key: "biomarkers", label: "Biomarkers" },
  ];

  const isLoading = velocityData === undefined;
  const hasChartData = chartData.length > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: W.cardBg,
        border: `1px solid ${W.cardBorder}`,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${W.sky}20`, border: `1px solid ${W.sky}30` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={W.sky} strokeWidth="2" strokeLinecap="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h3 className="text-[13px] font-bold tracking-tight" style={{ color: W.textPrimary }}>
                7-Day Velocity
              </h3>
              <p className="text-[10px]" style={{ color: W.textDim }}>
                Trajectory &amp; Biomarker Rate of Change
              </p>
            </div>
          </div>
          {projection && (
            <div className="text-right">
              <div className="text-[10px]" style={{ color: W.textDim }}>Next Week</div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-black tabular-nums" style={{ color: projection.delta >= 0 ? W.sage : W.rose }}>
                  {projection.projected}
                </span>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: projection.delta >= 0 ? W.sage : W.rose }}
                >
                  {projection.delta >= 0 ? "+" : ""}{projection.delta}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mt-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200"
              style={{
                background: activeTab === t.key ? `${W.sky}20` : "transparent",
                color: activeTab === t.key ? W.sky : W.textDim,
                border: `1px solid ${activeTab === t.key ? `${W.sky}40` : "transparent"}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${W.sky}40`, borderTopColor: "transparent" }} />
          </div>
        ) : !hasChartData && activeTab !== "biomarkers" ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-[11px]" style={{ color: W.textDim }}>Log meals, activities, and protocols to see your velocity chart.</p>
          </div>
        ) : (
          <>
            {/* ── Wellness Tab ── */}
            {activeTab === "wellness" && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <VelocityBadge trend={wellnessTrend} />
                  <span className="text-[10px]" style={{ color: W.textSecondary }}>
                    vs 7-day avg
                  </span>
                </div>
                <div className="h-[160px] -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="wellnessGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={W.sky} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={W.sky} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(232,224,216,0.04)" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: W.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: W.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<VelocityTooltip />} />
                      {projection && (
                        <ReferenceLine y={projection.projected} stroke={W.sage} strokeDasharray="4 4" strokeOpacity={0.5} />
                      )}
                      <Area
                        type="monotone"
                        dataKey="score"
                        name="Wellness"
                        stroke={W.sky}
                        fill="url(#wellnessGrad)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: W.sky, stroke: W.cardBg, strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: W.textSecondary }}>
                  {motivation}
                </p>
              </div>
            )}

            {/* ── Adherence Tab ── */}
            {activeTab === "adherence" && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <VelocityBadge trend={adherenceTrend} />
                  <span className="text-[10px]" style={{ color: W.textSecondary }}>
                    Protocol discipline
                  </span>
                </div>
                <div className="h-[160px] -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="adherenceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={W.sage} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={W.sage} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(232,224,216,0.04)" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: W.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: W.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<VelocityTooltip />} />
                      <ReferenceLine y={90} stroke={W.gold} strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: "Target", position: "right", fontSize: 9, fill: W.textDim }} />
                      <Area
                        type="monotone"
                        dataKey="adherence"
                        name="Adherence %"
                        stroke={W.sage}
                        fill="url(#adherenceGrad)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 3, fill: W.sage, stroke: W.cardBg, strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: W.textSecondary }}>
                  {adherenceTrend.isFavorable
                    ? "Your discipline is paying off. Keep the streak alive."
                    : "Adherence is slipping. Re-commit to your daily stack."}
                </p>
              </div>
            )}

            {/* ── Biomarkers Tab ── */}
            {activeTab === "biomarkers" && (
              <div>
                {markers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-2xl mb-2">🧪</div>
                    <p className="text-[11px]" style={{ color: W.textDim }}>
                      Upload lab results to Bio-Vault to see biomarker velocity.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {markers.map((m) => (
                      <MarkerGauge key={m.key} marker={m} />
                    ))}
                    <div
                      className="rounded-lg p-2.5 mt-2"
                      style={{ background: `${W.sky}08`, border: `1px solid ${W.sky}15` }}
                    >
                      <p className="text-[10px] leading-relaxed" style={{ color: W.textSecondary }}>
                        <span style={{ color: W.sky }} className="font-semibold">Velocity Insight:</span>{" "}
                        {markers.every((m) => m.score >= 80)
                          ? "All markers in optimal range. Your biology is responding to your protocols."
                          : markers.some((m) => m.score < 55)
                            ? "Some markers need attention. Review your supplement stack and consult your coach."
                            : "Markers trending well. Maintain current protocols for continued improvement."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default TrendInsight;
