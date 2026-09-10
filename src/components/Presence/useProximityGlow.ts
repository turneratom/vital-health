import { useState, useEffect, useRef, useCallback } from 'react';
import { usePresencePosition } from './usePresenceState';

interface ProximityGlowResult {
  glowIntensity: number;
  glowX: number;
  glowY: number;
  isNear: boolean;
  /** Combined intensity from local cursor + any nearby remote users */
  combinedIntensity: number;
  /** Color of the nearest remote user (if contributing glow), or null */
  nearestRemoteColor: string | null;
}

// ── Global remote positions registry ──
// Updated by useConvexPresence so proximity glow can react to ALL cursors
interface RemotePos {
  x: number;
  y: number;
  color: string;
}

let _remotePositions: RemotePos[] = [];
const _remoteListeners = new Set<() => void>();

export function setRemotePositions(positions: RemotePos[]) {
  _remotePositions = positions;
  _remoteListeners.forEach((fn) => fn());
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Collaboration Zone Detection                            ── */
/* ══════════════════════════════════════════════════════════════ */

/** A detected collaboration zone between two or more nearby peers */
export interface CollaborationZone {
  /** Center X of the zone (midpoint between closest pair) */
  cx: number;
  /** Center Y of the zone */
  cy: number;
  /** Glow intensity 0–1 (based on proximity — closer = stronger) */
  intensity: number;
  /** Radius of the zone glow */
  radius: number;
  /** Blended color from the two peers */
  colorA: string;
  colorB: string;
  /** Unique key for stable identity across frames */
  key: string;
}

/** Collaboration zone radius — peers within this distance trigger the zone */
const COLLAB_ZONE_RADIUS = 180;
/** Minimum distance to avoid division-by-zero / extreme intensity */
const COLLAB_MIN_DIST = 20;

let _collaborationZones: CollaborationZone[] = [];
const _collabListeners = new Set<() => void>();

/** Smoothed zone intensities for buttery transitions */
const _smoothedZones = new Map<string, { intensity: number; cx: number; cy: number }>();
const ZONE_LERP_SPEED = 0.08; // Smooth ramp-up/down

export function getCollaborationZones(): CollaborationZone[] {
  return _collaborationZones;
}

export function subscribeCollaborationZones(fn: () => void) {
  _collabListeners.add(fn);
  return () => { _collabListeners.delete(fn); };
}

/**
 * Recalculate collaboration zones from current remote positions.
 * Called at ~30fps from the FluidCanvas render loop for zero-latency response.
 * Uses O(n²) pairwise check — fine for <20 peers.
 */
export function recalcCollaborationZones(
  remotes: Array<{ sessionId: string; x: number; y: number; color: string; ghostMode?: boolean }>
) {
  const newZones: CollaborationZone[] = [];
  const activeKeys = new Set<string>();

  for (let i = 0; i < remotes.length; i++) {
    const a = remotes[i];
    if (a.ghostMode) continue; // Ghost mode peers don't form collab zones

    for (let j = i + 1; j < remotes.length; j++) {
      const b = remotes[j];
      if (b.ghostMode) continue;

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < COLLAB_ZONE_RADIUS) {
        const key = a.sessionId < b.sessionId
          ? `${a.sessionId}:${b.sessionId}`
          : `${b.sessionId}:${a.sessionId}`;

        activeKeys.add(key);

        // Raw intensity: 1 at COLLAB_MIN_DIST, 0 at COLLAB_ZONE_RADIUS
        const clampedDist = Math.max(COLLAB_MIN_DIST, dist);
        const rawIntensity = 1 - (clampedDist - COLLAB_MIN_DIST) / (COLLAB_ZONE_RADIUS - COLLAB_MIN_DIST);
        // Ease-in-out curve for natural feel
        const easedIntensity = rawIntensity * rawIntensity * (3 - 2 * rawIntensity);

        // Smooth the intensity over time
        const prev = _smoothedZones.get(key);
        let smoothedIntensity: number;
        let smoothedCx: number;
        let smoothedCy: number;
        const targetCx = (a.x + b.x) / 2;
        const targetCy = (a.y + b.y) / 2;

        if (prev) {
          smoothedIntensity = prev.intensity + (easedIntensity - prev.intensity) * ZONE_LERP_SPEED;
          smoothedCx = prev.cx + (targetCx - prev.cx) * ZONE_LERP_SPEED;
          smoothedCy = prev.cy + (targetCy - prev.cy) * ZONE_LERP_SPEED;
        } else {
          // First frame — start from 0 for smooth fade-in
          smoothedIntensity = easedIntensity * 0.05;
          smoothedCx = targetCx;
          smoothedCy = targetCy;
        }

        _smoothedZones.set(key, { intensity: smoothedIntensity, cx: smoothedCx, cy: smoothedCy });

        // Zone radius scales with distance — closer peers = tighter, brighter zone
        const zoneRadius = 40 + dist * 0.5;

        newZones.push({
          cx: smoothedCx,
          cy: smoothedCy,
          intensity: smoothedIntensity,
          radius: zoneRadius,
          colorA: a.color,
          colorB: b.color,
          key,
        });
      }
    }
  }

  // Fade out zones that are no longer active
  for (const [key, prev] of _smoothedZones.entries()) {
    if (!activeKeys.has(key)) {
      const fadedIntensity = prev.intensity * (1 - ZONE_LERP_SPEED * 2); // Fade out faster
      if (fadedIntensity < 0.005) {
        _smoothedZones.delete(key);
      } else {
        _smoothedZones.set(key, { ...prev, intensity: fadedIntensity });
        // Add fading zone to render list
        newZones.push({
          cx: prev.cx,
          cy: prev.cy,
          intensity: fadedIntensity,
          radius: 80,
          colorA: '#888888',
          colorB: '#888888',
          key,
        });
      }
    }
  }

  _collaborationZones = newZones;
  if (newZones.length > 0 || _collabListeners.size > 0) {
    _collabListeners.forEach((fn) => fn());
  }
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Original Proximity Glow Hook                            ── */
/* ══════════════════════════════════════════════════════════════ */

export function useProximityGlow(
  ref: React.RefObject<HTMLElement | null>,
  options: { radius?: number; falloff?: number } = {}
): ProximityGlowResult {
  const { radius = 200, falloff = 2 } = options;
  const { currentX, currentY, isActive } = usePresencePosition();
  const [result, setResult] = useState<ProximityGlowResult>({
    glowIntensity: 0,
    glowX: 0.5,
    glowY: 0.5,
    isNear: false,
    combinedIntensity: 0,
    nearestRemoteColor: null,
  });

  const rectCacheRef = useRef<DOMRect | null>(null);
  const lastUpdateRef = useRef(0);
  const remoteRef = useRef(_remotePositions);

  // Subscribe to remote position updates
  useEffect(() => {
    const update = () => {
      remoteRef.current = _remotePositions;
    };
    _remoteListeners.add(update);
    return () => { _remoteListeners.delete(update); };
  }, []);

  const refreshRect = useCallback(() => {
    if (ref.current) {
      rectCacheRef.current = ref.current.getBoundingClientRect();
    }
  }, [ref]);

  useEffect(() => {
    refreshRect();
    const interval = setInterval(refreshRect, 500);
    window.addEventListener('resize', refreshRect);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', refreshRect);
    };
  }, [refreshRect]);

  useEffect(() => {
    let animId: number;

    const computeIntensity = (px: number, py: number, rect: DOMRect): { intensity: number; relX: number; relY: number } => {
      const closestX = Math.max(rect.left, Math.min(px, rect.right));
      const closestY = Math.max(rect.top, Math.min(py, rect.bottom));
      const dx = px - closestX;
      const dy = py - closestY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const rawIntensity = Math.max(0, 1 - Math.pow(distance / radius, 1 / falloff));
      const intensity = Math.round(rawIntensity * 100) / 100;
      const relX = Math.max(0, Math.min(1, (px - rect.left) / rect.width));
      const relY = Math.max(0, Math.min(1, (py - rect.top) / rect.height));
      return { intensity, relX, relY };
    };

    const tick = () => {
      const now = performance.now();
      if (now - lastUpdateRef.current < 33) {
        animId = requestAnimationFrame(tick);
        return;
      }
      lastUpdateRef.current = now;

      const rect = rectCacheRef.current;
      if (!rect) {
        setResult((prev) =>
          prev.glowIntensity === 0 && prev.combinedIntensity === 0
            ? prev
            : { glowIntensity: 0, glowX: 0.5, glowY: 0.5, isNear: false, combinedIntensity: 0, nearestRemoteColor: null }
        );
        animId = requestAnimationFrame(tick);
        return;
      }

      // Local cursor contribution
      let localIntensity = 0;
      let localRelX = 0.5;
      let localRelY = 0.5;

      if (isActive) {
        const local = computeIntensity(currentX, currentY, rect);
        localIntensity = local.intensity;
        localRelX = local.relX;
        localRelY = local.relY;
      }

      // Remote cursor contributions — find the strongest one
      let bestRemoteIntensity = 0;
      let bestRemoteColor: string | null = null;
      let bestRemoteRelX = 0.5;
      let bestRemoteRelY = 0.5;

      const remotes = remoteRef.current;
      for (let i = 0; i < remotes.length; i++) {
        const remote = remotes[i];
        const r = computeIntensity(remote.x, remote.y, rect);
        if (r.intensity > bestRemoteIntensity) {
          bestRemoteIntensity = r.intensity;
          bestRemoteColor = remote.color;
          bestRemoteRelX = r.relX;
          bestRemoteRelY = r.relY;
        }
      }

      // Remote glow is softer (40% strength) to not overpower local
      const remoteContribution = bestRemoteIntensity * 0.4;

      // Combined: max of local and remote contribution
      const combinedIntensity = Math.min(1, Math.max(localIntensity, remoteContribution));

      // Use local cursor position for glow origin if local is stronger, else remote
      const useLocal = localIntensity >= remoteContribution;
      const finalRelX = useLocal ? localRelX : bestRemoteRelX;
      const finalRelY = useLocal ? localRelY : bestRemoteRelY;

      const isNear = combinedIntensity > 0.05;

      setResult((prev) => {
        if (
          Math.abs(prev.glowIntensity - localIntensity) < 0.02 &&
          Math.abs(prev.combinedIntensity - combinedIntensity) < 0.02 &&
          Math.abs(prev.glowX - finalRelX) < 0.02 &&
          Math.abs(prev.glowY - finalRelY) < 0.02 &&
          prev.nearestRemoteColor === bestRemoteColor
        ) {
          return prev;
        }
        return {
          glowIntensity: localIntensity,
          glowX: finalRelX,
          glowY: finalRelY,
          isNear,
          combinedIntensity,
          nearestRemoteColor: bestRemoteColor,
        };
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [radius, falloff, currentX, currentY, isActive]);

  return result;
}
