import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ─── Warm Palette (matches BioVaultView) ─── */
const W = {
  bg: 'rgba(26,24,22,0.7)',
  bgLight: 'rgba(26,24,22,0.4)',
  bgSolid: 'rgba(32,30,28,0.98)',
  border: 'rgba(168,155,138,0.12)',
  borderActive: 'rgba(168,155,138,0.25)',
  text: 'rgba(245,240,235,0.9)',
  textMuted: 'rgba(200,190,178,0.6)',
  textFaint: 'rgba(200,190,178,0.35)',
  sage: '#7CB68E',
  sageBg: 'rgba(124,182,142,0.08)',
  sageBorder: 'rgba(124,182,142,0.2)',
  terra: '#E8976C',
  terraBg: 'rgba(232,151,108,0.08)',
  terraBorder: 'rgba(232,151,108,0.2)',
  gold: '#C4A46C',
  goldBg: 'rgba(196,164,108,0.08)',
  goldBorder: 'rgba(196,164,108,0.2)',
  sky: '#6BA3BE',
  skyBg: 'rgba(107,163,190,0.08)',
  skyBorder: 'rgba(107,163,190,0.2)',
  rose: '#D4847A',
  roseBg: 'rgba(212,132,122,0.08)',
  roseBorder: 'rgba(212,132,122,0.2)',
  lavender: '#B08EC6',
  lavenderBg: 'rgba(176,142,198,0.08)',
  lavenderBorder: 'rgba(176,142,198,0.2)',
};

/* ─── Common Biomarkers with metadata ─── */
const COMMON_MARKERS = [
  { name: 'Vitamin D', unit: 'ng/mL', category: 'Vitamins', icon: '☀️', optimal: '40–60' },
  { name: 'Ferritin', unit: 'ng/mL', category: 'Iron', icon: '🩸', optimal: '40–150' },
  { name: 'Total Testosterone', unit: 'ng/dL', category: 'Hormones', icon: '⚡', optimal: '500–900' },
  { name: 'Free Testosterone', unit: 'pg/mL', category: 'Hormones', icon: '⚡', optimal: '15–25' },
  { name: 'CRP (hs-CRP)', unit: 'mg/L', category: 'Inflammation', icon: '🔥', optimal: '<1.0' },
  { name: 'HbA1c', unit: '%', category: 'Metabolic', icon: '🍬', optimal: '<5.7' },
  { name: 'TSH', unit: 'mIU/L', category: 'Thyroid', icon: '🦋', optimal: '0.5–4.0' },
  { name: 'Free T4', unit: 'ng/dL', category: 'Thyroid', icon: '🦋', optimal: '0.8–1.8' },
  { name: 'Free T3', unit: 'pg/mL', category: 'Thyroid', icon: '🦋', optimal: '2.3–4.2' },
  { name: 'Vitamin B12', unit: 'pg/mL', category: 'Vitamins', icon: '💊', optimal: '400–1000' },
  { name: 'Folate', unit: 'ng/mL', category: 'Vitamins', icon: '🥬', optimal: '>5.4' },
  { name: 'Magnesium (RBC)', unit: 'mg/dL', category: 'Minerals', icon: '💎', optimal: '4.2–6.8' },
  { name: 'Zinc', unit: 'mcg/dL', category: 'Minerals', icon: '🔩', optimal: '80–120' },
  { name: 'DHEA-S', unit: 'mcg/dL', category: 'Hormones', icon: '⚡', optimal: '100–400' },
  { name: 'Cortisol (AM)', unit: 'mcg/dL', category: 'Hormones', icon: '🌅', optimal: '6–18' },
  { name: 'Homocysteine', unit: 'umol/L', category: 'Cardiovascular', icon: '❤️', optimal: '<10' },
  { name: 'LDL Cholesterol', unit: 'mg/dL', category: 'Cardiovascular', icon: '❤️', optimal: '<100' },
  { name: 'HDL Cholesterol', unit: 'mg/dL', category: 'Cardiovascular', icon: '❤️', optimal: '>60' },
  { name: 'Triglycerides', unit: 'mg/dL', category: 'Cardiovascular', icon: '❤️', optimal: '<150' },
  { name: 'Fasting Glucose', unit: 'mg/dL', category: 'Metabolic', icon: '🍬', optimal: '70–99' },
  { name: 'Fasting Insulin', unit: 'uIU/mL', category: 'Metabolic', icon: '🍬', optimal: '2–8' },
  { name: 'GGT', unit: 'U/L', category: 'Liver', icon: '🫁', optimal: '<30' },
  { name: 'ALT', unit: 'U/L', category: 'Liver', icon: '🫁', optimal: '<35' },
  { name: 'AST', unit: 'U/L', category: 'Liver', icon: '🫁', optimal: '<35' },
  { name: 'Creatinine', unit: 'mg/dL', category: 'Kidney', icon: '🫘', optimal: '0.7–1.3' },
  { name: 'eGFR', unit: 'mL/min', category: 'Kidney', icon: '🫘', optimal: '>90' },
  { name: 'Omega-3 Index', unit: '%', category: 'Fatty Acids', icon: '🐟', optimal: '>8' },
  { name: 'ApoB', unit: 'mg/dL', category: 'Cardiovascular', icon: '❤️', optimal: '<90' },
  { name: 'Lp(a)', unit: 'nmol/L', category: 'Cardiovascular', icon: '❤️', optimal: '<75' },
  { name: 'Uric Acid', unit: 'mg/dL', category: 'Metabolic', icon: '🧪', optimal: '3.5–7.0' },
] as const;

const CATEGORIES = [...new Set(COMMON_MARKERS.map(m => m.category))];

/* ─── Types ─── */
interface LabEntry {
  _id: string;
  marker: string;
  value: number;
  unit: string;
  source: string;
  notes?: string;
  testedAt: number;
  loggedAt: number;
}

/* ─── BioVaultForm ─── */
export default function BioVaultForm({ sessionId }: { sessionId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [markerName, setMarkerName] = useState('');
  const [markerValue, setMarkerValue] = useState('');
  const [markerUnit, setMarkerUnit] = useState('');
  const [markerDate, setMarkerDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [markerSource, setMarkerSource] = useState('lab_panel');
  const [markerNotes, setMarkerNotes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const labResults = useQuery(api.queries.getLabResults, sessionId ? { sessionId } : 'skip') as LabEntry[] | undefined;
  const createLabResult = useMutation(api.mutations.createLabResult);
  const deleteLabResult = useMutation(api.mutations.deleteLabResult);

  // Filtered suggestions
  const suggestions = useMemo(() => {
    if (!markerName.trim()) return activeCategory ? COMMON_MARKERS.filter(m => m.category === activeCategory) : COMMON_MARKERS;
    const q = markerName.toLowerCase();
    let filtered = COMMON_MARKERS.filter(m =>
      m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    );
    if (activeCategory) filtered = filtered.filter(m => m.category === activeCategory);
    return filtered;
  }, [markerName, activeCategory]);

  // Group existing results by marker for history view
  const groupedResults = useMemo(() => {
    if (!labResults) return {};
    const groups: Record<string, LabEntry[]> = {};
    for (const r of labResults) {
      if (!groups[r.marker]) groups[r.marker] = [];
      groups[r.marker].push(r);
    }
    return groups;
  }, [labResults]);

  const markerCount = Object.keys(groupedResults).length;
  const totalEntries = labResults?.length ?? 0;

  const selectMarker = useCallback((name: string, unit: string) => {
    setMarkerName(name);
    setMarkerUnit(unit);
    setShowSuggestions(false);
    setTimeout(() => {
      const valInput = document.getElementById('biomarker-value-input');
      if (valInput) (valInput as HTMLInputElement).focus();
    }, 100);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!markerName.trim() || !markerValue.trim() || !markerUnit.trim()) return;
    setSaving(true);
    try {
      await createLabResult({
        sessionId,
        marker: markerName.trim(),
        value: parseFloat(markerValue),
        unit: markerUnit.trim(),
        source: markerSource,
        notes: markerNotes.trim() || undefined,
        testedAt: new Date(markerDate).getTime(),
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setMarkerName('');
        setMarkerValue('');
        setMarkerUnit('');
        setMarkerNotes('');
        setMarkerSource('lab_panel');
      }, 1500);
    } catch (err) {
      console.error('[BioVaultForm] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [sessionId, markerName, markerValue, markerUnit, markerDate, markerSource, markerNotes, createLabResult]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLabResult({ id: id as any });
      setDeleteConfirm(null);
    } catch (err) {
      console.error('[BioVaultForm] Delete error:', err);
    }
  }, [deleteLabResult]);

  const getMarkerMeta = (name: string) => COMMON_MARKERS.find(m => m.name === name);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div>
      {/* ── Entry Form Toggle ── */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 active:scale-[0.98] group"
          style={{
            background: `linear-gradient(135deg, ${W.sageBg}, ${W.skyBg})`,
            border: `1px solid ${W.sageBorder}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: W.sageBg, border: `1px solid ${W.sageBorder}` }}
            >
              🧪
            </div>
            <div className="text-left">
              <div className="text-[14px] font-semibold" style={{ color: W.text }}>
                Log Lab Results
              </div>
              <div className="text-[12px]" style={{ color: W.textMuted }}>
                Enter biomarker values from your latest blood work
              </div>
            </div>
          </div>
          <span className="text-xl transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: W.sage }}>
            →
          </span>
        </button>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: W.bgSolid,
            border: `1px solid ${W.borderActive}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          {/* Form Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: `1px solid ${W.border}` }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">🧪</span>
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: W.text }}>Log Biomarker</h3>
                <p className="text-[11px]" style={{ color: W.textFaint }}>Enter values from your lab panel</p>
              </div>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ background: W.bgLight, border: `1px solid ${W.border}` }}
            >
              <span className="text-sm" style={{ color: W.textMuted }}>✕</span>
            </button>
          </div>

          {saveSuccess ? (
            <div className="flex flex-col items-center py-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3 text-2xl"
                style={{ background: W.sageBg, border: `2px solid ${W.sageBorder}` }}
              >
                ✅
              </div>
              <span className="text-[15px] font-bold" style={{ color: W.sage }}>Biomarker Logged</span>
              <span className="text-[12px] mt-1" style={{ color: W.textMuted }}>Added to your health timeline</span>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              {/* Marker Name with Autocomplete */}
              <div ref={inputRef} className="relative">
                <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: W.text }}>
                  Marker Name
                </label>
                <input
                  type="text"
                  value={markerName}
                  onChange={e => { setMarkerName(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="e.g. Vitamin D, Ferritin, TSH..."
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all duration-200"
                  style={{
                    background: W.bgLight,
                    border: `1px solid ${showSuggestions ? W.sageBorder : W.border}`,
                    color: W.text,
                  }}
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && (
                  <div
                    className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto"
                    style={{
                      background: W.bgSolid,
                      border: `1px solid ${W.borderActive}`,
                      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {/* Category Filters */}
                    <div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto" style={{ borderBottom: `1px solid ${W.border}`, scrollbarWidth: 'none' }}>
                      <button
                        onClick={() => setActiveCategory(null)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all"
                        style={{
                          background: !activeCategory ? W.skyBg : 'transparent',
                          border: `1px solid ${!activeCategory ? W.skyBorder : W.border}`,
                          color: !activeCategory ? W.sky : W.textFaint,
                        }}
                      >
                        All
                      </button>
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all"
                          style={{
                            background: activeCategory === cat ? W.sageBg : 'transparent',
                            border: `1px solid ${activeCategory === cat ? W.sageBorder : W.border}`,
                            color: activeCategory === cat ? W.sage : W.textFaint,
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {suggestions.length === 0 ? (
                      <div className="px-4 py-4 text-center">
                        <div className="text-[12px]" style={{ color: W.textFaint }}>
                          No matching markers — type a custom name
                        </div>
                      </div>
                    ) : (
                      suggestions.map(m => (
                        <button
                          key={m.name}
                          onClick={() => selectMarker(m.name, m.unit)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 hover:bg-white/[0.03]"
                          style={{ borderBottom: `1px solid ${W.border}` }}
                        >
                          <span className="text-base flex-shrink-0">{m.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium" style={{ color: W.text }}>{m.name}</div>
                            <div className="text-[10px] flex items-center gap-2" style={{ color: W.textFaint }}>
                              <span>{m.category}</span>
                              <span>·</span>
                              <span>Optimal: {m.optimal}</span>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: W.textMuted }}>{m.unit}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Value + Unit Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: W.text }}>
                    Value
                  </label>
                  <input
                    id="biomarker-value-input"
                    type="number"
                    step="any"
                    value={markerValue}
                    onChange={e => setMarkerValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all duration-200 font-mono"
                    style={{ background: W.bgLight, border: `1px solid ${W.border}`, color: W.text }}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: W.text }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    value={markerUnit}
                    onChange={e => setMarkerUnit(e.target.value)}
                    placeholder="ng/mL"
                    className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all duration-200 font-mono"
                    style={{ background: W.bgLight, border: `1px solid ${W.border}`, color: W.text }}
                  />
                </div>
              </div>

              {/* Date + Source Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: W.text }}>
                    Test Date
                  </label>
                  <input
                    type="date"
                    value={markerDate}
                    onChange={e => setMarkerDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all duration-200"
                    style={{ background: W.bgLight, border: `1px solid ${W.border}`, color: W.text, colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: W.text }}>
                    Source
                  </label>
                  <select
                    value={markerSource}
                    onChange={e => setMarkerSource(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all duration-200 appearance-none"
                    style={{ background: W.bgLight, border: `1px solid ${W.border}`, color: W.text }}
                  >
                    <option value="lab_panel">Lab Panel</option>
                    <option value="at_home_test">At-Home Test</option>
                    <option value="physician">Physician</option>
                    <option value="specialist">Specialist</option>
                    <option value="research">Research Study</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: W.text }}>
                  Notes <span style={{ color: W.textFaint, fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={markerNotes}
                  onChange={e => setMarkerNotes(e.target.value)}
                  placeholder="e.g. Fasting blood draw, Quest Diagnostics"
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none transition-all duration-200"
                  style={{ background: W.bgLight, border: `1px solid ${W.border}`, color: W.text }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!markerName.trim() || !markerValue.trim() || !markerUnit.trim() || saving}
                className="w-full py-3.5 rounded-xl text-[14px] font-bold transition-all duration-300 active:scale-[0.98]"
                style={{
                  background: markerName.trim() && markerValue.trim() && markerUnit.trim() && !saving
                    ? `linear-gradient(135deg, ${W.sage}, ${W.sky})`
                    : W.bgLight,
                  border: `1px solid ${markerName.trim() && markerValue.trim() ? W.sageBorder : W.border}`,
                  color: markerName.trim() && markerValue.trim() ? '#fff' : W.textFaint,
                  cursor: markerName.trim() && markerValue.trim() && !saving ? 'pointer' : 'not-allowed',
                  boxShadow: markerName.trim() && markerValue.trim() && !saving ? '0 4px 20px rgba(124,182,142,0.2)' : 'none',
                }}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'transparent' }} />
                    Saving...
                  </span>
                ) : (
                  '🧪 Log Biomarker'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Logged Biomarkers Timeline ── */}
      {totalEntries > 0 && (
        <div className="mt-5">
          {/* Stats Row */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: W.sageBg, border: `1px solid ${W.sageBorder}` }}
            >
              <span className="text-sm">📊</span>
              <span className="text-[12px] font-semibold" style={{ color: W.sage }}>
                {markerCount} markers
              </span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: W.skyBg, border: `1px solid ${W.skyBorder}` }}
            >
              <span className="text-sm">📋</span>
              <span className="text-[12px] font-semibold" style={{ color: W.sky }}>
                {totalEntries} entries
              </span>
            </div>
          </div>

          {/* Grouped Results */}
          <div className="space-y-2.5">
            {Object.entries(groupedResults).map(([marker, entries]) => {
              const meta = getMarkerMeta(marker);
              const latest = entries[0];
              const previous = entries.length > 1 ? entries[1] : null;
              const delta = previous ? latest.value - previous.value : null;
              const deltaPercent = previous && previous.value !== 0
                ? ((latest.value - previous.value) / previous.value * 100).toFixed(1)
                : null;

              return (
                <div
                  key={marker}
                  className="rounded-2xl overflow-hidden transition-all duration-300"
                  style={{ background: W.bg, border: `1px solid ${W.border}` }}
                >
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{ background: meta ? W.sageBg : W.bgLight, border: `1px solid ${meta ? W.sageBorder : W.border}` }}
                      >
                        {meta?.icon ?? '🧪'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: W.text }}>{marker}</div>
                        <div className="text-[10px] flex items-center gap-1.5" style={{ color: W.textFaint }}>
                          {meta && <span>Optimal: {meta.optimal}</span>}
                          <span>· {entries.length} reading{entries.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      {/* Latest Value */}
                      <div className="text-right">
                        <div className="text-[18px] font-light font-serif" style={{ color: W.sage }}>
                          {latest.value}
                        </div>
                        <div className="text-[10px] font-mono" style={{ color: W.textFaint }}>{latest.unit}</div>
                      </div>

                      {/* Delta Badge */}
                      {delta !== null && deltaPercent !== null && (
                        <div
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                          style={{
                            background: delta > 0 ? W.sageBg : delta < 0 ? W.roseBg : W.bgLight,
                            border: `1px solid ${delta > 0 ? W.sageBorder : delta < 0 ? W.roseBorder : W.border}`,
                            color: delta > 0 ? W.sage : delta < 0 ? W.rose : W.textFaint,
                          }}
                        >
                          {delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {deltaPercent}%
                        </div>
                      )}

                      {/* Delete */}
                      {deleteConfirm === latest._id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(latest._id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                            style={{ background: W.roseBg, border: `1px solid ${W.roseBorder}`, color: W.rose }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded-lg text-[10px]"
                            style={{ background: W.bgLight, border: `1px solid ${W.border}`, color: W.textFaint }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(latest._id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                          style={{ background: W.bgLight, border: `1px solid ${W.border}` }}
                          title="Delete latest"
                        >
                          <span className="text-[11px]">🗑️</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mini History (if >1 entry) */}
                  {entries.length > 1 && (
                    <div
                      className="px-4 py-2 flex items-center gap-3 overflow-x-auto"
                      style={{ borderTop: `1px solid ${W.border}`, scrollbarWidth: 'none' }}
                    >
                      <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: W.textFaint }}>History:</span>
                      {entries.slice(0, 6).map((e, i) => (
                        <div key={e._id} className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px] font-mono" style={{ color: i === 0 ? W.sage : W.textMuted }}>
                            {e.value}
                          </span>
                          <span className="text-[9px]" style={{ color: W.textFaint }}>
                            {new Date(e.testedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          {i < Math.min(entries.length - 1, 5) && (
                            <span style={{ color: W.textFaint }}>·</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
