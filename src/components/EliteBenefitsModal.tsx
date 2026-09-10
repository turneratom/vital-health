import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ── Elite Feature Definitions ── */
interface EliteFeature {
  icon: string;
  title: string;
  description: string;
  color: string;
  tag?: string;
}

const ELITE_FEATURES: EliteFeature[] = [
  {
    icon: "🧬",
    title: "Advanced Bio-Analytics",
    description: "Deep biomarker trend analysis with age/sex-adjusted optimal zones, longitudinal tracking, and predictive health scoring.",
    color: "#00F0FF",
    tag: "Flagship",
  },
  {
    icon: "⏳",
    title: "Biological Age Tracking",
    description: "Track your biological age vs chronological age using epigenetic markers, telomere estimates, and multi-biomarker aging algorithms.",
    color: "#FF6BFF",
    tag: "New",
  },
  {
    icon: "🔬",
    title: "InsightBridge AI",
    description: "AI-powered correlations between your protocols, biomarkers, and wearable data. Discover what actually moves the needle.",
    color: "#A78BFA",
    tag: "AI-Powered",
  },
  {
    icon: "🎯",
    title: "Concierge Support",
    description: "1-on-1 access to a dedicated health optimization specialist. Personalized protocol reviews, lab interpretation, and quarterly strategy calls.",
    color: "#34D399",
    tag: "Premium",
  },
  {
    icon: "🛡️",
    title: "Priority Support",
    description: "Direct access to our optimization specialists. 24-hour response SLA with personalized protocol adjustments.",
    color: "#10B981",
  },
  {
    icon: "📊",
    title: "Raw Lab Data Access",
    description: "Full access to your Bio-Vault with raw lab values, genetic markers (MTHFR, APOE4), and exportable reports.",
    color: "#F59E0B",
  },
  {
    icon: "🏋️",
    title: "GATT Performance Charts",
    description: "Advanced training load analysis with recovery prediction, muscle group heat maps, and periodization insights.",
    color: "#EF4444",
  },
  {
    icon: "🌐",
    title: "Peer Network Access",
    description: "Connect with high-performers in your tier. Share protocols, compare biomarkers, and join accountability pods.",
    color: "#06B6D4",
  },
];

/* ── Comparison Table ── */
const COMPARISON = [
  { feature: "Daily Protocol Stack", core: true, elite: true },
  { feature: "Voice Journal", core: true, elite: true },
  { feature: "Basic Health Summary", core: true, elite: true },
  { feature: "Wearable Integrations", core: "2 devices", elite: "Unlimited" },
  { feature: "Bio-Vault Lab Storage", core: false, elite: true },
  { feature: "Advanced Bio-Analytics", core: false, elite: true },
  { feature: "Biological Age Tracking", core: false, elite: true },
  { feature: "InsightBridge AI", core: false, elite: true },
  { feature: "Concierge Support", core: false, elite: true },
  { feature: "Genetic Insights", core: false, elite: true },
  { feature: "GATT Charts", core: false, elite: true },
  { feature: "Peer Network", core: false, elite: true },
  { feature: "Priority Support", core: false, elite: true },
  { feature: "Weekly Blueprint Report", core: false, elite: true },
];

/* ── Props ── */
interface EliteBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  currentTier: "core" | "elite";
  ghostMode?: boolean;
}

export function EliteBenefitsModal({
  isOpen,
  onClose,
  onUpgrade,
  currentTier,
  ghostMode = false,
}: EliteBenefitsModalProps) {
  const [activeTab, setActiveTab] = useState<"features" | "compare">("features");

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  const neon = ghostMode ? "rgba(160,160,160," : "rgba(0,240,255,";
  const accent = ghostMode ? "rgba(160,160,160,0.5)" : "#00F0FF";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(12px)",
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.35, type: "spring", damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl"
            style={{
              background: ghostMode
                ? "linear-gradient(180deg, #0c0c0c 0%, #080808 100%)"
                : "linear-gradient(180deg, #0a0a0f 0%, #050508 100%)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,240,255,0.1)"}`,
              boxShadow: ghostMode
                ? "0 -8px 40px rgba(0,0,0,0.5)"
                : "0 -8px 60px rgba(0,240,255,0.08), 0 0 120px rgba(0,240,255,0.03)",
            }}
          >
            {/* Top glow line */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-200"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[90vh] pb-6">
              {/* Header */}
              <div className="px-6 pt-8 pb-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,240,255,0.08)",
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,240,255,0.15)"}`,
                      boxShadow: ghostMode ? "none" : "0 0 20px rgba(0,240,255,0.1)",
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={accent} />
                    </svg>
                  </div>
                  <div>
                    <h2
                      className="text-lg font-bold tracking-wide"
                      style={{ color: ghostMode ? "rgba(220,220,220,0.9)" : "rgba(255,255,255,0.95)" }}
                    >
                      Elite Membership
                    </h2>
                    <p
                      className="text-[10px] font-mono uppercase tracking-[0.15em]"
                      style={{ color: `${neon}0.5)` }}
                    >
                      {currentTier === "elite" ? "Currently Active" : "Unlock Full Potential"}
                    </p>
                  </div>
                </div>

                {currentTier === "core" && (
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.45)" }}
                  >
                    Upgrade to Elite for advanced bio-analytics, AI-powered insights, genetic marker access, and priority support from our optimization team.
                  </p>
                )}
              </div>

              {/* Tab Switcher */}
              <div className="px-6 mb-5">
                <div
                  className="flex rounded-xl overflow-hidden"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)"}`,
                  }}
                >
                  {(["features", "compare"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="flex-1 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-all duration-300 relative"
                      style={{
                        color: activeTab === tab
                          ? (ghostMode ? "rgba(220,220,220,0.9)" : "rgba(255,255,255,0.95)")
                          : (ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)"),
                        background: activeTab === tab
                          ? (ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,240,255,0.06)")
                          : "transparent",
                      }}
                    >
                      {tab === "features" ? "Elite Features" : "Core vs Elite"}
                      {activeTab === tab && (
                        <motion.div
                          layoutId="elite-tab-indicator"
                          className="absolute bottom-0 left-2 right-2 h-px"
                          style={{ background: accent }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Features Tab */}
              <AnimatePresence mode="wait">
                {activeTab === "features" && (
                  <motion.div
                    key="features"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.2 }}
                    className="px-6 flex flex-col gap-3"
                  >
                    {ELITE_FEATURES.map((feature, i) => (
                      <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="rounded-xl border p-4"
                        style={{
                          background: ghostMode
                            ? "rgba(160,160,160,0.02)"
                            : `linear-gradient(135deg, ${feature.color}05 0%, rgba(255,255,255,0.01) 100%)`,
                          borderColor: ghostMode
                            ? "rgba(160,160,160,0.05)"
                            : `${feature.color}12`,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                            style={{
                              background: ghostMode ? "rgba(160,160,160,0.04)" : `${feature.color}0a`,
                              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : `${feature.color}15`}`,
                            }}
                          >
                            {feature.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-xs font-semibold tracking-wide"
                                style={{ color: ghostMode ? "rgba(220,220,220,0.8)" : "rgba(255,255,255,0.9)" }}
                              >
                                {feature.title}
                              </span>
                              {feature.tag && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[7px] font-mono uppercase tracking-wider"
                                  style={{
                                    background: ghostMode ? "rgba(160,160,160,0.06)" : `${feature.color}12`,
                                    color: ghostMode ? "rgba(160,160,160,0.4)" : `${feature.color}`,
                                    border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${feature.color}20`}`,
                                  }}
                                >
                                  {feature.tag}
                                </span>
                              )}
                            </div>
                            <p
                              className="text-[10px] leading-relaxed"
                              style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.35)" }}
                            >
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* Compare Tab */}
                {activeTab === "compare" && (
                  <motion.div
                    key="compare"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    className="px-6"
                  >
                    <div
                      className="rounded-xl border overflow-hidden"
                      style={{
                        background: ghostMode ? "rgba(160,160,160,0.02)" : "rgba(255,255,255,0.01)",
                        borderColor: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)",
                      }}
                    >
                      {/* Table Header */}
                      <div
                        className="grid grid-cols-[1fr_60px_60px] px-4 py-3 border-b"
                        style={{
                          borderColor: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)",
                          background: ghostMode ? "rgba(160,160,160,0.02)" : "rgba(255,255,255,0.015)",
                        }}
                      >
                        <span
                          className="text-[9px] font-mono uppercase tracking-wider"
                          style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.3)" }}
                        >
                          Feature
                        </span>
                        <span
                          className="text-[9px] font-mono uppercase tracking-wider text-center"
                          style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.3)" }}
                        >
                          Core
                        </span>
                        <span
                          className="text-[9px] font-mono uppercase tracking-wider text-center"
                          style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : accent }}
                        >
                          Elite
                        </span>
                      </div>

                      {/* Table Rows */}
                      {COMPARISON.map((row, i) => (
                        <div
                          key={row.feature}
                          className="grid grid-cols-[1fr_60px_60px] px-4 py-2.5 border-b last:border-b-0"
                          style={{
                            borderColor: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(255,255,255,0.02)",
                            background: i % 2 === 0 ? "transparent" : (ghostMode ? "rgba(160,160,160,0.01)" : "rgba(255,255,255,0.005)"),
                          }}
                        >
                          <span
                            className="text-[10px]"
                            style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,255,255,0.5)" }}
                          >
                            {row.feature}
                          </span>
                          <div className="flex items-center justify-center">
                            {row.core === true ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(100,200,100,0.4)" : "#34D399"} strokeWidth="3" strokeLinecap="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            ) : row.core === false ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(160,160,160,0.15)" : "rgba(255,255,255,0.1)"} strokeWidth="2" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            ) : (
                              <span
                                className="text-[8px] font-mono"
                                style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.3)" }}
                              >
                                {row.core}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-center">
                            {row.elite === true ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(100,200,100,0.6)" : accent} strokeWidth="3" strokeLinecap="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            ) : (
                              <span
                                className="text-[8px] font-mono"
                                style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : accent }}
                              >
                                {row.elite}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA */}
              <div className="px-6 pt-6">
                {currentTier === "core" ? (
                  <button
                    onClick={() => {
                      onUpgrade();
                      onClose();
                    }}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300"
                    style={{
                      background: ghostMode
                        ? "rgba(160,160,160,0.12)"
                        : "linear-gradient(135deg, rgba(0,240,255,0.2) 0%, rgba(0,240,255,0.08) 100%)",
                      color: ghostMode ? "rgba(220,220,220,0.9)" : "#00F0FF",
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.2)" : "rgba(0,240,255,0.3)"}`,
                      boxShadow: ghostMode ? "none" : "0 0 24px rgba(0,240,255,0.12), inset 0 1px 0 rgba(0,240,255,0.15)",
                    }}
                  >
                    Upgrade to Elite
                  </button>
                ) : (
                  <div
                    className="w-full py-3 rounded-xl text-center text-xs font-mono uppercase tracking-wider"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(0,240,255,0.04)",
                      color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(0,240,255,0.5)",
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,240,255,0.1)"}`,
                    }}
                  >
                    ✦ You have Elite Access
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
