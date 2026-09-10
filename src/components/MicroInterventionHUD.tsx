import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'
import SomaticFeedback from './SomaticFeedback'

/* ══════════════════════════════════════════════════════════════
   DAILY FOCUS OVERLAY — with Optimistic Updates
   
   All mutation calls now use optimistic local state so the UI
   responds instantly (0ms perceived latency). Server confirmation
   happens in the background; rollback on error.
   ══════════════════════════════════════════════════════════════ */

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceElevated: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  electricBlue: '#3B82F6',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.06)',
}

const SEVERITY_CONFIG = {
  critical: { color: '#FF6B6B', glow: 'rgba(255,107,107,0.25)', label: 'CRITICAL', pulseSpeed: '1.2s' },
  high: { color: '#E8976C', glow: 'rgba(232,151,108,0.2)', label: 'HIGH', pulseSpeed: '1.8s' },
  moderate: { color: '#3B82F6', glow: 'rgba(59,130,246,0.15)', label: 'MODERATE', pulseSpeed: '2.5s' },
  warning: { color: '#E8976C', glow: 'rgba(232,151,108,0.2)', label: 'WARNING', pulseSpeed: '1.8s' },
  watch: { color: '#3B82F6', glow: 'rgba(59,130,246,0.15)', label: 'WATCH', pulseSpeed: '2.5s' },
} as const

type SeverityKey = keyof typeof SEVERITY_CONFIG

/* ── Ghost State Shimmer — replaces blank loading states ── */
function GhostShimmer() {
  return (
    <div style={{
      position: 'fixed', top: 12, left: 12, zIndex: 9998, pointerEvents: 'auto',
    }}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          width: 44, height: 44, borderRadius: '50%',
          background: CC.surface,
          border: `1.5px solid ${CC.accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          position: 'relative', overflow: 'visible',
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            border: `1.5px solid ${CC.accent}`, pointerEvents: 'none',
          }}
        />
        <span style={{ fontSize: 16, lineHeight: 1 }}>🛡️</span>
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', bottom: -14, left: '50%',
            transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
            letterSpacing: '0.1em', color: CC.accent,
          }}
        >
          SYNCING
        </motion.div>
      </motion.div>
    </div>
  )
}

/* ── Drift Beacon ── */
function DriftBeacon({ driftCount, worstSeverity, isExpanded, onClick }: {
  driftCount: number; worstSeverity: SeverityKey; isExpanded: boolean; onClick: () => void
}) {
  const config = SEVERITY_CONFIG[worstSeverity] || SEVERITY_CONFIG.moderate
  return (
    <motion.button
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.9 }}
      style={{
        position: 'relative', width: 44, height: 44, borderRadius: '50%',
        background: CC.surface, border: `1.5px solid ${config.color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', overflow: 'visible',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: parseFloat(config.pulseSpeed), repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${config.color}`, pointerEvents: 'none' }}
      />
      <motion.div
        animate={{ scale: [1, 2, 1], opacity: [0.2, 0, 0.2] }}
        transition={{ duration: parseFloat(config.pulseSpeed) * 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1px solid ${config.color}`, pointerEvents: 'none' }}
      />
      <span style={{ fontSize: 18, lineHeight: 1 }}>{worstSeverity === 'critical' ? '⚠️' : '🛡️'}</span>
      {driftCount > 0 && (
        <div style={{
          position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%',
          background: config.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, color: '#000', fontFamily: 'monospace',
          boxShadow: `0 0 8px ${config.glow}`,
        }}>{driftCount}</div>
      )}
      <motion.div
        animate={{ rotate: isExpanded ? 180 : 0 }}
        style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: config.color, opacity: 0.6 }}
      >▲</motion.div>
    </motion.button>
  )
}

/* ── Intervention Card with optimistic accept/dismiss ── */
function InterventionCard({ intervention, index, onAccept, onDismiss, isProcessing, isOptimisticallyAccepted }: {
  intervention: {
    metric: string; template: { interventionType: string; title: string; subtitle: string; description: string; icon: string; durationMinutes: number; accentColor: string };
    deviationPct: number; currentValue: number; baselineValue: number; priority: string; alreadyActive: boolean;
  }; index: number; onAccept: () => void; onDismiss: () => void; isProcessing: boolean; isOptimisticallyAccepted?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const severityKey = (intervention.priority === 'critical' ? 'critical' : intervention.priority === 'high' ? 'high' : 'moderate') as SeverityKey
  const config = SEVERITY_CONFIG[severityKey]
  const t = intervention.template
  const isActive = intervention.alreadyActive || isOptimisticallyAccepted

  const metricLabels: Record<string, string> = { hrv: 'HRV', sleepScore: 'Sleep Quality', recovery: 'Recovery', restingHR: 'Resting HR', compound: 'Multi-Metric' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      style={{
        background: CC.surfaceElevated, borderRadius: 16,
        border: `1px solid ${t.accentColor}20`, overflow: 'hidden',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${t.accentColor}, ${t.accentColor}00)` }} />
      <div onClick={() => setIsExpanded(!isExpanded)} style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: `${t.accentColor}12`,
          border: `1px solid ${t.accentColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0, boxShadow: `0 0 12px ${t.accentColor}15`,
        }}>{t.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 8, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.1em', color: config.color, background: `${config.color}15`, padding: '2px 6px', borderRadius: 4, lineHeight: 1.4 }}>{config.label}</span>
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.05em' }}>{metricLabels[intervention.metric] || intervention.metric}</span>
            {isActive && <span style={{ fontSize: 7, fontFamily: 'monospace', color: CC.green, background: `${CC.green}15`, padding: '1px 5px', borderRadius: 3 }}>ACTIVE</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: CC.text, lineHeight: 1.3, marginBottom: 2 }}>{t.title}</div>
          <div style={{ fontSize: 10, color: CC.textSec, lineHeight: 1.3 }}>{t.subtitle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.abs(intervention.deviationPct))}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: '100%', background: `linear-gradient(90deg, ${config.color}, ${config.color}80)`, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: config.color, whiteSpace: 'nowrap' }}>{Math.abs(intervention.deviationPct).toFixed(1)}% drift</span>
          </div>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ color: CC.textTer, fontSize: 10, marginTop: 4, flexShrink: 0 }}>▼</motion.div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${CC.border}`, paddingTop: 12 }}>
              <p style={{ fontSize: 11, color: CC.textSec, lineHeight: 1.55, margin: '0 0 12px' }}>{t.description}</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, marginBottom: 3, letterSpacing: '0.05em' }}>CURRENT</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: config.color, fontFamily: 'monospace' }}>{intervention.currentValue.toFixed(intervention.currentValue < 10 ? 1 : 0)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', color: CC.textTer, fontSize: 12 }}>→</div>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, marginBottom: 3, letterSpacing: '0.05em' }}>BASELINE</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: CC.green, fontFamily: 'monospace' }}>{intervention.baselineValue.toFixed(intervention.baselineValue < 10 ? 1 : 0)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {t.durationMinutes > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textTer, background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 6 }}>⏱ {t.durationMinutes}min</span>}
                <div style={{ flex: 1 }} />
                <motion.button whileTap={{ scale: 0.92 }} onClick={(e) => { e.stopPropagation(); onDismiss() }} disabled={isProcessing}
                  style={{ padding: '6px 14px', fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: CC.textSec, background: 'rgba(255,255,255,0.05)', border: `1px solid ${CC.border}`, borderRadius: 8, cursor: 'pointer', letterSpacing: '0.03em', opacity: isProcessing ? 0.5 : 1 }}
                >SKIP</motion.button>
                <motion.button whileTap={{ scale: 0.92 }} onClick={(e) => { e.stopPropagation(); onAccept() }} disabled={isProcessing || isActive}
                  style={{
                    padding: '6px 16px', fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: '#000',
                    background: isActive ? `${CC.green}40` : `linear-gradient(135deg, ${t.accentColor}, ${t.accentColor}CC)`,
                    border: 'none', borderRadius: 8, cursor: isActive ? 'default' : 'pointer',
                    letterSpacing: '0.05em', boxShadow: isActive ? 'none' : `0 2px 12px ${t.accentColor}30`,
                    opacity: isProcessing ? 0.5 : 1,
                  }}
                >{isActive ? '✓ ACTIVE' : 'ACCEPT'}</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Active Intervention Pill ── */
function ActiveInterventionPill({ intervention }: {
  intervention: { _id: string; title: string; icon: string; accentColor: string; durationMinutes: number; status: string; createdAt: number; expiresAt: number }
}) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, intervention.expiresAt - Date.now())
      const hrs = Math.floor(remaining / 3600000)
      const mins = Math.floor((remaining % 3600000) / 60000)
      setTimeLeft(hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`)
    }
    update()
    const iv = setInterval(update, 60000)
    return () => clearInterval(iv)
  }, [intervention.expiresAt])

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: `${intervention.accentColor}08`, borderRadius: 10, border: `1px solid ${intervention.accentColor}15` }}
    >
      <span style={{ fontSize: 14 }}>{intervention.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: CC.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{intervention.title}</div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: intervention.accentColor, opacity: 0.7 }}>
          {intervention.status === 'accepted' ? '⏳ Working on it' : '🟢 Active'} · {timeLeft} left
        </div>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT — Daily Focus with Optimistic Updates
   ══════════════════════════════════════════════════════════════ */

export default function MicroInterventionHUD() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  let driftDataRaw: any = undefined
  let dynamicDataRaw: any = undefined
  try { driftDataRaw = useQuery(api.protocolDrift.detectProtocolDrift, sessionId ? { sessionId } : "skip") } catch (_e) { driftDataRaw = null }
  try { dynamicDataRaw = useQuery(api.dynamicInterventions.getInterventionRecommendations, sessionId ? { sessionId } : "skip") } catch (_e) { dynamicDataRaw = null }

  const driftData = driftDataRaw ?? undefined
  const dynamicData = dynamicDataRaw ?? undefined

  if (!driftData && driftDataRaw === null) return null

  const insertMicro = useMutation(api.protocolDrift.insertMicroIntervention)
  const commitDrift = useMutation(api.protocolDrift.commitDriftEvent)
  const insertDynamic = useMutation(api.dynamicInterventions.insertIntervention)
  const dismissDynamic = useMutation(api.dynamicInterventions.dismissIntervention)

  const [isExpanded, setIsExpanded] = useState(false)
  const [showSomatic, setShowSomatic] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [dismissedMetrics, setDismissedMetrics] = useState<Set<string>>(new Set())
  // Optimistic: track locally accepted interventions before server confirms
  const [optimisticAccepted, setOptimisticAccepted] = useState<Set<string>>(new Set())
  const [optimisticDismissedDynamic, setOptimisticDismissedDynamic] = useState<Set<string>>(new Set())
  const committedRef = useRef<Set<string>>(new Set())

  // Auto-commit drift events
  useEffect(() => {
    if (!driftData?.driftSignals) return
    for (const signal of driftData.driftSignals) {
      const key = `${signal.metric}-${Math.round(signal.deviationPct)}`
      if (committedRef.current.has(key)) continue
      committedRef.current.add(key)
      commitDrift({
        sessionId, metric: signal.metric, currentValue: signal.currentValue,
        baselineValue: signal.baselineValue, deviationPct: signal.deviationPct,
        severity: signal.severity, triggerRule: signal.triggerRule,
        interventionGenerated: (driftData.suggestedInterventions?.length ?? 0) > 0,
      }).catch(() => {})
    }
  }, [driftData?.driftSignals, sessionId, commitDrift, driftData?.suggestedInterventions?.length])

  const isCalibrating = driftData === undefined || driftData?.calibrating === true
  const isDriftError = driftData === null

  const allSuggestions = (driftData?.suggestedInterventions ?? []).filter(
    (s: any) => s && !dismissedMetrics.has(s.metric)
  )
  const dynamicRecs = (dynamicData?.recommendations ?? []).filter(
    (r: any) => !optimisticDismissedDynamic.has(r.id)
  ).slice(0, 2)
  const activeInterventions = driftData?.activeInterventions ?? []
  const totalAlerts = allSuggestions.length + dynamicRecs.length + activeInterventions.length

  const worstSeverity: SeverityKey = allSuggestions.some((s: any) => s.priority === 'critical') || dynamicData?.hasCritical
    ? 'critical' : allSuggestions.some((s: any) => s.priority === 'high') || dynamicData?.hasWarning ? 'high' : 'moderate'

  // ── OPTIMISTIC Accept: show as active immediately, fire mutation in background ──
  const handleAcceptDrift = useCallback(async (suggestion: typeof allSuggestions[0]) => {
    const key = suggestion.metric
    // Optimistic: mark as accepted instantly
    setOptimisticAccepted(prev => new Set(prev).add(key))
    setProcessingIds(prev => new Set(prev).add(key))

    // Emit coherence pulse for visual feedback
    try { window.dispatchEvent(new CustomEvent('vive-coherence-pulse', { detail: { type: 'coherence', source: 'intervention-accept' } })) } catch {}

    try {
      await insertMicro({
        sessionId, driftMetric: suggestion.metric,
        interventionType: suggestion.template.interventionType,
        title: suggestion.template.title, subtitle: suggestion.template.subtitle,
        description: suggestion.template.description, icon: suggestion.template.icon,
        durationMinutes: suggestion.template.durationMinutes, priority: suggestion.priority,
        accentColor: suggestion.template.accentColor, deviationPct: suggestion.deviationPct,
        currentValue: suggestion.currentValue, baselineValue: suggestion.baselineValue,
        ttlHours: suggestion.template.ttlHours,
      })
    } catch (e) {
      // Rollback optimistic state on error
      setOptimisticAccepted(prev => { const n = new Set(prev); n.delete(key); return n })
      console.error('[MicroIntervention] Accept failed:', e)
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [sessionId, insertMicro])

  // ── OPTIMISTIC Dismiss: remove from view instantly ──
  const handleDismissDrift = useCallback((metric: string) => {
    setDismissedMetrics(prev => new Set(prev).add(metric))
  }, [])

  // ── OPTIMISTIC Accept Dynamic: instant feedback ──
  const handleAcceptDynamic = useCallback(async (rec: typeof dynamicRecs[0]) => {
    const key = rec.id
    setOptimisticAccepted(prev => new Set(prev).add(key))
    setProcessingIds(prev => new Set(prev).add(key))
    try { window.dispatchEvent(new CustomEvent('vive-coherence-pulse', { detail: { type: 'coherence', source: 'dynamic-accept' } })) } catch {}
    try {
      await insertDynamic({ sessionId, interventionId: rec.id, name: rec.name, category: rec.category, icon: rec.icon, description: rec.description, timeOfDay: rec.timeOfDay, rationale: rec.rationale })
    } catch (e) {
      setOptimisticAccepted(prev => { const n = new Set(prev); n.delete(key); return n })
      console.error('[DynamicIntervention] Insert failed:', e)
    } finally {
      setProcessingIds(prev => { const n = new Set(prev); n.delete(key); return n })
    }
  }, [sessionId, insertDynamic])

  // ── OPTIMISTIC Dismiss Dynamic: remove from view instantly, fire mutation in background ──
  const handleDismissDynamic = useCallback(async (rec: typeof dynamicRecs[0]) => {
    setOptimisticDismissedDynamic(prev => new Set(prev).add(rec.id))
    try {
      await dismissDynamic({ sessionId, interventionId: rec.id, name: rec.name })
    } catch (e) {
      // Rollback: re-show the dismissed item
      setOptimisticDismissedDynamic(prev => { const n = new Set(prev); n.delete(rec.id); return n })
      console.error('[DynamicIntervention] Dismiss failed:', e)
    }
  }, [sessionId, dismissDynamic])

  if (totalAlerts === 0 && !driftData?.hasActiveDrift && !isCalibrating) return null

  // Ghost State shimmer during loading/calibrating
  if (isCalibrating || isDriftError) return <GhostShimmer />

  return (
    <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, maxWidth: 340, pointerEvents: 'auto' }}>
      <AnimatePresence>
        {totalAlerts > 0 && (
          <DriftBeacon driftCount={allSuggestions.length + dynamicRecs.length} worstSeverity={worstSeverity} isExpanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.95 }} transition={{ duration: 0.25 }}
            style={{ width: 320, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, scrollbarWidth: 'none' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: CC.surface, borderRadius: 12, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid ${CC.border}` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_CONFIG[worstSeverity].color, boxShadow: `0 0 8px ${SEVERITY_CONFIG[worstSeverity].glow}` }} />
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.1em', color: CC.text }}>DAILY FOCUS</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>{driftData?.recentDriftCount ?? 0} events / 24h</span>
            </div>

            {/* Drift Signal Summary */}
            {driftData?.driftSignals && driftData.driftSignals.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 2px' }}>
                {driftData.driftSignals.map((signal: any, i: number) => {
                  const sev = SEVERITY_CONFIG[signal.severity as SeverityKey] || SEVERITY_CONFIG.moderate
                  return (
                    <motion.div key={signal.metric} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: `${sev.color}10`, borderRadius: 6, border: `1px solid ${sev.color}20` }}
                    >
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: sev.color }} />
                      <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: sev.color }}>{signal.triggerRule}</span>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* Drift Intervention Cards — with optimistic accept state */}
            {allSuggestions.map((suggestion: any, i: number) => (
              <InterventionCard
                key={`drift-${suggestion.metric}`}
                intervention={suggestion}
                index={i}
                onAccept={() => handleAcceptDrift(suggestion)}
                onDismiss={() => handleDismissDrift(suggestion.metric)}
                isProcessing={processingIds.has(suggestion.metric)}
                isOptimisticallyAccepted={optimisticAccepted.has(suggestion.metric)}
              />
            ))}

            {/* Dynamic Intervention Cards */}
            {dynamicRecs.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px 0' }}>
                  <div style={{ height: 1, flex: 1, background: CC.border }} />
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.08em' }}>TIPS · NEXT 48 HOURS</span>
                  <div style={{ height: 1, flex: 1, background: CC.border }} />
                </div>
                {dynamicRecs.map((rec: any, i: number) => (
                  <InterventionCard
                    key={`dynamic-${rec.id}`}
                    intervention={{
                      metric: rec.triggers?.[0]?.metric ?? 'recovery',
                      template: {
                        interventionType: rec.category, title: rec.name, subtitle: rec.description,
                        description: rec.rationale, icon: rec.icon, durationMinutes: rec.durationMin,
                        accentColor: rec.category === 'supplement' ? CC.orange : rec.category === 'biohacking' ? CC.accent : CC.electricBlue,
                      },
                      deviationPct: rec.urgencyScore ? -(rec.urgencyScore / 10) : -15,
                      currentValue: rec.matchedDeclines?.[0]?.currentValue ?? 0,
                      baselineValue: rec.matchedDeclines?.[0]?.projected48h ?? 0,
                      priority: rec.urgencyScore > 120 ? 'critical' : rec.urgencyScore > 80 ? 'high' : 'moderate',
                      alreadyActive: false,
                    }}
                    index={allSuggestions.length + i}
                    onAccept={() => handleAcceptDynamic(rec)}
                    onDismiss={() => handleDismissDynamic(rec)}
                    isProcessing={processingIds.has(rec.id)}
                    isOptimisticallyAccepted={optimisticAccepted.has(rec.id)}
                  />
                ))}
              </>
            )}

            {/* Active Interventions */}
            {activeInterventions.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px 0' }}>
                  <div style={{ height: 1, flex: 1, background: CC.border }} />
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.green, letterSpacing: '0.08em' }}>IN PROGRESS</span>
                  <div style={{ height: 1, flex: 1, background: CC.border }} />
                </div>
                {activeInterventions.map((ai: any) => <ActiveInterventionPill key={ai._id} intervention={ai} />)}
              </>
            )}

            {/* Adherence context */}
            {dynamicData?.adherenceContext && (
              <div style={{
                padding: '6px 10px', background: dynamicData.adherenceContext.isLow ? `${CC.red}08` : `${CC.green}08`,
                borderRadius: 8, border: `1px solid ${dynamicData.adherenceContext.isLow ? CC.red : CC.green}12`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 12 }}>{dynamicData.adherenceContext.isLow ? '📉' : '📈'}</span>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec }}>
                  7-day adherence: <span style={{ fontWeight: 800, color: dynamicData.adherenceContext.isLow ? CC.red : CC.green }}>{dynamicData.adherenceContext.avg7d}%</span>
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Somatic Feedback Toggle */}
      <AnimatePresence>
        {!showSomatic && (
          <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} whileTap={{ scale: 0.9 }}
            onClick={() => setShowSomatic(true)}
            style={{ width: 40, height: 40, borderRadius: '50%', background: CC.surface, border: '1.5px solid #A78BFA30', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', fontSize: 16, position: 'relative' }}
          >
            🫀
            <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 6, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em', color: '#A78BFA', opacity: 0.6 }}>BODY</div>
          </motion.button>
        )}
      </AnimatePresence>

      <SomaticFeedback isVisible={showSomatic} onClose={() => setShowSomatic(false)} />
    </div>
  )
}
