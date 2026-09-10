import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkline } from '@/components/Sparkline';

/* ══════════════════════════════════════════════════════════════
   BiometricDetail — Deep-Dive Modal for Data Ingestion Metrics
   
   Opens when a user clicks a metric in the Data Ingestion header.
   Shows a 7-day trend sparkline, "Why it matters" medical-grade
   analysis, and a "Recommended Correction" button that scrolls
   to the relevant product in the Optimization Store.
   ══════════════════════════════════════════════════════════════ */

/* ── Midnight Palette ── */
const M = {
  bg: 'rgba(6,6,10,0.97)',
  card: 'rgba(12,12,18,0.95)',
  cardBorder: 'rgba(255,255,255,0.06)',
  text: '#E8E8F0',
  textSec: 'rgba(255,255,255,0.55)',
  textDim: 'rgba(255,255,255,0.28)',
  green: '#00FFCC',
  greenDim: 'rgba(0,255,204,0.12)',
  amber: '#FFB86B',
  amberDim: 'rgba(255,184,107,0.12)',
  red: '#FF6B6B',
  redDim: 'rgba(255,107,107,0.10)',
  blue: '#6B8AFF',
  blueDim: 'rgba(107,138,255,0.10)',
  border: 'rgba(255,255,255,0.05)',
  glass: 'rgba(16,16,22,0.92)',
};

/* ── Metric Definitions ── */
interface MetricDef {
  key: string;
  label: string;
  fullLabel: string;
  unit: string;
  icon: string;
  color: string;
  colorDim: string;
  optimalRange: [number, number];
  baseValue: number;
  variance: number;
  /** Source device */
  source: 'oura' | 'whoop' | 'biotech';
  sourceLabel: string;
  /** Medical-grade "Why it matters" explanation */
  whyItMatters: string;
  /** Performance link explanation */
  performanceLink: string;
  /** Recommended correction action */
  correction: {
    action: string;
    detail: string;
    /** Product ID in OptimizationStore to scroll to */
    productId: string;
    productName: string;
  };
  /** Factors that influence this metric */
  factors: { label: string; impact: string; direction: 'positive' | 'negative' }[];
}

const METRICS: MetricDef[] = [
  {
    key: 'hrv',
    label: 'HRV',
    fullLabel: 'Heart Rate Variability',
    unit: 'ms',
    icon: '💚',
    color: M.green,
    colorDim: M.greenDim,
    optimalRange: [45, 120],
    baseValue: 58,
    variance: 8,
    source: 'oura',
    sourceLabel: 'Oura Ring',
    whyItMatters: 'HRV measures the variation in time between heartbeats, reflecting your autonomic nervous system balance. Higher HRV indicates parasympathetic dominance — your body\'s "rest and repair" mode. It\'s the single most predictive biomarker for cardiovascular resilience, stress tolerance, and training readiness. A sustained drop below your 7-day baseline signals accumulated physiological stress that compounds recovery debt.',
    performanceLink: 'Each 5ms increase in resting HRV correlates with a 12% improvement in cognitive performance and a 9% reduction in perceived exertion during training. Athletes with HRV >60ms show 23% faster recovery between sessions.',
    correction: {
      action: 'Take Magnesium L-Threonate before bed',
      detail: 'Magtein® crosses the blood-brain barrier, enhancing vagal tone and parasympathetic activation during sleep. Clinical studies show +18% deep sleep improvement within 7 days.',
      productId: 'prod-magtein',
      productName: 'Magtein® Magnesium L-Threonate',
    },
    factors: [
      { label: 'Cold Exposure (3min)', impact: '+9% HRV', direction: 'positive' },
      { label: 'Box Breathing (5min)', impact: '+7ms acute', direction: 'positive' },
      { label: 'Alcohol (>2 drinks)', impact: '-18% overnight', direction: 'negative' },
      { label: 'Sleep Debt (>2hrs)', impact: '-15% baseline', direction: 'negative' },
    ],
  },
  {
    key: 'rhr',
    label: 'RHR',
    fullLabel: 'Resting Heart Rate',
    unit: 'BPM',
    icon: '❤️',
    color: '#FF6B6B',
    colorDim: M.redDim,
    optimalRange: [55, 72],
    baseValue: 64,
    variance: 5,
    source: 'whoop',
    sourceLabel: 'WHOOP 4.0',
    whyItMatters: 'Resting heart rate reflects your cardiac efficiency at baseline. A lower RHR indicates a stronger, more efficient heart that pumps more blood per beat. Elevated RHR (>5 BPM above your baseline) is an early warning signal for overtraining, dehydration, illness onset, or accumulated psychological stress. It\'s your body\'s "check engine light."',
    performanceLink: 'Every 5 BPM reduction in RHR correlates with a 15% increase in VO2max potential and a 20% improvement in endurance capacity. Elite athletes maintain RHR between 45-55 BPM.',
    correction: {
      action: 'Add ProOmega 2000 (EPA/DHA)',
      detail: 'High-concentration omega-3s reduce systemic inflammation via SPM pathways, directly lowering resting heart rate by 2-4 BPM within 4 weeks. EPA:DHA ratio of 2:1 is optimal for cardiac benefit.',
      productId: 'prod-omega-nordic',
      productName: 'ProOmega® 2000',
    },
    factors: [
      { label: 'Zone 2 Cardio (30min)', impact: '-3 BPM baseline', direction: 'positive' },
      { label: 'Meditation (20min)', impact: '-4 BPM average', direction: 'positive' },
      { label: 'High-Intensity Training', impact: '+8 BPM (24h)', direction: 'negative' },
      { label: 'Caffeine (>300mg)', impact: '+6 BPM acute', direction: 'negative' },
    ],
  },
  {
    key: 'sleep',
    label: 'Deep Sleep',
    fullLabel: 'Deep Sleep Duration',
    unit: 'hrs',
    icon: '🌙',
    color: '#6B8AFF',
    colorDim: M.blueDim,
    optimalRange: [1.5, 2.5],
    baseValue: 1.8,
    variance: 0.4,
    source: 'oura',
    sourceLabel: 'Oura Ring',
    whyItMatters: 'Deep sleep (N3/SWS) is when your body releases 70% of daily growth hormone, consolidates motor memory, and performs cellular repair. It\'s the most restorative sleep stage — irreplaceable by any supplement or biohack. Less than 1.5 hours of deep sleep per night accelerates biological aging by up to 2.3 years annually and impairs immune function by 40%.',
    performanceLink: 'Each additional 30 minutes of deep sleep correlates with a 14% improvement in next-day reaction time, 22% better emotional regulation, and 18% faster muscle protein synthesis.',
    correction: {
      action: 'Take Apigenin 50mg before bed',
      detail: 'Apigenin binds GABA-A receptors as a positive allosteric modulator, promoting slow-wave sleep without morning grogginess. Combined with magnesium, it extends deep sleep by 20-35 minutes.',
      productId: 'prod-apigenin',
      productName: 'Apigenin 50mg',
    },
    factors: [
      { label: 'Magnesium Glycinate', impact: '+18% deep sleep', direction: 'positive' },
      { label: 'Cold Room (65°F)', impact: '+11% SWS', direction: 'positive' },
      { label: 'Late Caffeine (>2pm)', impact: '-22min latency', direction: 'negative' },
      { label: 'Screen Time (blue light)', impact: '-14% deep sleep', direction: 'negative' },
    ],
  },
  {
    key: 'recovery',
    label: 'Recovery',
    fullLabel: 'Recovery Score',
    unit: '%',
    icon: '🔋',
    color: M.amber,
    colorDim: M.amberDim,
    optimalRange: [75, 100],
    baseValue: 72,
    variance: 10,
    source: 'whoop',
    sourceLabel: 'WHOOP 4.0',
    whyItMatters: 'Your recovery score is a composite index of HRV, RHR, respiratory rate, and sleep performance — representing your body\'s readiness for physiological stress. Training at <60% recovery increases injury risk by 3.2x and reduces adaptation by 45%. It\'s the difference between productive training and accumulated damage.',
    performanceLink: 'Athletes who train only on days with >70% recovery show 34% greater strength gains and 28% better endurance adaptation over 12 weeks compared to those who ignore recovery signals.',
    correction: {
      action: 'Take KSM-66® Ashwagandha',
      detail: 'KSM-66 reduces cortisol by 27.9% (double-blind RCT), directly improving recovery score by enhancing parasympathetic rebound. Full-spectrum root extract standardized to 5% withanolides.',
      productId: 'prod-ashwagandha',
      productName: 'KSM-66® Ashwagandha',
    },
    factors: [
      { label: 'Sauna (20min)', impact: '+8% recovery', direction: 'positive' },
      { label: 'Protein Timing (<30min)', impact: '+12% repair', direction: 'positive' },
      { label: 'Overtraining (>90min)', impact: '-15% recovery', direction: 'negative' },
      { label: 'Poor Sleep (<6hrs)', impact: '-22% recovery', direction: 'negative' },
    ],
  },
  {
    key: 'spo2',
    label: 'SpO2',
    fullLabel: 'Blood Oxygen Saturation',
    unit: '%',
    icon: '🫁',
    color: '#00D4FF',
    colorDim: 'rgba(0,212,255,0.10)',
    optimalRange: [97, 100],
    baseValue: 97.8,
    variance: 0.6,
    source: 'oura',
    sourceLabel: 'Oura Ring',
    whyItMatters: 'SpO2 measures the percentage of hemoglobin carrying oxygen. Sustained readings below 96% indicate impaired oxygen delivery to tissues, affecting mitochondrial ATP production, cognitive function, and exercise capacity. Overnight SpO2 dips below 94% may indicate sleep-disordered breathing requiring clinical evaluation.',
    performanceLink: 'Each 1% increase in baseline SpO2 correlates with a 3% improvement in aerobic capacity and a 7% reduction in perceived fatigue during sustained cognitive tasks.',
    correction: {
      action: 'Practice nasal breathing + add CoQ10',
      detail: 'Ubiquinol (QH-absorb®) optimizes mitochondrial electron transport chain efficiency, improving cellular oxygen utilization. Combined with nasal breathing protocols, SpO2 improves 0.5-1.2% within 2 weeks.',
      productId: 'prod-coq10',
      productName: 'QH-absorb® Ubiquinol',
    },
    factors: [
      { label: 'Nasal Breathing', impact: '+0.8% SpO2', direction: 'positive' },
      { label: 'Aerobic Fitness', impact: '+0.5% baseline', direction: 'positive' },
      { label: 'Altitude Change', impact: '-1.2% SpO2', direction: 'negative' },
      { label: 'Respiratory Infection', impact: '-3% SpO2', direction: 'negative' },
    ],
  },
  {
    key: 'strain',
    label: 'Strain',
    fullLabel: 'Daily Strain Index',
    unit: '',
    icon: '⚡',
    color: '#E8976C',
    colorDim: 'rgba(232,151,108,0.10)',
    optimalRange: [8, 14],
    baseValue: 11.2,
    variance: 3,
    source: 'whoop',
    sourceLabel: 'WHOOP 4.0',
    whyItMatters: 'Strain quantifies the total cardiovascular load your body experienced in the last 24 hours on a 0-21 scale. It accounts for exercise intensity, duration, and accumulated daily stress. Chronic strain >15 without adequate recovery leads to sympathetic overdrive, elevated cortisol, and progressive performance decline.',
    performanceLink: 'Optimal adaptation occurs when daily strain matches recovery capacity. Athletes who maintain a strain-to-recovery ratio of 0.8-1.2 show 40% better long-term performance gains.',
    correction: {
      action: 'Add Creatine Monohydrate 5g/day',
      detail: 'Creapure® creatine replenishes phosphocreatine stores depleted by high strain, improving recovery between efforts by 15%. Also provides neuroprotective benefits during high cognitive load.',
      productId: 'prod-creatine-thorne',
      productName: 'Creatine Monohydrate (Creapure®)',
    },
    factors: [
      { label: 'Active Recovery Walk', impact: '-2 strain pts', direction: 'positive' },
      { label: 'Adequate Sleep (>7h)', impact: 'Better tolerance', direction: 'positive' },
      { label: 'Consecutive HIIT Days', impact: '+4 strain compound', direction: 'negative' },
      { label: 'Psychological Stress', impact: '+2 hidden strain', direction: 'negative' },
    ],
  },
];

/* ── Generate 7-day trend data ── */
function generate7DayTrend(base: number, variance: number): number[] {
  const data: number[] = [];
  let v = base;
  for (let i = 0; i < 7; i++) {
    v += (Math.random() - 0.48) * variance;
    v = Math.max(base - variance * 2.5, Math.min(base + variance * 2.5, v));
    data.push(Math.round(v * 10) / 10);
  }
  return data;
}

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ══════════════════════════════════════════════════════════════
   BIOMETRIC DETAIL MODAL
   ══════════════════════════════════════════════════════════════ */

export interface BiometricDetailProps {
  /** Which metric to show — null means closed */
  metricKey: string | null;
  onClose: () => void;
}

export function BiometricDetail({ metricKey, onClose }: BiometricDetailProps) {
  const [visible, setVisible] = useState(false);
  const [entering, setEntering] = useState(false);

  const metric = useMemo(() => METRICS.find((m) => m.key === metricKey) || null, [metricKey]);

  const trendData = useMemo(() => {
    if (!metric) return [];
    return generate7DayTrend(metric.baseValue, metric.variance);
  }, [metricKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open/close animation
  useEffect(() => {
    if (metricKey) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntering(true));
      });
    } else {
      setEntering(false);
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
  }, [metricKey]);

  const handleClose = useCallback(() => {
    setEntering(false);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  }, [handleClose]);

  const handleScrollToProduct = useCallback(() => {
    if (!metric) return;
    handleClose();
    // Wait for modal to close, then scroll + highlight
    setTimeout(() => {
      const storeEl = document.getElementById('optimization-store');
      if (storeEl) storeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Dispatch highlight event for the specific product
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('vive-highlight-product', { detail: { productId: metric.correction.productId } })
        );
      }, 600);
    }, 350);
  }, [metric, handleClose]);

  if (!visible || !metric) return null;

  const current = trendData[trendData.length - 1] ?? metric.baseValue;
  const avg = trendData.length > 0 ? Math.round((trendData.reduce((s, v) => s + v, 0) / trendData.length) * 10) / 10 : metric.baseValue;
  const min = trendData.length > 0 ? Math.min(...trendData) : metric.baseValue;
  const max = trendData.length > 0 ? Math.max(...trendData) : metric.baseValue;
  const delta = avg > 0 ? ((current - avg) / avg) * 100 : 0;
  const inOptimal = current >= metric.optimalRange[0] && current <= metric.optimalRange[1];
  const statusColor = inOptimal ? M.green : M.amber;
  const statusLabel = inOptimal ? 'OPTIMAL' : 'ATTENTION';

  return (
    <>
      <style>{`
        @keyframes bd-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes bd-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bd-pulse-dot {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes bd-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(0,255,204,0.15); }
          50% { box-shadow: 0 0 16px rgba(0,255,204,0.3); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleBackdrop}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: entering ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 301,
          maxHeight: '90vh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          background: M.bg,
          borderTop: `1px solid ${metric.color}20`,
          borderRadius: '20px 20px 0 0',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: `0 -12px 60px rgba(0,0,0,0.6), 0 0 40px ${metric.color}08`,
          transform: entering ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
        </div>

        <div style={{ padding: '0 20px 32px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: `${metric.color}0c`,
                border: `1px solid ${metric.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {metric.icon}
              </div>
              <div>
                <h2 style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 17, fontWeight: 700, color: M.text,
                  letterSpacing: '-0.02em', margin: 0,
                }}>
                  {metric.fullLabel}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 8.5, fontWeight: 600,
                    color: `${metric.color}AA`,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {metric.sourceLabel}
                  </span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: M.green, animation: 'bd-pulse-dot 2s ease-in-out infinite' }} />
                  <span style={{
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 8, color: M.textDim, letterSpacing: '0.08em',
                  }}>
                    LIVE
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: M.textDim, fontSize: 14,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              ✕
            </button>
          </div>

          {/* ── Current Value Hero ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16,
            animation: 'bd-fade-in 0.4s ease both 0.05s',
          }}>
            <span style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 42, fontWeight: 800, color: metric.color,
              letterSpacing: '-0.04em', lineHeight: 1,
              textShadow: `0 0 20px ${metric.color}30`,
            }}>
              {current}
            </span>
            <span style={{
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              fontSize: 13, fontWeight: 600, color: M.textDim,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              {metric.unit}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20,
                background: `${statusColor}0c`,
                border: `1px solid ${statusColor}20`,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: statusColor,
                  boxShadow: `0 0 6px ${statusColor}60`,
                }} />
                <span style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 8.5, fontWeight: 700, color: statusColor,
                  letterSpacing: '0.12em',
                }}>
                  {statusLabel}
                </span>
              </div>
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 10, fontWeight: 700,
                color: delta >= 0 ? M.green : M.red,
              }}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* ── Quick Stats ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16,
            animation: 'bd-fade-in 0.4s ease both 0.1s',
          }}>
            {[
              { label: 'CURRENT', val: String(current), color: metric.color },
              { label: '7D AVG', val: String(avg), color: M.textSec },
              { label: 'MIN', val: String(min), color: M.textDim },
              { label: 'MAX', val: String(max), color: M.textDim },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '8px 6px', borderRadius: 10, textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${M.border}`,
              }}>
                <div style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 7.5, fontWeight: 700, color: M.textDim,
                  letterSpacing: '0.14em', marginBottom: 4,
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 14, fontWeight: 700, color: s.color,
                }}>
                  {s.val}
                </div>
              </div>
            ))}
          </div>

          {/* ── 7-Day Trend Sparkline ── */}
          <div style={{
            borderRadius: 14, overflow: 'hidden', marginBottom: 16,
            background: M.card,
            border: `1px solid ${metric.color}10`,
            animation: 'bd-fade-in 0.4s ease both 0.15s',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px 0',
            }}>
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 9, fontWeight: 700, color: M.textDim,
                letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>
                7-Day Trend
              </span>
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 8.5, color: `${metric.color}60`,
              }}>
                {metric.unit}
              </span>
            </div>

            {/* Large sparkline */}
            <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Sparkline
                data={trendData}
                width={260}
                height={56}
                color={metric.color}
                fillOpacity={0.18}
                strokeWidth={1.8}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Day labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  {DAYS_SHORT.map((d, i) => (
                    <span key={d} style={{
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      fontSize: 7, color: i === 6 ? metric.color : M.textDim,
                      fontWeight: i === 6 ? 700 : 400,
                    }}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Optimal range indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '6px 16px 10px',
              borderTop: `1px solid ${M.border}`,
            }}>
              <div style={{
                width: 20, height: 3, borderRadius: 2,
                background: `linear-gradient(90deg, ${M.green}40, ${M.green})`,
              }} />
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 8, color: M.textDim, letterSpacing: '0.08em',
              }}>
                OPTIMAL: {metric.optimalRange[0]}–{metric.optimalRange[1]} {metric.unit}
              </span>
            </div>
          </div>

          {/* ── Why It Matters — Medical-Grade Analysis ── */}
          <div style={{
            borderRadius: 14, overflow: 'hidden', marginBottom: 16,
            background: M.card,
            border: `1px solid ${M.cardBorder}`,
            animation: 'bd-fade-in 0.4s ease both 0.2s',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px 0',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: `${metric.color}0a`,
                border: `1px solid ${metric.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>
                🧬
              </div>
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 9, fontWeight: 700, color: metric.color,
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                WHY IT MATTERS
              </span>
              <span style={{
                marginLeft: 'auto',
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 7.5, fontWeight: 600,
                color: M.textDim, letterSpacing: '0.1em',
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${M.border}`,
              }}>
                MEDICAL-GRADE ANALYSIS
              </span>
            </div>

            <div style={{ padding: '10px 16px 14px' }}>
              <p style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12, lineHeight: 1.65, color: M.textSec,
                margin: '0 0 10px',
              }}>
                {metric.whyItMatters}
              </p>

              {/* Performance link */}
              <div style={{
                padding: '10px 12px', borderRadius: 10,
                background: `${metric.color}06`,
                border: `1px solid ${metric.color}10`,
              }}>
                <div style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 8, fontWeight: 700, color: `${metric.color}80`,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  marginBottom: 4,
                }}>
                  PERFORMANCE LINK
                </div>
                <p style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 11, lineHeight: 1.55, color: M.text,
                  margin: 0, fontWeight: 500,
                }}>
                  {metric.performanceLink}
                </p>
              </div>
            </div>
          </div>

          {/* ── Influencing Factors ── */}
          <div style={{
            marginBottom: 16,
            animation: 'bd-fade-in 0.4s ease both 0.25s',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${M.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>
                🔗
              </div>
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 9, fontWeight: 700, color: M.textSec,
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                INFLUENCING FACTORS
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {metric.factors.map((f, i) => {
                const isPos = f.direction === 'positive';
                const fColor = isPos ? M.green : M.red;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${M.border}`,
                    animation: `bd-fade-in 0.3s ease both ${0.3 + i * 0.06}s`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 3, height: 20, borderRadius: 2, flexShrink: 0,
                        background: `linear-gradient(180deg, ${fColor}60, ${fColor}15)`,
                      }} />
                      <span style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: 11, color: M.textSec,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {f.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <span style={{
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: 8.5, fontWeight: 700, color: fColor,
                      }}>
                        {isPos ? '▲' : '▼'}
                      </span>
                      <span style={{
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: 10, fontWeight: 600, color: fColor,
                      }}>
                        {f.impact}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Recommended Correction ── */}
          <div style={{
            borderRadius: 14, overflow: 'hidden', marginBottom: 8,
            background: `linear-gradient(135deg, ${metric.color}08, ${metric.color}03)`,
            border: `1px solid ${metric.color}18`,
            animation: 'bd-fade-in 0.4s ease both 0.35s',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px 0',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: `${metric.color}12`,
                border: `1px solid ${metric.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>
                💊
              </div>
              <span style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 9, fontWeight: 700, color: metric.color,
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>
                RECOMMENDED CORRECTION
              </span>
            </div>

            <div style={{ padding: '10px 16px 14px' }}>
              <h3 style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 14, fontWeight: 700, color: M.text,
                margin: '0 0 4px', letterSpacing: '-0.01em',
              }}>
                {metric.correction.action}
              </h3>
              <p style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 11.5, lineHeight: 1.55, color: M.textSec,
                margin: '0 0 12px',
              }}>
                {metric.correction.detail}
              </p>

              {/* CTA Button */}
              <button
                onClick={handleScrollToProduct}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 12,
                  background: `linear-gradient(135deg, ${metric.color}20, ${metric.color}10)`,
                  border: `1px solid ${metric.color}30`,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  animation: inOptimal ? 'none' : 'bd-glow 3s ease-in-out infinite',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${metric.color}30, ${metric.color}18)`;
                  e.currentTarget.style.transform = 'scale(1.01)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${metric.color}20, ${metric.color}10)`;
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 12, fontWeight: 700, color: metric.color,
                  letterSpacing: '0.02em',
                }}>
                  View {metric.correction.productName} in Store
                </span>
                <span style={{ fontSize: 12, color: metric.color }}>→</span>
              </button>

              {/* Trust badge */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginTop: 8,
              }}>
                <span style={{ fontSize: 8 }}>⭐</span>
                <span style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 8, fontWeight: 600, color: M.textDim,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  SOURCED BY VIVE · CLINICAL GRADE · THIRD-PARTY VERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   METRIC KEYS EXPORT — for DataIngestionHeader integration
   ══════════════════════════════════════════════════════════════ */
export const BIOMETRIC_METRIC_KEYS = METRICS.map((m) => m.key);

export function getMetricKeyForSource(sourceId: string): string {
  const sourceMap: Record<string, string> = {
    oura: 'hrv',
    whoop: 'recovery',
    biotech: 'spo2',
  };
  return sourceMap[sourceId] || 'hrv';
}

export default BiometricDetail;
