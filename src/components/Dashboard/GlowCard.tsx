import { useRef, useState, type ReactNode } from 'react';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { ELITE_HERO_BACKGROUNDS } from '@/data/eliteAssets';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowRadius?: number;
  /** When true, renders with Elite-tier medical-tech background */
  eliteBackground?: boolean;
  /** Which Elite background to use */
  eliteBgKey?: 'dnaHelix' | 'cellStructure' | 'neuralMolecular';
}

export function GlowCard({
  children,
  className = '',
  eliteBackground = false,
  eliteBgKey = 'dnaHelix',
}: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ghostMode = useGhostMode();
  const [imgLoaded, setImgLoaded] = useState(false);

  const neonR = ghostMode ? 160 : 0;
  const neonG = ghostMode ? 160 : 255;
  const neonB = ghostMode ? 160 : 204;

  // Elite mode uses teal/cyan accent
  const eliteR = ghostMode ? 160 : 0;
  const eliteG = ghostMode ? 160 : 240;
  const eliteB = ghostMode ? 160 : 255;

  const r = eliteBackground ? eliteR : neonR;
  const g = eliteBackground ? eliteG : neonG;
  const b = eliteBackground ? eliteB : neonB;

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${className}`}
      style={{
        background: eliteBackground
          ? 'rgba(5, 5, 10, 0.7)'
          : 'rgba(10, 10, 10, 0.6)',
        borderColor: ghostMode
          ? 'rgba(160, 160, 160, 0.06)'
          : eliteBackground
            ? 'rgba(0, 240, 255, 0.06)'
            : 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
        el.style.boxShadow = `0 0 20px rgba(${r}, ${g}, ${b}, 0.06), inset 0 0 10px rgba(${r}, ${g}, ${b}, 0.02)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = ghostMode
          ? 'rgba(160,160,160,0.06)'
          : eliteBackground
            ? 'rgba(0,240,255,0.06)'
            : 'rgba(255,255,255,0.04)';
        el.style.boxShadow = 'none';
      }}
    >
      {/* Elite background image layer */}
      {eliteBackground && (
        <>
          <img
            src={ELITE_HERO_BACKGROUNDS[eliteBgKey]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
            style={{ opacity: imgLoaded ? 0.15 : 0 }}
            onLoad={() => setImgLoaded(true)}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, rgba(5,5,10,0.8) 0%, rgba(5,5,10,0.5) 100%)',
            }}
          />
        </>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
