import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useBiometricSync } from '@/hooks/useBiometricSync';
import {
  runIntelligenceEngine,
  getCategoryLabel,
  getUrgencyLabel,
  getSystemLabel,
  type BiometricInputs,
  type ProtocolRecommendation,
  type UrgencyLevel,
} from '@/lib/IntelligenceEngine';
import {
  runBioIntelligence,
  getStatusColor,
  getStatusLabel,
  getTrendIcon,
  getTrendColor,
  getUrgencyColor,
  type BioIntelligenceReport,
  type Intervention,
  type SystemAssessment,
  type RiskFlag,
  type BiomarkerTrend,
} from '@/lib/BioIntelligence';

/* ══════════════════════════════════════════════════════════════ */
/*  AI ASSISTANT — Collapsible Intelligence Drawer               */
/*  Insight Chips → BioIntelligence Brain → Terminal answers     */
/* ══════════════════════════════════════════════════════════════ */

/* ── Insight Chip Definition ── */
interface InsightChip {
  id: string;
  label: string;
  icon: string;
  color: string;
  query: string;
  relevance: (inputs: BiometricInputs) => number;
}

/* ── Conversation Message ── */
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  protocols?: ProtocolRecommendation[];
  interventions?: Intervention[];
  systemAssessments?: SystemAssessment[];
  riskFlags?: RiskFlag[];
  trends?: BiomarkerTrend[];
  isTyping?: boolean;
}

/* ── Generate dynamic insight chips based on current vitals ── */
function generateInsightChips(inputs: BiometricInputs): InsightChip[] {
  const chips: InsightChip[] = [
    {
      id: 'glucose',
      label: 'Why is my glucose high?',
      icon: '🩸',
      color: '#FF6B6B',
      query: 'Analyze my current metabolic state and explain why glucose may be elevated. What protocols can stabilize it?',
      relevance: (i) => {
        let s = 30;
        if (i.hba1c && i.hba1c > 5.7) s += 40;
        if (i.stress > 50) s += 15;
        if (i.sleepHours < 6) s += 15;
        return Math.min(100, s);
      },
    },
    {
      id: 'peptide-cycle',
      label: 'Optimize my peptide cycle',
      icon: '🧬',
      color: '#AF82FF',
      query: 'Based on my current biometrics, which peptides should I prioritize and what is the optimal cycling protocol?',
      relevance: (i) => {
        let s = 25;
        if (i.hrv < 50) s += 30;
        if (i.recovery < 60) s += 25;
        if (i.crp && i.crp > 2) s += 20;
        return Math.min(100, s);
      },
    },
    {
      id: 'sleep-arch',
      label: 'Fix my sleep architecture',
      icon: '🌙',
      color: '#6B8AFF',
      query: 'My sleep data shows suboptimal patterns. What compounds and protocols will improve deep sleep and REM percentages?',
      relevance: (i) => {
        let s = 20;
        if (i.sleepHours < 7) s += 30;
        if (i.sleepScore < 70) s += 25;
        if (i.sleepDeepPct < 15) s += 15;
        if (i.sleepRemPct < 20) s += 10;
        return Math.min(100, s);
      },
    },
    {
      id: 'hrv-recovery',
      label: 'Why is my HRV dropping?',
      icon: '💓',
      color: '#00FFCC',
      query: 'My HRV has been trending down. What is causing autonomic nervous system suppression and how do I restore vagal tone?',
      relevance: (i) => {
        let s = 20;
        if (i.hrv < 40) s += 40;
        else if (i.hrv < 55) s += 25;
        if (i.stress > 60) s += 15;
        if (i.recovery < 50) s += 10;
        return Math.min(100, s);
      },
    },
    {
      id: 'inflammation',
      label: 'Reduce my inflammation',
      icon: '🔥',
      color: '#FF8C42',
      query: 'What does my inflammatory profile look like and which anti-inflammatory protocols should I deploy immediately?',
      relevance: (i) => {
        let s = 20;
        if (i.crp && i.crp > 3) s += 35;
        if (i.hrv < 45) s += 20;
        if (i.skinTemp > 37) s += 15;
        if (i.recovery < 40) s += 10;
        return Math.min(100, s);
      },
    },
    {
      id: 'cognitive',
      label: 'Boost my focus today',
      icon: '🧠',
      color: '#00DC82',
      query: 'Based on my current readiness and recovery, what nootropic stack and protocol will maximize cognitive performance today?',
      relevance: (i) => {
        let s = 30;
        if (i.bodyBattery < 50) s += 20;
        if (i.sleepScore < 65) s += 20;
        if (i.stress > 50) s += 15;
        if (i.readiness < 60) s += 15;
        return Math.min(100, s);
      },
    },
    {
      id: 'strain-recovery',
      label: 'Am I overtraining?',
      icon: '⚡',
      color: '#FFB86B',
      query: 'Analyze my strain-to-recovery ratio. Am I in a catabolic state? Should I deload or push through?',
      relevance: (i) => {
        let s = 20;
        if (i.strain > 14) s += 30;
        if (i.recovery < 50) s += 25;
        if (i.hrv < 40) s += 15;
        if (i.heartRate > 75) s += 10;
        return Math.min(100, s);
      },
    },
    {
      id: 'full-report',
      label: 'Full biological report',
      icon: '📊',
      color: '#00E5FF',
      query: 'Run a complete BioIntelligence analysis. Show me my system assessments, risk flags, trends, and top interventions.',
      relevance: () => 50,
    },
  ];

  return chips
    .map(c => ({ ...c, _score: c.relevance(inputs) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6)
    .map(({ _score, ...c }) => c);
}

/* ── Build a data-backed response from BioIntelligence Brain ── */
function buildResponse(query: string, inputs: BiometricInputs): {
  text: string;
  protocols: ProtocolRecommendation[];
  interventions: Intervention[];
  systemAssessments: SystemAssessment[];
  riskFlags: RiskFlag[];
  trends: BiomarkerTrend[];
} {
  // Run the full BioIntelligence Brain
  const report = runBioIntelligence(inputs);
  const { state, interventions, todayPriorities, executiveSummary, baseProtocols } = report;

  // Build contextual vitals summary
  const vitalsBlock = [
    `HRV: ${inputs.hrv}ms`,
    `HR: ${inputs.heartRate} bpm`,
    `Sleep: ${inputs.sleepHours}h (Score: ${inputs.sleepScore})`,
    `Deep: ${inputs.sleepDeepPct}% | REM: ${inputs.sleepRemPct}%`,
    `Recovery: ${inputs.recovery}%`,
    `Stress: ${inputs.stress}`,
    `SpO2: ${inputs.spo2}%`,
    `Strain: ${inputs.strain}`,
    `Body Battery: ${inputs.bodyBattery}`,
    `Readiness: ${inputs.readiness}`,
    inputs.cortisol !== undefined ? `Cortisol: ${inputs.cortisol} ng/dL` : null,
    inputs.crp !== undefined ? `CRP: ${inputs.crp} mg/L` : null,
    inputs.vitaminD !== undefined ? `Vitamin D: ${inputs.vitaminD} ng/mL` : null,
    inputs.ferritin !== undefined ? `Ferritin: ${inputs.ferritin} ng/mL` : null,
  ].filter(Boolean).join(' | ');

  const qLower = query.toLowerCase();
  let analysisHeader = '> BIOINTELLIGENCE ANALYSIS COMPLETE';
  let contextualInsight = '';

  // ── Full report mode ──
  if (qLower.includes('full') && (qLower.includes('report') || qLower.includes('analysis'))) {
    analysisHeader = '> COMPREHENSIVE BIOLOGICAL ASSESSMENT';
    const systemLines = state.systems.map(s =>
      `  ${s.icon} ${s.label}: ${s.score}/100 [${getStatusLabel(s.status)}]`
    ).join('\n');
    const riskLines = state.riskFlags.length > 0
      ? state.riskFlags.map(f => `  ${f.icon} ${f.message}`).join('\n')
      : '  ✅ No critical risk flags';
    const trendLines = state.trends.map(t =>
      `  ${getTrendIcon(t.trend)} ${t.marker}: ${t.current} (7d avg: ${t.average7d}, slope: ${t.slope > 0 ? '+' : ''}${t.slope}/day)`
    ).join('\n');
    contextualInsight = [
      `COMPOSITE SCORE: ${state.compositeScore}/100`,
      `PRIMARY CONCERN: ${state.primaryConcern}`,
      ``,
      `── SYSTEM ASSESSMENTS ──`,
      systemLines,
      ``,
      `── RISK FLAGS ──`,
      riskLines,
      ``,
      `── 7-DAY TRENDS ──`,
      trendLines,
      ``,
      `── TODAY'S PRIORITIES ──`,
      ...todayPriorities.map((p, i) => `  ${i + 1}. ${p}`),
      ``,
      `── EXECUTIVE SUMMARY ──`,
      executiveSummary,
    ].join('\n');

    // Return top interventions
    const topInterventions = interventions.slice(0, 5);
    const protocolLines = topInterventions.map(r => {
      const urgencyTag = r.urgency === 'critical' ? '🔴' : r.urgency === 'high' ? '🟠' : r.urgency === 'moderate' ? '🟡' : '🟢';
      return [
        ``,
        `${urgencyTag} [${r.category.toUpperCase()}] ${r.name}`,
        `   Confidence: ${r.confidence}% | Target: ${getSystemLabel(r.systemTarget)}`,
        `   ${r.rationale.slice(0, 200)}${r.rationale.length > 200 ? '...' : ''}`,
        `   Triggers: ${r.triggers.join(', ')}`,
      ].join('\n');
    }).join('\n');

    const fullText = [
      analysisHeader,
      `> Timestamp: ${new Date().toISOString()}`,
      `> Vitals: ${vitalsBlock}`,
      ``,
      contextualInsight,
      protocolLines,
      ``,
      `── ${topInterventions.length} interventions matched from ${interventions.length} evaluated ──`,
    ].join('\n');

    return {
      text: fullText,
      protocols: baseProtocols.slice(0, 3),
      interventions: topInterventions,
      systemAssessments: state.systems,
      riskFlags: state.riskFlags,
      trends: state.trends,
    };
  }

  // ── Topic-specific analysis ──
  if (qLower.includes('glucose') || qLower.includes('metabolic')) {
    analysisHeader = '> METABOLIC STATE ANALYSIS';
    const metabSystem = state.systems.find(s => s.system === 'metabolic');
    const stressImpact = inputs.stress > 50 ? 'Elevated cortisol from stress is driving hepatic glucose output via gluconeogenesis.' : '';
    const sleepImpact = inputs.sleepHours < 7 ? `Sleep deficit (${inputs.sleepHours}h) impairs insulin sensitivity by ~25% per Stanford Sleep Lab data.` : '';
    contextualInsight = [
      `METABOLIC SYSTEM SCORE: ${metabSystem?.score ?? '?'}/100 [${metabSystem ? getStatusLabel(metabSystem.status) : 'UNKNOWN'}]`,
      ``,
      stressImpact,
      sleepImpact,
      inputs.hba1c && inputs.hba1c > 5.7 ? `HbA1c at ${inputs.hba1c}% indicates pre-diabetic glucose dysregulation.` : '',
      `Current readiness (${inputs.readiness}%) suggests ${inputs.readiness < 60 ? 'compromised' : 'adequate'} metabolic flexibility.`,
      ``,
      metabSystem?.insight ?? '',
    ].filter(Boolean).join('\n');
  } else if (qLower.includes('peptide') || qLower.includes('cycle')) {
    analysisHeader = '> PEPTIDE PROTOCOL OPTIMIZATION';
    const peptideInterventions = interventions.filter(i => i.category === 'peptide');
    contextualInsight = [
      `With HRV at ${inputs.hrv}ms and recovery at ${inputs.recovery}%, your autonomic nervous system is ${inputs.hrv < 45 ? 'significantly suppressed' : inputs.hrv < 60 ? 'suboptimal' : 'within range'}.`,
      inputs.crp && inputs.crp > 2 ? `CRP at ${inputs.crp} mg/L indicates active systemic inflammation — prioritize anti-inflammatory peptides.` : 'Inflammatory markers within range — focus on performance optimization peptides.',
      ``,
      `${peptideInterventions.length} peptide protocols matched your current biometric profile:`,
      ...peptideInterventions.map(p => `  • ${p.name} (${p.confidence}% confidence) — ${p.triggers[0] || ''}`),
    ].join('\n');
  } else if (qLower.includes('sleep')) {
    analysisHeader = '> SLEEP ARCHITECTURE ANALYSIS';
    const sleepSystem = state.systems.find(s => s.system === 'sleep_architecture');
    const sleepTrend = state.trends.find(t => t.marker === 'sleepScore');
    contextualInsight = [
      `SLEEP SYSTEM SCORE: ${sleepSystem?.score ?? '?'}/100 [${sleepSystem ? getStatusLabel(sleepSystem.status) : 'UNKNOWN'}]`,
      ``,
      `Deep sleep at ${inputs.sleepDeepPct}% ${inputs.sleepDeepPct < 15 ? '(BELOW threshold — glymphatic clearance compromised)' : '(adequate)'}.`,
      `REM at ${inputs.sleepRemPct}% ${inputs.sleepRemPct < 20 ? '(BELOW threshold — memory consolidation impaired)' : '(within range)'}.`,
      `Total sleep ${inputs.sleepHours}h with score ${inputs.sleepScore}/100.`,
      sleepTrend ? `7-day trend: ${getTrendIcon(sleepTrend.trend)} ${sleepTrend.trend} (slope: ${sleepTrend.slope > 0 ? '+' : ''}${sleepTrend.slope}/day)` : '',
      ``,
      sleepSystem?.insight ?? '',
    ].filter(Boolean).join('\n');
  } else if (qLower.includes('hrv') || qLower.includes('vagal')) {
    analysisHeader = '> AUTONOMIC NERVOUS SYSTEM ANALYSIS';
    const nervousSystem = state.systems.find(s => s.system === 'nervous_system');
    const hrvTrend = state.trends.find(t => t.marker === 'hrv');
    contextualInsight = [
      `ANS SCORE: ${nervousSystem?.score ?? '?'}/100 [${nervousSystem ? getStatusLabel(nervousSystem.status) : 'UNKNOWN'}]`,
      ``,
      `HRV at ${inputs.hrv}ms indicates ${inputs.hrv < 35 ? 'CRITICAL sympathetic dominance' : inputs.hrv < 50 ? 'suboptimal parasympathetic tone' : 'adequate autonomic balance'}.`,
      `Resting HR ${inputs.heartRate} bpm ${inputs.heartRate > 75 ? '(elevated — possible overtraining or inflammation)' : '(normal range)'}.`,
      `Respiratory rate ${inputs.respiratoryRate}/min ${inputs.respiratoryRate > 18 ? '(elevated — stress response active)' : '(normal)'}.`,
      hrvTrend ? `7-day HRV trend: ${getTrendIcon(hrvTrend.trend)} ${hrvTrend.trend} (avg: ${hrvTrend.average7d}ms, volatility: ${hrvTrend.volatility})` : '',
      ``,
      nervousSystem?.insight ?? '',
    ].filter(Boolean).join('\n');
  } else if (qLower.includes('inflam')) {
    analysisHeader = '> INFLAMMATORY PROFILE ANALYSIS';
    const immuneSystem = state.systems.find(s => s.system === 'immune');
    contextualInsight = [
      `IMMUNE SYSTEM SCORE: ${immuneSystem?.score ?? '?'}/100 [${immuneSystem ? getStatusLabel(immuneSystem.status) : 'UNKNOWN'}]`,
      ``,
      inputs.crp !== undefined ? `CRP at ${inputs.crp} mg/L ${inputs.crp > 3 ? '— ELEVATED. Active systemic inflammation detected.' : inputs.crp > 1 ? '— borderline. Low-grade inflammation present.' : '— within optimal range.'}` : 'CRP data unavailable — recommend lab panel.',
      `HRV suppression (${inputs.hrv}ms) ${inputs.hrv < 50 ? 'correlates with inflammatory burden on vagal nerve.' : 'is within acceptable range.'}`,
      ``,
      immuneSystem?.insight ?? '',
    ].filter(Boolean).join('\n');
  } else if (qLower.includes('focus') || qLower.includes('cognitive') || qLower.includes('nootropic')) {
    analysisHeader = '> COGNITIVE PERFORMANCE ANALYSIS';
    const cogSystem = state.systems.find(s => s.system === 'cognitive');
    contextualInsight = [
      `COGNITIVE SCORE: ${cogSystem?.score ?? '?'}/100 [${cogSystem ? getStatusLabel(cogSystem.status) : 'UNKNOWN'}]`,
      ``,
      `Body battery at ${inputs.bodyBattery}% with readiness ${inputs.readiness}%.`,
      inputs.bodyBattery < 50 ? 'Energy reserves depleted — stimulant protocols carry crash risk.' : 'Adequate energy for sustained focus.',
      `Sleep quality (${inputs.sleepScore}/100) ${inputs.sleepScore < 65 ? 'is suboptimal — expect reduced working memory and executive function.' : 'supports cognitive performance.'}`,
      ``,
      cogSystem?.insight ?? '',
    ].filter(Boolean).join('\n');
  } else if (qLower.includes('overtrain') || qLower.includes('strain') || qLower.includes('deload')) {
    analysisHeader = '> STRAIN-RECOVERY ANALYSIS';
    const strainTrend = state.trends.find(t => t.marker === 'strain');
    const recoveryTrend = state.trends.find(t => t.marker === 'recovery');
    contextualInsight = [
      `Strain at ${inputs.strain}/21 with recovery ${inputs.recovery}%.`,
      inputs.strain > 14 && inputs.recovery < 50 ? 'CRITICAL: Strain-to-recovery ratio indicates catabolic state. Deload recommended.' : inputs.strain > 12 ? 'Moderate strain — monitor recovery closely.' : 'Strain within sustainable range.',
      `HRV trend (${inputs.hrv}ms) ${inputs.hrv < 40 ? 'confirms overreaching — parasympathetic suppression detected.' : 'does not indicate overtraining.'}`,
      strainTrend ? `Strain trend: ${getTrendIcon(strainTrend.trend)} ${strainTrend.trend}` : '',
      recoveryTrend ? `Recovery trend: ${getTrendIcon(recoveryTrend.trend)} ${recoveryTrend.trend}` : '',
    ].filter(Boolean).join('\n');
  } else {
    // General query — use executive summary
    contextualInsight = [
      `COMPOSITE SCORE: ${state.compositeScore}/100`,
      ``,
      executiveSummary,
      ``,
      state.riskFlags.length > 0 ? `⚠️ ${state.riskFlags.length} risk flag${state.riskFlags.length > 1 ? 's' : ''} detected:` : '',
      ...state.riskFlags.slice(0, 3).map(f => `  ${f.icon} ${f.message}`),
    ].filter(Boolean).join('\n');
  }

  // Build intervention summaries (use BioIntelligence interventions, not just base protocols)
  const topInterventions = interventions.slice(0, 4);
  const protocolLines = topInterventions.map(r => {
    const urgencyTag = r.urgency === 'critical' ? '🔴' : r.urgency === 'high' ? '🟠' : r.urgency === 'moderate' ? '🟡' : '🟢';
    return [
      ``,
      `${urgencyTag} [${r.category.toUpperCase()}] ${r.name}`,
      `   Confidence: ${r.confidence}% | Target: ${getSystemLabel(r.systemTarget)}`,
      `   ${r.rationale.slice(0, 180)}${r.rationale.length > 180 ? '...' : ''}`,
      `   Triggers: ${r.triggers.join(', ')}`,
      `   Dosing: ${r.dosing}`,
      `   Timing: ${r.timing}`,
    ].join('\n');
  }).join('\n');

  const fullText = [
    analysisHeader,
    `> Timestamp: ${new Date().toISOString()}`,
    `> Composite: ${state.compositeScore}/100 | Vitals: ${vitalsBlock}`,
    ``,
    contextualInsight,
    protocolLines,
    ``,
    topInterventions.length > 0 ? `── ${topInterventions.length} interventions matched from ${interventions.length} evaluated ──` : '── No interventions matched current thresholds ──',
  ].join('\n');

  return {
    text: fullText,
    protocols: baseProtocols.slice(0, 3),
    interventions: topInterventions,
    systemAssessments: state.systems,
    riskFlags: state.riskFlags,
    trends: state.trends,
  };
}

/* ── Typing animation hook ── */
function useTypingAnimation(text: string, isActive: boolean, speed: number = 8) {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayed(text);
      setIsDone(true);
      return;
    }
    setDisplayed('');
    setIsDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      const chunk = Math.min(i * 3, text.length);
      setDisplayed(text.slice(0, chunk));
      if (chunk >= text.length) {
        setIsDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, isActive, speed]);

  return { displayed, isDone };
}

/* ══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                               */
/* ══════════════════════════════════════════════════════════════ */

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const { vitals } = useBiometricSync();

  const bioInputs: BiometricInputs = useMemo(() => ({
    hrv: vitals.hrv,
    heartRate: vitals.heartRate,
    sleepHours: vitals.sleepHours,
    sleepScore: vitals.sleepScore,
    sleepDeepPct: vitals.sleepDeepPct,
    sleepRemPct: vitals.sleepRemPct,
    recovery: vitals.recovery,
    stress: vitals.stress,
    spo2: vitals.spo2,
    bodyBattery: vitals.bodyBattery,
    strain: vitals.strain,
    skinTemp: vitals.skinTemp,
    respiratoryRate: vitals.respiratoryRate,
    steps: vitals.steps,
    readiness: vitals.readiness,
  }), [vitals]);

  // Run BioIntelligence for the header composite score
  const bioReport = useMemo(() => runBioIntelligence(bioInputs), [bioInputs]);

  const insightChips = useMemo(() => generateInsightChips(bioInputs), [bioInputs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleQuery = useCallback((query: string) => {
    if (!query.trim() || isProcessing) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    setTimeout(() => {
      const { text, protocols, interventions, systemAssessments, riskFlags, trends } = buildResponse(query, bioInputs);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
        protocols,
        interventions,
        systemAssessments,
        riskFlags,
        trends,
        isTyping: true,
      };

      setMessages(prev => [...prev, assistantMsg]);
      setIsProcessing(false);
    }, 600 + Math.random() * 800);
  }, [bioInputs, isProcessing]);

  const handleChipClick = useCallback((chip: InsightChip) => {
    handleQuery(chip.query);
  }, [handleQuery]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(inputValue);
  }, [inputValue, handleQuery]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setIsOpen(o => !o);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const readinessColor = vitals.readiness >= 80 ? '#00FFCC' : vitals.readiness >= 60 ? '#6B8AFF' : vitals.readiness >= 40 ? '#FFB86B' : '#FF6B6B';
  const compositeColor = bioReport.state.compositeScore >= 75 ? '#00FFCC' : bioReport.state.compositeScore >= 55 ? '#6B8AFF' : bioReport.state.compositeScore >= 35 ? '#FFB86B' : '#FF6B6B';

  return (
    <>
      {/* ── FAB Toggle Button ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-[9998] group"
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: isOpen
            ? 'linear-gradient(135deg, rgba(255,107,107,0.2) 0%, rgba(255,107,107,0.1) 100%)'
            : 'linear-gradient(135deg, rgba(0,240,255,0.15) 0%, rgba(175,130,255,0.1) 100%)',
          border: `1px solid ${isOpen ? 'rgba(255,107,107,0.3)' : 'rgba(0,240,255,0.2)'}`,
          boxShadow: isOpen
            ? '0 4px 24px rgba(255,107,107,0.2), 0 0 40px rgba(255,107,107,0.05)'
            : '0 4px 24px rgba(0,240,255,0.15), 0 0 40px rgba(0,240,255,0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        <div className="flex items-center justify-center w-full h-full relative">
          {isOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,107,107,0.9)" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="3" fill="rgba(0,240,255,0.4)" stroke="rgba(0,240,255,0.6)" strokeWidth="1" />
                <path d="M12 5v2M12 17v2M5 12h2M17 12h2" stroke="rgba(175,130,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M7.05 7.05l1.41 1.41M15.54 15.54l1.41 1.41M7.05 16.95l1.41-1.41M15.54 8.46l1.41-1.41" stroke="rgba(0,240,255,0.3)" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{
                background: readinessColor,
                boxShadow: `0 0 8px ${readinessColor}88`,
                animation: 'aiDotPulse 2s ease-in-out infinite',
              }} />
            </>
          )}
        </div>
      </button>

      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999]"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            animation: 'aiFadeIn 0.2s ease',
          }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Drawer ── */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 z-[10000] flex flex-col"
        style={{
          maxHeight: '85vh',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'linear-gradient(180deg, rgba(8,10,16,0.98) 0%, rgba(6,8,12,0.99) 100%)',
          borderTop: '1px solid rgba(0,240,255,0.1)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 -2px 20px rgba(0,240,255,0.05)',
        }}
      >
        {/* ── Drag Handle ── */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(0,240,255,0.15)' }} />
        </div>

        {/* ── Header ── */}
        <div className="px-5 pb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(0,240,255,0.1) 0%, rgba(175,130,255,0.08) 100%)',
            border: '1px solid rgba(0,240,255,0.15)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3" fill="rgba(0,240,255,0.3)" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>
                BIOINTELLIGENCE
              </span>
              <div className="px-1.5 py-0.5 rounded" style={{
                background: `${compositeColor}12`,
                border: `1px solid ${compositeColor}25`,
              }}>
                <span className="font-mono text-[8px] tracking-widest" style={{ color: compositeColor }}>
                  {bioReport.state.compositeScore}/100
                </span>
              </div>
              {bioReport.state.riskFlags.length > 0 && (
                <div className="px-1.5 py-0.5 rounded" style={{
                  background: 'rgba(255,107,107,0.1)',
                  border: '1px solid rgba(255,107,107,0.2)',
                }}>
                  <span className="font-mono text-[8px] tracking-widest" style={{ color: '#FF6B6B' }}>
                    {bioReport.state.riskFlags.length} FLAG{bioReport.state.riskFlags.length > 1 ? 'S' : ''}
                  </span>
                </div>
              )}
            </div>
            <span className="font-mono text-[9px]" style={{ color: 'rgba(0,240,255,0.3)' }}>
              Readiness {vitals.readiness}% &middot; HRV {vitals.hrv}ms &middot; HR {vitals.heartRate}bpm
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Messages Area ── */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0" style={{ maxHeight: 'calc(85vh - 220px)' }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{
                background: 'radial-gradient(circle, rgba(0,240,255,0.06) 0%, transparent 70%)',
                border: '1px solid rgba(0,240,255,0.06)',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="rgba(0,240,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {/* Mini system status bar */}
              <div className="flex gap-1.5 mb-3 flex-wrap justify-center">
                {bioReport.state.systems.slice(0, 4).map(sys => (
                  <div key={sys.system} className="flex items-center gap-1 px-2 py-1 rounded-md" style={{
                    background: `${getStatusColor(sys.status)}08`,
                    border: `1px solid ${getStatusColor(sys.status)}15`,
                  }}>
                    <span className="text-[10px]">{sys.icon}</span>
                    <span className="font-mono text-[7px]" style={{ color: getStatusColor(sys.status) }}>
                      {sys.score}
                    </span>
                  </div>
                ))}
              </div>
              <span className="font-mono text-xs mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Ask me anything about your biology
              </span>
              <span className="font-mono text-[9px]" style={{ color: 'rgba(0,240,255,0.25)' }}>
                Tap a chip below or type a question &middot; ⌘I to toggle
              </span>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                        background: 'rgba(0,240,255,0.5)',
                        animation: `aiTypingDot 1.2s ease-in-out ${i * 0.15}s infinite`,
                      }} />
                    ))}
                  </div>
                  <span className="font-mono text-[9px]" style={{ color: 'rgba(0,240,255,0.3)' }}>
                    Running BioIntelligence analysis...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Insight Chips ── */}
        <div className="px-5 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {insightChips.map(chip => (
              <button
                key={chip.id}
                onClick={() => handleChipClick(chip)}
                disabled={isProcessing}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl group active:scale-[0.97] transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${chip.color}22`,
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                <span className="text-sm">{chip.icon}</span>
                <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: `${chip.color}cc` }}>
                  {chip.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Input Bar ── */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-1">
          <div className="flex items-center gap-2 rounded-xl px-4 py-3" style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(0,240,255,0.08)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,240,255,0.3)" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Ask about your biology..."
              disabled={isProcessing}
              className="flex-1 bg-transparent outline-none font-mono text-xs"
              style={{ color: 'rgba(255,255,255,0.8)', caretColor: 'rgba(0,240,255,0.6)' }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isProcessing}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
              style={{
                background: inputValue.trim() ? 'rgba(0,240,255,0.12)' : 'transparent',
                border: `1px solid ${inputValue.trim() ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.05)'}`,
                opacity: inputValue.trim() ? 1 : 0.3,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={inputValue.trim() ? 'rgba(0,240,255,0.8)' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-center mt-2 gap-1.5">
            <span className="font-mono text-[8px] tracking-wider" style={{ color: 'rgba(0,240,255,0.2)' }}>
              POWERED BY BIOINTELLIGENCE ENGINE
            </span>
            <span className="font-mono text-[8px]" style={{ color: 'rgba(0,240,255,0.12)' }}>&middot;</span>
            <span className="font-mono text-[8px]" style={{ color: 'rgba(0,240,255,0.15)' }}>⌘I</span>
          </div>
        </form>
      </div>

      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes aiFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes aiDotPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes aiTypingDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes aiCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  MESSAGE BUBBLE — Terminal-style rendering                    */
/* ══════════════════════════════════════════════════════════════ */

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const { displayed, isDone } = useTypingAnimation(
    message.content,
    !isUser && !!message.isTyping,
    6
  );

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5" style={{
          background: 'linear-gradient(135deg, rgba(0,240,255,0.1) 0%, rgba(175,130,255,0.08) 100%)',
          border: '1px solid rgba(0,240,255,0.15)',
        }}>
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {message.content}
          </p>
          <span className="font-mono text-[7px] block mt-1" style={{ color: 'rgba(0,240,255,0.2)' }}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] w-full">
        {/* Terminal header */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{
            background: 'rgba(0,240,255,0.08)',
            border: '1px solid rgba(0,240,255,0.12)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,240,255,0.6)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span className="font-mono text-[8px] tracking-widest" style={{ color: 'rgba(0,240,255,0.4)' }}>
            BIOINTELLIGENCE
          </span>
          <span className="font-mono text-[7px] ml-auto" style={{ color: 'rgba(0,240,255,0.15)' }}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Terminal body */}
        <div className="rounded-xl overflow-hidden" style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(0,240,255,0.06)',
        }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5" style={{
            background: 'rgba(0,240,255,0.03)',
            borderBottom: '1px solid rgba(0,240,255,0.05)',
          }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#FF6B6B' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#FFB86B' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#00DC82' }} />
            <span className="font-mono text-[7px] ml-2 tracking-wider" style={{ color: 'rgba(0,240,255,0.25)' }}>
              biointelligence.analysis
            </span>
          </div>

          <div className="px-3.5 py-3 overflow-x-auto">
            <pre className="font-mono text-[10px] leading-[1.7] whitespace-pre-wrap break-words" style={{
              color: 'rgba(0,240,255,0.75)',
              textShadow: '0 0 8px rgba(0,240,255,0.1)',
            }}>
              {displayed}
              {!isDone && (
                <span className="inline-block w-1.5 h-3 ml-0.5 align-middle" style={{
                  background: 'rgba(0,240,255,0.6)',
                  animation: 'aiCursorBlink 0.8s step-end infinite',
                }} />
              )}
            </pre>
          </div>
        </div>

        {/* System assessment mini-bars (shown after typing completes) */}
        {isDone && message.systemAssessments && message.systemAssessments.length > 0 && (
          <div className="mt-2 rounded-lg overflow-hidden" style={{
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(0,240,255,0.05)',
          }}>
            <div className="px-3 py-1.5" style={{ borderBottom: '1px solid rgba(0,240,255,0.04)' }}>
              <span className="font-mono text-[7px] tracking-widest" style={{ color: 'rgba(0,240,255,0.3)' }}>
                SYSTEM STATUS
              </span>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              {message.systemAssessments.slice(0, 6).map(sys => (
                <div key={sys.system} className="flex items-center gap-2">
                  <span className="text-[10px] w-4 text-center">{sys.icon}</span>
                  <span className="font-mono text-[8px] w-20 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {sys.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${sys.score}%`,
                      background: getStatusColor(sys.status),
                      opacity: 0.7,
                    }} />
                  </div>
                  <span className="font-mono text-[8px] w-8 text-right" style={{ color: getStatusColor(sys.status) }}>
                    {sys.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk flags (shown after typing completes) */}
        {isDone && message.riskFlags && message.riskFlags.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {message.riskFlags.slice(0, 3).map(flag => (
              <div key={flag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
                background: flag.severity === 'critical' ? 'rgba(255,107,107,0.06)' : 'rgba(255,184,107,0.06)',
                border: `1px solid ${flag.severity === 'critical' ? 'rgba(255,107,107,0.12)' : 'rgba(255,184,107,0.12)'}`,
              }}>
                <span className="text-[10px]">{flag.icon}</span>
                <span className="font-mono text-[8px]" style={{
                  color: flag.severity === 'critical' ? 'rgba(255,107,107,0.8)' : 'rgba(255,184,107,0.8)',
                }}>
                  {flag.message}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Intervention cards (shown after typing completes) */}
        {isDone && message.interventions && message.interventions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.interventions.map(intervention => (
              <InterventionCard key={intervention.id} intervention={intervention} />
            ))}
          </div>
        )}

        {/* Legacy protocol cards fallback */}
        {isDone && (!message.interventions || message.interventions.length === 0) && message.protocols && message.protocols.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.protocols.map(protocol => (
              <ProtocolMiniCard key={protocol.id} protocol={protocol} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  INTERVENTION CARD — BioIntelligence-powered recommendation   */
/* ══════════════════════════════════════════════════════════════ */

function InterventionCard({ intervention }: { intervention: Intervention }) {
  const [expanded, setExpanded] = useState(false);
  const urgencyColor = getUrgencyColor(intervention.urgency);

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className="w-full text-left rounded-lg overflow-hidden transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${urgencyColor}18`,
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="text-sm flex-shrink-0">{intervention.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-semibold truncate" style={{ color: intervention.color }}>
              {intervention.name}
            </span>
            <span className="font-mono text-[7px] px-1 py-0.5 rounded flex-shrink-0" style={{
              background: `${urgencyColor}15`,
              color: urgencyColor,
              border: `1px solid ${urgencyColor}25`,
            }}>
              {intervention.confidence}%
            </span>
            <span className="font-mono text-[6px] px-1 py-0.5 rounded flex-shrink-0" style={{
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.3)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {intervention.category.toUpperCase()}
            </span>
          </div>
          <span className="font-mono text-[8px] block truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {intervention.triggers[0] || intervention.rationale.slice(0, 80)}
          </span>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: `1px solid ${urgencyColor}10` }}>
          <div>
            <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
              SCIENTIFIC RATIONALE
            </span>
            <p className="font-mono text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {intervention.rationale}
            </p>
          </div>
          <div>
            <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
              MECHANISM OF ACTION
            </span>
            <p className="font-mono text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {intervention.mechanism.slice(0, 300)}{intervention.mechanism.length > 300 ? '...' : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
                DOSING
              </span>
              <p className="font-mono text-[8px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {intervention.dosing}
              </p>
            </div>
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
                TIMING
              </span>
              <p className="font-mono text-[8px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {intervention.timing}
              </p>
            </div>
          </div>
          <div>
            <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
              EXPECTED OUTCOMES
            </span>
            {intervention.expectedOutcomes.map((o, i) => (
              <p key={i} className="font-mono text-[8px] leading-relaxed" style={{ color: 'rgba(0,240,255,0.5)' }}>
                • {o}
              </p>
            ))}
          </div>
          {intervention.synergies.length > 0 && (
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
                SYNERGIES
              </span>
              <div className="flex flex-wrap gap-1">
                {intervention.synergies.map((s, i) => (
                  <span key={i} className="font-mono text-[7px] px-1.5 py-0.5 rounded" style={{
                    background: 'rgba(0,240,255,0.05)',
                    border: '1px solid rgba(0,240,255,0.1)',
                    color: 'rgba(0,240,255,0.5)',
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {intervention.cautions.length > 0 && (
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(255,184,107,0.4)' }}>
                CAUTIONS
              </span>
              {intervention.cautions.map((c, i) => (
                <p key={i} className="font-mono text-[7px] leading-relaxed" style={{ color: 'rgba(255,184,107,0.4)' }}>
                  ⚠ {c}
                </p>
              ))}
            </div>
          )}
          {intervention.citations.length > 0 && (
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
                CITATIONS
              </span>
              {intervention.citations.map((c, i) => (
                <p key={i} className="font-mono text-[7px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  [{i + 1}] {c.authors} — {c.title}. <em>{c.journal}</em> ({c.year})
                  {c.doi && <span style={{ color: 'rgba(0,240,255,0.3)' }}> doi:{c.doi}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  PROTOCOL MINI CARD — Legacy fallback for base engine         */
/* ══════════════════════════════════════════════════════════════ */

function ProtocolMiniCard({ protocol }: { protocol: ProtocolRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  const urgencyColor = protocol.urgency === 'critical' ? '#FF6B6B'
    : protocol.urgency === 'high' ? '#FF8C42'
    : protocol.urgency === 'moderate' ? '#FFB86B'
    : '#00FFCC';

  return (
    <button
      onClick={() => setExpanded(e => !e)}
      className="w-full text-left rounded-lg overflow-hidden transition-all duration-200"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${urgencyColor}18`,
      }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <span className="text-sm flex-shrink-0">{protocol.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-semibold truncate" style={{ color: protocol.color }}>
              {protocol.name}
            </span>
            <span className="font-mono text-[7px] px-1 py-0.5 rounded flex-shrink-0" style={{
              background: `${urgencyColor}15`,
              color: urgencyColor,
              border: `1px solid ${urgencyColor}25`,
            }}>
              {protocol.confidence}%
            </span>
          </div>
          <span className="font-mono text-[8px] block truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {protocol.headline}
          </span>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: `1px solid ${urgencyColor}10` }}>
          <div>
            <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
              SCIENTIFIC RATIONALE
            </span>
            <p className="font-mono text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {protocol.rationale}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
                DOSING
              </span>
              <p className="font-mono text-[8px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {protocol.dosing}
              </p>
            </div>
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
                TIMING
              </span>
              <p className="font-mono text-[8px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {protocol.timing}
              </p>
            </div>
          </div>
          <div>
            <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
              EXPECTED OUTCOME
            </span>
            <p className="font-mono text-[8px] leading-relaxed" style={{ color: 'rgba(0,240,255,0.5)' }}>
              {protocol.expectedOutcome}
            </p>
          </div>
          {protocol.citations.length > 0 && (
            <div>
              <span className="font-mono text-[7px] tracking-wider block mb-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>
                CITATIONS
              </span>
              {protocol.citations.map((c, i) => (
                <p key={i} className="font-mono text-[7px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  [{i + 1}] {c.authors} — {c.title}. <em>{c.journal}</em> ({c.year})
                  {c.doi && <span style={{ color: 'rgba(0,240,255,0.3)' }}> doi:{c.doi}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export default AIAssistant;
