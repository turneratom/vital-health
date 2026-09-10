import { memo } from 'react'
import { motion } from 'framer-motion'

/* ══════════════════════════════════════════════════════════════
   GHOST STATE — Shimmer skeleton for all data loads
   
   Replaces spinners/blank states with a biologically-alive
   shimmer that makes the UI feel like it's "breathing" while
   data resolves. Never shows a blank screen.
   ══════════════════════════════════════════════════════════════ */

const CC = {
  surface: 'rgba(14,14,18,0.85)',
  border: 'rgba(255,255,255,0.04)',
  shimmerBase: 'rgba(59,130,246,0.03)',
  shimmerPeak: 'rgba(59,130,246,0.08)',
  textGhost: 'rgba(255,255,255,0.06)',
}

interface GhostStateProps {
  /** Number of skeleton rows to show */
  rows?: number
  /** Height of the ghost container */
  height?: number | string
  /** Variant: 'card' | 'inline' | 'metric' | 'list' */
  variant?: 'card' | 'inline' | 'metric' | 'list'
  /** Optional label shown during ghost state */
  label?: string
}

function GhostBar({ width, height = 10, delay = 0 }: { width: string; height?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.3 }}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{
        width,
        height,
        borderRadius: height / 2,
        background: `linear-gradient(90deg, ${CC.shimmerBase}, ${CC.shimmerPeak}, ${CC.shimmerBase})`,
        backgroundSize: '200% 100%',
      }}
    />
  )
}

function GhostMetric({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0.2 }}
      animate={{ opacity: [0.2, 0.5, 0.2] }}
      transition={{ duration: 2.5, repeat: Infinity, delay, ease: 'easeInOut' }}
      style={{
        width: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: CC.shimmerBase,
        border: `1px solid ${CC.border}`,
      }} />
      <GhostBar width="60px" height={6} delay={delay + 0.3} />
      <GhostBar width="40px" height={5} delay={delay + 0.5} />
    </motion.div>
  )
}

function GhostStateComponent({ rows = 3, height, variant = 'card', label }: GhostStateProps) {
  if (variant === 'metric') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 24,
        padding: '20px 16px',
        minHeight: height ?? 120,
      }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <GhostMetric key={i} delay={i * 0.4} />
        ))}
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        minHeight: height ?? 40,
      }}>
        <motion.div
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: CC.shimmerBase,
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <GhostBar width="60%" height={8} />
          <GhostBar width="40%" height={6} delay={0.3} />
        </div>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '12px 16px',
        minHeight: height ?? 'auto',
      }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            background: CC.surface,
            borderRadius: 12,
            border: `1px solid ${CC.border}`,
          }}>
            <motion.div
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: CC.shimmerBase,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <GhostBar width={`${55 + i * 10}%`} height={8} delay={i * 0.15} />
              <GhostBar width={`${35 + i * 8}%`} height={6} delay={i * 0.15 + 0.2} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Default: card variant
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: CC.surface,
        borderRadius: 20,
        border: `1px solid ${CC.border}`,
        padding: '20px 16px',
        minHeight: height ?? 160,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Shimmer sweep overlay */}
      <motion.div
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '40%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.04), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Ghost label */}
      {label && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            fontSize: 8,
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'rgba(59,130,246,0.4)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </motion.div>
      )}

      {/* Ghost rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {i === 0 && (
            <motion.div
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.2, ease: 'easeInOut' }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: CC.shimmerBase,
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <GhostBar width={i === 0 ? '70%' : `${45 + i * 12}%`} height={i === 0 ? 10 : 7} delay={i * 0.2} />
            {i < 2 && <GhostBar width={`${30 + i * 15}%`} height={6} delay={i * 0.2 + 0.3} />}
          </div>
        </div>
      ))}
    </motion.div>
  )
}

export const GhostState = memo(GhostStateComponent)
export default GhostState
