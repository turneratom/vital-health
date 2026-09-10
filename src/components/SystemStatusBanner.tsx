import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAction, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.12)',
  orange: '#E8976C',
  orangeGlow: 'rgba(232,151,108,0.12)',
  red: '#FF6B6B',
  redGlow: 'rgba(255,107,107,0.12)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.08)',
  gold: '#C4A46C',
  border: 'rgba(255,255,255,0.05)',
}

const SEVERITY_STYLES = {
  critical: {
    accentColor: T.red,
    glowColor: T.redGlow,
    borderColor: 'rgba(255,107,107,0.2)',
    bgColor: 'rgba(255,107,107,0.04)',
    pulseColor: 'rgba(255,107,107,0.15)',
    label: 'CRITICAL',
  },
  warning: {
    accentColor: T.orange,
    glowColor: T.orangeGlow,
    borderColor: 'rgba(232,151,108,0.2)',
    bgColor: 'rgba(232,151,108,0.04)',
    pulseColor: 'rgba(232,151,108,0.15)',
    label: 'WARNING',
  },
  attention: {
    accentColor: T.gold,
    glowColor: 'rgba(196,164,108,0.12)',
    borderColor: 'rgba(196,164,108,0.15)',
    bgColor: 'rgba(196,164,108,0.03)',
    pulseColor: 'rgba(196,164,108,0.1)',
    label: 'ATTENTION',
  },
  optimal: {
    accentColor: T.green,
    glowColor: T.greenGlow,
    borderColor: 'rgba(0,220,130,0.15)',
    bgColor: 'rgba(0,220,130,0.03)',
    pulseColor: 'rgba(0,220,130,0.1)',
    label: 'NOMINAL',
  },
}

type Severity = keyof typeof SEVERITY_STYLES

interface SystemStatusResult {
  status: string
  severity: Severity
  icon: string
  signals: Array<{
    source: string
    severity: string
    system: string
    detail: string
    value?: number
    unit?: string
  }>
  recommendation: string | null
  generatedAt: number
  source: 'llm' | 'local'
}

export default function SystemStatusBanner() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  const generateStatus = useAction(api.aiContextEngine.generateSystemStatus)
  const bioContext = useQuery(api.aiContextEngine.getBioContext, { sessionId })

  const [result, setResult] = useState<SystemStatusResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const lastGeneratedRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    // Throttle: don't regenerate within 60s
    if (Date.now() - lastGeneratedRef.current < 60000) return
    try {
      setIsLoading(true)
      const res = await generateStatus({ sessionId })
      setResult(res as SystemStatusResult)
      lastGeneratedRef.current = Date.now()
      if (!hasAnimated) setHasAnimated(true)
    } catch (err) {
      console.warn('[SystemStatus] Generation failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [generateStatus, sessionId, hasAnimated])

  // Initial fetch + refresh every 5 minutes
  useEffect(() => {
    fetchStatus()
    intervalRef.current = setInterval(fetchStatus, 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchStatus])

  // Re-fetch when bioContext changes significantly
  useEffect(() => {
    if (bioContext && lastGeneratedRef.current > 0) {
      const timeSinceLast = Date.now() - lastGeneratedRef.current
      if (timeSinceLast > 120000) fetchStatus()
    }
  }, [bioContext, fetchStatus])

  const severity = result?.severity ?? 'optimal'
  const style = SEVERITY_STYLES[severity]
  const statusText = result?.status ?? 'Initializing biological context engine…'
  const signalCount = result?.signals?.length ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      style={{
        margin: '12px 16px 0',
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* Main Status Bar */}
      <motion.div
        onClick={() => signalCount > 0 && setIsExpanded(!isExpanded)}
        style={{
          background: style.bgColor,
          border: `1px solid ${style.borderColor}`,
          borderRadius: 14,
          padding: '10px 14px',
          cursor: signalCount > 0 ? 'pointer' : 'default',
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        whileHover={signalCount > 0 ? { scale: 1.005 } : {}}
        whileTap={signalCount > 0 ? { scale: 0.998 } : {}}
      >
        {/* Subtle pulse animation for critical/warning */}
        {(severity === 'critical' || severity === 'warning') && (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 20% 50%, ${style.pulseColor}, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Top row: severity badge + AI source indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          position: 'relative',
        }}>
          {/* Severity dot */}
          <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: style.accentColor,
              boxShadow: `0 0 8px ${style.accentColor}`,
            }} />
            {(severity === 'critical' || severity === 'warning') && (
              <motion.div
                animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: style.accentColor,
                }}
              />
            )}
          </div>

          {/* Severity label */}
          <span style={{
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: style.accentColor,
            textTransform: 'uppercase',
          }}>
            {style.label}
          </span>

          {/* AI source badge */}
          {result?.source === 'llm' && (
            <span style={{
              fontSize: 8,
              fontFamily: 'monospace',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: T.accent,
              background: T.accentGlow,
              padding: '1px 6px',
              borderRadius: 4,
              border: '1px solid rgba(0,255,204,0.1)',
            }}>
              AI
            </span>
          )}

          {/* Signal count */}
          {signalCount > 0 && (
            <span style={{
              marginLeft: 'auto',
              fontSize: 8,
              fontFamily: 'monospace',
              color: T.textTer,
              letterSpacing: '0.05em',
            }}>
              {signalCount} SIGNAL{signalCount !== 1 ? 'S' : ''} {isExpanded ? '▲' : '▼'}
            </span>
          )}
        </div>

        {/* Status sentence */}
        <div style={{
          fontSize: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 500,
          color: T.text,
          lineHeight: 1.5,
          letterSpacing: '-0.01em',
          position: 'relative',
        }}>
          {isLoading && !result ? (
            <motion.span
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ color: T.textSec }}
            >
              Analyzing biological context…
            </motion.span>
          ) : (
            statusText
          )}
        </div>

        {/* Recommendation line */}
        {result?.recommendation && !isExpanded && (
          <div style={{
            marginTop: 6,
            fontSize: 10,
            fontFamily: 'monospace',
            color: style.accentColor,
            opacity: 0.8,
            lineHeight: 1.4,
          }}>
            ↳ {result.recommendation}
          </div>
        )}
      </motion.div>

      {/* Expanded Signal Details */}
      <AnimatePresence>
        {isExpanded && result?.signals && result.signals.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              marginTop: 4,
              background: 'rgba(14,14,18,0.95)',
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: '10px 12px',
              backdropFilter: 'blur(20px)',
            }}>
              {/* Signal list */}
              <div style={{
                fontSize: 9,
                fontFamily: 'monospace',
                fontWeight: 600,
                color: T.textTer,
                letterSpacing: '0.12em',
                marginBottom: 8,
                textTransform: 'uppercase',
              }}>
                ACTIVE BIOLOGICAL SIGNALS
              </div>

              {result.signals.slice(0, 5).map((signal, i) => {
                const sigStyle = SEVERITY_STYLES[signal.severity as Severity] ?? SEVERITY_STYLES.attention
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '6px 0',
                      borderBottom: i < Math.min(result.signals.length, 5) - 1
                        ? `1px solid ${T.border}`
                        : 'none',
                    }}
                  >
                    {/* Severity dot */}
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: sigStyle.accentColor,
                      marginTop: 4, flexShrink: 0,
                      boxShadow: `0 0 6px ${sigStyle.accentColor}`,
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Source + System */}
                      <div style={{
                        fontSize: 9,
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        color: sigStyle.accentColor,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        marginBottom: 2,
                      }}>
                        {signal.source} · {signal.system}
                      </div>
                      {/* Detail */}
                      <div style={{
                        fontSize: 11,
                        fontFamily: 'Inter, system-ui, sans-serif',
                        color: T.textSec,
                        lineHeight: 1.4,
                      }}>
                        {signal.detail}
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {/* Recommendation */}
              {result.recommendation && (
                <div style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  background: `${style.bgColor}`,
                  border: `1px solid ${style.borderColor}`,
                  borderRadius: 8,
                }}>
                  <div style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: style.accentColor,
                    letterSpacing: '0.1em',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                  }}>
                    RECOMMENDED PROTOCOL
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    color: T.text,
                    lineHeight: 1.5,
                  }}>
                    {result.recommendation}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div style={{
                marginTop: 8,
                fontSize: 8,
                fontFamily: 'monospace',
                color: T.textTer,
                letterSpacing: '0.05em',
                textAlign: 'right',
              }}>
                {result.source === 'llm' ? 'AI-GENERATED' : 'LOCAL ANALYSIS'} · {new Date(result.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
