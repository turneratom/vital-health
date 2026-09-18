import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AnimatePresence, motion } from "framer-motion";

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const T = {
  bg: "rgba(10,10,11,0.96)",
  card: "rgba(14,14,18,0.88)",
  cardBorder: "rgba(255,255,255,0.04)",
  text: "#F0F0F4",
  textSec: "rgba(255,255,255,0.55)",
  textTer: "rgba(255,255,255,0.28)",
  blue: "#3B82F6",
  blueBright: "#60A5FA",
  blueGlow: "rgba(59,130,246,0.12)",
  accent: "#00FFCC",
  accentGlow: "rgba(0,255,204,0.08)",
  green: "#00DC82",
  orange: "#E8976C",
  red: "#FF6B6B",
  amber: "#FBBF24",
  purple: "#A78BFA",
};

const SEVERITY_CONFIG: Record<string, { color: string; glow: string; label: string; borderColor: string }> = {
  critical: { color: T.red, glow: "rgba(255,107,107,0.12)", label: "CRITICAL", borderColor: "rgba(255,107,107,0.2)" },
  warning: { color: T.amber, glow: "rgba(251,191,36,0.1)", label: "WARNING", borderColor: "rgba(251,191,36,0.15)" },
  advisory: { color: T.blue, glow: T.blueGlow, label: "ADVISORY", borderColor: "rgba(59,130,246,0.15)" },
  positive: { color: T.green, glow: "rgba(0,220,130,0.1)", label: "OPTIMAL", borderColor: "rgba(0,220,130,0.15)" },
};

/* ── Mini Sparkline ── */
function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Area fill */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
      {/* Latest point dot */}
      {data.length > 0 && (() => {
        const lastX = width;
        const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
        return <circle cx={lastX} cy={lastY} r="2" fill={color} opacity="0.9" />;
      })()}
    </svg>
  );
}

/* ── Prediction Card ── */
function PredictionCard({ prediction, index, isExpanded, onToggle }: {
  prediction: any;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = SEVERITY_CONFIG[prediction.severity] || SEVERITY_CONFIG.advisory;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      onClick={onToggle}
      style={{
        background: T.card,
        border: `1px solid ${config.borderColor}`,
        borderRadius: 14,
        padding: "14px 16px",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.3s",
      }}
    >
      {/* Severity glow accent */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
        opacity: prediction.severity === "critical" ? 0.8 : 0.4,
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: config.glow,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>
          {prediction.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Severity badge + confidence */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 8, fontFamily: "monospace", fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: config.color, padding: "1px 5px",
              background: config.glow, borderRadius: 3,
            }}>
              {config.label}
            </span>
            <span style={{
              fontSize: 8, fontFamily: "monospace", color: T.textTer,
              letterSpacing: "0.05em",
            }}>
              {prediction.confidence}% CONF
            </span>
            <span style={{
              fontSize: 8, fontFamily: "monospace", color: T.textTer,
            }}>
              · {prediction.horizon}
            </span>
          </div>

          {/* Title */}
          <div style={{
            fontSize: 12, fontWeight: 600, color: T.text,
            lineHeight: 1.3, marginBottom: 4,
          }}>
            {prediction.title}
          </div>

          {/* Impact metric + sparkline */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{
              fontSize: 10, fontFamily: "monospace", fontWeight: 600,
              color: config.color, letterSpacing: "0.02em",
            }}>
              {prediction.impactMetric}
            </span>
            <Sparkline data={prediction.trendData} color={config.color} width={64} height={20} />
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              marginTop: 12, paddingTop: 10,
              borderTop: `1px solid ${T.cardBorder}`,
            }}>
              {/* Analysis */}
              <p style={{
                fontSize: 11, color: T.textSec, lineHeight: 1.55,
                margin: "0 0 10px",
              }}>
                {prediction.message}
              </p>

              {/* Corrective protocol */}
              {prediction.corrective && (
                <div style={{
                  background: "rgba(0,255,204,0.04)",
                  border: "1px solid rgba(0,255,204,0.08)",
                  borderRadius: 8, padding: "8px 10px",
                  marginBottom: 8,
                }}>
                  <div style={{
                    fontSize: 8, fontFamily: "monospace", fontWeight: 700,
                    color: T.accent, letterSpacing: "0.12em",
                    textTransform: "uppercase", marginBottom: 4,
                  }}>
                    CORRECTIVE PROTOCOL
                  </div>
                  <p style={{
                    fontSize: 10, color: T.textSec, lineHeight: 1.5,
                    margin: 0,
                  }}>
                    {prediction.corrective}
                  </p>
                </div>
              )}

              {/* Subsystems */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {prediction.subsystems.map((sys: string) => (
                  <span key={sys} style={{
                    fontSize: 8, fontFamily: "monospace",
                    color: T.textTer, padding: "2px 6px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 4, letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}>
                    {sys}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOMATIC FORECASTING — Biotic Prediction HUD Notification
   ═══════════════════════════════════════════════════════════════ */

export default function SomaticForecasting() {
  const sessionId = getTwinSessionId();

  const forecast = useQuery(api.somaticForecasting.getSomaticForecast, { sessionId });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Auto-show notification for critical/warning predictions
  const hasAlerts = useMemo(() => {
    if (!forecast?.predictions) return false;
    return forecast.predictions.some((p) => p.severity === "critical" || p.severity === "warning");
  }, [forecast]);

  const visiblePredictions = useMemo(() => {
    if (!forecast?.predictions) return [];
    if (showAll) return forecast.predictions;
    // Show top 3 by default
    return forecast.predictions.slice(0, 3);
  }, [forecast, showAll]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (!forecast || !forecast.predictions.length || dismissed) return null;

  const riskConfig = {
    nominal: { color: T.green, label: "ALL SYSTEMS NOMINAL", icon: "✅" },
    elevated: { color: T.amber, label: "ELEVATED RISK DETECTED", icon: "⚠️" },
    high: { color: T.orange, label: "HIGH RISK — ACTION REQUIRED", icon: "🔶" },
    critical: { color: T.red, label: "CRITICAL — IMMEDIATE ACTION", icon: "🔴" },
  }[forecast.overallRisk];

  const critCount = forecast.predictions.filter((p) => p.severity === "critical").length;
  const warnCount = forecast.predictions.filter((p) => p.severity === "warning").length;
  const posCount = forecast.predictions.filter((p) => p.severity === "positive").length;

  return (
    <div style={{ padding: "0 16px", marginBottom: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: T.card,
          border: `1px solid ${T.cardBorder}`,
          borderRadius: 18,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Top accent bar */}
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, ${riskConfig.color} 30%, ${T.blue} 70%, transparent 95%)`,
          opacity: 0.6,
        }} />

        {/* Header */}
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: riskConfig.color,
                boxShadow: `0 0 8px ${riskConfig.color}`,
                animation: forecast.overallRisk !== "nominal" ? "sf-pulse 2s ease-in-out infinite" : "none",
              }} />
              <span style={{
                fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                letterSpacing: "0.15em", textTransform: "uppercase",
                color: T.textSec,
              }}>
                BIOTIC PREDICTION ENGINE
              </span>
            </div>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: "none", border: "none", color: T.textTer,
                fontSize: 14, cursor: "pointer", padding: "2px 4px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Risk summary bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 14 }}>{riskConfig.icon}</span>
            <span style={{
              fontSize: 10, fontFamily: "monospace", fontWeight: 700,
              color: riskConfig.color, letterSpacing: "0.08em",
            }}>
              {riskConfig.label}
            </span>
            <div style={{ flex: 1 }} />
            {/* Stat pills */}
            <div style={{ display: "flex", gap: 4 }}>
              {critCount > 0 && (
                <span style={{
                  fontSize: 8, fontFamily: "monospace", fontWeight: 700,
                  color: T.red, background: "rgba(255,107,107,0.1)",
                  padding: "2px 6px", borderRadius: 4,
                }}>
                  {critCount} CRIT
                </span>
              )}
              {warnCount > 0 && (
                <span style={{
                  fontSize: 8, fontFamily: "monospace", fontWeight: 700,
                  color: T.amber, background: "rgba(251,191,36,0.08)",
                  padding: "2px 6px", borderRadius: 4,
                }}>
                  {warnCount} WARN
                </span>
              )}
              {posCount > 0 && (
                <span style={{
                  fontSize: 8, fontFamily: "monospace", fontWeight: 700,
                  color: T.green, background: "rgba(0,220,130,0.08)",
                  padding: "2px 6px", borderRadius: 4,
                }}>
                  {posCount} OPT
                </span>
              )}
            </div>
          </div>

          {/* Data completeness */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 12,
          }}>
            <div style={{
              flex: 1, height: 2, background: "rgba(255,255,255,0.04)",
              borderRadius: 1, overflow: "hidden",
            }}>
              <div style={{
                width: `${forecast.dataCompleteness}%`, height: "100%",
                background: `linear-gradient(90deg, ${T.blue}, ${T.accent})`,
                borderRadius: 1, transition: "width 0.5s",
              }} />
            </div>
            <span style={{
              fontSize: 8, fontFamily: "monospace", color: T.textTer,
              letterSpacing: "0.05em",
            }}>
              {forecast.dataCompleteness}% DATA
            </span>
          </div>
        </div>

        {/* Prediction cards */}
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <AnimatePresence mode="popLayout">
            {visiblePredictions.map((pred, i) => (
              <PredictionCard
                key={pred.id}
                prediction={pred}
                index={i}
                isExpanded={expandedId === pred.id}
                onToggle={() => toggleExpand(pred.id)}
              />
            ))}
          </AnimatePresence>

          {/* Show more / less */}
          {forecast.predictions.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                background: "none", border: `1px solid ${T.cardBorder}`,
                borderRadius: 8, padding: "6px 12px",
                color: T.textSec, fontSize: 9, fontFamily: "monospace",
                fontWeight: 600, letterSpacing: "0.08em",
                textTransform: "uppercase", cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {showAll ? "COLLAPSE" : `VIEW ALL ${forecast.predictions.length} PREDICTIONS`}
            </button>
          )}
        </div>

        {/* Pulse animation */}
        <style>{`
          @keyframes sf-pulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 8px currentColor; }
            50% { opacity: 0.4; box-shadow: 0 0 4px currentColor; }
          }
        `}</style>
      </motion.div>
    </div>
  );
}
