import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RemotePresence } from './useConvexPresence';

type PeerWithProtocol = RemotePresence & { activeProtocol?: string; activeCategory?: string };

/* ── Nudge pulse event — dispatched globally so FluidCanvas can render it ── */
export function dispatchNudgePulse(targetSessionId: string, x: number, y: number, color: string) {
  window.dispatchEvent(new CustomEvent('vive-nudge-pulse', {
    detail: { targetSessionId, x, y, color, startTime: performance.now(), duration: 2000 },
  }));
}

/* ── Deterministic peer profile from sessionId ── */
const PEER_PROFILES: Array<{ name: string; avatar: string; handle: string; tier: string }> = [
  { name: 'Kira Voss', avatar: 'KV', handle: '@kiravoss', tier: 'apex' },
  { name: 'Marcus Chen', avatar: 'MC', handle: '@mchen', tier: 'apex' },
  { name: 'Aria Nakamura', avatar: 'AN', handle: '@arianaka', tier: 'titan' },
  { name: 'Dex Morales', avatar: 'DM', handle: '@dexm', tier: 'titan' },
  { name: 'Lena Park', avatar: 'LP', handle: '@lenapark', tier: 'vanguard' },
  { name: 'Ravi Sharma', avatar: 'RS', handle: '@ravisharma', tier: 'apex' },
  { name: 'Zoe Tanaka', avatar: 'ZT', handle: '@zoetanaka', tier: 'titan' },
  { name: 'Kai Reeves', avatar: 'KR', handle: '@kaireeves', tier: 'vanguard' },
];

function profileForSession(sessionId: string) {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return PEER_PROFILES[Math.abs(hash) % PEER_PROFILES.length];
}

const TIER_COLORS: Record<string, string> = {
  apex: '#FFD700',
  titan: '#C0C0C0',
  vanguard: '#CD7F32',
};

/* ── Focus Status Resolution ──
 * Derives a rich focus status from ghostMode, activeProtocol, and activeCategory.
 * Maps protocol categories to human-readable focus labels.
 */
interface FocusStatusInfo {
  label: string;
  icon: string;
  color: string;
  description: string;
  intensity: 'high' | 'medium' | 'low';
}

const CATEGORY_FOCUS_MAP: Record<string, FocusStatusInfo> = {
  'recovery': {
    label: 'Recovery Mode',
    icon: '💤',
    color: '#A78BFA',
    description: 'Active recovery protocol',
    intensity: 'low',
  },
  'training': {
    label: 'Training',
    icon: '🏋️',
    color: '#F97316',
    description: 'In active training session',
    intensity: 'high',
  },
  'nutrition': {
    label: 'Meal Prep',
    icon: '🥗',
    color: '#34D399',
    description: 'Optimizing nutrition stack',
    intensity: 'low',
  },
  'sleep': {
    label: 'Wind Down',
    icon: '🌙',
    color: '#818CF8',
    description: 'Sleep optimization active',
    intensity: 'low',
  },
  'supplements': {
    label: 'Stack Review',
    icon: '💊',
    color: '#F472B6',
    description: 'Reviewing supplement protocol',
    intensity: 'medium',
  },
  'meditation': {
    label: 'Meditation',
    icon: '🧘',
    color: '#67E8F9',
    description: 'Mindfulness session active',
    intensity: 'medium',
  },
  'brainstorming': {
    label: 'Brainstorming',
    icon: '💡',
    color: '#FBBF24',
    description: 'Creative ideation mode',
    intensity: 'medium',
  },
  'analysis': {
    label: 'Data Analysis',
    icon: '📊',
    color: '#60A5FA',
    description: 'Reviewing biomarker data',
    intensity: 'high',
  },
  'cold_exposure': {
    label: 'Cold Exposure',
    icon: '🧊',
    color: '#22D3EE',
    description: 'Cold therapy session',
    intensity: 'high',
  },
  'breathwork': {
    label: 'Breathwork',
    icon: '🌬️',
    color: '#A5F3FC',
    description: 'Breathing protocol active',
    intensity: 'medium',
  },
};

function resolveFocusStatus(peer: PeerWithProtocol): FocusStatusInfo {
  // Deep Work — ghostMode is the strongest signal
  if (peer.ghostMode) {
    return {
      label: 'Deep Work',
      icon: '🔴',
      color: '#FF6B6B',
      description: 'Do not disturb — focused session',
      intensity: 'high',
    };
  }

  // Check category mapping first (more specific)
  if (peer.activeCategory) {
    const catKey = peer.activeCategory.toLowerCase().replace(/\s+/g, '_');
    for (const [key, info] of Object.entries(CATEGORY_FOCUS_MAP)) {
      if (catKey.includes(key) || key.includes(catKey)) {
        return info;
      }
    }
  }

  // Check protocol name for keyword hints
  if (peer.activeProtocol) {
    const proto = peer.activeProtocol.toLowerCase();
    if (proto.includes('sleep') || proto.includes('wind')) return CATEGORY_FOCUS_MAP['sleep'];
    if (proto.includes('train') || proto.includes('workout') || proto.includes('exercise')) return CATEGORY_FOCUS_MAP['training'];
    if (proto.includes('recover') || proto.includes('rest')) return CATEGORY_FOCUS_MAP['recovery'];
    if (proto.includes('meditat') || proto.includes('mindful')) return CATEGORY_FOCUS_MAP['meditation'];
    if (proto.includes('cold') || proto.includes('cryo')) return CATEGORY_FOCUS_MAP['cold_exposure'];
    if (proto.includes('breath')) return CATEGORY_FOCUS_MAP['breathwork'];
    if (proto.includes('suppl') || proto.includes('stack')) return CATEGORY_FOCUS_MAP['supplements'];
    if (proto.includes('nutri') || proto.includes('meal') || proto.includes('food')) return CATEGORY_FOCUS_MAP['nutrition'];
    if (proto.includes('brain') || proto.includes('idea')) return CATEGORY_FOCUS_MAP['brainstorming'];
    if (proto.includes('analy') || proto.includes('data') || proto.includes('review')) return CATEGORY_FOCUS_MAP['analysis'];

    // Generic "In Protocol" fallback
    return {
      label: 'In Protocol',
      icon: '🟡',
      color: '#FFB86B',
      description: peer.activeProtocol,
      intensity: 'medium',
    };
  }

  // Default — Available
  return {
    label: 'Available',
    icon: '🟢',
    color: '#30D158',
    description: 'Open to connect',
    intensity: 'low',
  };
}

interface PeerProfileCardProps {
  peer: PeerWithProtocol;
  x: number;
  y: number;
  onClose: () => void;
}

export function PeerProfileCard({ peer, x, y, onClose }: PeerProfileCardProps) {
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudgeCooldown, setNudgeCooldown] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const profile = profileForSession(peer.sessionId);
  const focusInfo = resolveFocusStatus(peer);

  // Position card so it doesn't overflow viewport
  const cardWidth = 240;
  const cardHeight = 260;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  let cardX = x + 28;
  let cardY = y - 50;
  if (cardX + cardWidth > vw - 16) cardX = x - cardWidth - 16;
  if (cardY + cardHeight > vh - 16) cardY = vh - cardHeight - 16;
  if (cardY < 16) cardY = 16;

  const handleNudge = useCallback(() => {
    if (nudgeCooldown) return;
    setNudgeSent(true);
    setNudgeCooldown(true);

    // Dispatch visual pulse to FluidCanvas
    dispatchNudgePulse(peer.sessionId, peer.x, peer.y, peer.color);

    setTimeout(() => setNudgeSent(false), 2000);
    setTimeout(() => setNudgeCooldown(false), 5000);
  }, [peer, nudgeCooldown]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Intensity bar segments
  const intensitySegments = focusInfo.intensity === 'high' ? 3 : focusInfo.intensity === 'medium' ? 2 : 1;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.8, y: 10, filter: 'blur(8px)' }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 0.85, y: 6, filter: 'blur(6px)' }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        left: cardX,
        top: cardY,
        zIndex: 9999,
        width: cardWidth,
        pointerEvents: 'auto',
      }}
    >
      {/* Glassmorphism card */}
      <div
        style={{
          background: 'rgba(12, 12, 14, 0.72)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: 0,
          boxShadow: `
            0 24px 48px rgba(0, 0, 0, 0.45),
            0 0 0 0.5px rgba(255, 255, 255, 0.06) inset,
            0 1px 0 rgba(255, 255, 255, 0.05) inset,
            0 0 40px ${peer.color}08
          `,
          overflow: 'hidden',
        }}
      >
        {/* Top accent line — subtle gradient using peer color */}
        <div style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${peer.color}60, ${focusInfo.color}60, transparent)`,
        }} />

        <div style={{ padding: '14px 16px 16px' }}>
          {/* Header — Avatar + Name + Tier */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {/* Avatar with status ring */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${peer.color}30, ${peer.color}10)`,
                  border: `2px solid ${focusInfo.color}50`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  color: peer.color,
                  letterSpacing: '0.5px',
                }}
              >
                {profile.avatar}
              </div>
              {/* Status dot on avatar */}
              <div style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: focusInfo.color,
                border: '2px solid rgba(12, 12, 14, 0.9)',
                boxShadow: `0 0 8px ${focusInfo.color}60`,
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#F5F5F7',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
              }}>
                {profile.name}
              </div>
              <div style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                marginTop: 2,
              }}>
                {profile.handle}
              </div>
            </div>

            {/* Tier badge */}
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              color: TIER_COLORS[profile.tier] || '#888',
              background: `${TIER_COLORS[profile.tier] || '#888'}12`,
              border: `1px solid ${TIER_COLORS[profile.tier] || '#888'}25`,
              borderRadius: 6,
              padding: '3px 7px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {profile.tier}
            </div>
          </div>

          {/* ── Focus Status Card ── */}
          <div
            style={{
              padding: '10px 12px',
              background: `${focusInfo.color}06`,
              border: `1px solid ${focusInfo.color}18`,
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{focusInfo.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: focusInfo.color,
                  letterSpacing: '0.01em',
                  lineHeight: 1.2,
                }}>
                  {focusInfo.label}
                </div>
              </div>
              {/* Intensity indicator */}
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {[1, 2, 3].map((seg) => (
                  <div
                    key={seg}
                    style={{
                      width: 4,
                      height: seg <= intensitySegments ? 8 + seg * 2 : 8 + seg * 2,
                      borderRadius: 2,
                      background: seg <= intensitySegments
                        ? focusInfo.color
                        : 'rgba(255,255,255,0.08)',
                      opacity: seg <= intensitySegments ? 0.8 : 0.3,
                      transition: 'all 0.3s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.4,
              paddingLeft: 22,
            }}>
              {focusInfo.description}
            </div>

            {/* Active protocol name if different from description */}
            {peer.activeProtocol && focusInfo.description !== peer.activeProtocol && (
              <div style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.25)',
                marginTop: 4,
                paddingLeft: 22,
                fontStyle: 'italic',
              }}>
                {peer.activeProtocol}
              </div>
            )}
          </div>

          {/* ── Nudge Button ── */}
          <motion.button
            onClick={handleNudge}
            disabled={nudgeCooldown}
            whileHover={!nudgeCooldown ? { scale: 1.02 } : undefined}
            whileTap={!nudgeCooldown ? { scale: 0.97 } : undefined}
            style={{
              width: '100%',
              padding: '9px 0',
              borderRadius: 10,
              border: nudgeSent
                ? '1px solid rgba(48, 209, 88, 0.35)'
                : nudgeCooldown
                  ? '1px solid rgba(255,255,255,0.05)'
                  : `1px solid ${peer.color}25`,
              background: nudgeSent
                ? 'rgba(48, 209, 88, 0.1)'
                : nudgeCooldown
                  ? 'rgba(255,255,255,0.02)'
                  : `linear-gradient(135deg, ${peer.color}12, ${peer.color}06)`,
              color: nudgeSent ? '#30D158' : nudgeCooldown ? 'rgba(255,255,255,0.2)' : '#F5F5F7',
              fontSize: 12,
              fontWeight: 600,
              cursor: nudgeCooldown ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s ease',
              letterSpacing: '0.01em',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {nudgeSent ? (
              <>
                <motion.span
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  ✓
                </motion.span>
                Pulse Sent
              </>
            ) : nudgeCooldown ? (
              'Cooldown...'
            ) : (
              <>
                <span style={{ fontSize: 13 }}>⚡</span>
                Nudge
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
