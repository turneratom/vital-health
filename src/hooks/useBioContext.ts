import { useQuery } from 'convex/react';
import { useMemo, useEffect, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { readCacheSync, writeCache, CACHE_KEYS } from '@/lib/localFirstCache';

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════════
   useBioContext — Unified Bio-Intelligence Aggregator
   
   LOCAL-FIRST: On app reopen, instantly hydrates from IndexedDB/
   localStorage cache while Convex syncs in the background. The UI
   never shows an empty state — cached data renders immediately
   with a subtle "syncing" indicator until fresh data arrives.
   ═══════════════════════════════════════════════════════════════ */


export interface BioContextInsight {
  id: string;
  priority: 'critical' | 'high' | 'moderate';
  title: string;
  action: string;
  sources: Array<{
    system: 'somatic' | 'inventory' | 'drift' | 'biomarker';
    detail: string;
  }>;
  correlationScore: number;
  generatedAt: number;
}

export interface BioContextStatus {
  somaticSignals: number;
  inventoryAlerts: number;
  driftEvents: number;
  overallIntegrity: number;
}

export interface BioContextData {
  insights: BioContextInsight[];
  systemStatus: BioContextStatus;
  lastUpdated: number;
  isLoading: boolean;
  isSyncing: boolean;
  isFromCache: boolean;
  hasCritical: boolean;
  hasHigh: boolean;
  topInsight: BioContextInsight | null;
  integrityLabel: string;
  integrityColor: string;
}

interface CachedBioPayload {
  insights: BioContextInsight[];
  systemStatus: BioContextStatus;
  lastUpdated: number;
}

const DEFAULT_STATUS: BioContextStatus = {
  somaticSignals: 0,
  inventoryAlerts: 0,
  driftEvents: 0,
  overallIntegrity: 100,
};

function deriveIntegrity(integrity: number): { label: string; color: string } {
  if (integrity < 40) return { label: 'Critical', color: '#FF6B6B' };
  if (integrity < 60) return { label: 'Degraded', color: '#E8976C' };
  if (integrity < 80) return { label: 'Suboptimal', color: '#FFD700' };
  return { label: 'Optimal', color: '#00DC82' };
}

export function useBioContext(): BioContextData {
  const sessionId = useMemo(() => getTwinSessionId(), []);

  // Synchronous cache read for instant first render
  const cachedRef = useRef(
    readCacheSync<CachedBioPayload>(CACHE_KEYS.BIO_CONTEXT, sessionId)
  );
  const [cachedData] = useState(() => cachedRef.current.data);

  // Live Convex query
  const raw = useQuery(api.bioContext.getSynthesizedInsights, { sessionId });

  // Write to cache whenever fresh data arrives
  const lastWrittenRef = useRef<number>(0);
  useEffect(() => {
    if (raw && raw.lastUpdated !== lastWrittenRef.current) {
      lastWrittenRef.current = raw.lastUpdated;
      writeCache<CachedBioPayload>(CACHE_KEYS.BIO_CONTEXT, sessionId, {
        insights: raw.insights,
        systemStatus: raw.systemStatus,
        lastUpdated: raw.lastUpdated,
      });
    }
  }, [raw, sessionId]);

  return useMemo<BioContextData>(() => {
    // Fresh data from Convex — use it
    if (raw) {
      const hasCritical = raw.insights.some((i: any) => i.priority === 'critical');
      const hasHigh = raw.insights.some((i: any) => i.priority === 'high');
      const topInsight = raw.insights[0] || null;
      const { label, color } = deriveIntegrity(raw.systemStatus.overallIntegrity);

      return {
        insights: raw.insights,
        systemStatus: raw.systemStatus,
        lastUpdated: raw.lastUpdated,
        isLoading: false,
        isSyncing: false,
        isFromCache: false,
        hasCritical,
        hasHigh,
        topInsight,
        integrityLabel: label,
        integrityColor: color,
      };
    }

    // No fresh data yet — try cached data for instant hydration
    if (cachedData) {
      const hasCritical = cachedData.insights.some(i => i.priority === 'critical');
      const hasHigh = cachedData.insights.some(i => i.priority === 'high');
      const topInsight = cachedData.insights[0] || null;
      const { label, color } = deriveIntegrity(cachedData.systemStatus.overallIntegrity);

      return {
        insights: cachedData.insights,
        systemStatus: cachedData.systemStatus,
        lastUpdated: cachedData.lastUpdated,
        isLoading: false,
        isSyncing: true, // Cloud sync in progress
        isFromCache: true,
        hasCritical,
        hasHigh,
        topInsight,
        integrityLabel: label,
        integrityColor: color,
      };
    }

    // No cache, no fresh data — true loading state
    return {
      insights: [],
      systemStatus: DEFAULT_STATUS,
      lastUpdated: Date.now(),
      isLoading: true,
      isSyncing: true,
      isFromCache: false,
      hasCritical: false,
      hasHigh: false,
      topInsight: null,
      integrityLabel: 'Nominal',
      integrityColor: '#00DC82',
    };
  }, [raw, cachedData]);
}
