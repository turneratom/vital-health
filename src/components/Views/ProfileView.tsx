import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  type BiologicalSex,
  type ComputedBaselines,
  ageFromDOB,
  buildProfileFromOnboarding,
  computeAllBaselines,
  serializeBaselines,
  deserializeBaselines,
  getBaselineSummaryCards,
} from '@/lib/intelligence/BioLogic';
import { getTwinSessionId } from '@/lib/twinSession';

/* ── Session ID ── */
/* ── Unit Conversion Helpers ── */
const cmToFeetInches = (cm: number) => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};
const feetInchesToCm = (feet: number, inches: number) => Math.round((feet * 12 + inches) * 2.54);
const kgToLbs = (kg: number) => Math.round(kg * 2.20462);
const lbsToKg = (lbs: number) => Math.round(lbs / 2.20462 * 10) / 10;

/* ── Animated Number ── */
function AnimNum({ value, suffix = '' }: { value: number | string; suffix?: string }) {
  return (
    <motion.span
      key={String(value)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {value}{suffix}
    </motion.span>
  );
}

/* ── Estimated Badge ── */
function EstimatedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-[0.15em]"
      style={{
        background: 'rgba(255,170,0,0.08)',
        border: '1px solid rgba(255,170,0,0.2)',
        color: 'rgba(255,170,0,0.8)',
      }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      AI-Estimated
    </span>
  );
}

/* ── Sex Options ── */
const SEX_OPTIONS: { value: BiologicalSex; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: '♂' },
  { value: 'female', label: 'Female', icon: '♀' },
  { value: 'intersex', label: 'Intersex', icon: '⚧' },
  { value: 'prefer_not', label: 'Prefer not to say', icon: '—' },
];

/* ── Editable Field Component ── */
function EditableField({
  label,
  value,
  displayValue,
  unit,
  icon,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  label: string;
  value: string | number;
  displayValue: string;
  unit?: string;
  icon: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative rounded-xl p-4 transition-all duration-300"
      style={{
        background: isEditing ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: isEditing ? '1px solid rgba(0,240,255,0.2)' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {label}
          </span>
        </div>
        {!isEditing ? (
          <button
            onClick={onEdit}
            className="px-2.5 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(0,240,255,0.6)',
            }}
          >
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancel}
              className="px-2.5 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all duration-200"
              style={{
                background: 'rgba(255,59,48,0.06)',
                border: '1px solid rgba(255,59,48,0.15)',
                color: 'rgba(255,59,48,0.6)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-2.5 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all duration-200 hover:scale-105"
              style={{
                background: 'rgba(0,240,255,0.08)',
                border: '1px solid rgba(0,240,255,0.25)',
                color: 'rgba(0,240,255,0.8)',
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2"
          >
            {children}
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-baseline gap-1.5"
          >
            <span className="text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              <AnimNum value={displayValue} />
            </span>
            {unit && (
              <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {unit}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE VIEW — Main Component
   ══════════════════════════════════════════════════════════════ */
export default function ProfileView() {
  const sessionId = useMemo(() => getTwinSessionId(), []);

  /* ── Convex Data ── */
  const physicalBaseline = useQuery(api.queries.getPhysicalBaseline, { sessionId });
  const upsertBaseline = useMutation(api.mutations.upsertPhysicalBaseline);

  /* ── Local Form State ── */
  const [sex, setSex] = useState<BiologicalSex>('male');
  const [dob, setDob] = useState('1990-01-15');
  const [heightFeet, setHeightFeet] = useState(5);
  const [heightInches, setHeightInches] = useState(10);
  const [weightLbs, setWeightLbs] = useState(175);
  const [useMetric, setUseMetric] = useState(false);
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(79.4);

  /* ── Edit States ── */
  const [editingField, setEditingField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  /* ── Hydrate from Convex ── */
  useEffect(() => {
    if (physicalBaseline) {
      const s = physicalBaseline.sex as BiologicalSex;
      setSex(s);
      setDob(physicalBaseline.dateOfBirth);
      setHeightCm(physicalBaseline.heightCm);
      setWeightKg(physicalBaseline.weightKg);
      const fi = cmToFeetInches(physicalBaseline.heightCm);
      setHeightFeet(fi.feet);
      setHeightInches(fi.inches);
      setWeightLbs(kgToLbs(physicalBaseline.weightKg));
    }
  }, [physicalBaseline]);

  /* ── Compute Baselines ── */
  const age = useMemo(() => ageFromDOB(dob), [dob]);
  const computedBaselines: ComputedBaselines | null = useMemo(() => {
    if (!heightCm || !weightKg || age <= 0) return null;
    const profile = buildProfileFromOnboarding({ sex, dateOfBirth: dob, heightCm, weightKg });
    return computeAllBaselines(profile);
  }, [sex, dob, heightCm, weightKg, age]);

  /* ── Stored baselines from DB ── */
  const storedBaselines: ComputedBaselines | null = useMemo(() => {
    if (physicalBaseline?.computedBaselines) {
      return deserializeBaselines(physicalBaseline.computedBaselines);
    }
    return null;
  }, [physicalBaseline]);

  const baselines = computedBaselines ?? storedBaselines;
  const summaryCards = useMemo(() => baselines ? getBaselineSummaryCards(baselines) : [], [baselines]);

  /* ── Save Handler ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const hCm = useMetric ? heightCm : feetInchesToCm(heightFeet, heightInches);
      const wKg = useMetric ? weightKg : lbsToKg(weightLbs);
      const profile = buildProfileFromOnboarding({ sex, dateOfBirth: dob, heightCm: hCm, weightKg: wKg });
      const bl = computeAllBaselines(profile);

      await upsertBaseline({
        sessionId,
        sex,
        dateOfBirth: dob,
        heightCm: hCm,
        weightKg: wKg,
        computedBaselines: serializeBaselines(bl),
      });

      // Sync local state
      setHeightCm(hCm);
      setWeightKg(wKg);
      if (!useMetric) {
        const fi = cmToFeetInches(hCm);
        setHeightFeet(fi.feet);
        setHeightInches(fi.inches);
      } else {
        setWeightLbs(kgToLbs(wKg));
      }

      setEditingField(null);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 1500);
    } catch (err) {
      console.error('[ProfileView] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, sex, dob, heightCm, weightKg, heightFeet, heightInches, weightLbs, useMetric, upsertBaseline]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    // Reset to stored values
    if (physicalBaseline) {
      setSex(physicalBaseline.sex as BiologicalSex);
      setDob(physicalBaseline.dateOfBirth);
      setHeightCm(physicalBaseline.heightCm);
      setWeightKg(physicalBaseline.weightKg);
      const fi = cmToFeetInches(physicalBaseline.heightCm);
      setHeightFeet(fi.feet);
      setHeightInches(fi.inches);
      setWeightLbs(kgToLbs(physicalBaseline.weightKg));
    }
  }, [physicalBaseline]);

  /* ── Display Values ── */
  const heightDisplay = useMetric ? `${heightCm}` : `${heightFeet}'${heightInches}"`;
  const heightUnit = useMetric ? 'cm' : '';
  const weightDisplay = useMetric ? `${weightKg}` : `${weightLbs}`;
  const weightUnit = useMetric ? 'kg' : 'lbs';
  const sexDisplay = SEX_OPTIONS.find(o => o.value === sex)?.label ?? 'Not set';

  const isLoading = physicalBaseline === undefined;
  const hasProfile = physicalBaseline !== null && physicalBaseline !== undefined;

  return (
    <div className="px-4 pb-32 pt-2 max-w-lg mx-auto">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,240,255,0.1), rgba(175,130,255,0.1))',
              border: '1px solid rgba(0,240,255,0.15)',
            }}
          >
            <span className="text-lg">🧬</span>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Biometric Profile
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Physical Baseline Configuration
            </p>
          </div>
        </div>

        {/* Unit Toggle */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] font-mono" style={{ color: useMetric ? 'rgba(255,255,255,0.3)' : 'rgba(0,240,255,0.7)' }}>Imperial</span>
          <button
            onClick={() => setUseMetric(m => !m)}
            className="relative w-10 h-5 rounded-full transition-all duration-300"
            style={{
              background: useMetric ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300"
              style={{
                left: useMetric ? '22px' : '2px',
                background: useMetric ? '#00f0ff' : 'rgba(255,255,255,0.4)',
              }}
            />
          </button>
          <span className="text-[10px] font-mono" style={{ color: useMetric ? 'rgba(0,240,255,0.7)' : 'rgba(255,255,255,0.3)' }}>Metric</span>
        </div>
      </div>

      {/* ── Save Flash ── */}
      <AnimatePresence>
        {saveFlash && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 rounded-xl p-3 text-center"
            style={{
              background: 'rgba(0,255,170,0.06)',
              border: '1px solid rgba(0,255,170,0.2)',
            }}
          >
            <span className="text-[11px] font-mono tracking-wider" style={{ color: 'rgba(0,255,170,0.8)' }}>
              ✓ PROFILE_UPDATED — Baselines recalculated
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400" style={{ animation: 'spin 1s linear infinite' }} />
            <span className="text-[11px] font-mono tracking-wider" style={{ color: 'rgba(0,240,255,0.5)' }}>LOADING_PROFILE...</span>
          </div>
        </div>
      )}

      {/* ── No Profile State ── */}
      {!isLoading && !hasProfile && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-6 text-center mb-6"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,240,255,0.06)', border: '1px solid rgba(0,240,255,0.12)' }}>
            <span className="text-2xl">📐</span>
          </div>
          <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            No Physical Baseline Set
          </h3>
          <p className="text-[11px] mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Enter your biometrics to unlock AI-estimated benchmarks for BMR, HRV targets, and hydration goals.
          </p>
          <button
            onClick={() => setEditingField('sex')}
            className="px-5 py-2 rounded-xl text-[11px] font-mono uppercase tracking-wider transition-all duration-200 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(0,240,255,0.12), rgba(175,130,255,0.12))',
              border: '1px solid rgba(0,240,255,0.25)',
              color: 'rgba(0,240,255,0.9)',
            }}
          >
            Configure Profile
          </button>
        </motion.div>
      )}

      {/* ── Profile Fields ── */}
      {!isLoading && (
        <div className="space-y-3 mb-8">
          {/* Sex */}
          <EditableField
            label="Biological Sex"
            value={sex}
            displayValue={sexDisplay}
            icon="⚧"
            isEditing={editingField === 'sex'}
            onEdit={() => setEditingField('sex')}
            onSave={handleSave}
            onCancel={cancelEdit}
          >
            <div className="grid grid-cols-2 gap-2">
              {SEX_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSex(opt.value)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[11px] font-mono transition-all duration-200"
                  style={{
                    background: sex === opt.value ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: sex === opt.value ? '1px solid rgba(0,240,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                    color: sex === opt.value ? 'rgba(0,240,255,0.9)' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  <span className="text-sm">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </EditableField>

          {/* Date of Birth */}
          <EditableField
            label="Date of Birth"
            value={dob}
            displayValue={`${new Date(dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${age}y)`}
            icon="📅"
            isEditing={editingField === 'dob'}
            onEdit={() => setEditingField('dob')}
            onSave={handleSave}
            onCancel={cancelEdit}
          >
            <input
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(0,240,255,0.2)',
                color: 'rgba(255,255,255,0.9)',
                colorScheme: 'dark',
              }}
            />
            <div className="mt-1.5 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Age: {ageFromDOB(dob)} years — used for HRV norms and RHR estimates
            </div>
          </EditableField>

          {/* Height */}
          <EditableField
            label="Height"
            value={useMetric ? heightCm : `${heightFeet}'${heightInches}"`}
            displayValue={heightDisplay}
            unit={heightUnit}
            icon="📏"
            isEditing={editingField === 'height'}
            onEdit={() => setEditingField('height')}
            onSave={handleSave}
            onCancel={cancelEdit}
          >
            {useMetric ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={heightCm}
                  onChange={e => setHeightCm(Number(e.target.value))}
                  min={100}
                  max={250}
                  className="w-24 px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(0,240,255,0.2)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                />
                <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>cm</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={heightFeet}
                    onChange={e => setHeightFeet(Number(e.target.value))}
                    min={3}
                    max={8}
                    className="w-16 px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(0,240,255,0.2)',
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  />
                  <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>ft</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={heightInches}
                    onChange={e => setHeightInches(Number(e.target.value))}
                    min={0}
                    max={11}
                    className="w-16 px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(0,240,255,0.2)',
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  />
                  <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>in</span>
                </div>
              </div>
            )}
          </EditableField>

          {/* Weight */}
          <EditableField
            label="Weight"
            value={useMetric ? weightKg : weightLbs}
            displayValue={weightDisplay}
            unit={weightUnit}
            icon="⚖️"
            isEditing={editingField === 'weight'}
            onEdit={() => setEditingField('weight')}
            onSave={handleSave}
            onCancel={cancelEdit}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={useMetric ? weightKg : weightLbs}
                onChange={e => {
                  const val = Number(e.target.value);
                  if (useMetric) { setWeightKg(val); setWeightLbs(kgToLbs(val)); }
                  else { setWeightLbs(val); setWeightKg(lbsToKg(val)); }
                }}
                min={30}
                max={300}
                step={useMetric ? 0.1 : 1}
                className="w-28 px-3 py-2.5 rounded-lg text-[13px] font-mono outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(0,240,255,0.2)',
                  color: 'rgba(255,255,255,0.9)',
                }}
              />
              <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {useMetric ? 'kg' : 'lbs'}
              </span>
            </div>
          </EditableField>
        </div>
      )}

      {/* ── AI-Estimated Benchmarks Section ── */}
      {baselines && summaryCards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(175,130,255,0.1)', border: '1px solid rgba(175,130,255,0.15)' }}
              >
                <span className="text-xs">🤖</span>
              </div>
              <div>
                <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  AI-Estimated Benchmarks
                </h2>
                <p className="text-[9px] font-mono uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Computed from your physical baseline via BioLogic
                </p>
              </div>
            </div>
            <EstimatedBadge />
          </div>

          {/* Benchmark Cards */}
          <div className="space-y-2.5">
            {summaryCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i + 0.2 }}
                className="rounded-xl p-4 transition-all duration-300 hover:scale-[1.01]"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: `${card.color}10`,
                      border: `1px solid ${card.color}25`,
                    }}
                  >
                    <span className="text-base">{card.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {card.label}
                      </span>
                    </div>
                    <div className="text-[15px] font-semibold mb-0.5" style={{ color: card.color }}>
                      {card.value}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {card.subtext}
                    </div>
                  </div>

                  {/* Estimated indicator dot */}
                  <div
                    className="w-2 h-2 rounded-full shrink-0 mt-2"
                    style={{
                      background: 'rgba(255,170,0,0.5)',
                      boxShadow: '0 0 6px rgba(255,170,0,0.3)',
                    }}
                    title="AI-Estimated — sync a device for live data"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* TDEE Breakdown */}
          {baselines.bmr && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-4 rounded-xl p-4"
              style={{
                background: 'rgba(255,107,53,0.03)',
                border: '1px solid rgba(255,107,53,0.1)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs">📊</span>
                <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: 'rgba(255,107,53,0.7)' }}>
                  Daily Calorie Targets by Activity Level
                </span>
                <EstimatedBadge />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Sedentary', value: baselines.bmr.tdeeSedentary, desc: 'Desk work, minimal movement' },
                  { label: 'Light', value: baselines.bmr.tdeeLight, desc: '1-3 days/week exercise' },
                  { label: 'Moderate', value: baselines.bmr.tdeeModerate, desc: '3-5 days/week exercise' },
                  { label: 'High', value: baselines.bmr.tdeeHigh, desc: '6-7 days/week exercise' },
                  { label: 'Athlete', value: baselines.bmr.tdeeAthlete, desc: '2x/day or physical job' },
                  { label: 'Base BMR', value: baselines.bmr.bmrKcal, desc: 'At complete rest' },
                ].map(tier => (
                  <div
                    key={tier.label}
                    className="rounded-lg p-2.5"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="text-[9px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {tier.label}
                    </div>
                    <div className="text-[14px] font-semibold" style={{ color: 'rgba(255,107,53,0.9)' }}>
                      {tier.value.toLocaleString()}
                    </div>
                    <div className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      {tier.desc}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Disclaimer */}
          <div className="mt-4 rounded-lg p-3" style={{ background: 'rgba(255,170,0,0.03)', border: '1px solid rgba(255,170,0,0.08)' }}>
            <div className="flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,170,0,0.5)" strokeWidth="2" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p className="text-[9px] font-mono leading-relaxed" style={{ color: 'rgba(255,170,0,0.5)' }}>
                These benchmarks are population-based estimates derived from the Mifflin-St Jeor equation (BMR), 
                Nunan et al. meta-analysis (HRV), and EFSA guidelines (hydration). Sync a wearable device 
                (Apple Health, WHOOP, Oura, Garmin) to replace estimates with your real biometric data.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
