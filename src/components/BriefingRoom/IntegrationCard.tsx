import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Integration Types ── */
export interface Integration {
  id: string;
  name: string;
  subtitle: string;
  brandColor: string;
  category: 'wearables' | 'nutrition' | 'clinical';
  metrics: number;
  dataTypes: string[];
}

/* ── SVG Brand Icons (no emojis) ── */
export function IntegrationIcon({ id, size = 20, color }: { id: string; size?: number; color: string }) {
  const s = size;

  // Apple Health — heart
  if (id === 'apple-health') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill={color} />
      </svg>
    );
  }

  // Oura — ring
  if (id === 'oura') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2.5" />
        <circle cx="12" cy="12" r="4" stroke={color} strokeWidth="1.5" opacity="0.5" />
      </svg>
    );
  }

  // WHOOP — pulse wave
  if (id === 'whoop') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M2 12h4l3-8 4 16 3-8h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Garmin — compass/clock
  if (id === 'garmin') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <path d="M12 3v9l6 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // MyFitnessPal — fork+knife
  if (id === 'myfitnesspal') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M3 2v7c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V2" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M7 2v20" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M21 15V2c-2.5 0-5 2-5 5v4c0 1.1.9 2 2 2h1v9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Cronometer — pie chart
  if (id === 'cronometer') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <path d="M12 3v9h9" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // InsideTracker — microscope/lab
  if (id === 'insidetracker') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M9 2v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M15 2v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <rect x="5" y="8" width="14" height="4" rx="1" stroke={color} strokeWidth="2" />
        <path d="M12 12v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 20h8" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M12 16v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Function Health — shield
  if (id === 'function-health') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Dexcom — glucose wave
  if (id === 'dexcom') {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2" fill={color} opacity="0.5" />
      </svg>
    );
  }

  // Fallback — generic node
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill={color} opacity="0.4" />
    </svg>
  );
}

/* ── Hex to RGB ── */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

/* ── Integration Card ── */
export function IntegrationCard({
  integration,
  isConnected,
  onToggle,
  index = 0,
}: {
  integration: Integration;
  isConnected: boolean;
  onToggle: () => void;
  index?: number;
}) {
  const [syncing, setSyncing] = useState(false);
  const [justConnected, setJustConnected] = useState(false);

  const handleToggle = () => {
    if (syncing) return;
    if (!isConnected) {
      setSyncing(true);
      onToggle();
      setTimeout(() => {
        setSyncing(false);
        setJustConnected(true);
        setTimeout(() => setJustConnected(false), 2000);
      }, 1800);
    } else {
      onToggle();
      setJustConnected(false);
    }
  };

  const rgb = hexToRgb(integration.brandColor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-300"
      style={{
        background: isConnected
          ? `rgba(${rgb}, 0.04)`
          : 'rgba(255,255,255,0.015)',
        borderColor: isConnected
          ? `rgba(${rgb}, 0.15)`
          : 'rgba(255,255,255,0.04)',
        boxShadow: isConnected
          ? `0 0 16px rgba(${rgb}, 0.06)`
          : 'none',
      }}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: isConnected
            ? `rgba(${rgb}, 0.1)`
            : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isConnected ? `rgba(${rgb}, 0.2)` : 'rgba(255,255,255,0.05)'}`,
        }}
      >
        <IntegrationIcon
          id={integration.id}
          size={18}
          color={isConnected ? integration.brandColor : 'rgba(255,255,255,0.25)'}
        />
      </div>

      {/* Name + Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[12px] font-semibold tracking-wide truncate"
            style={{
              color: isConnected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
            }}
          >
            {integration.name}
          </span>
          {isConnected && !syncing && (
            <div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background: integration.brandColor,
                boxShadow: `0 0 4px ${integration.brandColor}`,
                animation: 'integrationLiveDot 2s ease-in-out infinite',
              }}
            />
          )}
        </div>
        <span
          className="text-[9px] font-mono uppercase tracking-wider block"
          style={{
            color: syncing
              ? `rgba(${rgb}, 0.7)`
              : isConnected
                ? `rgba(${rgb}, 0.5)`
                : 'rgba(255,255,255,0.2)',
          }}
        >
          {syncing
            ? 'Connecting...'
            : justConnected
              ? `${integration.metrics} metrics synced`
              : isConnected
                ? `${integration.metrics} metrics streaming`
                : 'Coming later · not live'}
        </span>
      </div>

      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        disabled={true}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider font-semibold transition-all duration-300"
        style={{
          background: 'rgba(255,184,107,0.08)',
          color: 'rgba(255,184,107,0.75)',
          border: '1px solid rgba(255,184,107,0.2)',
          opacity: 0.85,
          cursor: 'not-allowed',
        }}
      >
        Coming later
      </button>
    </motion.div>
  );
}

/* ── Category Header ── */
export function CategoryHeader({ title, icon, count, color }: {
  title: string;
  icon: React.ReactNode;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
      <div
        className="w-5 h-5 rounded flex items-center justify-center"
        style={{
          background: `${color}10`,
          border: `1px solid ${color}20`,
        }}
      >
        {icon}
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ color: 'rgba(255,255,255,0.7)' }}
      >
        {title}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <span
        className="text-[8px] font-mono uppercase tracking-wider"
        style={{ color: 'rgba(255,255,255,0.2)' }}
      >
        {count} source{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

/* ── Category Icons (SVG, no emoji) ── */
export function WearablesIcon({ size = 12, color = 'rgba(0,242,255,0.7)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="4" />
      <path d="M12 8v4l2 2" />
    </svg>
  );
}

export function NutritionIcon({ size = 12, color = 'rgba(255,149,0,0.7)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <path d="M6 1v3M10 1v3M14 1v3" />
    </svg>
  );
}

export function ClinicalIcon({ size = 12, color = 'rgba(191,90,242,0.7)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6M15 2v6" />
      <rect x="5" y="8" width="14" height="4" rx="1" />
      <path d="M12 12v4M8 20h8M12 16v4" />
    </svg>
  );
}

/* ── Request Integration Section ── */
export function RequestIntegrationSection() {
  const [submitted, setSubmitted] = useState(false);
  const [inputVal, setInputVal] = useState('');

  return (
    <div
      className="mt-5 rounded-xl border p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(0,242,255,0.02), rgba(191,90,242,0.02))',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        <span
          className="text-[11px] font-semibold tracking-wide"
          style={{ color: 'rgba(255,255,255,0.8)' }}
        >
          Request Integration
        </span>
      </div>
      <p
        className="text-[10px] leading-relaxed mb-3"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        Vive is a growing central hub for all health data. Don't see your device or app? Let us know and we'll prioritize it.
      </p>

      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div
            key="form"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="e.g. Polar, Withings, Nutrisense..."
              className="flex-1 bg-transparent text-[11px] text-white/70 placeholder:text-white/15 outline-none px-3 py-2 rounded-lg"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputVal.trim()) setSubmitted(true);
              }}
            />
            <button
              onClick={() => { if (inputVal.trim()) setSubmitted(true); }}
              disabled={!inputVal.trim()}
              className="px-3 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider font-semibold transition-all duration-200"
              style={{
                background: inputVal.trim() ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.02)',
                color: inputVal.trim() ? 'rgba(0,242,255,0.8)' : 'rgba(255,255,255,0.15)',
                border: `1px solid ${inputVal.trim() ? 'rgba(0,242,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                opacity: inputVal.trim() ? 1 : 0.5,
              }}
            >
              Submit
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="thanks"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.12)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span className="text-[10px] font-medium" style={{ color: 'rgba(52,211,153,0.8)' }}>
              Noted! We'll prioritize <strong style={{ color: '#34D399' }}>{inputVal}</strong> integration.
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
