import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

interface QuickActionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: () => void;
  onTakePhoto: () => void;
}

export function QuickActionOverlay({ isOpen, onClose, onSendMessage, onTakePhoto }: QuickActionOverlayProps) {
  const ghostMode = useGhostMode();
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';
  const neonHex = ghostMode ? '#a0a0a0' : '#00FFCC';

  const handleMessage = useCallback(() => {
    onSendMessage();
    onClose();
  }, [onSendMessage, onClose]);

  const handlePhoto = useCallback(() => {
    onTakePhoto();
    onClose();
  }, [onTakePhoto, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{
              background: ghostMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative z-10 w-full max-w-sm mx-4 mb-28"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute -inset-4 rounded-3xl pointer-events-none"
              style={{
                background: ghostMode
                  ? 'radial-gradient(ellipse at center bottom, rgba(160,160,160,0.06) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse at center bottom, rgba(0,255,204,0.08) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }}
            />

            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: ghostMode ? 'rgba(18,18,18,0.95)' : 'rgba(8,12,14,0.95)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(0,255,204,0.12)'}`,
                boxShadow: ghostMode
                  ? '0 -8px 40px rgba(0,0,0,0.4)'
                  : '0 -8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(0,255,204,0.04)',
                backdropFilter: 'blur(40px) saturate(1.5)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
              }}
            >
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{
                      background: `${neon}0.1)`,
                      border: `1px solid ${neon}0.2)`,
                    }}
                  >
                    <span className="text-[9px] font-bold" style={{ color: neonHex }}>V</span>
                  </div>
                  <span
                    className="text-[11px] font-mono uppercase tracking-[0.2em]"
                    style={{ color: `${neon}0.5)` }}
                  >
                    Quick Action
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90"
                  style={{
                    background: `${neon}0.06)`,
                    border: `1px solid ${neon}0.1)`,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1L9 9M9 1L1 9" stroke={`${neon}0.4)`} strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="px-4 pb-4 pt-1 flex gap-3">
                <ActionButton
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M21 3L14.5 21L11 13L3 9.5L21 3Z" stroke={neonHex} strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M21 3L11 13" stroke={neonHex} strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  }
                  label="Send Message"
                  sublabel="Text to Vive AI"
                  ghostMode={ghostMode}
                  neon={neon}
                  onClick={handleMessage}
                  accentColor={ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,255,204,0.06)'}
                  accentBorder={ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.15)'}
                  delay={0}
                />
                <ActionButton
                  icon={
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M23 19C23 20.1 22.1 21 21 21H3C1.9 21 1 20.1 1 19V8C1 6.9 1.9 6 3 6H7L9 3H15L17 6H21C22.1 6 23 6.9 23 8V19Z" stroke={ghostMode ? '#a0a0a0' : '#30D158'} strokeWidth="1.8" strokeLinejoin="round" />
                      <circle cx="12" cy="13" r="4" stroke={ghostMode ? '#a0a0a0' : '#30D158'} strokeWidth="1.8" />
                    </svg>
                  }
                  label="Take Photo"
                  sublabel="Capture & Log"
                  ghostMode={ghostMode}
                  neon={neon}
                  onClick={handlePhoto}
                  accentColor={ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(48,209,88,0.06)'}
                  accentBorder={ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(48,209,88,0.15)'}
                  delay={0.05}
                />
              </div>

              <div className="px-5 pb-3 flex items-center justify-center gap-1.5">
                <span className="text-[9px] font-mono" style={{ color: `${neon}0.25)` }}>
                  Hold V for voice \u00B7 Double-tap for photo
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* \u2500\u2500 Individual Action Button \u2500\u2500 */
function ActionButton({
  icon, label, sublabel, ghostMode, neon, onClick, accentColor, accentBorder, delay,
}: {
  icon: React.ReactNode; label: string; sublabel: string; ghostMode: boolean;
  neon: string; onClick: () => void; accentColor: string; accentBorder: string; delay: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: delay + 0.1, ease: [0.25, 0.1, 0.25, 1] }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex-1 flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl transition-all duration-200 active:scale-95"
      style={{
        background: hover
          ? (ghostMode ? 'rgba(160,160,160,0.12)' : accentColor.replace('0.06)', '0.12)'))
          : accentColor,
        border: `1px solid ${hover
          ? (ghostMode ? 'rgba(160,160,160,0.25)' : accentBorder.replace('0.15)', '0.3)'))
          : accentBorder}`,
        boxShadow: hover
          ? (ghostMode ? '0 0 20px rgba(160,160,160,0.05)' : `0 0 20px ${accentColor}`)
          : 'none',
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200"
        style={{
          background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.05)'}`,
          transform: hover ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        {icon}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-[12px] font-semibold tracking-wide"
          style={{ color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(255,255,255,0.85)' }}
        >
          {label}
        </span>
        <span
          className="text-[9px] font-mono uppercase tracking-wider"
          style={{ color: `${neon}0.35)` }}
        >
          {sublabel}
        </span>
      </div>
    </motion.button>
  );
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
/* \u2500\u2500 Push-to-Talk Overlay (shown during long press) \u2500\u2500 */
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

export type PushToTalkPhase = 'listening' | 'processing' | 'done';

interface PushToTalkOverlayProps {
  isActive: boolean;
  phase?: PushToTalkPhase;
  transcript?: string;
}

export function PushToTalkOverlay({ isActive, phase = 'listening', transcript }: PushToTalkOverlayProps) {
  const ghostMode = useGhostMode();
  const [bars, setBars] = useState<number[]>(Array(32).fill(0.15));
  const animRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!isActive || phase !== 'listening') {
      if (phase === 'processing') {
        // Slow gentle wave during processing
        const animate = () => {
          phaseRef.current += 0.03;
          const p = phaseRef.current;
          const newBars = Array.from({ length: 32 }, (_, i) => {
            const w = Math.sin(p + i * 0.3) * 0.12 + 0.2;
            return Math.max(0.08, Math.min(0.4, w));
          });
          setBars(newBars);
          animRef.current = requestAnimationFrame(animate);
        };
        animRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animRef.current);
      }
      setBars(Array(32).fill(0.15));
      return;
    }
    const animate = () => {
      phaseRef.current += 0.06;
      const p = phaseRef.current;
      const newBars = Array.from({ length: 32 }, (_, i) => {
        const center = 16;
        const dist = Math.abs(i - center) / center;
        const base = 0.15 + (1 - dist) * 0.2;
        const w1 = Math.sin(p + i * 0.35) * 0.25;
        const w2 = Math.cos(p * 1.4 + i * 0.2) * 0.15;
        const w3 = Math.sin(p * 0.7 + i * 0.5) * 0.1;
        const noise = Math.random() * 0.08;
        return Math.max(0.06, Math.min(1, base + w1 + w2 + w3 + noise));
      });
      setBars(newBars);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive, phase]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[150] pointer-events-none flex flex-col items-center justify-end pb-32"
        >
          {/* Screen-edge glow — pulsates from bottom */}
          <motion.div
            className="absolute inset-0"
            animate={{
              background: phase === 'processing'
                ? [
                    ghostMode
                      ? 'radial-gradient(ellipse at 50% 100%, rgba(160,160,160,0.06) 0%, transparent 50%)'
                      : 'radial-gradient(ellipse at 50% 100%, rgba(0,255,204,0.08) 0%, transparent 50%)',
                    ghostMode
                      ? 'radial-gradient(ellipse at 50% 100%, rgba(160,160,160,0.1) 0%, transparent 55%)'
                      : 'radial-gradient(ellipse at 50% 100%, rgba(0,255,204,0.12) 0%, transparent 55%)',
                    ghostMode
                      ? 'radial-gradient(ellipse at 50% 100%, rgba(160,160,160,0.06) 0%, transparent 50%)'
                      : 'radial-gradient(ellipse at 50% 100%, rgba(0,255,204,0.08) 0%, transparent 50%)',
                  ]
                : [
                    ghostMode
                      ? 'radial-gradient(ellipse at 50% 100%, rgba(160,160,160,0.1) 0%, transparent 60%)'
                      : 'radial-gradient(ellipse at 50% 100%, rgba(0,255,204,0.12) 0%, transparent 60%)',
                    ghostMode
                      ? 'radial-gradient(ellipse at 50% 100%, rgba(160,160,160,0.2) 0%, transparent 70%)'
                      : 'radial-gradient(ellipse at 50% 100%, rgba(0,255,204,0.22) 0%, transparent 70%)',
                    ghostMode
                      ? 'radial-gradient(ellipse at 50% 100%, rgba(160,160,160,0.1) 0%, transparent 60%)'
                      : 'radial-gradient(ellipse at 50% 100%, rgba(0,255,204,0.12) 0%, transparent 60%)',
                  ],
            }}
            transition={{ duration: phase === 'processing' ? 2 : 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Left edge glow */}
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-16 pointer-events-none"
            animate={{
              opacity: phase === 'listening' ? [0, 0.4, 0] : [0, 0.2, 0],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: ghostMode
                ? 'linear-gradient(to right, rgba(160,160,160,0.08), transparent)'
                : 'linear-gradient(to right, rgba(0,255,204,0.06), transparent)',
            }}
          />

          {/* Right edge glow */}
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none"
            animate={{
              opacity: phase === 'listening' ? [0, 0.4, 0] : [0, 0.2, 0],
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            style={{
              background: ghostMode
                ? 'linear-gradient(to left, rgba(160,160,160,0.08), transparent)'
                : 'linear-gradient(to left, rgba(0,255,204,0.06), transparent)',
            }}
          />

          {/* Concentric pulse rings from V button area */}
          <motion.div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: 200,
              height: 200,
              border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,255,204,0.1)'}`,
            }}
            animate={{ scale: [1, 2.8], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: 200,
              height: 200,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(0,255,204,0.07)'}`,
            }}
            animate={{ scale: [1, 3.2], opacity: [0.35, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          />
          <motion.div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
            style={{
              width: 200,
              height: 200,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(0,255,204,0.05)'}`,
            }}
            animate={{ scale: [1, 3.6], opacity: [0.25, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 1 }}
          />

          {/* Waveform visualization */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="relative flex items-end justify-center gap-[2px] mb-6"
            style={{ height: 48, width: '70%', maxWidth: 280 }}
          >
            {bars.map((h, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 3,
                  height: `${Math.max(8, h * 100)}%`,
                  background: ghostMode
                    ? `rgba(160,160,160,${0.2 + h * 0.5})`
                    : `rgba(0,255,204,${0.2 + h * 0.6})`,
                  boxShadow: ghostMode
                    ? 'none'
                    : `0 0 ${Math.round(h * 6)}px rgba(0,255,204,${h * 0.3})`,
                  transition: 'height 0.08s ease-out',
                }}
              />
            ))}
          </motion.div>

          {/* Transcript feedback (shown during processing) */}
          <AnimatePresence>
            {phase === 'processing' && transcript && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 px-4 py-2 rounded-xl max-w-[280px] text-center"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,255,204,0.06)',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(0,255,204,0.1)'}`,
                }}
              >
                <p
                  className="text-[13px] font-medium italic"
                  style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.8)' }}
                >
                  &ldquo;{transcript}&rdquo;
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="flex items-center gap-2">
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{
                  background: phase === 'processing'
                    ? (ghostMode ? '#a0a0a0' : '#FFD60A')
                    : (ghostMode ? '#a0a0a0' : '#00FFCC'),
                  boxShadow: phase === 'processing'
                    ? (ghostMode ? 'none' : '0 0 8px rgba(255,214,10,0.5)')
                    : (ghostMode ? 'none' : '0 0 8px rgba(0,255,204,0.5)'),
                }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: phase === 'processing' ? 0.6 : 1, repeat: Infinity }}
              />
              <span
                className="text-[11px] font-mono uppercase tracking-[0.25em] font-semibold"
                style={{
                  color: phase === 'processing'
                    ? (ghostMode ? 'rgba(160,160,160,0.7)' : 'rgba(255,214,10,0.85)')
                    : (ghostMode ? 'rgba(160,160,160,0.7)' : 'rgba(0,255,204,0.85)'),
                }}
              >
                {phase === 'processing' ? 'Processing...' : 'Listening'}
              </span>
            </div>
            <span
              className="text-[9px] font-mono tracking-wider"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(0,255,204,0.35)' }}
            >
              {phase === 'processing' ? 'Sending to Vive AI' : 'Release to send to Vive AI'}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
