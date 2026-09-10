import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getSessionId } from '@/components/Presence/usePresenceState';
import { Sparkline } from '@/components/Sparkline';
import SidebarInsights from '@/components/SidebarInsights';

/* ── Generate simulated vitals sparkline history for a peer ── */
function generateSparklineData(seed: string, length = 20, base = 65, variance = 15): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const data: number[] = [];
  let val = base + (Math.abs(hash) % variance);
  for (let i = 0; i < length; i++) {
    val += (Math.sin(hash * 0.1 + i * 0.7) * variance * 0.3) + (Math.cos(i * 1.3) * variance * 0.15);
    val = Math.max(base - variance, Math.min(base + variance, val));
    data.push(Math.round(val));
  }
  return data;
}

/* ── Compute Elite Score from member biometrics ── */
function computeEliteScore(m: { hrv: number; recovery: number; strain: number }): number {
  const hrvScore = Math.min(30, Math.max(0, ((m.hrv - 30) / 70) * 30));
  const recScore = Math.min(40, Math.max(0, (m.recovery / 100) * 40));
  const strainScore = Math.min(30, Math.max(0, ((20 - m.strain) / 20) * 30));
  return Math.round(Math.max(0, Math.min(100, hrvScore + recScore + strainScore)));
}

/* ── Dispatch auto-pan event for FluidCanvas ── */
function dispatchAutoPan(targetSessionId: string, x: number, y: number) {
  window.dispatchEvent(new CustomEvent('vive-squad-focus', {
    detail: { targetSessionId, x, y }
  }));
}

/* ── Dispatch Command Glow highlight event ── */
function dispatchCommandGlow(targetSessionId: string) {
  window.dispatchEvent(new CustomEvent('vive-command-glow', {
    detail: { targetSessionId, startTime: performance.now(), duration: 4000 }
  }));
}

/* ══════════════════════════════════════════════════════════════
 * ── SQUAD STATUS SIDEBAR                                    ──
 * ══════════════════════════════════════════════════════════════
 *
 * Real-time squad status panel integrated into the FluidCanvas layout:
 * 1. Subscribes to presence data for live readiness status
 * 2. Shows all squad members with Readiness Status badges
 * 3. Highlights Biological Redline states with pulsing red glow
 * 4. Provides "Deploy Support" and "Intervene" buttons for redlined peers
 * 5. Sends haptic nudges and priority push notifications
 * 6. Updates in real-time via Convex subscriptions
 */

/* ── Readiness Status Types ── */
type ReadinessLevel = 'COMBAT_READY' | 'OPERATIONAL' | 'RECOVERING' | 'REDLINE_WARNING' | 'REDLINE_CRITICAL';

interface ReadinessConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  pulse: boolean;
  glowColor: string;
}

const READINESS_MAP: Record<ReadinessLevel, ReadinessConfig> = {
  COMBAT_READY: {
    label: 'COMBAT READY',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
    icon: '\u{1F7E2}',
    pulse: false,
    glowColor: 'rgba(34, 197, 94, 0.3)',
  },
  OPERATIONAL: {
    label: 'OPERATIONAL',
    color: '#C4A46C',
    bgColor: 'rgba(196, 164, 108, 0.08)',
    borderColor: 'rgba(196, 164, 108, 0.2)',
    icon: '\u{1F7E1}',
    pulse: false,
    glowColor: 'rgba(196, 164, 108, 0.2)',
  },
  RECOVERING: {
    label: 'RECOVERING',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    icon: '\u{1F7E0}',
    pulse: false,
    glowColor: 'rgba(245, 158, 11, 0.25)',
  },
  REDLINE_WARNING: {
    label: 'BIO REDLINE',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    icon: '\u26A0\uFE0F',
    pulse: true,
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
  REDLINE_CRITICAL: {
    label: 'CRITICAL REDLINE',
    color: '#EF4444',
    bgColor: 'rgba(220, 38, 38, 0.1)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
    icon: '\uD83D\uDEA8',
    pulse: true,
    glowColor: 'rgba(239, 68, 68, 0.5)',
  },
};

function getReadinessLevel(member: {
  isRedlined: boolean;
  redlineSeverity: 'critical' | 'warning' | 'nominal';
  recovery: number;
  hrv: number;
  strain: number;
  isOnline: boolean;
  isDeepWork: boolean;
}): ReadinessLevel {
  if (member.isRedlined && member.redlineSeverity === 'critical') return 'REDLINE_CRITICAL';
  if (member.isRedlined) return 'REDLINE_WARNING';
  if (member.recovery < 55 || member.strain > 18) return 'RECOVERING';
  if (member.recovery >= 80 && member.hrv >= 50) return 'COMBAT_READY';
  return 'OPERATIONAL';
}

const SUPPORT_MESSAGES = {
  encouragement: [
    "You've got this. One breath at a time.",
    "Your squad believes in you. Rest and recover.",
    "Strength isn't always pushing harder \u2014 it's knowing when to recover.",
    "We see you. Take what you need.",
    "Recovery is part of the protocol. Honor it.",
  ],
  recovery_tip: [
    "Try 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s.",
    "Hydrate now. 500ml water + electrolytes.",
    "20-minute power nap can restore HRV by 15%.",
    "Cold exposure: 2 min cold shower to reset your nervous system.",
    "Magnesium glycinate before bed tonight. Non-negotiable.",
  ],
};

function getRandomMessage(type: 'encouragement' | 'recovery_tip'): string {
  const msgs = SUPPORT_MESSAGES[type];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

interface SupportModalState {
  peerId: string;
  peerName: string;
  type: 'support' | 'intervene';
}

export default function SquadSidebar() {
  const sessionId = getSessionId();
  const [isOpen, setIsOpen] = useState(false);
  const [supportModal, setSupportModal] = useState<SupportModalState | null>(null);
  const [sentSupport, setSentSupport] = useState<Set<string>>(new Set());
  const [customMessage, setCustomMessage] = useState('');
  const [pulsePhase, setPulsePhase] = useState(0);

  // ── Real-time subscriptions ──
  const squadStatus = useQuery(api.redlineDetection.getSquadPresenceStatus, {
    currentSessionId: sessionId,
  });

  // Subscribe to live presence for real-time cursor/activity updates
  const livePresence = useQuery(api.queries.listPresence);

  const deploySupport = useMutation(api.redlineDetection.deploySupport);
  const sendHapticNudge = useMutation(api.redlineDetection.sendHapticNudge);

  // Pulse animation for redline indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase((p) => (p + 1) % 60);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const pulseOpacity = 0.6 + 0.4 * Math.sin((pulsePhase / 60) * Math.PI * 2);
  const pulseScale = 1 + 0.15 * Math.sin((pulsePhase / 60) * Math.PI * 2);

  const handleDeploySupport = useCallback(async (
    peerId: string,
    peerName: string,
    supportType: 'encouragement' | 'recovery_tip',
  ) => {
    const message = getRandomMessage(supportType);
    await deploySupport({
      fromSessionId: sessionId,
      toPeerId: peerId,
      toPeerName: peerName,
      message,
      supportType,
    });
    setSentSupport((prev) => new Set(prev).add(peerId));
    setSupportModal(null);
    setTimeout(() => {
      setSentSupport((prev) => {
        const next = new Set(prev);
        next.delete(peerId);
        return next;
      });
    }, 5000);
  }, [deploySupport, sessionId]);

  const handleIntervene = useCallback(async (
    peerId: string,
    peerName: string,
    nudgeType: 'haptic' | 'priority_push' | 'recovery_protocol',
  ) => {
    await sendHapticNudge({
      fromSessionId: sessionId,
      toPeerId: peerId,
      toPeerName: peerName,
      nudgeType,
      message: customMessage || undefined,
    });
    setSentSupport((prev) => new Set(prev).add(`intervene-${peerId}`));
    setSupportModal(null);
    setCustomMessage('');
    setTimeout(() => {
      setSentSupport((prev) => {
        const next = new Set(prev);
        next.delete(`intervene-${peerId}`);
        return next;
      });
    }, 5000);
  }, [sendHapticNudge, sessionId, customMessage]);

  const redlinedCount = squadStatus?.totalRedlined ?? 0;
  const members = squadStatus?.members ?? [];
  const onlineCount = squadStatus?.totalOnline ?? 0;

  // Merge live presence data for real-time activity indicators
  const enrichedMembers = members.map((m) => {
    const liveEntry = (livePresence ?? []).find(
      (p) => p.sessionId !== sessionId && p.activeProtocol === m.activeProtocol
    );
    return {
      ...m,
      liveX: liveEntry?.x ?? 0,
      liveY: liveEntry?.y ?? 0,
      isLiveActive: !!liveEntry,
    };
  });

  return (
    <>
      {/* ── Toggle Button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          right: isOpen ? 324 : 16,
          top: 80,
          zIndex: 9998,
          width: 46,
          height: 46,
          borderRadius: 12,
          background: redlinedCount > 0
            ? 'rgba(220, 38, 38, 0.12)'
            : 'rgba(196, 164, 108, 0.06)',
          border: `1px solid ${redlinedCount > 0 ? 'rgba(220, 38, 38, 0.35)' : 'rgba(196, 164, 108, 0.12)'}`,
          color: redlinedCount > 0 ? '#EF4444' : '#C4A46C',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 18,
          transition: 'all 0.3s ease',
          backdropFilter: 'blur(16px)',
          boxShadow: redlinedCount > 0
            ? `0 0 ${12 + 8 * pulseOpacity}px rgba(220, 38, 38, ${0.15 * pulseOpacity})`
            : '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        {isOpen ? '\u2715' : '\uD83D\uDC65'}
        {/* Redline badge */}
        {redlinedCount > 0 && !isOpen && (
          <span style={{
            position: 'absolute',
            top: -5,
            right: -5,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#EF4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${pulseScale})`,
            boxShadow: `0 0 ${8 * pulseOpacity}px rgba(239, 68, 68, ${0.6 * pulseOpacity})`,
            transition: 'transform 0.05s linear',
          }}>
            {redlinedCount}
          </span>
        )}
        {/* Online count badge */}
        {onlineCount > 0 && !isOpen && redlinedCount === 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#22C55E',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {onlineCount}
          </span>
        )}
      </button>

      {/* ── Sidebar Panel ── */}
      <div style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 320,
        zIndex: 9997,
        background: 'rgba(10, 10, 11, 0.96)',
        borderLeft: '1px solid rgba(196, 164, 108, 0.08)',
        backdropFilter: 'blur(32px)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '20px 16px 14px',
          borderBottom: '1px solid rgba(196, 164, 108, 0.06)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              color: '#C4A46C',
              fontWeight: 600,
            }}>
              SQUAD STATUS
            </div>
            {/* Live indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 9,
              color: '#22C55E',
              fontWeight: 500,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22C55E',
                boxShadow: '0 0 6px rgba(34, 197, 94, 0.5)',
                display: 'inline-block',
              }} />
              LIVE
            </div>
          </div>
          <div style={{
            display: 'flex',
            gap: 12,
            fontSize: 11,
            color: '#555',
            marginTop: 6,
          }}>
            <span style={{ color: '#888' }}>{members.length} members</span>
            <span style={{ color: '#22C55E' }}>{onlineCount} online</span>
            {redlinedCount > 0 && (
              <span style={{
                color: '#EF4444',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#EF4444',
                  display: 'inline-block',
                  opacity: pulseOpacity,
                }} />
                {redlinedCount} redlined
              </span>
            )}
          </div>
        </div>

        {/* ── War Alert Banner ── */}
        {(squadStatus?.activeWarAlerts ?? 0) > 0 && (
          <div style={{
            margin: '8px 12px',
            padding: '10px 12px',
            background: `rgba(220, 38, 38, ${0.06 + 0.04 * pulseOpacity})`,
            border: `1px solid rgba(220, 38, 38, ${0.2 + 0.15 * pulseOpacity})`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{
              fontSize: 18,
              transform: `scale(${pulseScale})`,
              display: 'inline-block',
              transition: 'transform 0.05s linear',
            }}>{'\uD83D\uDEA8'}</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', letterSpacing: '0.1em' }}>
                BIOLOGICAL REDLINE ACTIVE
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                {squadStatus?.activeWarAlerts} squad member{(squadStatus?.activeWarAlerts ?? 0) > 1 ? 's' : ''} need{(squadStatus?.activeWarAlerts ?? 0) === 1 ? 's' : ''} immediate support
              </div>
            </div>
          </div>
        )}

        {/* ── Readiness Summary Bar ── */}
        <div style={{
          margin: '6px 12px 2px',
          padding: '8px 10px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.03)',
        }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600 }}>
            READINESS OVERVIEW
          </div>
          <ReadinessSummaryBar members={enrichedMembers} />
        </div>

        {/* ── Digital Twin Insight ── */}
        <SidebarInsights />

        {/* ── Member List ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 0',
        }}>
          {enrichedMembers.map((member) => (
            <MemberCard
              key={member.peerId}
              member={member}
              pulseOpacity={pulseOpacity}
              pulseScale={pulseScale}
              isSupportSent={sentSupport.has(member.peerId)}
              isInterveneSent={sentSupport.has(`intervene-${member.peerId}`)}
              onDeploySupport={() => setSupportModal({
                peerId: member.peerId,
                peerName: member.peerName,
                type: 'support',
              })}
              onIntervene={() => setSupportModal({
                peerId: member.peerId,
                peerName: member.peerName,
                type: 'intervene',
              })}
              onFocusPeer={(peerId, x, y) => {
                // Close sidebar after focusing
                setTimeout(() => setIsOpen(false), 600);
              }}
            />
          ))}

          {members.length === 0 && (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: '#444',
              fontSize: 12,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{'\uD83D\uDC65'}</div>
              No squad members detected.
              <br />
              <span style={{ fontSize: 10, color: '#333' }}>
                Invite peers to join your squad.
              </span>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(196, 164, 108, 0.06)',
          fontSize: 8,
          color: '#333',
          textAlign: 'center',
          letterSpacing: '0.15em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}>
          <span style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#22C55E',
            display: 'inline-block',
            boxShadow: '0 0 4px rgba(34, 197, 94, 0.4)',
          }} />
          REAL-TIME BIOMETRIC MONITORING ACTIVE
        </div>
      </div>

      {/* ── Support / Intervene Modal ── */}
      {supportModal && (
        <SupportModal
          modal={supportModal}
          customMessage={customMessage}
          onCustomMessageChange={setCustomMessage}
          onDeploySupport={handleDeploySupport}
          onIntervene={handleIntervene}
          onClose={() => { setSupportModal(null); setCustomMessage(''); }}
        />
      )}

      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes squad-redline-pulse {
          0%, 100% { box-shadow: 0 0 6px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 18px rgba(239, 68, 68, 0.5), 0 0 36px rgba(239, 68, 68, 0.15); }
        }
        @keyframes squad-redline-ring {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.25); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes squad-warning-pulse {
          0%, 100% { box-shadow: 0 0 4px rgba(245, 158, 11, 0.15); }
          50% { box-shadow: 0 0 14px rgba(245, 158, 11, 0.35); }
        }
        @keyframes squad-support-sent {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes squad-activity-dot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── READINESS SUMMARY BAR                                   ── */
/* ══════════════════════════════════════════════════════════════ */

function ReadinessSummaryBar({ members }: { members: Array<{ isRedlined: boolean; redlineSeverity: string; recovery: number; hrv: number; strain: number; isOnline: boolean; isDeepWork: boolean }> }) {
  const counts = { combat: 0, operational: 0, recovering: 0, redline: 0 };
  members.forEach((m) => {
    const level = getReadinessLevel(m as any);
    if (level === 'COMBAT_READY') counts.combat++;
    else if (level === 'OPERATIONAL') counts.operational++;
    else if (level === 'RECOVERING') counts.recovering++;
    else counts.redline++;
  });
  const total = members.length || 1;

  return (
    <div>
      <div style={{
        display: 'flex',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        gap: 1,
      }}>
        {counts.combat > 0 && (
          <div style={{ flex: counts.combat / total, background: '#22C55E', borderRadius: 2 }} />
        )}
        {counts.operational > 0 && (
          <div style={{ flex: counts.operational / total, background: '#C4A46C', borderRadius: 2 }} />
        )}
        {counts.recovering > 0 && (
          <div style={{ flex: counts.recovering / total, background: '#F59E0B', borderRadius: 2 }} />
        )}
        {counts.redline > 0 && (
          <div style={{ flex: counts.redline / total, background: '#EF4444', borderRadius: 2 }} />
        )}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 5,
        fontSize: 9,
      }}>
        {counts.combat > 0 && (
          <span style={{ color: '#22C55E', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
            {counts.combat} Ready
          </span>
        )}
        {counts.operational > 0 && (
          <span style={{ color: '#C4A46C', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4A46C', display: 'inline-block' }} />
            {counts.operational} Op
          </span>
        )}
        {counts.recovering > 0 && (
          <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
            {counts.recovering} Rec
          </span>
        )}
        {counts.redline > 0 && (
          <span style={{ color: '#EF4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
            {counts.redline} Redline
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MEMBER CARD                                             ── */
/* ══════════════════════════════════════════════════════════════ */

interface MemberCardProps {
  member: {
    peerId: string;
    peerName: string;
    peerAvatar: string;
    peerHandle: string;
    tier: string;
    isOnline: boolean;
    activeProtocol: string | null;
    isDeepWork: boolean;
    ghostMode: boolean;
    hrv: number;
    recovery: number;
    strain: number;
    heartRate: number | null;
    isRedlined: boolean;
    redlineSeverity: "critical" | "warning" | "nominal";
    redlineMetrics: Array<{
      metric: string;
      current: number;
      average: number;
      dropPercent: number;
    }>;
    hasWarAlert: boolean;
    supportReceived: number;
    isLiveActive: boolean;
  };
  pulseOpacity: number;
  pulseScale: number;
  isSupportSent: boolean;
  isInterveneSent: boolean;
  onDeploySupport: () => void;
  onIntervene: () => void;
  onFocusPeer?: (peerId: string, x: number, y: number) => void;
}

function MemberCard({ member, pulseOpacity, pulseScale, isSupportSent, isInterveneSent, onDeploySupport, onIntervene, onFocusPeer }: MemberCardProps) {
  const readiness = getReadinessLevel(member);
  const config = READINESS_MAP[readiness];
  const isRedlined = member.isRedlined;
  const isCritical = member.redlineSeverity === 'critical';
  const eliteScore = computeEliteScore(member);
  const hrvSparkline = useMemo(() => generateSparklineData(member.peerId + '-hrv', 20, 65, 20), [member.peerId]);
  const hrSparkline = useMemo(() => generateSparklineData(member.peerId + '-hr', 20, 72, 12), [member.peerId]);
  const [isGlowing, setIsGlowing] = useState(false);

  const handleFocusClick = useCallback(() => {
    const x = (member as any).liveX || Math.round(Math.random() * window.innerWidth * 0.6 + window.innerWidth * 0.2);
    const y = (member as any).liveY || Math.round(Math.random() * window.innerHeight * 0.6 + window.innerHeight * 0.2);
    dispatchAutoPan(member.peerId, x, y);
    dispatchCommandGlow(member.peerId);
    setIsGlowing(true);
    setTimeout(() => setIsGlowing(false), 4000);
    onFocusPeer?.(member.peerId, x, y);
  }, [member, onFocusPeer]);

  return (
    <div
      onClick={handleFocusClick}
      style={{
      cursor: 'pointer',
      margin: '3px 12px',
      padding: '12px',
      borderRadius: 10,
      background: config.bgColor,
      border: `1px solid ${config.borderColor}`,
      transition: 'all 0.3s ease',
      animation: isCritical
        ? 'squad-redline-pulse 2s ease-in-out infinite'
        : readiness === 'REDLINE_WARNING'
          ? 'squad-warning-pulse 2.5s ease-in-out infinite'
          : 'none',
    }}>
      {/* ── Top Row: Avatar + Name + Readiness Badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Avatar with status ring + redline pulse */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* Pulsing ring for redlined members */}
          {isRedlined && (
            <div style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: `2px solid ${isCritical ? '#EF4444' : '#F59E0B'}`,
              opacity: pulseOpacity * 0.6,
              transform: `scale(${pulseScale})`,
              transition: 'all 0.05s linear',
              pointerEvents: 'none',
            }} />
          )}
          {/* Second expanding ring for critical */}
          {isCritical && (
            <div style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              animation: 'squad-redline-ring 2s ease-out infinite',
              pointerEvents: 'none',
            }} />
          )}
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: isRedlined
              ? isCritical ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.1)'
              : 'rgba(196, 164, 108, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            border: `2px solid ${
              isRedlined
                ? isCritical ? '#EF4444' : '#F59E0B'
                : member.isOnline ? '#22C55E' : '#333'
            }`,
            boxShadow: isRedlined
              ? `0 0 ${8 + 6 * pulseOpacity}px ${config.glowColor}`
              : 'none',
            transition: 'box-shadow 0.05s linear',
          }}>
            {member.peerAvatar}
          </div>
          {/* Online dot */}
          <div style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: member.isOnline ? '#22C55E' : '#444',
            border: '2px solid #0A0A0B',
            boxShadow: member.isOnline ? '0 0 4px rgba(34, 197, 94, 0.4)' : 'none',
          }} />
        </div>

        {/* Name + Handle + Activity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: config.color,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            {member.peerName}
            {member.isLiveActive && (
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#22C55E',
                display: 'inline-block',
                animation: 'squad-activity-dot 1.5s ease-in-out infinite',
              }} />
            )}
          </div>
          <div style={{
            fontSize: 10,
            color: '#555',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span>{member.peerHandle}</span>
            {member.activeProtocol && (
              <>
                <span style={{ color: '#333' }}>{'\u00B7'}</span>
                <span style={{ color: '#C4A46C', fontSize: 9 }}>{member.activeProtocol}</span>
              </>
            )}
            {member.isDeepWork && (
              <>
                <span style={{ color: '#333' }}>{'\u00B7'}</span>
                <span style={{ color: '#6B8AFF', fontSize: 9 }}>Deep Work</span>
              </>
            )}
          </div>
        </div>

        {/* Readiness Status Badge */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 3,
        }}>
          <div style={{
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '3px 6px',
            borderRadius: 4,
            background: config.bgColor,
            color: config.color,
            border: `1px solid ${config.borderColor}`,
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}>
            {config.pulse && (
              <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: config.color,
                display: 'inline-block',
                opacity: pulseOpacity,
                transition: 'opacity 0.05s linear',
              }} />
            )}
            {config.label}
          </div>
          {member.tier === 'Elite' && (
            <div style={{
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '2px 5px',
              borderRadius: 3,
              background: 'rgba(196, 164, 108, 0.1)',
              color: '#C4A46C',
              border: '1px solid rgba(196, 164, 108, 0.15)',
            }}>
              ELITE
            </div>
          )}
        </div>
      </div>

      {/* ── Elite Score + Sparklines Row ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        padding: '6px 8px',
        borderRadius: 6,
        background: isGlowing ? 'rgba(196, 164, 108, 0.08)' : 'rgba(255, 255, 255, 0.015)',
        border: `1px solid ${isGlowing ? 'rgba(196, 164, 108, 0.2)' : 'rgba(255, 255, 255, 0.03)'}`,
        transition: 'all 0.5s ease',
        boxShadow: isGlowing ? '0 0 16px rgba(196, 164, 108, 0.15)' : 'none',
      }}>
        {/* Elite Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
          <span style={{
            fontSize: 16,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: eliteScore >= 80 ? '#22C55E' : eliteScore >= 60 ? '#C4A46C' : eliteScore >= 40 ? '#F59E0B' : '#EF4444',
            lineHeight: 1,
            textShadow: `0 0 8px ${eliteScore >= 80 ? 'rgba(34,197,94,0.3)' : eliteScore >= 60 ? 'rgba(196,164,108,0.2)' : 'transparent'}`,
          }}>{eliteScore}</span>
          <span style={{ fontSize: 6, color: '#555', letterSpacing: '0.1em', fontWeight: 600, marginTop: 2 }}>ELITE</span>
        </div>
        {/* HRV Sparkline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Sparkline data={hrvSparkline} width={48} height={16} color={member.hrv >= 50 ? '#22C55E' : '#F59E0B'} fillOpacity={0.12} strokeWidth={1} />
          <span style={{ fontSize: 6, color: '#555', letterSpacing: '0.08em' }}>HRV</span>
        </div>
        {/* HR Sparkline */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Sparkline data={hrSparkline} width={48} height={16} color={member.heartRate != null && member.heartRate > 100 ? '#EF4444' : '#6B8AFF'} fillOpacity={0.12} strokeWidth={1} />
          <span style={{ fontSize: 6, color: '#555', letterSpacing: '0.08em' }}>HR</span>
        </div>
      </div>

      {/* ── Bio Metrics Row ── */}
      <div style={{
        display: 'flex',
        gap: 6,
        marginTop: 6,
        fontSize: 10,
      }}>
        <MetricPill
          label="HRV"
          value={member.hrv}
          unit="ms"
          isAlert={member.redlineMetrics.some((m) => m.metric === 'HRV')}
        />
        <MetricPill
          label="REC"
          value={member.recovery}
          unit="%"
          isAlert={member.recovery < 50}
        />
        <MetricPill
          label="STR"
          value={member.strain}
          unit=""
          isAlert={member.strain > 18}
        />
        {member.heartRate != null && (
          <MetricPill
            label="HR"
            value={member.heartRate}
            unit="bpm"
            isAlert={member.heartRate > 100}
          />
        )}
      </div>

      {/* ── Redline Alert Details ── */}
      {isRedlined && member.redlineMetrics.length > 0 && (
        <div style={{
          marginTop: 8,
          padding: '6px 8px',
          borderRadius: 6,
          background: isCritical
            ? `rgba(220, 38, 38, ${0.06 + 0.04 * pulseOpacity})`
            : 'rgba(245, 158, 11, 0.06)',
          border: `1px solid ${isCritical ? `rgba(220, 38, 38, ${0.15 + 0.1 * pulseOpacity})` : 'rgba(245, 158, 11, 0.12)'}`,
        }}>
          {member.redlineMetrics.map((metric, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
              color: isCritical ? '#EF4444' : '#F59E0B',
              marginBottom: i < member.redlineMetrics.length - 1 ? 3 : 0,
            }}>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: isCritical ? '#EF4444' : '#F59E0B',
                  display: 'inline-block',
                  opacity: pulseOpacity,
                }} />
                {metric.metric} REDLINE
              </span>
              <span style={{ fontSize: 9, color: '#777', fontVariantNumeric: 'tabular-nums' }}>
                {metric.current} / avg {metric.average} ({'\u2193'}{metric.dropPercent}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Action Buttons ── */}
      {isRedlined && (
        <div style={{
          display: 'flex',
          gap: 6,
          marginTop: 8,
        }}>
          <button
            onClick={onDeploySupport}
            disabled={isSupportSent}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: 6,
              border: 'none',
              background: isSupportSent
                ? 'rgba(34, 197, 94, 0.12)'
                : 'rgba(196, 164, 108, 0.1)',
              color: isSupportSent ? '#22C55E' : '#C4A46C',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: isSupportSent ? 'default' : 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'all 0.2s ease',
              animation: isSupportSent ? 'squad-support-sent 0.3s ease' : 'none',
            }}
          >
            {isSupportSent ? '\u2713 SUPPORT SENT' : '\uD83D\uDCAA DEPLOY SUPPORT'}
          </button>

          {isCritical && (
            <button
              onClick={onIntervene}
              disabled={isInterveneSent}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 6,
                border: `1px solid rgba(220, 38, 38, ${0.2 + 0.1 * pulseOpacity})`,
                background: isInterveneSent
                  ? 'rgba(34, 197, 94, 0.12)'
                  : `rgba(220, 38, 38, ${0.06 + 0.04 * pulseOpacity})`,
                color: isInterveneSent ? '#22C55E' : '#EF4444',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: isInterveneSent ? 'default' : 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'all 0.2s ease',
              }}
            >
              {isInterveneSent ? '\u2713 SENT' : '\uD83D\uDEA8 INTERVENE'}
            </button>
          )}
        </div>
      )}

      {/* Support received */}
      {member.supportReceived > 0 && (
        <div style={{
          marginTop: 6,
          fontSize: 9,
          color: '#555',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <span>{'\uD83D\uDC9A'}</span>
          <span>{member.supportReceived} support message{member.supportReceived > 1 ? 's' : ''} received</span>
        </div>
      )}
    </div>
  );
}

/* ── Metric Pill ── */
function MetricPill({ label, value, unit, isAlert }: {
  label: string;
  value: number;
  unit: string;
  isAlert: boolean;
}) {
  return (
    <div style={{
      padding: '2px 6px',
      borderRadius: 4,
      background: isAlert
        ? 'rgba(220, 38, 38, 0.08)'
        : 'rgba(255, 255, 255, 0.02)',
      border: `1px solid ${isAlert ? 'rgba(220, 38, 38, 0.15)' : 'rgba(255, 255, 255, 0.04)'}`,
      display: 'flex',
      alignItems: 'center',
      gap: 3,
    }}>
      <span style={{ color: '#555', fontSize: 8, fontWeight: 600 }}>{label}</span>
      <span style={{
        color: isAlert ? '#EF4444' : '#999',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}{unit}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── SUPPORT / INTERVENE MODAL                               ── */
/* ══════════════════════════════════════════════════════════════ */

interface SupportModalProps {
  modal: SupportModalState;
  customMessage: string;
  onCustomMessageChange: (v: string) => void;
  onDeploySupport: (peerId: string, peerName: string, type: 'encouragement' | 'recovery_tip') => void;
  onIntervene: (peerId: string, peerName: string, type: 'haptic' | 'priority_push' | 'recovery_protocol') => void;
  onClose: () => void;
}

function SupportModal({ modal, customMessage, onCustomMessageChange, onDeploySupport, onIntervene, onClose }: SupportModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 340,
          background: 'rgba(17, 17, 17, 0.98)',
          border: '1px solid rgba(196, 164, 108, 0.12)',
          borderRadius: 14,
          padding: '20px',
          fontFamily: "'Inter', system-ui, sans-serif",
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{
          fontSize: 10,
          letterSpacing: '0.2em',
          color: modal.type === 'intervene' ? '#EF4444' : '#C4A46C',
          fontWeight: 600,
          marginBottom: 4,
        }}>
          {modal.type === 'intervene' ? '\uD83D\uDEA8 INTERVENE' : '\uD83D\uDCAA DEPLOY SUPPORT'}
        </div>
        <div style={{ fontSize: 13, color: '#E5E5E5', marginBottom: 16 }}>
          {modal.peerName}
        </div>

        {modal.type === 'support' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ActionButton
              emoji={'\uD83D\uDCAA'}
              label="Send Encouragement"
              description="A word of strength and solidarity"
              color="#C4A46C"
              onClick={() => onDeploySupport(modal.peerId, modal.peerName, 'encouragement')}
            />
            <ActionButton
              emoji={'\uD83E\uDDD8'}
              label="Recovery Suggestion"
              description="Tactical recovery protocol tip"
              color="#6B8AFF"
              onClick={() => onDeploySupport(modal.peerId, modal.peerName, 'recovery_tip')}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ActionButton
              emoji={'\uD83D\uDCF3'}
              label="Haptic Nudge"
              description="Visual pulse on their FluidCanvas"
              color="#F59E0B"
              onClick={() => onIntervene(modal.peerId, modal.peerName, 'haptic')}
            />
            <ActionButton
              emoji={'\uD83D\uDEA8'}
              label="Priority Push"
              description="High-priority alert \u2014 take a break NOW"
              color="#EF4444"
              onClick={() => onIntervene(modal.peerId, modal.peerName, 'priority_push')}
            />
            <ActionButton
              emoji={'\uD83E\uDE7A'}
              label="Recovery Protocol"
              description="Activate breathwork + hydration + rest"
              color="#22C55E"
              onClick={() => onIntervene(modal.peerId, modal.peerName, 'recovery_protocol')}
            />

            <div style={{ marginTop: 4 }}>
              <input
                type="text"
                value={customMessage}
                onChange={(e) => onCustomMessageChange(e.target.value)}
                placeholder="Add a personal message..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(196, 164, 108, 0.12)',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: '#E5E5E5',
                  fontSize: 11,
                  fontFamily: "'Inter', system-ui, sans-serif",
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '8px',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'transparent',
            color: '#555',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

/* ── Action Button ── */
function ActionButton({ emoji, label, description, color, onClick }: {
  emoji: string;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${color}18`,
        background: `${color}06`,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Inter', system-ui, sans-serif",
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}12`;
        e.currentTarget.style.borderColor = `${color}35`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}06`;
        e.currentTarget.style.borderColor = `${color}18`;
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color }}>{label}</div>
        <div style={{ fontSize: 9, color: '#777', marginTop: 1 }}>{description}</div>
      </div>
    </button>
  );
}
