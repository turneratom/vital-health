import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface CommandersReportProps {
  sessionId: string;
  bloodValues: Record<string, string>;
  sleepScore?: number;
  sleepHours?: number;
  hrvCurrent?: number;
  protocolAdherence?: number;
}

type MarkerBrief = {
  key: string;
  label: string;
  value: number;
  unit: string;
  status: "optimal" | "suboptimal" | "critical";
  brief: string;
  icon: string;
};

type LongevityMarkerResult = {
  key: string;
  label: string;
  value: number;
  unit: string;
  ageImpactYears: number;
  direction: "aging" | "protecting";
  explanation: string;
  longevityRole: string;
};

type ReportData = {
  briefs: MarkerBrief[];
  longevityMarkers: LongevityMarkerResult[];
  totalAgeImpact: number;
  commanderDirective: string;
  overallStatus: "elite" | "operational" | "attention" | "critical";
  generatedAt: number;
  source: "llm" | "local";
};

const STATUS_CONFIG = {
  elite: { label: "ELITE", color: "#00F2FF", bg: "rgba(0,242,255,0.08)", border: "rgba(0,242,255,0.2)", icon: "🏆" },
  operational: { label: "OPERATIONAL", color: "#34C759", bg: "rgba(52,199,89,0.08)", border: "rgba(52,199,89,0.2)", icon: "✅" },
  attention: { label: "ATTENTION", color: "#FF9F0A", bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)", icon: "⚠️" },
  critical: { label: "CRITICAL", color: "#FF453A", bg: "rgba(255,69,58,0.08)", border: "rgba(255,69,58,0.2)", icon: "🚨" },
};

const MARKER_STATUS_COLORS = {
  optimal: "#34C759",
  suboptimal: "#FF9F0A",
  critical: "#FF453A",
};

export function CommandersReport({ sessionId, bloodValues, sleepScore, sleepHours, hrvCurrent, protocolAdherence }: CommandersReportProps) {
  const generateReport = useAction(api.commandersReport.generateCommandersReport);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'briefs' | 'longevity'>('briefs');
  const [expandedMarker, setExpandedMarker] = useState<string | null>(null);

  const hasMarkers = Object.entries(bloodValues).some(([_, v]) => v && v.trim() !== '');

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const markers = Object.entries(bloodValues)
        .filter(([_, v]) => v && v.trim() !== '')
        .map(([key, v]) => ({ key, value: parseFloat(v) }))
        .filter(m => !isNaN(m.value));

      if (markers.length === 0) {
        setError("Add blood marker values first");
        setLoading(false);
        return;
      }

      const result = await generateReport({
        sessionId,
        markers,
        sleepScore,
        sleepHours,
        hrvCurrent,
        protocolAdherence,
      });
      setReport(result);
    } catch (e) {
      console.error("Commander's Report error:", e);
      setError("Failed to generate report. Try again.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, bloodValues, sleepScore, sleepHours, hrvCurrent, protocolAdherence, generateReport]);

  /* ── Empty state ── */
  if (!report && !loading) {
    return (
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center gap-4 py-6"
        >
          <motion.div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            animate={{
              boxShadow: [
                '0 0 16px rgba(255,159,10,0.1), 0 0 32px rgba(0,242,255,0.05)',
                '0 0 24px rgba(255,159,10,0.2), 0 0 48px rgba(0,242,255,0.1)',
                '0 0 16px rgba(255,159,10,0.1), 0 0 32px rgba(0,242,255,0.05)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'linear-gradient(135deg, rgba(255,159,10,0.12), rgba(0,242,255,0.08))',
              border: '1px solid rgba(255,159,10,0.2)',
            }}
          >
            🎖️
          </motion.div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Commander&apos;s Report
            </h3>
            <p className="text-[11px] leading-relaxed max-w-[260px] mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {hasMarkers
                ? "Your blood markers are loaded. Generate a plain-English analysis with longevity impact assessment."
                : "Enter blood marker values in the Blood Markers tab first, then generate your report."}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!hasMarkers || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-semibold tracking-wide transition-all duration-300"
            style={{
              background: hasMarkers
                ? 'linear-gradient(135deg, rgba(255,159,10,0.15), rgba(0,242,255,0.1))'
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${hasMarkers ? 'rgba(255,159,10,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: hasMarkers ? 'rgba(255,159,10,0.9)' : 'rgba(255,255,255,0.2)',
              opacity: hasMarkers ? 1 : 0.5,
              cursor: hasMarkers ? 'pointer' : 'not-allowed',
            }}
          >
            <span>🎖️</span>
            Generate Report
          </button>
          {error && (
            <p className="text-[10px] font-mono" style={{ color: '#FF453A' }}>{error}</p>
          )}
        </motion.div>
      </div>
    );
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full"
          style={{
            border: '2px solid rgba(255,159,10,0.15)',
            borderTopColor: '#FF9F0A',
          }}
        />
        <div className="text-center">
          <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Analyzing biomarkers...
          </p>
          <p className="text-[10px] font-mono mt-1" style={{ color: 'rgba(255,159,10,0.5)' }}>
            Cross-referencing longevity data
          </p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const statusCfg = STATUS_CONFIG[report.overallStatus];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3"
    >
      {/* ── Status Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-3.5"
        style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.border}` }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[16px]">{statusCfg.icon}</span>
            <span className="text-[10px] font-mono font-bold tracking-[0.15em]" style={{ color: statusCfg.color }}>
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              BIO AGE
            </span>
            <span
              className="text-[12px] font-bold font-mono px-2 py-0.5 rounded-md"
              style={{
                color: report.totalAgeImpact > 0 ? '#FF453A' : report.totalAgeImpact < -1 ? '#00F2FF' : '#34C759',
                background: report.totalAgeImpact > 0 ? 'rgba(255,69,58,0.1)' : report.totalAgeImpact < -1 ? 'rgba(0,242,255,0.1)' : 'rgba(52,199,89,0.1)',
                border: `1px solid ${report.totalAgeImpact > 0 ? 'rgba(255,69,58,0.2)' : report.totalAgeImpact < -1 ? 'rgba(0,242,255,0.2)' : 'rgba(52,199,89,0.2)'}`,
              }}
            >
              {report.totalAgeImpact > 0 ? '+' : ''}{report.totalAgeImpact} yrs
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Commander's Directive ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl p-4 relative overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,159,10,0.12)',
        }}
      >
        <div className="absolute top-0 left-0 w-1 h-full" style={{ background: 'linear-gradient(180deg, #FF9F0A, rgba(255,159,10,0.2))' }} />
        <div className="flex items-center gap-2 mb-2 pl-2">
          <span className="text-[10px] font-mono font-bold tracking-[0.12em]" style={{ color: 'rgba(255,159,10,0.7)' }}>
            COMMANDER&apos;S DIRECTIVE
          </span>
          {report.source === 'llm' && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.1)', color: 'rgba(168,85,247,0.6)', border: '1px solid rgba(168,85,247,0.15)' }}>
              AI
            </span>
          )}
        </div>
        <p className="text-[12px] leading-[1.7] pl-2" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {report.commanderDirective}
        </p>
      </motion.div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1">
        {[
          { id: 'briefs' as const, label: 'Plain English', icon: '📋', count: report.briefs.length },
          { id: 'longevity' as const, label: 'Longevity', icon: '🧬', count: report.longevityMarkers.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all duration-200"
            style={{
              background: activeTab === tab.id ? 'rgba(255,159,10,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${activeTab === tab.id ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.04)'}`,
              color: activeTab === tab.id ? 'rgba(255,159,10,0.9)' : 'rgba(255,255,255,0.4)',
            }}
          >
            <span className="text-[12px]">{tab.icon}</span>
            {tab.label}
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
              style={{
                background: activeTab === tab.id ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.06)',
                color: activeTab === tab.id ? '#FF9F0A' : 'rgba(255,255,255,0.35)',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'briefs' && (
          <motion.div
            key="briefs"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {report.briefs.map((brief, idx) => (
              <motion.div
                key={brief.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid rgba(255,255,255,0.04)`,
                }}
              >
                <button
                  onClick={() => setExpandedMarker(expandedMarker === brief.key ? null : brief.key)}
                  className="w-full p-3.5 text-left"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">{brief.icon}</span>
                      <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {brief.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold" style={{ color: MARKER_STATUS_COLORS[brief.status] }}>
                        {brief.value} {brief.unit}
                      </span>
                      <span
                        className="text-[8px] font-mono px-1.5 py-0.5 rounded-full uppercase"
                        style={{
                          background: `${MARKER_STATUS_COLORS[brief.status]}15`,
                          color: MARKER_STATUS_COLORS[brief.status],
                          border: `1px solid ${MARKER_STATUS_COLORS[brief.status]}30`,
                        }}
                      >
                        {brief.status}
                      </span>
                    </div>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedMarker === brief.key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 pt-0">
                        <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        <p className="text-[11px] leading-[1.7]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {brief.brief}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'longevity' && (
          <motion.div
            key="longevity"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {/* ── Age Impact Summary ── */}
            <div
              className="rounded-xl p-3.5 flex items-center justify-between"
              style={{
                background: report.totalAgeImpact > 0
                  ? 'rgba(255,69,58,0.05)'
                  : 'rgba(0,242,255,0.05)',
                border: `1px solid ${report.totalAgeImpact > 0 ? 'rgba(255,69,58,0.12)' : 'rgba(0,242,255,0.12)'}`,
              }}
            >
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.12em] mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Net Biological Age Impact
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {report.totalAgeImpact > 0
                    ? "Your markers are accelerating biological aging"
                    : report.totalAgeImpact < -1
                    ? "Your markers are slowing biological aging"
                    : "Your markers are near biological age neutral"}
                </p>
              </div>
              <div
                className="text-[20px] font-bold font-mono px-3 py-1.5 rounded-xl"
                style={{
                  color: report.totalAgeImpact > 0 ? '#FF453A' : '#00F2FF',
                  background: report.totalAgeImpact > 0 ? 'rgba(255,69,58,0.1)' : 'rgba(0,242,255,0.1)',
                }}
              >
                {report.totalAgeImpact > 0 ? '+' : ''}{report.totalAgeImpact}
              </div>
            </div>

            {/* ── Individual Longevity Markers ── */}
            {report.longevityMarkers.map((lm, idx) => (
              <motion.div
                key={lm.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid rgba(255,255,255,0.04)`,
                }}
              >
                <button
                  onClick={() => setExpandedMarker(expandedMarker === `lon-${lm.key}` ? null : `lon-${lm.key}`)}
                  className="w-full p-3.5 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px]">{lm.direction === 'aging' ? '⏳' : '🛡️'}</span>
                      <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {lm.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {lm.value} {lm.unit}
                      </span>
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                        style={{
                          color: lm.direction === 'aging' ? '#FF453A' : '#00F2FF',
                          background: lm.direction === 'aging' ? 'rgba(255,69,58,0.1)' : 'rgba(0,242,255,0.1)',
                          border: `1px solid ${lm.direction === 'aging' ? 'rgba(255,69,58,0.2)' : 'rgba(0,242,255,0.2)'}`,
                        }}
                      >
                        {lm.ageImpactYears > 0 ? '+' : ''}{lm.ageImpactYears}y
                      </span>
                    </div>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedMarker === `lon-${lm.key}` && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 pt-0 space-y-2">
                        <div className="h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                        <p className="text-[10px] font-mono uppercase tracking-[0.1em]" style={{ color: 'rgba(168,85,247,0.5)' }}>
                          Longevity Role
                        </p>
                        <p className="text-[11px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {lm.longevityRole}
                        </p>
                        <p className="text-[10px] font-mono uppercase tracking-[0.1em] pt-1" style={{ color: lm.direction === 'aging' ? 'rgba(255,69,58,0.5)' : 'rgba(0,242,255,0.5)' }}>
                          Your Impact
                        </p>
                        <p className="text-[11px] leading-[1.6]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {lm.explanation}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Regenerate Button ── */}
      <div className="pt-1">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-[10px] font-mono font-medium tracking-wide transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          ↻ Regenerate Report
        </button>
      </div>
    </motion.div>
  );
}
