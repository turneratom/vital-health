import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { BioVault } from './BioVault';
import { useUserStyle } from '@/lib/useUserStyle';
import { getTwinSessionId } from '@/lib/twinSession';
import { generateArchitectResponse, buildBioContext, parseAIActions, SCANNING_PHASES, TOTAL_SCAN_DURATION, buildSystemMessage, getBioSnapshotSummary } from '@/lib/useAI';
import type { BioSnapshot, AIAction } from '@/lib/useAI';
import {
  IntegrationCard,
  CategoryHeader,
  WearablesIcon,
  NutritionIcon,
  ClinicalIcon,
  RequestIntegrationSection,
  type Integration,
} from './BriefingRoom/IntegrationCard';
import { CoachingAlert } from './CoachingAlert';
import { PerformanceTimeline } from './PerformanceTimeline';
import { LabUploader } from './LabUploader';

export type BriefingContext = 'chat' | 'camera' | 'voice' | null;

export interface VoiceState {
  isActive: boolean;
  phase: 'listening' | 'processing' | 'done';
  transcript: string;
}

export interface BriefingRoomProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext?: BriefingContext;
  voiceState?: VoiceState;
}

/* ── Chat Message Types ── */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tags?: string[];
  actions?: AIAction[];
  isScanning?: boolean;
}

/* ── Tab type ── */
type BriefingTab = 'chat' | 'devices' | 'menu';

/* ── Mock chat history ── */
const initialMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Good morning. Your HRV is trending 12% above baseline this week. Recovery score is optimal — today is a green-light day for high-intensity training.',
    timestamp: Date.now() - 3600000 * 4,
    tags: ['Vitals', 'Recovery'],
  },
  {
    id: '2',
    role: 'user',
    content: 'What should my supplement stack look like today?',
    timestamp: Date.now() - 3600000 * 3.5,
    tags: ['Supplement'],
  },
  {
    id: '3',
    role: 'assistant',
    content: 'Based on your blood panel and today\'s strain forecast:\n\n• Vitamin D3 — 5000 IU (your levels are at 42 ng/mL, targeting 60)\n• Magnesium Glycinate — 400mg (pre-sleep)\n• Omega-3 — 2g EPA/DHA\n• Creatine — 5g\n\nSkip the adaptogens today — your cortisol curve looks healthy.',
    timestamp: Date.now() - 3600000 * 3,
    tags: ['Protocol'],
  },
  {
    id: '4',
    role: 'user',
    content: 'How did my sleep compare to last week?',
    timestamp: Date.now() - 3600000 * 2,
    tags: ['Sleep'],
  },
  {
    id: '5',
    role: 'assistant',
    content: 'Your 7-day sleep average improved significantly:\n\n• Duration: 7h 42m → 8h 05m (+23 min)\n• Deep sleep: 1h 18m → 1h 34m (+16 min)\n• REM: 1h 45m → 1h 52m (+7 min)\n• Sleep efficiency: 91% → 94%\n\nThe magnesium protocol and consistent 10:30 PM wind-down are paying off. Your Eight Sleep bed cooling at 68°F is dialed in perfectly.',
    timestamp: Date.now() - 3600000 * 1.5,
    tags: ['Sleep', 'Analysis'],
  },
  {
    id: '6',
    role: 'user',
    content: 'Log breakfast: 4 eggs scrambled, avocado toast on sourdough, black coffee',
    timestamp: Date.now() - 3600000,
    tags: ['Food'],
  },
  {
    id: '7',
    role: 'assistant',
    content: 'Logged. Here\'s the breakdown:\n\n4 Eggs Scrambled — 280 cal / 24g protein\nAvocado Toast — 320 cal / 8g protein / 18g fat\nBlack Coffee — 5 cal\n\nTotal: 605 cal / 32g protein / 42g carbs / 28g fat\n\nYou\'re at 605/2,400 cal for the day. Protein pacing looks good — aim for 40g+ at lunch.',
    timestamp: Date.now() - 1800000,
    tags: ['Food', 'Nutrition'],
  },
  {
    id: '8',
    role: 'user',
    content: 'What\'s my readiness score right now?',
    timestamp: Date.now() - 600000,
  },
  {
    id: '9',
    role: 'assistant',
    content: 'Your composite readiness score is 87/100 — Elite Zone.\n\n• HRV: 68ms (above your 58ms baseline)\n• Resting HR: 52 bpm (optimal)\n• Sleep Score: 94\n• Recovery: 92%\n• Strain Capacity: High\n\nRecommendation: Push hard today. Your body is primed for a PR attempt or high-volume session.',
    timestamp: Date.now() - 300000,
    tags: ['Vitals', 'Readiness'],
  },
];

/* ══════════════════════════════════════════════════════════════ */
/* ── INTEGRATION HUB DATA (no emojis, categorized) ── */
/* ══════════════════════════════════════════════════════════════ */
const integrations: Integration[] = [
  // Wearables
  {
    id: 'apple-health',
    name: 'Apple Health',
    subtitle: 'iOS HealthKit',
    brandColor: '#FF2D55',
    category: 'wearables',
    metrics: 24,
    dataTypes: ['Heart Rate', 'HRV', 'Sleep', 'Steps', 'VO2 Max'],
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    subtitle: 'Gen 3 / Gen 4',
    brandColor: '#D4AF37',
    category: 'wearables',
    metrics: 18,
    dataTypes: ['Sleep Stages', 'HRV', 'Temperature', 'Readiness'],
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    subtitle: 'Strain Monitor',
    brandColor: '#00F19F',
    category: 'wearables',
    metrics: 15,
    dataTypes: ['Strain', 'Recovery', 'Sleep', 'HRV'],
  },
  {
    id: 'garmin',
    name: 'Garmin',
    subtitle: 'Connect IQ',
    brandColor: '#007CC3',
    category: 'wearables',
    metrics: 0,
    dataTypes: ['Heart Rate', 'Body Battery', 'Training Load'],
  },
  // Nutrition
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal',
    subtitle: 'Macro Tracking',
    brandColor: '#0070E0',
    category: 'nutrition',
    metrics: 0,
    dataTypes: ['Calories', 'Macros', 'Meals', 'Water'],
  },
  {
    id: 'cronometer',
    name: 'Cronometer',
    subtitle: 'Micronutrient Tracking',
    brandColor: '#FF6B2B',
    category: 'nutrition',
    metrics: 0,
    dataTypes: ['Calories', 'Micronutrients', 'Biometrics'],
  },
  // Clinical
  {
    id: 'insidetracker',
    name: 'InsideTracker',
    subtitle: 'Blood Biomarkers',
    brandColor: '#BF5AF2',
    category: 'clinical',
    metrics: 0,
    dataTypes: ['Blood Panels', 'DNA', 'InnerAge'],
  },
  {
    id: 'function-health',
    name: 'Function Health',
    subtitle: 'Lab Testing Platform',
    brandColor: '#34D399',
    category: 'clinical',
    metrics: 0,
    dataTypes: ['100+ Biomarkers', 'Trends', 'Clinician Notes'],
  },
  {
    id: 'dexcom',
    name: 'Dexcom CGM',
    subtitle: 'Continuous Glucose',
    brandColor: '#6C5CE7',
    category: 'clinical',
    metrics: 0,
    dataTypes: ['Glucose', 'Time in Range', 'Variability'],
  },
];

/* ── Menu Items ── */
const menuSections = [
  {
    title: 'Personal',
    items: [
      { label: 'My Profile', iconId: 'profile' },
      { label: 'Goals', iconId: 'goals' },
      { label: 'Weekly Reports', iconId: 'reports', badge: 'New' },
    ],
  },
  {
    title: 'The Lab',
    items: [
      { label: 'Blood Panels', iconId: 'blood', action: 'bioVault' },
      { label: 'DNA Data', iconId: 'dna', action: 'bioVault' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Settings', iconId: 'settings' },
      { label: 'Privacy', iconId: 'privacy' },
      { label: 'Help', iconId: 'help' },
    ],
  },
];

/* ── Menu Icon SVGs ── */
function MenuIcon({ id, color = 'rgba(255,255,255,0.45)' }: { id: string; color?: string }) {
  const props = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'profile': return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>;
    case 'goals': return <svg {...props}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'reports': return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 12h8M8 8h8M8 16h4" /></svg>;
    case 'blood': return <svg {...props}><path d="M12 2c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13z" /></svg>;
    case 'dna': return <svg {...props}><path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" /><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /></svg>;
    case 'settings': return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>;
    case 'privacy': return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case 'help': return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="10" /></svg>;
  }
}

/* ── Time formatting ── */
function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Time-of-day Coach Brief ── */
function getCoachBrief(): { type: 'morning' | 'evening'; greeting: string; message: string; accentColor: string; stats: { label: string; value: string; trend?: string }[] } {
  const hour = new Date().getHours();
  const isMorning = hour >= 4 && hour < 17;

  if (isMorning) {
    return {
      type: 'morning',
      greeting: hour < 12 ? 'Good morning' : 'Good afternoon',
      message: 'Your sleep score hit 94 last night — deep sleep was up 16 min over your 7-day average. Recovery is primed. Today is a green-light day.',
      accentColor: '#00F0FF',
      stats: [
        { label: 'Sleep Score', value: '94', trend: '+3' },
        { label: 'Deep Sleep', value: '1h 34m', trend: '+16m' },
        { label: 'HRV', value: '68ms', trend: '+10' },
        { label: 'Recovery', value: '92%' },
      ],
    };
  }

  return {
    type: 'evening',
    greeting: 'Evening recap',
    message: 'You completed 6 of 8 Daily Stack items today. Protein target hit, movement logged, and HRV stayed above baseline all day. Two items remain — magnesium and wind-down.',
    accentColor: '#BF5AF2',
    stats: [
      { label: 'Stack Progress', value: '6/8', trend: '75%' },
      { label: 'Calories', value: '2,180', trend: '91%' },
      { label: 'Protein', value: '156g', trend: 'Hit' },
      { label: 'Movement', value: '48 min' },
    ],
  };
}

function CoachBriefCard() {
  const brief = getCoachBrief();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const rgb = brief.type === 'morning' ? '0,240,255' : '191,90,242';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-xl overflow-hidden relative"
      style={{
        background: `linear-gradient(135deg, rgba(${rgb},0.06), rgba(10,10,14,0.8))`,
        border: `1px solid rgba(${rgb},0.15)`,
        boxShadow: `0 0 24px rgba(${rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
    >
      <div className="h-[1.5px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${brief.accentColor}40, ${brief.accentColor}60, ${brief.accentColor}40, transparent)` }} />
      <div className="px-4 pt-3 pb-3.5">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.2)`, boxShadow: `0 0 12px rgba(${rgb},0.1)` }}>
              {brief.type === 'morning' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brief.accentColor} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brief.accentColor} strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: brief.accentColor }}>{brief.greeting}</span>
              <span className="text-[8px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {brief.type === 'morning' ? 'Sleep & Recovery Brief' : 'Daily Stack Recap'}
              </span>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:bg-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
        <p className="text-[11.5px] leading-[1.65] mb-3" style={{ color: 'rgba(255,255,255,0.72)' }}>{brief.message}</p>
        <div className="grid grid-cols-4 gap-1.5">
          {brief.stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center py-2 px-1 rounded-lg" style={{ background: `rgba(${rgb},0.04)`, border: `1px solid rgba(${rgb},0.08)` }}>
              <span className="text-[12px] font-bold font-mono" style={{ color: brief.accentColor }}>{stat.value}</span>
              <span className="text-[7px] font-mono uppercase tracking-wider mt-0.5 text-center leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</span>
              {stat.trend && <span className="text-[7px] font-mono mt-0.5" style={{ color: `rgba(${rgb},0.6)` }}>{stat.trend}</span>}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center mt-3 gap-1.5">
          <motion.div className="w-1 h-1 rounded-full" style={{ background: brief.accentColor, opacity: 0.5 }} animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
          <span className="text-[8px] font-mono tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {brief.type === 'morning' ? 'Ask me to plan your day based on this data' : 'Ask me what to prioritize before bed'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Tag color map ── */
const tagColors: Record<string, string> = {
  Vitals: 'rgba(0,255,204,0.15)', Recovery: 'rgba(52,211,153,0.15)', Supplement: 'rgba(191,90,242,0.15)',
  Protocol: 'rgba(191,90,242,0.15)', Sleep: 'rgba(99,102,241,0.15)', Analysis: 'rgba(59,130,246,0.15)',
  Food: 'rgba(255,149,0,0.15)', Nutrition: 'rgba(255,149,0,0.15)', Readiness: 'rgba(0,242,255,0.15)',
};
const tagTextColors: Record<string, string> = {
  Vitals: 'rgba(0,255,204,0.8)', Recovery: 'rgba(52,211,153,0.8)', Supplement: 'rgba(191,90,242,0.8)',
  Protocol: 'rgba(191,90,242,0.8)', Sleep: 'rgba(99,102,241,0.8)', Analysis: 'rgba(59,130,246,0.8)',
  Food: 'rgba(255,149,0,0.8)', Nutrition: 'rgba(255,149,0,0.8)', Readiness: 'rgba(0,242,255,0.8)',
};

/* ══════════════════════════════════════════════════════════════ */
/* ── CAMERA CAPTURE PANEL (inline in chat) ── */
/* ══════════════════════════════════════════════════════════════ */
function CameraCapturePanel({ onCapture, onDismiss }: { onCapture: (label: string) => void; onDismiss: () => void }) {
  const [captureState, setCaptureState] = useState<'ready' | 'capturing' | 'captured'>('ready');
  const [capturedLabel, setCapturedLabel] = useState('');

  const handleCapture = useCallback(() => {
    setCaptureState('capturing');
    setTimeout(() => {
      const labels = ['Grilled salmon with asparagus', 'Protein shake with banana', 'Mixed green salad with chicken', 'Overnight oats with berries'];
      setCapturedLabel(labels[Math.floor(Math.random() * labels.length)]);
      setCaptureState('captured');
    }, 1200);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.25 }}
      className="rounded-xl border overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(48,209,88,0.2)', boxShadow: '0 0 20px rgba(48,209,88,0.05)' }}>
      <div className="relative w-full aspect-[4/3] flex items-center justify-center" style={{ background: captureState === 'captured' ? 'linear-gradient(135deg, rgba(48,209,88,0.08), rgba(0,0,0,0.3))' : 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(0,0,0,0.3))' }}>
        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: captureState === 'captured' ? 'rgba(48,209,88,0.6)' : 'rgba(255,255,255,0.15)' }} />
        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: captureState === 'captured' ? 'rgba(48,209,88,0.6)' : 'rgba(255,255,255,0.15)' }} />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: captureState === 'captured' ? 'rgba(48,209,88,0.6)' : 'rgba(255,255,255,0.15)' }} />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: captureState === 'captured' ? 'rgba(48,209,88,0.6)' : 'rgba(255,255,255,0.15)' }} />
        {captureState === 'ready' && (
          <div className="flex flex-col items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></svg>
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>Point at food to capture</span>
          </div>
        )}
        {captureState === 'capturing' && (
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(48,209,88,0.5)', borderTopColor: 'transparent' }} />
            <span className="text-[10px] font-mono" style={{ color: 'rgba(48,209,88,0.6)' }}>Analyzing...</span>
          </motion.div>
        )}
        {captureState === 'captured' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            <span className="text-[11px] font-mono font-medium" style={{ color: 'rgba(48,209,88,0.9)' }}>{capturedLabel}</span>
          </motion.div>
        )}
      </div>
      <div className="flex items-center gap-2 p-3">
        <button onClick={onDismiss} className="flex-1 py-2 rounded-lg text-[11px] uppercase tracking-wider font-medium transition-all duration-200 active:scale-95" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>Cancel</button>
        {captureState === 'ready' && (
          <button onClick={handleCapture} className="flex-1 py-2 rounded-lg text-[11px] uppercase tracking-wider font-medium transition-all duration-200 active:scale-95" style={{ background: 'rgba(48,209,88,0.15)', color: 'rgba(48,209,88,0.9)', border: '1px solid rgba(48,209,88,0.3)' }}>Capture</button>
        )}
        {captureState === 'captured' && (
          <button onClick={() => onCapture(capturedLabel)} className="flex-1 py-2 rounded-lg text-[11px] uppercase tracking-wider font-medium transition-all duration-200 active:scale-95" style={{ background: 'rgba(48,209,88,0.15)', color: 'rgba(48,209,88,0.9)', border: '1px solid rgba(48,209,88,0.3)' }}>Log This</button>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── VOICE RECORDING PANEL (inline in chat) ── */
/* ══════════════════════════════════════════════════════════════ */
function VoiceRecordingPanel({ onSend, onDismiss }: { onSend: (transcript: string) => void; onDismiss: () => void }) {
  const [recordState, setRecordState] = useState<'recording' | 'processing' | 'done'>('recording');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [bars, setBars] = useState<number[]>(Array(24).fill(0.15));
  const animRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (recordState !== 'recording') return;
    const interval = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [recordState]);

  useEffect(() => {
    if (recordState !== 'recording') { setBars(Array(24).fill(0.08)); return; }
    const animate = () => {
      phaseRef.current += 0.07;
      const p = phaseRef.current;
      const newBars = Array.from({ length: 24 }, (_, i) => {
        const dist = Math.abs(i - 12) / 12;
        const base = 0.12 + (1 - dist) * 0.18;
        return Math.max(0.05, Math.min(1, base + Math.sin(p + i * 0.4) * 0.25 + Math.cos(p * 1.3 + i * 0.25) * 0.15 + Math.random() * 0.06));
      });
      setBars(newBars);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [recordState]);

  const handleStop = useCallback(() => {
    setRecordState('processing');
    setTimeout(() => {
      const transcripts = ['Log lunch: grilled chicken breast with brown rice and steamed broccoli', 'Just finished a 45 minute zone 2 run, felt great', 'Took 5000 IU vitamin D and 400mg magnesium glycinate', 'Feeling a bit fatigued today, slept about 6 hours'];
      setTranscript(transcripts[Math.floor(Math.random() * transcripts.length)]);
      setRecordState('done');
    }, 1500);
  }, []);

  const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }} transition={{ duration: 0.25 }}
      className="rounded-xl border p-4" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,242,255,0.2)', boxShadow: '0 0 20px rgba(0,242,255,0.05)' }}>
      {recordState === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-end justify-center gap-[2px]" style={{ height: 36, width: '100%' }}>
            {bars.map((h, i) => (
              <div key={i} className="rounded-full" style={{ width: 3, height: `${Math.max(8, h * 100)}%`, background: `rgba(0,242,255,${0.2 + h * 0.6})`, boxShadow: `0 0 ${Math.round(h * 4)}px rgba(0,242,255,${h * 0.3})`, transition: 'height 0.08s ease-out' }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full" style={{ background: '#FF3B30', boxShadow: '0 0 6px rgba(255,59,48,0.5)' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>Recording / {formatElapsed(elapsed)}</span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <button onClick={onDismiss} className="flex-1 py-2 rounded-lg text-[11px] uppercase tracking-wider font-medium active:scale-95" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>Cancel</button>
            <button onClick={handleStop} className="flex-1 py-2 rounded-lg text-[11px] uppercase tracking-wider font-medium active:scale-95" style={{ background: 'rgba(0,242,255,0.15)', color: 'rgba(0,242,255,0.9)', border: '1px solid rgba(0,242,255,0.3)' }}>Stop</button>
          </div>
        </div>
      )}
      {recordState === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(0,242,255,0.4)', borderTopColor: 'transparent' }} />
          <span className="text-[10px] font-medium" style={{ color: 'rgba(0,242,255,0.6)' }}>Transcribing...</span>
        </div>
      )}
      {recordState === 'done' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg p-3" style={{ background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.1)' }}>
            <span className="text-[8px] uppercase tracking-wider font-semibold block mb-1" style={{ color: 'rgba(0,242,255,0.5)' }}>Transcript</span>
            <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{transcript}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDismiss} className="flex-1 py-2 rounded-lg text-[11px] uppercase tracking-wider font-medium active:scale-95" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>Discard</button>
            <button onClick={() => onSend(transcript)} className="flex-1 py-2 rounded-lg text-[11px] uppercase tracking-wider font-medium active:scale-95" style={{ background: 'rgba(0,242,255,0.15)', color: 'rgba(0,242,255,0.9)', border: '1px solid rgba(0,242,255,0.3)' }}>Send</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MAIN BRIEFING ROOM ── */
/* ══════════════════════════════════════════════════════════════ */
export const BriefingRoom = function BriefingRoom({ isOpen, onClose, initialContext, voiceState }: BriefingRoomProps) {
  const userStyle = useUserStyle();
  const [activeTab, setActiveTab] = useState<BriefingTab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [bioVaultOpen, setBioVaultOpen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Integration Hub State ── */
  // Wearable OAuth is not live — never default to "connected"
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(() => new Set());

  const toggleIntegration = useCallback((_id: string) => {
    // Coming later — no faux connect
  }, []);

  const wearables = integrations.filter(i => i.category === 'wearables');
  const nutrition = integrations.filter(i => i.category === 'nutrition');
  const clinical = integrations.filter(i => i.category === 'clinical');
  const activeCount = connectedIntegrations.size;
  const totalMetrics = integrations.filter(i => connectedIntegrations.has(i.id)).reduce((s, i) => s + i.metrics, 0);

  const [sessionId] = useState(() => getTwinSessionId());

  /* ── Bio-Vault + Vitality Score queries for AI context ── */
  let bioVaultData: any = null;
  let latestScore: any = null;
  let todayFoodLogs: any[] = [];
  let todayActivityLogs: any[] = [];
  let coachingData: any = null;
  try {
    bioVaultData = useQuery(api.queries.getBioVaultBySession, { sessionId });
    const scores14d = useQuery(api.queries.getVitalityScores14d, { sessionId });
    latestScore = scores14d && scores14d.length > 0 ? scores14d[scores14d.length - 1] : null;
    todayFoodLogs = useQuery(api.queries.listFoodLogs) ?? [];
    todayActivityLogs = useQuery(api.queries.listActivityLogs) ?? [];
    coachingData = useQuery(api.coaching.analyzeWeeklyTrends, { sessionId });
  } catch { /* Convex not connected */ }

  /* ── Build live Bio-Snapshot ── */
  const bioSnapshot = useMemo<BioSnapshot>(() => {
    const snap: BioSnapshot = {};
    if (latestScore) {
      snap.vitalityScore = latestScore.score;
      snap.fuelingPoints = latestScore.fuelingPoints;
      snap.movementPoints = latestScore.movementPoints;
      snap.hrvPoints = latestScore.hrvPoints;
      snap.basePoints = latestScore.basePoints;
      snap.hrv = latestScore.currentHrv;
      snap.hrvAvg7d = latestScore.hrvAvg7d;
    }
    if (bioVaultData) {
      snap.vitaminD = bioVaultData.vitaminD ?? null;
      snap.testosteroneTotal = bioVaultData.testosteroneTotal ?? null;
      snap.testosteroneFree = bioVaultData.testosteroneFree ?? null;
      snap.ferritin = bioVaultData.ferritin ?? null;
      snap.crp = bioVaultData.crp ?? null;
      snap.hba1c = bioVaultData.hba1c ?? null;
      snap.mthfrVariant = bioVaultData.mthfrVariant;
      snap.apoe4 = bioVaultData.apoe4;
      snap.caffeineSensitivity = bioVaultData.caffeineSensitivity;
      snap.preferredProteins = bioVaultData.preferredProteins;
      snap.dietaryRestrictions = bioVaultData.dietaryRestrictions;
    }
    const todayCals = todayFoodLogs.reduce((s: number, f: any) => s + (f.calories || 0), 0);
    const todayProt = todayFoodLogs.reduce((s: number, f: any) => s + (f.protein || 0), 0);
    const todayMins = todayActivityLogs.reduce((s: number, a: any) => s + (a.duration || 0), 0);
    if (todayCals > 0) snap.todayCalories = todayCals;
    if (todayProt > 0) snap.todayProtein = todayProt;
    if (todayMins > 0) snap.todayActivityMinutes = todayMins;
    return snap;
  }, [bioVaultData, latestScore, todayFoodLogs, todayActivityLogs]);

  /* ── Scanning state for Bio-Vault animation ── */
  const [scanPhase, setScanPhase] = useState(-1);
  const [isScanningVault, setIsScanningVault] = useState(false);

  /* ── Bio-Snapshot summary for context badge ── */
  const snapshotSummary = useMemo(() => getBioSnapshotSummary(bioSnapshot), [bioSnapshot]);
  const systemMessage = useMemo(() => buildSystemMessage(bioSnapshot), [bioSnapshot]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('chat');
    if (initialContext === 'camera') { setShowCamera(true); setShowVoice(false); }
    else if (initialContext === 'voice') { setShowVoice(true); setShowCamera(false); }
    else { setShowCamera(false); setShowVoice(false); }
  }, [isOpen, initialContext]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat') setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [messages.length, isOpen, activeTab, showCamera, showVoice]);

  useEffect(() => {
    if (isOpen && activeTab === 'chat' && !showCamera && !showVoice) setTimeout(() => inputRef.current?.focus(), 400);
  }, [isOpen, activeTab, showCamera, showVoice]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (bioVaultOpen) setBioVaultOpen(false);
        else if (showCamera) setShowCamera(false);
        else if (showVoice) setShowVoice(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, bioVaultOpen, showCamera, showVoice]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const id = 'briefing-room-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes integrationLiveDot { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
      .briefing-scroll::-webkit-scrollbar { width: 3px; }
      .briefing-scroll::-webkit-scrollbar-track { background: transparent; }
      .briefing-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 3px; }
      .briefing-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
    `;
    document.head.appendChild(style);
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleSend = useCallback((overrideText?: string) => {
    const text = (overrideText || inputValue).trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);
    setIsScanningVault(true);
    setScanPhase(0);

    // Animate through scanning phases
    let elapsed = 0;
    SCANNING_PHASES.forEach((phase, i) => {
      setTimeout(() => setScanPhase(i), elapsed);
      elapsed += phase.duration;
    });

    // After scanning completes, generate AI response with full Bio-Snapshot injection
    setTimeout(() => {
      setIsScanningVault(false);
      setScanPhase(-1);
      // Log the full system message (persona + Bio-Snapshot) for debugging
      // In production LLM mode, this would be the system instruction:
      // console.log('[CPA] System Message:', systemMessage);
      const bioContext = buildBioContext(bioSnapshot);
      // console.log('[CPA] Bio-Snapshot injected:', bioContext);
      const { text: responseText, actions } = generateArchitectResponse(text, bioSnapshot);
      const tags: string[] = [];
      if (text.toLowerCase().match(/vitamin|supplement|stack|protocol/)) tags.push('Protocol');
      else if (text.toLowerCase().match(/hrv|recovery|readiness/)) tags.push('Vitals', 'Recovery');
      else if (text.toLowerCase().match(/sleep|tired|fatigue|rest/)) tags.push('Sleep');
      else if (text.toLowerCase().match(/eat|meal|food|protein|calorie|nutrition/)) tags.push('Nutrition');
      else if (text.toLowerCase().match(/workout|train|exercise|lift|run/)) tags.push('Activity');
      else if (text.toLowerCase().match(/blood|panel|biomarker|lab/)) tags.push('Analysis');
      else tags.push('Analysis');
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: responseText, timestamp: Date.now(), tags, actions: actions.length > 0 ? actions : undefined }]);
      setIsTyping(false);
    }, TOTAL_SCAN_DURATION + 200);
  }, [inputValue, bioSnapshot]);

  const handleCameraCapture = useCallback((label: string) => { setShowCamera(false); handleSend(`Captured: ${label}`); }, [handleSend]);
  const handleVoiceTranscript = useCallback((transcript: string) => { setShowVoice(false); handleSend(transcript); }, [handleSend]);
  const handleMenuAction = useCallback((action?: string) => { if (action === 'bioVault') setBioVaultOpen(true); }, []);

  return (
    <div className={isOpen ? '' : 'pointer-events-none'}>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[200]" style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }} onClick={handleBackdropClick} />

            {/* Sidebar Panel */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 380, mass: 0.8 }}
              className="fixed top-0 right-0 bottom-0 z-[201] w-[380px] max-w-[90vw] flex flex-col"
              style={{
                background: 'rgba(8, 8, 10, 0.88)', backdropFilter: 'blur(48px) saturate(1.6)', WebkitBackdropFilter: 'blur(48px) saturate(1.6)',
                borderLeft: '1px solid rgba(255, 255, 255, 0.06)', boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.5), -4px 0 20px rgba(0, 0, 0, 0.3)',
              }}
            >
              {/* ── Header ── */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(0,255,204,0.08))', border: '1px solid rgba(0,242,255,0.25)', boxShadow: '0 0 16px rgba(0,242,255,0.15)' }}>
                    <span className="text-xs font-bold" style={{ color: '#00F2FF' }}>V</span>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: '#34C759', borderColor: 'rgba(8,8,10,0.9)', boxShadow: '0 0 6px rgba(52,199,89,0.5)' }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
                      {userStyle === 'core' ? 'Connect Devices' : 'Connect Devices'}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.12em] font-medium" style={{ color: 'rgba(0,242,255,0.5)' }}>
                      {activeTab === 'chat' ? (showCamera ? 'Camera Active' : showVoice ? 'Voice Active' : 'Always Online') : activeTab === 'devices' ? 'Integration Hub' : 'Settings'}
                    </span>
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-white/[0.08]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }} aria-label="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </div>

              {/* ── Tab Bar ── */}
              <div className="flex items-center gap-1 px-5 pb-3">
                {([
                  { id: 'chat' as BriefingTab, label: 'Chat' },
                  { id: 'devices' as BriefingTab, label: 'Integrations' },
                  { id: 'menu' as BriefingTab, label: 'More' },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setShowCamera(false); setShowVoice(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-200 relative"
                    style={{
                      background: activeTab === tab.id ? 'rgba(0,242,255,0.08)' : 'transparent',
                      border: `1px solid ${activeTab === tab.id ? 'rgba(0,242,255,0.15)' : 'rgba(255,255,255,0.03)'}`,
                    }}
                  >
                    {tab.id === 'chat' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={activeTab === tab.id ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    )}
                    {tab.id === 'devices' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={activeTab === tab.id ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                    )}
                    {tab.id === 'menu' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={activeTab === tab.id ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: activeTab === tab.id ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.35)' }}>
                      {tab.label}
                    </span>
                    {tab.id === 'devices' && activeCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'rgba(0,255,204,0.2)', color: '#00FFCC', border: '1px solid rgba(0,255,204,0.3)' }}>
                        {activeCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mx-5 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,242,255,0.1), transparent)' }} />

              {/* ══════════════════════════════════════════ */}
              {/* ── CHAT TAB ── */}
              {/* ══════════════════════════════════════════ */}
              {activeTab === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 briefing-scroll">
                    <div className="flex items-center justify-center py-2">
                      <span className="text-[9px] uppercase tracking-wider font-medium px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>Today</span>
                    </div>

                    {/* Bio-Snapshot Context Badge */}
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,242,255,0.04), rgba(191,90,242,0.03))',
                        border: '1px solid rgba(0,242,255,0.1)',
                      }}
                    >
                      <div className="px-3.5 py-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px]">\uD83E\uDDE0</span>
                            <span className="text-[9px] uppercase tracking-[0.15em] font-bold" style={{ color: 'rgba(0,242,255,0.7)' }}>Bio-Snapshot Active</span>
                            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: '#30D158', boxShadow: '0 0 4px rgba(48,209,88,0.5)' }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
                          </div>
                          <span className="text-[9px] font-mono font-bold" style={{ color: 'rgba(0,242,255,0.5)' }}>{snapshotSummary.dataPoints} data points</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {snapshotSummary.sources.slice(0, 8).map(src => (
                            <span key={src} className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,242,255,0.06)', color: 'rgba(0,242,255,0.55)', border: '1px solid rgba(0,242,255,0.08)' }}>{src}</span>
                          ))}
                          {snapshotSummary.sources.length > 8 && (
                            <span className="text-[7px] font-mono px-1.5 py-0.5 rounded" style={{ color: 'rgba(255,255,255,0.3)' }}>+{snapshotSummary.sources.length - 8}</span>
                          )}
                        </div>
                        {snapshotSummary.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {snapshotSummary.flags.map(flag => (
                              <span key={flag} className="text-[7px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,69,58,0.08)', color: 'rgba(255,69,58,0.7)', border: '1px solid rgba(255,69,58,0.12)' }}>{flag}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[7px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>AI references your unique biology in every response</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* Coaching Alert — only renders when negative trends detected */}
                    {coachingData?.hasAlerts && (
                      <CoachingAlert
                        alerts={coachingData.alerts}
                        nearRecords={coachingData.nearRecords ?? []}
                        onAskCoach={(question) => handleSend(question)}
                      />
                    )}
                    {coachingData?.hasNearRecords && !coachingData?.hasAlerts && (
                      <CoachingAlert
                        alerts={[]}
                        nearRecords={coachingData.nearRecords ?? []}
                        onAskCoach={(question) => handleSend(question)}
                      />
                    )}
                    <AnimatePresence><CoachBriefCard /></AnimatePresence>
                    {messages.map((msg, idx) => (
                      <motion.div key={msg.id} initial={idx >= initialMessages.length - 1 ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {msg.tags && msg.tags.length > 0 && (
                          <div className={`flex gap-1 mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.tags.map(tag => (
                              <span key={tag} className="text-[8px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded" style={{ background: tagColors[tag] || 'rgba(255,255,255,0.05)', color: tagTextColors[tag] || 'rgba(255,255,255,0.5)' }}>{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5" style={{
                          background: msg.role === 'user' ? 'linear-gradient(135deg, rgba(0,242,255,0.12), rgba(0,255,204,0.08))' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${msg.role === 'user' ? 'rgba(0,242,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                          borderBottomRightRadius: msg.role === 'user' ? '6px' : '16px',
                          borderBottomLeftRadius: msg.role === 'assistant' ? '6px' : '16px',
                        }}>
                          <p className="text-[12px] leading-[1.6] whitespace-pre-line" style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)' }}>{msg.content}</p>
                        </div>
                        {/* AI Action Buttons */}
                        {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5 max-w-[85%]">
                            {msg.actions.map((action) => (
                              <motion.button
                                key={action.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 hover:scale-[1.03] active:scale-95"
                                style={{
                                  background: `${action.color}12`,
                                  border: `1px solid ${action.color}30`,
                                  boxShadow: `0 0 8px ${action.color}08`,
                                }}
                                onClick={() => {
                                  if (action.type === 'navigate' && action.target === 'bioVault') setBioVaultOpen(true);
                                }}
                              >
                                <span className="text-[11px]">{action.icon}</span>
                                <span className="text-[10px] font-semibold tracking-wide" style={{ color: action.color }}>{action.label}</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={action.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                              </motion.button>
                            ))}
                          </div>
                        )}
                        <span className="text-[8px] mt-1 px-1 font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>{formatTime(msg.timestamp)}</span>
                      </motion.div>
                    ))}
                    {isTyping && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start">
                        {isScanningVault && scanPhase >= 0 ? (
                          <div className="rounded-2xl px-4 py-3 max-w-[85%]" style={{ background: 'rgba(0,242,255,0.04)', border: '1px solid rgba(0,242,255,0.12)', borderBottomLeftRadius: '6px', boxShadow: '0 0 20px rgba(0,242,255,0.04)' }}>
                            <div className="flex items-center gap-2 mb-2.5">
                              <motion.div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#00F2FF', boxShadow: '0 0 8px rgba(0,242,255,0.6)' }} animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }} />
                              <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: 'rgba(0,242,255,0.9)' }}>Scanning Bio-Vault</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {SCANNING_PHASES.map((phase, i) => {
                                const isActive = i === scanPhase;
                                const isDone = i < scanPhase;
                                const isPending = i > scanPhase;
                                return (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
                                    transition={{ duration: 0.2, delay: i * 0.05 }}
                                    className="flex items-center gap-2"
                                  >
                                    {isDone ? (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                                    ) : isActive ? (
                                      <motion.div className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent" style={{ borderColor: 'rgba(0,242,255,0.6)', borderTopColor: 'transparent' }} animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                                    ) : (
                                      <div className="w-3 h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />
                                    )}
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-semibold" style={{ color: isDone ? 'rgba(48,209,88,0.8)' : isActive ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.25)' }}>
                                        {phase.icon} {phase.label}
                                      </span>
                                      {isActive && (
                                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[8px] font-mono" style={{ color: 'rgba(0,242,255,0.45)' }}>
                                          {phase.detail}
                                        </motion.span>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2.5 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: 'linear-gradient(90deg, #00F2FF, #00FFCC)' }}
                                initial={{ width: '0%' }}
                                animate={{ width: `${Math.min(100, ((scanPhase + 1) / SCANNING_PHASES.length) * 100)}%` }}
                                transition={{ duration: 0.4, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl px-4 py-3 flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderBottomLeftRadius: '6px' }}>
                            {[0, 1, 2].map(i => (<div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(0,242,255,0.5)', animation: `typingBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />))}
                          </div>
                        )}
                      </motion.div>
                    )}
                    <AnimatePresence>{showCamera && <CameraCapturePanel onCapture={handleCameraCapture} onDismiss={() => setShowCamera(false)} />}</AnimatePresence>
                    <AnimatePresence>{showVoice && <VoiceRecordingPanel onSend={handleVoiceTranscript} onDismiss={() => setShowVoice(false)} />}</AnimatePresence>

                    {/* Live Voice Transcript from V Button */}
                    <AnimatePresence>
                      {voiceState?.isActive && (
                        <motion.div initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.25 }}
                          className="rounded-xl border overflow-hidden" style={{
                            background: voiceState.phase === 'processing' ? 'rgba(255,214,10,0.04)' : 'rgba(0,242,255,0.04)',
                            border: `1px solid ${voiceState.phase === 'processing' ? 'rgba(255,214,10,0.15)' : 'rgba(0,242,255,0.15)'}`,
                          }}>
                          <div className="px-4 py-3 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <motion.div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: voiceState.phase === 'processing' ? '#FFD60A' : '#00F2FF', boxShadow: voiceState.phase === 'processing' ? '0 0 8px rgba(255,214,10,0.5)' : '0 0 8px rgba(0,242,255,0.5)' }} animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: voiceState.phase === 'processing' ? 0.6 : 1, repeat: Infinity }} />
                              <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: voiceState.phase === 'processing' ? 'rgba(255,214,10,0.8)' : 'rgba(0,242,255,0.8)' }}>
                                {voiceState.phase === 'processing' ? 'Thinking...' : voiceState.phase === 'done' ? 'Processed' : 'Listening'}
                              </span>
                              {voiceState.phase === 'listening' && (
                                <div className="flex items-center gap-[1.5px] ml-auto">
                                  {Array.from({ length: 8 }).map((_, i) => (<motion.div key={i} className="rounded-full" style={{ width: 2, background: 'rgba(0,242,255,0.5)' }} animate={{ height: [3, 8 + Math.random() * 8, 3] }} transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.06 }} />))}
                                </div>
                              )}
                              {voiceState.phase === 'processing' && (
                                <div className="ml-auto flex items-center gap-1">
                                  {[0, 1, 2].map(i => (<motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,214,10,0.5)' }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />))}
                                </div>
                              )}
                            </div>
                            {voiceState.transcript && (
                              <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[12px] leading-relaxed italic" style={{ color: voiceState.phase === 'processing' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.6)' }}>
                                &ldquo;{voiceState.transcript}&rdquo;
                              </motion.p>
                            )}
                            <span className="text-[8px] tracking-wider font-medium" style={{ color: voiceState.phase === 'processing' ? 'rgba(255,214,10,0.35)' : 'rgba(0,242,255,0.3)' }}>
                              {voiceState.phase === 'processing' ? 'Sending to Vive AI...' : voiceState.phase === 'done' ? 'Logged successfully' : 'Release V button to send'}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input Bar */}
                  <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(5,5,8,0.6)' }}>
                    <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => { setShowCamera(true); setShowVoice(false); }} className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95" style={{ background: showCamera ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${showCamera ? 'rgba(48,209,88,0.3)' : 'rgba(255,255,255,0.05)'}` }} title="Photo capture">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showCamera ? '#30D158' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></svg>
                      </button>
                      <input ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Ask Vive anything..." className="flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 outline-none" />
                      <button onClick={() => { setShowVoice(true); setShowCamera(false); }} className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95" style={{ background: showVoice ? 'rgba(0,242,255,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${showVoice ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.05)'}` }} title="Voice recording">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={showVoice ? '#00F2FF' : 'rgba(255,255,255,0.35)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
                      </button>
                      <button onClick={() => handleSend()} disabled={!inputValue.trim() || isTyping} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200" style={{ background: inputValue.trim() ? 'rgba(0,242,255,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${inputValue.trim() ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.05)'}`, opacity: inputValue.trim() ? 1 : 0.4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inputValue.trim() ? '#00F2FF' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" /></svg>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ══════════════════════════════════════════ */}
              {/* ── INTEGRATIONS TAB (Professional Hub) ── */}
              {/* ══════════════════════════════════════════ */}
              {activeTab === 'devices' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 briefing-scroll">
                  {/* Hub Summary Bar */}
                  <div className="flex items-center justify-between px-3.5 py-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>Integration Hub</span>
                      <span className="text-[9px] font-mono" style={{ color: 'rgba(0,242,255,0.5)' }}>
                        {activeCount} connected {activeCount !== 1 ? 'sources' : 'source'} {totalMetrics > 0 ? `/ ${totalMetrics} metrics` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,184,107,0.08)', border: '1px solid rgba(255,184,107,0.15)' }}>
                          <span className="text-[8px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'rgba(255,184,107,0.8)' }}>Coming later</span>
                        </div>
                    </div>
                  </div>

                  {/* ── Wearables Category ── */}
                  <CategoryHeader
                    title="Wearables"
                    icon={<WearablesIcon size={11} />}
                    count={wearables.length}
                    color="#00F0FF"
                  />
                  <div className="flex flex-col gap-2 mb-1">
                    {wearables.map((item, i) => (
                      <IntegrationCard
                        key={item.id}
                        integration={item}
                        isConnected={connectedIntegrations.has(item.id)}
                        onToggle={() => toggleIntegration(item.id)}
                        index={i}
                      />
                    ))}
                  </div>

                  {/* ── Nutrition Category ── */}
                  <CategoryHeader
                    title="Nutrition"
                    icon={<NutritionIcon size={11} />}
                    count={nutrition.length}
                    color="#FF9500"
                  />
                  <div className="flex flex-col gap-2 mb-1">
                    {nutrition.map((item, i) => (
                      <IntegrationCard
                        key={item.id}
                        integration={item}
                        isConnected={connectedIntegrations.has(item.id)}
                        onToggle={() => toggleIntegration(item.id)}
                        index={i + wearables.length}
                      />
                    ))}
                  </div>

                  {/* ── Data Ingestion (Lab Uploader) ── */}
                  <LabUploader />

                  {/* ── Clinical Category ── */}
                  <CategoryHeader
                    title="Clinical"
                    icon={<ClinicalIcon size={11} />}
                    count={clinical.length}
                    color="#BF5AF2"
                  />
                  <div className="flex flex-col gap-2 mb-1">
                    {clinical.map((item, i) => (
                      <IntegrationCard
                        key={item.id}
                        integration={item}
                        isConnected={connectedIntegrations.has(item.id)}
                        onToggle={() => toggleIntegration(item.id)}
                        index={i + wearables.length + nutrition.length}
                      />
                    ))}
                  </div>

                  {/* ── Performance Timeline ── */}
                  <div className="mt-4 mb-4">
                    <PerformanceTimeline />
                  </div>

                  {/* ── Request Integration ── */}
                  <RequestIntegrationSection />

                  <div className="h-6" />
                </div>
              )}

              {/* ══════════════════════════════════════════ */}
              {/* ── MENU TAB ── */}
              {/* ══════════════════════════════════════════ */}
              {activeTab === 'menu' && (
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 briefing-scroll">
                  {menuSections.map((section, sIdx) => (
                    <motion.div key={section.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sIdx * 0.05, duration: 0.3 }}>
                      <div className="flex items-center gap-2 px-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.85)' }}>{section.title}</span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                      </div>
                      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        {section.items.map((item, iIdx) => (
                          <button key={item.label} onClick={() => handleMenuAction(item.action)} className="w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 hover:bg-white/[0.03]" style={{ borderBottom: iIdx < section.items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                            <MenuIcon id={item.iconId} />
                            <span className="text-[12px] font-medium flex-1 text-left" style={{ color: 'rgba(255,255,255,0.65)' }}>{item.label}</span>
                            {item.badge && (
                              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,242,255,0.12)', color: 'rgba(0,242,255,0.9)', border: '1px solid rgba(0,242,255,0.2)' }}>{item.badge}</span>
                            )}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex items-center justify-center pt-4 pb-8">
                    <span className="text-[9px] uppercase tracking-[0.15em] font-medium" style={{ color: 'rgba(255,255,255,0.12)' }}>Vive 4.0 &middot; Elite Build</span>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Bio-Vault Modal */}
            <BioVault isOpen={bioVaultOpen} onClose={() => setBioVaultOpen(false)} sessionId={sessionId} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
