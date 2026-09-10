import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ELITE_HERO_BACKGROUNDS } from '@/data/eliteAssets';
import { calculateBiologicalAgeOffset, type BioAgeResult } from '@/lib/bioSyncLogic';

const BACKGROUNDS = [
  ELITE_HERO_BACKGROUNDS.dnaHelix,
  ELITE_HERO_BACKGROUNDS.mitochondria,
  ELITE_HERO_BACKGROUNDS.dnaBasePairs,
];

/* ── Default demo biomarkers for visual preview ── */
const DEFAULT_BIO_AGE_INPUT = {
  chronologicalAge: 34,
  biomarkers: {
    vitaminD: 52,
    ferritin: 85,
    crp: 0.6,
    hba1c: 5.1,
    testosteroneTotal: 680,
    testosteroneFree: 18,
  },
  lifestyle: {
    sleepHours: 7.5,
    hrv: 62,
    recovery: 78,
    activityScore: 72,
    supplementAdherence: 88,
  },
};

interface ParallaxHeroProps {
  ghostMode: boolean;
  /** Optional override for bio age calculation input */
  bioAgeInput?: Parameters<typeof calculateBiologicalAgeOffset>[0];
}

export function ParallaxHero({ ghostMode, bioAgeInput }: ParallaxHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [bgIndex] = useState(() => Math.floor(Math.random() * BACKGROUNDS.length));

  /* ── Calculate biological age offset ── */
  const bioAge: BioAgeResult = useMemo(() => {
    return calculateBiologicalAgeOffset(bioAgeInput ?? DEFAULT_BIO_AGE_INPUT);
  }, [bioAgeInput]);

  /* ── Derive glow parameters from offset ── */
  const glowParams = useMemo(() => {
    const { direction, offset, absOffset } = bioAge;

    // Intensity: stronger glow for larger offsets (0.2 baseline → 0.7 max)
    const intensity = Math.min(0.7, 0.2 + (absOffset / 10) * 0.5);

    if (direction === 'younger') {
      // Green/cyan pulse — performing above chronological age
      return {
        color: 'rgba(0,255,170,',       // green-cyan
        pulseColor: 'rgba(0,255,204,',   // neon teal
        shadowColor: `rgba(0,255,170,${intensity})`,
        intensity,
        speed: Math.max(2.5, 4.5 - absOffset * 0.3), // faster pulse for bigger offset
      };
    } else if (direction === 'older') {
      // Amber/warm pulse — performing below chronological age
      return {
        color: 'rgba(255,180,80,',       // warm amber
        pulseColor: 'rgba(255,160,60,',  // deeper amber
        shadowColor: `rgba(255,180,80,${intensity})`,
        intensity,
        speed: Math.max(2.5, 4.5 - absOffset * 0.3),
      };
    } else {
      // Neutral gold — aligned
      return {
        color: 'rgba(196,164,108,',
        pulseColor: 'rgba(196,164,108,',
        shadowColor: `rgba(196,164,108,${intensity * 0.5})`,
        intensity: intensity * 0.5,
        speed: 5,
      };
    }
  }, [bioAge]);

  useEffect(() => {
    const scrollContainer = containerRef.current?.closest('[data-dna-scroll]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      setScrollY((scrollContainer as HTMLElement).scrollTop);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  const parallaxOffset = scrollY * 0.35;
  const opacity = Math.max(0, 1 - scrollY / 400);

  const pulseKeyframes = `
    @keyframes bio-glow-pulse {
      0%, 100% { opacity: ${glowParams.intensity * 0.4}; transform: scale(1); }
      50% { opacity: ${glowParams.intensity}; transform: scale(1.02); }
    }
    @keyframes bio-ring-pulse {
      0%, 100% { box-shadow: 0 0 20px ${glowParams.shadowColor}, 0 0 60px ${glowParams.color}0.08), inset 0 0 30px ${glowParams.color}0.05); }
      50% { box-shadow: 0 0 40px ${glowParams.shadowColor}, 0 0 100px ${glowParams.color}0.15), inset 0 0 50px ${glowParams.color}0.1); }
    }
    @keyframes age-number-glow {
      0%, 100% { text-shadow: 0 0 20px ${glowParams.shadowColor}, 0 0 40px ${glowParams.color}0.1); }
      50% { text-shadow: 0 0 30px ${glowParams.shadowColor}, 0 0 60px ${glowParams.color}0.2), 0 0 80px ${glowParams.color}0.08); }
    }
    @keyframes float-particle-0 {
      0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
      50% { transform: translateY(-20px) translateX(8px); opacity: 0.7; }
    }
    @keyframes float-particle-1 {
      0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
      50% { transform: translateY(-15px) translateX(-6px); opacity: 0.6; }
    }
    @keyframes float-particle-2 {
      0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
      50% { transform: translateY(-25px) translateX(4px); opacity: 0.5; }
    }
  `;

  return (
    <div
      ref={containerRef}
      className="absolute inset-x-0 top-0 h-[480px] overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
    >
      <style>{pulseKeyframes}</style>

      {/* Background image with parallax */}
      <motion.div
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: ghostMode ? 0.15 : 0.4, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
        className="absolute inset-0"
        style={{
          transform: `translateY(${-parallaxOffset}px) scale(1.1)`,
          willChange: 'transform',
        }}
      >
        <img
          src={BACKGROUNDS[bgIndex]}
          alt=""
          className="w-full h-full object-cover"
          style={{
            filter: ghostMode
              ? 'grayscale(1) brightness(0.3)'
              : 'brightness(0.6) saturate(1.3)',
          }}
        />
      </motion.div>

      {/* ── Dynamic Bio-Age Glow Overlay ── */}
      {!ghostMode && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center 35%, ${glowParams.color}${glowParams.intensity * 0.35}) 0%, ${glowParams.color}0.02) 40%, transparent 70%)`,
            animation: `bio-glow-pulse ${glowParams.speed}s ease-in-out infinite`,
            opacity,
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Gradient overlays for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, 
            rgba(5,5,5,0.2) 0%, 
            rgba(5,5,5,0.4) 35%, 
            rgba(5,5,5,0.8) 65%, 
            rgba(5,5,5,1) 100%)`,
          opacity,
        }}
      />

      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center 30%, transparent 0%, rgba(5,5,5,0.7) 100%)',
          opacity,
        }}
      />

      {/* ── Biological Age Readout — centered over the 3D render ── */}
      {!ghostMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: opacity, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          className="absolute inset-x-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ top: '140px', zIndex: 5 }}
        >
          {/* Outer pulsing ring */}
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              animation: `bio-ring-pulse ${glowParams.speed}s ease-in-out infinite`,
              border: `1px solid ${glowParams.color}0.15)`,
              background: `radial-gradient(circle, ${glowParams.color}0.06) 0%, transparent 70%)`,
            }}
          >
            {/* Inner ring */}
            <div
              className="absolute inset-2 rounded-full"
              style={{
                border: `1px solid ${glowParams.color}0.1)`,
                background: `radial-gradient(circle, rgba(5,5,5,0.6) 0%, rgba(5,5,5,0.3) 100%)`,
                backdropFilter: 'blur(12px)',
              }}
            />

            {/* Age number */}
            <div className="relative z-10 flex flex-col items-center">
              <span
                className="text-[9px] font-mono uppercase tracking-[0.25em] mb-1"
                style={{ color: `${glowParams.color}0.5)` }}
              >
                Bio Age
              </span>
              <span
                className="text-[36px] font-bold tabular-nums leading-none"
                style={{
                  color: bioAge.color,
                  animation: `age-number-glow ${glowParams.speed}s ease-in-out infinite`,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {bioAge.biologicalAge.toFixed(1)}
              </span>

              {/* Delta badge */}
              <div
                className="flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full"
                style={{
                  background: `${glowParams.color}0.08)`,
                  border: `1px solid ${glowParams.color}0.15)`,
                }}
              >
                <span className="text-[10px]">
                  {bioAge.direction === 'younger' ? '▼' : bioAge.direction === 'older' ? '▲' : '●'}
                </span>
                <span
                  className="text-[10px] font-mono font-semibold"
                  style={{ color: bioAge.color }}
                >
                  {bioAge.label}
                </span>
              </div>
            </div>
          </div>

          {/* Confidence indicator */}
          <div className="flex items-center gap-1.5 mt-3">
            {Array.from({ length: 4 }).map((_, i) => {
              const filled = bioAge.confidence === 'high' ? 4
                : bioAge.confidence === 'moderate' ? 3
                : bioAge.confidence === 'low' ? 2 : 1;
              return (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full"
                  style={{
                    background: i < filled
                      ? `${glowParams.color}0.6)`
                      : 'rgba(255,255,255,0.1)',
                    boxShadow: i < filled ? `0 0 4px ${glowParams.color}0.3)` : 'none',
                  }}
                />
              );
            })}
            <span
              className="text-[8px] font-mono ml-1"
              style={{ color: `${glowParams.color}0.35)` }}
            >
              {bioAge.confidence} · {bioAge.markersUsed}/{bioAge.markersTotal} markers
            </span>
          </div>
        </motion.div>
      )}

      {/* Ghost mode age readout — muted */}
      {ghostMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: opacity * 0.4 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="absolute inset-x-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ top: '155px', zIndex: 5 }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '1px solid rgba(160,160,160,0.08)',
              background: 'radial-gradient(circle, rgba(160,160,160,0.03) 0%, transparent 70%)',
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] mb-1" style={{ color: 'rgba(160,160,160,0.25)' }}>
                Bio Age
              </span>
              <span className="text-[32px] font-bold tabular-nums leading-none" style={{ color: 'rgba(160,160,160,0.3)' }}>
                {bioAge.biologicalAge.toFixed(1)}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Subtle scan line effect */}
      {!ghostMode && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              ${glowParams.color}0.01) 2px,
              ${glowParams.color}0.01) 4px
            )`,
            opacity: opacity * 0.5,
          }}
        />
      )}

      {/* Floating particles — colored by bio age direction */}
      {!ghostMode && (
        <div className="absolute inset-0 overflow-hidden" style={{ opacity }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: `${glowParams.pulseColor}0.3)`,
                left: `${15 + i * 14}%`,
                top: `${20 + (i % 3) * 25}%`,
                boxShadow: `0 0 6px ${glowParams.pulseColor}0.2)`,
                animation: `float-particle-${i % 3} ${3 + i * 0.7}s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
