import React, { useState, Suspense, lazy, useCallback, useEffect, Component, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TopHeader from './TopHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import HUDOverlay from './HUDOverlay';
import { ViveOrbModal, type OrbLogResult } from '@/components/ViveOrb';
import { CommandBar, useCommandBar } from '@/components/layout/CommandBar';
import QuickLogDrawer from '@/components/QuickLogDrawer';
import MorningBriefModal from '@/components/MorningBriefModal';
import ExportUtility from '@/components/ExportUtility';
import { ViewGate, EliteBlurGate } from '@/components/AccessController';

export type ViewId = 'dashboard' | 'biovault' | 'journal' | 'briefing' | 'protocols' | 'network' | 'settings' | 'vitals' | 'progress' | 'plan' | 'milestones' | 'trainer' | 'squad' | 'missions' | 'biometrics' | 'supplements' | 'workouts' | 'nutrition' | 'blueprint' | 'activity' | 'community' | 'dna' | 'report' | 'biomarkers' | 'research';

/* ── Inline ErrorBoundary for view isolation ── */
interface VBProps { children: ReactNode; label: string; onRetry?: () => void }
interface VBState { hasError: boolean; error: string | null }

class ViewBoundary extends Component<VBProps, VBState> {
  constructor(props: VBProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): VBState {
    return { hasError: true, error: error?.message || 'Unknown error' };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ViewBoundary] ${this.props.label} crashed:`, error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="rounded-xl p-6 text-center max-w-sm" style={{ background: 'rgba(10,10,10,0.6)', border: '1px solid rgba(255,59,48,0.12)', backdropFilter: 'blur(12px)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3 mx-auto" style={{ background: 'rgba(255,59,48,0.08)', border: '1.5px solid rgba(255,59,48,0.2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] block mb-1" style={{ color: 'rgba(255,59,48,0.7)' }}>
              {this.props.label}_RECALIBRATING
            </span>
            <span className="text-[9px] font-mono block mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {this.state.error}
            </span>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); this.props.onRetry?.(); }}
              className="px-5 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all duration-200"
              style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)', color: 'rgba(255,59,48,0.6)' }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Lazy-loaded Views ── */
const DashboardView = lazy(() => import('@/features/dashboard/index'));
const Induction = lazy(() => import('@/components/Onboarding/Induction'));

function resolve(m: any) {
  if (m && m.default) return m;
  const keys = Object.keys(m || {});
  for (const k of keys) { if (typeof m[k] === 'function') return { default: m[k] }; }
  return m;
}

const BioVaultView = lazy(() => import('../Views/BioVaultView').then(resolve));
const JournalView = lazy(() => import('../Views/JournalView').then(resolve));
const BriefingView = lazy(() => import('../Views/BriefingView').then(resolve));
const ProtocolsView = lazy(() => import('../Views/ProtocolsView').then(resolve));
const DNAView = lazy(() => import('../Views/DNAView/index').then(resolve));
const ActivityView = lazy(() => import('../Views/ActivityView').then(resolve));
const NutritionView = lazy(() => import('../Views/NutritionView').then(resolve));
const BioMetricsView = lazy(() => import('../Views/BioMetricsView').then(resolve));
const VitalsView = lazy(() => import('../Views/VitalsView').then(resolve));
const ProgressView = lazy(() => import('../Views/ProgressView').then(resolve));
const PlanView = lazy(() => import('../Views/PlanView').then(resolve));
const CommunityView = lazy(() => import('../Views/CommunityView').then(resolve));
const BlueprintView = lazy(() => import('../Views/BlueprintView').then(resolve));
const MilestoneGallery = lazy(() => import('../Views/MilestoneGallery').then(resolve));
const WeeklyReportView = lazy(() => import('../Views/WeeklyReportView').then(resolve));
const ResearchLibrary = lazy(() => import('../ClinicalAdvisor').then(resolve));

/* ── Premium View Transition Variants ── */
const viewTransition = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } },
};

function SyncingFallback() {
  return (
    <div className="flex items-center justify-center py-24 font-mono text-[13px] tracking-[2px]"
      style={{ color: '#00ffcc' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
          style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
          SYSTEM_SYNCING...
        </span>
      </div>
    </div>
  );
}

/* ── View Router with AnimatePresence + ErrorBoundary per view ── */
function ActiveViewRenderer({ activeView, onOpenBriefing }: { activeView: ViewId; onOpenBriefing: (ctx?: 'chat' | 'camera' | 'voice') => void }) {
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <ViewBoundary label="DASHBOARD"><DashboardView onOpenBriefing={onOpenBriefing} /></ViewBoundary>;
      case 'biovault':
        return <ViewBoundary label="BIOVAULT"><EliteBlurGate feature="bio-vault" onNavigateBack={() => onOpenBriefing()}><BioVaultView /></EliteBlurGate></ViewBoundary>;
      case 'vitals':
        return <ViewBoundary label="VITALS"><VitalsView /></ViewBoundary>;
      case 'journal':
        return <ViewBoundary label="JOURNAL"><JournalView /></ViewBoundary>;
      case 'briefing':
        return <ViewBoundary label="BRIEFING"><BriefingView /></ViewBoundary>;
      case 'protocols':
        return <ViewBoundary label="PROTOCOLS"><ProtocolsView /></ViewBoundary>;
      case 'dna':
        return <ViewBoundary label="DNA"><ViewGate feature="dna-insights" onNavigateBack={() => onOpenBriefing()}><DNAView /></ViewGate></ViewBoundary>;
      case 'activity':
      case 'workouts':
        return <ViewBoundary label="ACTIVITY"><ActivityView /></ViewBoundary>;
      case 'nutrition':
      case 'supplements':
        return <ViewBoundary label="NUTRITION"><NutritionView /></ViewBoundary>;
      case 'biometrics':
        return <ViewBoundary label="BIOMETRICS"><ViewGate feature="advanced-bio-analytics" onNavigateBack={() => onOpenBriefing()}><BioMetricsView /></ViewGate></ViewBoundary>;
      case 'progress':
        return <ViewBoundary label="PROGRESS"><ProgressView /></ViewBoundary>;
      case 'plan':
        return <ViewBoundary label="PLAN"><PlanView /></ViewBoundary>;
      case 'community':
      case 'network':
      case 'squad':
        return <ViewBoundary label="COMMUNITY"><ViewGate feature="peer-network" onNavigateBack={() => onOpenBriefing()}><CommunityView /></ViewGate></ViewBoundary>;
      case 'blueprint':
        return <ViewBoundary label="BLUEPRINT"><ViewGate feature="blueprint-builder" onNavigateBack={() => onOpenBriefing()}><BlueprintView /></ViewGate></ViewBoundary>;
      case 'milestones':
      case 'missions':
        return <ViewBoundary label="MILESTONES"><MilestoneGallery /></ViewBoundary>;
      case 'report':
        return <ViewBoundary label="REPORT"><ViewGate feature="weekly-report" onNavigateBack={() => onOpenBriefing()}><WeeklyReportView /></ViewGate></ViewBoundary>;
      case 'trainer':
        return <ViewBoundary label="TRAINER"><ProtocolsView /></ViewBoundary>;
      case 'research':
        return <ViewBoundary label="RESEARCH"><ResearchLibrary /></ViewBoundary>;
      default:
        return <ViewBoundary label="DASHBOARD"><DashboardView onOpenBriefing={onOpenBriefing} /></ViewBoundary>;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeView}
        variants={viewTransition}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {renderView()}
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Induction Gate Check ── */
function useInductionGate(): { showInduction: boolean; completeInduction: () => void } {
  const [showInduction, setShowInduction] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('vive-induction-complete') !== 'true';
  });

  const completeInduction = useCallback(() => {
    sessionStorage.setItem('vive-induction-complete', 'true');
    setShowInduction(false);
  }, []);

  return { showInduction, completeInduction };
}

export function ViewManager() {
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [ghostMode, setGhostMode] = useState(false);
  const [orbOpen, setOrbOpen] = useState(false);
  const [orbInitialMode, setOrbInitialMode] = useState<'idle' | 'voice' | 'photo'>('idle');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [morningBriefOpen, setMorningBriefOpen] = useState(false);
  const [visitPacketOpen, setVisitPacketOpen] = useState(false);
  const { showInduction, completeInduction } = useInductionGate();

  // CommandBar state (with global Cmd+K listener)
  const commandBar = useCommandBar();

  const handleOpenBriefing = useCallback((context?: 'chat' | 'camera' | 'voice') => {
    setActiveView('briefing');
  }, []);

  const handleOrbLog = useCallback((result: OrbLogResult) => {
    console.log('Orb logged:', result);
  }, []);

  /* ── V Button Gesture Handlers ── */
  const handleViveTap = useCallback(() => {
    setOrbInitialMode('idle');
    setOrbOpen(true);
  }, []);

  const handleViveDoubleTap = useCallback(() => {
    setOrbInitialMode('photo');
    setOrbOpen(true);
  }, []);

  const handleViveLongPress = useCallback(() => {
    setOrbInitialMode('voice');
    setOrbOpen(true);
    setIsVoiceActive(true);
  }, []);

  const handleViveLongPressEnd = useCallback(() => {
    setIsVoiceActive(false);
  }, []);

  const handleOrbClose = useCallback(() => {
    setOrbOpen(false);
    setIsVoiceActive(false);
  }, []);

  const handleInductionComplete = useCallback(() => {
    completeInduction();
  }, [completeInduction]);

  const handleOpenQuickLog = useCallback(() => {
    setQuickLogOpen(true);
  }, []);

  const handleCloseQuickLog = useCallback(() => {
    setQuickLogOpen(false);
  }, []);

  const openMorningBrief = useCallback(() => {
    setMorningBriefOpen(true);
  }, []);

  const closeMorningBrief = useCallback(() => {
    setMorningBriefOpen(false);
    try {
      const key = `vive-morning-brief-shown-${new Date().toISOString().slice(0, 10)}`;
      localStorage.setItem(key, '1');
    } catch { /* ignore */ }
  }, []);

  const openVisitPacket = useCallback(() => {
    setVisitPacketOpen(true);
  }, []);

  const closeVisitPacket = useCallback(() => {
    setVisitPacketOpen(false);
  }, []);

  // Global open events (Cmd+K / dashboard CTAs)
  useEffect(() => {
    const onBrief = () => openMorningBrief();
    const onVisit = () => openVisitPacket();
    window.addEventListener('vive-open-morning-brief', onBrief);
    window.addEventListener('vive-open-visit-packet', onVisit);
    return () => {
      window.removeEventListener('vive-open-morning-brief', onBrief);
      window.removeEventListener('vive-open-visit-packet', onVisit);
    };
  }, [openMorningBrief, openVisitPacket]);

  // Default: open Morning Brief once per day after induction (demo home)
  useEffect(() => {
    if (showInduction) return;
    let cancelled = false;
    try {
      const key = `vive-morning-brief-shown-${new Date().toISOString().slice(0, 10)}`;
      if (localStorage.getItem(key) === '1') return;
    } catch { /* ignore */ }
    const t = window.setTimeout(() => {
      if (cancelled) return;
      setMorningBriefOpen(true);
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [showInduction]);

  return (
    <div className="relative min-h-screen font-mono" style={{ background: '#050505' }}>
      {/* Induction Gate Overlay */}
      <AnimatePresence>
        {showInduction && (
          <motion.div
            key="induction-gate"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[100]"
          >
            <Suspense fallback={
              <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#050508' }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400" style={{ animation: 'spin 1s linear infinite' }} />
                  <span className="text-[11px] font-mono tracking-wider" style={{ color: 'rgba(0,240,255,0.5)' }}>Loading Induction...</span>
                </div>
              </div>
            }>
              <Induction onComplete={handleInductionComplete} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full"
          style={{
            background: ghostMode
              ? 'radial-gradient(ellipse, rgba(120,120,120,0.04) 0%, transparent 70%)'
              : 'radial-gradient(ellipse, rgba(0,240,255,0.03) 0%, transparent 70%)',
          }} />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full"
          style={{
            background: ghostMode
              ? 'radial-gradient(ellipse, rgba(100,100,100,0.03) 0%, transparent 70%)'
              : 'radial-gradient(ellipse, rgba(0,255,170,0.02) 0%, transparent 70%)',
          }} />
      </div>

      {/* Scanline overlay */}
      <HUDOverlay />

      {/* Main layout */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <TopHeader
          activeView={activeView}
          mounted={true}
          ghostMode={ghostMode}
          onLogoClick={() => setActiveView('dashboard')}
          onOrbOpen={handleViveTap}
          onToggleGhost={() => setGhostMode(g => !g)}
          onOpenBriefing={() => setActiveView('briefing')}
          onOpenCommandBar={commandBar.open}
        />

        {/* View container with smooth transitions */}
        <main className="flex-1 relative">
          <div className="absolute top-0 left-4 right-4 h-px"
            style={{
              background: ghostMode
                ? 'linear-gradient(90deg, transparent, rgba(160,160,160,0.1), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(0,240,255,0.15), transparent)',
            }} />

          <Suspense fallback={<SyncingFallback />}>
            <ActiveViewRenderer activeView={activeView} onOpenBriefing={handleOpenBriefing} />
          </Suspense>
        </main>

        <BottomNav
          activeView={activeView}
          onNavigate={setActiveView}
          onViveTap={handleViveTap}
          onViveDoubleTap={handleViveDoubleTap}
          onViveLongPress={handleViveLongPress}
          onViveLongPressEnd={handleViveLongPressEnd}
          isVoiceActive={isVoiceActive}
        />
      </div>

      {/* ViveOrb Modal */}
      <ViveOrbModal
        isOpen={orbOpen}
        onClose={handleOrbClose}
        onLog={handleOrbLog}
        onVisionMirror={() => { handleOrbClose(); setActiveView('briefing'); }}
        initialMode={orbInitialMode}
      />

      {/* Command Bar */}
      <CommandBar
        isOpen={commandBar.isOpen}
        onClose={commandBar.close}
        onNavigate={(view) => { setActiveView(view); commandBar.close(); }}
        activeView={activeView}
        onOpenQuickLog={handleOpenQuickLog}
      />

      {/* QuickLog Drawer */}
      <QuickLogDrawer
        isOpen={quickLogOpen}
        onClose={handleCloseQuickLog}
      />

      {/* Morning Brief — demo home entry */}
      <MorningBriefModal
        isOpen={morningBriefOpen}
        onClose={closeMorningBrief}
      />

      {/* Doctor Visit Prep packet (ExportUtility + BioResume data) */}
      <ExportUtility
        isOpen={visitPacketOpen}
        onClose={closeVisitPacket}
      />
    </div>
  );
}
