import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { useConvexPresence } from '@/hooks/useConvexPresence';
import type { RemotePresence } from '@/hooks/useConvexPresence';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface SystemStatusProps {
  isReturning?: boolean;
}

/* ── Category → color mapping ── */
const CATEGORY_COLORS: Record<string, string> = {
  breathing: '#00FFCC',
  thermal: '#FF6B6B',
  meditation: '#B86BFF',
  movement: '#6BFFA3',
  supplements: '#FFB86B',
  recovery: '#6BD4FF',
  fueling: '#FFE66B',
  default: '#6B8AFF',
};

function getCategoryColor(category?: string): string {
  if (!category) return CATEGORY_COLORS.default;
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_COLORS.default;
}

/* ── Convert color to rgba ── */
function hexToRgba(color: string, alpha: number): string {
  if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${alpha})`);
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(107,138,255,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Hash helpers ── */
function hashSlot(sessionId: string): number {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) {
    h = ((h << 5) - h + sessionId.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 1000;
}

/* ═══════════════════════════════════════════════════════════════
   Network Node Ring — each live peer is a glowing green dot
   that subtly orbits the center of the system status ring.
   Achievement Ripples expand when a peer completes a protocol.
   ═══════════════════════════════════════════════════════════════ */

interface OrbitNode {
  id: string;
  angle: number;       // current orbital angle
  speed: number;       // radians per frame
  orbitRadius: number;  // distance from center
  color: string;
  size: number;
  protocol?: string;
  category?: string;
  ghostMode: boolean;
  phase: number;       // breathing phase offset
}

interface AchievementRipple {
  id: string;
  x: number;
  y: number;
  color: string;
  startFrame: number;
  duration: number; // frames
  label: string;
}

function NetworkNodeRing({
  users,
  ghostMode: globalGhost,
  achievementRipples,
}: {
  users: RemotePresence[];
  ghostMode: boolean;
  achievementRipples: AchievementRipple[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<OrbitNode[]>([]);
  const ripplesRef = useRef<AchievementRipple[]>([]);
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  // Update ripples ref
  useEffect(() => {
    ripplesRef.current = achievementRipples;
  }, [achievementRipples]);

  // Rebuild nodes when users change
  useEffect(() => {
    const existing = new Map(nodesRef.current.map(n => [n.id, n]));
    const newNodes: OrbitNode[] = users.map((u, i) => {
      const prev = existing.get(u.sessionId);
      const baseAngle = (i / Math.max(users.length, 1)) * Math.PI * 2;
      const slot = hashSlot(u.sessionId);
      return {
        id: u.sessionId,
        angle: prev?.angle ?? baseAngle,
        speed: 0.002 + slot * 0.004, // 0.002–0.006 rad/frame
        orbitRadius: 60 + slot * 40,  // 60–100px from center
        color: u.ghostMode ? 'rgba(160,160,160,0.5)' : getCategoryColor(u.activeCategory),
        size: u.activeProtocol ? 5 : 3,
        protocol: u.activeProtocol,
        category: u.activeCategory,
        ghostMode: u.ghostMode,
        phase: slot * Math.PI * 2,
      };
    });
    nodesRef.current = newNodes;
  }, [users]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      frameRef.current++;
      const frame = frameRef.current;
      ctx.clearRect(0, 0, SIZE, SIZE);

      const nodes = nodesRef.current;
      const t = frame * 0.02;
      const neonBase = globalGhost ? 'rgba(160,160,160,' : 'rgba(0,255,204,';

      // ── Draw orbital track rings (subtle) ──
      const trackRadii = [70, 90, 110];
      for (const tr of trackRadii) {
        ctx.beginPath();
        ctx.arc(CX, CY, tr, 0, Math.PI * 2);
        ctx.strokeStyle = `${neonBase}0.04)`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── Draw center system core ──
      const coreGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, 20);
      coreGrad.addColorStop(0, `${neonBase}0.15)`);
      coreGrad.addColorStop(0.5, `${neonBase}0.05)`);
      coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, 20, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(CX, CY, 3, 0, Math.PI * 2);
      ctx.fillStyle = `${neonBase}0.6)`;
      ctx.fill();

      // Core pulse ring
      const corePulse = 0.5 + Math.sin(t * 0.5) * 0.5;
      ctx.beginPath();
      ctx.arc(CX, CY, 8 + corePulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = `${neonBase}${0.08 + corePulse * 0.06})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (nodes.length === 0) {
        ctx.fillStyle = `${neonBase}0.25)`;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting network peers...', CX, CY + 40);
        return;
      }

      // ── Update orbital positions & draw connection lines ──
      for (const n of nodes) {
        n.angle += n.speed;
      }

      // Draw connection lines to center
      for (const n of nodes) {
        const nx = CX + Math.cos(n.angle) * n.orbitRadius;
        const ny = CY + Math.sin(n.angle) * n.orbitRadius;
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = hexToRgba(n.color, 0.06);
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw inter-node connections (nearby nodes)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const ax = CX + Math.cos(a.angle) * a.orbitRadius;
          const ay = CY + Math.sin(a.angle) * a.orbitRadius;
          const bx = CX + Math.cos(b.angle) * b.orbitRadius;
          const by = CY + Math.sin(b.angle) * b.orbitRadius;
          const dx = ax - bx;
          const dy = ay - by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 60) {
            const alpha = (1 - dist / 60) * 0.12;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = hexToRgba(a.color, alpha);
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // ── Draw orbiting peer nodes ──
      for (const n of nodes) {
        const nx = CX + Math.cos(n.angle) * n.orbitRadius;
        const ny = CY + Math.sin(n.angle) * n.orbitRadius;
        const breath = 0.6 + Math.sin(t + n.phase) * 0.4;
        const r = n.size * breath;

        // Outer atmospheric glow
        if (n.protocol) {
          const glowGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 6);
          glowGrad.addColorStop(0, hexToRgba(n.color, 0.15));
          glowGrad.addColorStop(0.5, hexToRgba(n.color, 0.04));
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(nx, ny, r * 6, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        // Glow ring
        const ringGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 3);
        ringGrad.addColorStop(0, hexToRgba(n.color, 0.3 * breath));
        ringGrad.addColorStop(0.6, hexToRgba(n.color, 0.08));
        ringGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(nx, ny, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = ringGrad;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        // Hot center
        ctx.beginPath();
        ctx.arc(nx, ny, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.5 * breath})`;
        ctx.fill();

        // Orbital trail (fading arc behind the node)
        const trailLen = 0.3;
        ctx.beginPath();
        ctx.arc(CX, CY, n.orbitRadius, n.angle - trailLen, n.angle);
        ctx.strokeStyle = hexToRgba(n.color, 0.08);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ── Draw Achievement Ripples ──
      const ripples = ripplesRef.current;
      for (const ripple of ripples) {
        const age = frame - ripple.startFrame;
        if (age < 0 || age > ripple.duration) continue;
        const progress = age / ripple.duration;
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const maxR = 80;
        const rippleR = eased * maxR;
        const alpha = (1 - progress) * 0.4;

        // Multiple expanding rings
        for (let ring = 0; ring < 3; ring++) {
          const ringDelay = ring * 0.12;
          const ringProgress = Math.max(0, progress - ringDelay);
          if (ringProgress <= 0) continue;
          const ringEased = 1 - Math.pow(1 - Math.min(ringProgress / (1 - ringDelay), 1), 3);
          const rr = ringEased * maxR;
          const ra = (1 - ringProgress / (1 - ringDelay)) * 0.25;

          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, rr, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRgba(ripple.color, ra);
          ctx.lineWidth = 1.5 - ring * 0.4;
          ctx.stroke();
        }

        // Central flash
        if (progress < 0.3) {
          const flashAlpha = (1 - progress / 0.3) * 0.5;
          const flashGrad = ctx.createRadialGradient(ripple.x, ripple.y, 0, ripple.x, ripple.y, 12);
          flashGrad.addColorStop(0, hexToRgba(ripple.color, flashAlpha));
          flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, 12, 0, Math.PI * 2);
          ctx.fillStyle = flashGrad;
          ctx.fill();
        }

        // Label
        if (progress < 0.6 && ripple.label) {
          const labelAlpha = progress < 0.1 ? progress / 0.1 : (0.6 - progress) / 0.5;
          ctx.font = '8px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = hexToRgba(ripple.color, labelAlpha * 0.7);
          ctx.fillText(ripple.label, ripple.x, ripple.y - rippleR - 6);
        }
      }

      // ── Draw peer count label ──
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `${neonBase}0.35)`;
      ctx.fillText(`${nodes.length} NODE${nodes.length !== 1 ? 'S' : ''} ACTIVE`, CX, SIZE - 12);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [globalGhost, SIZE]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: SIZE, height: SIZE }}
      className="rounded-xl"
    />
  );
}

/* ── Protocol badge ── */
function ProtocolBadge({ protocol, category, ghostMode }: { protocol?: string; category?: string; ghostMode: boolean }) {
  if (!protocol) return null;
  const color = ghostMode ? 'rgba(160,160,160,0.5)' : getCategoryColor(category);
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider"
      style={{
        background: `${color}15`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: color }} />
      {protocol}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Bio-Pulse Orb strip — bottom-of-screen peer breathing orbs
   ═══════════════════════════════════════════════════════════════ */
function BioPulseCanvas({ users, ghostMode: globalGhost }: { users: RemotePresence[]; ghostMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<{ sessionId: string; color: string; freshness: number; ghostMode: boolean; slot: number; phase: number; protocol?: string }[]>([]);
  const rafRef = useRef(0);
  const W = typeof window !== 'undefined' ? Math.min(window.innerWidth, 600) : 400;
  const H = 48;

  useEffect(() => {
    const now = Date.now();
    const STALE = 30_000;
    orbsRef.current = users.map((u) => {
      const age = now - ((u as any).lastSeen ?? now);
      const freshness = Math.max(0, Math.min(1, 1 - age / STALE));
      return {
        sessionId: u.sessionId,
        color: u.ghostMode ? 'rgba(160,160,160,0.5)' : getCategoryColor(u.activeCategory),
        freshness,
        ghostMode: u.ghostMode,
        slot: hashSlot(u.sessionId),
        phase: hashSlot(u.sessionId + '_phase') * Math.PI * 2,
        protocol: u.activeProtocol,
      };
    });
  }, [users]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    let frame = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      frame++;
      ctx.clearRect(0, 0, W, H);
      const orbs = orbsRef.current;
      if (orbs.length === 0) return;
      const t = frame * 0.025;
      const padding = 24;
      const usableW = W - padding * 2;
      const cy = H * 0.5;
      const sorted = [...orbs].sort((a, b) => a.slot - b.slot);

      // Thread
      if (sorted.length > 1) {
        ctx.beginPath();
        ctx.moveTo(padding + sorted[0].slot * usableW, cy);
        for (let i = 1; i < sorted.length; i++) {
          ctx.lineTo(padding + sorted[i].slot * usableW, cy);
        }
        ctx.strokeStyle = globalGhost ? 'rgba(160,160,160,0.04)' : 'rgba(0,255,204,0.04)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const orb of sorted) {
        const ox = padding + orb.slot * usableW;
        const breathAmp = 0.3 + orb.freshness * 0.7;
        const breathSpeed = 0.8 + orb.freshness * 1.2;
        const breath = Math.sin(t * breathSpeed + orb.phase);
        const scale = 0.5 + breath * 0.5 * breathAmp;
        const baseRadius = 3 + orb.freshness * 4;
        const r = baseRadius * (0.6 + scale * 0.4);
        const alpha = 0.3 + orb.freshness * 0.7;
        const hexColor = orb.ghostMode ? '#a0a0a0' : orb.color;

        // Outer glow
        const glowR = r * 5;
        const outerGrad = ctx.createRadialGradient(ox, cy, 0, ox, cy, glowR);
        outerGrad.addColorStop(0, hexToRgba(hexColor, alpha * 0.15 * scale));
        outerGrad.addColorStop(0.4, hexToRgba(hexColor, alpha * 0.06 * scale));
        outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(ox, cy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = outerGrad;
        ctx.fill();

        // Inner glow
        const innerGrad = ctx.createRadialGradient(ox, cy, 0, ox, cy, r * 2.5);
        innerGrad.addColorStop(0, hexToRgba(hexColor, alpha * 0.4));
        innerGrad.addColorStop(0.5, hexToRgba(hexColor, alpha * 0.12));
        innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(ox, cy, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(ox, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(hexColor, alpha * 0.9);
        ctx.fill();

        // Hot center
        ctx.beginPath();
        ctx.arc(ox, cy, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6 * scale})`;
        ctx.fill();

        // Ripple ring on fresh peers
        if (orb.freshness > 0.8) {
          const ripplePhase = (t * 0.6 + orb.phase) % (Math.PI * 2);
          const rippleProgress = ripplePhase / (Math.PI * 2);
          const rippleR = r * (1.5 + rippleProgress * 3);
          const rippleAlpha = (1 - rippleProgress) * 0.2 * alpha;
          ctx.beginPath();
          ctx.arc(ox, cy, rippleR, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRgba(hexColor, rippleAlpha);
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [W, globalGhost]);

  return <canvas ref={canvasRef} style={{ width: W, height: H }} className="block" />;
}

/* ═══════════════════════════════════════════════════════════════
   Main SystemStatus Component
   ═══════════════════════════════════════════════════════════════ */
export default function SystemStatus({ isReturning }: SystemStatusProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ghostMode = useGhostMode();
  const { allUsers, remoteUsers, isConnected, activeUserCount, connectionStatus, sessionId } = useConvexPresence();
  const [uptime, setUptime] = useState(0);
  const [latency, setLatency] = useState(3);
  const [expanded, setExpanded] = useState(false);
  const [achievementRipples, setAchievementRipples] = useState<AchievementRipple[]>([]);
  const frameCounterRef = useRef(0);
  const prevProtocolsRef = useRef<Map<string, string | undefined>>(new Map());

  // Poll protocol logs for recent completions to trigger achievement ripples
  const recentLogsRaw = useQuery(api.queries.listProtocolLogs);
  const recentLogs = Array.isArray(recentLogsRaw) ? recentLogsRaw : [];

  // Detect new protocol completions from peers → trigger achievement ripple
  useEffect(() => {
    if (!recentLogs || recentLogs.length === 0) return;

    // Look at the most recent 10 logs
    const recent = recentLogs.slice(-10);
    const now = Date.now();
    const WINDOW = 8000; // 8 second window for "new" completions

    for (const log of recent) {
      if (now - log.loggedAt > WINDOW) continue;
      // Don't ripple for own session
      if (log.sessionId === sessionId) continue;

      const key = `${log.sessionId}-${log.loggedAt}`;
      if (prevProtocolsRef.current.has(key)) continue;
      prevProtocolsRef.current.set(key, log.protocolName);

      // Find the peer's orbital position for the ripple origin
      const peerIdx = allUsers.findIndex(u => u.sessionId === log.sessionId);
      const slot = hashSlot(log.sessionId);
      const orbitR = 60 + slot * 40;
      const angle = peerIdx >= 0
        ? (peerIdx / Math.max(allUsers.length, 1)) * Math.PI * 2 + frameCounterRef.current * (0.002 + slot * 0.004)
        : Math.random() * Math.PI * 2;

      const rippleX = 140 + Math.cos(angle) * orbitR;
      const rippleY = 140 + Math.sin(angle) * orbitR;
      const color = getCategoryColor(log.category);

      const ripple: AchievementRipple = {
        id: key,
        x: rippleX,
        y: rippleY,
        color,
        startFrame: frameCounterRef.current,
        duration: 90, // ~1.5s at 60fps
        label: `✓ ${log.protocolName}`,
      };

      setAchievementRipples(prev => [...prev, ripple]);

      // Dispatch HUD event for FluidCanvas
      window.dispatchEvent(new CustomEvent('vive-optimization-pulse', {
        detail: { type: 'achievement-ripple', category: log.category, protocol: log.protocolName },
      }));
    }

    // Cleanup old keys (keep last 50)
    if (prevProtocolsRef.current.size > 50) {
      const entries = Array.from(prevProtocolsRef.current.entries());
      prevProtocolsRef.current = new Map(entries.slice(-30));
    }
  }, [recentLogs, sessionId, allUsers]);

  // Track frame counter for ripple timing
  useEffect(() => {
    const tick = () => {
      frameCounterRef.current++;
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Cleanup expired ripples
  useEffect(() => {
    if (achievementRipples.length === 0) return;
    const interval = setInterval(() => {
      const currentFrame = frameCounterRef.current;
      setAchievementRipples(prev =>
        prev.filter(r => currentFrame - r.startFrame < r.duration + 10)
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [achievementRipples.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const jitter = Math.round((Math.random() - 0.5) * 4);
        return Math.max(1, Math.min(12, prev + jitter));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const neonColor = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';
  const dotColor = ghostMode ? 'rgba(160,160,160,0.5)' : '#00FFCC';
  const dotShadow = ghostMode ? 'none' : '0 0 6px rgba(0,255,204,0.6)';
  const statusLabel = isReturning ? 'Systems Operational' : 'Systems Ready';

  const activeProtocols = useMemo(() => {
    const protocols: { sessionId: string; protocol: string; category?: string; ghostMode: boolean }[] = [];
    for (const u of allUsers) {
      if (u.activeProtocol) {
        protocols.push({
          sessionId: u.sessionId,
          protocol: u.activeProtocol,
          category: u.activeCategory,
          ghostMode: u.ghostMode,
        });
      }
    }
    return protocols;
  }, [allUsers]);

  const toggleExpanded = useCallback(() => setExpanded(v => !v), []);
  const showBioPulses = remoteUsers.length > 0;

  return (
    <div ref={ref} className="flex flex-col gap-0">
      {/* ── Compact status bar ── */}
      <button
        onClick={toggleExpanded}
        className="flex items-center gap-3 px-4 py-2 rounded-full border cursor-pointer"
        style={{
          background: 'rgba(10, 10, 10, 0.5)',
          borderColor: ghostMode
            ? 'rgba(160,160,160,0.06)'
            : isReturning
              ? 'rgba(0,255,204,0.12)'
              : 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transition: 'border-color 0.3s ease, background 0.3s ease',
          boxShadow: isReturning && !ghostMode ? '0 0 12px rgba(0,255,204,0.06)' : 'none',
        }}
      >
        {/* Pulse dot */}
        <div className="relative flex items-center justify-center w-3 h-3">
          <div
            className="absolute w-3 h-3 rounded-full animate-ping"
            style={{ background: dotColor, opacity: 0.3 }}
          />
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: dotColor,
              boxShadow: dotShadow,
              transition: 'background 0.5s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>

        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{
            color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(0,255,204,0.7)',
            transition: 'color 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {statusLabel}
        </span>

        <div className="w-px h-3" style={{ background: `${neonColor}0.15)` }} />

        <span className="text-[10px] font-mono tabular-nums" style={{ color: `${neonColor}0.5)` }}>
          {latency}ms
        </span>

        <div className="w-px h-3" style={{ background: `${neonColor}0.15)` }} />

        <span className="text-[10px] font-mono tabular-nums" style={{ color: `${neonColor}0.4)` }}>
          {formatUptime(uptime)}
        </span>

        {/* Live user count — now shows orbiting dots indicator */}
        {activeUserCount > 0 && (
          <>
            <div className="w-px h-3" style={{ background: `${neonColor}0.15)` }} />
            <span
              className="flex items-center gap-1 text-[10px] font-mono"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(0,255,204,0.6)' }}
            >
              {/* Mini orbiting dots indicator */}
              <span className="relative w-4 h-4 flex items-center justify-center">
                <span className="w-1 h-1 rounded-full" style={{ background: dotColor }} />
                <span
                  className="absolute w-1 h-1 rounded-full"
                  style={{
                    background: dotColor,
                    opacity: 0.6,
                    animation: 'miniOrbit 3s linear infinite',
                  }}
                />
              </span>
              {activeUserCount} live
            </span>
          </>
        )}

        {/* Expand indicator */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="ml-1 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.4 }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke={ghostMode ? '#999' : '#00FFCC'} strokeWidth="1.2" fill="none" />
        </svg>
      </button>

      {/* ── Expanded Live Network Panel ── */}
      {expanded && (
        <div
          className="mt-2 rounded-xl border overflow-hidden"
          style={{
            background: 'rgba(8, 8, 8, 0.85)',
            borderColor: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.08)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            animation: 'fadeSlideIn 0.3s ease-out',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(0,255,204,0.6)' }}>
                Network Nodes
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,255,204,0.08)',
                  color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(0,255,204,0.5)',
                }}
              >
                {connectionStatus === 'connected' ? 'SYNCED' : 'SYNCING'}
              </span>
            </div>
            <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {activeUserCount} peer{activeUserCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Network Node Ring Canvas */}
          <div className="flex justify-center py-3 px-3">
            <NetworkNodeRing
              users={allUsers}
              ghostMode={ghostMode}
              achievementRipples={achievementRipples}
            />
          </div>

          {/* Achievement Feed — recent ripples as text */}
          {achievementRipples.length > 0 && (
            <div
              className="px-4 py-2 border-t"
              style={{ borderColor: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.06)' }}
            >
              <div className="text-[9px] font-mono uppercase tracking-widest mb-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Achievement Feed
              </div>
              <div className="flex flex-col gap-1 max-h-16 overflow-hidden">
                {achievementRipples.slice(-3).reverse().map(r => (
                  <div key={r.id} className="flex items-center gap-1.5" style={{ animation: 'fadeSlideIn 0.3s ease-out' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color, boxShadow: `0 0 4px ${r.color}` }} />
                    <span className="text-[9px] font-mono" style={{ color: hexToRgba(r.color, 0.7) }}>
                      {r.label}
                    </span>
                    <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
                      just now
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Protocols List */}
          {activeProtocols.length > 0 && (
            <div
              className="px-4 py-2.5 border-t"
              style={{ borderColor: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.06)' }}
            >
              <div className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Active Sessions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeProtocols.map(p => (
                  <ProtocolBadge key={p.sessionId} protocol={p.protocol} category={p.category} ghostMode={p.ghostMode} />
                ))}
              </div>
            </div>
          )}

          {/* Category Legend */}
          <div
            className="px-4 py-2 border-t flex flex-wrap gap-3"
            style={{ borderColor: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(0,255,204,0.04)' }}
          >
            {Object.entries(CATEGORY_COLORS).filter(([k]) => k !== 'default').map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: ghostMode ? 'rgba(160,160,160,0.3)' : color }} />
                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {cat}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bio-Pulse Strip ── */}
      {showBioPulses && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[200] pointer-events-none flex flex-col items-center"
          style={{ animation: 'bioPulsesFadeIn 1.2s ease-out' }}
        >
          <div className="flex items-center gap-1.5 mb-0.5" style={{ animation: 'bioPulseLabelBreath 4s ease-in-out infinite' }}>
            <span
              className="text-[8px] font-mono uppercase tracking-[0.2em]"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(0,255,204,0.2)' }}
            >
              {remoteUsers.length} peer{remoteUsers.length !== 1 ? 's' : ''} in the collective
            </span>
          </div>
          <BioPulseCanvas users={remoteUsers} ghostMode={ghostMode} />
          <div className="w-full h-2" style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))' }} />
        </div>
      )}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bioPulsesFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bioPulseLabelBreath {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes miniOrbit {
          0% { transform: translate(0, -5px); }
          25% { transform: translate(5px, 0); }
          50% { transform: translate(0, 5px); }
          75% { transform: translate(-5px, 0); }
          100% { transform: translate(0, -5px); }
        }
      `}</style>
    </div>
  );
}


