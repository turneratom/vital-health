import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  runSupplementSynergy,
  type SynergyAlert,
  type SynergyReport,
  type StackLogEntry,
  type BioVaultSnapshot,
} from '@/lib/SupplementSynergy';

/* ══════════════════════════════════════════════════════════════════
   SUPPLEMENT SYNERGY HUD — Precision-Adjustment Alert Surface
   
   Monitors biomarker↔protocol gaps in real-time. When ApoB is high
   but Citrus Bergamot isn't being logged, surfaces a minimalist
   "Precision-Adjustment" alert with one-tap "Sync Dosage" action.
   ══════════════════════════════════════════════════════════════════ */

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; glow: string; dot: string }> = {
  critical: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', text: '#EF4444', glow: 'rgba(239,68,68,0.15)', dot: '#EF4444' },
  high: { bg: 'rgba(249,115,22,0.05)', border: 'rgba(249,115,22,0.15)', text: '#F97316', glow: 'rgba(249,115,22,0.1)', dot: '#F97316' },
  moderate: { bg: 'rgba(0,240,255,0.04)', border: 'rgba(0,240,255,0.1)', text: '#00F0FF', glow: 'rgba(0,240,255,0.08)', dot: '#00F0FF' },
  info: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)', glow: 'none', dot: 'rgba(255,255,255,0.3)' },
};

/* ── Adherence Ring ── */
function AdherenceRing({ value, size = 32, color }: { value: number; size?: number; color: string }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2.5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ filter: `drop-shadow(0 0 4px ${color}60)`, transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

/* ── Single Alert Card ── */
function SynergyAlertCard({
  alert,
  onSyncDosage,
  onDismiss,
  isExpanded,
  onToggle,
  isSyncing,
}: {
  alert: SynergyAlert;
  onSyncDosage: (alert: SynergyAlert) => void;
  onDismiss: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  isSyncing: boolean;
}) {
  const s = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, rgba(10,12,18,0.97) 0%, rgba(8,8,14,0.98) 100%)',
        border: `1px solid ${s.border}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${s.glow}`,
      }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
        style={{ background: `linear-gradient(180deg, ${alert.color}, ${alert.color}33)`, boxShadow: `0 0 6px ${alert.color}40` }} />

      {/* Compact header — always visible */}
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3 group">
        {/* Adherence ring + icon */}
        <div className="relative flex-shrink-0">
          <AdherenceRing value={alert.adherenceGap} size={36} color={alert.color} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm">{alert.icon}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Severity + category */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: s.dot, boxShadow: `0 0 4px ${s.dot}` }}
              animate={alert.severity === 'critical' ? { opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="font-mono text-[7px] tracking-widest uppercase" style={{ color: s.text }}>
              PRECISION-ADJUSTMENT
            </span>
            <span className="font-mono text-[7px] tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
              · {alert.category}
            </span>
          </div>

          {/* Title */}
          <h4 className="text-[12px] font-semibold leading-tight truncate" style={{ color: 'rgba(224,224,224,0.9)', letterSpacing: '-0.01em' }}>
            {alert.title}
          </h4>

          {/* Subtitle */}
          <p className="text-[9px] font-mono mt-0.5 truncate" style={{ color: 'rgba(160,180,200,0.45)' }}>
            {alert.marker}: {alert.markerValue} {alert.markerUnit} · {alert.adherenceGap}% adherence
          </p>
        </div>

        {/* Sync button (compact) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isExpanded && (
            <motion.button
              onClick={(e) => { e.stopPropagation(); onSyncDosage(alert); }}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-[0.97]"
              style={{
                background: `${alert.color}12`,
                border: `1px solid ${alert.color}30`,
                color: `${alert.color}CC`,
                boxShadow: `0 0 8px ${alert.color}10`,
              }}
              whileTap={{ scale: 0.95 }}
            >
              {isSyncing ? '⏳' : '⚡'} SYNC
            </motion.button>
          )}
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"
            className="transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              {/* Rationale */}
              <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="font-mono text-[7px] tracking-widest mb-1.5" style={{ color: `${alert.color}66` }}>
                  SCIENTIFIC RATIONALE
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(200,210,220,0.6)' }}>
                  {alert.rationale}
                </p>
              </div>

              {/* Prescribed Protocol */}
              <div className="rounded-xl p-3 mb-3" style={{ background: `${alert.color}06`, border: `1px solid ${alert.color}10` }}>
                <div className="font-mono text-[7px] tracking-widest mb-2" style={{ color: `${alert.color}55` }}>
                  PRESCRIBED PROTOCOL
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg">{alert.prescribedProtocol.icon}</span>
                  <div>
                    <div className="text-[11px] font-semibold" style={{ color: 'rgba(224,224,224,0.85)' }}>
                      {alert.prescribedProtocol.name}
                    </div>
                    <div className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {alert.prescribedProtocol.dose} · {alert.prescribedProtocol.timing}
                    </div>
                  </div>
                </div>
                {alert.prescribedProtocol.gene && (
                  <div className="text-[8px] font-mono px-1.5 py-0.5 rounded inline-block mb-1.5" style={{
                    background: 'rgba(175,130,255,0.06)', color: 'rgba(175,130,255,0.5)', border: '1px solid rgba(175,130,255,0.1)',
                  }}>
                    GENE: {alert.prescribedProtocol.gene}
                  </div>
                )}
                <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(200,210,220,0.45)' }}>
                  {alert.prescribedProtocol.mechanism}
                </p>
              </div>

              {/* Synergy Compounds */}
              {alert.synergyCompounds.length > 0 && (
                <div className="mb-3">
                  <div className="font-mono text-[7px] tracking-widest mb-1.5" style={{ color: 'rgba(175,130,255,0.4)' }}>
                    SYNERGISTIC COMPOUNDS
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {alert.synergyCompounds.map((c, i) => (
                      <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                        background: 'rgba(175,130,255,0.04)', color: 'rgba(175,130,255,0.5)', border: '1px solid rgba(175,130,255,0.08)',
                      }}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Target range */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="font-mono text-[6px] tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>CURRENT</div>
                  <div className="text-[11px] font-bold font-mono" style={{ color: s.text }}>
                    {alert.markerValue} {alert.markerUnit}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <div className="flex-1 rounded-lg p-2" style={{ background: 'rgba(52,211,153,0.03)', border: '1px solid rgba(52,211,153,0.08)' }}>
                  <div className="font-mono text-[6px] tracking-widest mb-0.5" style={{ color: 'rgba(52,211,153,0.4)' }}>TARGET</div>
                  <div className="text-[11px] font-bold font-mono" style={{ color: 'rgba(52,211,153,0.8)' }}>
                    {alert.targetRange}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => onSyncDosage(alert)}
                  disabled={isSyncing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-[1.01] disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${alert.color}15, ${alert.color}08)`,
                    border: `1px solid ${alert.color}30`,
                    color: `${alert.color}DD`,
                    boxShadow: `0 0 16px ${alert.color}10`,
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  {isSyncing ? (
                    <>
                      <motion.div
                        className="w-3 h-3 border-2 rounded-full"
                        style={{ borderColor: `${alert.color}30`, borderTopColor: alert.color }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      SYNCING DOSAGE...
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      SYNC DOSAGE
                    </>
                  )}
                </motion.button>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="px-3 py-2.5 rounded-xl text-[9px] font-mono uppercase tracking-wider transition-all hover:bg-white/[0.03]"
                  style={{ color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  DISMISS
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */

export function SupplementSynergyHUD() {
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('vive_session_id') || localStorage.getItem('vive-session-id') || '' : '';

  // Fetch bioVault data
  const bioVault = useQuery(api.queries.getBioVaultBySession, sessionId ? { sessionId } : 'skip');

  // Fetch recent protocol logs
  const protocolLogs = useQuery(api.queries.getProtocolLogs30d, sessionId ? { sessionId } : 'skip');

  // Log protocol mutation (for Sync Dosage)
  const logProtocol = useMutation(api.mutations.createProtocolLog);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Build vault snapshot
  const vaultSnapshot: BioVaultSnapshot | null = useMemo(() => {
    if (!bioVault) return null;
    return {
      vitaminD: bioVault.vitaminD ?? null,
      testosteroneFree: bioVault.testosteroneFree ?? null,
      testosteroneTotal: bioVault.testosteroneTotal ?? null,
      ferritin: bioVault.ferritin ?? null,
      crp: bioVault.crp ?? null,
      hba1c: bioVault.hba1c ?? null,
      mthfrVariant: bioVault.mthfrVariant ?? false,
      apoe4: bioVault.apoe4 ?? false,
      caffeineSensitivity: bioVault.caffeineSensitivity ?? false,
    };
  }, [bioVault]);

  // Build stack log entries
  const stackLogs: StackLogEntry[] = useMemo(() => {
    if (!protocolLogs) return [];
    return protocolLogs.map((l: any) => ({
      protocolId: l.protocolId,
      protocolName: l.protocolName,
      category: l.category,
      loggedAt: l.loggedAt,
      status: l.status,
    }));
  }, [protocolLogs]);

  // Run synergy engine
  const report: SynergyReport = useMemo(() => {
    return runSupplementSynergy(vaultSnapshot, stackLogs, 7);
  }, [vaultSnapshot, stackLogs]);

  // Filter dismissed alerts
  const visibleAlerts = useMemo(() => {
    return report.alerts.filter(a => !dismissedIds.has(a.id));
  }, [report.alerts, dismissedIds]);

  const displayAlerts = showAll ? visibleAlerts : visibleAlerts.slice(0, 3);

  // Handle Sync Dosage — logs the prescribed protocol to the stack
  const handleSyncDosage = useCallback(async (alert: SynergyAlert) => {
    if (!sessionId || syncingId) return;
    setSyncingId(alert.id);

    try {
      await logProtocol({
        sessionId,
        protocolId: alert.prescribedProtocol.id,
        protocolName: alert.prescribedProtocol.name,
        category: alert.category,
        loggedAt: Date.now(),
      });

      setSyncSuccess(alert.id);
      setTimeout(() => {
        setSyncSuccess(null);
        setDismissedIds(prev => new Set([...prev, alert.id]));
      }, 2000);
    } catch (err) {
      console.error('Sync dosage failed:', err);
    } finally {
      setSyncingId(null);
    }
  }, [sessionId, syncingId, logProtocol]);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // Clear sync success toast
  useEffect(() => {
    if (syncSuccess) {
      const timer = setTimeout(() => setSyncSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncSuccess]);

  // Don't render if no alerts
  if (visibleAlerts.length === 0) return null;

  const criticalCount = visibleAlerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 px-0.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center relative"
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            boxShadow: '0 0 12px rgba(239,68,68,0.08)',
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.7)" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          {criticalCount > 0 && (
            <motion.div
              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{ background: '#EF4444', boxShadow: '0 0 6px rgba(239,68,68,0.6)' }}
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-[7px] font-bold text-white">{criticalCount}</span>
            </motion.div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[13px] tracking-tight" style={{ color: 'rgba(224,224,224,0.9)', letterSpacing: '-0.01em' }}>
            Supplement Synergy
          </span>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(239,68,68,0.4)' }}>
            {visibleAlerts.length} precision-adjustment{visibleAlerts.length !== 1 ? 's' : ''} · {report.biomarkersCovered}/{report.biomarkersTotal} markers tracked
          </span>
        </div>
      </div>

      {/* Alert Cards */}
      <AnimatePresence mode="popLayout">
        {displayAlerts.map(alert => (
          <SynergyAlertCard
            key={alert.id}
            alert={alert}
            onSyncDosage={handleSyncDosage}
            onDismiss={handleDismiss}
            isExpanded={expandedId === alert.id}
            onToggle={() => handleToggle(alert.id)}
            isSyncing={syncingId === alert.id}
          />
        ))}
      </AnimatePresence>

      {/* Show more / less */}
      {visibleAlerts.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-[9px] font-mono uppercase tracking-wider py-1.5 rounded-lg transition-all hover:bg-white/[0.02]"
          style={{ color: 'rgba(0,240,255,0.4)', border: '1px solid rgba(0,240,255,0.06)' }}
        >
          {showAll ? 'SHOW LESS' : `+${visibleAlerts.length - 3} MORE ADJUSTMENTS`}
        </button>
      )}

      {/* Sync Success Toast */}
      <AnimatePresence>
        {syncSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            className="rounded-xl px-4 py-2.5 flex items-center gap-2"
            style={{
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.2)',
              boxShadow: '0 0 16px rgba(52,211,153,0.1)',
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </motion.div>
            <span className="text-[10px] font-bold" style={{ color: 'rgba(52,211,153,0.9)' }}>
              DOSAGE SYNCED
            </span>
            <span className="text-[8px] font-mono" style={{ color: 'rgba(52,211,153,0.5)' }}>
              Protocol logged · Bio-Stack updated
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclaimer */}
      <div className="px-1">
        <p className="text-[7px] font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.12)' }}>
          ADVISORY ONLY — Not medical advice. Supplement synergy alerts are generated from biomarker pattern matching against logged protocol adherence. Consult a physician before adjusting any supplement regimen.
        </p>
      </div>
    </div>
  );
}

export default SupplementSynergyHUD;
