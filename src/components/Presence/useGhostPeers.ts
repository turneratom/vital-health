import { useEffect, useRef, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getSessionId } from './usePresenceState';

/* ═══════════════════════════════════════════════════════════════
   GHOST PEERS — Data-driven "rabbits" on the FluidCanvas
   
   When a user is performing a protocol (breathwork, workout, etc.),
   ghost peers appear as transparent avatars representing:
   1. Personal Best — the user's own top adherence pace
   2. Squad Leader — the #1 ranked peer's average pace
   3. Squad Average — the median squad performance
   
   These move in deterministic patterns based on their adherence
   scores, giving the user a visual "rabbit" to chase.
   ═══════════════════════════════════════════════════════════════ */

export interface GhostPeer {
  id: string;
  label: string;
  /** 0–100 adherence score driving movement speed */
  adherence: number;
  /** Tier determines ghost color palette */
  tier: 'apex' | 'titan' | 'vanguard';
  /** Current interpolated position */
  x: number;
  y: number;
  /** Ghost color (semi-transparent) */
  color: string;
  /** Icon emoji for the ghost label */
  icon: string;
  /** Whether this is the user's personal best */
  isPersonalBest: boolean;
  /** Streak days — affects orbit speed */
  streak: number;
}

/* ── Ghost color palette by tier ── */
const GHOST_COLORS: Record<string, string> = {
  apex: '#00FFCC',    // Neon teal — top tier
  titan: '#AF82FF',   // Purple — mid tier
  vanguard: '#FFB86B', // Amber — baseline
  personal: '#00BFFF', // Cyan — personal best
};

/* ── Deterministic orbit path generator ── */
function ghostOrbitPosition(
  ghostId: string,
  adherence: number,
  timestamp: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  // Hash the ghost ID for a unique phase offset
  let hash = 0;
  for (let i = 0; i < ghostId.length; i++) {
    hash = ((hash << 5) - hash + ghostId.charCodeAt(i)) | 0;
  }
  const phase = (Math.abs(hash) % 1000) / 1000 * Math.PI * 2;

  // Speed scales with adherence: higher adherence = faster orbit
  const speed = 0.0002 + (adherence / 100) * 0.0006;
  const t = timestamp * speed + phase;

  // Lissajous figure — creates interesting non-repeating paths
  const freqX = 1 + (Math.abs(hash) % 3) * 0.5;
  const freqY = 1.5 + (Math.abs(hash >> 8) % 3) * 0.5;

  // Orbit radius scales with viewport, centered with padding
  const padX = viewW * 0.15;
  const padY = viewH * 0.15;
  const radiusX = (viewW - padX * 2) * 0.35;
  const radiusY = (viewH - padY * 2) * 0.3;
  const centerX = viewW * 0.5;
  const centerY = viewH * 0.5;

  // Slight drift to prevent exact repetition
  const drift = Math.sin(t * 0.1) * 30;

  const x = centerX + Math.sin(t * freqX) * radiusX + drift;
  const y = centerY + Math.cos(t * freqY) * radiusY + Math.cos(t * 0.3) * 20;

  return { x: Math.max(40, Math.min(viewW - 40, x)), y: Math.max(40, Math.min(viewH - 40, y)) };
}

/* ── Main hook ── */
export function useGhostPeers(isInProtocol: boolean): GhostPeer[] {
  const sessionId = getSessionId();
  const leaderboard = useQuery(api.leaderboard.getPeerLeaderboard);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Build ghost peers from leaderboard data
  const ghosts = useMemo<GhostPeer[]>(() => {
    if (!isInProtocol || !leaderboard || leaderboard.length === 0) return [];

    const result: GhostPeer[] = [];

    // Find the current user's entry
    const selfEntry = leaderboard.find(e => e.anonId === sessionId);
    const selfAdherence = selfEntry?.avgAdherence ?? 70;

    // 1. Personal Best ghost — always shows your own top pace + 10%
    const personalBestAdherence = Math.min(100, selfAdherence + 12);
    result.push({
      id: '__ghost_personal_best',
      label: 'Your Best',
      adherence: personalBestAdherence,
      tier: personalBestAdherence >= 90 ? 'apex' : personalBestAdherence >= 70 ? 'titan' : 'vanguard',
      x: 0,
      y: 0,
      color: GHOST_COLORS.personal,
      icon: '⚡',
      isPersonalBest: true,
      streak: (selfEntry?.streak ?? 0) + 3,
    });

    // 2. Squad Leader ghost — the #1 ranked peer (skip benchmarks and self)
    const leader = leaderboard.find(e => 
      e.anonId !== sessionId && 
      !e.isBenchmark && 
      e.rank === 1
    );
    if (leader) {
      result.push({
        id: `__ghost_leader_${leader.anonId}`,
        label: leader.anonLabel,
        adherence: leader.avgAdherence,
        tier: leader.tier as GhostPeer['tier'],
        x: 0,
        y: 0,
        color: GHOST_COLORS[leader.tier] ?? GHOST_COLORS.apex,
        icon: '👑',
        isPersonalBest: false,
        streak: leader.streak,
      });
    } else {
      // Use Top 10% benchmark as leader when no real peers
      const benchmark = leaderboard.find(e => e.isBenchmark && e.anonLabel === 'Top 10% Avg');
      if (benchmark) {
        result.push({
          id: '__ghost_benchmark_top10',
          label: 'Top 10% Avg',
          adherence: benchmark.avgAdherence,
          tier: 'apex',
          x: 0,
          y: 0,
          color: GHOST_COLORS.apex,
          icon: '🏆',
          isPersonalBest: false,
          streak: benchmark.streak,
        });
      }
    }

    // 3. Squad Average ghost — the median performer
    const median = leaderboard.find(e => 
      e.isBenchmark && e.anonLabel === 'Global Median'
    ) ?? leaderboard[Math.floor(leaderboard.length / 2)];
    if (median && median.anonId !== sessionId) {
      result.push({
        id: `__ghost_median_${median.anonId}`,
        label: median.isBenchmark ? 'Squad Avg' : median.anonLabel,
        adherence: median.avgAdherence,
        tier: median.tier as GhostPeer['tier'],
        x: 0,
        y: 0,
        color: GHOST_COLORS[median.tier] ?? GHOST_COLORS.titan,
        icon: '📊',
        isPersonalBest: false,
        streak: median.streak,
      });
    }

    return result;
  }, [isInProtocol, leaderboard, sessionId]);

  // Update positions on each call (driven by rAF in FluidCanvas)
  useEffect(() => {
    if (!isInProtocol) {
      positionsRef.current.clear();
    }
  }, [isInProtocol]);

  return ghosts;
}

/* ── Exported position calculator for the render loop ── */
export function getGhostPosition(
  ghostId: string,
  adherence: number,
  timestamp: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  return ghostOrbitPosition(ghostId, adherence, timestamp, viewW, viewH);
}

/* ── Ghost trail generator — creates a short historical trail ── */
export function getGhostTrail(
  ghostId: string,
  adherence: number,
  timestamp: number,
  viewW: number,
  viewH: number,
  trailLength: number = 12,
): Array<{ x: number; y: number; alpha: number }> {
  const trail: Array<{ x: number; y: number; alpha: number }> = [];
  const stepMs = 80; // 80ms between trail points
  for (let i = trailLength - 1; i >= 0; i--) {
    const t = timestamp - i * stepMs;
    const pos = ghostOrbitPosition(ghostId, adherence, t, viewW, viewH);
    trail.push({ ...pos, alpha: 1 - (i / trailLength) * 0.8 });
  }
  return trail;
}
