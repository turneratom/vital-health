import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════════════════════════ */
/*  CONCIERGE GATEWAY — Tier 2 Access Overlay                    */
/*                                                                */
/*  Specialized overlay for premium Tier 2 features like the     */
/*  Exhaustive Blood Panel Analysis. Shows a frosted-glass       */
/*  gateway with direct "Message Performance Coach" action.      */
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
  dim: '#00A888',
  glow: 'rgba(0,212,170,',
};

interface ConciergeFeature {
  icon: string;
  title: string;
  description: string;
}

const CONCIERGE_FEATURES: ConciergeFeature[] = [
  {
    icon: '🩸',
    title: 'Exhaustive Blood Panel',
    description: '80+ biomarkers including advanced lipid subfractions, inflammatory cytokines, hormonal cascades, and metabolic deep-dive.',
  },
  {
    icon: '🧠',
    title: 'Personalized Interpretation',
    description: 'Your coach cross-references results against your genetic profile, wearable data, and current protocol stack.',
  },
  {
    icon: '📋',
    title: 'Custom Protocol Adjustment',
    description: 'Receive a tailored protocol modification plan within 48 hours of your results, optimized for your biology.',
  },
  {
    icon: '📞',
    title: 'Live Strategy Session',
    description: '30-minute 1-on-1 video call to walk through findings, answer questions, and set 90-day optimization targets.',
  },
];

interface ConciergeGatewayProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
  ghostMode?: boolean;
  /** The specific Tier 2 feature being accessed */
  featureLabel?: string;
  /** User email for pre-filling coach message */
  userEmail?: string;
  /** User name for pre-filling coach message */
  userName?: string;
}

export function ConciergeGateway({
  isOpen,
  onClose,
  onUpgrade,
  ghostMode = false,
  featureLabel = 'Exhaustive Blood Panel Analysis',
  userEmail = '',
  userName = '',
}: ConciergeGatewayProps) {
  const [messageSent, setMessageSent] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setMessageSent(false);
      setShowConfirmation(false);
    }
  }, [isOpen]);

  const handleMessageCoach = useCallback(() => {
    // Pre-filled email with context
    const subject = encodeURIComponent(`Tier 2 Access Request: ${featureLabel}`);
    const body = encodeURIComponent(
      `Hi Vive Performance Team,\n\n` +
      `I'm interested in accessing the ${featureLabel} feature as part of the Elite Concierge tier.\n\n` +
      `${userName ? `Name: ${userName}\n` : ''}` +
      `${userEmail ? `Email: ${userEmail}\n` : ''}` +
      `\nI'd like to schedule a consultation to discuss:\n` +
      `- Full exhaustive blood panel (80+ biomarkers)\n` +
      `- Personalized protocol interpretation\n` +
      `- Custom optimization strategy\n\n` +
      `Looking forward to hearing from you.\n\n` +
      `Best regards${userName ? `,\n${userName}` : ''}`
    );

    window.open(`mailto:concierge@vive.health?subject=${subject}&body=${body}`, '_blank');
    setMessageSent(true);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 4000);
  }, [featureLabel, userEmail, userName]);

  const handleInAppChat = useCallback(() => {
    setMessageSent(true);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 4000);
  }, []);

  const accentColor = ghostMode ? 'rgba(160,160,160,' : TEAL.glow;
  const accentSolid = ghostMode ? 'rgba(160,160,160,0.5)' : TEAL.primary;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop with deep blur */}
          <div
            className="absolute inset-0"
            style={{
              background: ghostMode
                ? 'rgba(0,0,0,0.9)'
                : 'rgba(0,0,0,0.88)',
              backdropFilter: 'blur(16px) saturate(0.5)',
              WebkitBackdropFilter: 'blur(16px) saturate(0.5)',
            }}
          />

          {/* Ambient glow behind modal */}
          {!ghostMode && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full"
                style={{ background: `radial-gradient(ellipse, ${TEAL.glow}0.06) 0%, transparent 70%)` }}
              />
            </div>
          )}

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.4, type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl"
            style={{
              background: ghostMode
                ? 'linear-gradient(180deg, #0c0c0c 0%, #060606 100%)'
                : 'linear-gradient(180deg, #0a0c0b 0%, #050706 100%)',
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${TEAL.glow}0.12)`}`,
              boxShadow: ghostMode
                ? '0 -8px 40px rgba(0,0,0,0.5)'
                : `0 -8px 60px ${TEAL.glow}0.06), 0 0 120px ${TEAL.glow}0.03), inset 0 1px 0 ${TEAL.glow}0.05)`,
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentSolid}, transparent)`,
              }}
            />

            {/* Tier 2 badge glow */}
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, ${accentColor}0.04) 0%, transparent 100%)`,
              }}
            />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-200 hover:scale-110"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[92vh] pb-8">
              {/* Header */}
              <div className="px-6 pt-8 pb-2">
                <div className="flex items-center gap-3 mb-4">
                  {/* Concierge icon with pulse */}
                  <motion.div
                    animate={{
                      boxShadow: [
                        `0 0 16px ${accentColor}0.08)`,
                        `0 0 32px ${accentColor}0.16)`,
                        `0 0 16px ${accentColor}0.08)`,
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      background: ghostMode
                        ? 'rgba(160,160,160,0.06)'
                        : `linear-gradient(135deg, ${TEAL.glow}0.12), ${TEAL.glow}0.04))`,
                      border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${TEAL.glow}0.25)`}`,
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accentSolid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                  </motion.div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2
                        className="text-lg font-bold tracking-wide"
                        style={{ color: ghostMode ? 'rgba(220,220,220,0.9)' : 'rgba(255,255,255,0.95)' }}
                      >
                        Concierge Access
                      </h2>
                      <span
                        className="px-2 py-0.5 rounded-md text-[8px] font-mono uppercase tracking-[0.15em]"
                        style={{
                          background: ghostMode ? 'rgba(160,160,160,0.06)' : `${TEAL.glow}0.08)`,
                          color: accentSolid,
                          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${TEAL.glow}0.2)`}`,
                        }}
                      >
                        Tier 2
                      </span>
                    </div>
                    <p
                      className="text-[10px] font-mono uppercase tracking-[0.12em] mt-0.5"
                      style={{ color: `${accentColor}0.5)` }}
                    >
                      Performance Coach Required
                    </p>
                  </div>
                </div>

                <p
                  className="text-[12px] leading-relaxed mb-5"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.45)' }}
                >
                  The <span style={{ color: accentSolid, fontWeight: 600 }}>{featureLabel}</span> is a Tier 2 Elite feature that requires coordination with your dedicated Performance Coach. This ensures your results are properly contextualized against your genetic profile and current protocol stack.
                </p>
              </div>

              {/* What's Included */}
              <div className="px-6 mb-5">
                <p
                  className="text-[9px] font-mono uppercase tracking-[0.15em] mb-3"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : `${accentColor}0.4)` }}
                >
                  What&apos;s Included
                </p>
                <div className="flex flex-col gap-2">
                  {CONCIERGE_FEATURES.map((feature, i) => (
                    <motion.div
                      key={feature.title}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.15 + i * 0.06 }}
                      className="flex items-start gap-3 rounded-xl px-3.5 py-3"
                      style={{
                        background: ghostMode ? 'rgba(160,160,160,0.02)' : `${TEAL.glow}0.02)`,
                        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : `${TEAL.glow}0.06)`}`,
                      }}
                    >
                      <span className="text-[16px] mt-0.5 flex-shrink-0">{feature.icon}</span>
                      <div className="min-w-0">
                        <p
                          className="text-[11px] font-semibold mb-0.5"
                          style={{ color: ghostMode ? 'rgba(160,160,160,0.6)' : WARM.textPrimary }}
                        >
                          {feature.title}
                        </p>
                        <p
                          className="text-[10px] leading-relaxed"
                          style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : WARM.textDim }}
                        >
                          {feature.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Coach Profile Card */}
              <div className="px-6 mb-5">
                <div
                  className="rounded-xl px-4 py-4"
                  style={{
                    background: ghostMode ? 'rgba(160,160,160,0.03)' : `${TEAL.glow}0.03)`,
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${TEAL.glow}0.08)`}`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {/* Coach avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[14px]"
                      style={{
                        background: ghostMode ? 'rgba(160,160,160,0.06)' : `${TEAL.glow}0.08)`,
                        border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${TEAL.glow}0.15)`}`,
                      }}
                    >
                      🧑‍⚕️
                    </div>
                    <div>
                      <p
                        className="text-[12px] font-semibold"
                        style={{ color: ghostMode ? 'rgba(160,160,160,0.7)' : WARM.textPrimary }}
                      >
                        Your Performance Coach
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: ghostMode ? 'rgba(100,200,100,0.4)' : '#34D399' }}
                        />
                        <p
                          className="text-[9px] font-mono uppercase tracking-wider"
                          style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : WARM.textDim }}
                        >
                          Available · Avg. response 4h
                        </p>
                      </div>
                    </div>
                  </div>
                  <p
                    className="text-[10px] leading-relaxed"
                    style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : WARM.textSecondary }}
                  >
                    Certified in functional medicine, sports nutrition, and longevity optimization. Your coach will review your full biomarker history before your consultation.
                  </p>
                </div>
              </div>

              {/* Confirmation flash */}
              <AnimatePresence>
                {showConfirmation && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="px-6 mb-4"
                  >
                    <div
                      className="rounded-xl px-4 py-3 flex items-center gap-2"
                      style={{
                        background: ghostMode ? 'rgba(100,200,100,0.06)' : 'rgba(52,211,153,0.08)',
                        border: `1px solid ${ghostMode ? 'rgba(100,200,100,0.1)' : 'rgba(52,211,153,0.15)'}`,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? 'rgba(100,200,100,0.5)' : '#34D399'} strokeWidth="2" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <p className="text-[11px] font-medium" style={{ color: ghostMode ? 'rgba(100,200,100,0.6)' : '#34D399' }}>
                        Request sent! Your coach will reach out within 4 hours.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA Buttons */}
              <div className="px-6 flex flex-col gap-2.5">
                {/* Primary: Message Performance Coach */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleMessageCoach}
                  disabled={messageSent}
                  className="w-full py-3.5 rounded-xl text-[13px] font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-60"
                  style={{
                    background: ghostMode
                      ? 'rgba(160,160,160,0.1)'
                      : `linear-gradient(135deg, ${TEAL.primary}, ${TEAL.light})`,
                    color: ghostMode ? 'rgba(220,220,220,0.8)' : '#050706',
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : `${TEAL.light}60`}`,
                    boxShadow: ghostMode
                      ? 'none'
                      : `0 4px 24px ${TEAL.glow}0.25), 0 0 48px ${TEAL.glow}0.08)`,
                  }}
                >
                  {messageSent ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      Message Sent
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Message Performance Coach
                    </>
                  )}
                </motion.button>

                {/* Secondary: In-App Chat Trigger */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleInAppChat}
                  disabled={messageSent}
                  className="w-full py-3 rounded-xl text-[12px] font-semibold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{
                    background: ghostMode ? 'rgba(160,160,160,0.04)' : `${TEAL.glow}0.06)`,
                    color: ghostMode ? 'rgba(160,160,160,0.5)' : accentSolid,
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${TEAL.glow}0.12)`}`,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Schedule a Call Instead
                </motion.button>

                {/* Upgrade CTA for non-Elite users */}
                {onUpgrade && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => { onUpgrade(); onClose(); }}
                    className="w-full py-2.5 rounded-xl text-[11px] font-medium tracking-wide transition-all duration-300 flex items-center justify-center gap-2"
                    style={{
                      background: 'transparent',
                      color: ghostMode ? 'rgba(160,160,160,0.35)' : WARM.textDim,
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(42,38,34,0.4)'}`,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                        fill={ghostMode ? 'rgba(160,160,160,0.25)' : WARM.goldDim}
                        strokeWidth="0"
                      />
                    </svg>
                    Don&apos;t have Elite? Upgrade Now
                  </motion.button>
                )}
              </div>

              {/* Fine print */}
              <p
                className="text-center text-[9px] mt-4 px-6"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.2)' : WARM.textDim }}
              >
                Tier 2 features include dedicated coach access · Results within 48h · Included with Elite+ plan
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
