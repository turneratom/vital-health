import { motion } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

interface EliteNetworkPortalProps {
  onNavigateCommunity: () => void;
}

const avatars = [
  { initials: 'KV', color: '#BF5AF2', ghostColor: 'rgba(160,160,160,0.3)', delay: 0 },
  { initials: 'MC', color: '#00F2FF', ghostColor: 'rgba(160,160,160,0.25)', delay: 0.4 },
  { initials: 'AN', color: '#FFD700', ghostColor: 'rgba(160,160,160,0.2)', delay: 0.8 },
];

export function EliteNetworkPortal({ onNavigateCommunity }: EliteNetworkPortalProps) {
  const ghostMode = useGhostMode();

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-8 sm:p-10"
      style={{
        background: ghostMode
          ? 'rgba(20, 20, 20, 0.5)'
          : 'linear-gradient(135deg, rgba(12, 8, 24, 0.85) 0%, rgba(8, 12, 20, 0.75) 50%, rgba(12, 8, 24, 0.85) 100%)',
        borderColor: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(191, 90, 242, 0.15)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: ghostMode
          ? 'none'
          : '0 0 40px rgba(191, 90, 242, 0.06), 0 0 80px rgba(191, 90, 242, 0.03), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {/* Ambient gradient orbs */}
      {!ghostMode && (
        <>
          <div
            className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(191, 90, 242, 0.08) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
          <div
            className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(0, 242, 255, 0.06) 0%, transparent 70%)',
              filter: 'blur(40px)',
            }}
          />
        </>
      )}

      <div className="relative z-10 flex flex-col gap-7">
        {/* Title row with live indicator */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: ghostMode
                ? 'rgba(160,160,160,0.08)'
                : 'linear-gradient(135deg, rgba(191, 90, 242, 0.2), rgba(0, 242, 255, 0.15))',
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(191, 90, 242, 0.25)'}`,
              boxShadow: ghostMode ? 'none' : '0 0 12px rgba(191, 90, 242, 0.15)',
            }}
          >
            <span style={{ fontSize: 16 }}>{"\u2B21"}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h3
              className="text-lg sm:text-xl font-semibold tracking-tight"
              style={{
                color: ghostMode ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.95)',
                textShadow: ghostMode ? 'none' : '0 0 20px rgba(191, 90, 242, 0.2)',
              }}
            >
              The Elite Network
            </h3>
            {/* Breathing green live dot */}
            <div
              className="elite-live-dot w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: '#34C759' }}
            />
          </div>
        </div>

        {/* Avatar stack with concentric glow circles */}
        <div className="flex items-center gap-6">
          <div className="flex items-center -space-x-3">
            {avatars.map((avatar, i) => {
              const c = ghostMode ? avatar.ghostColor : avatar.color;
              const ringClass = i === 0 ? 'elite-glow-ring' : i === 1 ? 'elite-glow-ring-d1' : 'elite-glow-ring-d2';
              const pulseClass = i === 0 ? 'elite-avatar-pulse' : i === 1 ? 'elite-avatar-pulse-d1' : 'elite-avatar-pulse-d2';

              return (
                <motion.div
                  key={i}
                  className="relative"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 + avatar.delay * 0.5 }}
                >
                  {/* Outer concentric glow ring */}
                  <div
                    className={`absolute -inset-2.5 rounded-full ${ringClass}`}
                    style={{
                      border: `1px solid ${c}`,
                      opacity: 0.15,
                    }}
                  />
                  {/* Inner concentric glow ring */}
                  <div
                    className={`absolute -inset-1 rounded-full ${ringClass}`}
                    style={{
                      border: `1px solid ${c}`,
                      opacity: 0.3,
                    }}
                  />
                  {/* Avatar circle */}
                  <div
                    className={`relative w-11 h-11 rounded-full flex items-center justify-center ${pulseClass}`}
                    style={{
                      background: ghostMode
                        ? 'rgba(30,30,30,0.8)'
                        : `linear-gradient(135deg, ${avatar.color}22, ${avatar.color}44)`,
                      border: `1.5px solid ${c}`,
                      boxShadow: ghostMode
                        ? 'none'
                        : `0 0 12px ${avatar.color}33, 0 0 24px ${avatar.color}11`,
                      zIndex: 3 - i,
                    }}
                  >
                    <span
                      className="text-[10px] font-mono font-bold tracking-wider"
                      style={{
                        color: c,
                        textShadow: ghostMode ? 'none' : `0 0 8px ${avatar.color}66`,
                      }}
                    >
                      {avatar.initials}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1">
            <span
              className="text-sm font-medium"
              style={{
                color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.85)',
              }}
            >
              3 Peers are currently Active.
            </span>
            <span
              className="text-[10px] font-mono uppercase tracking-wider"
              style={{
                color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(191, 90, 242, 0.5)',
              }}
            >
              Leaderboard {"\u00b7"} Squad {"\u00b7"} Insights
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          className="w-full h-px"
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.06)'
              : 'linear-gradient(90deg, transparent, rgba(191, 90, 242, 0.15), rgba(0, 242, 255, 0.1), transparent)',
          }}
        />

        {/* Enter Community portal button */}
        <button
          onClick={onNavigateCommunity}
          className="elite-portal-shimmer w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border font-semibold text-sm tracking-wide transition-all duration-300"
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.06)'
              : 'rgba(255, 255, 255, 0.07)',
            borderColor: ghostMode
              ? 'rgba(160,160,160,0.1)'
              : 'rgba(191, 90, 242, 0.25)',
            color: '#FFFFFF',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: ghostMode
              ? 'none'
              : '0 0 20px rgba(191, 90, 242, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = ghostMode
              ? 'rgba(160,160,160,0.1)'
              : 'rgba(255, 255, 255, 0.12)';
            el.style.borderColor = ghostMode
              ? 'rgba(160,160,160,0.2)'
              : 'rgba(191, 90, 242, 0.45)';
            el.style.boxShadow = ghostMode
              ? 'none'
              : '0 0 30px rgba(191, 90, 242, 0.2), 0 0 60px rgba(191, 90, 242, 0.08), inset 0 1px 0 rgba(255,255,255,0.08)';
            el.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = ghostMode
              ? 'rgba(160,160,160,0.06)'
              : 'rgba(255, 255, 255, 0.07)';
            el.style.borderColor = ghostMode
              ? 'rgba(160,160,160,0.1)'
              : 'rgba(191, 90, 242, 0.25)';
            el.style.boxShadow = ghostMode
              ? 'none'
              : '0 0 20px rgba(191, 90, 242, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)';
            el.style.transform = 'translateY(0)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? 'rgba(200,200,200,0.6)' : '#BF5AF2'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span
            style={{
              textShadow: ghostMode ? 'none' : '0 0 12px rgba(191, 90, 242, 0.3)',
            }}
          >
            Enter Community
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
