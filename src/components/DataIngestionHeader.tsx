import { useState, useEffect, useCallback, useRef } from 'react';
import { useBiometricSync } from '@/hooks/useBiometricSync';

/* ══════════════════════════════════════════════════════════════
 * DataIngestionHeader — Persistent Data Ingestion Status Bar
 * Pulsing provider icons (Oura, Whoop, Biotech Labs) with
 * Live / Syncing states. Click any icon to reveal a micro-modal
 * with "Last Insight Generated" timestamp + stream stats.
 * Auto-updating "Last Synced" reinforces frictionless value prop.
 * ══════════════════════════════════════════════════════════════ */

/* ── Palette ── */
const C = {
  bg: 'rgba(8,7,6,0.92)',
  bgHover: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.05)',
  borderActive: 'rgba(255,255,255,0.08)',
  text: '#E8E0D8',
  textSec: '#B0A89E',
  textDim: '#6A6259',
  gold: '#C4A46C',
  sage: '#7CB68E',
  oura: '#D4A574',
  whoop: '#00DC82',
  labs: '#B8A9C9',
  red: '#FF6B6B',
};

/* ── Source definitions ── */
interface IngestionSource {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  syncIntervalMs: number;
  dataTypes: string[];
  insightLabel: string;
}

const SOURCES: IngestionSource[] = [
  {
    id: 'oura',
    name: 'Oura Ring',
    shortName: 'Oura',
    icon: '\uD83D\uDC8D',
    color: C.oura,
    syncIntervalMs: 45000,
    dataTypes: ['HRV', 'Sleep', 'Readiness', 'SpO2'],
    insightLabel: 'Sleep architecture analysis',
  },
  {
    id: 'whoop',
    name: 'WHOOP 4.0',
    shortName: 'Whoop',
    icon: '\u231A',
    color: C.whoop,
    syncIntervalMs: 30000,
    dataTypes: ['Strain', 'Recovery', 'HR', 'HRV'],
    insightLabel: 'Recovery score computation',
  },
  {
    id: 'biotech',
    name: 'Biotech Labs',
    shortName: 'Labs',
    icon: '\uD83E\uDDEC',
    color: C.labs,
    syncIntervalMs: 120000,
    dataTypes: ['Cortisol', 'Testosterone', 'CRP', 'IGF-1'],
    insightLabel: 'Hormonal panel correlation',
  },
];

/* ── Helpers ── */
function formatTimeSince(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatTimeShort(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

/* ── Per-source state ── */
interface SourceState {
  lastSync: number;
  lastInsight: number;
  dataPoints: number;
  isActive: boolean;
  isSyncing: boolean;
  streamRate: number;
}

/* ══════════════════════════════════════════════════════════════ */

export default function DataIngestionHeader() {
  const bioSync = useBiometricSync();
  const [tick, setTick] = useState(0);
  const [sourceStates, setSourceStates] = useState<Record<string, SourceState>>(() => {
    const now = Date.now();
    const states: Record<string, SourceState> = {};
    SOURCES.forEach((s) => {
      const lastSync = now - Math.floor(Math.random() * 40000 + 8000);
      states[s.id] = {
        lastSync,
        lastInsight: lastSync + Math.floor(Math.random() * 3000 + 500),
        dataPoints: Math.floor(Math.random() * 400 + 120),
        isActive: true,
        isSyncing: false,
        streamRate: Math.floor(Math.random() * 8 + 2),
      };
    });
    return states;
  });
  const [pulsePhase, setPulsePhase] = useState(0);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const syncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const modalRef = useRef<HTMLDivElement>(null);

  // Pulse animation
  useEffect(() => {
    const iv = setInterval(() => setPulsePhase((p) => (p + 1) % 100), 40);
    return () => clearInterval(iv);
  }, []);

  // Tick for time display updates
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(iv);
  }, []);

  // Close modal on outside click
  useEffect(() => {
    if (!activeModal) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setActiveModal(null);
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handler), 10);
    return () => { clearTimeout(timer); document.removeEventListener('click', handler); };
  }, [activeModal]);

  // Auto-dismiss modal after 6s
  useEffect(() => {
    if (!activeModal) return;
    const t = setTimeout(() => setActiveModal(null), 6000);
    return () => clearTimeout(t);
  }, [activeModal]);

  // Simulate periodic syncs per source
  useEffect(() => {
    SOURCES.forEach((source) => {
      const runSync = () => {
        setSourceStates((prev) => ({
          ...prev,
          [source.id]: { ...prev[source.id], isSyncing: true },
        }));

        setTimeout(() => {
          const newPoints = Math.floor(Math.random() * 12 + 3);
          const now = Date.now();
          setSourceStates((prev) => ({
            ...prev,
            [source.id]: {
              ...prev[source.id],
              isSyncing: false,
              lastSync: now,
              lastInsight: now + Math.floor(Math.random() * 2000 + 300),
              dataPoints: prev[source.id].dataPoints + newPoints,
              streamRate: Math.floor(Math.random() * 8 + 2),
            },
          }));
        }, 800 + Math.random() * 400);

        syncTimersRef.current[source.id] = setTimeout(
          runSync,
          source.syncIntervalMs + Math.random() * 10000
        );
      };

      syncTimersRef.current[source.id] = setTimeout(
        runSync,
        Math.random() * 15000 + 5000
      );
    });

    return () => {
      Object.values(syncTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const pulseVal = Math.sin((pulsePhase / 100) * Math.PI * 2);
  const anySyncing = Object.values(sourceStates).some((s) => s.isSyncing);

  const mostRecentSync = Math.max(...Object.values(sourceStates).map((s) => s.lastSync));
  const globalTimeSince = Date.now() - mostRecentSync;

  const toggleModal = useCallback((id: string) => {
    setActiveModal((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        zIndex: 50,
        overflow: 'visible',
      }}
    >
      <style>{`
        @keyframes dih-pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes dih-ring-expand {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes dih-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dih-stream {
          0% { transform: translateX(-100%); opacity: 0; }
          30% { opacity: 0.8; }
          100% { transform: translateX(300%); opacity: 0; }
        }
        @keyframes dih-modal-in {
          0% { opacity: 0; transform: translateY(-4px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dih-insight-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Bottom streaming line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: anySyncing
            ? `linear-gradient(90deg, transparent, ${C.gold}40, transparent)`
            : `linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)`,
          transition: 'background 0.5s',
        }}
      />
      {anySyncing && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '25%',
            height: 1,
            background: `linear-gradient(90deg, transparent, ${C.gold}80, transparent)`,
            animation: 'dih-stream 2.5s linear infinite',
          }}
        />
      )}

      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 46,
          padding: '0 12px',
          gap: 8,
        }}
      >
        {/* Left: Global status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: 7, height: 7 }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: anySyncing ? C.gold : C.sage,
                animation: 'dih-pulse 2s ease-in-out infinite',
              }}
            />
            {anySyncing && (
              <div
                style={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: '50%',
                  border: `1px solid ${C.gold}`,
                  animation: 'dih-ring-expand 1.5s ease-out infinite',
                }}
              />
            )}
          </div>
          <span
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: anySyncing ? C.gold : C.textSec,
              textTransform: 'uppercase',
              transition: 'color 0.3s',
            }}
          >
            {anySyncing ? 'INGESTING' : 'LIVE'}
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />

        {/* Center: Source icons — clickable */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {SOURCES.map((source) => {
            const state = sourceStates[source.id];
            const isSyncing = state?.isSyncing;
            const isModalOpen = activeModal === source.id;
            const timeSince = Date.now() - (state?.lastSync || 0);

            return (
              <div key={source.id} style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleModal(source.id); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 8,
                    background: isModalOpen
                      ? `${source.color}10`
                      : isSyncing
                        ? `${source.color}08`
                        : 'transparent',
                    border: `1px solid ${
                      isModalOpen
                        ? `${source.color}30`
                        : isSyncing
                          ? `${source.color}18`
                          : 'transparent'
                    }`,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    outline: 'none',
                  }}
                >
                  {/* Icon with pulse */}
                  <div style={{ position: 'relative', width: 18, height: 18 }}>
                    {/* Syncing ring */}
                    {isSyncing && (
                      <svg
                        viewBox="0 0 18 18"
                        style={{
                          position: 'absolute',
                          inset: -2,
                          width: 22,
                          height: 22,
                          animation: 'dih-spin 1.5s linear infinite',
                        }}
                      >
                        <circle
                          cx="9" cy="9" r="8"
                          fill="none"
                          stroke={`${source.color}50`}
                          strokeWidth="1.5"
                          strokeDasharray="12 38"
                          strokeLinecap="round"
                        />
                      </svg>
                    )}
                    {/* Active glow */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: -1,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${source.color}${isSyncing ? '25' : '10'}, transparent 70%)`,
                        opacity: 0.5 + 0.3 * pulseVal,
                        transition: 'opacity 0.3s',
                      }}
                    />
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {source.icon}
                    </div>
                    {/* Status dot */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -1,
                        right: -1,
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: isSyncing ? C.gold : C.sage,
                        border: '1px solid rgba(8,7,6,0.9)',
                        zIndex: 2,
                        animation: isSyncing ? 'dih-pulse 1s ease-in-out infinite' : 'none',
                      }}
                    />
                  </div>

                  {/* Name + state */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 9.5,
                        fontWeight: 600,
                        color: isSyncing ? source.color : C.text,
                        letterSpacing: '0.03em',
                        lineHeight: 1.1,
                        transition: 'color 0.3s',
                      }}
                    >
                      {source.shortName}
                    </span>
                    <span
                      style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 8,
                        fontWeight: 500,
                        color: isSyncing ? `${source.color}BB` : C.textDim,
                        letterSpacing: '0.06em',
                        lineHeight: 1.1,
                        textTransform: 'uppercase',
                        transition: 'color 0.3s',
                      }}
                    >
                      {isSyncing ? 'Syncing' : 'Live'}
                    </span>
                  </div>
                </button>

                {/* ── Micro-Modal ── */}
                {isModalOpen && (
                  <div
                    ref={modalRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 220,
                      padding: '12px 14px',
                      background: 'rgba(14,13,12,0.96)',
                      border: `1px solid ${source.color}25`,
                      borderRadius: 12,
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)`,
                      zIndex: 200,
                      animation: 'dih-modal-in 0.2s ease-out both',
                    }}
                  >
                    {/* Arrow */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -5,
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: 10,
                        height: 10,
                        background: 'rgba(14,13,12,0.96)',
                        borderTop: `1px solid ${source.color}25`,
                        borderLeft: `1px solid ${source.color}25`,
                      }}
                    />

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: `${source.color}12`,
                          border: `1px solid ${source.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                        }}
                      >
                        {source.icon}
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 11,
                            fontWeight: 700,
                            color: C.text,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {source.name}
                        </div>
                        <div
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 8.5,
                            fontWeight: 600,
                            color: isSyncing ? C.gold : C.sage,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: '50%',
                              background: isSyncing ? C.gold : C.sage,
                              display: 'inline-block',
                              animation: 'dih-pulse 1.5s ease-in-out infinite',
                            }}
                          />
                          {isSyncing ? 'SYNCING' : 'CONNECTED'}
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '0 -2px 10px' }} />

                    {/* Last Insight Generated */}
                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontSize: 8,
                          fontWeight: 600,
                          color: C.textDim,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        LAST INSIGHT GENERATED
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            fontSize: 14,
                            fontWeight: 700,
                            color: source.color,
                            letterSpacing: '-0.02em',
                            animation: 'dih-insight-pulse 3s ease-in-out infinite',
                          }}
                        >
                          {formatTimeShort(Date.now() - (state?.lastInsight || Date.now()))}
                        </span>
                        <span
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 9,
                            color: C.textSec,
                          }}
                        >
                          ago
                        </span>
                      </div>
                      <div
                        style={{
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontSize: 9,
                          color: C.textDim,
                          marginTop: 2,
                          fontStyle: 'italic',
                        }}
                      >
                        {source.insightLabel}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        padding: '8px 0 4px',
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            fontSize: 12,
                            fontWeight: 700,
                            color: C.text,
                          }}
                        >
                          {(state?.dataPoints || 0).toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 8,
                            color: C.textDim,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Data Points
                        </div>
                      </div>
                      <div style={{ width: 1, background: 'rgba(255,255,255,0.04)' }} />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            fontSize: 12,
                            fontWeight: 700,
                            color: C.text,
                          }}
                        >
                          {state?.streamRate || 0}/m
                        </div>
                        <div
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 8,
                            color: C.textDim,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Stream Rate
                        </div>
                      </div>
                      <div style={{ width: 1, background: 'rgba(255,255,255,0.04)' }} />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontFamily: "'SF Mono', 'Fira Code', monospace",
                            fontSize: 12,
                            fontWeight: 700,
                            color: timeSince < 60000 ? C.sage : C.textSec,
                          }}
                        >
                          {formatTimeShort(timeSince)}
                        </div>
                        <div
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 8,
                            color: C.textDim,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Last Sync
                        </div>
                      </div>
                    </div>

                    {/* Data type tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                      {source.dataTypes.map((dt) => (
                        <span
                          key={dt}
                          style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontSize: 7.5,
                            fontWeight: 600,
                            color: `${source.color}CC`,
                            background: `${source.color}10`,
                            border: `1px solid ${source.color}15`,
                            padding: '2px 6px',
                            borderRadius: 4,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {dt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 16, background: C.border, flexShrink: 0 }} />

        {/* Right: Last Synced timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 8.5,
              color: C.textDim,
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            Last Synced:
          </span>
          <span
            style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 9,
              fontWeight: 600,
              color: globalTimeSince < 60000 ? C.sage : C.textSec,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap',
              transition: 'color 0.3s',
            }}
          >
            {formatTimeSince(globalTimeSince)}
          </span>
        </div>
      </div>
    </div>
  );
}
