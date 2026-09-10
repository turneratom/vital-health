import { useState, useCallback } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

const CC = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  amberBorder: 'rgba(245,158,11,0.25)',
  red: '#EF4444',
  redGlow: 'rgba(239,68,68,0.15)',
  redBorder: 'rgba(239,68,68,0.25)',
  green: '#10B981',
  border: 'rgba(255,255,255,0.05)',
}

interface LowStockAlertProps {
  onAlertStateChange?: (hasCritical: boolean, hasAny: boolean) => void
}

export default function LowStockAlert({ onAlertStateChange }: LowStockAlertProps) {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  const systemAlerts = useQuery(api.inventory.getSystemAlerts, { sessionId })
  const quickReorder = useMutation(api.inventory.quickReorder)

  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [reorderResult, setReorderResult] = useState<{ id: string; message: string } | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Notify parent about alert state for ViveButton amber pulse
  const hasCritical = systemAlerts?.hasCritical ?? false
  const hasAny = (systemAlerts?.totalAlerts ?? 0) > 0

  // Use a ref-like pattern to avoid re-render loops
  if (onAlertStateChange) {
    try { onAlertStateChange(hasCritical, hasAny) } catch {}
  }

  const handleQuickReorder = useCallback(async (itemId: string) => {
    setReorderingId(itemId)
    try {
      const result = await quickReorder({ id: itemId as any })
      setReorderResult({
        id: itemId,
        message: `${result.itemName} reorder placed — ${result.estimatedDelivery}`,
      })
      if (result.reorderUrl) {
        window.open(result.reorderUrl, '_blank', 'noopener')
      }
      setTimeout(() => setReorderResult(null), 4000)
    } catch (err: any) {
      setReorderResult({ id: itemId, message: err?.message || 'Reorder failed' })
      setTimeout(() => setReorderResult(null), 3000)
    } finally {
      setReorderingId(null)
    }
  }, [quickReorder])

  if (!systemAlerts || systemAlerts.totalAlerts === 0) return null

  const alerts = systemAlerts.alerts
  const criticalAlerts = alerts.filter(a => a.severity === 'critical')
  const warningAlerts = alerts.filter(a => a.severity === 'warning')
  const displayAlerts = expanded ? alerts : alerts.slice(0, 2)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      style={{
        margin: '0 16px',
        borderRadius: 16,
        overflow: 'hidden',
        background: hasCritical
          ? `linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(14,14,18,0.9) 100%)`
          : `linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(14,14,18,0.9) 100%)`,
        border: `1px solid ${hasCritical ? CC.redBorder : CC.amberBorder}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        {/* Pulsing indicator */}
        <div style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: hasCritical ? CC.redGlow : CC.amberGlow,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${hasCritical ? CC.redBorder : CC.amberBorder}`,
          }}>
            <span style={{ fontSize: 13 }}>{hasCritical ? '⚠️' : '📦'}</span>
          </div>
          <div style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            border: `1.5px solid ${hasCritical ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
            animation: 'lowStockPulse 2s ease-in-out infinite',
          }} />
        </div>

        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{
            fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
            color: hasCritical ? CC.red : CC.amber,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {hasCritical ? 'Low Supply Alert' : 'Supply Check'}
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'monospace', color: CC.textSec, marginTop: 1,
          }}>
            {criticalAlerts.length > 0 && `${criticalAlerts.length} critical`}
            {criticalAlerts.length > 0 && warningAlerts.length > 0 && ' · '}
            {warningAlerts.length > 0 && `${warningAlerts.length} low`}
          </div>
        </div>

        {/* Expand chevron */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: CC.textTer, fontSize: 14 }}
        >
          ▾
        </motion.div>
      </button>

      {/* Alert items */}
      <AnimatePresence>
        {displayAlerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            style={{
              padding: '0 14px',
              borderTop: `1px solid ${CC.border}`,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0',
            }}>
              {/* Item icon */}
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: alert.severity === 'critical'
                  ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
                border: `1px solid ${alert.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`,
              }}>
                {alert.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: CC.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {alert.itemName}
                </div>
                <div style={{
                  fontSize: 9, fontFamily: 'monospace', marginTop: 1,
                  color: alert.severity === 'critical' ? CC.red : CC.amber,
                }}>
                  {alert.status === 'reorder_pending'
                    ? '📬 Reorder in transit'
                    : alert.daysRemaining <= 0
                      ? '🔴 Depleted'
                      : `${alert.daysRemaining}d remaining · ${alert.currentQuantity} ${alert.unit} left`
                  }
                </div>
              </div>

              {/* Quick Reorder button */}
              {alert.status !== 'reorder_pending' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleQuickReorder(alert.id) }}
                  disabled={reorderingId === alert.id}
                  style={{
                    padding: '5px 10px', borderRadius: 8, border: 'none',
                    fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    cursor: reorderingId === alert.id ? 'wait' : 'pointer',
                    color: '#fff',
                    background: alert.severity === 'critical'
                      ? 'linear-gradient(135deg, rgba(239,68,68,0.8), rgba(220,38,38,0.9))'
                      : 'linear-gradient(135deg, rgba(245,158,11,0.8), rgba(217,119,6,0.9))',
                    boxShadow: alert.severity === 'critical'
                      ? '0 2px 8px rgba(239,68,68,0.3)' : '0 2px 8px rgba(245,158,11,0.3)',
                    opacity: reorderingId === alert.id ? 0.6 : 1,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {reorderingId === alert.id ? '...' : 'Reorder'}
                </button>
              )}

              {alert.status === 'reorder_pending' && (
                <div style={{
                  padding: '5px 10px', borderRadius: 8,
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                  color: CC.green, background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  Ordered ✓
                </div>
              )}
            </div>

            {/* Reorder result toast */}
            <AnimatePresence>
              {reorderResult?.id === alert.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    fontSize: 9, fontFamily: 'monospace', color: CC.green,
                    padding: '0 0 8px', lineHeight: 1.4,
                  }}
                >
                  ✅ {reorderResult.message}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Show more / less */}
      {alerts.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%', padding: '8px 14px',
            background: 'none', border: 'none', borderTop: `1px solid ${CC.border}`,
            fontSize: 9, fontFamily: 'monospace', color: CC.textTer,
            cursor: 'pointer', textAlign: 'center',
            letterSpacing: '0.05em',
          }}
        >
          {expanded ? 'Show less' : `+${alerts.length - 2} more alerts`}
        </button>
      )}

      <style>{`
        @keyframes lowStockPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
      `}</style>
    </motion.div>
  )
}

// Hook for other components to check low-stock state
export function useLowStockState() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'
  const data = useQuery(api.inventory.getSystemAlerts, { sessionId })
  return {
    hasCritical: data?.hasCritical ?? false,
    hasWarning: data?.hasWarning ?? false,
    totalAlerts: data?.totalAlerts ?? 0,
  }
}
