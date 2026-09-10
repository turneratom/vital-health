import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   SENSOR STATUS — Hardware-Agnostic Device Footer
   
   Three sensor icons: Oura, Whoop, Apple Health.
   Tap to sync → "Syncing..." pulse → "Data Current" or retry.
   Terminal log panel shows connection phases.
   Persistent state via localStorage (24h TTL).
   ═══════════════════════════════════════════════════════════════ */

const T = {
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  teal: '#00FFCC',
  tealGlow: 'rgba(0,255,204,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.15)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.15)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.15)',
  blue: '#3B82F6',
  border: 'rgba(255,255,255,0.05)',
}

type SyncState = 'idle' | 'syncing' | 'connected' | 'failed'

interface SensorDef {
  id: string
  name: string
  icon: string
  color: string
  glow: string
  cmd: string
}

const SENSORS: SensorDef[] = [
  { id: 'oura', name: 'Oura Ring', icon: '💍', color: '#C4A46C', glow: 'rgba(196,164,108,0.15)', cmd: 'vive connect --device oura-ring-4' },
  { id: 'whoop', name: 'WHOOP 4.0', icon: '⌚', color: '#00DC82', glow: 'rgba(0,220,130,0.15)', cmd: 'vive connect --device whoop-4.0' },
  { id: 'apple', name: 'Apple Health', icon: '🍎', color: '#FF6B6B', glow: 'rgba(255,107,107,0.15)', cmd: 'vive connect --device apple-healthkit' },
]

const SYNC_PHASES = [
  { text: 'Establishing secure handshake...', delay: 400 },
  { text: 'Authenticating device token...', delay: 800 },
  { text: 'Pulling biometric payload...', delay: 1400 },
  { text: 'Validating data integrity...', delay: 1900 },
]

function getStoredState(id: string): { state: SyncState; syncedAt: number | null } {
  try {
    const raw = localStorage.getItem(`vive-sensor-${id}`)
    if (!raw) return { state: 'idle', syncedAt: null }
    const parsed = JSON.parse(raw)
    // 24h TTL
    if (parsed.syncedAt && Date.now() - parsed.syncedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`vive-sensor-${id}`)
      return { state: 'idle', syncedAt: null }
    }
    return parsed
  } catch { return { state: 'idle', syncedAt: null } }
}

function storeState(id: string, state: SyncState) {
  try {
    localStorage.setItem(`vive-sensor-${id}`, JSON.stringify({
      state, syncedAt: state === 'connected' ? Date.now() : null,
    }))
  } catch {}
}

function relativeTime(ts: number | null): string {
  if (!ts) return ''
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function SensorChip({ sensor }: { sensor: SensorDef }) {
  const stored = getStoredState(sensor.id)
  const [syncState, setSyncState] = useState<SyncState>(stored.state)
  const [syncedAt, setSyncedAt] = useState<number | null>(stored.syncedAt)
  const [logLines, setLogLines] = useState<string[]>([])
  const [showLog, setShowLog] = useState(false)

  const handleSync = useCallback(() => {
    if (syncState === 'syncing') return
    setSyncState('syncing')
    setShowLog(true)
    setLogLines([`$ ${sensor.cmd}`])

    SYNC_PHASES.forEach((phase, i) => {
      setTimeout(() => {
        setLogLines(prev => [...prev, `  → ${phase.text}`])
      }, phase.delay)
    })

    // ~15% failure rate for realism
    const willFail = Math.random() < 0.15
    setTimeout(() => {
      if (willFail) {
        setLogLines(prev => [...prev, '  ✗ Connection timeout. Tap to retry.'])
        setSyncState('failed')
        storeState(sensor.id, 'failed')
      } else {
        setLogLines(prev => [...prev, '  ✓ Sync complete. Data current.'])
        setSyncState('connected')
        setSyncedAt(Date.now())
        storeState(sensor.id, 'connected')
        setTimeout(() => setShowLog(false), 2000)
      }
    }, 2400)
  }, [syncState, sensor])

  const statusColor = syncState === 'connected' ? T.green
    : syncState === 'syncing' ? T.amber
    : syncState === 'failed' ? T.red
    : T.textTer

  const statusLabel = syncState === 'connected' ? 'DATA CURRENT'
    : syncState === 'syncing' ? 'SYNCING...'
    : syncState === 'failed' ? 'TAP TO RETRY'
    : 'TAP TO SYNC'

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <motion.button
        onClick={handleSync}
        whileTap={{ scale: 0.95 }}
        style={{
          width: '100%', padding: '10px 8px', borderRadius: 12,
          background: syncState === 'syncing'
            ? `linear-gradient(135deg, ${sensor.glow}, rgba(245,158,11,0.06))`
            : syncState === 'connected'
              ? `linear-gradient(135deg, ${T.greenGlow}, rgba(0,220,130,0.04))`
              : 'rgba(255,255,255,0.03)',
          border: `1px solid ${syncState === 'connected' ? `${T.green}25` : syncState === 'syncing' ? `${T.amber}25` : T.border}`,
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 4, position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pulse ring for syncing */}
        {syncState === 'syncing' && (
          <motion.div
            animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{
              position: 'absolute', inset: 0, borderRadius: 12,
              border: `2px solid ${T.amber}`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Icon */}
        <span style={{ fontSize: 20, lineHeight: 1 }}>{sensor.icon}</span>

        {/* Name */}
        <span style={{
          fontSize: 8, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
          color: T.text, letterSpacing: '0.06em', lineHeight: 1,
        }}>
          {sensor.name}
        </span>

        {/* Status dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: statusColor,
            boxShadow: syncState === 'connected' ? `0 0 6px ${T.greenGlow}` : 'none',
          }}>
            {syncState === 'syncing' && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: T.amber }}
              />
            )}
          </div>
          <span style={{
            fontSize: 7, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
            color: statusColor, letterSpacing: '0.08em',
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Timestamp */}
        {syncState === 'connected' && syncedAt && (
          <span style={{
            fontSize: 7, fontFamily: '"JetBrains Mono", monospace',
            color: T.textTer, letterSpacing: '0.05em',
          }}>
            {relativeTime(syncedAt)}
          </span>
        )}
      </motion.button>

      {/* Terminal Log */}
      <AnimatePresence>
        {showLog && logLines.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              overflow: 'hidden', marginTop: 4, borderRadius: 8,
              background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.border}`,
              padding: '6px 8px',
            }}
          >
            {logLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 7, fontFamily: '"JetBrains Mono", monospace',
                color: line.includes('✓') ? T.green : line.includes('✗') ? T.red : T.textSec,
                lineHeight: 1.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {line}
              </div>
            ))}
            {syncState === 'syncing' && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ fontSize: 8, color: T.amber, fontFamily: 'monospace' }}
              >
                █
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function SensorStatus() {
  const connectedCount = SENSORS.reduce((count, s) => {
    const stored = getStoredState(s.id)
    return count + (stored.state === 'connected' ? 1 : 0)
  }, 0)

  const statusColor = connectedCount === 3 ? T.green : connectedCount > 0 ? T.amber : T.textTer

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
            color: T.blue, letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            SENSOR ARRAY
          </span>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: statusColor,
            boxShadow: connectedCount > 0 ? `0 0 6px ${statusColor}` : 'none',
          }} />
        </div>
        <span style={{
          fontSize: 8, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600,
          color: statusColor, letterSpacing: '0.08em',
        }}>
          {connectedCount}/3 LINKED
        </span>
      </div>

      {/* Sensor Chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        {SENSORS.map(sensor => (
          <SensorChip key={sensor.id} sensor={sensor} />
        ))}
      </div>
    </div>
  )
}
