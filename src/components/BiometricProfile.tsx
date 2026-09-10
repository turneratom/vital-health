import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { getSessionId } from '@/components/Presence/usePresenceState'
import {
  calculateBMR,
  calculateHRVRange,
  calculateHydration,
  calculateRestingHR,
  calculateCaffeineLimit,
  ageFromDOB,
  type BiologicalSex,
  type PhysicalProfile,
  type BMREstimate,
  type HRVRange,
  type HydrationGoal,
} from '@/lib/intelligence/BioLogic'

const T = {
  bg: '#0A0A0B',
  surface: 'rgba(14,14,18,0.85)',
  surfaceAlt: 'rgba(18,18,24,0.70)',
  elevated: 'rgba(22,22,30,0.90)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  blue: '#3B82F6',
  blueBright: '#60A5FA',
  blueGlow: 'rgba(59,130,246,0.15)',
  blueMuted: 'rgba(59,130,246,0.08)',
  accent: '#00FFCC',
  green: '#00DC82',
  orange: '#E8976C',
  red: '#FF6B6B',
  gold: '#C4A46C',
  violet: '#AF82FF',
  border: 'rgba(255,255,255,0.05)',
  borderBlue: 'rgba(59,130,246,0.12)',
}

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.8 }

type EditField = 'sex' | 'dob' | 'height' | 'weight' | null

const SEX_OPTIONS: { value: BiologicalSex; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: '♂' },
  { value: 'female', label: 'Female', icon: '♀' },
  { value: 'intersex', label: 'Intersex', icon: '⚥' },
  { value: 'prefer_not', label: 'Prefer not to say', icon: '—' },
]

function formatHeight(cm: number): string {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return `${feet}'${inches}" (${Math.round(cm)} cm)`
}

function formatWeight(kg: number): string {
  const lbs = Math.round(kg * 2.205)
  return `${lbs} lbs (${kg.toFixed(1)} kg)`
}

function calculateAge(dob: string): number {
  return ageFromDOB(dob)
}

/* ── Readout Row ── */
function ReadoutRow({ label, value, unit, icon, color, isEstimated, onEdit }: {
  label: string; value: string; unit?: string; icon: string; color: string
  isEstimated?: boolean; onEdit?: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
      borderRadius: 10, background: T.blueMuted, border: `1px solid ${T.borderBlue}`,
      transition: 'all 0.2s',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: `${color}15`, border: `1px solid ${color}30`,
        fontSize: 13,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 7, fontFamily: 'monospace', color: T.textTer,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {label}
          {isEstimated && (
            <span style={{
              fontSize: 6, padding: '1px 4px', borderRadius: 4,
              background: `${T.gold}20`, color: T.gold, fontWeight: 700,
              letterSpacing: '0.08em',
            }}>
              EST
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: T.text }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textSec }}>
              {unit}
            </span>
          )}
        </div>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          style={{
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`,
            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
            fontSize: 8, fontFamily: 'monospace', color: T.textSec,
            fontWeight: 600, letterSpacing: '0.06em', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${T.blue}15`; e.currentTarget.style.color = T.blueBright }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = T.textSec }}
        >
          EDIT
        </button>
      )}
    </div>
  )
}

/* ── Inline Editor ── */
function InlineEditor({ field, currentValue, onSave, onCancel }: {
  field: EditField
  currentValue: { sex: string; dob: string; heightCm: number; weightKg: number }
  onSave: (updates: Partial<{ sex: string; dateOfBirth: string; heightCm: number; weightKg: number }>) => void
  onCancel: () => void
}) {
  const [sex, setSex] = useState(currentValue.sex)
  const [dob, setDob] = useState(currentValue.dob)
  const [heightCm, setHeightCm] = useState(currentValue.heightCm)
  const [weightKg, setWeightKg] = useState(currentValue.weightKg)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.borderBlue}`,
    color: T.text, fontSize: 13, fontFamily: 'monospace', fontWeight: 600,
    outline: 'none', transition: 'border-color 0.2s',
  }

  const btnStyle = (primary: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 8, fontSize: 9, fontFamily: 'monospace',
    fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    cursor: 'pointer', transition: 'all 0.2s', border: 'none',
    background: primary ? T.blue : 'rgba(255,255,255,0.06)',
    color: primary ? '#fff' : T.textSec,
  })

  const handleSave = () => {
    switch (field) {
      case 'sex': onSave({ sex }); break
      case 'dob': onSave({ dateOfBirth: dob }); break
      case 'height': onSave({ heightCm }); break
      case 'weight': onSave({ weightKg }); break
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={SPRING}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(59,130,246,0.06)', border: `1px solid ${T.borderBlue}`,
        marginTop: 4,
      }}>
        {field === 'sex' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {SEX_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSex(opt.value)}
                style={{
                  padding: '8px 6px', borderRadius: 8, cursor: 'pointer',
                  background: sex === opt.value ? `${T.blue}20` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${sex === opt.value ? T.blue : T.border}`,
                  color: sex === opt.value ? T.blueBright : T.textSec,
                  fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                  transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 14 }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {field === 'dob' && (
          <input
            type="date"
            value={dob}
            onChange={e => setDob(e.target.value)}
            style={{ ...inputStyle, colorScheme: 'dark' }}
          />
        )}
        {field === 'height' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input
                type="range" min={120} max={220} step={1}
                value={heightCm}
                onChange={e => setHeightCm(Number(e.target.value))}
                style={{ flex: 1, accentColor: T.blue }}
              />
              <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: T.blueBright, minWidth: 55, textAlign: 'right' }}>
                {formatHeight(heightCm).split(' (')[0]}
              </span>
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, textAlign: 'center' }}>
              {Math.round(heightCm)} cm
            </div>
          </div>
        )}
        {field === 'weight' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <input
                type="range" min={30} max={200} step={0.5}
                value={weightKg}
                onChange={e => setWeightKg(Number(e.target.value))}
                style={{ flex: 1, accentColor: T.blue }}
              />
              <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: T.blueBright, minWidth: 60, textAlign: 'right' }}>
                {Math.round(weightKg * 2.205)} lbs
              </span>
            </div>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, textAlign: 'center' }}>
              {weightKg.toFixed(1)} kg
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button onClick={onCancel} style={btnStyle(false)}>Cancel</button>
          <button onClick={handleSave} style={btnStyle(true)}>Save</button>
        </div>
      </div>
    </motion.div>
  )
}

/* ── TDEE Activity Bar ── */
function TDEEBar({ bmr }: { bmr: BMREstimate }) {
  const levels = [
    { label: 'Sedentary', value: bmr.tdeeSedentary, color: T.textSec },
    { label: 'Light', value: bmr.tdeeLight, color: T.blueBright },
    { label: 'Moderate', value: bmr.tdeeModerate, color: T.green },
    { label: 'High', value: bmr.tdeeHigh, color: T.orange },
    { label: 'Athlete', value: bmr.tdeeAthlete, color: T.red },
  ]
  const max = bmr.tdeeAthlete
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        fontSize: 7, fontFamily: 'monospace', color: T.textTer,
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        TDEE by Activity Level
        <span style={{
          fontSize: 6, padding: '1px 4px', borderRadius: 4,
          background: `${T.gold}20`, color: T.gold, fontWeight: 700,
        }}>
          EST
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {levels.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, width: 52, textAlign: 'right' }}>
              {l.label}
            </span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${(l.value / max) * 100}%`,
                background: `linear-gradient(90deg, ${l.color}60, ${l.color})`,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: l.color, minWidth: 40, textAlign: 'right' }}>
              {l.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN: BiometricProfile
   ══════════════════════════════════════════════════════════════ */

export default function BiometricProfile() {
  const sessionId = getSessionId()
  const baseline = useQuery(api.queries.getPhysicalBaseline, { sessionId })
  const upsertBaseline = useMutation(api.mutations.upsertPhysicalBaseline)
  const [editField, setEditField] = useState<EditField>(null)
  const [saving, setSaving] = useState(false)

  const profile = useMemo<PhysicalProfile | null>(() => {
    if (!baseline) return null
    return {
      sex: baseline.sex as BiologicalSex,
      age: calculateAge(baseline.dateOfBirth),
      heightCm: baseline.heightCm,
      weightKg: baseline.weightKg,
    }
  }, [baseline])

  const baselines = useMemo(() => {
    if (!profile) return null
    return {
      bmr: calculateBMR(profile),
      hrv: calculateHRVRange(profile),
      hydration: calculateHydration(profile),
      rhr: calculateRestingHR(profile),
      caffeine: calculateCaffeineLimit(profile),
    }
  }, [profile])

  const handleSave = useCallback(async (updates: Partial<{ sex: string; dateOfBirth: string; heightCm: number; weightKg: number }>) => {
    if (!baseline) return
    setSaving(true)
    try {
      await upsertBaseline({
        sessionId,
        sex: updates.sex ?? baseline.sex,
        dateOfBirth: updates.dateOfBirth ?? baseline.dateOfBirth,
        heightCm: updates.heightCm ?? baseline.heightCm,
        weightKg: updates.weightKg ?? baseline.weightKg,
      })
      setEditField(null)
    } catch (err) {
      console.error('Failed to save baseline:', err)
    } finally {
      setSaving(false)
    }
  }, [baseline, sessionId, upsertBaseline])

  /* ── Empty State ── */
  if (baseline === undefined) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{
          width: 24, height: 24, border: `2px solid ${T.borderBlue}`,
          borderTopColor: T.blue, borderRadius: '50%',
          animation: 'bp-spin 0.8s linear infinite', margin: '0 auto 8px',
        }} />
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer }}>Loading profile…</span>
        <style>{`@keyframes bp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!baseline) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 8px' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px',
          background: `linear-gradient(135deg, ${T.blueMuted}, ${T.blueGlow})`,
          border: `1px solid ${T.borderBlue}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          🧬
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: 'monospace', marginBottom: 4 }}>
          No Physical Baseline
        </div>
        <p style={{ fontSize: 9, color: T.textSec, fontFamily: 'monospace', lineHeight: 1.5, margin: '0 0 12px' }}>
          Complete onboarding to set your sex, age, height, and weight. This enables AI-estimated BMR, HRV targets, and daily calorie goals.
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          background: `${T.blue}15`, border: `1px solid ${T.borderBlue}`,
          fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
          color: T.blueBright, letterSpacing: '0.06em',
        }}>
          ⚡ Complete Physical Baseline in Onboarding
        </div>
      </div>
    )
  }

  const age = calculateAge(baseline.dateOfBirth)
  const sexLabel = SEX_OPTIONS.find(o => o.value === baseline.sex)?.label ?? baseline.sex
  const sexIcon = SEX_OPTIONS.find(o => o.value === baseline.sex)?.icon ?? '—'

  return (
    <div>
      {/* Profile Readouts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ReadoutRow
          label="Biological Sex" value={`${sexIcon} ${sexLabel}`}
          icon="🧬" color={T.violet}
          onEdit={() => setEditField(editField === 'sex' ? null : 'sex')}
        />
        <AnimatePresence>
          {editField === 'sex' && (
            <InlineEditor
              field="sex"
              currentValue={{ sex: baseline.sex, dob: baseline.dateOfBirth, heightCm: baseline.heightCm, weightKg: baseline.weightKg }}
              onSave={handleSave}
              onCancel={() => setEditField(null)}
            />
          )}
        </AnimatePresence>

        <ReadoutRow
          label="Age (from DOB)" value={`${age}`} unit={`yrs · ${baseline.dateOfBirth}`}
          icon="📅" color={T.blueBright}
          onEdit={() => setEditField(editField === 'dob' ? null : 'dob')}
        />
        <AnimatePresence>
          {editField === 'dob' && (
            <InlineEditor
              field="dob"
              currentValue={{ sex: baseline.sex, dob: baseline.dateOfBirth, heightCm: baseline.heightCm, weightKg: baseline.weightKg }}
              onSave={handleSave}
              onCancel={() => setEditField(null)}
            />
          )}
        </AnimatePresence>

        <ReadoutRow
          label="Height" value={formatHeight(baseline.heightCm)}
          icon="📏" color={T.green}
          onEdit={() => setEditField(editField === 'height' ? null : 'height')}
        />
        <AnimatePresence>
          {editField === 'height' && (
            <InlineEditor
              field="height"
              currentValue={{ sex: baseline.sex, dob: baseline.dateOfBirth, heightCm: baseline.heightCm, weightKg: baseline.weightKg }}
              onSave={handleSave}
              onCancel={() => setEditField(null)}
            />
          )}
        </AnimatePresence>

        <ReadoutRow
          label="Weight" value={formatWeight(baseline.weightKg)}
          icon="⚖️" color={T.orange}
          onEdit={() => setEditField(editField === 'weight' ? null : 'weight')}
        />
        <AnimatePresence>
          {editField === 'weight' && (
            <InlineEditor
              field="weight"
              currentValue={{ sex: baseline.sex, dob: baseline.dateOfBirth, heightCm: baseline.heightCm, weightKg: baseline.weightKg }}
              onSave={handleSave}
              onCancel={() => setEditField(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {saving && (
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.blueBright }}>Saving…</span>
        </div>
      )}

      {/* ── AI-Assumed Baselines ── */}
      {baselines && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ marginTop: 14 }}
        >
          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: T.borderBlue }} />
            <span style={{
              fontSize: 8, fontFamily: 'monospace', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: T.gold, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              🤖 AI-Assumed Baselines
              <span style={{
                fontSize: 6, padding: '1px 5px', borderRadius: 4,
                background: `${T.gold}20`, color: T.gold,
              }}>
                ESTIMATED
              </span>
            </span>
            <div style={{ flex: 1, height: 1, background: T.borderBlue }} />
          </div>

          {/* BMR + TDEE */}
          <ReadoutRow
            label="Basal Metabolic Rate" value={`${baselines.bmr.bmrKcal}`} unit="kcal/day"
            icon="🔥" color={T.orange} isEstimated
          />

          <TDEEBar bmr={baselines.bmr} />

          {/* HRV Target */}
          <div style={{ marginTop: 10 }}>
            <ReadoutRow
              label="Target HRV Range" value={`${baselines.hrv.low}–${baselines.hrv.high}`} unit="ms RMSSD"
              icon="💓" color={T.green} isEstimated
            />
            <div style={{
              display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap',
            }}>
              {[
                { label: 'Median', value: `${baselines.hrv.median}ms`, color: T.green },
                { label: 'Elite', value: `≥${baselines.hrv.eliteThreshold}ms`, color: T.accent },
                { label: 'Concern', value: `<${baselines.hrv.concernThreshold}ms`, color: T.red },
              ].map(m => (
                <div key={m.label} style={{
                  padding: '3px 8px', borderRadius: 6,
                  background: `${m.color}10`, border: `1px solid ${m.color}25`,
                  fontSize: 8, fontFamily: 'monospace', fontWeight: 600,
                  color: m.color, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ color: T.textTer, fontWeight: 400 }}>{m.label}</span>
                  {m.value}
                </div>
              ))}
            </div>
          </div>

          {/* Hydration + Caffeine + RHR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            <ReadoutRow
              label="Daily Hydration Goal" value={`${baselines.hydration.baseMl}`} unit="ml/day"
              icon="💧" color={T.blueBright} isEstimated
            />
            <ReadoutRow
              label="Resting Heart Rate" value={`${baselines.rhr.rhrBpm}`} unit="bpm"
              icon="❤️" color={T.red} isEstimated
            />
            <ReadoutRow
              label="Caffeine Limit" value={`${baselines.caffeine.dailyMaxMg}`} unit={`mg · ~${baselines.caffeine.coffeeCupsEquiv} cups`}
              icon="☕" color={T.gold} isEstimated
            />
          </div>

          {/* Cohort badge */}
          <div style={{
            marginTop: 10, padding: '6px 10px', borderRadius: 8,
            background: `${T.violet}08`, border: `1px solid ${T.violet}15`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 11 }}>📊</span>
            <div>
              <div style={{ fontSize: 7, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Population Cohort
              </div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 600, color: T.violet }}>
                {baselines.hrv.cohort}
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p style={{
            fontSize: 7, fontFamily: 'monospace', color: T.textTer,
            lineHeight: 1.5, margin: '10px 0 0', textAlign: 'center',
            letterSpacing: '0.02em',
          }}>
            Estimates via Mifflin-St Jeor + population norms. Connect a wearable for live data.
          </p>
        </motion.div>
      )}
    </div>
  )
}
