import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getSessionId, setPresenceBroadcast } from './usePresenceState';

const REMOTE_COLORS = [
  '#FF6BCC', '#6B8AFF', '#FFB86B', '#FF6B6B',
  '#B86BFF', '#6BFFA3', '#FFE66B', '#6BD4FF',
];

function colorForSession(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return REMOTE_COLORS[Math.abs(hash) % REMOTE_COLORS.length];
}

export interface RemotePresence {
  sessionId: string;
  x: number;
  y: number;
  ghostMode: boolean;
  color: string;
  /** Optional heart rate for aura rendering */
  heartRate?: number;
  /** Real-time HRV value (ms) — drives peer icon pulsation rate */
  hrv?: number;
  /** Whether the peer is in Deep Work mode */
  isDeepWork?: boolean;
  /** HRV performance zone: 'flow' | 'optimal' | 'normal' | 'stressed' */
  hrvZone?: 'flow' | 'optimal' | 'normal' | 'stressed';
}

/* ── HRV Zone classification ── */
function classifyHrvZone(hrv: number | undefined, isDeepWork: boolean): RemotePresence['hrvZone'] {
  if (!hrv || hrv <= 0) return 'normal';
  // Flow state = Deep Work + high HRV (above 75ms threshold)
  if (isDeepWork && hrv >= 75) return 'flow';
  if (hrv >= 70) return 'optimal';
  if (hrv >= 45) return 'normal';
  return 'stressed';
}

/* ── Simulated HRV for demo peers (deterministic per session, varies over time) ── */
function simulateHrv(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  const base = 55 + (Math.abs(hash) % 40); // 55–95 range
  const drift = Math.sin(Date.now() / 15000 + hash) * 8; // slow oscillation
  return Math.round(base + drift);
}

export function useConvexPresence() {
  const sessionId = getSessionId();
  const color = colorForSession(sessionId);
  const upsert = useMutation(api.mutations.upsertPresence);
  const allPresence = useQuery(api.queries.listPresence);

  const upsertRef = useRef(upsert);
  upsertRef.current = upsert;

  // Set up the broadcast callback so usePresenceState can push to Convex
  const broadcast = useCallback((x: number, y: number, ghostMode: boolean) => {
    upsertRef.current({
      sessionId,
      x: Math.round(x),
      y: Math.round(y),
      ghostMode,
      color,
      lastSeen: Date.now(),
    }).catch(() => {});
  }, [sessionId, color]);

  useEffect(() => {
    setPresenceBroadcast(broadcast);
    return () => setPresenceBroadcast(null);
  }, [broadcast]);

  // Filter out self, map to RemotePresence with HRV data
  const remoteUsers: RemotePresence[] = (allPresence ?? [])
    .filter((p) => p.sessionId !== sessionId)
    .map((p) => {
      const hrv = simulateHrv(p.sessionId);
      const isDeepWork = p.ghostMode;
      const hrvZone = classifyHrvZone(hrv, isDeepWork);
      return {
        sessionId: p.sessionId,
        x: p.x,
        y: p.y,
        ghostMode: p.ghostMode,
        color: p.color,
        heartRate: (p as { heartRate?: number }).heartRate,
        hrv,
        isDeepWork,
        hrvZone,
      };
    });

  return { remoteUsers, sessionId, isConnected: allPresence !== undefined };
}
