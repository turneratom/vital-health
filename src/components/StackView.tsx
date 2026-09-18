import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'
import {
  generateStackSynergies,
  matchCompoundToSynergyId,
  type StackSynergy,
  type SynergyItem,
  type BioVaultData,
} from '../../convex/supplementLogic'

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Design Tokens ── */
const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.92)',
  surfaceHover: 'rgba(20,20,28,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.12)',
  accent: '#00FFCC',
  accentGlow: 'rgba(0,255,204,0.08)',
  gold: '#FFD700',
  goldGlow: 'rgba(255,215,0,0.08)',
  goldBorder: 'rgba(255,215,0,0.2)',
  green: '#34D399',
  orange: '#FBBF24',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.1)',
}

const ROLE_COLORS: Record<string, string> = {
  substrate: '#FF6BB5',
  cofactor: '#FBBF24',
  amplifier: '#00FFCC',
  protector: '#60A5FA',
  timing: '#C084FC',
}

const ROLE_ICONS: Record<string, string> = {
  substrate: '🧱',
  cofactor: '🔗',
  amplifier: '⚡',
  protector: '🛡️',
  timing: '⏱️',
}

/* ── Ghost Skeleton ── */
function StackGhost() {
  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{
        height: 14, width: 140, borderRadius: 4,
        background: 'rgba(59,130,246,0.06)',
        animation: 'stack-ghost-pulse 1.8s ease-in-out infinite',
        marginBottom: 16,
      }} />
      {[1, 2].map(i => (
        <div key={i} style={{
          background: T.surface, borderRadius: 16, padding: 16, marginBottom: 12,
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.06)', animation: 'stack-ghost-pulse 1.8s ease-in-out infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: 120, borderRadius: 3, background: 'rgba(59,130,246,0.06)', animation: 'stack-ghost-pulse 1.8s ease-in-out infinite', marginBottom: 6 }} />
              <div style={{ height: 9, width: 80, borderRadius: 3, background: 'rgba(59,130,246,0.04)', animation: 'stack-ghost-pulse 1.8s ease-in-out infinite' }} />
            </div>
          </div>
          {[1, 2].map(j => (
            <div key={j} style={{ height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.02)', marginBottom: 6, animation: 'stack-ghost-pulse 1.8s ease-in-out infinite' }} />
          ))}
        </div>
      ))}
      <style>{`@keyframes stack-ghost-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </div>
  )
}

/* ── Synergy Item Row ── */
function SynergyRow({ item, index, isExpanded }: { item: SynergyItem; index: number; isExpanded: boolean }) {
  const roleColor = ROLE_COLORS[item.role] || T.accent
  const roleIcon = ROLE_ICONS[item.role] || '🔗'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px', borderRadius: 12,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid rgba(255,255,255,0.03)`,
        marginBottom: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Synergy connection line */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, ${roleColor}40, ${roleColor}10)`,
        borderRadius: '0 2px 2px 0',
      }} />

      {/* Icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${roleColor}10`, fontSize: 15,
        border: `1px solid ${roleColor}20`,
      }}>
        {item.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: T.text,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>
            {item.name}
          </span>
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
            color: roleColor, background: `${roleColor}12`,
            padding: '1px 5px', borderRadius: 4, textTransform: 'uppercase',
            fontFamily: 'monospace',
          }}>
            {roleIcon} {item.roleLabel}
          </span>
        </div>
        <div style={{
          fontSize: 10, color: T.blueBright, fontFamily: 'monospace',
          fontWeight: 600, marginBottom: isExpanded ? 4 : 0,
        }}>
          {item.dose} · {item.timing}
        </div>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{
              fontSize: 10, color: T.textSec, lineHeight: 1.5,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {item.reason}
          </motion.div>
        )}
      </div>

      {/* Priority dot */}
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5,
        background: item.priority === 'critical' ? T.red
          : item.priority === 'recommended' ? T.orange
          : T.textTer,
        boxShadow: item.priority === 'critical' ? `0 0 6px ${T.red}60` : 'none',
      }} />
    </motion.div>
  )
}

/* ── Stack Card ── */
function StackCard({ stack, isOpen, onToggle }: {
  stack: StackSynergy
  isOpen: boolean
  onToggle: () => void
}) {
  const borderColor = stack.isFutureBio ? T.goldBorder : T.borderBlue
  const glowColor = stack.isFutureBio ? T.goldGlow : T.blueGlow
  const accentColor = stack.isFutureBio ? T.gold : T.blueBright

  return (
    <motion.div
      layout
      style={{
        background: T.surface,
        borderRadius: 16,
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
        marginBottom: 10,
        boxShadow: isOpen ? `0 4px 24px ${glowColor}` : 'none',
        transition: 'box-shadow 0.3s',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '14px 14px 12px', display: 'flex',
          alignItems: 'center', gap: 10, background: 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Primary compound icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}25`,
          fontSize: 20, position: 'relative',
        }}>
          {stack.primaryIcon}
          {stack.isFutureBio && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              width: 14, height: 14, borderRadius: '50%',
              background: T.gold, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 7, fontWeight: 900, color: '#000',
              boxShadow: `0 0 8px ${T.gold}60`,
            }}>
              F
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: T.text,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              {stack.primaryCompound}
            </span>
            {stack.isFutureBio && (
              <span style={{
                fontSize: 7, fontWeight: 800, letterSpacing: '0.12em',
                color: T.gold, background: `${T.gold}15`,
                padding: '2px 6px', borderRadius: 4,
                textTransform: 'uppercase', fontFamily: 'monospace',
              }}>
                FUTURE BIO
              </span>
            )}
          </div>
          <div style={{
            fontSize: 10, color: T.textSec, fontFamily: 'monospace',
            marginTop: 2,
          }}>
            {stack.primaryCategory} · {stack.synergisticItems.length} synerg{stack.synergisticItems.length === 1 ? 'y' : 'ies'}
          </div>
        </div>

        {/* Confidence + expand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
            color: stack.stackConfidence >= 80 ? T.green : T.orange,
          }}>
            {stack.stackConfidence}%
          </div>
          <div style={{
            fontSize: 12, color: T.textTer,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>
            ▾
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            {/* Mechanism summary */}
            <div style={{
              padding: '0 14px 10px',
              fontSize: 10, color: T.textSec, lineHeight: 1.5,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              borderBottom: `1px solid ${T.border}`,
              marginBottom: 10,
            }}>
              {stack.mechanismSummary}
            </div>

            {/* Synergy items */}
            <div style={{ padding: '0 10px 14px' }}>
              {stack.synergisticItems.map((item, i) => (
                <SynergyRow key={item.id} item={item} index={i} isExpanded={isOpen} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════
   STACK VIEW — Main HUD Component
   Reads active protocols, substance cycles, and prescription
   to identify compounds with synergistic pairings.
   ══════════════════════════════════════════════════════════════ */

export default function StackView() {
  const sessionId = getTwinSessionId()

  const bioVault = useQuery(api.queries.getBioVaultBySession, { sessionId })
  const longevityData = useQuery(api.longevityScore.getLongevityScore, { sessionId })

  const [openStacks, setOpenStacks] = useState<Set<string>>(new Set())
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (bioVault !== undefined || longevityData !== undefined) {
      const t = setTimeout(() => setIsLoaded(true), 200)
      return () => clearTimeout(t)
    }
  }, [bioVault, longevityData])

  // Build vault data for synergy engine
  const vaultData: BioVaultData | null = useMemo(() => {
    if (!bioVault) return null
    return {
      vitaminD: bioVault.vitaminD ?? undefined,
      testosteroneFree: bioVault.testosteroneFree ?? undefined,
      testosteroneTotal: bioVault.testosteroneTotal ?? undefined,
      ferritin: bioVault.ferritin ?? undefined,
      crp: bioVault.crp ?? undefined,
      hba1c: bioVault.hba1c ?? undefined,
      mthfrVariant: bioVault.mthfrVariant ?? false,
      apoe4: bioVault.apoe4 ?? false,
      caffeineSensitivity: bioVault.caffeineSensitivity ?? false,
      preferredProteins: bioVault.preferredProteins ?? '',
      dietaryRestrictions: bioVault.dietaryRestrictions ?? '',
    }
  }, [bioVault])

  // Detect active compounds from prescription + protocol logs
  const stacks: StackSynergy[] = useMemo(() => {
    const activeCompoundIds = new Set<string>()

    // From longevity prescription (peptides and supplements)
    if (longevityData?.prescription) {
      for (const item of longevityData.prescription) {
        const matchId = matchCompoundToSynergyId(item.title)
        if (matchId) activeCompoundIds.add(matchId)
      }
    }

    // Always check for common supplement synergies
    if (longevityData?.prescription) {
      for (const item of longevityData.prescription) {
        if (item.title.toLowerCase().includes('magnesium') && item.title.toLowerCase().includes('threonate')) {
          activeCompoundIds.add('mag-threonate')
        }
        if (item.title.toLowerCase().includes('omega') || item.title.toLowerCase().includes('epa')) {
          activeCompoundIds.add('omega3-epa')
        }
        if (item.title.toLowerCase().includes('creatine')) {
          activeCompoundIds.add('creatine')
        }
      }
    }

    // If no compounds detected from prescription, show demo stacks based on bio-vault
    if (activeCompoundIds.size === 0) {
      // Show relevant stacks based on biomarker state
      if (vaultData?.crp && vaultData.crp > 1.0) activeCompoundIds.add('omega3-epa')
      if (vaultData?.vitaminD && vaultData.vitaminD < 40) activeCompoundIds.add('mag-threonate')
      // Always show at least one Future Bio example
      activeCompoundIds.add('bpc-157')
    }

    return generateStackSynergies(Array.from(activeCompoundIds), vaultData)
  }, [longevityData, vaultData])

  const toggleStack = useCallback((id: string) => {
    setOpenStacks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Auto-open first stack
  useEffect(() => {
    if (stacks.length > 0 && openStacks.size === 0) {
      setOpenStacks(new Set([stacks[0].id]))
    }
  }, [stacks])

  if (!isLoaded) return <StackGhost />
  if (stacks.length === 0) return null

  const futureBioCount = stacks.filter(s => s.isFutureBio).length
  const totalSynergies = stacks.reduce((s, st) => s + st.synergisticItems.length, 0)

  return (
    <div style={{ padding: '20px 16px 8px' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.14em',
              color: T.blueBright, textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}>
              ⚗️ STACK OPTIMIZER
            </span>
            {futureBioCount > 0 && (
              <span style={{
                fontSize: 7, fontWeight: 800, letterSpacing: '0.1em',
                color: T.gold, background: `${T.gold}12`,
                padding: '2px 6px', borderRadius: 4,
                textTransform: 'uppercase', fontFamily: 'monospace',
                boxShadow: `0 0 8px ${T.gold}15`,
              }}>
                {futureBioCount} FUTURE BIO
              </span>
            )}
          </div>
          <div style={{
            fontSize: 9, color: T.textTer, fontFamily: 'monospace',
            marginTop: 3,
          }}>
            {stacks.length} active stack{stacks.length !== 1 ? 's' : ''} · {totalSynergies} synergistic compound{totalSynergies !== 1 ? 's' : ''} detected
          </div>
        </div>
      </div>

      {/* Stack Cards */}
      {stacks.map(stack => (
        <StackCard
          key={stack.id}
          stack={stack}
          isOpen={openStacks.has(stack.id)}
          onToggle={() => toggleStack(stack.id)}
        />
      ))}

      {/* Intelligence footer */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 0 4px',
      }}>
        <div style={{
          width: 4, height: 4, borderRadius: '50%',
          background: T.accent,
          boxShadow: `0 0 6px ${T.accent}40`,
          animation: 'stack-pulse 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: 9, color: T.textTer, fontFamily: 'monospace',
          fontStyle: 'italic',
        }}>
          Synergies auto-detected from your active protocols and biomarker state
        </span>
      </div>

      <style>{`
        @keyframes stack-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
