import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "@/components/Presence/usePresenceState";

/* ══════════════════════════════════════════════════════════════ */
/*  useBiometricSync — Wearable stubs (NOT live)                 */
/*  Oura / Whoop / Apple / Garmin OAuth is coming later.         */
/*  Demo connect path is labeled simulated — never claim live.   */
/*  Prefer Manual Vitals (quickLog) for real twin data.          */
/* ══════════════════════════════════════════════════════════════ */

/* ── Provider Definitions ── */
export type WearableProvider = "oura" | "whoop" | "apple_health" | "garmin";

export interface ProviderConfig {
  id: WearableProvider;
  name: string;
  icon: string;
  color: string;
  capabilities: string[];
  syncIntervalMs: number;
}

export const PROVIDERS: Record<WearableProvider, ProviderConfig> = {
  oura: {
    id: "oura",
    name: "Oura Ring",
    icon: "💍",
    color: "#D4A574",
    capabilities: ["hrv", "sleep", "readiness", "temperature", "spo2"],
    syncIntervalMs: 5000,
  },
  whoop: {
    id: "whoop",
    name: "WHOOP 4.0",
    icon: "⌚",
    color: "#00DC82",
    capabilities: ["hrv", "strain", "recovery", "sleep", "hr"],
    syncIntervalMs: 3000,
  },
  apple_health: {
    id: "apple_health",
    name: "Apple Health",
    icon: "🍎",
    color: "#FF375F",
    capabilities: ["hr", "hrv", "sleep", "steps", "spo2", "respiratory"],
    syncIntervalMs: 4000,
  },
  garmin: {
    id: "garmin",
    name: "Garmin Connect",
    icon: "🏃",
    color: "#007CC3",
    capabilities: ["hr", "hrv", "sleep", "stress", "body_battery", "spo2"],
    syncIntervalMs: 6000,
  },
};

/* ── Synced Vitals Shape ── */
export interface SyncedVitals {
  heartRate: number;
  hrv: number;
  sleepHours: number;
  sleepScore: number;
  sleepDeepPct: number;
  sleepRemPct: number;
  spo2: number;
  respiratoryRate: number;
  skinTemp: number;
  recovery: number;
  strain: number;
  stress: number;
  bodyBattery: number;
  steps: number;
  readiness: number;
  lastSyncAt: number;
}

export interface ProviderStatus {
  provider: WearableProvider;
  connected: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  recordsSynced: number;
  error: string | null;
}

export interface BiometricSyncState {
  vitals: SyncedVitals;
  providers: Record<WearableProvider, ProviderStatus>;
  isAnyConnected: boolean;
  isSyncing: boolean;
  totalRecordsSynced: number;
  connect: (provider: WearableProvider) => Promise<void>;
  disconnect: (provider: WearableProvider) => void;
  forceSync: (provider: WearableProvider) => Promise<void>;
  syncAll: () => Promise<void>;
}

/* ── Realistic random walk with mean reversion ── */
function walkValue(
  current: number,
  target: number,
  min: number,
  max: number,
  volatility: number,
  reversion: number
): number {
  const noise = (Math.random() - 0.5) * 2 * volatility;
  const pull = (target - current) * reversion;
  return Math.max(min, Math.min(max, current + noise + pull));
}

/* ── Generate realistic sleep data (refreshes once per "night") ── */
function generateSleepData(): {
  hours: number;
  score: number;
  deepPct: number;
  remPct: number;
} {
  const hours = 6.5 + Math.random() * 2.5; // 6.5–9h
  const deepPct = 12 + Math.random() * 16; // 12–28%
  const remPct = 18 + Math.random() * 12; // 18–30%
  const efficiency = 85 + Math.random() * 13; // 85–98%
  const score = Math.round(
    (hours / 9) * 30 + (deepPct / 28) * 25 + (remPct / 30) * 20 + (efficiency / 100) * 25
  );
  return { hours: Math.round(hours * 10) / 10, score: Math.min(100, score), deepPct: Math.round(deepPct), remPct: Math.round(remPct) };
}

/* ── Provider-specific data simulation ── */
function simulateProviderData(
  provider: WearableProvider,
  prev: SyncedVitals
): Partial<SyncedVitals> {
  const now = Date.now();

  switch (provider) {
    case "oura":
      return {
        hrv: Math.round(walkValue(prev.hrv, 55, 18, 120, 3, 0.05)),
        spo2: Math.round(walkValue(prev.spo2, 97.5, 94, 100, 0.3, 0.1)),
        skinTemp: Math.round(walkValue(prev.skinTemp, 36.6, 35.8, 37.4, 0.1, 0.08) * 10) / 10,
        readiness: Math.round(walkValue(prev.readiness, 78, 30, 100, 2, 0.04)),
        lastSyncAt: now,
      };

    case "whoop":
      return {
        heartRate: Math.round(walkValue(prev.heartRate, 68, 48, 110, 2, 0.06)),
        hrv: Math.round(walkValue(prev.hrv, 58, 18, 130, 4, 0.05)),
        recovery: Math.round(walkValue(prev.recovery, 75, 20, 100, 3, 0.04)),
        strain: Math.round(walkValue(prev.strain, 8, 0, 21, 0.5, 0.03) * 10) / 10,
        lastSyncAt: now,
      };

    case "apple_health":
      return {
        heartRate: Math.round(walkValue(prev.heartRate, 70, 50, 105, 1.5, 0.07)),
        hrv: Math.round(walkValue(prev.hrv, 52, 15, 115, 2.5, 0.05)),
        spo2: Math.round(walkValue(prev.spo2, 98, 95, 100, 0.2, 0.12)),
        respiratoryRate: Math.round(walkValue(prev.respiratoryRate, 15, 12, 20, 0.3, 0.06) * 10) / 10,
        steps: Math.min(25000, prev.steps + Math.round(Math.random() * 200)),
        lastSyncAt: now,
      };

    case "garmin":
      return {
        heartRate: Math.round(walkValue(prev.heartRate, 66, 46, 108, 2, 0.06)),
        stress: Math.round(walkValue(prev.stress, 30, 5, 100, 3, 0.05)),
        bodyBattery: Math.round(walkValue(prev.bodyBattery, 65, 5, 100, 2, 0.04)),
        spo2: Math.round(walkValue(prev.spo2, 97, 94, 100, 0.3, 0.1)),
        lastSyncAt: now,
      };

    default:
      return { lastSyncAt: now };
  }
}

/* ── Default initial vitals ── */
function getDefaultVitals(): SyncedVitals {
  const sleep = generateSleepData();
  return {
    heartRate: 68,
    hrv: 52,
    sleepHours: sleep.hours,
    sleepScore: sleep.score,
    sleepDeepPct: sleep.deepPct,
    sleepRemPct: sleep.remPct,
    spo2: 97,
    respiratoryRate: 15,
    skinTemp: 36.6,
    recovery: 78,
    strain: 6.2,
    stress: 28,
    bodyBattery: 65,
    steps: 2400,
    readiness: 76,
    lastSyncAt: Date.now(),
  };
}

function getDefaultProviderStatus(provider: WearableProvider): ProviderStatus {
  return {
    provider,
    connected: false,
    syncing: false,
    lastSyncAt: null,
    recordsSynced: 0,
    error: null,
  };
}

/* ══════════════════════════════════════════════════════════════ */
/*  Main Hook                                                    */
/* ══════════════════════════════════════════════════════════════ */

export function useBiometricSync(): BiometricSyncState {
  const sessionId = getSessionId();
  const upsertPresence = useMutation(api.mutations.upsertPresence);

  const [vitals, setVitals] = useState<SyncedVitals>(getDefaultVitals);
  const [providers, setProviders] = useState<Record<WearableProvider, ProviderStatus>>(() => ({
    oura: getDefaultProviderStatus("oura"),
    whoop: getDefaultProviderStatus("whoop"),
    apple_health: getDefaultProviderStatus("apple_health"),
    garmin: getDefaultProviderStatus("garmin"),
  }));

  const intervalsRef = useRef<Map<WearableProvider, ReturnType<typeof setInterval>>>(new Map());
  const vitalsRef = useRef(vitals);
  vitalsRef.current = vitals;

  /* ── Broadcast only when a demo provider is connected (simulated) ── */
  const lastBroadcastRef = useRef(0);
  const providersRef = useRef(providers);
  providersRef.current = providers;
  useEffect(() => {
    const broadcastInterval = setInterval(() => {
      const anyConnected = Object.values(providersRef.current).some((p) => p.connected);
      if (!anyConnected) return;
      const now = Date.now();
      if (now - lastBroadcastRef.current < 2000) return;
      lastBroadcastRef.current = now;

      window.dispatchEvent(
        new CustomEvent("vive-biometric-sync", {
          detail: {
            heartRate: vitalsRef.current.heartRate,
            hrv: vitalsRef.current.hrv,
            recovery: vitalsRef.current.recovery,
            sleepScore: vitalsRef.current.sleepScore,
            sleepHours: vitalsRef.current.sleepHours,
            spo2: vitalsRef.current.spo2,
            stress: vitalsRef.current.stress,
            readiness: vitalsRef.current.readiness,
            strain: vitalsRef.current.strain,
            simulated: true,
          },
        })
      );
    }, 2000);

    return () => clearInterval(broadcastInterval);
  }, []);

  /* ── Simulate a provider sync cycle ── */
  const runSync = useCallback(
    async (provider: WearableProvider) => {
      setProviders((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], syncing: true, error: null },
      }));

      // Simulate network latency (200–600ms)
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));

      // Simulate occasional sync failure (3% chance)
      if (Math.random() < 0.03) {
        setProviders((prev) => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            syncing: false,
            error: "Connection timeout — retrying next cycle",
          },
        }));
        return;
      }

      // Generate provider-specific data
      const newData = simulateProviderData(provider, vitalsRef.current);

      setVitals((prev) => {
        const merged = { ...prev, ...newData };
        vitalsRef.current = merged;
        return merged;
      });

      setProviders((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          syncing: false,
          lastSyncAt: Date.now(),
          recordsSynced: prev[provider].recordsSynced + 1,
          error: null,
        },
      }));
    },
    []
  );

  /* ── Connect a provider — starts periodic sync ── */
  const connect = useCallback(
    async (provider: WearableProvider) => {
      // Already connected
      if (intervalsRef.current.has(provider)) return;

      setProviders((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          connected: true,
          syncing: true,
          error: "Simulated demo only — live OAuth coming later",
        },
      }));

      // Initial simulated sync (not a real wearable)
      await runSync(provider);

      // Start periodic sync
      const config = PROVIDERS[provider];
      const interval = setInterval(() => {
        runSync(provider);
      }, config.syncIntervalMs);

      intervalsRef.current.set(provider, interval);
    },
    [runSync]
  );

  /* ── Disconnect a provider ── */
  const disconnect = useCallback((provider: WearableProvider) => {
    const interval = intervalsRef.current.get(provider);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(provider);
    }

    setProviders((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        connected: false,
        syncing: false,
        error: null,
      },
    }));
  }, []);

  /* ── Force sync a specific provider ── */
  const forceSync = useCallback(
    async (provider: WearableProvider) => {
      if (!providers[provider].connected) return;
      await runSync(provider);
    },
    [providers, runSync]
  );

  /* ── Sync all connected providers ── */
  const syncAll = useCallback(async () => {
    const connected = Object.values(providers).filter((p) => p.connected);
    await Promise.all(connected.map((p) => runSync(p.provider)));
  }, [providers, runSync]);

  /* ── Cleanup intervals on unmount ── */
  useEffect(() => {
    return () => {
      for (const interval of intervalsRef.current.values()) {
        clearInterval(interval);
      }
      intervalsRef.current.clear();
    };
  }, []);

  /* ── Refresh sleep data once per session (simulates overnight sync) ── */
  useEffect(() => {
    const sleepRefresh = setTimeout(() => {
      const newSleep = generateSleepData();
      setVitals((prev) => ({
        ...prev,
        sleepHours: newSleep.hours,
        sleepScore: newSleep.score,
        sleepDeepPct: newSleep.deepPct,
        sleepRemPct: newSleep.remPct,
      }));
    }, 30000 + Math.random() * 30000); // 30–60s after mount

    return () => clearTimeout(sleepRefresh);
  }, []);

  /* ── Derived state ── */
  const isAnyConnected = useMemo(
    () => Object.values(providers).some((p) => p.connected),
    [providers]
  );

  const isSyncing = useMemo(
    () => Object.values(providers).some((p) => p.syncing),
    [providers]
  );

  const totalRecordsSynced = useMemo(
    () => Object.values(providers).reduce((s, p) => s + p.recordsSynced, 0),
    [providers]
  );

  return {
    vitals,
    providers,
    isAnyConnected,
    isSyncing,
    totalRecordsSynced,
    connect,
    disconnect,
    forceSync,
    syncAll,
  };
}

/* ══════════════════════════════════════════════════════════════ */
/*  Standalone listener hook for components that just need       */
/*  to consume synced vitals without managing connections         */
/* ══════════════════════════════════════════════════════════════ */

export interface PassiveVitals {
  heartRate: number;
  hrv: number;
  recovery: number;
  sleepScore: number;
  sleepHours: number;
  spo2: number;
  stress: number;
  readiness: number;
  strain: number;
  hasSyncData: boolean;
}

export function useSyncedVitals(): PassiveVitals {
  const [data, setData] = useState<PassiveVitals>({
    heartRate: 0,
    hrv: 0,
    recovery: 0,
    sleepScore: 0,
    sleepHours: 0,
    spo2: 0,
    stress: 0,
    readiness: 0,
    strain: 0,
    hasSyncData: false,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d) {
        setData({
          heartRate: d.heartRate ?? 0,
          hrv: d.hrv ?? 0,
          recovery: d.recovery ?? 0,
          sleepScore: d.sleepScore ?? 0,
          sleepHours: d.sleepHours ?? 0,
          spo2: d.spo2 ?? 0,
          stress: d.stress ?? 0,
          readiness: d.readiness ?? 0,
          strain: d.strain ?? 0,
          hasSyncData: true,
        });
      }
    };

    window.addEventListener("vive-biometric-sync", handler);
    return () => window.removeEventListener("vive-biometric-sync", handler);
  }, []);

  return data;
}
