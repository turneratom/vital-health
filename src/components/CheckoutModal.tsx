import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════════════════════════
   CHECKOUT MODAL — Clean Elite Upgrade Flow
   
   Glass-morphism modal with tier selection and simulated
   checkout. Matches the VIVE warm-gold design system.
   ══════════════════════════════════════════════════════════════ */

const WARM = {
  gold: '#C4A46C',
  goldLight: '#D4B87C',
  green: '#7CB68E',
  textPrimary: '#E8E0D8',
  textSecondary: '#B8AFA6',
  textDim: '#8A7E72',
  surface: 'rgba(26,24,22,0.98)',
  border: 'rgba(196,164,108,0.15)',
};

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  ghostMode?: boolean;
}

const ELITE_PROTOCOLS = [
  { icon: '🧬', name: 'NAD+ IV Protocol', desc: 'Cellular energy restoration & DNA repair' },
  { icon: '💉', name: 'BPC-157 Peptide', desc: 'Accelerated tissue healing & gut repair' },
  { icon: '🧪', name: 'Rapamycin Micro-dose', desc: 'mTOR pathway modulation for longevity' },
  { icon: '❄️', name: 'Thymosin Alpha-1', desc: 'Immune system optimization peptide' },
  { icon: '⚡', name: 'Methylene Blue', desc: 'Mitochondrial electron chain support' },
  { icon: '🔬', name: 'Epitalon Telomere', desc: 'Telomerase activation for cellular age reversal' },
];

const PLAN_FEATURES = [
  'Advanced longevity protocols (NAD+, Peptides, Rapamycin)',
  'AI-driven protocol personalization from bloodwork',
  'Real-time biomarker correlation engine',
  'Squad performance analytics & peer benchmarks',
  'Priority access to new protocol research',
  'Encrypted Biological Vault with physician sharing',
];

export function CheckoutModal({ open, onClose, ghostMode = false }: CheckoutModalProps) {
  const [step, setStep] = useState<'overview' | 'processing' | 'success'>('overview');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

  const handleCheckout = useCallback(() => {
    setStep('processing');
    // Simulate processing — in production this would trigger Stripe
    setTimeout(() => setStep('success'), 2000);
  }, []);

  const handleClose = useCallback(() => {
    setStep('overview');
    onClose();
  }, [onClose]);

  const monthlyPrice = 49;
  const annualPrice = 39;
  const savings = (monthlyPrice - annualPrice) * 12;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-full max-w-[440px] max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{
              background: WARM.surface,
              border: `1px solid ${WARM.border}`,
              boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(196,164,108,0.06)`,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(196,164,108,0.1) transparent',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: WARM.textDim,
              }}
            >
              ✕
            </button>

            {step === 'overview' && (
              <div className="p-6">
                {/* Header */}
                <div className="text-center mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3" style={{
                    background: `${WARM.gold}10`,
                    border: `1px solid ${WARM.gold}25`,
                  }}>
                    <span className="text-xs">🧬</span>
                    <span className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase" style={{ color: WARM.gold }}>
                      Elite Tier
                    </span>
                  </div>
                  <h2 className="text-lg font-bold tracking-tight" style={{ color: WARM.textPrimary }}>
                    Unlock Advanced Protocols
                  </h2>
                  <p className="text-[11px] mt-1.5 leading-relaxed max-w-[320px] mx-auto" style={{ color: WARM.textDim }}>
                    Access cutting-edge longevity interventions backed by peer-reviewed research and personalized to your biology.
                  </p>
                </div>

                {/* Protocol Preview Grid */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {ELITE_PROTOCOLS.map((p) => (
                    <div key={p.name} className="flex items-start gap-2 p-2.5 rounded-xl" style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(196,164,108,0.06)',
                    }}>
                      <span className="text-sm flex-shrink-0 mt-0.5">{p.icon}</span>
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold block truncate" style={{ color: WARM.textPrimary }}>
                          {p.name}
                        </span>
                        <span className="text-[8px] block leading-tight mt-0.5" style={{ color: WARM.textDim }}>
                          {p.desc}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Plan Toggle */}
                <div className="flex gap-2 mb-4">
                  {(['monthly', 'annual'] as const).map((plan) => {
                    const active = selectedPlan === plan;
                    const price = plan === 'monthly' ? monthlyPrice : annualPrice;
                    return (
                      <button
                        key={plan}
                        onClick={() => setSelectedPlan(plan)}
                        className="flex-1 relative p-3 rounded-xl text-center transition-all duration-300"
                        style={{
                          background: active ? `${WARM.gold}10` : 'rgba(255,255,255,0.02)',
                          border: `1.5px solid ${active ? `${WARM.gold}40` : 'rgba(255,255,255,0.04)'}`,
                          boxShadow: active ? `0 0 20px ${WARM.gold}08` : 'none',
                        }}
                      >
                        {plan === 'annual' && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[7px] font-bold tracking-wider uppercase" style={{
                            background: WARM.green,
                            color: '#0A0A0B',
                          }}>
                            Save ${savings}
                          </div>
                        )}
                        <span className="text-[9px] font-mono tracking-[0.1em] uppercase block mb-1" style={{
                          color: active ? WARM.gold : WARM.textDim,
                        }}>
                          {plan}
                        </span>
                        <span className="text-xl font-bold block" style={{
                          color: active ? WARM.textPrimary : WARM.textSecondary,
                        }}>
                          ${price}
                        </span>
                        <span className="text-[9px] block" style={{ color: WARM.textDim }}>/month</span>
                      </button>
                    );
                  })}
                </div>

                {/* Features List */}
                <div className="space-y-2 mb-5">
                  {PLAN_FEATURES.map((f) => (
                    <div key={f} className="flex items-start gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                        <circle cx="12" cy="12" r="10" fill={`${WARM.gold}15`} stroke={`${WARM.gold}40`} strokeWidth="1.5" />
                        <polyline points="8 12 11 15 16 9" fill="none" stroke={WARM.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[10px] leading-relaxed" style={{ color: WARM.textSecondary }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={handleCheckout}
                  className="w-full py-3.5 rounded-xl text-[12px] font-bold tracking-[0.08em] uppercase transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${WARM.gold}, ${WARM.goldLight})`,
                    color: '#0A0A0B',
                    boxShadow: `0 4px 20px ${WARM.gold}30, 0 0 40px ${WARM.gold}10`,
                  }}
                >
                  Upgrade to Elite — ${selectedPlan === 'monthly' ? monthlyPrice : annualPrice}/mo
                </button>

                <p className="text-center text-[8px] mt-3 font-mono" style={{ color: WARM.textDim }}>
                  Cancel anytime · 30-day money-back guarantee · Secure checkout
                </p>
              </div>
            )}

            {step === 'processing' && (
              <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                <div className="relative w-16 h-16 mb-5">
                  <div className="absolute inset-0 rounded-full" style={{
                    border: `2px solid ${WARM.gold}15`,
                  }} />
                  <div className="absolute inset-0 rounded-full" style={{
                    border: `2px solid transparent`,
                    borderTopColor: WARM.gold,
                    animation: 'checkoutSpin 1s linear infinite',
                  }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl">🧬</span>
                  </div>
                </div>
                <span className="text-[12px] font-semibold tracking-wide" style={{ color: WARM.textPrimary }}>
                  Activating Elite Protocols...
                </span>
                <span className="text-[9px] font-mono mt-2" style={{ color: WARM.textDim }}>
                  Configuring your biological optimization stack
                </span>
              </div>
            )}

            {step === 'success' && (
              <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                  style={{
                    background: `${WARM.green}15`,
                    border: `2px solid ${WARM.green}40`,
                    boxShadow: `0 0 30px ${WARM.green}15`,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={WARM.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </motion.div>
                <span className="text-[14px] font-bold tracking-wide" style={{ color: WARM.textPrimary }}>
                  Elite Access Activated
                </span>
                <span className="text-[10px] mt-2 text-center leading-relaxed max-w-[280px]" style={{ color: WARM.textDim }}>
                  Your advanced longevity protocols are now unlocked. Welcome to the next level of biological optimization.
                </span>
                <button
                  onClick={handleClose}
                  className="mt-6 px-8 py-2.5 rounded-xl text-[11px] font-bold tracking-[0.08em] uppercase transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: `${WARM.gold}15`,
                    color: WARM.gold,
                    border: `1px solid ${WARM.gold}30`,
                  }}
                >
                  Begin Protocols
                </button>
              </div>
            )}

            {/* Ambient scan line */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden rounded-2xl" style={{ opacity: 0.015 }}>
              <div className="absolute left-0 w-full h-[1px]" style={{
                background: `linear-gradient(90deg, transparent, ${WARM.gold}, transparent)`,
                animation: 'checkoutScan 6s linear infinite',
              }} />
            </div>

            <style>{`
              @keyframes checkoutSpin {
                to { transform: rotate(360deg); }
              }
              @keyframes checkoutScan {
                0% { top: -2%; }
                100% { top: 102%; }
              }
            `}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CheckoutModal;
