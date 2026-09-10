import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════════════════════════ */
/*  PERFORMANCE TIMELINE — 24-HOUR BIO-WINDOW MAP                */
/*  Maps circadian Bio-Windows (Cortisol Peak, Metabolic Window,  */
/*  Melatonin Onset) as color-graded zones with a real-time       */
/*  "NOW" indicator showing current biological state.             */
/* ══════════════════════════════════════════════════════════════ */

const ELECTRIC_BLUE = '#00F0FF';
const EB = (a: number) => `rgba(0,240,255,${a})`;

/* ── Bio-Window Definitions ── */
interface BioWindow {
  id: string;
  label: string;
  shortLabel: string;
  startHour: number;
  endHour: number;
  color: string;
  colorRgb: string;
  description: string;
  hormone: string;
  peakHour: number;
  icon: 'cortisol' | 'testosterone' | 'growth' | 'insulin' | 'melatonin' | 'repair' | 'focus' | 'metabolic';
  intensity: number; // 0-1 for gradient strength
}

const BIO_WINDOWS: BioWindow[] = [
  {
    id: 'deep-sleep',
    label: 'Deep Sleep / HGH Release',
    shortLabel: 'HGH',
    startHour: 0,
    endHour: 4,
    color: '#6C5CE7',
    colorRgb: '108,92,231',
    description: 'Growth hormone peaks during deep NREM sleep. Critical for tissue repair and muscle recovery.',
    hormone: 'Growth Hormone',
    peakHour: 2,
    icon: 'growth',
    intensity: 0.85,
  },
  {
    id: 'pre-dawn-repair',
    label: 'Pre-Dawn Cellular Repair',
    shortLabel: 'REPAIR',
    startHour: 4,
    endHour: 6,
    color: '#A29BFE',
    colorRgb: '162,155,254',
    description: 'Autophagy peaks. Body temperature at lowest. Final REM cycles consolidate memory.',
    hormone: 'Melatonin (declining)',
    peakHour: 5,
    icon: 'repair',
    intensity: 0.6,
  },
  {
    id: 'cortisol-peak',
    label: 'Cortisol Awakening Response',
    shortLabel: 'CORTISOL',
    startHour: 6,
    endHour: 9,
    color: '#FF6B6B',
    colorRgb: '255,107,107',
    description: 'Cortisol surges 50-75% within 30 min of waking. Optimal for sunlight exposure and cold therapy.',
    hormone: 'Cortisol',
    peakHour: 7.5,
    icon: 'cortisol',
    intensity: 0.95,
  },
  {
    id: 'testosterone-peak',
    label: 'Testosterone / Anabolic Window',
    shortLabel: 'T-PEAK',
    startHour: 9,
    endHour: 11,
    color: '#FF9F43',
    colorRgb: '255,159,67',
    description: 'Testosterone peaks. Ideal window for strength training and high-intensity work.',
    hormone: 'Testosterone',
    peakHour: 10,
    icon: 'testosterone',
    intensity: 0.9,
  },
  {
    id: 'cognitive-peak',
    label: 'Cognitive Peak / Deep Work',
    shortLabel: 'FOCUS',
    startHour: 11,
    endHour: 14,
    color: ELECTRIC_BLUE,
    colorRgb: '0,240,255',
    description: 'Dopamine and norepinephrine optimized. Peak cognitive performance and working memory.',
    hormone: 'Dopamine + NE',
    peakHour: 12.5,
    icon: 'focus',
    intensity: 1.0,
  },
  {
    id: 'metabolic-window',
    label: 'Metabolic / Insulin Sensitivity',
    shortLabel: 'METABOLIC',
    startHour: 14,
    endHour: 17,
    color: '#FECA57',
    colorRgb: '254,202,87',
    description: 'Insulin sensitivity declining. Best window for Zone 2 cardio and moderate exercise.',
    hormone: 'Insulin',
    peakHour: 15.5,
    icon: 'metabolic',
    intensity: 0.75,
  },
  {
    id: 'second-wind',
    label: 'Second Wind / Coordination Peak',
    shortLabel: 'COORD',
    startHour: 17,
    endHour: 19,
    color: '#48DBFB',
    colorRgb: '72,219,251',
    description: 'Core body temp peaks. Reaction time and cardiovascular efficiency at maximum.',
    hormone: 'Adrenaline',
    peakHour: 18,
    icon: 'testosterone',
    intensity: 0.7,
  },
  {
    id: 'wind-down',
    label: 'Parasympathetic Shift',
    shortLabel: 'WIND-DOWN',
    startHour: 19,
    endHour: 21,
    color: '#C44569',
    colorRgb: '196,69,105',
    description: 'Cortisol declining. Dim light melatonin onset approaching. Avoid blue light and heavy meals.',
    hormone: 'Cortisol (declining)',
    peakHour: 20,
    icon: 'repair',
    intensity: 0.55,
  },
  {
    id: 'melatonin-onset',
    label: 'Melatonin Onset / Sleep Gate',
    shortLabel: 'MELATONIN',
    startHour: 21,
    endHour: 24,
    color: '#BF5AF2',
    colorRgb: '191,90,242',
    description: 'Melatonin secretion begins. Core temp drops. Optimal sleep onset window opens.',
    hormone: 'Melatonin',
    peakHour: 22.5,
    icon: 'melatonin',
    intensity: 0.8,
  },
];

/* ── Bio-Window Icon Components ── */
function BioIcon({ type, size = 12, color }: { type: BioWindow['icon']; size?: number; color: string }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'cortisol':
      return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;
    case 'testosterone':
      return <svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
    case 'growth':
      return <svg {...p}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>;
    case 'insulin':
      return <svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case 'melatonin':
      return <svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
    case 'repair':
      return <svg {...p}><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 6v6l4 2" /></svg>;
    case 'focus':
      return <svg {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'metabolic':
      return <svg {...p}><path d="M12 2c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13z" /></svg>;
  }
}

/* ── Decrypting Text Effect ── */
function DecryptText({ text, isActive, color = 'rgba(255,255,255,0.7)', className = '' }: { text: string; isActive: boolean; color?: string; className?: string }) {
  const [display, setDisplay] = useState(text);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_./:';
  const frameRef = useRef(0);
  const iterRef = useRef(0);

  useEffect(() => {
    if (!isActive) { setDisplay(text); return; }
    iterRef.current = 0;
    const maxIter = text.length;
    const interval = setInterval(() => {
      iterRef.current += 1;
      const revealed = Math.floor((iterRef.current / (maxIter * 1.5)) * text.length);
      const result = text.split('').map((ch, i) => {
        if (ch === ' ') return ' ';
        if (i < revealed) return text[i];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      setDisplay(result);
      if (iterRef.current >= maxIter * 1.5) {
        setDisplay(text);
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text, isActive]);

  return <span className={className} style={{ color, fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace' }}>{display}</span>;
}

/* ── Hour formatter ── */
function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12A';
  if (h === 12) return '12P';
  if (h < 12) return `${h}A`;
  return `${h - 12}P`;
}

function formatHourFull(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return min > 0 ? `${h12}:${min.toString().padStart(2, '0')} ${ampm}` : `${h12}:00 ${ampm}`;
}

/* ── Get current bio-window ── */
function getCurrentBioWindow(hour: number): BioWindow | null {
  return BIO_WINDOWS.find(w => hour >= w.startHour && hour < w.endHour) ?? null;
}

/* ══════════════════════════════════════════════════════════════ */
/*  TOOLTIP COMPONENT                                            */
/* ══════════════════════════════════════════════════════════════ */
function WindowTooltip({ window: w, x, containerRect }: { window: BioWindow; x: number; containerRect: DOMRect | null }) {
  const tooltipWidth = 240;
  let left = x - tooltipWidth / 2;
  if (containerRect) {
    if (left < 8) left = 8;
    if (left + tooltipWidth > containerRect.width - 8) left = containerRect.width - tooltipWidth - 8;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="absolute z-50 pointer-events-none"
      style={{ bottom: '100%', left, marginBottom: 8, width: tooltipWidth }}
    >
      <div className="rounded-xl overflow-hidden" style={{
        background: 'rgba(8,8,12,0.96)',
        border: `1px solid rgba(${w.colorRgb},0.35)`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(${w.colorRgb},0.1)`,
        backdropFilter: 'blur(16px)',
      }}>
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${w.color}, transparent)` }} />
        <div className="px-3.5 py-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `rgba(${w.colorRgb},0.12)`, border: `1px solid rgba(${w.colorRgb},0.25)` }}>
              <BioIcon type={w.icon} size={11} color={w.color} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider" style={{ color: w.color }}>{w.label}</span>
              <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: `rgba(${w.colorRgb},0.5)` }}>
                {formatHourFull(w.startHour)} - {formatHourFull(w.endHour)} / Peak: {formatHourFull(w.peakHour)}
              </span>
            </div>
          </div>
          <p className="text-[9px] leading-[1.6] mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{w.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: `rgba(${w.colorRgb},0.08)`, color: `rgba(${w.colorRgb},0.7)`, border: `1px solid rgba(${w.colorRgb},0.15)` }}>
              {w.hormone}
            </span>
            <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Intensity: {Math.round(w.intensity * 100)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                               */
/* ══════════════════════════════════════════════════════════════ */
export function PerformanceTimeline() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredWindow, setHoveredWindow] = useState<string | null>(null);
  const [hoveredX, setHoveredX] = useState(0);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(true);
  const [bootPhase, setBootPhase] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const currentHourDecimal = currentTime.getHours() + currentTime.getMinutes() / 60;
  const currentBioWindow = useMemo(() => getCurrentBioWindow(currentHourDecimal), [currentHourDecimal]);
  const nowPosition = currentHourDecimal / 24;

  // Boot sequence
  const bootMessages = useMemo(() => [
    'INITIALIZING CIRCADIAN MAP...',
    'LOADING HORMONAL PROFILES...',
    'MAPPING BIO-WINDOWS...',
    'CALIBRATING TEMPORAL AXIS...',
    'SYNCHRONIZING BIOLOGICAL CLOCK...',
    'TIMELINE ACTIVE',
  ], []);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setBootPhase(i);
      if (i >= bootMessages.length) {
        setTimeout(() => setIsDecrypting(false), 300);
        clearInterval(interval);
      }
    }, 350);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (!scrollRef.current || isDecrypting) return;
    const hourWidth = 80;
    const scrollTo = Math.max(0, currentHourDecimal * hourWidth - 140);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }, 400);
  }, [isDecrypting]);

  // Track container rect for tooltip positioning
  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => setContainerRect(containerRef.current?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isDecrypting]);

  const HOUR_WIDTH = 80;
  const TOTAL_WIDTH = 24 * HOUR_WIDTH;
  const ZONE_HEIGHT = 72;

  const handleWindowHover = useCallback((windowId: string | null, clientX?: number) => {
    setHoveredWindow(windowId);
    if (clientX != null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setHoveredX(clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0));
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full rounded-xl overflow-hidden relative" style={{
      background: 'rgba(0,0,0,0.6)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
            background: EB(0.08),
            border: `1px solid ${EB(0.2)}`,
            boxShadow: `0 0 10px ${EB(0.1)}`,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ELECTRIC_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex flex-col">
            <DecryptText
              text="CIRCADIAN BIO-MAP"
              isActive={isDecrypting}
              color="rgba(255,255,255,0.85)"
              className="text-[11px] font-bold tracking-[0.12em] uppercase"
            />
            <DecryptText
              text="24H HORMONAL WINDOW TRACKER"
              isActive={isDecrypting}
              color={EB(0.5)}
              className="text-[8px] tracking-[0.15em] uppercase"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentBioWindow && !isDecrypting && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md"
              style={{
                background: `rgba(${currentBioWindow.colorRgb},0.08)`,
                border: `1px solid rgba(${currentBioWindow.colorRgb},0.2)`,
              }}
            >
              <BioIcon type={currentBioWindow.icon} size={9} color={currentBioWindow.color} />
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider" style={{ color: currentBioWindow.color }}>
                {currentBioWindow.shortLabel}
              </span>
            </motion.div>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded" style={{
            background: 'rgba(52,211,153,0.06)',
            border: '1px solid rgba(52,211,153,0.12)',
          }}>
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#34D399', boxShadow: '0 0 4px rgba(52,211,153,0.5)' }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[8px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'rgba(52,211,153,0.8)' }}>
              Live
            </span>
          </div>
        </div>
      </div>

      {/* ── Boot Sequence ── */}
      <AnimatePresence>
        {isDecrypting && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
            className="px-4 py-4"
          >
            <div className="flex flex-col gap-1.5">
              {bootMessages.map((msg, i) => {
                const isDone = i < bootPhase;
                const isActive = i === bootPhase;
                const isPending = i > bootPhase;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: isPending ? 0.2 : 1, x: 0 }}
                    transition={{ duration: 0.2, delay: i * 0.03 }}
                    className="flex items-center gap-2"
                  >
                    {isDone ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                    ) : isActive ? (
                      <motion.div className="w-2.5 h-2.5 rounded-full" style={{ background: ELECTRIC_BLUE, boxShadow: `0 0 6px ${EB(0.6)}` }} animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.6, repeat: Infinity }} />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                    )}
                    <DecryptText
                      text={msg}
                      isActive={isActive}
                      color={isDone ? 'rgba(52,211,153,0.7)' : isActive ? EB(0.9) : 'rgba(255,255,255,0.15)'}
                      className="text-[9px] font-bold tracking-[0.15em] uppercase"
                    />
                  </motion.div>
                );
              })}
            </div>
            {/* Boot progress bar */}
            <div className="mt-3 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${ELECTRIC_BLUE}, #34D399)` }}
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(100, (bootPhase / bootMessages.length) * 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Current State Banner ── */}
      {!isDecrypting && currentBioWindow && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-4 mt-3 mb-2 rounded-lg px-3 py-2.5 flex items-center gap-3"
          style={{
            background: `linear-gradient(135deg, rgba(${currentBioWindow.colorRgb},0.06), rgba(0,0,0,0.2))`,
            border: `1px solid rgba(${currentBioWindow.colorRgb},0.15)`,
          }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
            background: `rgba(${currentBioWindow.colorRgb},0.1)`,
            border: `1px solid rgba(${currentBioWindow.colorRgb},0.25)`,
            boxShadow: `0 0 12px rgba(${currentBioWindow.colorRgb},0.1)`,
          }}>
            <BioIcon type={currentBioWindow.icon} size={14} color={currentBioWindow.color} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <DecryptText
                text={`ACTIVE: ${currentBioWindow.label.toUpperCase()}`}
                isActive={true}
                color={currentBioWindow.color}
                className="text-[9px] font-bold tracking-[0.12em] uppercase"
              />
            </div>
            <span className="text-[8px] leading-relaxed mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
              {currentBioWindow.hormone} / Peak @ {formatHourFull(currentBioWindow.peakHour)}
            </span>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-[11px] font-mono font-bold" style={{ color: currentBioWindow.color }}>
              {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
            <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>
              System Time
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Timeline Scroll Area ── */}
      {!isDecrypting && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div
            ref={scrollRef}
            className="overflow-x-auto overflow-y-hidden"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: `${EB(0.15)} transparent`,
            }}
          >
            <div className="relative" style={{ width: TOTAL_WIDTH, height: ZONE_HEIGHT + 50, minWidth: TOTAL_WIDTH }}>

              {/* ── Bio-Window Color Zones ── */}
              {BIO_WINDOWS.map((w) => {
                const left = (w.startHour / 24) * TOTAL_WIDTH;
                const width = ((w.endHour - w.startHour) / 24) * TOTAL_WIDTH;
                const isHovered = hoveredWindow === w.id;
                const isCurrent = currentBioWindow?.id === w.id;
                const peakX = (w.peakHour / 24) * TOTAL_WIDTH;

                return (
                  <div
                    key={w.id}
                    className="absolute top-0 cursor-pointer transition-all duration-200"
                    style={{
                      left,
                      width,
                      height: ZONE_HEIGHT,
                      background: `linear-gradient(180deg, rgba(${w.colorRgb},${isHovered ? w.intensity * 0.18 : w.intensity * 0.1}), rgba(${w.colorRgb},${isHovered ? 0.04 : 0.01}))`,
                      borderLeft: `1px solid rgba(${w.colorRgb},${isHovered ? 0.35 : 0.12})`,
                      borderRight: `1px solid rgba(${w.colorRgb},0.04)`,
                    }}
                    onMouseEnter={(e) => handleWindowHover(w.id, e.clientX)}
                    onMouseMove={(e) => {
                      if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        setHoveredX(e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0));
                      }
                    }}
                    onMouseLeave={() => handleWindowHover(null)}
                  >
                    {/* Intensity gradient bar at top */}
                    <div className="absolute top-0 left-0 right-0 h-[3px]" style={{
                      background: `linear-gradient(90deg, rgba(${w.colorRgb},0.1), rgba(${w.colorRgb},${w.intensity * 0.6}), rgba(${w.colorRgb},0.1))`,
                    }} />

                    {/* Peak indicator triangle */}
                    <div className="absolute" style={{ left: peakX - left - 3, top: 0 }}>
                      <div style={{
                        width: 0, height: 0,
                        borderLeft: '3px solid transparent',
                        borderRight: '3px solid transparent',
                        borderTop: `4px solid ${w.color}`,
                        opacity: 0.6,
                      }} />
                    </div>

                    {/* Zone label */}
                    <div className="absolute flex flex-col items-center" style={{
                      left: '50%',
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <BioIcon type={w.icon} size={10} color={`rgba(${w.colorRgb},${isHovered ? 0.9 : 0.5})`} />
                        <span className="text-[8px] font-mono font-bold uppercase tracking-[0.12em] whitespace-nowrap transition-colors duration-200" style={{
                          color: `rgba(${w.colorRgb},${isHovered ? 0.95 : isCurrent ? 0.7 : 0.45})`,
                          textShadow: isHovered ? `0 0 8px rgba(${w.colorRgb},0.3)` : 'none',
                        }}>
                          {w.shortLabel}
                        </span>
                      </div>
                      <span className="text-[7px] font-mono uppercase tracking-wider whitespace-nowrap" style={{
                        color: `rgba(${w.colorRgb},${isHovered ? 0.5 : 0.25})`,
                      }}>
                        {w.hormone}
                      </span>
                    </div>

                    {/* Current window glow */}
                    {isCurrent && (
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at ${((currentHourDecimal - w.startHour) / (w.endHour - w.startHour)) * 100}% 50%, rgba(${w.colorRgb},0.08), transparent 70%)`,
                        }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />
                    )}
                  </div>
                );
              })}

              {/* ── Hour Grid Lines ── */}
              {Array.from({ length: 25 }).map((_, h) => (
                <div
                  key={`grid-${h}`}
                  className="absolute"
                  style={{
                    left: h * HOUR_WIDTH,
                    top: ZONE_HEIGHT,
                    bottom: 0,
                    width: 1,
                    background: h % 6 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                  }}
                />
              ))}

              {/* ── Hour Labels ── */}
              {Array.from({ length: 24 }).map((_, h) => {
                const isCurrent = h === Math.floor(currentHourDecimal);
                return (
                  <span
                    key={`label-${h}`}
                    className="absolute font-mono"
                    style={{
                      left: h * HOUR_WIDTH + 4,
                      top: ZONE_HEIGHT + 8,
                      fontSize: '8px',
                      color: isCurrent ? ELECTRIC_BLUE : 'rgba(255,255,255,0.2)',
                      fontWeight: isCurrent ? 700 : 400,
                    }}
                  >
                    {formatHour(h)}
                  </span>
                );
              })}

              {/* ── NOW Indicator ── */}
              <motion.div
                className="absolute top-0"
                style={{
                  left: nowPosition * TOTAL_WIDTH,
                  height: ZONE_HEIGHT + 30,
                  width: 2,
                  background: `linear-gradient(180deg, ${ELECTRIC_BLUE}, ${EB(0.3)}, transparent)`,
                  boxShadow: `0 0 12px ${EB(0.5)}, 0 0 4px ${EB(0.8)}`,
                  zIndex: 30,
                }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {/* NOW dot */}
                <div className="absolute -top-1 -left-[4px]">
                  <motion.div
                    className="w-[10px] h-[10px] rounded-full"
                    style={{
                      background: ELECTRIC_BLUE,
                      boxShadow: `0 0 8px ${EB(0.8)}, 0 0 16px ${EB(0.4)}`,
                    }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                {/* NOW label */}
                <div className="absolute -top-1 left-4 flex items-center gap-1.5">
                  <span className="text-[8px] font-mono font-bold tracking-[0.2em] whitespace-nowrap" style={{
                    color: ELECTRIC_BLUE,
                    textShadow: `0 0 8px ${EB(0.5)}`,
                  }}>
                    NOW
                  </span>
                  <span className="text-[7px] font-mono whitespace-nowrap" style={{ color: EB(0.5) }}>
                    {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                  </span>
                </div>
              </motion.div>

              {/* ── Hovered Window Tooltip ── */}
              <AnimatePresence>
                {hoveredWindow && (
                  <WindowTooltip
                    window={BIO_WINDOWS.find(w => w.id === hoveredWindow)!}
                    x={hoveredX}
                    containerRect={containerRect}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Footer: Bio-Window Legend ── */}
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              {BIO_WINDOWS.filter((_, i) => i % 2 === 0).map(w => (
                <div key={w.id} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ background: w.color, opacity: 0.6 }} />
                  <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: `rgba(${w.colorRgb},0.45)` }}>
                    {w.shortLabel}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.15)' }}>
              Scroll to explore
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
