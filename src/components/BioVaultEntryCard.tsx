import { useState, useEffect } from 'react';

interface BioVaultEntryCardProps {
  ghostMode: boolean;
  onOpen?: () => void;
}

const WARM = {
  sage: '#7CB68E',
  sageBg: 'rgba(124,182,142,0.08)',
  sageBorder: 'rgba(124,182,142,0.2)',
  sky: '#6BA3BE',
  terra: '#E8976C',
  text: 'rgba(245,240,235,0.9)',
  textMuted: 'rgba(200,190,178,0.6)',
  textFaint: 'rgba(200,190,178,0.35)',
  bg: 'rgba(26,24,22,0.7)',
  border: 'rgba(168,155,138,0.12)',
  borderActive: 'rgba(168,155,138,0.25)',
};

export function BioVaultEntryCard({ ghostMode, onOpen }: BioVaultEntryCardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const ghost = ghostMode;

  return (
    <div
      className="mx-5 mb-5"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) 0.4s',
      }}
    >
      <button
        onClick={onOpen}
        className="w-full group relative overflow-hidden rounded-2xl text-left transition-all duration-300 active:scale-[0.98]"
        style={{
          background: ghost ? 'rgba(12,12,12,0.7)' : WARM.bg,
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: `1px solid ${ghost ? 'rgba(160,160,160,0.08)' : WARM.borderActive}`,
          boxShadow: ghost
            ? 'inset 0 1px 0 rgba(255,255,255,0.03)'
            : '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Subtle warm shimmer */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{
            background: ghost
              ? 'linear-gradient(135deg, transparent 30%, rgba(160,160,160,0.03) 50%, transparent 70%)'
              : 'linear-gradient(135deg, transparent 30%, rgba(124,182,142,0.04) 50%, transparent 70%)',
          }}
        />

        <div className="relative z-10 flex items-center gap-4 px-5 py-5">
          {/* Health Library Icon */}
          <div
            className="relative flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{
              background: ghost ? 'rgba(160,160,160,0.06)' : WARM.sageBg,
              border: `1px solid ${ghost ? 'rgba(160,160,160,0.1)' : WARM.sageBorder}`,
            }}
          >
            📋
            {/* Gentle pulse */}
            {!ghost && (
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  border: `1px solid ${WARM.sageBorder}`,
                  animation: 'libraryCardPulse 3s ease-in-out infinite',
                }}
              />
            )}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[15px] font-bold tracking-tight"
                style={{ color: ghost ? 'rgba(220,220,220,0.7)' : WARM.text }}
              >
                Health Library
              </span>
              {/* Privacy Badge */}
              <span
                className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  color: ghost ? 'rgba(160,160,160,0.4)' : WARM.sage,
                  background: ghost ? 'rgba(160,160,160,0.06)' : WARM.sageBg,
                  border: `1px solid ${ghost ? 'rgba(160,160,160,0.08)' : WARM.sageBorder}`,
                }}
              >
                🔒 Private
              </span>
            </div>
            <p
              className="text-[12px] leading-relaxed"
              style={{ color: ghost ? 'rgba(160,160,160,0.35)' : WARM.textMuted }}
            >
              Your personal health records
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: ghost ? 'rgba(160,160,160,0.25)' : WARM.textFaint }}
            >
              Blood work · Lab results · Medications · Genetics
            </p>
          </div>

          {/* Arrow */}
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-0.5"
            style={{
              background: ghost ? 'rgba(160,160,160,0.06)' : WARM.sageBg,
              border: `1px solid ${ghost ? 'rgba(160,160,160,0.08)' : WARM.sageBorder}`,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke={ghost ? 'rgba(160,160,160,0.4)' : WARM.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-[1px] mx-5"
          style={{
            background: ghost
              ? 'linear-gradient(90deg, transparent, rgba(160,160,160,0.08), transparent)'
              : `linear-gradient(90deg, transparent, ${WARM.sageBorder}, ${WARM.border}, transparent)`,
          }}
        />
      </button>

      <style>{`
        @keyframes libraryCardPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.03); }
        }
      `}</style>
    </div>
  );
}
