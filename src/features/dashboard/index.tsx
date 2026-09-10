import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { getTwinSessionId } from '@/lib/twinSession';
import { api } from '../../../convex/_generated/api';
import { usePerformanceScore } from './hooks/usePerformanceScore';
import type { PerformanceData } from './hooks/usePerformanceScore';
import { ProtocolStack } from '@/components/ProtocolStack';
import { DailyStack } from '@/components/DailyStack';
import { DailyMission } from '@/components/DailyMission';
import { CommandPalette } from '@/components/CommandPalette';
import { AIAssistant } from '@/components/AIAssistant';
import { OptimizationStore } from '@/components/OptimizationStore';
import { InsightFeed } from '@/components/InsightCard';
import { ProgressIntelligence } from '@/components/ProgressIntelligence';
import { BiometricDetail, getMetricKeyForSource } from '@/components/BiometricDetail';
import { DataVerifiedBadge, LabUpload } from '@/components/LabUpload';

/* ══════════════════════════════════════════════════════════════
   VIVE 4.0 — Redesigned Dashboard
   
   Centered on a "Daily Intelligence Feed" powered by
   BioIntelligence.ts. Clean, high-contrast, monochromatic
   with subtle glassmorphism. Protocol Stack is the hero.
   
   Now includes Data Sync pulse animation that ripples through
   the entire dashboard when lab values are saved via Ultra-Fast.
   ══════════════════════════════════════════════════════════════ */

/* ── Palette ── */
const P = {
  bg: '#050505',
  text: '#E8E8EC',
  muted: 'rgba(255,255,255,0.4)',
  dim: 'rgba(255,255,255,0.2)',
  border: 'rgba(255,255,255,0.06)',
  glass: 'rgba(18,18,22,0.7)',
  accent: '#00FFCC',
};

/* ── Vital Chip ── */
function VitalChip({ icon, label, value, unit, color, pulsing }: {
  icon: string; label: string; value: string; unit: string; color: string; pulsing?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-3 py-2.5 rounded-xl" style={{
      background: P.glass,
      border: `1px solid ${pulsing ? 'rgba(0,255,204,0.3)' : P.border}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: pulsing ? '0 0 20px rgba(0,255,204,0.1)' : 'none',
      transition: 'all 0.6s ease',
    }}>
      <span className="text-sm mb-1">{icon}</span>
      <span className="font-mono text-base font-bold tabular-nums" style={{
        color,
        textShadow: `0 0 10px ${color}30`,
      }}>
        {value}
      </span>
      <span className="font-mono text-[7px] tracking-[0.12em] uppercase mt-0.5" style={{ color: P.dim }}>
        {unit}
      </span>
    </div>
  );
}

/* ── Status Bar ── */
function StatusBar({ isConnected, timeStr }: { isConnected: boolean; timeStr: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-1.5 h-1.5 rounded-full" style={{
        background: isConnected ? P.accent : '#FFB86B',
        boxShadow: `0 0 6px ${isConnected ? 'rgba(0,255,204,0.5)' : 'rgba(255,184,107,0.5)'}`,
      }} />
      <span className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{
        color: isConnected ? 'rgba(0,255,204,0.7)' : 'rgba(255,184,107,0.7)',
      }}>
        {isConnected ? 'Online' : 'Syncing'}
      </span>
      <span className="font-mono text-[9px] ml-auto" style={{ color: P.dim }}>{timeStr}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DATA SYNC PULSE — Ripples through the entire dashboard
   when lab values are saved via Ultra-Fast mode.
   ══════════════════════════════════════════════════════════════ */

function DataSyncPulse({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none" style={{ animation: 'dataSyncFade 3s ease-out forwards' }}>
      {/* Expanding ring 1 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{
        width: '200vmax',
        height: '200vmax',
        border: '2px solid rgba(0,255,204,0.15)',
        animation: 'syncRingExpand 2s ease-out forwards',
      }} />
      {/* Expanding ring 2 (delayed) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{
        width: '200vmax',
        height: '200vmax',
        border: '1px solid rgba(0,255,204,0.1)',
        animation: 'syncRingExpand 2s ease-out 0.3s forwards',
        opacity: 0,
      }} />
      {/* Ambient glow wash */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at center, rgba(0,255,204,0.06) 0%, transparent 60%)',
        animation: 'syncGlowWash 2.5s ease-out forwards',
      }} />
      {/* Top-down scan line */}
      <div className="absolute left-0 right-0 h-[2px]" style={{
        background: 'linear-gradient(90deg, transparent, rgba(0,255,204,0.3), transparent)',
        animation: 'syncScanLine 1.5s ease-in-out forwards',
        top: '0%',
      }} />

      <style>{`
        @keyframes dataSyncFade {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes syncRingExpand {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
        @keyframes syncGlowWash {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes syncScanLine {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════ */

interface DashboardViewProps {
  onOpenBriefing?: (context?: 'chat' | 'camera' | 'voice') => void;
}

const Dashboard = ({ onOpenBriefing }: DashboardViewProps) => {
  const [redlineVisible, setRedlineVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [biometricDetailKey, setBiometricDetailKey] = useState<string | null>(null);
  const [labUploadOpen, setLabUploadOpen] = useState(false);
  const [dataSyncPulseActive, setDataSyncPulseActive] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Listen for metric click events from DataIngestionHeader
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.metricKey) setBiometricDetailKey(detail.metricKey);
      else if (detail?.sourceId) setBiometricDetailKey(getMetricKeyForSource(detail.sourceId));
    };
    window.addEventListener('vive-open-biometric-detail', handler);
    return () => window.removeEventListener('vive-open-biometric-detail', handler);
  }, []);

  // Listen for Data Sync pulse from Ultra-Fast lab entry
  useEffect(() => {
    const handler = () => {
      setDataSyncPulseActive(true);
      setTimeout(() => setDataSyncPulseActive(false), 3500);
    };
    window.addEventListener('vive-data-sync-pulse', handler);
    return () => window.removeEventListener('vive-data-sync-pulse', handler);
  }, []);

  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : 'ssr';

  const perf: PerformanceData = usePerformanceScore(sessionId);
  const health = useQuery(api.queries.connectionHealth) ?? null;
  const isConnected = (health as any)?.status === 'connected';

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const caloriesIn = perf.totalCaloriesIn;
  const caloriesOut = perf.totalCaloriesOut;
  const steps = perf.totalDuration > 0 ? Math.round(perf.totalDuration * 85) : 0;
  const sleepHours = perf.recovery >= 85 ? 8.1 : perf.recovery >= 70 ? 7.4 : perf.recovery >= 50 ? 6.5 : 5.8;

  return (
    <>
      {/* Data Sync Pulse Overlay */}
      <DataSyncPulse active={dataSyncPulseActive} />

      <CommandPalette
        onNavigate={(viewId) => {
          window.dispatchEvent(new CustomEvent('vive-navigate', { detail: { viewId } }));
        }}
        onToggleRedline={() => setRedlineVisible(r => !r)}
        onStartProtocol={(protocol) => {
          window.dispatchEvent(new CustomEvent('vive-start-protocol', { detail: { protocol } }));
        }}
      />
      <div
        className="font-mono px-5 pb-8 max-w-[640px] mx-auto"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.6s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Header ── */}
        <div className="mb-5 pt-2">
          <StatusBar isConnected={isConnected} timeStr={timeStr} />
          <h1 className="text-xl font-semibold mb-0.5" style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            color: P.text,
            letterSpacing: '-0.03em',
          }}>
            {greeting}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="font-mono text-[10px] tracking-[0.08em] uppercase" style={{ color: P.dim }}>
              Daily Intelligence Feed
            </p>
            <DataVerifiedBadge sessionId={sessionId} />
          </div>

          {/* Primary home CTAs — Morning Brief + Doctor Visit Prep */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('vive-open-morning-brief'))}
              className="flex-1 rounded-xl px-3 py-2.5 text-left transition-all"
              style={{
                background: 'rgba(0,255,204,0.08)',
                border: '1px solid rgba(0,255,204,0.22)',
              }}
            >
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: P.accent }}>
                Morning Brief
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: P.muted }}>
                Daily directives · open home brief
              </div>
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('vive-open-visit-packet'))}
              className="flex-1 rounded-xl px-3 py-2.5 text-left transition-all"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <div className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: '#60A5FA' }}>
                Visit Prep
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: P.muted }}>
                Doctor packet · JSON / printable
              </div>
            </button>
          </div>
        </div>

        {/* ── Vital Chips — compact row ── */}
        <div className="grid grid-cols-4 gap-2 mb-5" style={{ animation: 'fadeSlideUp 0.4s ease both 0.05s' }}>
          <VitalChip icon="❤️" label="HR" value={perf.currentHrv > 0 ? String(Math.round(68 + Math.random() * 8)) : '—'} unit="BPM" color="#FF6B6B" pulsing={dataSyncPulseActive} />
          <VitalChip icon="💚" label="HRV" value={perf.currentHrv > 0 ? String(perf.currentHrv) : '—'} unit="MS" color="#00FFCC" pulsing={dataSyncPulseActive} />
          <VitalChip icon="🔥" label="Cal" value={caloriesIn > 0 ? String(caloriesIn) : '—'} unit="KCAL" color="#FFB86B" pulsing={dataSyncPulseActive} />
          <VitalChip icon="🌙" label="Sleep" value={sleepHours > 0 ? sleepHours.toFixed(1) : '—'} unit="HRS" color="#6B8AFF" pulsing={dataSyncPulseActive} />
        </div>

        {/* ── Daily Mission — Protocol Checklist ── */}
        <div className="mb-5" style={{ animation: 'fadeSlideUp 0.4s ease both 0.1s' }}>
          {sessionId ? (
            <DailyMission sessionId={sessionId} />
          ) : (
            <div className="rounded-2xl p-4 text-center" style={{ background: P.glass, border: `1px solid ${P.border}` }}>
              <span className="text-[10px] font-mono" style={{ color: P.dim }}>Session required</span>
            </div>
          )}
        </div>

        {/* ══ PROTOCOL STACK — Hero Section ══ */}
        <div className="mb-5" style={{ animation: 'fadeSlideUp 0.4s ease both 0.15s' }}>
          <ProtocolStack />
        </div>

        {/* ══ BIOMETRIC INTELLIGENCE — InsightFeed ══ */}
        <div className="mb-5" style={{ animation: 'fadeSlideUp 0.4s ease both 0.2s' }}>
          <InsightFeed
            onProductClick={(productId) => {
              const el = document.getElementById('optimization-store');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </div>

        {/* ── Daily Stack — Supplement Checklist ── */}
        <div className="mb-5" style={{ animation: 'fadeSlideUp 0.4s ease both 0.25s' }}>
          <DailyStack sessionId={sessionId || 'vive-user-001'} />
        </div>

        {/* ══ OPTIMIZATION STORE — AI-Matched Products ══ */}
        <div id="optimization-store" className="mb-5" style={{ animation: 'fadeSlideUp 0.4s ease both 0.3s' }}>
          <OptimizationStore />
        </div>

        {/* ══ PROGRESS INTELLIGENCE — Proof of Value ══ */}
        <div className="mb-5" style={{ animation: 'fadeSlideUp 0.4s ease both 0.35s' }}>
          <ProgressIntelligence />
        </div>
      </div>

      <AIAssistant />

      <LabUpload
        isOpen={labUploadOpen}
        onClose={() => setLabUploadOpen(false)}
        sessionId={sessionId}
      />

      <BiometricDetail
        metricKey={biometricDetailKey}
        onClose={() => setBiometricDetailKey(null)}
      />

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default Dashboard;
