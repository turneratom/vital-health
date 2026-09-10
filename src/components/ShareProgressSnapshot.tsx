import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/* ═══════════════════════════════════════════════════════════════
   SHARE PROGRESS SNAPSHOT — Viral Growth Engine
   
   Generates a clean, branded render of the user's Biological Twin
   metrics as a shareable card. Captures key longevity stats into
   a visually compelling format optimized for social sharing.
   ═══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.12)',
  accentGlow: 'rgba(0,255,204,0.30)',
  blue: '#3B82F6',
  blueGlow: 'rgba(59,130,246,0.15)',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  gold: '#FFD700',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

function getSessionId(): string {
  try {
    return localStorage.getItem('vive-session-id') || 'guest-user'
  } catch { return 'guest-user' }
}

/* ── Shareable Card Renderer ── */
function ShareCard({ data, onClose }: {
  data: {
    chronologicalAge: number
    currentBioAge: number
    currentDelta: number
    longevityExtension: number
    confidence: number
    pillarImpact: Array<{ label: string; icon: string; score: number; yearsGained: number; status: string }>
    consistencyMultiplier: number
  }
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const isYounger = data.currentDelta < 0
  const statusColor = isYounger ? T.accent : data.currentDelta < 2 ? T.blue : T.orange

  const handleShare = useCallback(async () => {
    setCapturing(true)
    try {
      // Use native share if available
      if (navigator.share) {
        await navigator.share({
          title: 'My Vive Biological Twin',
          text: `Bio Age: ${data.currentBioAge.toFixed(1)} | Chrono: ${data.chronologicalAge} | +${data.longevityExtension.toFixed(1)} years projected longevity extension via Vive Protocol`,
          url: window.location.origin,
        })
      } else {
        // Fallback: copy text summary
        const text = [
          `🧬 VIVE BIOLOGICAL TWIN`,
          ``,
          `Bio Age: ${data.currentBioAge.toFixed(1)}`,
          `Chrono Age: ${data.chronologicalAge}`,
          `Delta: ${isYounger ? '' : '+'}${data.currentDelta.toFixed(1)} years`,
          `Projected Extension: +${data.longevityExtension.toFixed(1)} years`,
          `Confidence: ${data.confidence}%`,
          ``,
          `Pillar Breakdown:`,
          ...data.pillarImpact.map(p => `  ${p.icon} ${p.label}: +${p.yearsGained}yr (${p.score}%)`),
          ``,
          `Consistency: ${data.consistencyMultiplier}x`,
          ``,
          `Track your biological age → ${window.location.origin}`,
        ].join('\n')
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      }
    } catch {
      // Silent fail
    } finally {
      setCapturing(false)
    }
  }, [data, isYounger])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        ref={cardRef}
        style={{
          width: '100%', maxWidth: 360, borderRadius: 24, overflow: 'hidden',
          background: 'linear-gradient(180deg, #0C0C14 0%, #06060A 100%)',
          border: `1px solid ${T.borderBlue}`,
          boxShadow: `0 0 60px rgba(0,255,204,0.08), 0 20px 60px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 20px 0', position: 'relative',
          background: `radial-gradient(ellipse at top center, ${T.accentGlow} 0%, transparent 60%)`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: T.accent, boxShadow: `0 0 12px ${T.accentGlow}`,
            }} />
            <span style={{
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
              color: T.accent, letterSpacing: '0.2em',
            }}>
              VIVE BIOLOGICAL TWIN
            </span>
          </div>

          {/* Hero Metric */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 48, fontWeight: 800, fontFamily: 'monospace',
                color: T.accent, lineHeight: 1,
                textShadow: `0 0 30px ${T.accentGlow}`,
              }}>
                +{data.longevityExtension.toFixed(1)}
              </div>
              <div style={{
                fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                color: T.accentDim, letterSpacing: '0.15em', marginTop: 4,
              }}>
                YEARS PROJECTED
              </div>
            </div>

            <div style={{ width: 1, height: 56, background: T.borderBlue }} />

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, fontWeight: 600 }}>
                    BIO AGE{' '}
                  </span>
                  <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 800, color: statusColor }}>
                    {data.currentBioAge.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, fontWeight: 600 }}>
                    CHRONO{' '}
                  </span>
                  <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 700, color: T.textSec }}>
                    {data.chronologicalAge}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, fontWeight: 600 }}>
                    DELTA{' '}
                  </span>
                  <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 800, color: statusColor }}>
                    {isYounger ? '' : '+'}{data.currentDelta.toFixed(1)}y
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pillar Breakdown */}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            fontSize: 8, fontFamily: 'monospace', color: T.textTer,
            fontWeight: 600, letterSpacing: '0.12em', marginBottom: 10,
          }}>
            LONGEVITY PILLAR IMPACT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.pillarImpact.slice(0, 5).map((p, i) => {
              const c = p.status === 'optimal' ? T.accent : p.status === 'moderate' ? T.blue : T.orange
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.border}`,
                }}>
                  <span style={{ fontSize: 14, width: 22, textAlign: 'center' }}>{p.icon}</span>
                  <span style={{
                    flex: 1, fontSize: 10, fontFamily: 'monospace',
                    fontWeight: 600, color: T.text,
                  }}>
                    {p.label}
                  </span>
                  <div style={{
                    width: 60, height: 3, borderRadius: 2,
                    background: 'rgba(255,255,255,0.04)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${p.score}%`, height: '100%', borderRadius: 2,
                      background: `linear-gradient(90deg, ${c}88, ${c})`,
                    }} />
                  </div>
                  <span style={{
                    fontSize: 10, fontFamily: 'monospace', fontWeight: 700,
                    color: c, minWidth: 40, textAlign: 'right',
                  }}>
                    +{p.yearsGained}yr
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Consistency Badge */}
        <div style={{
          margin: '0 20px 16px', padding: '8px 12px', borderRadius: 10,
          background: 'rgba(0,255,204,0.04)',
          border: `1px solid ${T.accentDim}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: T.accent, letterSpacing: '0.1em',
          }}>
            ⚡ CONSISTENCY MULTIPLIER
          </span>
          <span style={{
            fontSize: 16, fontFamily: 'monospace', fontWeight: 800,
            color: T.accent,
          }}>
            {data.consistencyMultiplier}x
          </span>
        </div>

        {/* Confidence + Branding */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 8, fontFamily: 'monospace', color: T.textTer,
            letterSpacing: '0.08em',
          }}>
            {data.confidence}% CONFIDENCE · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'monospace', fontWeight: 800,
            color: T.accent, letterSpacing: '0.15em',
          }}>
            VIVE
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 20, width: '100%', maxWidth: 360,
      }}>
        <button
          onClick={handleShare}
          disabled={capturing}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            background: `${T.accent}18`, border: `1px solid ${T.accent}40`,
            color: T.accent, cursor: capturing ? 'wait' : 'pointer',
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', transition: 'all 0.2s',
          }}
        >
          {copied ? '✅ COPIED TO CLIPBOARD' : capturing ? '⏳ PREPARING…' : '📤 SHARE PROGRESS'}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '12px 20px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${T.border}`,
            color: T.textSec, cursor: 'pointer',
            fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
          }}
        >
          CLOSE
        </button>
      </div>
    </motion.div>
  )
}

/* ── Share Button (embedded in BiologicalTwin) ── */
export function ShareProgressButton() {
  const sessionId = getSessionId()
  const data = useQuery(api.biologicalTwin.getBiologicalTwin, { sessionId })
  const [showCard, setShowCard] = useState(false)

  if (!data) return null

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowCard(true) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 6,
          background: 'rgba(0,255,204,0.06)',
          border: `1px solid ${T.accentDim}`,
          color: T.accent, cursor: 'pointer',
          fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
          letterSpacing: '0.1em', transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 10 }}>📤</span>
        SHARE
      </button>

      <AnimatePresence>
        {showCard && (
          <ShareCard data={data} onClose={() => setShowCard(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

export default ShareProgressButton
