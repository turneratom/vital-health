import { motion } from "framer-motion";

/* ══════════════════════════════════════════════════════════════ */
/*  FreemiumGate — Glass-morphism blur overlay with gold lock   */
/*  Wraps any section to show it blurred for non-Elite users    */
/* ══════════════════════════════════════════════════════════════ */

const WARM = {
  gold: "#C4A46C",
  goldLight: "#D4B87C",
  textPrimary: "#E8E0D8",
  textDim: "#8A7E72",
};

interface FreemiumGateProps {
  children: React.ReactNode;
  isElite: boolean;
  featureLabel?: string;
  ghostMode?: boolean;
}

export function FreemiumGate({ children, isElite, featureLabel = "This feature", ghostMode = false }: FreemiumGateProps) {
  if (isElite) return <>{children}</>;

  return (
    <div className="relative">
      {/* Render the actual content underneath */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: "blur(6px) saturate(0.5)", opacity: 0.6 }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Glass-morphism overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl"
        style={{
          background: ghostMode
            ? "rgba(10,10,10,0.35)"
            : "rgba(18,16,14,0.3)",
          backdropFilter: "blur(8px) saturate(0.7)",
          WebkitBackdropFilter: "blur(8px) saturate(0.7)",
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(196,164,108,0.12)"}`,
        }}
      >
        {/* Gold lock icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col items-center gap-3"
        >
          {/* Lock circle */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: ghostMode
                ? "rgba(160,160,160,0.06)"
                : `linear-gradient(135deg, ${WARM.gold}18, ${WARM.gold}08)`,
              border: `1.5px solid ${ghostMode ? "rgba(160,160,160,0.12)" : `${WARM.gold}30`}`,
              boxShadow: ghostMode
                ? "none"
                : `0 0 24px ${WARM.gold}10, 0 4px 16px rgba(0,0,0,0.2)`,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={ghostMode ? "rgba(160,160,160,0.4)" : WARM.gold}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16" r="1" fill={ghostMode ? "rgba(160,160,160,0.4)" : WARM.gold} />
            </svg>
          </div>

          {/* Label */}
          <div className="text-center px-6">
            <p
              className="text-[12px] font-semibold mb-1"
              style={{ color: ghostMode ? "rgba(160,160,160,0.6)" : WARM.gold }}
            >
              Elite Feature
            </p>
            <p
              className="text-[10px] leading-relaxed max-w-[200px]"
              style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : WARM.textDim }}
            >
              {featureLabel} requires an Elite membership
            </p>
          </div>

          {/* Upgrade button */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="mt-1 px-5 py-2 rounded-full text-[11px] font-bold tracking-wide transition-all duration-200"
            style={{
              background: ghostMode
                ? "rgba(160,160,160,0.08)"
                : `linear-gradient(135deg, ${WARM.gold}25, ${WARM.goldLight}15)`,
              color: ghostMode ? "rgba(160,160,160,0.5)" : WARM.gold,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : `${WARM.gold}35`}`,
              boxShadow: ghostMode
                ? "none"
                : `0 2px 12px ${WARM.gold}12`,
            }}
          >
            Upgrade to Elite
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
