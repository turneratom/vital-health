import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { WeeklyTacticalReport } from './WeeklyTacticalReport';
import { LabScanner } from './LabScanner';

interface BioVaultProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

/* ── Blood Marker Config ── */
interface BloodMarker {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  optimal: [number, number];
  placeholder: string;
}

const bloodMarkers: BloodMarker[] = [
  { key: 'vitaminD', label: 'Vitamin D', unit: 'ng/mL', min: 0, max: 150, optimal: [40, 80], placeholder: '50' },
  { key: 'testosteroneFree', label: 'Free Testosterone', unit: 'pg/mL', min: 0, max: 50, optimal: [15, 30], placeholder: '20' },
  { key: 'testosteroneTotal', label: 'Total Testosterone', unit: 'ng/dL', min: 0, max: 1500, optimal: [400, 900], placeholder: '600' },
  { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', min: 0, max: 500, optimal: [40, 200], placeholder: '80' },
  { key: 'crp', label: 'CRP', unit: 'mg/L', min: 0, max: 20, optimal: [0, 1], placeholder: '0.5' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', min: 3, max: 15, optimal: [4, 5.6], placeholder: '5.2' },
];

/* ── Genetic Toggle Config ── */
const geneticToggles = [
  { key: 'mthfrVariant', label: 'MTHFR Variant', desc: 'Methylation gene variant affecting folate metabolism' },
  { key: 'apoe4', label: 'APOE4 Carrier', desc: 'Apolipoprotein E variant linked to lipid metabolism' },
  { key: 'caffeineSensitivity', label: 'Caffeine Sensitivity', desc: 'CYP1A2 slow metabolizer variant' },
];

/* ── Flavor Profile Config ── */
const proteinOptions = ['Beef', 'Chicken', 'Salmon', 'Tuna', 'Eggs', 'Plant-based', 'Whey', 'Casein'];
const restrictionOptions = ['Gluten-Free', 'Keto', 'Paleo', 'Dairy-Free', 'Vegan', 'Low-FODMAP', 'Carnivore'];

/* ── Status Badge ── */
function getMarkerStatus(value: number | undefined, marker: BloodMarker): { label: string; color: string } {
  if (value === undefined || value === null) return { label: 'Ready', color: 'rgba(168,85,247,0.35)' };
  if (value >= marker.optimal[0] && value <= marker.optimal[1]) return { label: 'Optimal', color: '#34C759' };
  const lowThresh = marker.optimal[0] * 0.7;
  const highThresh = marker.optimal[1] * 1.3;
  if (value >= lowThresh && value <= highThresh) return { label: 'Borderline', color: '#FF9F0A' };
  return { label: 'Flag', color: '#FF453A' };
}

/* ── Toggle Switch ── */
function GeneticSwitch({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0"
      style={{
        background: active
          ? 'linear-gradient(135deg, rgba(0,242,255,0.4), rgba(168,85,247,0.4))'
          : 'rgba(255,255,255,0.06)',
        border: `1px solid ${active ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: active ? '0 0 12px rgba(0,242,255,0.15), inset 0 0 8px rgba(0,242,255,0.1)' : 'none',
      }}
    >
      <motion.div
        className="absolute top-0.5 w-5 h-5 rounded-full"
        animate={{ left: active ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          background: active
            ? 'linear-gradient(135deg, #00F2FF, #A855F7)'
            : 'rgba(255,255,255,0.25)',
          boxShadow: active ? '0 0 8px rgba(0,242,255,0.4)' : 'none',
        }}
      />
    </button>
  );
}

/* ── Tag Chip ── */
function TagChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[11px] font-mono font-medium tracking-wide transition-all duration-200"
      style={{
        background: active ? `${color}15` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
        color: active ? color : 'rgba(255,255,255,0.4)',
        boxShadow: active ? `0 0 10px ${color}15` : 'none',
      }}
    >
      {active && <span className="mr-1">&#10003;</span>}
      {label}
    </button>
  );
}

export function BioVault({ isOpen, onClose, sessionId }: BioVaultProps) {
  // Convex data
  const existingData = useQuery(api.queries.getBioVaultBySession, sessionId ? { sessionId } : 'skip');
  const upsertBioVault = useMutation(api.mutations.upsertBioVault);

  // Local form state
  const [bloodValues, setBloodValues] = useState<Record<string, string>>({});
  const [genetics, setGenetics] = useState({ mthfrVariant: false, apoe4: false, caffeineSensitivity: false });
  const [proteins, setProteins] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<'blood' | 'genetics' | 'flavor' | 'debrief' | 'labscan'>('blood');

  // Hydrate from DB
  useEffect(() => {
    if (existingData) {
      const bv: Record<string, string> = {};
      bloodMarkers.forEach(m => {
        const val = (existingData as Record<string, unknown>)[m.key];
        if (val !== undefined && val !== null) bv[m.key] = String(val);
      });
      setBloodValues(bv);
      setGenetics({
        mthfrVariant: existingData.mthfrVariant ?? false,
        apoe4: existingData.apoe4 ?? false,
        caffeineSensitivity: existingData.caffeineSensitivity ?? false,
      });
      setProteins(existingData.preferredProteins ? existingData.preferredProteins.split(',').filter(Boolean) : []);
      setRestrictions(existingData.dietaryRestrictions ? existingData.dietaryRestrictions.split(',').filter(Boolean) : []);
    }
  }, [existingData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const args: Record<string, unknown> = {
        sessionId,
        mthfrVariant: genetics.mthfrVariant,
        apoe4: genetics.apoe4,
        caffeineSensitivity: genetics.caffeineSensitivity,
        preferredProteins: proteins.join(','),
        dietaryRestrictions: restrictions.join(','),
      };
      bloodMarkers.forEach(m => {
        const v = bloodValues[m.key];
        if (v && v.trim() !== '') args[m.key] = parseFloat(v);
      });
      await upsertBioVault(args as Parameters<typeof upsertBioVault>[0]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('BioVault save error:', e);
    } finally {
      setSaving(false);
    }
  }, [sessionId, bloodValues, genetics, proteins, restrictions, upsertBioVault]);

  const toggleProtein = (p: string) => setProteins(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleRestriction = (r: string) => setRestrictions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const filledCount = bloodMarkers.filter(m => bloodValues[m.key] && bloodValues[m.key].trim() !== '').length;
  const completionPct = Math.round(((filledCount + (genetics.mthfrVariant || genetics.apoe4 || genetics.caffeineSensitivity ? 1 : 0) + (proteins.length > 0 ? 1 : 0) + (restrictions.length > 0 ? 1 : 0)) / (bloodMarkers.length + 3)) * 100);

  const sectionTabs = [
    { id: 'blood' as const, label: 'Blood Markers', icon: '🩸', count: filledCount },
    { id: 'labscan' as const, label: 'Lab Scanner', icon: '🤖', count: 0 },
    { id: 'genetics' as const, label: 'Genetics', icon: '🧬', count: Object.values(genetics).filter(Boolean).length },
    { id: 'flavor' as const, label: 'Flavor Profile', icon: '🥩', count: proteins.length + restrictions.length },
    { id: 'debrief' as const, label: 'Debrief', icon: '📋', count: 0 },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="w-[420px] max-w-[92vw] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10,10,14,0.92)',
              backdropFilter: 'blur(48px) saturate(1.6)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 1px rgba(0,242,255,0.1), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,242,255,0.12), rgba(168,85,247,0.08))',
                      border: '1px solid rgba(0,242,255,0.15)',
                      boxShadow: '0 0 16px rgba(0,242,255,0.1)',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22c4-4 8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 4 8 8 12Z" />
                      <path d="M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[14px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
                      Bio-Vault
                    </h2>
                    <p className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: 'rgba(0,242,255,0.45)' }}>
                      Biometric Data Vault
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Completion bar */}
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                      background: 'linear-gradient(90deg, #00F2FF, #A855F7)',
                      boxShadow: '0 0 8px rgba(0,242,255,0.3)',
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono" style={{ color: 'rgba(0,242,255,0.6)' }}>
                  {completionPct}%
                </span>
              </div>

              {/* Section tabs */}
              <div className="flex gap-1">
                {sectionTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all duration-200"
                    style={{
                      background: activeSection === tab.id ? 'rgba(0,242,255,0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${activeSection === tab.id ? 'rgba(0,242,255,0.15)' : 'rgba(255,255,255,0.04)'}`,
                      color: activeSection === tab.id ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    <span className="text-[13px]">{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                        style={{
                          background: activeSection === tab.id ? 'rgba(0,242,255,0.15)' : 'rgba(255,255,255,0.06)',
                          color: activeSection === tab.id ? '#00F2FF' : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,242,255,0.1), transparent)' }} />

            {/* ── Scrollable Content ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 briefing-room-scroll">
              {/* ── Welcome Empty State ── */}
              {completionPct === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center text-center gap-4 py-6"
                >
                  {/* Sparkle icon */}
                  <motion.div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    animate={{ boxShadow: [
                      '0 0 16px rgba(168,85,247,0.1), 0 0 32px rgba(0,242,255,0.05)',
                      '0 0 24px rgba(168,85,247,0.2), 0 0 48px rgba(0,242,255,0.1)',
                      '0 0 16px rgba(168,85,247,0.1), 0 0 32px rgba(0,242,255,0.05)',
                    ] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(0,242,255,0.08))',
                      border: '1px solid rgba(168,85,247,0.2)',
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" />
                      <path d="M5 3v4" opacity="0.5" />
                      <path d="M3 5h4" opacity="0.5" />
                      <path d="M19 17v4" opacity="0.5" />
                      <path d="M17 19h4" opacity="0.5" />
                    </svg>
                  </motion.div>

                  <div>
                    <h3 className="text-[16px] font-semibold tracking-tight mb-1.5" style={{ color: 'rgba(255,255,255,0.92)' }}>
                      Your Bio-Vault is ready for your first win
                    </h3>
                    <p className="text-[12px] leading-relaxed max-w-[260px] mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Start by adding a blood marker, toggling a genetic variant, or setting your food preferences.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {[
                      { label: 'Blood', icon: '\uD83E\uDE78', section: 'blood' as const },
                      { label: 'Genetics', icon: '\uD83E\uDDEC', section: 'genetics' as const },
                      { label: 'Flavor', icon: '\uD83E\uDD69', section: 'flavor' as const },
                    ].map((item) => (
                      <button
                        key={item.section}
                        onClick={() => setActiveSection(item.section)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-medium tracking-wide transition-all duration-200"
                        style={{
                          background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(0,242,255,0.06))',
                          border: '1px solid rgba(168,85,247,0.15)',
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.6)" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {/* ── Blood Markers ── */}
                {activeSection === 'blood' && (
                  <motion.div
                    key="blood"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5"
                  >
                    {bloodMarkers.map((marker, idx) => {
                      const val = bloodValues[marker.key] ? parseFloat(bloodValues[marker.key]) : undefined;
                      const status = getMarkerStatus(val, marker);
                      return (
                        <motion.div
                          key={marker.key}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="rounded-xl p-3.5"
                          style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                {marker.label}
                              </span>
                              <span
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: `${status.color}15`,
                                  color: status.color,
                                  border: `1px solid ${status.color}30`,
                                }}
                              >
                                {status.label}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {marker.unit}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              step="any"
                              min={marker.min}
                              max={marker.max}
                              placeholder={marker.placeholder}
                              value={bloodValues[marker.key] || ''}
                              onChange={(e) => setBloodValues(prev => ({ ...prev, [marker.key]: e.target.value }))}
                              className="flex-1 bg-transparent text-[20px] font-bold tracking-tight outline-none placeholder:opacity-20"
                              style={{
                                color: val !== undefined ? status.color === '#34C759' ? '#00F2FF' : status.color : 'rgba(255,255,255,0.7)',
                                caretColor: '#00F2FF',
                              }}
                            />
                            {/* Optimal range indicator */}
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                Optimal
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: 'rgba(52,199,89,0.5)' }}>
                                {marker.optimal[0]}–{marker.optimal[1]}
                              </span>
                            </div>
                          </div>
                          {/* Mini range bar */}
                          {val !== undefined && (
                            <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <motion.div
                                className="h-full rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.max(2, ((val - marker.min) / (marker.max - marker.min)) * 100))}%` }}
                                transition={{ duration: 0.5 }}
                                style={{
                                  background: status.color,
                                  boxShadow: `0 0 6px ${status.color}40`,
                                }}
                              />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}

                {/* ── Genetic Toggles ── */}
                {activeSection === 'genetics' && (
                  <motion.div
                    key="genetics"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5"
                  >
                    <div className="px-1 mb-3">
                      <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Toggle known genetic variants. Vive uses this data to personalize supplement and nutrition recommendations.
                      </p>
                    </div>
                    {geneticToggles.map((toggle, idx) => (
                      <motion.div
                        key={toggle.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        className="rounded-xl p-4 flex items-center gap-4"
                        style={{
                          background: (genetics as Record<string, boolean>)[toggle.key]
                            ? 'rgba(0,242,255,0.03)'
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${(genetics as Record<string, boolean>)[toggle.key] ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {toggle.label}
                          </div>
                          <div className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {toggle.desc}
                          </div>
                        </div>
                        <GeneticSwitch
                          active={(genetics as Record<string, boolean>)[toggle.key]}
                          onToggle={() => setGenetics(prev => ({ ...prev, [toggle.key]: !prev[toggle.key as keyof typeof prev] }))}
                        />
                      </motion.div>
                    ))}

                    {/* DNA helix decoration */}
                    <div className="flex items-center justify-center pt-4 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.2))' }} />
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.3)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 15c6.667-6 13.333 0 20-6" />
                          <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
                          <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
                        </svg>
                        <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg, rgba(168,85,247,0.2), transparent)' }} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Flavor Profile ── */}
                {activeSection === 'labscan' && (
                  <motion.div
                    key="labscan"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LabScanner sessionId={sessionId} />
                  </motion.div>
                )}

                {activeSection === 'debrief' && (
                  <motion.div
                    key="debrief"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <WeeklyTacticalReport sessionId={sessionId} />
                  </motion.div>
                )}

                {activeSection === 'flavor' && (
                  <motion.div
                    key="flavor"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    {/* Preferred Proteins */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          Preferred Proteins
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        {proteins.length > 0 && (
                          <span className="text-[9px] font-mono" style={{ color: 'rgba(0,242,255,0.5)' }}>
                            {proteins.length} selected
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {proteinOptions.map((p, idx) => (
                          <motion.div
                            key={p}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.03 }}
                          >
                            <TagChip
                              label={p}
                              active={proteins.includes(p)}
                              onClick={() => toggleProtein(p)}
                              color="#00F2FF"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Dietary Restrictions */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                          Dietary Restrictions
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        {restrictions.length > 0 && (
                          <span className="text-[9px] font-mono" style={{ color: 'rgba(168,85,247,0.6)' }}>
                            {restrictions.length} active
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {restrictionOptions.map((r, idx) => (
                          <motion.div
                            key={r}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.03 }}
                          >
                            <TagChip
                              label={r}
                              active={restrictions.includes(r)}
                              onClick={() => toggleRestriction(r)}
                              color="#A855F7"
                            />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer: Save Button ── */}
            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded-xl text-[12px] font-semibold tracking-wide transition-all duration-300 relative overflow-hidden"
                style={{
                  background: saved
                    ? 'linear-gradient(135deg, rgba(52,199,89,0.2), rgba(52,199,89,0.1))'
                    : 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(168,85,247,0.1))',
                  border: `1px solid ${saved ? 'rgba(52,199,89,0.3)' : 'rgba(0,242,255,0.2)'}`,
                  color: saved ? '#34C759' : 'rgba(0,242,255,0.9)',
                  boxShadow: saved
                    ? '0 0 20px rgba(52,199,89,0.15)'
                    : '0 0 20px rgba(0,242,255,0.08)',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="inline-block w-3.5 h-3.5 border-2 rounded-full"
                      style={{ borderColor: 'rgba(0,242,255,0.3)', borderTopColor: '#00F2FF' }}
                    />
                    Encrypting &amp; Saving...
                  </span>
                ) : saved ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Vault Secured
                  </span>
                ) : (
                  'Save to Bio-Vault'
                )}
              </button>
              <p className="text-center mt-2 text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
                Data encrypted &amp; persisted to Shipper Cloud
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
