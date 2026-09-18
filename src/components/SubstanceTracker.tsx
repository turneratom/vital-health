import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { motion, AnimatePresence } from 'framer-motion';

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   SUBSTANCE TRACKER — Minimalist Peptide/HRT Dosage Interface
   
   Logs dosages, tracks 5-on/2-off cycles, shows injection site
   rotation, surfaces Proactive Pulse alerts, and provides
   one-tap "Sync Dosage" to eliminate multi-app friction.
   ═══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceHover: 'rgba(20,20,26,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00FFCC',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  purple: '#AF82FF',
  border: 'rgba(255,255,255,0.06)',
  borderAccent: 'rgba(0,255,204,0.15)',
};

const SITE_LABELS: Record<string, string> = {
  abdomen_left: 'Abd L', abdomen_right: 'Abd R',
  deltoid_left: 'Delt L', deltoid_right: 'Delt R',
  glute_left: 'Glute L', glute_right: 'Glute R',
  thigh_left: 'Thigh L', thigh_right: 'Thigh R',
};

const CATEGORY_COLORS: Record<string, string> = {
  peptide: '#AF82FF', hrt: '#3B82F6', supplement: '#00DC82', nootropic: '#E8976C',
};

const SUBSTANCE_PRESETS = [
  { name: 'BPC-157', category: 'peptide', icon: '🛡️', color: '#00DC82', dosageMg: 0.25, dosageUnit: 'mg', route: 'subcutaneous', frequency: 'daily', onDays: 5, offDays: 2, biomarkers: ['igf1', 'crp'] },
  { name: 'TB-500', category: 'peptide', icon: '🧬', color: '#AF82FF', dosageMg: 2.5, dosageUnit: 'mg', route: 'subcutaneous', frequency: '2x_week', onDays: 5, offDays: 2, biomarkers: ['igf1', 'crp'] },
  { name: 'Semaglutide', category: 'peptide', icon: '💉', color: '#3B82F6', dosageMg: 0.5, dosageUnit: 'mg', route: 'subcutaneous', frequency: 'weekly', onDays: 7, offDays: 0, biomarkers: ['fastingGlucose', 'hba1c'] },
  { name: 'Testosterone Cypionate', category: 'hrt', icon: '⚡', color: '#E8976C', dosageMg: 100, dosageUnit: 'mg', route: 'intramuscular', frequency: 'weekly', onDays: 7, offDays: 0, biomarkers: ['testosteroneTotal', 'testosteroneFree'] },
  { name: 'Ipamorelin', category: 'peptide', icon: '🔬', color: '#00FFCC', dosageMg: 0.2, dosageUnit: 'mg', route: 'subcutaneous', frequency: 'daily', onDays: 5, offDays: 2, biomarkers: ['igf1', 'fastingGlucose'] },
  { name: 'CJC-1295', category: 'peptide', icon: '🧪', color: '#6B8AFF', dosageMg: 0.1, dosageUnit: 'mg', route: 'subcutaneous', frequency: 'daily', onDays: 5, offDays: 2, biomarkers: ['igf1'] },
];

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Cycle Ring Visualization ── */
function CycleRing({ onDays, offDays, currentDay, isOnPhase, color, size = 56 }: {
  onDays: number; offDays: number; currentDay: number; isOnPhase: boolean; color: string; size?: number;
}) {
  const total = onDays + offDays;
  const dayInCycle = ((currentDay - 1) % total) + 1;
  const progress = dayInCycle / total;
  const onProgress = onDays / total;
  const r = (size - 6) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {/* Background track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      {/* On-phase arc */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${circumference * onProgress} ${circumference * (1 - onProgress)}`}
        opacity={0.3} />
      {/* Current progress */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={isOnPhase ? color : '#6B8AFF'} strokeWidth={3}
        strokeDasharray={`${circumference * progress} ${circumference * (1 - progress)}`}
        strokeLinecap="round" />
      {/* Center text */}
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill={CC.text} fontSize={size * 0.22} fontWeight={700} fontFamily="monospace"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px` }}>
        {dayInCycle}
      </text>
    </svg>
  );
}

/* ── Proactive Pulse Alert Card ── */
function PulseAlert({ alert, onDismiss, onAct }: {
  alert: any;
  onDismiss: (id: any) => void;
  onAct: (id: any, type: string, cycleId?: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      style={{
        background: CC.surface,
        border: `1px solid ${alert.severity === 'critical' ? 'rgba(255,107,107,0.25)' : alert.severity === 'warning' ? 'rgba(232,151,108,0.2)' : CC.borderAccent}`,
        borderRadius: 14,
        padding: '12px 14px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${alert.accentColor}, transparent)`,
        opacity: 0.6,
      }} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 20, lineHeight: 1 }}>{alert.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: CC.text, fontFamily: 'monospace', letterSpacing: '0.02em', marginBottom: 3 }}>
            {alert.title}
          </div>
          <div style={{ fontSize: 10, color: CC.textSec, lineHeight: 1.5 }}>
            {alert.message}
          </div>
          {alert.biomarkerValue != null && (
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: alert.severity === 'critical' ? CC.red : CC.orange, fontWeight: 600 }}>
                {alert.biomarkerValue} {alert.biomarkerReference?.split(' ').pop()}
              </span>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textTer }}>
                REF: {alert.biomarkerReference}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {alert.actionLabel && (
              <button
                onClick={() => onAct(alert._id, alert.actionType, alert.cycleId)}
                style={{
                  padding: '5px 12px', fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                  color: '#0A0A0B', background: alert.accentColor || CC.accent,
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}
              >
                {alert.actionLabel}
              </button>
            )}
            <button
              onClick={() => onDismiss(alert._id)}
              style={{
                padding: '5px 10px', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                color: CC.textSec, background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${CC.border}`, borderRadius: 8, cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main SubstanceTracker Component ── */
export default function SubstanceTracker() {
  const sessionId = getTwinSessionId();

  const dashboard = useQuery(api.substanceIntegrity.getDashboardState, { sessionId });
  const createCycle = useMutation(api.substanceIntegrity.createCycle);
  const logDose = useMutation(api.substanceIntegrity.logDose);
  const syncDosage = useMutation(api.substanceIntegrity.syncDosage);
  const dismissAlert = useMutation(api.substanceIntegrity.dismissAlert);
  const actOnAlert = useMutation(api.substanceIntegrity.actOnAlert);
  const checkDrift = useMutation(api.substanceIntegrity.checkBiomarkerDrift);

  const [view, setView] = useState<'cycles' | 'log' | 'add'>('cycles');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);

  // Run biomarker drift check on mount
  React.useEffect(() => {
    checkDrift({ sessionId }).catch(() => {});
  }, [sessionId]);

  const handleSyncDosage = useCallback(async (cycleId: string) => {
    setSyncing(cycleId);
    try {
      const result = await syncDosage({ sessionId, cycleId: cycleId as any });
      setLogSuccess(`${result.substanceName} synced`);
      setTimeout(() => setLogSuccess(null), 2500);
    } catch (e) { console.error(e); }
    setSyncing(null);
  }, [sessionId, syncDosage]);

  const handleDismissAlert = useCallback(async (alertId: any) => {
    await dismissAlert({ alertId });
  }, [dismissAlert]);

  const handleActOnAlert = useCallback(async (alertId: any, actionType: string, cycleId?: string) => {
    await actOnAlert({ alertId });
    if (actionType === 'sync_dosage' && cycleId) {
      await handleSyncDosage(cycleId);
    } else if (actionType === 'log_dose') {
      setView('log');
    }
  }, [actOnAlert, handleSyncDosage]);

  const handleAddPreset = useCallback(async (preset: typeof SUBSTANCE_PRESETS[0]) => {
    await createCycle({
      sessionId,
      substanceName: preset.name,
      category: preset.category,
      icon: preset.icon,
      color: preset.color,
      dosageMg: preset.dosageMg,
      dosageUnit: preset.dosageUnit,
      route: preset.route,
      frequency: preset.frequency,
      onDays: preset.onDays,
      offDays: preset.offDays,
      monitoredBiomarkers: preset.biomarkers,
    });
    setView('cycles');
  }, [sessionId, createCycle]);

  const handleQuickLog = useCallback(async (cycle: any) => {
    await logDose({
      sessionId,
      substanceName: cycle.substanceName,
      category: cycle.category,
      dosageMg: cycle.dosageMg,
      dosageUnit: cycle.dosageUnit,
      route: cycle.route,
      cycleId: cycle._id,
    });
    setLogSuccess(`${cycle.substanceName} logged`);
    setTimeout(() => setLogSuccess(null), 2500);
  }, [sessionId, logDose]);

  if (!dashboard) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(59,130,246,0.1)', borderTopColor: CC.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: CC.purple, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>
            SUBSTANCE INTEGRITY
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: CC.text }}>
            {dashboard.totalActiveCycles} Active {dashboard.totalActiveCycles === 1 ? 'Cycle' : 'Cycles'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['cycles', 'log', 'add'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '4px 10px', fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
              color: view === v ? CC.bg : CC.textSec,
              background: view === v ? CC.accent : 'rgba(255,255,255,0.04)',
              border: `1px solid ${view === v ? 'transparent' : CC.border}`,
              borderRadius: 6, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              {v === 'cycles' ? 'Cycles' : v === 'log' ? 'History' : '+ Add'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Success Toast ── */}
      <AnimatePresence>
        {logSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{
              background: 'rgba(0,220,130,0.12)', border: '1px solid rgba(0,220,130,0.25)',
              borderRadius: 10, padding: '8px 14px', marginBottom: 12,
              fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: CC.green,
              textAlign: 'center',
            }}
          >
            ✓ {logSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Proactive Pulse Alerts ── */}
      {dashboard.activeAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: CC.orange, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            ⚡ PROACTIVE PULSE
          </div>
          <AnimatePresence>
            {dashboard.activeAlerts.map((alert: any) => (
              <PulseAlert key={alert._id} alert={alert} onDismiss={handleDismissAlert} onAct={handleActOnAlert} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Cycles View ── */}
      {view === 'cycles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dashboard.cycles.length === 0 ? (
            <div style={{
              background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 14,
              padding: '28px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🧬</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: CC.text, marginBottom: 4 }}>No Active Cycles</div>
              <div style={{ fontSize: 10, color: CC.textSec, marginBottom: 12 }}>Add a peptide or HRT protocol to begin tracking</div>
              <button onClick={() => setView('add')} style={{
                padding: '6px 16px', fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                color: CC.bg, background: CC.accent, border: 'none', borderRadius: 8, cursor: 'pointer',
                letterSpacing: '0.05em',
              }}>
                + ADD PROTOCOL
              </button>
            </div>
          ) : (
            dashboard.cycles.map((cycle: any) => (
              <motion.div key={cycle._id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  background: CC.surface,
                  border: `1px solid ${cycle.isOnPhase ? `${cycle.color}22` : CC.border}`,
                  borderRadius: 14, padding: '14px 14px', position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Phase indicator bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: cycle.isOnPhase
                    ? `linear-gradient(90deg, ${cycle.color}00, ${cycle.color}, ${cycle.color}00)`
                    : `linear-gradient(90deg, transparent, rgba(107,138,255,0.4), transparent)`,
                }} />

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {/* Cycle Ring */}
                  <CycleRing
                    onDays={cycle.onDays} offDays={cycle.offDays}
                    currentDay={cycle.currentCycleDay} isOnPhase={cycle.isOnPhase}
                    color={cycle.color} size={52}
                  />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14 }}>{cycle.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: CC.text }}>{cycle.substanceName}</span>
                      <span style={{
                        fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                        color: cycle.isOnPhase ? cycle.color : '#6B8AFF',
                        background: cycle.isOnPhase ? `${cycle.color}15` : 'rgba(107,138,255,0.1)',
                        padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em',
                      }}>
                        {cycle.isOnPhase ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: CC.textSec, fontFamily: 'monospace' }}>
                      {cycle.dosageMg}{cycle.dosageUnit} · {cycle.route.replace(/_/g, ' ')} · {cycle.frequency.replace(/_/g, '/')}
                    </div>
                    <div style={{ fontSize: 9, color: CC.textTer, fontFamily: 'monospace', marginTop: 2 }}>
                      {cycle.phaseLabel} · {cycle.totalDosesLogged} doses logged
                      {cycle.weeksElapsed > 0 ? ` · Wk ${cycle.weeksElapsed + 1}` : ''}
                    </div>
                  </div>

                  {/* Sync Dosage Button */}
                  {cycle.isOnPhase && (
                    <button
                      onClick={() => handleSyncDosage(cycle._id)}
                      disabled={syncing === cycle._id}
                      style={{
                        padding: '8px 12px', fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                        color: CC.bg, background: syncing === cycle._id ? 'rgba(0,255,204,0.5)' : CC.accent,
                        border: 'none', borderRadius: 10, cursor: syncing === cycle._id ? 'wait' : 'pointer',
                        letterSpacing: '0.05em', whiteSpace: 'nowrap',
                        boxShadow: `0 0 16px ${CC.accent}22`,
                        transition: 'all 0.2s',
                      }}
                    >
                      {syncing === cycle._id ? '⏳' : '⚡ SYNC'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))
          )}

          {/* ── Biomarker Status ── */}
          {dashboard.biomarkerStatus.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: CC.textTer, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                MONITORED BIOMARKERS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                {dashboard.biomarkerStatus.map((bm: any) => (
                  <div key={bm.key} style={{
                    background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 10,
                    padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: 12 }}>{bm.icon}</span>
                      <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 600, color: CC.textSec }}>{bm.label}</span>
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 800, fontFamily: 'monospace',
                      color: bm.status === 'optimal' ? CC.green : bm.status === 'warning' ? CC.orange : bm.status === 'critical' ? CC.red : CC.textTer,
                    }}>
                      {bm.value !== null ? bm.value : '—'}
                      <span style={{ fontSize: 8, fontWeight: 500, color: CC.textTer, marginLeft: 2 }}>{bm.unit}</span>
                    </div>
                    <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, marginTop: 2 }}>
                      Optimal: {bm.optimalRange}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History View ── */}
      {view === 'log' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {dashboard.recentLogs.length === 0 ? (
            <div style={{
              background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 14,
              padding: '24px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: CC.textSec }}>No doses logged yet</div>
            </div>
          ) : (
            dashboard.recentLogs.map((log: any) => (
              <div key={log._id} style={{
                background: CC.surface, border: `1px solid ${CC.border}`, borderRadius: 10,
                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: CATEGORY_COLORS[log.category] || CC.accent,
                  boxShadow: `0 0 6px ${CATEGORY_COLORS[log.category] || CC.accent}44`,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CC.text }}>{log.substanceName}</div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec }}>
                    {log.dosageMg}{log.dosageUnit} · {log.route.replace(/_/g, ' ')}
                    {log.injectionSite ? ` · ${SITE_LABELS[log.injectionSite] || log.injectionSite}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textTer }}>
                  {formatTimeAgo(log.loggedAt)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Add Protocol View ── */}
      {view === 'add' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: CC.textTer, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
            SELECT PROTOCOL
          </div>
          {SUBSTANCE_PRESETS.map((preset) => {
            const alreadyActive = dashboard.cycles.some((c: any) => c.substanceName === preset.name);
            return (
              <motion.button
                key={preset.name}
                whileTap={{ scale: 0.98 }}
                onClick={() => !alreadyActive && handleAddPreset(preset)}
                disabled={alreadyActive}
                style={{
                  background: CC.surface,
                  border: `1px solid ${alreadyActive ? 'rgba(255,255,255,0.03)' : `${preset.color}18`}`,
                  borderRadius: 12, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  cursor: alreadyActive ? 'default' : 'pointer',
                  opacity: alreadyActive ? 0.4 : 1,
                  textAlign: 'left', width: '100%',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 22 }}>{preset.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: CC.text }}>{preset.name}</div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec }}>
                    {preset.dosageMg}{preset.dosageUnit} · {preset.route} · {preset.onDays}-on/{preset.offDays}-off
                  </div>
                  <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, marginTop: 2 }}>
                    Monitors: {preset.biomarkers.map((b) => b === 'igf1' ? 'IGF-1' : b === 'fastingGlucose' ? 'Fasting Glucose' : b === 'crp' ? 'CRP' : b === 'hba1c' ? 'HbA1c' : b.replace(/([A-Z])/g, ' $1')).join(', ')}
                  </div>
                </div>
                {alreadyActive ? (
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, fontWeight: 600 }}>ACTIVE</span>
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${preset.color}15`, border: `1px solid ${preset.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: preset.color,
                  }}>+</div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
