import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBioContext, type BioContextInsight } from '@/hooks/useBioContext';

/* ═══════════════════════════════════════════════════════════════
   DEEP INTELLIGENCE PANEL
   
   Displays synthesized cross-system insights from useBioContext.
   When SomaticBodyMap tension + low inventory + protocol drift
   converge, this panel surfaces high-priority Recalibration alerts
   with haptic-style bounce animations.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  gold: '#FFD700',
  purple: '#A78BFA',
  border: 'rgba(255,255,255,0.05)',
};

const PRIORITY_CONFIG = {
  critical: { color: T.red, glow: 'rgba(255,107,107,0.15)', icon: '🔴', label: 'CRITICAL' },
  high: { color: T.orange, glow: 'rgba(232,151,108,0.15)', icon: '🟠', label: 'HIGH' },
  moderate: { color: T.gold, glow: 'rgba(255,215,0,0.12)', icon: '🟡', label: 'MODERATE' },
};

const SYSTEM_ICONS: Record<string, string> = {
  somatic: '🫀',
  inventory: '💊',
  drift: '📉',
  biomarker: '🧬',
};

function InsightCard({ insight, index }: { insight: BioContextInsight; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = PRIORITY_CONFIG[insight.priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
        delay: index * 0.08,
      }}
      onClick={() => setExpanded(!expanded)}
      style={{
        background: config.glow,
        border: `1px solid ${config.color}22`,
        borderRadius: 14,
        padding: '12px 14px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Priority pulse */}
      {insight.priority === 'critical' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${config.color}, transparent)`,
          animation: 'diPulse 2s ease-in-out infinite',
        }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <motion.div
          animate={insight.priority === 'critical' ? {
            scale: [1, 1.15, 1],
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }}
        >
          {config.icon}
        </motion.div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          }}>
            <span style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              color: config.color, letterSpacing: '0.12em',
              background: `${config.color}15`, padding: '2px 6px',
              borderRadius: 4, textTransform: 'uppercase',
            }}>
              {config.label}
            </span>
            <span style={{
              fontSize: 8, fontFamily: 'monospace', color: T.textTer,
            }}>
              {insight.correlationScore}% correlation
            </span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: T.text,
            lineHeight: 1.3, marginBottom: 4,
          }}>
            {insight.title}
          </div>

          {/* Source badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {insight.sources.map((s, i) => (
              <span key={i} style={{
                fontSize: 8, fontFamily: 'monospace', color: T.textSec,
                background: 'rgba(255,255,255,0.04)', padding: '2px 6px',
                borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3,
              }}>
                {SYSTEM_ICONS[s.system] || '📊'} {s.system}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: 10, paddingTop: 10,
              borderTop: `1px solid ${T.border}`,
            }}>
              {/* Action */}
              <div style={{
                fontSize: 11, color: T.textSec, lineHeight: 1.5,
                marginBottom: 10,
              }}>
                {insight.action}
              </div>

              {/* Source details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {insight.sources.map((s, i) => (
                  <div key={i} style={{
                    fontSize: 9, fontFamily: 'monospace', color: T.textTer,
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                  }}>
                    <span style={{ flexShrink: 0 }}>{SYSTEM_ICONS[s.system]}</span>
                    <span>{s.detail}</span>
                  </div>
                ))}
              </div>

              {/* Recalibrate button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                style={{
                  marginTop: 10, width: '100%', padding: '8px 0',
                  background: `${config.color}20`, border: `1px solid ${config.color}30`,
                  borderRadius: 8, color: config.color, fontSize: 10,
                  fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                ⚡ RECALIBRATE PROTOCOL
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function DeepIntelligencePanel() {
  const bio = useBioContext();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevCountRef = useRef(0);

  // Auto-show when critical insights appear
  useEffect(() => {
    if (bio.isLoading || dismissed) return;
    if (bio.hasCritical && bio.insights.length > prevCountRef.current) {
      setVisible(true);
    }
    prevCountRef.current = bio.insights.length;
  }, [bio.hasCritical, bio.insights.length, bio.isLoading, dismissed]);

  if (bio.isLoading || bio.insights.length === 0) return null;

  const integrityPct = bio.systemStatus.overallIntegrity;

  return (
    <>
      {/* Floating trigger badge */}
      {!visible && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          onClick={() => { setVisible(true); setDismissed(false); }}
          style={{
            position: 'fixed', bottom: 170, left: 16, zIndex: 9996,
            width: 44, height: 44, borderRadius: '50%',
            background: bio.hasCritical ? 'rgba(255,107,107,0.15)' : 'rgba(232,151,108,0.12)',
            border: `1px solid ${bio.hasCritical ? T.red : T.orange}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18,
            boxShadow: bio.hasCritical
              ? '0 0 20px rgba(255,107,107,0.3)'
              : '0 0 12px rgba(232,151,108,0.2)',
            animation: bio.hasCritical ? 'diBadgePulse 2s ease-in-out infinite' : 'none',
          }}
        >
          🧠
          {/* Count badge */}
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: bio.hasCritical ? T.red : T.orange,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: '#000',
          }}>
            {bio.insights.length}
          </div>
        </motion.button>
      )}

      {/* Panel */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', bottom: 100, left: 12, zIndex: 9996,
              width: 'min(320px, calc(100vw - 24px))',
              maxHeight: 'calc(100vh - 180px)',
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 16px 10px',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: T.blue, letterSpacing: '0.15em', textTransform: 'uppercase',
                  marginBottom: 2,
                }}>
                  🧠 DEEP INTELLIGENCE
                </div>
                <div style={{
                  fontSize: 10, fontFamily: 'monospace', color: T.textTer,
                }}>
                  Cross-system synthesis · {bio.insights.length} insight{bio.insights.length !== 1 ? 's' : ''}
                </div>
              </div>
              <button
                onClick={() => { setVisible(false); setDismissed(true); }}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.04)', border: 'none',
                  color: T.textTer, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* System Integrity Bar */}
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textSec }}>
                  BIOLOGICAL INTEGRITY
                </span>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                  color: bio.integrityColor,
                }}>
                  {integrityPct}% · {bio.integrityLabel}
                </span>
              </div>
              <div style={{
                height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.04)',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${integrityPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: 2,
                    background: `linear-gradient(90deg, ${bio.integrityColor}, ${bio.integrityColor}88)`,
                  }}
                />
              </div>
              {/* Mini stats */}
              <div style={{
                display: 'flex', gap: 12, marginTop: 8,
              }}>
                {[
                  { label: 'Somatic', value: bio.systemStatus.somaticSignals, icon: '🫀' },
                  { label: 'Supply', value: bio.systemStatus.inventoryAlerts, icon: '💊' },
                  { label: 'Drift', value: bio.systemStatus.driftEvents, icon: '📉' },
                ].map((s) => (
                  <div key={s.label} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 10 }}>{s.icon}</span>
                    <span style={{
                      fontSize: 9, fontFamily: 'monospace',
                      color: s.value > 0 ? T.orange : T.textTer,
                      fontWeight: s.value > 0 ? 700 : 400,
                    }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights list */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '10px 12px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <AnimatePresence mode="popLayout">
                {bio.insights.map((insight, i) => (
                  <InsightCard key={insight.id} insight={insight} index={i} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes diPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes diBadgePulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255,107,107,0.2); }
          50% { box-shadow: 0 0 24px rgba(255,107,107,0.5); }
        }
      `}</style>
    </>
  );
}
