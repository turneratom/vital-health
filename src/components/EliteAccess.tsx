import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccessTier, type GatedFeature } from '@/components/AccessController';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { ELITE_HERO_BACKGROUNDS } from '@/data/eliteAssets';

/* ══════════════════════════════════════════════════════════════ */
/*  ELITE ACCESS — Subscription Tier Selection Page              */
/*                                                                */
/*  Three tiers: Optimization, Longevity, Concierge              */
/*  Handles free → premium state transitions via AccessController*/
/*  Matches the FluidCanvas warm-gold design system              */
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

const TEAL = {
  primary: '#00D4AA',
  light: '#00F0C8',
  glow: 'rgba(0,212,170,',
};

const CYAN = {
  primary: '#00F0FF',
  light: '#40F8FF',
  glow: 'rgba(0,240,255,',
};

/* ── Tier Definitions ── */

interface TierFeature {
  icon: string;
  label: string;
  description: string;
  gatedFeature?: GatedFeature;
}

interface TierDefinition {
  id: 'optimization' | 'longevity' | 'concierge';
  name: string;
  tagline: string;
  price: string;
  period: string;
  accentColor: string;
  accentGlow: string;
  badge: string;
  badgeIcon: string;
  heroImage?: string;
  popular?: boolean;
  features: TierFeature[];
  ctaLabel: string;
  ctaAction: 'upgrade' | 'concierge';
}

const TIERS: TierDefinition[] = [
  {
    id: 'optimization',
    name: 'Optimization',
    tagline: 'Foundation for biological excellence',
    price: '$49',
    period: '/month',
    accentColor: WARM.gold,
    accentGlow: `rgba(196,164,108,`,
    badge: 'CORE+',
    badgeIcon: '⚡',
    features: [
      { icon: '📊', label: 'Daily Protocol Stack', description: 'Personalized supplement & intervention checklist synced to your circadian rhythm' },
      { icon: '🎙️', label: 'Voice Journal', description: 'AI-transcribed voice entries with sentiment analysis and pattern detection' },
      { icon: '📈', label: 'Basic Bio-Analytics', description: 'Track key biomarkers with trend visualization and weekly summaries' },
      { icon: '⌚', label: 'Wearable Sync (2 devices)', description: 'Connect Apple Watch, Oura, or Whoop for automated data ingestion' },
      { icon: '🧬', label: 'Wellness Score', description: 'Real-time composite score from sleep, HRV, activity, and nutrition data' },
      { icon: '🎯', label: 'Morning Directives', description: 'AI-generated daily action items based on overnight recovery metrics' },
    ],
    ctaLabel: 'Start Optimizing',
    ctaAction: 'upgrade',
  },
  {
    id: 'longevity',
    name: 'Longevity',
    tagline: 'Advanced lab mapping & biological tracking',
    price: '$149',
    period: '/month',
    accentColor: CYAN.primary,
    accentGlow: CYAN.glow,
    badge: 'ELITE',
    badgeIcon: '⭐',
    heroImage: ELITE_HERO_BACKGROUNDS.dnaHelix,
    popular: true,
    features: [
      { icon: '🔬', label: 'Advanced Lab Mapping', description: 'Deep biomarker analysis with age/sex-adjusted optimal zones and longitudinal tracking', gatedFeature: 'advanced-bio-analytics' },
      { icon: '⏳', label: 'Real-time Biological Tracking', description: 'Epigenetic age estimation, telomere tracking, and multi-biomarker aging algorithms', gatedFeature: 'biological-age-tracking' },
      { icon: '🧠', label: 'InsightBridge AI', description: 'AI-powered correlations between protocols, biomarkers, and wearable data', gatedFeature: 'insight-bridge' },
      { icon: '🛡️', label: 'Bio-Vault', description: 'Private storage for lab results, genetic data, and health records with full export (not HIPAA certified)', gatedFeature: 'bio-vault' },
      { icon: '🧬', label: 'DNA Insights', description: 'MTHFR, APOE4, COMT, and 200+ SNP analysis with protocol recommendations', gatedFeature: 'dna-insights' },
      { icon: '📋', label: 'Weekly Blueprint Report', description: 'Comprehensive weekly analysis with trend predictions and protocol adjustments', gatedFeature: 'weekly-report' },
      { icon: '🌐', label: 'Peer Network', description: 'Connect with high-performers, share protocols, and join accountability pods', gatedFeature: 'peer-network' },
      { icon: '📉', label: 'Performance Timeline', description: 'Historical view of all metrics with correlation overlays and milestone markers', gatedFeature: 'performance-timeline' },
    ],
    ctaLabel: 'Unlock Longevity',
    ctaAction: 'upgrade',
  },
  {
    id: 'concierge',
    name: 'Concierge',
    tagline: 'White-glove performance coaching',
    price: '$499',
    period: '/month',
    accentColor: TEAL.primary,
    accentGlow: TEAL.glow,
    badge: 'CONCIERGE',
    badgeIcon: '👑',
    heroImage: ELITE_HERO_BACKGROUNDS.mitochondria,
    features: [
      { icon: '🩸', label: 'Exhaustive Blood Panel', description: '80+ biomarkers including advanced lipid subfractions, inflammatory cytokines, and hormonal cascades', gatedFeature: 'exhaustive-blood-panel' },
      { icon: '🎯', label: 'Dedicated Performance Coach', description: '1-on-1 access to a health optimization specialist with quarterly strategy calls', gatedFeature: 'concierge-support' },
      { icon: '📞', label: 'Live Strategy Sessions', description: '30-minute monthly video calls to review findings and set 90-day optimization targets' },
      { icon: '💊', label: 'Custom Protocol Design', description: 'Bespoke supplement and intervention protocols tailored to your unique biology' },
      { icon: '🏥', label: 'Lab Coordination', description: 'We schedule, coordinate, and interpret all lab work — you just show up' },
      { icon: '🔄', label: 'Protocol Adjustments', description: 'Receive tailored protocol modifications within 48 hours of new lab results' },
      { icon: '📱', label: 'Priority Support', description: '24-hour response SLA with direct messaging to your optimization team' },
      { icon: '🧪', label: 'Everything in Longevity', description: 'Full access to all Elite features plus Concierge-exclusive capabilities' },
    ],
    ctaLabel: 'Request Concierge',
    ctaAction: 'concierge',
  },
];

/* ── Comparison Table ── */
const COMPARISON_ROWS = [
  { feature: 'Daily Protocol Stack', optimization: true, longevity: true, concierge: true },
  { feature: 'Voice Journal', optimization: true, longevity: true, concierge: true },
  { feature: 'Wellness Score', optimization: true, longevity: true, concierge: true },
  { feature: 'Morning Directives', optimization: true, longevity: true, concierge: true },
  { feature: 'Wearable Integrations', optimization: '2 devices', longevity: 'Unlimited', concierge: 'Unlimited' },
  { feature: 'Advanced Lab Mapping', optimization: false, longevity: true, concierge: true },
  { feature: 'Biological Age Tracking', optimization: false, longevity: true, concierge: true },
  { feature: 'InsightBridge AI', optimization: false, longevity: true, concierge: true },
  { feature: 'Bio-Vault', optimization: false, longevity: true, concierge: true },
  { feature: 'DNA Insights', optimization: false, longevity: true, concierge: true },
  { feature: 'Weekly Blueprint', optimization: false, longevity: true, concierge: true },
  { feature: 'Peer Network', optimization: false, longevity: true, concierge: true },
  { feature: 'Performance Timeline', optimization: false, longevity: true, concierge: true },
  { feature: 'Exhaustive Blood Panel (80+)', optimization: false, longevity: false, concierge: true },
  { feature: 'Dedicated Coach', optimization: false, longevity: false, concierge: true },
  { feature: 'Live Strategy Sessions', optimization: false, longevity: false, concierge: true },
  { feature: 'Lab Coordination', optimization: false, longevity: false, concierge: true },
  { feature: 'Priority Support (24h SLA)', optimization: false, longevity: false, concierge: true },
];

/* ── Main Component ── */

export default function EliteAccess() {
  const { tier, isElite, upgradeTier, isUpgrading } = useAccessTier();
  const ghostMode = useGhostMode();
  const [selectedTier, setSelectedTier] = useState<TierDefinition['id'] | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [conciergeRequested, setConciergeRequested] = useState(false);

  const handleUpgrade = useCallback(async (tierId: TierDefinition['id']) => {
    setSelectedTier(tierId);
    if (tierId === 'concierge') {
      // Open mailto for concierge
      const subject = encodeURIComponent('Concierge Tier Access Request');
      const body = encodeURIComponent(
        'Hi Vive Performance Team,\n\n' +
        'I\'m interested in the Concierge tier with dedicated performance coaching.\n\n' +
        'I\'d like to learn more about:\n' +
        '- Exhaustive blood panel (80+ biomarkers)\n' +
        '- Dedicated performance coach assignment\n' +
        '- Custom protocol design\n\n' +
        'Looking forward to hearing from you.\n\nBest regards'
      );
      window.open(`mailto:concierge@vive.health?subject=${subject}&body=${body}`, '_blank');
      setConciergeRequested(true);
      setTimeout(() => setConciergeRequested(false), 4000);
      return;
    }
    try {
      await upgradeTier();
      setUpgradeSuccess(true);
      setTimeout(() => setUpgradeSuccess(false), 3000);
    } catch {
      // handled by AccessController
    }
  }, [upgradeTier]);

  const gm = ghostMode;
  const accentBase = gm ? 'rgba(160,160,160,' : `rgba(196,164,108,`;

  return (
    <div
      className="min-h-screen w-full pb-32 overflow-x-hidden"
      style={{ background: '#0A0A0B' }}
    >
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden">
        {/* Background ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
            style={{
              background: gm
                ? 'radial-gradient(ellipse, rgba(160,160,160,0.03) 0%, transparent 70%)'
                : 'radial-gradient(ellipse, rgba(196,164,108,0.06) 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="relative z-10 px-5 pt-12 pb-8 max-w-lg mx-auto text-center">
          {/* Current tier indicator */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{
              background: isElite
                ? (gm ? 'rgba(160,160,160,0.06)' : 'rgba(0,240,255,0.06)')
                : (gm ? 'rgba(160,160,160,0.04)' : 'rgba(196,164,108,0.06)'),
              border: `1px solid ${isElite
                ? (gm ? 'rgba(160,160,160,0.12)' : 'rgba(0,240,255,0.15)')
                : (gm ? 'rgba(160,160,160,0.08)' : 'rgba(196,164,108,0.12)')
              }`,
            }}
          >
            {isElite ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill={gm ? 'rgba(160,160,160,0.5)' : '#00F0FF'}>
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            ) : (
              <div className="w-2 h-2 rounded-full" style={{ background: gm ? 'rgba(160,160,160,0.3)' : WARM.goldDim }} />
            )}
            <span
              className="text-[10px] font-mono uppercase tracking-[0.15em] font-medium"
              style={{ color: isElite ? (gm ? 'rgba(160,160,160,0.5)' : '#00F0FF') : (gm ? 'rgba(160,160,160,0.4)' : WARM.goldDim) }}
            >
              {isElite ? 'Elite Active' : 'Core Member'}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-2xl sm:text-3xl font-bold tracking-tight mb-3"
            style={{ color: gm ? 'rgba(220,220,220,0.9)' : WARM.textPrimary }}
          >
            {isElite ? 'Your Elite Access' : 'Unlock Your Biology'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[13px] leading-relaxed max-w-sm mx-auto"
            style={{ color: gm ? 'rgba(160,160,160,0.5)' : WARM.textDim }}
          >
            {isElite
              ? 'Manage your membership and explore Concierge-level access for white-glove performance coaching.'
              : 'Choose the tier that matches your optimization ambition. Every plan includes real-time biological tracking and AI-powered insights.'
            }
          </motion.p>
        </div>
      </div>

      {/* ── Tier Cards ── */}
      <div className="px-4 max-w-lg mx-auto space-y-4">
        {TIERS.map((t, idx) => (
          <TierCard
            key={t.id}
            tier={t}
            index={idx}
            currentTier={tier}
            isElite={isElite}
            ghostMode={gm}
            isUpgrading={isUpgrading && selectedTier === t.id}
            onSelect={() => handleUpgrade(t.id)}
          />
        ))}
      </div>

      {/* ── Compare All Plans ── */}
      <div className="px-4 max-w-lg mx-auto mt-8">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => setShowComparison(!showComparison)}
          className="w-full py-3.5 rounded-xl text-[12px] font-semibold tracking-wide transition-all duration-300"
          style={{
            background: gm ? 'rgba(160,160,160,0.04)' : 'rgba(26,24,22,0.6)',
            border: `1px solid ${gm ? 'rgba(160,160,160,0.08)' : WARM.borderLight}`,
            color: gm ? 'rgba(160,160,160,0.5)' : WARM.textSecondary,
          }}
        >
          {showComparison ? 'Hide Comparison' : 'Compare All Plans'} {showComparison ? '↑' : '↓'}
        </motion.button>

        <AnimatePresence>
          {showComparison && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <ComparisonTable ghostMode={gm} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── FAQ Section ── */}
      <div className="px-4 max-w-lg mx-auto mt-10">
        <h3
          className="text-[11px] font-mono uppercase tracking-[0.2em] mb-4 text-center"
          style={{ color: gm ? 'rgba(160,160,160,0.3)' : WARM.textDim }}
        >
          Frequently Asked
        </h3>
        <div className="space-y-2">
          {[
            { q: 'Can I switch tiers anytime?', a: 'Yes. Upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle.' },
            { q: 'What happens to my data if I downgrade?', a: 'Your data is always yours. Bio-Vault contents remain accessible in read-only mode. Lab results and journal entries are never deleted.' },
            { q: 'How does the Concierge coach work?', a: 'You\'re matched with a certified health optimization specialist. They review your labs, adjust protocols, and meet with you monthly via video call.' },
          ].map((faq, i) => (
            <FAQItem key={i} question={faq.q} answer={faq.a} ghostMode={gm} />
          ))}
        </div>
      </div>

      {/* ── Success / Concierge Toast ── */}
      <AnimatePresence>
        {upgradeSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl"
            style={{
              background: 'rgba(0,240,255,0.1)',
              border: '1px solid rgba(0,240,255,0.2)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,240,255,0.15)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">⭐</span>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: '#00F0FF' }}>Elite Activated</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>All premium features are now unlocked</p>
              </div>
            </div>
          </motion.div>
        )}
        {conciergeRequested && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl"
            style={{
              background: `${TEAL.glow}0.1)`,
              border: `1px solid ${TEAL.glow}0.2)`,
              backdropFilter: 'blur(20px)',
              boxShadow: `0 8px 32px ${TEAL.glow}0.15)`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">👑</span>
              <div>
                <p className="text-[12px] font-semibold" style={{ color: TEAL.primary }}>Request Sent</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Our team will reach out within 24 hours</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  TIER CARD — Individual subscription tier presentation       */
/* ══════════════════════════════════════════════════════════════ */

interface TierCardProps {
  tier: TierDefinition;
  index: number;
  currentTier: 'core' | 'elite';
  isElite: boolean;
  ghostMode: boolean;
  isUpgrading: boolean;
  onSelect: () => void;
}

function TierCard({ tier: t, index, currentTier, isElite, ghostMode: gm, isUpgrading, onSelect }: TierCardProps) {
  const [expanded, setExpanded] = useState(t.popular ?? false);

  const isCurrentPlan = (currentTier === 'core' && t.id === 'optimization') ||
    (isElite && t.id === 'longevity');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: gm
          ? 'rgba(12,12,12,0.95)'
          : t.popular
            ? 'linear-gradient(180deg, rgba(10,10,18,0.98) 0%, rgba(8,8,14,0.98) 100%)'
            : 'rgba(18,16,14,0.95)',
        border: `1px solid ${gm
          ? 'rgba(160,160,160,0.08)'
          : t.popular
            ? `${t.accentGlow}0.15)`
            : WARM.borderLight
        }`,
        boxShadow: t.popular && !gm
          ? `0 0 40px ${t.accentGlow}0.06), 0 4px 24px rgba(0,0,0,0.3)`
          : '0 2px 12px rgba(0,0,0,0.2)',
      }}
    >
      {/* Popular badge */}
      {t.popular && (
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: gm
              ? 'linear-gradient(90deg, transparent, rgba(160,160,160,0.3), transparent)'
              : `linear-gradient(90deg, transparent, ${t.accentGlow}0.5), transparent)`,
          }}
        />
      )}

      {/* Hero image strip for premium tiers */}
      {t.heroImage && (
        <div className="relative h-24 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${t.heroImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: gm ? 0.15 : 0.35,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${gm ? '#0c0c0c' : t.id === 'longevity' ? '#0a0a12' : '#0a0a0f'} 100%)`,
            }}
          />
          {/* Popular label */}
          {t.popular && (
            <div className="absolute top-3 right-3">
              <div
                className="px-2.5 py-1 rounded-full text-[9px] font-mono uppercase tracking-[0.15em] font-bold"
                style={{
                  background: gm ? 'rgba(160,160,160,0.1)' : `${t.accentGlow}0.12)`,
                  color: gm ? 'rgba(160,160,160,0.6)' : t.accentColor,
                  border: `1px solid ${gm ? 'rgba(160,160,160,0.15)' : `${t.accentGlow}0.2)`}`,
                }}
              >
                Most Popular
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card content */}
      <div className="px-5 py-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{t.badgeIcon}</span>
              <span
                className="text-[10px] font-mono uppercase tracking-[0.15em] font-bold"
                style={{ color: gm ? 'rgba(160,160,160,0.5)' : t.accentColor }}
              >
                {t.badge}
              </span>
              {isCurrentPlan && (
                <span
                  className="text-[8px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                  style={{
                    background: gm ? 'rgba(160,160,160,0.08)' : 'rgba(52,211,153,0.1)',
                    color: gm ? 'rgba(160,160,160,0.4)' : '#34D399',
                    border: `1px solid ${gm ? 'rgba(160,160,160,0.1)' : 'rgba(52,211,153,0.2)'}`,
                  }}
                >
                  Current
                </span>
              )}
            </div>
            <h3
              className="text-lg font-bold tracking-tight"
              style={{ color: gm ? 'rgba(220,220,220,0.9)' : WARM.textPrimary }}
            >
              {t.name}
            </h3>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: gm ? 'rgba(160,160,160,0.4)' : WARM.textDim }}
            >
              {t.tagline}
            </p>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0 ml-4">
            <div className="flex items-baseline gap-0.5">
              <span
                className="text-2xl font-bold"
                style={{ color: gm ? 'rgba(220,220,220,0.9)' : WARM.textPrimary }}
              >
                {t.price}
              </span>
              <span
                className="text-[11px]"
                style={{ color: gm ? 'rgba(160,160,160,0.4)' : WARM.textDim }}
              >
                {t.period}
              </span>
            </div>
          </div>
        </div>

        {/* Feature list — collapsible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-2 mb-2"
          style={{ color: gm ? 'rgba(160,160,160,0.4)' : WARM.textDim }}
        >
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]">
            {t.features.length} Features Included
          </span>
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-[10px]"
          >
            ▼
          </motion.span>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-2.5 pb-4">
                {t.features.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    className="flex items-start gap-3"
                  >
                    <span className="text-sm flex-shrink-0 mt-0.5">{f.icon}</span>
                    <div className="min-w-0">
                      <p
                        className="text-[12px] font-semibold"
                        style={{ color: gm ? 'rgba(200,200,200,0.8)' : WARM.textPrimary }}
                      >
                        {f.label}
                      </p>
                      <p
                        className="text-[10px] leading-relaxed mt-0.5"
                        style={{ color: gm ? 'rgba(160,160,160,0.4)' : WARM.textDim }}
                      >
                        {f.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSelect}
          disabled={isUpgrading || isCurrentPlan}
          className="w-full py-3 rounded-xl text-[12px] font-bold tracking-wide transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: isCurrentPlan
              ? (gm ? 'rgba(160,160,160,0.04)' : 'rgba(42,38,34,0.3)')
              : (gm
                ? 'rgba(160,160,160,0.08)'
                : `linear-gradient(135deg, ${t.accentGlow}0.15), ${t.accentGlow}0.08))`
              ),
            color: isCurrentPlan
              ? (gm ? 'rgba(160,160,160,0.3)' : WARM.textDim)
              : (gm ? 'rgba(160,160,160,0.6)' : t.accentColor),
            border: `1px solid ${isCurrentPlan
              ? (gm ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.4)')
              : (gm ? 'rgba(160,160,160,0.12)' : `${t.accentGlow}0.25)`)
            }`,
            boxShadow: !isCurrentPlan && !gm
              ? `0 2px 16px ${t.accentGlow}0.1)`
              : 'none',
          }}
        >
          {isUpgrading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Processing...
            </span>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : (
            t.ctaLabel
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  COMPARISON TABLE                                             */
/* ══════════════════════════════════════════════════════════════ */

function ComparisonTable({ ghostMode: gm }: { ghostMode: boolean }) {
  return (
    <div
      className="mt-4 rounded-2xl overflow-hidden"
      style={{
        background: gm ? 'rgba(12,12,12,0.95)' : 'rgba(18,16,14,0.95)',
        border: `1px solid ${gm ? 'rgba(160,160,160,0.06)' : WARM.borderLight}`,
      }}
    >
      {/* Header */}
      <div
        className="grid grid-cols-4 gap-0 px-4 py-3"
        style={{ borderBottom: `1px solid ${gm ? 'rgba(160,160,160,0.06)' : WARM.borderLight}` }}
      >
        <div className="text-[9px] font-mono uppercase tracking-[0.1em]" style={{ color: gm ? 'rgba(160,160,160,0.3)' : WARM.textDim }}>
          Feature
        </div>
        {['Optimization', 'Longevity', 'Concierge'].map((name, i) => (
          <div
            key={name}
            className="text-[9px] font-mono uppercase tracking-[0.1em] text-center font-bold"
            style={{ color: gm ? 'rgba(160,160,160,0.4)' : [WARM.gold, CYAN.primary, TEAL.primary][i] }}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Rows */}
      {COMPARISON_ROWS.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-4 gap-0 px-4 py-2.5 items-center"
          style={{
            borderBottom: i < COMPARISON_ROWS.length - 1
              ? `1px solid ${gm ? 'rgba(160,160,160,0.03)' : 'rgba(42,38,34,0.3)'}`
              : 'none',
            background: i % 2 === 0 ? 'transparent' : (gm ? 'rgba(160,160,160,0.01)' : 'rgba(42,38,34,0.15)'),
          }}
        >
          <div
            className="text-[10px]"
            style={{ color: gm ? 'rgba(160,160,160,0.5)' : WARM.textSecondary }}
          >
            {row.feature}
          </div>
          {(['optimization', 'longevity', 'concierge'] as const).map((col) => {
            const val = row[col];
            return (
              <div key={col} className="text-center">
                {val === true ? (
                  <span style={{ color: gm ? 'rgba(160,160,160,0.5)' : '#34D399' }}>✓</span>
                ) : val === false ? (
                  <span style={{ color: gm ? 'rgba(160,160,160,0.15)' : 'rgba(100,100,100,0.3)' }}>—</span>
                ) : (
                  <span
                    className="text-[9px] font-medium"
                    style={{ color: gm ? 'rgba(160,160,160,0.4)' : WARM.textSecondary }}
                  >
                    {val}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  FAQ ITEM                                                     */
/* ══════════════════════════════════════════════════════════════ */

function FAQItem({ question, answer, ghostMode: gm }: { question: string; answer: string; ghostMode: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: gm ? 'rgba(12,12,12,0.6)' : 'rgba(18,16,14,0.6)',
        border: `1px solid ${gm ? 'rgba(160,160,160,0.05)' : WARM.borderLight}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span
          className="text-[12px] font-medium"
          style={{ color: gm ? 'rgba(200,200,200,0.7)' : WARM.textSecondary }}
        >
          {question}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[14px] flex-shrink-0 ml-3"
          style={{ color: gm ? 'rgba(160,160,160,0.3)' : WARM.textDim }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p
              className="px-4 pb-3 text-[11px] leading-relaxed"
              style={{ color: gm ? 'rgba(160,160,160,0.4)' : WARM.textDim }}
            >
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
