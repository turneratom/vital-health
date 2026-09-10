import React, { useState, useEffect, useCallback, useMemo } from 'react';

/* ══════════════════════════════════════════════════════════════ */
/*  COMMAND BRIEFING — Typewriter Health State Summary           */
/*  CLI/Terminal aesthetic with blinking cursor and auto-analysis*/
/* ══════════════════════════════════════════════════════════════ */

interface CommandBriefingProps {
  hrvCurrent?: number;
  hrvAvg7d?: number;
  sleepHours?: number;
  sleepScore?: number;
  recovery?: number;
  stress?: number;
  eliteScore?: number;
  totalProtein?: number;
  proteinTarget?: number;
  activityMinutes?: number;
  foodLogCount?: number;
}

interface BriefingLine {
  prefix: string;
  text: string;
  color: string;
  delay: number;
}

const CYAN = '#00F0FF';
const CYAN_DIM = 'rgba(0,240,255,';

function generateBriefingLines(props: CommandBriefingProps): BriefingLine[] {
  const {
    hrvCurrent = 0,
    hrvAvg7d = 0,
    sleepHours = 0,
    sleepScore = 0,
    recovery = 0,
    stress = 0,
    eliteScore = 0,
    totalProtein = 0,
    proteinTarget = 160,
    activityMinutes = 0,
    foodLogCount = 0,
  } = props;

  const lines: BriefingLine[] = [];

  // System init line
  lines.push({
    prefix: 'SYS',
    text: `VIVE COMMAND v4.0 — BIOMETRIC ANALYSIS INITIATED @ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    color: 'rgba(255,255,255,0.4)',
    delay: 0,
  });

  // HRV + Sleep combined analysis
  const hrvLow = hrvCurrent > 0 && hrvCurrent < 55;
  const sleepDeprived = sleepHours > 0 && sleepHours < 7;
  const sleepOptimal = sleepHours >= 8;
  const hrvAboveBaseline = hrvCurrent > 0 && hrvAvg7d > 0 && hrvCurrent > hrvAvg7d * 1.08;

  if (hrvLow && sleepDeprived) {
    lines.push({
      prefix: 'WARN',
      text: `CENTRAL NERVOUS SYSTEM FATIGUE DETECTED. HRV ${hrvCurrent}ms (-${hrvAvg7d > 0 ? Math.round(((hrvAvg7d - hrvCurrent) / hrvAvg7d) * 100) : '??'}% BELOW BASELINE). SLEEP ${sleepHours.toFixed(1)}h — INSUFFICIENT. ADJUSTING PROTOCOLS TO RECOVERY MODE.`,
      color: '#FF6B6B',
      delay: 60,
    });
    lines.push({
      prefix: 'RX',
      text: 'DOWNREGULATE TRAINING INTENSITY. PRIORITIZE PARASYMPATHETIC ACTIVATION. MAGNESIUM + PHOSPHATIDYLSERINE PROTOCOL ENGAGED.',
      color: '#FFB86B',
      delay: 40,
    });
  } else if (sleepOptimal && recovery >= 75) {
    lines.push({
      prefix: 'OK',
      text: `OPTIMAL RECOVERY DETECTED. SLEEP ${sleepHours.toFixed(1)}h — EXCEEDS THRESHOLD. RECOVERY ${recovery}%. PERFORMANCE CEILING INCREASED.`,
      color: '#00FFCC',
      delay: 60,
    });
    if (hrvAboveBaseline) {
      lines.push({
        prefix: 'OK',
        text: `HRV ${hrvCurrent}ms — ABOVE 7-DAY BASELINE (${hrvAvg7d}ms). AUTONOMIC NERVOUS SYSTEM PRIMED. GREEN LIGHT FOR HIGH-INTENSITY OUTPUT.`,
        color: '#00FFCC',
        delay: 40,
      });
    }
  } else if (sleepDeprived) {
    lines.push({
      prefix: 'WARN',
      text: `SLEEP DEFICIT DETECTED: ${sleepHours.toFixed(1)}h LOGGED. MINIMUM 7h REQUIRED FOR OPTIMAL PROTEIN SYNTHESIS AND CORTISOL REGULATION.`,
      color: '#FFB86B',
      delay: 60,
    });
  } else if (hrvLow) {
    lines.push({
      prefix: 'WARN',
      text: `HRV SUPPRESSED: ${hrvCurrent}ms. SYMPATHETIC DOMINANCE DETECTED. RECOMMEND BREATHWORK PROTOCOL AND REDUCED TRAINING VOLUME.`,
      color: '#FFB86B',
      delay: 60,
    });
  } else {
    lines.push({
      prefix: 'OK',
      text: `SYSTEMS NOMINAL. SLEEP ${sleepHours > 0 ? sleepHours.toFixed(1) + 'h' : 'ANALYZING...'} | RECOVERY ${recovery > 0 ? recovery + '%' : '--'} | HRV ${hrvCurrent > 0 ? hrvCurrent + 'ms' : 'ANALYZING...'}`,
      color: CYAN,
      delay: 60,
    });
  }

  // Stress analysis
  if (stress > 65) {
    lines.push({
      prefix: 'ALERT',
      text: `CORTISOL PROXY ELEVATED: STRESS INDEX ${stress}/100. RECOMMEND ADAPTOGENIC SUPPORT — ASHWAGANDHA KSM-66 600mg.`,
      color: '#FF6B6B',
      delay: 40,
    });
  }

  // Nutrition status
  if (foodLogCount === 0) {
    lines.push({
      prefix: 'FUEL',
      text: 'NO FUEL LOGS DETECTED TODAY. PROTEIN SYNTHESIS WINDOW ACTIVE — INITIATE FIRST MEAL PROTOCOL.',
      color: '#FFB86B',
      delay: 40,
    });
  } else {
    const proteinGap = proteinTarget - totalProtein;
    if (proteinGap > 40) {
      lines.push({
        prefix: 'FUEL',
        text: `PROTEIN DEFICIT: ${totalProtein}g / ${proteinTarget}g TARGET. GAP: ${proteinGap}g. PRIORITIZE LEUCINE-RICH SOURCES.`,
        color: '#FFB86B',
        delay: 40,
      });
    } else if (proteinGap <= 0) {
      lines.push({
        prefix: 'FUEL',
        text: `PROTEIN TARGET ACHIEVED: ${totalProtein}g / ${proteinTarget}g. ANABOLIC THRESHOLD MET.`,
        color: '#00FFCC',
        delay: 40,
      });
    }
  }

  // Elite Score summary
  if (eliteScore > 0) {
    const tier = eliteScore >= 85 ? 'ELITE' : eliteScore >= 65 ? 'ADVANCED' : eliteScore >= 45 ? 'DEVELOPING' : 'BASELINE';
    const tierColor = eliteScore >= 85 ? '#00FFCC' : eliteScore >= 65 ? CYAN : eliteScore >= 45 ? '#FFB86B' : '#FF6B6B';
    lines.push({
      prefix: 'SCORE',
      text: `COMPOSITE READINESS: ${eliteScore}/100 — TIER: ${tier}. ${eliteScore >= 75 ? 'CLEARED FOR PEAK OUTPUT.' : 'MODULATE INTENSITY ACCORDINGLY.'}`,
      color: tierColor,
      delay: 40,
    });
  }

  // End line
  lines.push({
    prefix: 'SYS',
    text: 'ANALYSIS COMPLETE. PROTOCOLS CALIBRATED. STANDING BY.',
    color: 'rgba(255,255,255,0.35)',
    delay: 30,
  });

  return lines;
}

const PREFIX_COLORS: Record<string, string> = {
  SYS: 'rgba(0,240,255,0.5)',
  OK: '#00FFCC',
  WARN: '#FFB86B',
  ALERT: '#FF6B6B',
  RX: '#AF82FF',
  FUEL: '#6B8AFF',
  SCORE: CYAN,
};

export function CommandBriefing(props: CommandBriefingProps) {
  const [mounted, setMounted] = useState(false);
  const [visibleChars, setVisibleChars] = useState<number[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const lines = useMemo(() => generateBriefingLines(props), [
    props.hrvCurrent, props.hrvAvg7d, props.sleepHours, props.sleepScore,
    props.recovery, props.stress, props.eliteScore, props.totalProtein,
    props.proteinTarget, props.activityMinutes, props.foodLogCount, animKey,
  ]);

  useEffect(() => { setMounted(true); }, []);

  // Typewriter effect
  useEffect(() => {
    setVisibleChars(lines.map(() => 0));
    setCurrentLine(0);
    setIsComplete(false);

    let lineIdx = 0;
    let charIdx = 0;
    let cancelled = false;

    function typeNext() {
      if (cancelled || lineIdx >= lines.length) {
        if (!cancelled) setIsComplete(true);
        return;
      }

      const line = lines[lineIdx];
      const fullText = `[${line.prefix}] ${line.text}`;

      if (charIdx < fullText.length) {
        charIdx++;
        setVisibleChars(prev => {
          const next = [...prev];
          next[lineIdx] = charIdx;
          return next;
        });
        setCurrentLine(lineIdx);
        // Speed: faster for system lines, slower for important ones
        const speed = line.prefix === 'SYS' ? 12 : 18;
        setTimeout(typeNext, speed);
      } else {
        // Line complete, pause then move to next
        lineIdx++;
        charIdx = 0;
        setTimeout(typeNext, lines[lineIdx - 1]?.delay ?? 40);
      }
    }

    // Initial delay before starting
    const startTimer = setTimeout(typeNext, 400);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
    };
  }, [animKey, lines.length]);

  const handleRefresh = useCallback(() => {
    setAnimKey(k => k + 1);
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${CYAN_DIM}0.12), transparent)`,
          animation: 'cmdScanLine 5s ease-in-out infinite',
        }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: isComplete ? '#00FFCC' : CYAN,
                boxShadow: `0 0 6px ${isComplete ? 'rgba(0,255,204,0.5)' : `${CYAN_DIM}0.5)`}`,
                animation: isComplete ? 'none' : 'cmdPulse 1.5s ease-in-out infinite',
              }}
            />
            <span
              className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase"
              style={{ color: `${CYAN_DIM}0.6)` }}
            >
              COMMAND BRIEFING
            </span>
          </div>
          <span
            className="font-mono text-[9px] tracking-wider"
            style={{ color: isComplete ? 'rgba(0,255,204,0.4)' : 'rgba(255,255,255,0.2)' }}
          >
            {isComplete ? 'STATUS: COMPLETE' : 'STATUS: ANALYZING'}
          </span>
        </div>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[9px] tracking-wider uppercase cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: `${CYAN_DIM}0.06)`,
            border: `1px solid ${CYAN_DIM}0.12)`,
            color: `${CYAN_DIM}0.5)`,
          }}
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{
              animation: !isComplete ? 'cmdSpin 2s linear infinite' : 'none',
            }}
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Terminal body */}
      <div className="px-4 py-3 space-y-1 min-h-[80px] max-h-[200px] overflow-y-auto">
        {lines.map((line, i) => {
          const fullText = `[${line.prefix}] ${line.text}`;
          const chars = visibleChars[i] ?? 0;
          if (chars === 0 && i > currentLine) return null;

          const prefixLen = line.prefix.length + 3; // [PREFIX] + space
          const prefixColor = PREFIX_COLORS[line.prefix] ?? 'rgba(255,255,255,0.3)';

          return (
            <div key={`${animKey}-${i}`} className="font-mono text-[11px] leading-[1.6] flex">
              {/* Prefix */}
              {chars > 0 && (
                <span
                  className="flex-shrink-0 font-bold mr-0"
                  style={{ color: prefixColor }}
                >
                  {fullText.slice(0, Math.min(chars, prefixLen))}
                </span>
              )}
              {/* Body text */}
              {chars > prefixLen && (
                <span style={{ color: line.color }}>
                  {fullText.slice(prefixLen, chars)}
                </span>
              )}
              {/* Blinking cursor on current line */}
              {i === currentLine && !isComplete && (
                <span
                  className="inline-block w-[6px] h-[13px] ml-0.5 align-middle"
                  style={{
                    background: CYAN,
                    animation: 'cmdBlink 0.8s step-end infinite',
                    boxShadow: `0 0 4px ${CYAN_DIM}0.4)`,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Final blinking cursor after complete */}
        {isComplete && (
          <div className="font-mono text-[11px] leading-[1.6] flex items-center">
            <span style={{ color: 'rgba(0,240,255,0.3)' }}>{'>'} </span>
            <span
              className="inline-block w-[6px] h-[13px] ml-0.5"
              style={{
                background: CYAN,
                animation: 'cmdBlink 1s step-end infinite',
                boxShadow: `0 0 4px ${CYAN_DIM}0.4)`,
              }}
            />
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes cmdBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes cmdPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        @keyframes cmdSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cmdScanLine {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default CommandBriefing;
