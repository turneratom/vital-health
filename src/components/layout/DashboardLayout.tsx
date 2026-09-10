import { useState, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD LAYOUT — Executive Command Center Shell
   
   Glassmorphism aesthetic with:
   - Clean static gradient background (no particles)
   - Haptic visual feedback system (glass-shatter, glow pulse)
   - Mobile-first tab-bar focused layout
   ═══════════════════════════════════════════════════════════════ */

/* ── Haptic Feedback Context ── */
interface HapticContextType {
  triggerGlow: (color?: string) => void;
  triggerShatter: () => void;
  triggerSuccess: () => void;
}

const HapticContext = createContext<HapticContextType>({
  triggerGlow: () => {},
  triggerShatter: () => {},
  triggerSuccess: () => {},
});

export function useHaptic() {
  return useContext(HapticContext);
}

/* ── Haptic Glow Overlay ── */
function HapticOverlay({ glowColor, showShatter, showSuccess }: {
  glowColor: string | null;
  showShatter: boolean;
  showSuccess: boolean;
}) {
  return (
    <>
      {/* Glow pulse overlay */}
      <AnimatePresence>
        {glowColor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 pointer-events-none z-[200]"
            style={{
              background: `radial-gradient(circle at center, ${glowColor}0D 0%, transparent 60%)`,
              boxShadow: `inset 0 0 60px ${glowColor}05`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Glass shatter effect removed — clean UI */}

      {/* Success ripple */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0.5, scale: 0 }}
            animate={{ opacity: 0, scale: 3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[201]"
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              border: '2px solid rgba(124,182,142,0.3)',
              boxShadow: '0 0 30px rgba(124,182,142,0.15)',
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Glass Panel Wrapper ── */
export function GlassPanel({ children, className = '', glow = false, padding = true }: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  padding?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${padding ? 'p-5' : ''} ${className}`}
      style={{
        background: 'rgba(26, 24, 22, 0.75)',
        backdropFilter: 'blur(20px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
        borderColor: glow ? 'rgba(232,151,108,0.15)' : 'rgba(42,38,34,0.8)',
        boxShadow: glow
          ? '0 4px 24px rgba(0,0,0,0.2), 0 0 16px rgba(232,151,108,0.04), inset 0 1px 0 rgba(255,255,255,0.02)'
          : '0 2px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      {/* Subtle gradient border overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          padding: 1,
          background: 'linear-gradient(135deg, rgba(232,151,108,0.06), transparent 40%, transparent 60%, rgba(124,182,142,0.03))',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {children}
    </div>
  );
}

/* ── Main Dashboard Layout ── */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [glowColor, setGlowColor] = useState<string | null>(null);
  const showShatter = false;
  const [showSuccess, setShowSuccess] = useState(false);

  const triggerGlow = useCallback((color: string = '#E8976C') => {
    setGlowColor(color);
    setTimeout(() => setGlowColor(null), 300);
  }, []);

  const triggerShatter = useCallback(() => {
    // Glass shatter removed — no-op
  }, []);

  const triggerSuccess = useCallback(() => {
    setShowSuccess(true);
    triggerGlow('#7CB68E');
    setTimeout(() => setShowSuccess(false), 800);
  }, [triggerGlow]);

  const hapticValue = { triggerGlow, triggerShatter, triggerSuccess };

  return (
    <HapticContext.Provider value={hapticValue}>
      <div
        className="relative min-h-screen"
        style={{
          background: 'linear-gradient(135deg, #0A0A0B 0%, #121214 50%, #0F0E0D 100%)',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}
      >
        <HapticOverlay glowColor={glowColor} showShatter={showShatter} showSuccess={showSuccess} />

        {/* Main content */}
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </HapticContext.Provider>
  );
}

export default DashboardLayout;
