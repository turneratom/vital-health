import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useUserStyle } from '@/lib/useUserStyle';
import { FreemiumGate } from '@/components/FreemiumGate';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { motion, AnimatePresence } from 'framer-motion';
import { EliteBenefitsModal } from '@/components/EliteBenefitsModal';
import { ConciergeGateway } from '@/components/ConciergeGateway';

/* ══════════════════════════════════════════════════════════════ */
/*  ACCESS CONTROLLER — Membership Tier Gating System            */
/*                                                                */
/*  Reads userPreferences.userStyle from Convex to determine     */
/*  Core vs Elite tier. Gates InsightBridge, Advanced Bio-        */
/*  Analytics, and Peer Network visibility behind Elite.          */
/*                                                                */
/*  When a Core user tries to access gated features, shows a     */
/*  premium upsell card highlighting deep biological insights.   */
/* ══════════════════════════════════════════════════════════════ */

const WARM = {
  gold: '#C4A46C',
  goldLight: '#D4B87C',
  goldDim: '#A08A5C',
  textPrimary: '#E8E0D8',
  textSecondary: '#B8AFA6',
  textDim: '#8A7E72',
  surface: 'rgba(26,24,22,0.95)',
  surfaceLight: 'rgba(42,38,34,0.6)',
  border: 'rgba(196,164,108,0.15)',
  borderLight: 'rgba(196,164,108,0.08)',
};

export type MembershipTier = 'core' | 'elite';

interface AccessContext {
  tier: MembershipTier;
  isElite: boolean;
  isCore: boolean;
  /** Check if a specific feature is accessible */
  canAccess: (feature: GatedFeature) => boolean;
  /** Upgrade the user to Elite tier */
  upgradeTier: () => Promise<void>;
  /** Whether an upgrade is in progress */
  isUpgrading: boolean;
}

/** Features that require Elite tier */
export type GatedFeature =
  | 'insight-bridge'
  | 'advanced-bio-analytics'
  | 'peer-network'
  | 'dna-insights'
  | 'blueprint-builder'
  | 'weekly-report'
  | 'biometrics-deep-dive'
  | 'biological-age-tracking'
  | 'concierge-support'
  | 'bio-vault'
  | 'performance-timeline'
  | 'exhaustive-blood-panel';

/** Map of which features require Elite */
const ELITE_FEATURES: Set<GatedFeature> = new Set([
  'insight-bridge',
  'advanced-bio-analytics',
  'peer-network',
  'dna-insights',
  'blueprint-builder',
  'weekly-report',
  'biometrics-deep-dive',
  'biological-age-tracking',
  'concierge-support',
  'bio-vault',
  'performance-timeline',
  'exhaustive-blood-panel',
]);

/** Tier 2 features — require Elite + Concierge Coach coordination */
const TIER_2_FEATURES: Set<GatedFeature> = new Set([
  'exhaustive-blood-panel',
  'concierge-support',
]);

/** Check if a feature is Tier 2 (requires Concierge Gateway) */
export function isTier2Feature(feature: GatedFeature): boolean {
  return TIER_2_FEATURES.has(feature);
}

const AccessCtx = createContext<AccessContext>({
  tier: 'core',
  isElite: false,
  isCore: true,
  canAccess: () => false,
  upgradeTier: async () => {},
  isUpgrading: false,
});

function getSessionId(): string {
  if (typeof window === 'undefined') return 'default';
  let id = sessionStorage.getItem('vive-session-id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('vive-session-id', id);
  }
  return id;
}

/* ── Provider ── */
export function AccessControllerProvider({ children }: { children: ReactNode }) {
  const sessionId = getSessionId();
  const localStyle = useUserStyle();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showUpgradeFlash, setShowUpgradeFlash] = useState(false);

  // Query Convex for persisted user preferences (subscription tier)
  const prefs = useQuery((api.queries as any).listUserPreferences, sessionId ? { sessionId } : 'skip') as any;
  const updatePrefs = useMutation(api.mutations.upsertUserPreference);

  const upgradeTier = useCallback(async () => {
    setIsUpgrading(true);
    try {
      await updatePrefs({
        sessionId,
        userStyle: 'elite',
      });
      setShowUpgradeFlash(true);
      setTimeout(() => setShowUpgradeFlash(false), 2500);
    } finally {
      setIsUpgrading(false);
    }
  }, [updatePrefs, sessionId]);

  const ctx = useMemo<AccessContext>(() => {
    // Prefer Convex-persisted style, fall back to local session state
    const rawStyle = prefs?.userStyle ?? localStyle;
    const tier: MembershipTier = rawStyle === 'elite' ? 'elite' : 'core';
    const isElite = tier === 'elite';

    return {
      tier,
      isElite,
      isCore: !isElite,
      canAccess: (feature: GatedFeature) => {
        if (!ELITE_FEATURES.has(feature)) return true;
        return isElite;
      },
      upgradeTier,
      isUpgrading,
    };
  }, [prefs?.userStyle, localStyle, upgradeTier, isUpgrading]);

  return (
    <AccessCtx.Provider value={ctx}>
      {children}
      {/* Elite Upgrade Flash Overlay */}
      <AnimatePresence>
        {showUpgradeFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
          >
            {/* Gold radial burst */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 3, opacity: [0, 0.4, 0] }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute w-[200px] h-[200px] rounded-full"
              style={{ background: `radial-gradient(circle, ${WARM.gold}40 0%, transparent 70%)` }}
            />
            {/* Badge */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative flex flex-col items-center gap-3"
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${WARM.gold}30, ${WARM.gold}10)`,
                  border: `2px solid ${WARM.gold}50`,
                  boxShadow: `0 0 60px ${WARM.gold}30, 0 0 120px ${WARM.gold}15`,
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                    fill={WARM.gold}
                    stroke={WARM.goldLight}
                    strokeWidth="1"
                  />
                </svg>
              </div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-[14px] font-bold tracking-[0.2em]"
                style={{ color: WARM.gold, textShadow: `0 0 20px ${WARM.gold}40` }}
              >
                ELITE UNLOCKED
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AccessCtx.Provider>
  );
}

/* ── Hook ── */
export function useAccessTier(): AccessContext {
  return useContext(AccessCtx);
}

/* ══════════════════════════════════════════════════════════════ */
/*  TIER BADGE — Compact indicator for header/profile           */
/* ══════════════════════════════════════════════════════════════ */

interface TierBadgeProps {
  size?: 'sm' | 'md';
  ghostMode?: boolean;
  /** If true, tapping the badge opens the Elite Benefits modal */
  showModalOnTap?: boolean;
}

export function TierBadge({ size = 'sm', ghostMode = false, showModalOnTap = false }: TierBadgeProps) {
  const { tier, isElite, isCore } = useAccessTier();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { upgradeTier } = useAccessTier();
  const isSm = size === 'sm';

  const badgeContent = (
    <motion.div
      layout
      whileHover={showModalOnTap && isCore ? { scale: 1.05 } : undefined}
      whileTap={showModalOnTap && isCore ? { scale: 0.97 } : undefined}
      onClick={showModalOnTap && isCore ? () => setIsModalOpen(true) : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full${showModalOnTap && isCore ? ' cursor-pointer' : ''}`}
      style={{
        padding: isSm ? '2px 8px' : '3px 10px',
        background: isElite
          ? (ghostMode ? 'rgba(160,160,160,0.06)' : `linear-gradient(135deg, ${WARM.gold}18, ${WARM.gold}08)`)
          : (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.4)'),
        border: `1px solid ${
          isElite
            ? (ghostMode ? 'rgba(160,160,160,0.12)' : `${WARM.gold}30`)
            : (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.6)')
        }`,
        boxShadow: isElite && !ghostMode ? `0 0 12px ${WARM.gold}10` : 'none',
      }}
    >
      {isElite ? (
        <svg width={isSm ? 10 : 12} height={isSm ? 10 : 12} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill={ghostMode ? 'rgba(160,160,160,0.4)' : WARM.gold}
            strokeWidth="0"
          />
        </svg>
      ) : (
        <div
          className="rounded-full"
          style={{
            width: isSm ? 6 : 8,
            height: isSm ? 6 : 8,
            background: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(100,100,100,0.4)',
          }}
        />
      )}
      <span
        className="font-bold tracking-wider"
        style={{
          fontSize: isSm ? 9 : 10,
          color: isElite
            ? (ghostMode ? 'rgba(160,160,160,0.5)' : WARM.gold)
            : (ghostMode ? 'rgba(160,160,160,0.35)' : WARM.textDim),
        }}
      >
        {tier.toUpperCase()}
      </span>
      {/* Upgrade hint for Core users */}
      {showModalOnTap && isCore && (
        <svg width={isSm ? 8 : 10} height={isSm ? 8 : 10} viewBox="0 0 24 24" fill="none" stroke={ghostMode ? 'rgba(160,160,160,0.25)' : WARM.textDim} strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </motion.div>
  );

  return (
    <>
      {badgeContent}
      {showModalOnTap && (
        <EliteBenefitsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpgrade={upgradeTier}
          currentTier={tier}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  PREMIUM UPSELL CARD — Shown when Core users hit a gate      */
/*  Highlights the value of deep biological insights             */
/* ══════════════════════════════════════════════════════════════ */

interface UpsellBenefit {
  icon: string;
  title: string;
  description: string;
}

const UPSELL_BENEFITS: UpsellBenefit[] = [
  {
    icon: '🧬',
    title: 'InsightBridge Analytics',
    description: 'AI-powered biomarker analysis that detects suboptimal ranges and auto-adjusts your protocol stack in real-time.',
  },
  {
    icon: '🔬',
    title: 'Advanced Bio-Analytics',
    description: 'Deep-dive into your biological velocity — track Vitamin D, Testosterone, Ferritin, CRP, and HbA1c against elite ranges.',
  },
  {
    icon: '👥',
    title: 'Peer Network Access',
    description: 'Connect with high-performers. See real-time recovery scores, strain data, and HRV trends across your elite network.',
  },
  {
    icon: '📊',
    title: 'Weekly Intelligence Reports',
    description: 'Automated performance summaries with trend analysis, protocol adherence scoring, and personalized optimization recommendations.',
  },
];

interface PremiumUpsellCardProps {
  featureLabel?: string;
  ghostMode?: boolean;
  onDismiss?: () => void;
}

export function PremiumUpsellCard({ featureLabel = 'This feature', ghostMode = false, onDismiss }: PremiumUpsellCardProps) {
  const [hoveredBenefit, setHoveredBenefit] = useState<number | null>(null);
  const { upgradeTier, isUpgrading } = useAccessTier();

  const handleUpgrade = useCallback(async () => {
    await upgradeTier();
    onDismiss?.();
  }, [upgradeTier, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="relative overflow-hidden rounded-3xl mx-4 my-6"
      style={{
        background: ghostMode
          ? 'linear-gradient(145deg, rgba(18,18,18,0.95) 0%, rgba(12,12,12,0.98) 100%)'
          : `linear-gradient(145deg, rgba(26,24,22,0.97) 0%, rgba(18,16,14,0.98) 100%)`,
        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : WARM.border}`,
        boxShadow: ghostMode
          ? '0 24px 80px rgba(0,0,0,0.4)'
          : `0 24px 80px rgba(0,0,0,0.4), 0 0 60px ${WARM.gold}06, inset 0 1px 0 rgba(255,255,255,0.02)`,
      }}
    >
      {/* Ambient gold glow */}
      {!ghostMode && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full"
            style={{ background: `radial-gradient(ellipse, ${WARM.gold}08 0%, transparent 70%)` }}
          />
          <div
            className="absolute bottom-0 right-0 w-[300px] h-[200px] rounded-full"
            style={{ background: `radial-gradient(ellipse, ${WARM.gold}04 0%, transparent 70%)` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Elite badge */}
            <motion.div
              animate={{ boxShadow: [`0 0 24px ${WARM.gold}10`, `0 0 36px ${WARM.gold}20`, `0 0 24px ${WARM.gold}10`] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: ghostMode
                  ? 'rgba(160,160,160,0.06)'
                  : `linear-gradient(135deg, ${WARM.gold}20, ${WARM.gold}08)`,
                border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${WARM.gold}30`}`,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  fill={ghostMode ? 'rgba(160,160,160,0.3)' : WARM.gold}
                  stroke={ghostMode ? 'rgba(160,160,160,0.4)' : WARM.goldLight}
                  strokeWidth="1"
                />
              </svg>
            </motion.div>
            <div>
              <h3
                className="text-[15px] font-bold tracking-tight"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.7)' : WARM.gold }}
              >
                Upgrade to Elite
              </h3>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.textDim }}
              >
                Unlock the full biological intelligence layer
              </p>
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.5)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(42,38,34,0.6)'}`,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke={ghostMode ? 'rgba(160,160,160,0.3)' : WARM.textDim} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Feature context */}
        <div
          className="rounded-xl px-4 py-3 mb-5"
          style={{
            background: ghostMode ? 'rgba(160,160,160,0.04)' : `${WARM.gold}08`,
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${WARM.gold}12`}`,
          }}
        >
          <p className="text-[12px] leading-relaxed" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : WARM.textSecondary }}>
            <span style={{ color: ghostMode ? 'rgba(160,160,160,0.6)' : WARM.gold, fontWeight: 600 }}>{featureLabel}</span>{' '}
            requires an Elite membership. Elite members get access to deep biological insights that drive protocol optimization and measurable health outcomes.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-1 gap-2.5 mb-6">
          {UPSELL_BENEFITS.map((benefit, i) => (
            <motion.div
              key={i}
              onMouseEnter={() => setHoveredBenefit(i)}
              onMouseLeave={() => setHoveredBenefit(null)}
              className="flex items-start gap-3 rounded-xl px-3.5 py-3 transition-all duration-200"
              style={{
                background: hoveredBenefit === i
                  ? (ghostMode ? 'rgba(160,160,160,0.04)' : `${WARM.gold}06`)
                  : 'transparent',
                border: `1px solid ${
                  hoveredBenefit === i
                    ? (ghostMode ? 'rgba(160,160,160,0.08)' : `${WARM.gold}15`)
                    : 'transparent'
                }`,
              }}
            >
              <span className="text-[18px] mt-0.5 flex-shrink-0">{benefit.icon}</span>
              <div className="min-w-0">
                <p
                  className="text-[12px] font-semibold mb-0.5"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.6)' : WARM.textPrimary }}
                >
                  {benefit.title}
                </p>
                <p
                  className="text-[10px] leading-relaxed"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : WARM.textDim }}
                >
                  {benefit.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Social proof */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex -space-x-2">
            {['🟢', '🔵', '🟡', '🟣'].map((dot, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[8px]"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.8)',
                  border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(26,24,22,1)'}`,
                }}
              >
                {dot}
              </div>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : WARM.textDim }}>
            <span style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : WARM.gold, fontWeight: 600 }}>2,847</span> members optimizing with Elite
          </p>
        </div>

        {/* CTA Button — wired to upgradeTier mutation */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleUpgrade}
          disabled={isUpgrading}
          className="w-full py-3.5 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-300 disabled:opacity-60"
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.08)'
              : `linear-gradient(135deg, ${WARM.gold}, ${WARM.goldLight})`,
            color: ghostMode ? 'rgba(160,160,160,0.5)' : '#0A0A08',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${WARM.goldLight}60`}`,
            boxShadow: ghostMode
              ? 'none'
              : `0 4px 20px ${WARM.gold}30, 0 0 40px ${WARM.gold}10`,
          }}
        >
          {isUpgrading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="inline-block w-4 h-4 border-2 rounded-full"
                style={{ borderColor: 'rgba(10,10,8,0.2)', borderTopColor: '#0A0A08' }}
              />
              Activating Elite...
            </span>
          ) : (
            'Unlock Elite Access'
          )}
        </motion.button>

        {/* Subtle pricing hint */}
        <p
          className="text-center text-[10px] mt-3"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.25)' : WARM.textDim }}
        >
          Starting at $29/mo · Cancel anytime · 7-day free trial
        </p>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  TIER GATE — Wraps content with FreemiumGate or UpsellCard   */
/* ══════════════════════════════════════════════════════════════ */

interface TierGateProps {
  feature: GatedFeature;
  featureLabel?: string;
  children: ReactNode;
  /** If true, shows the full upsell card instead of blur overlay */
  showUpsell?: boolean;
}

/**
 * Wraps children with FreemiumGate if the user lacks Elite access.
 * Shows a blurred preview with gold lock overlay for Core users.
 * When showUpsell=true, renders the premium upsell card instead.
 */
export function TierGate({ feature, featureLabel, children, showUpsell = false }: TierGateProps) {
  const { canAccess } = useAccessTier();
  const ghostMode = useGhostMode();
  const hasAccess = canAccess(feature);
  const [dismissed, setDismissed] = useState(false);

  const label = featureLabel ?? FEATURE_LABELS[feature] ?? 'This feature';

  if (hasAccess) return <>{children}</>;

  // Full upsell card mode — replaces the content entirely
  if (showUpsell && !dismissed) {
    return (
      <AnimatePresence>
        <PremiumUpsellCard
          featureLabel={label}
          ghostMode={ghostMode}
          onDismiss={() => setDismissed(true)}
        />
      </AnimatePresence>
    );
  }

  // Default: blurred preview with gold lock
  return (
    <FreemiumGate isElite={hasAccess} featureLabel={label} ghostMode={ghostMode}>
      {children}
    </FreemiumGate>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  FULL-VIEW GATE — Full-page upsell for gated views           */
/*  Used by ViewManager to gate entire view routes               */
/* ══════════════════════════════════════════════════════════════ */

interface ViewGateProps {
  feature: GatedFeature;
  featureLabel?: string;
  children: ReactNode;
  onNavigateBack?: () => void;
}

/**
 * Full-page gate for view-level access control.
 * Shows a centered upsell card with a "Back to Dashboard" option.
 */
export function ViewGate({ feature, featureLabel, children, onNavigateBack }: ViewGateProps) {
  const { canAccess } = useAccessTier();
  const ghostMode = useGhostMode();
  const hasAccess = canAccess(feature);

  const label = featureLabel ?? FEATURE_LABELS[feature] ?? 'This feature';

  if (hasAccess) return <>{children}</>;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
      {/* Back button */}
      {onNavigateBack && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={onNavigateBack}
          className="mb-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wide transition-all duration-200 hover:scale-105"
          style={{
            color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.textDim,
            background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.3)',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.4)'}`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </motion.button>
      )}

      {/* Upsell card */}
      <div className="w-full max-w-md">
        <PremiumUpsellCard
          featureLabel={label}
          ghostMode={ghostMode}
        />
      </div>

      {/* Ambient glow behind card */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full"
          style={{
            background: ghostMode
              ? 'radial-gradient(ellipse, rgba(160,160,160,0.02) 0%, transparent 70%)'
              : `radial-gradient(ellipse, ${WARM.gold}04 0%, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
}

export const FEATURE_LABELS: Record<GatedFeature, string> = {
  'insight-bridge': 'InsightBridge Analytics',
  'advanced-bio-analytics': 'Advanced Bio-Analytics',
  'peer-network': 'Peer Network',
  'dna-insights': 'DNA Insights',
  'blueprint-builder': 'Blueprint Builder',
  'weekly-report': 'Weekly Report',
  'biometrics-deep-dive': 'Biometrics Deep Dive',
  'biological-age-tracking': 'Biological Age Tracking',
  'concierge-support': 'Concierge Support',
  'bio-vault': 'Bio-Vault Lab Storage',
  'performance-timeline': 'Performance Timeline',
  'exhaustive-blood-panel': 'Exhaustive Blood Panel Analysis',
};

/* ══════════════════════════════════════════════════════════════ */
/*  ELITE BLUR GATE — Frosted-glass overlay with modal trigger  */
/*  Renders children blurred with a clickable glass overlay     */
/*  that opens the EliteBenefitsModal on interaction.            */
/* ══════════════════════════════════════════════════════════════ */

interface EliteBlurGateProps {
  feature: GatedFeature;
  featureLabel?: string;
  children: ReactNode;
  onNavigateBack?: () => void;
}

/**
 * Wraps a full view with a frosted-glass blur effect for Core users.
 * Clicking anywhere on the blurred overlay triggers the EliteBenefitsModal.
 * Elite users see the content normally with no overlay.
 */
export function EliteBlurGate({ feature, featureLabel, children, onNavigateBack }: EliteBlurGateProps) {
  const { canAccess, tier, upgradeTier } = useAccessTier();
  const ghostMode = useGhostMode();
  const [showModal, setShowModal] = useState(false);
  const hasAccess = canAccess(feature);
  const label = featureLabel ?? FEATURE_LABELS[feature] ?? 'This feature';

  if (hasAccess) return <>{children}</>;

  return (
    <>
      <div className="relative min-h-[60vh]">
        {/* Blurred content underneath — visible but not interactive */}
        <div
          className="pointer-events-none select-none"
          style={{
            filter: 'blur(8px) saturate(0.4) brightness(0.7)',
            opacity: 0.55,
          }}
          aria-hidden="true"
        >
          {children}
        </div>

        {/* Frosted-glass clickable overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          onClick={() => setShowModal(true)}
          className="absolute inset-0 z-20 cursor-pointer flex flex-col items-center justify-center rounded-2xl"
          style={{
            background: ghostMode
              ? 'rgba(8,8,8,0.45)'
              : 'rgba(12,10,8,0.4)',
            backdropFilter: 'blur(12px) saturate(0.6)',
            WebkitBackdropFilter: 'blur(12px) saturate(0.6)',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(196,164,108,0.1)'}`,
          }}
        >
          {/* Central lock badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center gap-4"
          >
            {/* Pulsing lock circle */}
            <motion.div
              animate={{
                boxShadow: [
                  `0 0 20px ${ghostMode ? 'rgba(160,160,160,0.05)' : `${WARM.gold}10`}`,
                  `0 0 40px ${ghostMode ? 'rgba(160,160,160,0.1)' : `${WARM.gold}20`}`,
                  `0 0 20px ${ghostMode ? 'rgba(160,160,160,0.05)' : `${WARM.gold}10`}`,
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: ghostMode
                  ? 'rgba(160,160,160,0.06)'
                  : `linear-gradient(135deg, ${WARM.gold}20, ${WARM.gold}08)`,
                border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${WARM.gold}35`}`,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke={ghostMode ? 'rgba(160,160,160,0.5)' : WARM.gold}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                <circle cx="12" cy="16" r="1" fill={ghostMode ? 'rgba(160,160,160,0.5)' : WARM.gold} />
              </svg>
            </motion.div>

            {/* Label */}
            <div className="text-center px-8">
              <p className="text-[13px] font-bold mb-1.5 tracking-wide"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.7)' : WARM.gold }}>
                Elite Feature
              </p>
              <p className="text-[11px] leading-relaxed max-w-[240px] mb-1"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.textSecondary }}>
                {label} requires an Elite membership to access
              </p>
              <p className="text-[10px] mt-3 font-medium tracking-wider"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${WARM.gold}90` }}>
                TAP TO LEARN MORE
              </p>
            </div>

            {/* Back button */}
            {onNavigateBack && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={(e) => { e.stopPropagation(); onNavigateBack(); }}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-200 hover:scale-105"
                style={{
                  color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.textDim,
                  background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.4)',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.5)'}`,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Elite Benefits Modal — triggered by clicking the blur overlay */}
      <EliteBenefitsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onUpgrade={() => { upgradeTier(); setShowModal(false); }}
        currentTier={tier}
        ghostMode={ghostMode}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  CONCIERGE BLUR GATE — Tier 2 frosted-glass overlay          */
/*  For features requiring Performance Coach coordination.      */
/*  Shows blurred content + ConciergeGateway on click.          */
/* ══════════════════════════════════════════════════════════════ */

interface ConciergeBlurGateProps {
  feature: GatedFeature;
  featureLabel?: string;
  children: ReactNode;
  onNavigateBack?: () => void;
}

/**
 * Tier 2 gate: wraps content with frosted-glass blur for non-Elite users.
 * Clicking the overlay opens the ConciergeGateway (not EliteBenefitsModal).
 * For Elite users who haven't coordinated with their coach, still shows
 * the ConciergeGateway but without the upgrade CTA.
 */
export function ConciergeBlurGate({ feature, featureLabel, children, onNavigateBack }: ConciergeBlurGateProps) {
  const { canAccess, tier, upgradeTier, isCore } = useAccessTier();
  const ghostMode = useGhostMode();
  const [showGateway, setShowGateway] = useState(false);
  const hasAccess = canAccess(feature);
  const label = featureLabel ?? FEATURE_LABELS[feature] ?? 'This feature';

  // Elite users with Tier 2 features still see the ConciergeGateway
  // but can dismiss it — they need to coordinate with their coach
  const needsConcierge = isTier2Feature(feature);

  // If user has access AND it's not a Tier 2 feature, render normally
  if (hasAccess && !needsConcierge) return <>{children}</>;

  return (
    <>
      <div className="relative min-h-[60vh]">
        {/* Blurred content underneath */}
        <div
          className="pointer-events-none select-none"
          style={{
            filter: 'blur(10px) saturate(0.3) brightness(0.6)',
            opacity: 0.45,
          }}
          aria-hidden="true"
        >
          {children}
        </div>

        {/* Frosted-glass clickable overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          onClick={() => setShowGateway(true)}
          className="absolute inset-0 z-20 cursor-pointer flex flex-col items-center justify-center rounded-2xl"
          style={{
            background: ghostMode
              ? 'rgba(8,8,8,0.5)'
              : 'rgba(8,12,10,0.45)',
            backdropFilter: 'blur(14px) saturate(0.5)',
            WebkitBackdropFilter: 'blur(14px) saturate(0.5)',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,212,170,0.08)'}`,
          }}
        >
          {/* Central Tier 2 badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col items-center gap-4"
          >
            {/* Shield icon with teal pulse */}
            <motion.div
              animate={{
                boxShadow: [
                  `0 0 20px ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(0,212,170,0.08)'}`,
                  `0 0 44px ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(0,212,170,0.18)'}`,
                  `0 0 20px ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(0,212,170,0.08)'}`,
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: ghostMode
                  ? 'rgba(160,160,160,0.06)'
                  : 'linear-gradient(135deg, rgba(0,212,170,0.15), rgba(0,212,170,0.05))',
                border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(0,212,170,0.25)'}`,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={ghostMode ? 'rgba(160,160,160,0.5)' : '#00D4AA'}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </motion.div>

            {/* Labels */}
            <div className="text-center px-8">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <p className="text-[13px] font-bold tracking-wide"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.7)' : '#00D4AA' }}>
                  Concierge Required
                </p>
                <span
                  className="px-1.5 py-0.5 rounded text-[7px] font-mono uppercase tracking-wider"
                  style={{
                    background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,212,170,0.08)',
                    color: ghostMode ? 'rgba(160,160,160,0.4)' : '#00D4AA',
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,212,170,0.15)'}`,
                  }}
                >
                  Tier 2
                </span>
              </div>
              <p className="text-[11px] leading-relaxed max-w-[260px] mb-1"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.textSecondary }}>
                {label} requires coordination with your Performance Coach for proper contextualization
              </p>
              <p className="text-[10px] mt-3 font-medium tracking-wider"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(0,212,170,0.6)' }}>
                TAP TO CONNECT WITH YOUR COACH
              </p>
            </div>

            {/* Back button */}
            {onNavigateBack && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={(e) => { e.stopPropagation(); onNavigateBack(); }}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-200 hover:scale-105"
                style={{
                  color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.textDim,
                  background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.4)',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.5)'}`,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* ConciergeGateway modal — triggered by clicking the blur overlay */}
      <ConciergeGateway
        isOpen={showGateway}
        onClose={() => setShowGateway(false)}
        onUpgrade={isCore ? () => { upgradeTier(); setShowGateway(false); } : undefined}
        ghostMode={ghostMode}
        featureLabel={label}
      />
    </>
  );
}

/* ── Utility: filter CommandBar items by tier ── */
export function filterCommandItemsByTier(
  items: Array<{ id: string; category: string }>,
  isElite: boolean
): typeof items {
  if (isElite) return items;

  const gatedIds = new Set(['community', 'dna', 'blueprint', 'biometrics', 'report']);
  return items.map((item) => {
    if (gatedIds.has(item.id)) {
      return { ...item, _gated: true } as any;
    }
    return item;
  });
}
