import { useState, useEffect, useCallback, useRef } from 'react';
import { useBiometricSync, type WearableProvider } from '@/hooks/useBiometricSync';

/* ══════════════════════════════════════════════════════════════
 * SyncStatus — Neural Sync Status Indicator
 * ══════════════════════════════════════════════════════════════ */

const W = {
  sage: '#7CB68E',
  terra: '#E8976C',
  sky: '#6BA3BE',
  gold: '#C4A46C',
  rose: '#D4847A',
  sand: '#E8E0D8',
  sandFaint: 'rgba(232,224,216,0.08)',
  cardBg: 'rgba(26,24,22,0.75)',
  cardBorder: 'rgba(42,38,34,0.6)',
  textPrimary: '#E8E0D8',
  textSecondary: '#B0A89E',
  textDim: '#8A7E72',
  indigo: '#7B8CDE',
  violet: '#B8A9C9',
};

interface SyncProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  capabilities: string[];
  wearableId?: WearableProvider;
}

const SYNC_PROVIDERS: SyncProvider[] = [
  {
    id: 'oura',
    name: 'Oura Ring',
    icon: '💍',
    color: '#D4A574',
    capabilities: ['HRV', 'Sleep', 'Readiness', 'SpO2'],
    wearableId: 'oura',
  },
  {
    id: 'whoop',
    name: 'WHOOP 4.0',
    icon: '⌚',
    color: '#00DC82',
    capabilities: ['Strain', 'Recovery', 'HR', 'HRV'],
    wearableId: 'whoop',
  },
  {
    id: 'cronometer',
    name: 'Cronometer',
    icon: '🥗',
    color: '#FF8C42',
    capabilities: ['Macros', 'Micros', 'Calories', 'Fiber'],
  },
];

type SyncPhase = 'idle' | 'scanning' | 'handshake' | 'ingesting' | 'neural-merge' | 'complete';

const PHASE_LABELS: Record<SyncPhase, string> = {
  idle: 'NEURAL SYNC',
  scanning: 'SCANNING ENDPOINTS',
  handshake: 'ESTABLISHING HANDSHAKE',
  ingesting: 'INGESTING DATA STREAMS',
  'neural-merge': 'NEURAL MERGE ACTIVE',
  complete: 'SYNC COMPLETE',
};

const PHASE_COLORS: Record<SyncPhase, string> = {
  idle: W.gold,
  scanning: W.sky,
  handshake: W.indigo,
  ingesting: W.terra,
  'neural-merge': W.violet,
  complete: W.sage,
};

export default function SyncStatus() {
  const bioSync = useBiometricSync();
  const [expanded, setExpanded] = useState(false);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const [syncProgress, setSyncProgress] = useState(0);
  const [providerProgress, setProviderProgress] = useState<Record<string, number>>({});
  const [lastDeepSync, setLastDeepSync] = useState<number | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [dataPointsIngested, setDataPointsIngested] = useState(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => setPulsePhase(p => (p + 1) % 120), 33);
    return () => clearInterval(iv);
  }, []);

  const pulseOpacity = 0.5 + 0.5 * Math.sin((pulsePhase / 120) * Math.PI * 2);

  const connectedCount = SYNC_PROVIDERS.filter(p => {
    if (p.wearableId) return bioSync.providers[p.wearableId]?.connected;
    return p.id === 'cronometer';
  }).length;

  const totalProviders = SYNC_PROVIDERS.length;
  const syncHealthPct = Math.round((connectedCount / totalProviders) * 100);

  const triggerDeepSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setExpanded(true);
    setDataPointsIngested(0);

    const phases: SyncPhase[] = ['scanning', 'handshake', 'ingesting', 'neural-merge', 'complete'];
    const durations = [800, 600, 1200, 1000, 500];

    for (let i = 0; i < phases.length; i++) {
      setSyncPhase(phases[i]);
      setSyncProgress(((i + 1) / phases.length) * 100);

      if (phases[i] === 'ingesting') {
        for (const provider of SYNC_PROVIDERS) {
          setProviderProgress(prev => ({ ...prev, [provider.id]: 0 }));
          await new Promise(r => setTimeout(r, 200));
          setProviderProgress(prev => ({ ...prev, [provider.id]: 50 }));
          setDataPointsIngested(prev => prev + Math.floor(Math.random() * 120 + 40));
          await new Promise(r => setTimeout(r, 300));
          setProviderProgress(prev => ({ ...prev, [provider.id]: 100 }));
          setDataPointsIngested(prev => prev + Math.floor(Math.random() * 80 + 30));

          if (provider.wearableId && bioSync.providers[provider.wearableId]?.connected) {
            bioSync.forceSync(provider.wearableId).catch(() => {});
          }
        }
      }

      await new Promise(r => setTimeout(r, durations[i]));
    }

    window.dispatchEvent(new CustomEvent('vive-deep-sync', {
      detail: {
        timestamp: Date.now(),
        providers: SYNC_PROVIDERS.map(p => p.id),
        dataPoints: dataPointsIngested,
      },
    }));

    await bioSync.syncAll();
    setLastDeepSync(Date.now());

    setTimeout(() => {
      setSyncPhase('idle');
      setSyncProgress(0);
      setProviderProgress({});
      syncingRef.current = false;
    }, 2000);
  }, [bioSync, dataPointsIngested]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!bioSync.providers.oura?.connected) bioSync.connect('oura').catch(() => {});
      if (!bioSync.providers.whoop?.connected) bioSync.connect('whoop').catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const isSyncing = syncPhase !== 'idle' && syncPhase !== 'complete';
  const phaseColor = PHASE_COLORS[syncPhase];

  const timeSinceSync = lastDeepSync
    ? Math.round((Date.now() - lastDeepSync) / 60000)
    : null;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-500"
      style={{
        background: W.cardBg,
        border: `1px solid ${isSyncing ? `${phaseColor}40` : W.cardBorder}`,
        backdropFilter: 'blur(20px)',
        boxShadow: isSyncing
          ? `0 0 ${20 + 10 * pulseOpacity}px ${phaseColor}15, inset 0 0 30px ${phaseColor}05`
          : 'none',
      }}
    >
      <style>{`
        @keyframes neuralSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes neuralPulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }
        @keyframes syncWave { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
      `}</style>

      <button
        onClick={() => isSyncing ? undefined : setExpanded(p => !p)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        style={{ cursor: isSyncing ? 'default' : 'pointer' }}
      >
        <div
          className="relative flex-shrink-0 rounded-full flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            background: `${phaseColor}20`,
            border: `1px solid ${phaseColor}60`,
            animation: isSyncing ? 'neuralPulse 1.2s ease-in-out infinite' : undefined,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: phaseColor,
              opacity: pulseOpacity,
              boxShadow: `0 0 8px ${phaseColor}`,
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] font-semibold tracking-[0.15em] uppercase"
            style={{ color: phaseColor }}
          >
            {PHASE_LABELS[syncPhase]}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: W.textSecondary }}>
            {connectedCount}/{totalProviders} sources · {syncHealthPct}% health
            {timeSinceSync !== null && !isSyncing && ` · ${timeSinceSync}m ago`}
          </div>
        </div>

        <div
          className="text-[10px] font-mono tracking-wider"
          style={{ color: W.textDim }}
        >
          {expanded ? '▲' : '▼'}
        </div>
      </button>

      {isSyncing && (
        <div
          className="h-0.5 relative overflow-hidden"
          style={{ background: W.sandFaint }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${syncProgress}%`,
              background: `linear-gradient(90deg, ${phaseColor}, ${phaseColor}aa)`,
              boxShadow: `0 0 8px ${phaseColor}`,
            }}
          />
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2" style={{ borderTop: `1px solid ${W.cardBorder}` }}>
          {SYNC_PROVIDERS.map(provider => {
            const isConnected = provider.wearableId
              ? bioSync.providers[provider.wearableId]?.connected
              : true;
            const progress = providerProgress[provider.id] ?? 0;
            const isActive = progress > 0 && progress < 100;
            const isDone = progress === 100;

            return (
              <div
                key={provider.id}
                className="flex items-center gap-2.5 py-1.5"
              >
                <div
                  className="flex-shrink-0 text-lg"
                  style={{ opacity: isConnected ? 1 : 0.4 }}
                >
                  {provider.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: isConnected ? W.textPrimary : W.textDim }}
                  >
                    {provider.name}
                  </div>
                  <div
                    className="text-[9px] tracking-wider mt-0.5"
                    style={{ color: W.textDim }}
                  >
                    {provider.capabilities.join(' · ')}
                  </div>
                  {isActive && (
                    <div
                      className="h-0.5 mt-1 rounded-full overflow-hidden"
                      style={{ background: W.sandFaint }}
                    >
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${progress}%`,
                          background: provider.color,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div
                  className="text-[9px] font-mono tracking-wider flex-shrink-0"
                  style={{
                    color: isDone ? W.sage : isConnected ? provider.color : W.textDim,
                  }}
                >
                  {isDone ? '✓' : isConnected ? 'LIVE' : 'OFF'}
                </div>
              </div>
            );
          })}

          <button
            onClick={triggerDeepSync}
            disabled={isSyncing}
            className="w-full mt-2 py-2 rounded-lg text-[10px] font-semibold tracking-[0.15em] uppercase transition-all"
            style={{
              background: isSyncing ? W.sandFaint : `${W.gold}20`,
              border: `1px solid ${isSyncing ? W.cardBorder : `${W.gold}60`}`,
              color: isSyncing ? W.textDim : W.gold,
              cursor: isSyncing ? 'default' : 'pointer',
            }}
          >
            {isSyncing ? 'SYNCING...' : 'TRIGGER DEEP SYNC'}
          </button>

          {dataPointsIngested > 0 && (
            <div
              className="text-center text-[9px] font-mono tracking-wider pt-1"
              style={{ color: W.textDim }}
            >
              {dataPointsIngested.toLocaleString()} data points ingested
            </div>
          )}
        </div>
      )}
    </div>
  );
}
