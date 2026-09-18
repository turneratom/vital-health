import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   ClinicalAdvisor — Research Paper Style Clinical Knowledge Layer
   
   A search/chat interface where users query advanced protocols.
   Returns structured 4-part clinical briefs:
     1) Biological Mechanism
     2) Longevity Benefits (with evidence levels)
     3) Suggested Synergies
     4) Safety Warnings
   
   Aesthetic: "Research Paper" — clean white text on dark backgrounds,
   formal iconography, monospaced labels, evidence-level badges.
   ═══════════════════════════════════════════════════════════════ */

/* ── Design Tokens ── */
const T = {
  bg: '#08080A',
  surface: 'rgba(12,12,16,0.92)',
  surfaceElevated: 'rgba(18,18,24,0.95)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.6)',
  textTer: 'rgba(255,255,255,0.3)',
  accent: '#3B82F6',
  accentGlow: 'rgba(59,130,246,0.12)',
  green: '#00DC82',
  greenGlow: 'rgba(0,220,130,0.08)',
  amber: '#F59E0B',
  amberGlow: 'rgba(245,158,11,0.08)',
  red: '#EF4444',
  redGlow: 'rgba(239,68,68,0.08)',
  purple: '#A78BFA',
  purpleGlow: 'rgba(167,139,250,0.08)',
  cyan: '#06B6D4',
  cyanGlow: 'rgba(6,182,212,0.08)',
  border: 'rgba(255,255,255,0.06)',
  borderAccent: 'rgba(59,130,246,0.15)',
}

type EvidenceLevel = 'strong' | 'moderate' | 'emerging' | 'preclinical'
type SafetyRating = 'well-established' | 'generally-safe' | 'use-with-caution' | 'research-only' | 'prescription-required'
type WarningSeverity = 'info' | 'caution' | 'warning' | 'danger'

const EVIDENCE_STYLE: Record<EvidenceLevel, { color: string; bg: string; label: string; icon: string }> = {
  strong:      { color: T.green,  bg: T.greenGlow,  label: 'Strong Evidence',   icon: '◆' },
  moderate:    { color: T.accent, bg: T.accentGlow,  label: 'Moderate Evidence', icon: '◇' },
  emerging:    { color: T.amber,  bg: T.amberGlow,   label: 'Emerging',          icon: '○' },
  preclinical: { color: T.purple, bg: T.purpleGlow,  label: 'Preclinical',       icon: '△' },
}

const SAFETY_STYLE: Record<SafetyRating, { color: string; bg: string; label: string; icon: string }> = {
  'well-established':   { color: T.green,  bg: T.greenGlow,  label: 'Well-Established',    icon: '✓' },
  'generally-safe':     { color: T.accent, bg: T.accentGlow,  label: 'Generally Safe',      icon: '●' },
  'use-with-caution':   { color: T.amber,  bg: T.amberGlow,   label: 'Use With Caution',    icon: '⚠' },
  'research-only':      { color: '#F97316', bg: 'rgba(249,115,22,0.08)', label: 'Research Only', icon: '⬡' },
  'prescription-required': { color: T.red, bg: T.redGlow,     label: 'Prescription Required', icon: '✕' },
}

const WARNING_STYLE: Record<WarningSeverity, { color: string; bg: string; border: string }> = {
  info:    { color: T.accent, bg: 'rgba(59,130,246,0.05)',  border: 'rgba(59,130,246,0.12)' },
  caution: { color: T.amber,  bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.12)' },
  warning: { color: '#F97316', bg: 'rgba(249,115,22,0.05)', border: 'rgba(249,115,22,0.12)' },
  danger:  { color: T.red,    bg: 'rgba(239,68,68,0.05)',  border: 'rgba(239,68,68,0.12)' },
}

const CATEGORY_ICON: Record<string, string> = {
  peptide: '🧬', supplement: '💊', compound: '⚗️', hormone: '⚡',
  nootropic: '🧠', adaptogen: '🌿',
}

/* ── Suggested Queries ── */
const SUGGESTED = [
  { query: 'BPC-157 for gut health', icon: '🧬' },
  { query: 'NMN for NAD+ levels', icon: '⚡' },
  { query: 'Resveratrol longevity benefits', icon: '🍇' },
  { query: 'Ashwagandha for cortisol', icon: '🌿' },
  { query: 'Creatine cognitive benefits', icon: '🧠' },
  { query: 'Metformin anti-aging', icon: '💊' },
]

interface BriefResult {
  found: boolean
  brief: any
  aiEnhanced: boolean
  aiSummary: string | null
  relatedSubstances: string[]
  generatedAt: number
}

interface ChatEntry {
  id: string
  query: string
  result: BriefResult | null
  loading: boolean
  timestamp: number
}

export default function ClinicalAdvisor() {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [input, setInput] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const generateBrief = useAction(api.researchLibrary.generateResearchBrief)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sessionId = getTwinSessionId()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [entries])

  const handleSearch = useCallback(async (queryText?: string) => {
    const q = (queryText || input).trim()
    if (!q || isSearching) return
    setInput('')
    setIsSearching(true)

    const entryId = `q-${Date.now()}`
    const newEntry: ChatEntry = { id: entryId, query: q, result: null, loading: true, timestamp: Date.now() }
    setEntries(prev => [...prev, newEntry])

    try {
      const result = await generateBrief({ query: q, sessionId })
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, result, loading: false } : e))
    } catch {
      setEntries(prev => prev.map(e => e.id === entryId
        ? { ...e, result: { found: false, brief: null, aiEnhanced: false, aiSummary: 'Unable to generate brief. Please try again.', relatedSubstances: [], generatedAt: Date.now() }, loading: false }
        : e
      ))
    } finally {
      setIsSearching(false)
    }
  }, [input, isSearching, generateBrief, sessionId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch() }
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: T.accentGlow, border: `1px solid ${T.borderAccent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>📋</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>
              Clinical Knowledge
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
              RESEARCH INTELLIGENCE ENGINE
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5 }}>
          Query any compound, peptide, or protocol. Receive structured clinical briefs with mechanism of action, evidence levels, synergies, and safety profiles.
        </div>
      </div>

      {/* Chat / Results Area */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 0', WebkitOverflowScrolling: 'touch' }}>
        {entries.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '24px 16px' }}>
            {/* Empty state — suggested queries */}
            <div style={{ fontSize: 10, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
              SUGGESTED QUERIES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SUGGESTED.map(s => (
                <button
                  key={s.query}
                  onClick={() => { setInput(s.query); handleSearch(s.query) }}
                  style={{
                    background: T.surfaceElevated, border: `1px solid ${T.border}`,
                    borderRadius: 10, padding: '10px 12px', textAlign: 'left',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = T.borderAccent }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = T.border }}
                >
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 11, color: T.text, fontWeight: 500, lineHeight: 1.3 }}>{s.query}</div>
                </button>
              ))}
            </div>

            {/* How it works */}
            <div style={{ marginTop: 24, padding: 16, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: T.accent, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
                STRUCTURED CLINICAL BRIEF FORMAT
              </div>
              {[
                { num: '01', label: 'Biological Mechanism', desc: 'How the compound works at the molecular level' },
                { num: '02', label: 'Longevity Benefits', desc: 'Evidence-graded benefits with pathway analysis' },
                { num: '03', label: 'Suggested Synergies', desc: 'Compounds that amplify effects when combined' },
                { num: '04', label: 'Safety Warnings', desc: 'Contraindications, interactions, and risk profile' },
              ].map(item => (
                <div key={item.num} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: T.accentGlow, border: `1px solid ${T.borderAccent}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: T.accent,
                  }}>{item.num}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: T.textTer }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {entries.map(entry => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{ padding: '0 16px', marginBottom: 16 }}
            >
              {/* User Query */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <div style={{
                  background: 'rgba(59,130,246,0.1)', border: `1px solid ${T.borderAccent}`,
                  borderRadius: '14px 14px 4px 14px', padding: '10px 14px',
                  maxWidth: '85%',
                }}>
                  <div style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{entry.query}</div>
                </div>
              </div>

              {/* Loading State */}
              {entry.loading && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: T.surface, border: `1px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13,
                  }}>🔬</div>
                  <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: '4px 14px 14px 14px', padding: '12px 16px',
                    flex: 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `2px solid ${T.borderAccent}`, borderTopColor: T.accent,
                        animation: 'ca-spin 0.8s linear infinite',
                      }} />
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em' }}>
                        ANALYZING CLINICAL DATABASE...
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Result */}
              {entry.result && !entry.loading && (
                <ClinicalBriefCard result={entry.result} onRelatedClick={(q) => { setInput(q); handleSearch(q) }} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Search Input */}
      <div style={{
        padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        borderTop: `1px solid ${T.border}`, background: T.surface,
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: T.surfaceElevated, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: '4px 4px 4px 14px',
        }}>
          <span style={{ fontSize: 14, opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any compound or protocol..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: T.text, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => handleSearch()}
            disabled={!input.trim() || isSearching}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: input.trim() ? T.accent : 'rgba(59,130,246,0.15)',
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', opacity: input.trim() ? 1 : 0.4,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ca-spin { to { transform: rotate(360deg); } }
        @keyframes ca-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ClinicalBriefCard — The 4-Part Structured Research Paper Card
   ═══════════════════════════════════════════════════════════════ */

function ClinicalBriefCard({ result, onRelatedClick }: { result: BriefResult; onRelatedClick: (q: string) => void }) {
  const [expandedSection, setExpandedSection] = useState<string | null>('mechanism')
  const brief = result.brief

  if (!brief && result.aiSummary) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: T.surface, border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        }}>📋</div>
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: '4px 14px 14px 14px', padding: '14px 16px', flex: 1,
        }}>
          <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{result.aiSummary}</div>
        </div>
      </div>
    )
  }

  if (!brief) return null

  const safetyStyle = SAFETY_STYLE[brief.safetyRating as SafetyRating] || SAFETY_STYLE['use-with-caution']
  const catIcon = CATEGORY_ICON[brief.category] || '💊'

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id)
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: T.surface, border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>🔬</div>

      <div style={{ flex: 1 }}>
        {/* Title Card */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: '4px 14px 14px 14px', padding: '16px', marginBottom: 8,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>{catIcon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>
                {brief.name}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' as const }}>
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                  padding: '2px 6px', borderRadius: 4, letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: T.accent, background: T.accentGlow, border: `1px solid ${T.borderAccent}`,
                }}>{brief.category}</span>
                <span style={{
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                  padding: '2px 6px', borderRadius: 4, letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: safetyStyle.color, background: safetyStyle.bg,
                  border: `1px solid ${safetyStyle.color}22`,
                }}>{safetyStyle.icon} {safetyStyle.label}</span>
              </div>
            </div>
          </div>

          {/* What It Is */}
          <div style={{ fontSize: 12, color: T.textSec, lineHeight: 1.65 }}>
            {brief.whatItIs}
          </div>

          {/* AI Enhancement Badge */}
          {result.aiEnhanced && result.aiSummary && (
            <div style={{
              marginTop: 10, padding: '8px 10px', borderRadius: 8,
              background: T.cyanGlow, border: `1px solid rgba(6,182,212,0.12)`,
            }}>
              <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.cyan, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                AI CLINICAL INTELLIGENCE
              </div>
              <div style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5 }}>{result.aiSummary}</div>
            </div>
          )}
        </div>

        {/* Section 1: Biological Mechanism */}
        <SectionAccordion
          id="mechanism"
          num="01"
          title="Biological Mechanism"
          icon="⚙️"
          expanded={expandedSection === 'mechanism'}
          onToggle={() => toggleSection('mechanism')}
        >
          <div style={{ fontSize: 12, color: T.textSec, lineHeight: 1.65 }}>
            {brief.mechanism}
          </div>
        </SectionAccordion>

        {/* Section 2: Longevity Benefits */}
        <SectionAccordion
          id="benefits"
          num="02"
          title="Longevity Benefits"
          icon="🧬"
          badge={`${brief.longevityBenefits.length} pathways`}
          expanded={expandedSection === 'benefits'}
          onToggle={() => toggleSection('benefits')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {brief.longevityBenefits.map((b: any, i: number) => {
              const ev = EVIDENCE_STYLE[b.evidenceLevel as EvidenceLevel] || EVIDENCE_STYLE.emerging
              return (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: ev.bg, border: `1px solid ${ev.color}15`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: ev.color }}>{ev.icon}</span>
                    <span style={{
                      fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
                      color: ev.color, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                    }}>{ev.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.text, fontWeight: 500, marginBottom: 2 }}>
                    {b.benefit}
                  </div>
                  <div style={{ fontSize: 10, color: T.textTer, fontFamily: 'monospace' }}>
                    Pathway: {b.pathway}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionAccordion>

        {/* Section 3: Synergies */}
        <SectionAccordion
          id="synergies"
          num="03"
          title="Suggested Synergies"
          icon="🔗"
          badge={`${brief.synergies.length} compounds`}
          expanded={expandedSection === 'synergies'}
          onToggle={() => toggleSection('synergies')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {brief.synergies.map((s: any, i: number) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 8,
                background: T.surfaceElevated, border: `1px solid ${T.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.accent }}>{s.compound}</span>
                  <button
                    onClick={() => onRelatedClick(s.compound)}
                    style={{
                      fontSize: 8, fontFamily: 'monospace', color: T.textTer,
                      background: 'rgba(59,130,246,0.06)', border: `1px solid ${T.borderAccent}`,
                      borderRadius: 4, padding: '2px 6px', cursor: 'pointer',
                      letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                    }}
                  >LOOKUP →</button>
                </div>
                <div style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5, marginBottom: 4 }}>
                  {s.reason}
                </div>
                <div style={{
                  fontSize: 10, color: T.green, fontFamily: 'monospace',
                  padding: '4px 8px', borderRadius: 4, background: T.greenGlow,
                  display: 'inline-block',
                }}>
                  ↗ {s.effect}
                </div>
              </div>
            ))}
          </div>
        </SectionAccordion>

        {/* Section 4: Safety Warnings */}
        <SectionAccordion
          id="safety"
          num="04"
          title="Safety Warnings"
          icon="⚠️"
          badge={brief.warnings.filter((w: any) => w.severity === 'danger' || w.severity === 'warning').length > 0
            ? `${brief.warnings.filter((w: any) => w.severity === 'danger' || w.severity === 'warning').length} critical`
            : 'review'}
          badgeColor={brief.warnings.some((w: any) => w.severity === 'danger') ? T.red : T.amber}
          expanded={expandedSection === 'safety'}
          onToggle={() => toggleSection('safety')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {brief.warnings.map((w: any, i: number) => {
              const ws = WARNING_STYLE[w.severity as WarningSeverity] || WARNING_STYLE.info
              return (
                <div key={i} style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: ws.bg, border: `1px solid ${ws.border}`,
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: `${ws.color}15`, border: `1px solid ${ws.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: ws.color,
                  }}>
                    {w.severity === 'danger' ? '!' : w.severity === 'warning' ? '⚠' : w.severity === 'caution' ? '•' : 'i'}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5 }}>{w.label}</div>
                </div>
              )
            })}
          </div>
        </SectionAccordion>

        {/* Timing & Dosing */}
        {brief.timing && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: '12px 14px', marginTop: 8,
          }}>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.accent, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
              TIMING & DOSING PROTOCOL
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'When', value: brief.timing.when },
                { label: 'Dose', value: brief.timing.dose },
                { label: 'Frequency', value: brief.timing.frequency },
              ].map(t => (
                <div key={t.label}>
                  <div style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 2 }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: 11, color: T.text, fontWeight: 500 }}>{t.value}</div>
                </div>
              ))}
            </div>
            {brief.timing.notes && (
              <div style={{ marginTop: 8, fontSize: 10, color: T.textTer, lineHeight: 1.5, fontStyle: 'italic' }}>
                {brief.timing.notes}
              </div>
            )}
          </div>
        )}

        {/* Key Studies */}
        {brief.keyStudies?.length > 0 && (
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: '12px 14px', marginTop: 8,
          }}>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.purple, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
              KEY STUDIES ({brief.keyStudies.length})
            </div>
            {brief.keyStudies.map((s: any, i: number) => (
              <div key={i} style={{
                padding: '8px 0', borderTop: i > 0 ? `1px solid ${T.border}` : 'none',
              }}>
                <div style={{ fontSize: 11, color: T.text, fontWeight: 500, marginBottom: 2 }}>
                  {s.title} <span style={{ color: T.textTer, fontFamily: 'monospace', fontSize: 9 }}>({s.year})</span>
                </div>
                <div style={{ fontSize: 10, color: T.textSec, lineHeight: 1.5 }}>{s.finding}</div>
              </div>
            ))}
          </div>
        )}

        {/* Related Substances */}
        {result.relatedSubstances.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 8 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', alignSelf: 'center' }}>
              RELATED:
            </span>
            {result.relatedSubstances.map(id => (
              <button
                key={id}
                onClick={() => onRelatedClick(id)}
                style={{
                  fontSize: 10, fontFamily: 'monospace', color: T.accent,
                  background: T.accentGlow, border: `1px solid ${T.borderAccent}`,
                  borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                  textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                }}
              >{id}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Accordion Section ── */
function SectionAccordion({ id, num, title, icon, badge, badgeColor, expanded, onToggle, children }: {
  id: string; num: string; title: string; icon: string; badge?: string; badgeColor?: string
  expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${expanded ? T.borderAccent : T.border}`,
      borderRadius: 12, marginBottom: 8, overflow: 'hidden',
      transition: 'border-color 0.3s',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: expanded ? T.accentGlow : 'rgba(255,255,255,0.03)',
          border: `1px solid ${expanded ? T.borderAccent : T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
          color: expanded ? T.accent : T.textTer,
          transition: 'all 0.3s',
        }}>{num}</div>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text, flex: 1 }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
            color: badgeColor || T.textTer, letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}>{badge}</span>
        )}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke={T.textTer} strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 14px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
