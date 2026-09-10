import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getSessionId, setPresenceBroadcast } from '@/components/Presence/usePresenceState';
import { setRemotePositions } from '@/components/Presence/useProximityGlow';

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
  activeProtocol?: string;
  activeCategory?: string;
  heartRate?: number;
  hrv?: number;
  isDeepWork?: boolean;
}

// ── Global focus mode + active protocol state ──
let _focusMode: string | null = null;
let _activeProtocol: string | null = null;
let _activeCategory: string | null = null;
let _auraState: string | null = null;

export function setLocalFocusMode(mode: string | null) { _focusMode = mode; }
export function setLocalActiveProtocol(protocol: string | null, category?: string | null) {
  _activeProtocol = protocol;
  _activeCategory = category ?? null;
}
export function setLocalAuraState(state: string | null) { _auraState = state; }
export function getLocalFocusMode() { return _focusMode; }
export function getLocalActiveProtocol() { return _activeProtocol; }
export function getLocalAuraState() { return _auraState; }

/**
 * Main bridge between Convex subscription and local UI state.
 * - Broadcasts local cursor position + focus mode + active protocol at ~10fps
 * - Subscribes to all active presence entries via useQuery
 * - Filters out self, returns remote users for canvas rendering
 * - Pushes remote positions to the proximity glow system
 * - Exposes connection state for SystemStatus indicator
 */
export function useConvexPresence() {
  const sessionId = getSessionId();
  const color = colorForSession(sessionId);
  const upsert = useMutation(api.mutations.upsertPresence);
  const allPresence = useQuery(api.queries.listPresence);
  const health = useQuery(api.queries.connectionHealth);

  const upsertRef = useRef(upsert);
  upsertRef.current = upsert;

  // Broadcast callback — called by usePresenceState at ~10fps (every 100ms)
  const broadcast = useCallback((x: number, y: number, ghostMode: boolean) => {
    upsertRef.current({
      sessionId,
      x: Math.round(x),
      y: Math.round(y),
      ghostMode,
      color,
      lastSeen: Date.now(),
      activeProtocol: _activeProtocol ?? undefined,
      activeCategory: _activeCategory ?? undefined,
      auraState: _auraState ?? undefined,
    }).catch(() => {});
  }, [sessionId, color]);

  useEffect(() => {
    setPresenceBroadcast(broadcast);
    return () => setPresenceBroadcast(null);
  }, [broadcast]);

  // Periodic cleanup of stale entries (every 15s)
  const cleanup = useMutation(api.mutations.cleanupStale);
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    const interval = setInterval(() => {
      cleanupRef.current({}).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter out self, map to RemotePresence interface
  const remoteUsers: RemotePresence[] = (allPresence ?? [])
    .filter((p) => p.sessionId !== sessionId)
    .map((p) => ({
      sessionId: p.sessionId,
      x: p.x,
      y: p.y,
      ghostMode: p.ghostMode,
      color: p.color,
      activeProtocol: p.activeProtocol ?? undefined,
      activeCategory: p.activeCategory ?? undefined,
      heartRate: p.heartRate ?? undefined,
      hrv: p.hrv ?? undefined,
      isDeepWork: p.isDeepWork ?? undefined,
    }));

  // All users including self for the Live Network view
  const allUsers: RemotePresence[] = (allPresence ?? []).map((p) => ({
    sessionId: p.sessionId,
    x: p.x,
    y: p.y,
    ghostMode: p.ghostMode,
    color: p.color,
    activeProtocol: p.activeProtocol ?? undefined,
    activeCategory: p.activeCategory ?? undefined,
    heartRate: p.heartRate ?? undefined,
    hrv: p.hrv ?? undefined,
    isDeepWork: p.isDeepWork ?? undefined,
  }));

  useEffect(() => {
    setRemotePositions(
      remoteUsers.map((u) => ({ x: u.x, y: u.y, color: u.color }))
    );
  }, [remoteUsers]);

  const isConnected = allPresence !== undefined;
  const activeUserCount = health?.activeUsers ?? 0;

  return {
    remoteUsers,
    allUsers,
    sessionId,
    isConnected,
    activeUserCount,
    connectionStatus: isConnected ? ('connected' as const) : ('syncing' as const),
  };
}
