import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ═══════════════════════════════════════════════════════════════
   ResearchBrief — Clinical-White on Dark Research Library Cards
   
   Structured substance intelligence with safety labels,
   synergy maps, and evidence-level indicators.
   "Clinical-white" aesthetic: crisp white text on deep dark,
   with colored safety/evidence badges.
   ═══════════════════════════════════════════════════════════════ */

type EvidenceLevel = "strong" | "moderate" | "emerging" | "preclinical";
type SafetyRating = "well-established" | "generally-safe" | "use-with-caution" | "research-only" | "prescription-required";
type WarningSeverity = "info" | "caution" | "warning" | "danger";

interface LongevityBenefit {
  benefit: string;
  pathway: string;
  evidenceLevel: EvidenceLevel;
}

interface Synergy {
  compound: string;
  reason: string;
  effect: string;
}

interface Warning {
  label: string;
  severity: WarningSeverity;
}

interface KeyStudy {
  title: string;
  year: number;
  finding: string;
}

interface SubstanceBrief {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  whatItIs: string;
  mechanism: string;
  longevityBenefits: LongevityBenefit[];
  timing: { when: string; dose: string; frequency: string; notes: string };
  synergies: Synergy[];
  warnings: Warning[];
  safetyRating: SafetyRating;
  researchStatus: string;
  keyStudies: KeyStudy[];
}

interface ResearchResult {
  found: boolean;
  brief: SubstanceBrief | null;
  aiEnhanced: boolean;
  aiSummary: string | null;
  relatedSubstances: string[];
  generatedAt: number;
}

/* ── Style constants ── */
const EVIDENCE_COLORS: Record<EvidenceLevel, { bg: string; text: string; border: string; label: string }> = {
  strong: { bg: "rgba(0,220,130,0.08)", text: "#00dc82", border: "rgba(0,220,130,0.25)", label: "Strong Evidence" },
  moderate: { bg: "rgba(0,180,255,0.08)", text: "#00b4ff", border: "rgba(0,180,255,0.25)", label: "Moderate Evidence" },
  emerging: { bg: "rgba(255,200,0,0.08)", text: "#ffc800", border: "rgba(255,200,0,0.25)", label: "Emerging Research" },
  preclinical: { bg: "rgba(180,130,255,0.08)", text: "#b482ff", border: "rgba(180,130,255,0.25)", label: "Preclinical Only" },
};

const SAFETY_COLORS: Record<SafetyRating, { bg: string; text: string; border: string; icon: string; label: string }> = {
  "well-established": { bg: "rgba(0,220,130,0.06)", text: "#00dc82", border: "rgba(0,220,130,0.2)", icon: "✓", label: "Well-Established Safety" },
  "generally-safe": { bg: "rgba(0,180,255,0.06)", text: "#00b4ff", border: "rgba(0,180,255,0.2)", icon: "●", label: "Generally Safe" },
  "use-with-caution": { bg: "rgba(255,200,0,0.06)", text: "#ffc800", border: "rgba(255,200,0,0.2)", icon: "⚠", label: "Use With Caution" },
  "research-only": { bg: "rgba(255,140,0,0.06)", text: "#ff8c00", border: "rgba(255,140,0,0.2)", icon: "◆", label: "Research Compound" },
  "prescription-required": { bg: "rgba(255,59,48,0.06)", text: "#ff3b30", border: "rgba(255,59,48,0.2)", icon: "Rx", label: "Prescription Required" },
};

const WARNING_COLORS: Record<WarningSeverity, { bg: string; text: string; border: string; icon: string }> = {
  info: { bg: "rgba(0,180,255,0.05)", text: "rgba(0,180,255,0.8)", border: "rgba(0,180,255,0.15)", icon: "ℹ" },
  caution: { bg: "rgba(255,200,0,0.05)", text: "rgba(255,200,0,0.8)", border: "rgba(255,200,0,0.15)", icon: "⚠" },
  warning: { bg: "rgba(255,140,0,0.05)", text: "rgba(255,140,0,0.8)", border: "rgba(255,140,0,0.15)", icon: "⚡" },
  danger: { bg: "rgba(255,59,48,0.05)", text: "rgba(255,59,48,0.8)", border: "rgba(255,59,48,0.15)", icon: "⛔" },
};

const CATEGORY_ICONS: Record<string, string> = {
  peptide: "🧬", supplement: "💊", compound: "⚗️", hormone: "⚡", nootropic: "🧠", adaptogen: "🌿",
};

/* ── Evidence Badge ── */
function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const c = EVIDENCE_COLORS[level];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text, opacity: 0.7 }} />
      {c.label}
    </span>
  );
}

/* ── Safety Rating Badge ── */
function SafetyBadge({ rating }: { rating: SafetyRating }) {
  const c = SAFETY_COLORS[rating];
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      <span className="text-xs">{c.icon}</span>
      {c.label}
    </div>
  );
}

/* ── Section Header ── */
function SectionHeader({ number, title, icon }: { number: string; title: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-mono font-bold"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
        {number}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {icon} {title}
      </span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.06), transparent)' }} />
    </div>
  );
}

/* ── Substance Card (Full Brief) ── */
function SubstanceCard({ brief, aiSummary }: { brief: SubstanceBrief; aiSummary: string | null }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const safetyC = SAFETY_COLORS[brief.safetyRating];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-4"
    >
      {/* ── Header Card ── */}
      <div className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
        {/* Top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px" style={{ background: `linear-gradient(90deg, transparent, ${safetyC.text}40, transparent)` }} />

        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{CATEGORY_ICONS[brief.category] || "📋"}</span>
              <h2 className="text-lg font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.95)' }}>{brief.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {brief.category}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {brief.researchStatus}
              </span>
            </div>
          </div>
          <SafetyBadge rating={brief.safetyRating} />
        </div>

        {brief.aliases.length > 0 && (
          <div className="text-[9px] font-mono mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Also known as: {brief.aliases.join(" · ")}
          </div>
        )}

        {/* AI Summary */}
        {aiSummary && (
          <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(0,240,255,0.03)', border: '1px solid rgba(0,240,255,0.08)' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00f0ff', animation: 'pulse 2s ease-in-out infinite' }} />
              <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,240,255,0.6)' }}>AI Intelligence Brief</span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{aiSummary}</p>
          </div>
        )}
      </div>

      {/* ── Section 1: What It Is ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <SectionHeader number="01" title="What It Is" icon="📖" />
        <p className="text-[13px] leading-[1.7]" style={{ color: 'rgba(255,255,255,0.8)' }}>{brief.whatItIs}</p>
        <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="text-[9px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Mechanism of Action</span>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{brief.mechanism}</p>
        </div>
      </div>

      {/* ── Section 2: Longevity Benefits ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <SectionHeader number="02" title="Longevity Benefits" icon="🧬" />
        <div className="space-y-2.5">
          {brief.longevityBenefits.map((b, i) => (
            <div key={i} className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: EVIDENCE_COLORS[b.evidenceLevel].bg, border: `1px solid ${EVIDENCE_COLORS[b.evidenceLevel].border}` }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-mono font-bold"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{b.benefit}</p>
                <p className="text-[10px] font-mono mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Pathway: {b.pathway}</p>
                <EvidenceBadge level={b.evidenceLevel} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Timing & Dosing ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <SectionHeader number="03" title="Suggested Timing & Dosing" icon="⏱" />
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "When", value: brief.timing.when },
            { label: "Dose", value: brief.timing.dose },
            { label: "Frequency", value: brief.timing.frequency },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[8px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.label}</span>
              <span className="text-[11px] font-medium leading-tight block" style={{ color: 'rgba(255,255,255,0.8)' }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg p-2.5" style={{ background: 'rgba(0,180,255,0.03)', border: '1px solid rgba(0,180,255,0.08)' }}>
          <span className="text-[9px] font-mono" style={{ color: 'rgba(0,180,255,0.6)' }}>📝 {brief.timing.notes}</span>
        </div>
      </div>

      {/* ── Section 4: Synergies ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <SectionHeader number="04" title="Synergies" icon="🔗" />
        <div className="space-y-2.5">
          {brief.synergies.map((syn, i) => (
            <button key={i}
              onClick={() => setExpandedSection(expandedSection === `syn-${i}` ? null : `syn-${i}`)}
              className="w-full text-left rounded-xl p-3 transition-all duration-200"
              style={{ background: 'rgba(0,220,130,0.02)', border: '1px solid rgba(0,220,130,0.08)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold" style={{ color: 'rgba(0,220,130,0.9)' }}>+ {syn.compound}</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{expandedSection === `syn-${i}` ? "▲" : "▼"}</span>
              </div>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{syn.effect}</p>
              <AnimatePresence>
                {expandedSection === `syn-${i}` && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,220,130,0.08)' }}>
                      <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>{syn.reason}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 5: Safety & Warnings ── */}
      <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <SectionHeader number="05" title="Safety Profile" icon="🛡" />
        <div className="space-y-2">
          {brief.warnings.map((w, i) => {
            const wc = WARNING_COLORS[w.severity];
            return (
              <div key={i} className="rounded-xl p-3 flex items-start gap-2.5"
                style={{ background: wc.bg, border: `1px solid ${wc.border}` }}>
                <span className="text-sm flex-shrink-0 mt-0.5">{wc.icon}</span>
                <p className="text-[11px] leading-relaxed" style={{ color: wc.text }}>{w.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Key Studies ── */}
      {brief.keyStudies.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <SectionHeader number="06" title="Key Research" icon="📚" />
          <div className="space-y-2">
            {brief.keyStudies.map((study, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>{study.year}</span>
                  <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{study.title}</p>
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{study.finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
        <p className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
          VIVE RESEARCH LIBRARY — FOR EDUCATIONAL PURPOSES ONLY. NOT MEDICAL ADVICE. CONSULT YOUR PHYSICIAN BEFORE STARTING ANY NEW SUPPLEMENT OR COMPOUND.
        </p>
      </div>
    </motion.div>
  );
}

/* ── Library Catalog Card ── */
function CatalogCard({ substance, onSelect }: {
  substance: { id: string; name: string; category: string; safetyRating: string; researchStatus: string; benefitCount: number };
  onSelect: (id: string) => void;
}) {
  const safety = SAFETY_COLORS[substance.safetyRating as SafetyRating] || SAFETY_COLORS["use-with-caution"];
  return (
    <button
      onClick={() => onSelect(substance.name)}
      className="w-full text-left rounded-xl p-4 transition-all duration-200 group"
      style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{CATEGORY_ICONS[substance.category] || "📋"}</span>
          <span className="text-[13px] font-semibold group-hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {substance.name}
          </span>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-mono uppercase"
          style={{ background: safety.bg, color: safety.text, border: `1px solid ${safety.border}` }}>
          <span>{safety.icon}</span>
          <span className="hidden sm:inline">{substance.safetyRating.replace(/-/g, " ")}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{substance.category}</span>
        <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{substance.benefitCount} longevity pathways</span>
        <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <span className="text-[9px] font-mono uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>{substance.researchStatus}</span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ResearchLibrary — Main Export Component
   ═══════════════════════════════════════════════════════════════ */

export default function ResearchLibrary() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [catalog, setCatalog] = useState<Array<{ id: string; name: string; category: string; safetyRating: string; researchStatus: string; benefitCount: number }>>([]);
  const [showCatalog, setShowCatalog] = useState(true);

  const generateBrief = useAction(api.researchLibrary.generateResearchBrief);
  const listSubstances = useAction(api.researchLibrary.listResearchSubstances);

  // Load catalog on mount
  useEffect(() => {
    listSubstances({}).then(setCatalog).catch(() => {});
  }, [listSubstances]);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;
    setIsSearching(true);
    setShowCatalog(false);
    setResult(null);
    try {
      const res = await generateBrief({ query: q, sessionId: "research-library" });
      setResult(res as ResearchResult);
    } catch (err) {
      console.error("[ResearchLibrary] Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  }, [query, generateBrief]);

  const handleCatalogSelect = useCallback((name: string) => {
    setQuery(name);
    handleSearch(name);
  }, [handleSearch]);

  const handleBack = useCallback(() => {
    setResult(null);
    setShowCatalog(true);
    setQuery("");
  }, []);

  return (
    <div className="pb-32 px-4 pt-2">
      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          {result && (
            <button onClick={handleBack} className="p-1.5 rounded-lg transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
          )}
          <h1 className="text-base font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>Research Library</h1>
          <div className="w-1.5 h-1.5 rounded-full ml-1" style={{ background: '#00f0ff', animation: 'pulse 2s ease-in-out infinite' }} />
        </div>
        <p className="text-[10px] font-mono tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
          AI-POWERED SUBSTANCE INTELLIGENCE · CLINICAL BRIEFS · EVIDENCE-BASED
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative mb-5">
        <div className="rounded-xl overflow-hidden flex items-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="pl-3.5 pr-2 flex items-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ask: 'What is BPC-157?' or 'Should I take NMN?'"
            className="flex-1 bg-transparent py-3 pr-3 text-[13px] outline-none placeholder:text-white/20"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          />
          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !query.trim()}
            className="px-4 py-2 mr-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all disabled:opacity-30"
            style={{ background: 'rgba(0,240,255,0.08)', color: '#00f0ff', border: '1px solid rgba(0,240,255,0.15)' }}
          >
            {isSearching ? "..." : "Research"}
          </button>
        </div>
        {/* Quick suggestions */}
        {showCatalog && !query && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {["What is BPC-157?", "Should I take NMN?", "Creatine benefits", "Ashwagandha timing"].map(s => (
              <button key={s} onClick={() => { setQuery(s); handleSearch(s); }}
                className="px-2.5 py-1 rounded-full text-[9px] font-mono transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Loading State ── */}
      <AnimatePresence mode="wait">
        {isSearching && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-10 h-10 rounded-full border-2 mb-3"
              style={{ borderColor: 'rgba(0,240,255,0.15)', borderTopColor: '#00f0ff', animation: 'spin 1s linear infinite' }} />
            <span className="text-[11px] font-mono tracking-wider" style={{ color: 'rgba(0,240,255,0.5)' }}>
              COMPILING RESEARCH BRIEF...
            </span>
          </motion.div>
        )}

        {/* ── Result ── */}
        {!isSearching && result && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {result.found && result.brief ? (
              <SubstanceCard brief={result.brief} aiSummary={result.aiSummary} />
            ) : (
              <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-2xl block mb-3">🔬</span>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Not Yet in Library</h3>
                {result.aiSummary && (
                  <p className="text-[12px] leading-relaxed max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>{result.aiSummary}</p>
                )}
                <button onClick={handleBack} className="mt-4 px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider"
                  style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  Browse Library
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Catalog ── */}
        {!isSearching && showCatalog && !result && (
          <motion.div key="catalog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Available Briefs
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>
                {catalog.length}
              </span>
            </div>
            <div className="space-y-2">
              {catalog.map(sub => (
                <CatalogCard key={sub.id} substance={sub} onSelect={handleCatalogSelect} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
