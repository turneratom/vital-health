import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useBioPings } from '@/hooks/useBioPings';

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const C = {
  bg: 'rgba(10,10,11,0.92)',
  surface: 'rgba(14,14,18,0.85)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
};

/* ── Neural Sync Latency — simulates data pipeline responsiveness ── */
function useNeuralSyncLatency() {
  const [latency, setLatency] = useState(42);
  const [trend, setTrend] = useState<'stable' | 'improving' | 'degrading'>('stable');

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const delta = (Math.random() - 0.48) * 8;
        const next = Math.max(12, Math.min(180, prev + delta));
        setTrend(next < prev - 2 ? 'improving' : next > prev + 2 ? 'degrading' : 'stable');
        return Math.round(next);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return { latency, trend };
}

/* ── Protocol Adherence from dashboard data ── */
function useProtocolAdherence() {
  const sessionId = getTwinSessionId();

  const dashData = useQuery(api.dashboardData.getLast24hDashboardData, { sessionId });

  return useMemo(() => {
    if (!dashData) return { adherence: 0, completed: 0, total: 0, loading: true };

    const protocolsDone = dashData.protocolLogCount || 0;
    const supplementsDone = dashData.supplementCount || 0;
    const foodLogs = dashData.todayFoodLogCount || 0;
    const activityLogs = dashData.todayActivityLogCount || 0;

    const completed = protocolsDone + supplementsDone + Math.min(foodLogs, 3) + Math.min(activityLogs, 2);
    const total = 12; // baseline daily protocol target
    const adherence = Math.min(100, Math.round((completed / total) * 100));

    return { adherence, completed, total, loading: false };
  }, [dashData]);
}

/* ── Biological Integrity — composite from HRV, recovery, macros ── */
function useBiologicalIntegrity() {
  const sessionId = getTwinSessionId();

  const dashData = useQuery(api.dashboardData.getLast24hDashboardData, { sessionId });

  return useMemo(() => {
    if (!dashData) return { integrity: 0, status: 'unknown' as const, loading: true };

    const hrvScore = dashData.currentHrv > 0
      ? Math.min(100, (dashData.currentHrv / 80) * 100)
      : 50;

    const recoveryScore = dashData.hoursSinceWorkout > 24
      ? 85
      : dashData.hoursSinceWorkout > 12
        ? 70
        : 55;

    const nutritionScore = dashData.totalCaloriesIn > 0
      ? Math.min(100, (dashData.totalProtein / 120) * 50 + (dashData.totalCaloriesIn / 2000) * 50)
      : 30;

    const integrity = Math.round(hrvScore * 0.4 + recoveryScore * 0.35 + nutritionScore * 0.25);

    const status = integrity >= 80 ? 'optimal' as const
      : integrity >= 60 ? 'nominal' as const
      : integrity >= 40 ? 'stressed' as const
      : 'critical' as const;

    return { integrity, status, loading: false };
  }, [dashData]);
}

/* ── Animated Ring Gauge ── */
function RingGauge({ value, max, color, size = 52, strokeWidth = 3 }: {
  value: number; max: number; color: string; size?: number; strokeWidth?: number;
}) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, value / max);
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

/* ── Bio-Ping Toast with Haptic Bounce ── */
function BioPingToast({ ping, isVisible, onDismiss }: {
  ping: { id: string; icon: string; message: string; subtext: string; urgency: string; accentColor: string; actionLabel?: string };
  isVisible: boolean;
  onDismiss: (id: string) => void;
}) {
  const [bouncePhase, setBouncePhase] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    // Trigger haptic bounce sequence: scale up → overshoot → settle
    setBouncePhase(1);
    const t1 = setTimeout(() => setBouncePhase(2), 150);
    const t2 = setTimeout(() => setBouncePhase(3), 300);
    const t3 = setTimeout(() => setBouncePhase(4), 450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isVisible]);

  const bounceTransform = bouncePhase === 0 ? 'translateY(20px) scale(0.9)'
    : bouncePhase === 1 ? 'translateY(-4px) scale(1.04)'
    : bouncePhase === 2 ? 'translateY(2px) scale(0.98)'
    : bouncePhase === 3 ? 'translateY(-1px) scale(1.01)'
    : 'translateY(0) scale(1)';

  const urgencyGlow = ping.urgency === 'alert'
    ? `0 0 20px ${ping.accentColor}40, 0 0 40px ${ping.accentColor}20`
    : ping.urgency === 'nudge'
      ? `0 0 12px ${ping.accentColor}30`
      : `0 0 6px ${ping.accentColor}15`;

  if (!isVisible && bouncePhase === 0) return null;

  return (
    <div
      style={{
        transform: bounceTransform,
        opacity: isVisible ? 1 : 0,
        transition: bouncePhase <= 1
          ? 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out'
          : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease-out',
        background: C.bg,
        border: `1px solid ${ping.accentColor}30`,
        borderRadius: 14,
        padding: '10px 14px',
        boxShadow: urgencyGlow,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        maxWidth: 320,
        backdropFilter: 'blur(16px)',
        cursor: 'pointer',
        pointerEvents: 'auto',
      }}
      onClick={() => onDismiss(ping.id)}
    >
      {/* Icon with pulse ring */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${ping.accentColor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          {ping.icon}
        </div>
        {ping.urgency === 'alert' && (
          <div style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            border: `1.5px solid ${ping.accentColor}50`,
            animation: 'bioPingPulseRing 2s ease-out infinite',
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: C.text,
          lineHeight: 1.3, marginBottom: 2,
        }}>
          {ping.message}
        </div>
        <div style={{
          fontSize: 10, color: C.textSec, lineHeight: 1.3,
        }}>
          {ping.subtext}
        </div>
        {ping.actionLabel && (
          <div style={{
            marginTop: 6, fontSize: 9, fontWeight: 700,
            color: ping.accentColor, letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {ping.actionLabel} →
          </div>
        )}
      </div>

      {/* Dismiss X */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(ping.id); }}
        style={{
          background: 'none', border: 'none', color: C.textTer,
          fontSize: 14, cursor: 'pointer', padding: 2, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SYSTEM HEALTH OVERLAY
   
   Floating diagnostic strip showing:
   1. Neural Sync Latency (data pipeline responsiveness)
   2. Active Protocol Adherence %
   3. Biological Integrity (composite bio-state)
   
   Plus Bio-Ping toasts with haptic-style bounce animations.
   ═══════════════════════════════════════════════════════════════ */

export default function SystemHealthOverlay() {
  const { latency, trend } = useNeuralSyncLatency();
  const protocol = useProtocolAdherence();
  const bio = useBiologicalIntegrity();
  const { activePing, isVisible: pingVisible, dismiss, totalPings } = useBioPings();

  const [expanded, setExpanded] = useState(false);
  const [pulseFrame, setPulseFrame] = useState(0);

  // Subtle breathing animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseFrame(f => (f + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const breathe = 0.85 + 0.15 * Math.sin((pulseFrame / 360) * Math.PI * 2);

  // Status color for latency
  const latencyColor = latency < 50 ? C.green : latency < 100 ? C.orange : C.red;
  const latencyLabel = latency < 50 ? 'Fast' : latency < 100 ? 'Normal' : 'Slow';

  // Status color for integrity
  const integrityColor = bio.status === 'optimal' ? C.accent
    : bio.status === 'nominal' ? C.green
    : bio.status === 'stressed' ? C.orange
    : C.red;

  // Protocol adherence color
  const adherenceColor = protocol.adherence >= 80 ? C.accent
    : protocol.adherence >= 50 ? C.blueBright
    : C.orange;

  return (
    <>
      {/* ── System Health Strip — fixed top-left ── */}
      <div
        style={{
          position: 'fixed',
          top: 56,
          left: 12,
          zIndex: 9990,
          pointerEvents: 'auto',
        }}
      >
        {/* Collapsed: compact pill */}
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: expanded ? '10px 14px' : '6px 12px',
            background: C.bg,
            border: `1px solid ${C.borderBlue}`,
            borderRadius: expanded ? 16 : 20,
            backdropFilter: 'blur(20px)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)',
            boxShadow: `0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
          }}
        >
          {/* System pulse dot */}
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: bio.loading ? C.textTer : integrityColor,
            boxShadow: bio.loading ? 'none' : `0 0 ${6 * breathe}px ${integrityColor}60`,
            transition: 'background 0.5s, box-shadow 0.5s',
          }} />

          {!expanded ? (
            /* ── Collapsed view: 3 micro-stats ── */
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Neural Sync */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 8, color: C.textTer, fontFamily: 'monospace' }}>SYNC</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: latencyColor, fontFamily: 'monospace' }}>
                  {latency}ms
                </span>
              </div>

              <div style={{ width: 1, height: 10, background: C.border }} />

              {/* Protocol */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 8, color: C.textTer, fontFamily: 'monospace' }}>PROT</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: adherenceColor, fontFamily: 'monospace' }}>
                  {protocol.loading ? '—' : `${protocol.adherence}%`}
                </span>
              </div>

              <div style={{ width: 1, height: 10, background: C.border }} />

              {/* Bio Integrity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 8, color: C.textTer, fontFamily: 'monospace' }}>BIO</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: integrityColor, fontFamily: 'monospace' }}>
                  {bio.loading ? '—' : `${bio.integrity}%`}
                </span>
              </div>

              {/* Ping count badge */}
              {totalPings > 0 && (
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: C.blue, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#fff',
                }}>
                  {totalPings}
                </div>
              )}
            </div>
          ) : (
            /* ── Expanded view: detailed cards ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: C.blueBright, letterSpacing: '0.15em', textTransform: 'uppercase',
                }}>
                  System Health
                </span>
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', color: C.textTer,
                }}>
                  LIVE
                </span>
              </div>

              {/* Neural Sync Latency */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <RingGauge value={Math.max(0, 180 - latency)} max={180} color={latencyColor} size={44} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: latencyColor, fontFamily: 'monospace',
                  }}>
                    {latency}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>
                    Neural Sync
                  </div>
                  <div style={{ fontSize: 9, color: C.textSec }}>
                    {latencyLabel} · {trend === 'improving' ? '↑ Improving' : trend === 'degrading' ? '↓ Degrading' : '→ Stable'}
                  </div>
                </div>
              </div>

              {/* Protocol Adherence */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <RingGauge value={protocol.adherence} max={100} color={adherenceColor} size={44} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: adherenceColor, fontFamily: 'monospace',
                  }}>
                    {protocol.loading ? '—' : protocol.adherence}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>
                    Protocol Adherence
                  </div>
                  <div style={{ fontSize: 9, color: C.textSec }}>
                    {protocol.loading ? 'Loading…' : `${protocol.completed}/${protocol.total} completed today`}
                  </div>
                </div>
              </div>

              {/* Biological Integrity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <RingGauge value={bio.integrity} max={100} color={integrityColor} size={44} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: integrityColor, fontFamily: 'monospace',
                  }}>
                    {bio.loading ? '—' : bio.integrity}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.text }}>
                    Biological Integrity
                  </div>
                  <div style={{ fontSize: 9, color: C.textSec }}>
                    {bio.loading ? 'Loading…' : `Status: ${bio.status.charAt(0).toUpperCase() + bio.status.slice(1)}`}
                  </div>
                </div>
              </div>

              {/* Tips count */}
              {totalPings > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 10,
                  background: `${C.blue}10`, border: `1px solid ${C.blue}20`,
                }}>
                  <span style={{ fontSize: 12 }}>💡</span>
                  <span style={{ fontSize: 10, color: C.blueBright, fontWeight: 600 }}>
                    {totalPings} tip{totalPings !== 1 ? 's' : ''} waiting
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bio-Ping Toast Area — bottom-right with haptic bounce ── */}
      {activePing && (
        <div style={{
          position: 'fixed',
          bottom: 110,
          right: 16,
          zIndex: 9995,
          pointerEvents: 'none',
        }}>
          <BioPingToast
            ping={activePing}
            isVisible={pingVisible}
            onDismiss={dismiss}
          />
        </div>
      )}

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes bioPingPulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </>
  );
}
