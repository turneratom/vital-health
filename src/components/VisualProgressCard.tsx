import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode, getSessionId } from "@/components/Presence/usePresenceState";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { calculateBiologicalVelocity } from "@/lib/analyticsUtils";
import type { VelocityResult } from "@/lib/analyticsUtils";

/* ── Standardized Color System ──
   Green  (#30D158) = Good / Improving
   Yellow (#FFD60A) = Neutral / Steady
   Red    (#FF453A) = Needs Attention
*/

function getStatusColor(velocity: VelocityResult): string {
  // Map velocity tiers to the standardized palette
  if (velocity.tier === "surge" || velocity.tier === "acceleration") return "#30D158";
  if (velocity.tier === "cruising" || velocity.tier === "stalling") return "#FFD60A";
  return "#FF453A"; // deceleration, freefall
}

function getStatusLabel(velocity: VelocityResult): string {
  if (velocity.tier === "surge" || velocity.tier === "acceleration") return "Improving";
  if (velocity.tier === "cruising" || velocity.tier === "stalling") return "Steady";
  return "Needs Attention";
}

function getStatusBg(color: string): string {
  if (color === "#30D158") return "rgba(48,209,88,0.08)";
  if (color === "#FFD60A") return "rgba(255,214,10,0.08)";
  return "rgba(255,69,58,0.08)";
}

function getStatusBorder(color: string): string {
  if (color === "#30D158") return "rgba(48,209,88,0.2)";
  if (color === "#FFD60A") return "rgba(255,214,10,0.2)";
  return "rgba(255,69,58,0.2)";
}

interface VisualProgressCardProps {
  onExpand?: () => void;
}

export function VisualProgressCard({ onExpand }: VisualProgressCardProps) {
  const ghostMode = useGhostMode();
  const sessionId = getSessionId();
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanLineRef = useRef(0);
  const animRef = useRef(0);
  const [scanY, setScanY] = useState(0);

  // ── Fetch vitality scores & compute biological velocity ──
  const vitalityScores = useQuery(api.queries.getRecentVitalityScores, { sessionId });
  const velocity: VelocityResult = calculateBiologicalVelocity(
    vitalityScores?.map((s: any) => ({
      overallScore: s.overallScore ?? s.vitalityScore ?? 0,
      calculatedAt: s.calculatedAt ?? s._creationTime ?? 0,
    })) ?? null
  );

  const statusColor = ghostMode ? "rgba(160,160,160,0.6)" : getStatusColor(velocity);
  const statusLabel = getStatusLabel(velocity);
  const statusBg = ghostMode ? "rgba(160,160,160,0.06)" : getStatusBg(getStatusColor(velocity));
  const statusBorder = ghostMode ? "rgba(160,160,160,0.12)" : getStatusBorder(getStatusColor(velocity));

  const textPrimary = ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.92)";
  const textSecondary = ghostMode ? "rgba(180,180,180,0.5)" : "rgba(255,255,255,0.55)";
  const textTertiary = ghostMode ? "rgba(160,160,160,0.35)" : "rgba(255,255,255,0.35)";
  const cardBorder = ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,255,255,0.08)";

  // Scan line animation
  useEffect(() => {
    if (!isScanning) return;
    const animate = () => {
      scanLineRef.current = (scanLineRef.current + 0.6) % 100;
      setScanY(scanLineRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isScanning]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setCurrentPhoto(e.target?.result as string);
      setScanComplete(false);
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
        setScanComplete(true);
      }, 2800);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // Dynamic projected stats based on velocity
  const projectedStats = [
    { label: "Body Fat", current: "18%", projected: "14%", delta: "-4%", improving: true },
    { label: "Lean Mass", current: "156 lbs", projected: "162 lbs", delta: "+6 lbs", improving: true },
    { label: "VO2 Max", current: "42", projected: "48", delta: "+14%", improving: true },
  ];

  // Stat delta color based on improving or not
  function getDeltaColor(improving: boolean): string {
    if (ghostMode) return "rgba(160,160,160,0.5)";
    return improving ? "#30D158" : "#FF453A";
  }

  return (
    <>
      {/* ── COMPACT CARD ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="rounded-2xl relative overflow-hidden cursor-pointer group"
        onClick={() => setIsExpanded(true)}
        style={{
          background: ghostMode ? "rgba(8,8,12,0.5)" : "rgba(8,8,12,0.65)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: `1px solid ${cardBorder}`,
        }}
      >
        {/* Top accent line — uses status color */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${statusColor}, transparent)`,
            opacity: ghostMode ? 0.15 : 0.5,
          }}
        />

        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Photo thumbnail or capture prompt */}
            <div
              className="relative w-[72px] h-[96px] rounded-xl overflow-hidden flex-shrink-0"
              style={{
                background: currentPhoto ? "transparent" : "rgba(255,255,255,0.02)",
                border: `1.5px ${currentPhoto ? "solid" : "dashed"} ${currentPhoto ? cardBorder : "rgba(255,255,255,0.1)"}`,
              }}
            >
              {currentPhoto ? (
                <>
                  <img src={currentPhoto} alt="Progress" className="w-full h-full object-cover" />
                  <div
                    className="absolute bottom-1 left-1 right-1 py-0.5 rounded-md text-center"
                    style={{
                      background: "rgba(0,0,0,0.65)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <span className="text-[8px] font-mono font-bold tracking-wider" style={{ color: textSecondary }}>
                      DAY 1
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Capture
                  </span>
                </div>
              )}
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                  style={{
                    color: textSecondary,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}>
                  Visual Metric
                </span>
                {scanComplete && (
                  <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>
                    ✓ Analyzed
                  </span>
                )}
              </div>

              <h3 className="text-[16px] font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
                Visual Progress
              </h3>

              {/* ── STATUS INDICATOR (replaces Biological Velocity glow) ── */}
              <motion.div
                className="flex items-center gap-2 mt-1.5"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div
                  className="flex items-center gap-1.5 px-2 py-[3px] rounded-full"
                  style={{
                    background: statusBg,
                    border: `1px solid ${statusBorder}`,
                  }}
                >
                  <span className="text-[10px]">{velocity.icon}</span>
                  <span
                    className="text-[10px] font-semibold tracking-wide"
                    style={{ color: statusColor }}
                  >
                    {statusLabel}
                  </span>
                  {velocity.delta !== 0 && (
                    <span
                      className="text-[9px] font-mono font-bold"
                      style={{ color: statusColor }}
                    >
                      {velocity.delta > 0 ? "+" : ""}{velocity.delta}%
                    </span>
                  )}
                </div>

                {/* Micro sparkline dots for recent trend */}
                {vitalityScores && vitalityScores.length >= 3 && (
                  <div className="flex items-end gap-[2px] h-3">
                    {vitalityScores.slice(-7).map((s: any, i: number) => {
                      const score = s.overallScore ?? s.vitalityScore ?? 50;
                      const h = Math.max(3, (score / 100) * 12);
                      const isLast = i === vitalityScores.slice(-7).length - 1;
                      return (
                        <div
                          key={i}
                          className="rounded-full transition-all duration-300"
                          style={{
                            width: 2,
                            height: h,
                            background: isLast
                              ? statusColor
                              : ghostMode ? "rgba(160,160,160,0.2)" : "rgba(255,255,255,0.15)",
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </motion.div>

              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: textSecondary }}>
                {currentPhoto
                  ? "Tap to view transformation timeline & projection"
                  : "Capture your starting point to track transformation"
                }
              </p>

              {/* Mini stats row when photo exists */}
              {scanComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="flex items-center gap-3 mt-2"
                >
                  {projectedStats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-1">
                      <span className="text-[10px] font-mono" style={{ color: textTertiary }}>{stat.label}</span>
                      <span className="text-[10px] font-bold font-mono"
                        style={{ color: getDeltaColor(stat.improving) }}>
                        {stat.delta}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Expand arrow */}
            <div className="flex-shrink-0 mt-1">
              <motion.div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                whileHover={{ background: "rgba(255,255,255,0.08)" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3L9 7L5 11" />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── EXPANDED MODAL ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: "rgba(0,0,0,0.8)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
              }}
              onClick={() => setIsExpanded(false)}
            />

            {/* Modal content */}
            <motion.div
              className="relative w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 30 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{
                background: "rgba(8,8,8,0.95)",
                border: `1px solid ${cardBorder}`,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
                      style={{
                        color: textSecondary,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}>
                      Visual Metric
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight" style={{ color: textPrimary }}>
                    Visual Progress
                  </h2>

                  {/* ── Status Display ── */}
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{
                        background: statusBg,
                        border: `1px solid ${statusBorder}`,
                      }}
                    >
                      <span className="text-[12px]">{velocity.icon}</span>
                      <span
                        className="text-[11px] font-semibold tracking-wide"
                        style={{ color: statusColor }}
                      >
                        {statusLabel}
                      </span>
                      {velocity.delta !== 0 && (
                        <span className="text-[10px] font-mono font-bold" style={{ color: statusColor }}>
                          {velocity.delta > 0 ? "+" : ""}{velocity.delta}%
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: textTertiary }}>
                      Biological Velocity
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 16 }}>&#x2715;</span>
                </button>
              </div>

              {/* Before / After comparison */}
              <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-4">
                  {/* BEFORE: Current Photo */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full"
                        style={{ background: currentPhoto ? statusColor : "rgba(255,255,255,0.2)" }}
                      />
                      <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: textTertiary }}>
                        Day 0 — Current
                      </span>
                    </div>

                    <div
                      className="relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: `1.5px ${currentPhoto ? "solid" : "dashed"} ${dragOver ? "rgba(255,255,255,0.3)" : currentPhoto ? cardBorder : "rgba(255,255,255,0.1)"}`,
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                        }}
                      />

                      {currentPhoto ? (
                        <>
                          <img src={currentPhoto} alt="Current" className="w-full h-full object-cover" />
                          {isScanning && (
                            <>
                              <div className="absolute inset-0" style={{
                                backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                                backgroundSize: "16px 16px",
                                opacity: 0.6,
                              }} />
                              <div className="absolute left-0 right-0 h-[2px] pointer-events-none"
                                style={{
                                  top: `${scanY}%`,
                                  background: `linear-gradient(90deg, transparent, ${statusColor}, transparent)`,
                                }}
                              />
                            </>
                          )}
                          <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full"
                            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: textSecondary }}>Day 0</span>
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[12px] font-medium" style={{ color: textSecondary }}>Upload Photo</span>
                            <span className="text-[9px] font-mono" style={{ color: textTertiary }}>Tap or drag</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AFTER: AI Projection */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full"
                        style={{ background: scanComplete ? "#30D158" : "rgba(255,255,255,0.2)" }}
                      />
                      <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: textTertiary }}>
                        Day 90 — Projected
                      </span>
                    </div>

                    <div
                      className="relative aspect-[3/4] rounded-xl overflow-hidden"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: `1.5px solid ${scanComplete ? "rgba(48,209,88,0.15)" : cardBorder}`,
                      }}
                    >
                      {!currentPhoto && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                          </div>
                          <span className="text-[11px] font-light text-center px-4" style={{ color: textTertiary }}>
                            Projection appears after upload
                          </span>
                        </div>
                      )}

                      {isScanning && currentPhoto && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                          <div className="absolute inset-0" style={{
                            backgroundImage: `url(${currentPhoto})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            filter: "blur(16px) brightness(0.3) saturate(0.5)",
                            opacity: 0.5,
                          }} />
                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="relative w-10 h-10">
                              <motion.div className="absolute inset-0 rounded-full"
                                style={{ border: "2px solid rgba(255,255,255,0.1)", borderTopColor: statusColor }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              />
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: textSecondary }}>
                              Projecting...
                            </span>
                            <motion.div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <motion.div className="h-full rounded-full"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 2.6, ease: "easeInOut" }}
                                style={{ background: statusColor }}
                              />
                            </motion.div>
                          </div>
                        </div>
                      )}

                      {scanComplete && currentPhoto && (
                        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
                          <div className="absolute inset-0" style={{
                            backgroundImage: `url(${currentPhoto})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            filter: "contrast(1.1) saturate(1.15) brightness(1.05)",
                          }} />
                          <div className="absolute inset-0" style={{
                            background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)",
                          }} />
                          <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full"
                            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(48,209,88,0.2)" }}>
                            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: "#30D158" }}>Day 90</span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>Body Fat</span>
                                <span className="text-[13px] font-semibold" style={{ color: "#30D158" }}>-4%</span>
                              </div>
                              <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.1)" }} />
                              <div className="flex flex-col">
                                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>Lean Mass</span>
                                <span className="text-[13px] font-semibold" style={{ color: "#30D158" }}>+6 lbs</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── VELOCITY DETAIL PANEL ── */}
              <motion.div
                className="px-6 pb-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <div className="rounded-xl p-4" style={{
                  background: statusBg,
                  border: `1px solid ${statusBorder}`,
                }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-mono uppercase tracking-[0.15em]" style={{ color: textSecondary }}>
                      Biological Velocity
                    </span>
                    <div
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                      style={{
                        background: statusBg,
                        border: `1px solid ${statusBorder}`,
                      }}
                    >
                      <span className="text-[10px]">{velocity.icon}</span>
                      <span className="text-[11px] font-semibold" style={{ color: statusColor }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Velocity bar */}
                  <div className="relative h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <motion.div
                      className="absolute top-0 left-0 h-full rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.min(100, Math.max(5, 50 + velocity.delta))}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                      style={{
                        background: statusColor,
                      }}
                    />
                    {/* Center marker (baseline) */}
                    <div className="absolute top-0 left-1/2 w-px h-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono" style={{ color: "#FF453A" }}>Needs Attention</span>
                    <span className="text-[9px] font-mono" style={{ color: "#FFD60A" }}>Steady</span>
                    <span className="text-[9px] font-mono" style={{ color: "#30D158" }}>Improving</span>
                  </div>
                </div>
              </motion.div>

              {/* Projected Stats Cards */}
              {scanComplete && (
                <motion.div
                  className="px-6 pb-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <div className="rounded-xl p-4" style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${cardBorder}`,
                  }}>
                    <span className="text-[9px] font-mono uppercase tracking-[0.15em] block mb-3" style={{ color: textTertiary }}>
                      90-Day Projection
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      {projectedStats.map((stat) => (
                        <div key={stat.label} className="flex flex-col items-center gap-1 p-2 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.02)" }}>
                          <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>{stat.label}</span>
                          <span className="text-[16px] font-bold font-mono tabular-nums"
                            style={{ color: getDeltaColor(stat.improving) }}>
                            {stat.delta}
                          </span>
                          <span className="text-[8px] font-mono" style={{ color: textTertiary }}>
                            {stat.current} → {stat.projected}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Protocol Summary */}
              {scanComplete && (
                <motion.div
                  className="px-6 pb-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <div className="rounded-xl p-4" style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${cardBorder}`,
                  }}>
                    <span className="text-[9px] font-mono uppercase tracking-[0.15em] block mb-3" style={{ color: textTertiary }}>
                      Recommended Protocol
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Nutrition", value: "2,400 cal", sub: "High protein" },
                        { label: "Training", value: "5x/week", sub: "Strength + Zone 2" },
                        { label: "Recovery", value: "7.5h sleep", sub: "Cold 3x/week" },
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>{item.label}</span>
                          <span className="text-[14px] font-medium" style={{ color: textPrimary }}>{item.value}</span>
                          <span className="text-[10px]" style={{ color: textTertiary }}>{item.sub}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Upload CTA when no photo */}
              {!currentPhoto && (
                <div className="px-6 pb-6">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3.5 rounded-xl font-mono uppercase tracking-[0.12em] text-[12px] font-semibold transition-all duration-300 active:scale-[0.98]"
                    style={{
                      background: statusBg,
                      border: `1.5px solid ${statusBorder}`,
                      color: statusColor,
                    }}
                  >
                    Capture Starting Point
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
