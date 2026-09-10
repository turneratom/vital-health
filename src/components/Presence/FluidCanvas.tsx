import { useRef, useEffect, useCallback, useState, memo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePresenceState, useGhostMode, type TrailPoint } from './usePresenceState';
import type { RemotePresence } from './useConvexPresence';
import { PeerProfileCard } from './PeerProfileCard';
import { recalcCollaborationZones, type CollaborationZone } from './useProximityGlow';
import { useGhostPeers, getGhostPosition, getGhostTrail, type GhostPeer } from './useGhostPeers';

interface FluidCanvasProps {
  ghostMode: boolean;
  remoteUsers?: RemotePresence[];
  /** Whether the user is currently performing a protocol (activates ghost rabbits) */
  isInProtocol?: boolean;
}

const NEON_R = 0, NEON_G = 255, NEON_B = 204;
const GHOST_R = 160, GHOST_G = 160, GHOST_B = 160;

/* ── Optimization pulse state (triggered by DailyStack mission cards) ── */
interface OptPulse { r: number; g: number; b: number; startTime: number; duration: number; }
const activePulsesRef = { current: [] as OptPulse[] };

/* ── Nudge pulse state (triggered by PeerProfileCard nudge button) ── */
interface NudgePulse {
  targetSessionId: string;
  x: number;
  y: number;
  color: string;
  startTime: number;
  duration: number;
}
const activeNudgePulsesRef = { current: [] as NudgePulse[] };

function hexToRgbPulse(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0, 2), 16) || 0, parseInt(c.slice(2, 4), 16) || 0, parseInt(c.slice(4, 6), 16) || 0];
}

function lerpCh(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }

/* ── Hover detection radius for remote cursors ── */
const HOVER_RADIUS = 30;
/* ── Throttle hover checks to every ~100ms instead of every rAF ── */
const HOVER_CHECK_INTERVAL = 100;
/* ── Skip remote trail points if movement delta < threshold ── */
const REMOTE_MOVE_THRESHOLD = 0.5;
/* ── Throttle position updates — only interpolate every 2nd frame ── */
const INTERP_FRAME_SKIP = 2;
/* ── Collaboration zone recalc every 3rd frame (~20fps) for perf ── */
const COLLAB_RECALC_SKIP = 3;

/* ── Pre-allocated reusable arrays to reduce GC pressure ── */
const _collabZoneCache: CollaborationZone[] = [];

/* ══════════════════════════════════════════════════════════════════════
   BIOLOGICAL AURA SYSTEM
   
   Computes a continuous aura state from HeartRate + HRV (readiness proxy).
   
   Readiness = f(HRV, HR):
     - High HRV (>70) + Low HR (<65) → Recovered (readiness ~90-100)
     - Moderate HRV (45-70) + Normal HR (65-80) → Baseline (readiness ~50-70)
     - Low HRV (<45) + High HR (>80) → Stressed (readiness ~10-40)
   
   Aura mapping:
     Readiness 80-100 → Soft blue (#4A9EFF), slow pulse (0.8Hz), wide radius
     Readiness 60-80  → Teal (#00CCAA), moderate pulse (1.0Hz), medium radius
     Readiness 40-60  → Amber (#FFB86B), faster pulse (1.3Hz), tighter radius
     Readiness 20-40  → Orange-red (#FF6B4A), fast pulse (1.6Hz), tight radius
     Readiness 0-20   → Sharp red (#FF3B3B), rapid pulse (2.0Hz), tight + warning rings
   
   Flow state override: isDeepWork + HRV>50 → Teal shimmer with rotating arcs
   ══════════════════════════════════════════════════════════════════════ */

interface AuraState {
  /** 0-100 composite readiness score */
  readiness: number;
  /** Primary aura color [r, g, b] */
  primary: [number, number, number];
  /** Outer glow color [r, g, b] */
  glow: [number, number, number];
  /** Pulse frequency in Hz (heartbeats per second) */
  pulseHz: number;
  /** Aura radius multiplier (1.0 = baseline) */
  radiusMul: number;
  /** Aura opacity multiplier */
  alphaMul: number;
  /** Whether in flow state */
  isFlow: boolean;
  /** Whether critically stressed */
  isCritical: boolean;
  /** Label for the aura state */
  label: string;
}

/* ── Color stops for the readiness spectrum ── */
const AURA_SPECTRUM: Array<{ readiness: number; color: [number, number, number]; glow: [number, number, number] }> = [
  { readiness: 0,   color: [255, 59, 59],   glow: [255, 80, 80] },    // Sharp red
  { readiness: 20,  color: [255, 107, 74],   glow: [255, 130, 90] },   // Orange-red
  { readiness: 40,  color: [255, 184, 107],  glow: [255, 200, 130] },  // Amber
  { readiness: 60,  color: [0, 204, 170],    glow: [60, 220, 190] },   // Teal
  { readiness: 80,  color: [74, 158, 255],   glow: [100, 180, 255] },  // Soft blue
  { readiness: 100, color: [100, 180, 255],  glow: [140, 200, 255] },  // Bright blue
];

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function computeAuraState(heartRate?: number, hrv?: number, isDeepWork?: boolean): AuraState {
  const hr = heartRate ?? 68;
  const hrvVal = hrv ?? 55;

  // Compute readiness from HRV and HR
  // HRV contribution: 0-100 mapped from HRV 15-100ms range
  const hrvNorm = Math.max(0, Math.min(1, (hrvVal - 15) / 85));
  // HR contribution: inverted — lower HR = higher readiness
  // Maps HR 50-120 to readiness 1.0-0.0
  const hrNorm = Math.max(0, Math.min(1, 1 - (hr - 50) / 70));
  // Weighted composite: HRV is 60% of signal, HR is 40%
  const readiness = Math.round((hrvNorm * 0.6 + hrNorm * 0.4) * 100);

  // Interpolate color from spectrum
  let primary: [number, number, number] = AURA_SPECTRUM[0].color;
  let glow: [number, number, number] = AURA_SPECTRUM[0].glow;
  for (let i = 0; i < AURA_SPECTRUM.length - 1; i++) {
    const lo = AURA_SPECTRUM[i];
    const hi = AURA_SPECTRUM[i + 1];
    if (readiness >= lo.readiness && readiness <= hi.readiness) {
      const t = (readiness - lo.readiness) / (hi.readiness - lo.readiness);
      primary = lerpColor(lo.color, hi.color, t);
      glow = lerpColor(lo.glow, hi.glow, t);
      break;
    }
  }
  if (readiness >= 100) {
    primary = AURA_SPECTRUM[AURA_SPECTRUM.length - 1].color;
    glow = AURA_SPECTRUM[AURA_SPECTRUM.length - 1].glow;
  }

  // Pulse frequency: stressed = fast (2Hz), recovered = slow (0.7Hz)
  const pulseHz = 2.0 - (readiness / 100) * 1.3; // 2.0 → 0.7

  // Radius: recovered = wide (1.6x), stressed = tight (0.7x)
  const radiusMul = 0.7 + (readiness / 100) * 0.9;

  // Opacity: moderate across the board, slightly brighter when stressed (attention-grabbing)
  const alphaMul = readiness < 30 ? 1.1 : readiness > 70 ? 0.85 : 1.0;

  // Flow state detection
  const isFlow = isDeepWork === true && hrvVal > 50 && hr < 80;

  // Critical stress detection
  const isCritical = readiness < 20;

  // Flow override: shift to teal shimmer
  if (isFlow) {
    primary = [0, 220, 190];
    glow = [60, 240, 210];
  }

  // Label
  let label = 'Baseline';
  if (isCritical) label = 'Critical';
  else if (readiness < 30) label = 'Stressed';
  else if (readiness < 50) label = 'Moderate';
  else if (isFlow) label = 'Flow';
  else if (readiness >= 80) label = 'Recovered';
  else if (readiness >= 60) label = 'Good';

  return { readiness, primary, glow, pulseHz, radiusMul, alphaMul, isFlow, isCritical, label };
}

/* ── Draw the full Biological Aura around a peer ── */
function drawBiologicalAura(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  peerColor: [number, number, number],
  baseAlpha: number,
  heartRate?: number,
  hrv?: number,
  isDeepWork?: boolean,
) {
  const now = performance.now();
  const aura = computeAuraState(heartRate, hrv, isDeepWork);
  const [pr, pg, pb] = aura.primary;
  const [gr, gg, gb] = aura.glow;

  // ── Cardiac-synced pulse ──
  // Convert Hz to period, then compute phase
  const pulsePeriodMs = 1000 / aura.pulseHz;
  const phase = (now % pulsePeriodMs) / pulsePeriodMs;
  // Systole/diastole easing: sharp contraction then slow relaxation
  const systole = phase < 0.25 ? phase / 0.25 : 1 - ((phase - 0.25) / 0.75);
  const cardiac = systole * systole * (3 - 2 * systole); // smoothstep

  const intensity = aura.alphaMul * baseAlpha;
  const baseRadius = 28 * aura.radiusMul;

  // ═══ LAYER 1: Deep ambient field (widest, softest) ═══
  const ambientR = baseRadius * 2.8 + cardiac * 12;
  const ambientAlpha = intensity * 0.06;
  const ambientGrad = ctx.createRadialGradient(x, y, 0, x, y, ambientR);
  ambientGrad.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${ambientAlpha * 1.2})`);
  ambientGrad.addColorStop(0.25, `rgba(${gr}, ${gg}, ${gb}, ${ambientAlpha * 0.6})`);
  ambientGrad.addColorStop(0.6, `rgba(${gr}, ${gg}, ${gb}, ${ambientAlpha * 0.15})`);
  ambientGrad.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, ambientR, 0, Math.PI * 2);
  ctx.fillStyle = ambientGrad;
  ctx.fill();

  // ═══ LAYER 2: Primary aura pulse (mid-range, HR-synced) ═══
  const primaryR = baseRadius * 1.5 + cardiac * 10;
  const primaryAlpha = intensity * (0.12 + cardiac * 0.18);
  const primaryGrad = ctx.createRadialGradient(x, y, primaryR * 0.15, x, y, primaryR);
  primaryGrad.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${primaryAlpha})`);
  primaryGrad.addColorStop(0.4, `rgba(${pr}, ${pg}, ${pb}, ${primaryAlpha * 0.5})`);
  primaryGrad.addColorStop(0.75, `rgba(${pr}, ${pg}, ${pb}, ${primaryAlpha * 0.12})`);
  primaryGrad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, primaryR, 0, Math.PI * 2);
  ctx.fillStyle = primaryGrad;
  ctx.fill();

  // ═══ LAYER 3: Inner cardiac core (tight, bright, synced to heartbeat) ═══
  const coreR = 14 + cardiac * 6;
  const coreAlpha = intensity * (0.2 + cardiac * 0.3);
  const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, coreR);
  coreGrad.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${coreAlpha})`);
  coreGrad.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, ${coreAlpha * 0.4})`);
  coreGrad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0)`);
  ctx.beginPath();
  ctx.arc(x, y, coreR, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  // ═══ LAYER 4: Pulse ring — expands outward on each heartbeat ═══
  // Ring expands from core to outer radius on each beat
  const ringExpand = cardiac;
  const ringR = 18 + ringExpand * (baseRadius * 1.2);
  const ringAlpha = intensity * (1 - ringExpand) * 0.25;
  if (ringAlpha > 0.01) {
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, ${ringAlpha})`;
    ctx.lineWidth = 1.5 - ringExpand * 0.8;
    ctx.stroke();
  }

  // ═══ LAYER 5: Critical stress — double warning rings + orbiting particles ═══
  if (aura.isCritical) {
    // Second offset pulse ring
    const warnPhase = ((now + pulsePeriodMs * 0.3) % pulsePeriodMs) / pulsePeriodMs;
    const warnSystole = warnPhase < 0.25 ? warnPhase / 0.25 : 1 - ((warnPhase - 0.25) / 0.75);
    const warnCardiac = warnSystole * warnSystole * (3 - 2 * warnSystole);
    const warnR = 22 + warnCardiac * (baseRadius * 1.4);
    const warnAlpha = intensity * (1 - warnCardiac) * 0.18;

    ctx.beginPath();
    ctx.arc(x, y, warnR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, ${warnAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Orbiting stress particles — 5 fast-moving dots
    const orbitR = baseRadius * 1.1 + cardiac * 6;
    const orbitSpeed = now * 0.004; // fast rotation
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + orbitSpeed;
      const wobble = Math.sin(now * 0.006 + i * 1.8) * 4;
      const px = x + Math.cos(angle) * (orbitR + wobble);
      const py = y + Math.sin(angle) * (orbitR + wobble);
      const pAlpha = intensity * (0.4 + cardiac * 0.3);

      // Particle glow
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${pAlpha * 0.25})`;
      ctx.fill();

      // Particle core
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${pAlpha * 0.7})`;
      ctx.fill();
    }
  }

  // ═══ LAYER 5b: Stressed (readiness < 40) — faster orbiting amber dots ═══
  if (aura.readiness < 40 && !aura.isCritical) {
    const stressOrbitR = baseRadius * 0.9 + cardiac * 5;
    const stressSpeed = now * 0.003;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + stressSpeed;
      const px = x + Math.cos(angle) * stressOrbitR;
      const py = y + Math.sin(angle) * stressOrbitR;
      const pAlpha = intensity * (0.25 + cardiac * 0.2);

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${pAlpha * 0.2})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${pAlpha * 0.5})`;
      ctx.fill();
    }
  }

  // ═══ LAYER 6: Flow state — teal shimmer with rotating arc segments ═══
  if (aura.isFlow) {
    const flowBreath = 0.6 + 0.4 * Math.sin(now * 0.0012);
    const flowR = baseRadius * 2.2 + flowBreath * 14;
    const flowAlpha = intensity * 0.1 * flowBreath;

    // Wide flow field
    const flowGrad = ctx.createRadialGradient(x, y, flowR * 0.3, x, y, flowR);
    flowGrad.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${flowAlpha})`);
    flowGrad.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, ${flowAlpha * 0.35})`);
    flowGrad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0)`);
    ctx.beginPath();
    ctx.arc(x, y, flowR, 0, Math.PI * 2);
    ctx.fillStyle = flowGrad;
    ctx.fill();

    // 3 rotating arc segments — slow, meditative rotation
    const arcR = baseRadius * 1.6 + flowBreath * 5;
    for (let i = 0; i < 3; i++) {
      const startAngle = (i / 3) * Math.PI * 2 + now * 0.0008;
      const arcLen = Math.PI * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, arcR, startAngle, startAngle + arcLen);
      ctx.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, ${flowAlpha * 2.0})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Gentle inner shimmer particles — 4 slow-orbiting dots
    const shimmerR = baseRadius * 1.0;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + now * 0.001;
      const wobble = Math.sin(now * 0.002 + i * 2.5) * 5;
      const px = x + Math.cos(angle) * (shimmerR + wobble);
      const py = y + Math.sin(angle) * (shimmerR + wobble);
      const pAlpha = intensity * 0.15 * flowBreath;

      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${pAlpha})`;
      ctx.fill();
    }
  }

  // ═══ LAYER 7: Recovered state — slow breathing halo ═══
  if (aura.readiness >= 70 && !aura.isFlow) {
    const breathe = 0.7 + 0.3 * Math.sin(now * 0.001);
    const haloR = baseRadius * 2.0 * breathe;
    const haloAlpha = intensity * 0.04 * breathe;

    const haloGrad = ctx.createRadialGradient(x, y, haloR * 0.5, x, y, haloR);
    haloGrad.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, ${haloAlpha * 1.5})`);
    haloGrad.addColorStop(0.6, `rgba(${pr}, ${pg}, ${pb}, ${haloAlpha * 0.4})`);
    haloGrad.addColorStop(1, `rgba(${pr}, ${pg}, ${pb}, 0)`);
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.fill();
  }
}

/* ── Broadcast local aura state to Convex via custom event ── */
function broadcastAuraState(heartRate: number, hrv: number, isDeepWork: boolean) {
  const aura = computeAuraState(heartRate, hrv, isDeepWork);
  window.dispatchEvent(new CustomEvent('vive-aura-state', {
    detail: {
      readiness: aura.readiness,
      label: aura.label,
      isFlow: aura.isFlow,
      isCritical: aura.isCritical,
    },
  }));
}

/* ── Export for external consumers (e.g. SquadStatus badge) ── */
export { computeAuraState, type AuraState };

function FluidCanvasInner({ ghostMode, remoteUsers = [], isInProtocol = false }: FluidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentX, currentY, trail, isActive } = usePresenceState();

  // Hovered peer state for mini-profile card
  const [hoveredPeer, setHoveredPeer] = useState<{ peer: RemotePresence; x: number; y: number } | null>(null);
  const hoveredPeerRef = useRef(hoveredPeer);
  hoveredPeerRef.current = hoveredPeer;

  // Track mouse position for hover detection over remote cursors
  const mouseRef = useRef({ x: 0, y: 0 });
  const hoverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Frame counter for skipping interpolation frames
  const frameCountRef = useRef(0);

  // Listen for optimization pulse events from DailyStack
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.color) {
        const [pr, pg, pb] = hexToRgbPulse(detail.color);
        activePulsesRef.current.push({ r: pr, g: pg, b: pb, startTime: performance.now(), duration: 1800 });
      }
    };
    window.addEventListener('vive-optimization-pulse', handler);
    return () => window.removeEventListener('vive-optimization-pulse', handler);
  }, []);

  // Listen for nudge pulse events from PeerProfileCard
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.targetSessionId) {
        activeNudgePulsesRef.current.push({
          targetSessionId: detail.targetSessionId,
          x: detail.x,
          y: detail.y,
          color: detail.color,
          startTime: performance.now(),
          duration: detail.duration || 2000,
        });
      }
    };
    window.addEventListener('vive-nudge-pulse', handler);
    return () => window.removeEventListener('vive-nudge-pulse', handler);
  }, []);

  // Mouse move handler — passive, no state updates
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  // Throttled hover check via setInterval (~100ms) instead of rAF (~16ms)
  useEffect(() => {
    const checkHover = () => {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const remotes = stateRef.current.remoteUsers;
      const interpMap = remoteInterpRef.current;

      let closest: { peer: RemotePresence; dist: number; ix: number; iy: number } | null = null;

      for (let i = 0; i < remotes.length; i++) {
        const remote = remotes[i];
        if (remote.ghostMode) continue;
        const interp = interpMap.get(remote.sessionId);
        const rx = interp ? interp.x : remote.x;
        const ry = interp ? interp.y : remote.y;
        const dx = mx - rx;
        const dy = my - ry;
        const distSq = dx * dx + dy * dy;

        // Use squared distance to avoid sqrt
        if (distSq < HOVER_RADIUS * HOVER_RADIUS && (!closest || distSq < closest.dist)) {
          closest = { peer: remote, dist: distSq, ix: rx, iy: ry };
        }
      }

      if (closest && !hoveredPeerRef.current) {
        setHoveredPeer({ peer: closest.peer, x: closest.ix, y: closest.iy });
      } else if (!closest && hoveredPeerRef.current) {
        // Auto-close only if mouse moved far from the card area
      }
    };

    hoverTimerRef.current = setInterval(checkHover, HOVER_CHECK_INTERVAL);
    return () => {
      if (hoverTimerRef.current) clearInterval(hoverTimerRef.current);
    };
  }, []);

  const stateRef = useRef({ currentX, currentY, trail, isActive, ghostMode, remoteUsers });
  stateRef.current = { currentX, currentY, trail, isActive, ghostMode, remoteUsers };

  const ghostProgressRef = useRef(ghostMode ? 1 : 0);
  const canvasOpacityRef = useRef(ghostMode ? 0.3 : 1.0);

  // Smooth interpolation state for each remote user
  const remoteInterpRef = useRef<Map<string, {
    x: number;
    y: number;
    trail: Array<{ x: number; y: number; timestamp: number; alpha: number }>;
    prevX: number;
    prevY: number;
  }>>(new Map());

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const TRANSITION_SPEED = 0.035;
    const REMOTE_LERP = 0.12;
    const REMOTE_TRAIL_MAX = 40;
    const REMOTE_TRAIL_DECAY = 1200;

    const render = () => {
      const { currentX: cx, currentY: cy, trail: pts, isActive: active, ghostMode: ghost, remoteUsers: remotes } = stateRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      frameCountRef.current++;
      const frameNum = frameCountRef.current;
      const shouldInterpolate = frameNum % INTERP_FRAME_SKIP === 0;

      // Ghost transition — smooth lerp toward target
      const targetProgress = ghost ? 1 : 0;
      ghostProgressRef.current += (targetProgress - ghostProgressRef.current) * TRANSITION_SPEED;
      const gp = ghostProgressRef.current;

      const r = lerpCh(NEON_R, GHOST_R, gp);
      const g = lerpCh(NEON_G, GHOST_G, gp);
      const b = lerpCh(NEON_B, GHOST_B, gp);

      const targetOpacity = ghost ? 0.3 : 1.0;
      canvasOpacityRef.current += (targetOpacity - canvasOpacityRef.current) * TRANSITION_SPEED;
      canvas.style.opacity = String(canvasOpacityRef.current.toFixed(3));

      ctx.clearRect(0, 0, w, h);

      // ── Render optimization pulses from DailyStack ──
      const pulses = activePulsesRef.current;
      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const pulse = pulses[pi];
        const elapsed = performance.now() - pulse.startTime;
        if (elapsed > pulse.duration) { pulses.splice(pi, 1); continue; }
        const t = elapsed / pulse.duration;
        const ease = 1 - Math.pow(1 - t, 3);
        const alpha = (1 - t) * 0.12;
        const radius = ease * Math.max(w, h) * 0.6;
        const cx2 = w / 2, cy2 = h / 2;
        const grad = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, radius);
        grad.addColorStop(0, `rgba(${pulse.r}, ${pulse.g}, ${pulse.b}, ${alpha})`);
        grad.addColorStop(0.4, `rgba(${pulse.r}, ${pulse.g}, ${pulse.b}, ${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${pulse.r}, ${pulse.g}, ${pulse.b}, 0)`);
        ctx.beginPath(); ctx.arc(cx2, cy2, radius, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
      }

      // ── Render nudge pulses — high-frequency concentric rings ──
      const nudgePulses = activeNudgePulsesRef.current;
      for (let ni = nudgePulses.length - 1; ni >= 0; ni--) {
        const np = nudgePulses[ni];
        const elapsed = performance.now() - np.startTime;
        if (elapsed > np.duration) { nudgePulses.splice(ni, 1); continue; }

        const [nr, ng, nb] = hexToRgbPulse(np.color);
        const t = elapsed / np.duration;

        const interp = remoteInterpRef.current.get(np.targetSessionId);
        const px = interp ? interp.x : np.x;
        const py = interp ? interp.y : np.y;

        // 4 concentric rings expanding outward at staggered intervals
        const ringCount = 4;
        for (let ri = 0; ri < ringCount; ri++) {
          const ringDelay = ri * 0.15;
          const ringT = Math.max(0, Math.min(1, (t - ringDelay) / (1 - ringDelay)));
          if (ringT <= 0) continue;

          const ringRadius = ringT * 80 + 8;
          const ringAlpha = (1 - ringT) * 0.5;
          const shimmer = 0.7 + 0.3 * Math.sin(elapsed * 0.05 + ri * Math.PI * 0.5);

          ctx.beginPath();
          ctx.arc(px, py, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${nr}, ${ng}, ${nb}, ${ringAlpha * shimmer})`;
          ctx.lineWidth = 2.5 - ri * 0.4;
          ctx.stroke();
        }

        // Central flash
        const coreAlpha = (1 - t) * 0.6;
        const coreFlash = 0.5 + 0.5 * Math.sin(elapsed * 0.08);
        const coreGrad = ctx.createRadialGradient(px, py, 0, px, py, 20);
        coreGrad.addColorStop(0, `rgba(${nr}, ${ng}, ${nb}, ${coreAlpha * coreFlash})`);
        coreGrad.addColorStop(0.5, `rgba(${nr}, ${ng}, ${nb}, ${coreAlpha * coreFlash * 0.3})`);
        coreGrad.addColorStop(1, `rgba(${nr}, ${ng}, ${nb}, 0)`);
        ctx.beginPath();
        ctx.arc(px, py, 20, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Lightning bolt particles
        const particleCount = 6;
        for (let pi2 = 0; pi2 < particleCount; pi2++) {
          const angle = (pi2 / particleCount) * Math.PI * 2 + elapsed * 0.003;
          const dist = t * 60 + 10;
          const ppx = px + Math.cos(angle) * dist;
          const ppy = py + Math.sin(angle) * dist;
          const pAlpha = (1 - t) * 0.7;

          ctx.beginPath();
          ctx.arc(ppx, ppy, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${pAlpha * 0.8})`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(ppx, ppy, 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${nr}, ${ng}, ${nb}, ${pAlpha * 0.3})`;
          ctx.fill();
        }
      }

      // ── Interpolate remote user positions ──
      const interpMap = remoteInterpRef.current;
      const now = performance.now();

      for (let ri = 0; ri < remotes.length; ri++) {
        const remote = remotes[ri];
        let interp = interpMap.get(remote.sessionId);
        if (!interp) {
          interp = { x: remote.x, y: remote.y, trail: [], prevX: remote.x, prevY: remote.y };
          interpMap.set(remote.sessionId, interp);
        }

        // Only interpolate on designated frames to reduce CPU
        if (shouldInterpolate) {
          interp.prevX = interp.x;
          interp.prevY = interp.y;
          interp.x += (remote.x - interp.x) * REMOTE_LERP;
          interp.y += (remote.y - interp.y) * REMOTE_LERP;

          // Build trail from interpolated movement — skip tiny deltas
          const dx = interp.x - interp.prevX;
          const dy = interp.y - interp.prevY;
          const distSq = dx * dx + dy * dy;
          if (distSq > REMOTE_MOVE_THRESHOLD * REMOTE_MOVE_THRESHOLD) {
            interp.trail.push({ x: interp.x, y: interp.y, timestamp: now, alpha: 1 });
            if (interp.trail.length > REMOTE_TRAIL_MAX) {
              interp.trail = interp.trail.slice(-REMOTE_TRAIL_MAX);
            }
          }

          // Decay old trail points
          interp.trail = interp.trail.filter((tp) => now - tp.timestamp < REMOTE_TRAIL_DECAY);
        }
      }

      // ══════════════════════════════════════════════════════════
      // ── COLLABORATION ZONE RENDERING                        ──
      // ══════════════════════════════════════════════════════════
      if (frameNum % COLLAB_RECALC_SKIP === 0 && remotes.length >= 2) {
        const peerPositions = remotes.map((rm) => {
          const interp = interpMap.get(rm.sessionId);
          return {
            sessionId: rm.sessionId,
            x: interp ? interp.x : rm.x,
            y: interp ? interp.y : rm.y,
            color: rm.color,
            ghostMode: rm.ghostMode,
          };
        });
        recalcCollaborationZones(peerPositions);
      }

      const liveZones = getCollabZonesFromModule();

      for (let zi = 0; zi < liveZones.length; zi++) {
        const zone = liveZones[zi];
        if (zone.intensity < 0.005) continue;

        const [ar, ag, ab] = hexToRgb(zone.colorA);
        const [br2, bg2, bb2] = hexToRgb(zone.colorB);

        const mr = Math.round((ar + br2) / 2);
        const mg = Math.round((ag + bg2) / 2);
        const mb = Math.round((ab + bb2) / 2);

        const intensity = zone.intensity;
        const zr = zone.radius;
        const zcx = zone.cx;
        const zcy = zone.cy;

        const breathe = 1 + 0.08 * Math.sin(now * 0.002 + zi * 1.5) * intensity;
        const animRadius = zr * breathe;

        // Layer 1: Wide ambient glow
        const outerR = animRadius * 2.2;
        const outerGrad = ctx.createRadialGradient(zcx, zcy, 0, zcx, zcy, outerR);
        outerGrad.addColorStop(0, `rgba(${mr}, ${mg}, ${mb}, ${intensity * 0.12})`);
        outerGrad.addColorStop(0.3, `rgba(${mr}, ${mg}, ${mb}, ${intensity * 0.06})`);
        outerGrad.addColorStop(0.6, `rgba(${mr}, ${mg}, ${mb}, ${intensity * 0.02})`);
        outerGrad.addColorStop(1, `rgba(${mr}, ${mg}, ${mb}, 0)`);
        ctx.beginPath();
        ctx.arc(zcx, zcy, outerR, 0, Math.PI * 2);
        ctx.fillStyle = outerGrad;
        ctx.fill();

        // Layer 2: Core glow
        const coreR2 = animRadius * 1.1;
        const coreGrad2 = ctx.createRadialGradient(zcx, zcy, 0, zcx, zcy, coreR2);
        coreGrad2.addColorStop(0, `rgba(${mr}, ${mg}, ${mb}, ${intensity * 0.25})`);
        coreGrad2.addColorStop(0.4, `rgba(${mr}, ${mg}, ${mb}, ${intensity * 0.12})`);
        coreGrad2.addColorStop(0.8, `rgba(${mr}, ${mg}, ${mb}, ${intensity * 0.03})`);
        coreGrad2.addColorStop(1, `rgba(${mr}, ${mg}, ${mb}, 0)`);
        ctx.beginPath();
        ctx.arc(zcx, zcy, coreR2, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad2;
        ctx.fill();

        // Layer 3: Hot center dot
        if (intensity > 0.4) {
          const hotAlpha = (intensity - 0.4) / 0.6;
          const hotR = 6 + hotAlpha * 8;
          const hotGrad = ctx.createRadialGradient(zcx, zcy, 0, zcx, zcy, hotR);
          hotGrad.addColorStop(0, `rgba(255, 255, 255, ${hotAlpha * 0.3})`);
          hotGrad.addColorStop(0.3, `rgba(${mr}, ${mg}, ${mb}, ${hotAlpha * 0.4})`);
          hotGrad.addColorStop(1, `rgba(${mr}, ${mg}, ${mb}, 0)`);
          ctx.beginPath();
          ctx.arc(zcx, zcy, hotR, 0, Math.PI * 2);
          ctx.fillStyle = hotGrad;
          ctx.fill();
        }

        // Layer 4: Orbiting particles
        if (intensity > 0.3) {
          const particleAlpha = (intensity - 0.3) / 0.7;
          const particleCount = Math.min(6, Math.floor(intensity * 8));
          const orbitRadius = animRadius * 0.7;

          for (let pi = 0; pi < particleCount; pi++) {
            const angle = (pi / particleCount) * Math.PI * 2 + now * 0.001 * (1 + intensity);
            const wobble = Math.sin(now * 0.003 + pi * 2.1) * 6;
            const ppx = zcx + Math.cos(angle) * (orbitRadius + wobble);
            const ppy = zcy + Math.sin(angle) * (orbitRadius + wobble);
            const pSize = 1.5 + particleAlpha * 1.5;

            ctx.beginPath();
            ctx.arc(ppx, ppy, pSize * 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${mr}, ${mg}, ${mb}, ${particleAlpha * 0.15})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(ppx, ppy, pSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${mr}, ${mg}, ${mb}, ${particleAlpha * 0.6})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(ppx, ppy, pSize * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${particleAlpha * 0.5})`;
            ctx.fill();
          }
        }

        // Layer 5: Connecting beam
        if (intensity > 0.2 && zone.colorA !== zone.colorB) {
          const parts = zone.key.split(':');
          if (parts.length === 2) {
            const interpA = interpMap.get(parts[0]);
            const interpB = interpMap.get(parts[1]);
            if (interpA && interpB) {
              const beamAlpha = (intensity - 0.2) / 0.8 * 0.15;

              const beamGrad = ctx.createLinearGradient(interpA.x, interpA.y, interpB.x, interpB.y);
              beamGrad.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, ${beamAlpha})`);
              beamGrad.addColorStop(0.3, `rgba(${mr}, ${mg}, ${mb}, ${beamAlpha * 1.5})`);
              beamGrad.addColorStop(0.7, `rgba(${mr}, ${mg}, ${mb}, ${beamAlpha * 1.5})`);
              beamGrad.addColorStop(1, `rgba(${br2}, ${bg2}, ${bb2}, ${beamAlpha})`);

              ctx.beginPath();
              ctx.moveTo(interpA.x, interpA.y);
              ctx.quadraticCurveTo(zcx, zcy, interpB.x, interpB.y);
              ctx.lineWidth = 1.5 + intensity * 3;
              ctx.lineCap = 'round';
              ctx.strokeStyle = beamGrad;
              ctx.stroke();

              ctx.beginPath();
              ctx.moveTo(interpA.x, interpA.y);
              ctx.quadraticCurveTo(zcx, zcy, interpB.x, interpB.y);
              ctx.lineWidth = 6 + intensity * 10;
              ctx.strokeStyle = `rgba(${mr}, ${mg}, ${mb}, ${beamAlpha * 0.3})`;
              ctx.stroke();
            }
          }
        }
      }

      // ── Render remote user ghost trails + BIOLOGICAL AURA ──
      for (let ri = 0; ri < remotes.length; ri++) {
        const remote = remotes[ri];
        const interp = interpMap.get(remote.sessionId);
        if (!interp) continue;

        const [cr, cg, cb] = hexToRgb(remote.color);
        const remoteAlpha = remote.ghostMode ? 0.25 : 0.55;

        // Check if this peer is in a collaboration zone — boost their glow
        let collabBoost = 0;
        for (let zi = 0; zi < liveZones.length; zi++) {
          const zone = liveZones[zi];
          if (zone.key.includes(remote.sessionId) && zone.intensity > 0.1) {
            collabBoost = Math.max(collabBoost, zone.intensity * 0.4);
          }
        }

        const boostedAlpha = Math.min(1, remoteAlpha + collabBoost);

        // ═══ BIOLOGICAL AURA — rendered BEFORE the cursor so it appears behind ═══
        drawBiologicalAura(
          ctx, interp.x, interp.y,
          [cr, cg, cb], boostedAlpha,
          remote.heartRate, remote.hrv, remote.isDeepWork,
        );

        // Draw remote trail path
        if (interp.trail.length >= 2) {
          const trailPts = interp.trail;
          const passes = [
            { width: 10, alphaMul: 0.06 },
            { width: 2.5, alphaMul: 0.4 },
          ];

          for (const pass of passes) {
            ctx.beginPath();
            ctx.moveTo(trailPts[0].x, trailPts[0].y);
            for (let i = 1; i < trailPts.length; i++) {
              const prev = trailPts[i - 1];
              const curr = trailPts[i];
              ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
            }
            const last = trailPts[trailPts.length - 1];
            ctx.lineTo(last.x, last.y);
            ctx.lineWidth = pass.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${boostedAlpha * pass.alphaMul})`;
            ctx.stroke();
          }

          // Trail dots — render every 3rd point
          for (let i = 0; i < trailPts.length; i += 3) {
            const tp = trailPts[i];
            const age = now - tp.timestamp;
            const life = Math.max(0, 1 - age / REMOTE_TRAIL_DECAY);
            const dotR = 1 + (i / trailPts.length) * 2;

            const grad = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, dotR * 3);
            grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${life * boostedAlpha * 0.3})`);
            grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, dotR * 3, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(tp.x, tp.y, dotR * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${life * boostedAlpha * 0.7})`;
            ctx.fill();
          }
        }

        // Draw remote cursor head — with collaboration zone boost
        const isHovered = hoveredPeerRef.current?.peer.sessionId === remote.sessionId;
        drawRemoteCursor(ctx, interp.x, interp.y, remote.color, boostedAlpha, isHovered, collabBoost);
      }

      // Clean up stale remote interps — only check every 60 frames
      if (frameNum % 60 === 0) {
        const activeIds = new Set(remotes.map((rm) => rm.sessionId));
        for (const key of interpMap.keys()) {
          if (!activeIds.has(key)) interpMap.delete(key);
        }
      }

      // ── Draw local trail ──
      if (!active || pts.length === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const decayMs = ghost ? 1500 : 800;
      const baseAlpha = ghost ? 0.5 : 1.0;

      const validPoints: (TrailPoint & { alpha: number })[] = [];
      for (let i = 0; i < pts.length; i++) {
        const age = now - pts[i].timestamp;
        const life = 1 - age / decayMs;
        if (life <= 0) continue;
        let stagger = 1;
        if (ghost) {
          stagger = Math.max(0, 1 - (i / pts.length) * 0.3);
        }
        const alpha = Math.max(0, Math.min(1, life * stagger * baseAlpha));
        validPoints.push({ ...pts[i], alpha });
      }

      if (validPoints.length < 2) {
        if (active) drawCursorGlow(ctx, cx, cy, baseAlpha, r, g, b);
        animId = requestAnimationFrame(render);
        return;
      }

      // 3-pass trail rendering for local user
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const widths = [18, 8, 3];
      const alphaMultipliers = [0.06, 0.15, 0.6];

      for (let pass = 0; pass < 3; pass++) {
        ctx.beginPath();
        ctx.moveTo(validPoints[0].x, validPoints[0].y);
        for (let i = 1; i < validPoints.length; i++) {
          const prev = validPoints[i - 1];
          const curr = validPoints[i];
          ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
        }
        const last = validPoints[validPoints.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.lineWidth = widths[pass];
        const avgAlpha = validPoints.reduce((s, p) => s + p.alpha, 0) / validPoints.length;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${avgAlpha * alphaMultipliers[pass]})`;
        ctx.stroke();
      }

      // Individual trail dots
      for (let i = 0; i < validPoints.length; i++) {
        const pt = validPoints[i];
        const progress = i / validPoints.length;
        const dotRadius = 1.5 + progress * 2.5;

        const gradient = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, dotRadius * 4);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${pt.alpha * 0.3})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${pt.alpha * 0.08})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius * 4, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${pt.alpha * 0.9})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${pt.alpha * 0.8})`;
        ctx.fill();
      }

      drawCursorGlow(ctx, cx, cy, baseAlpha, r, g, b);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleCloseCard = useCallback(() => {
    setHoveredPeer(null);
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 50,
          transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      />
      {/* Peer profile card overlay — rendered above canvas */}
      <AnimatePresence>
        {hoveredPeer && (
          <PeerProfileCard
            key={hoveredPeer.peer.sessionId}
            peer={hoveredPeer.peer}
            x={hoveredPeer.x}
            y={hoveredPeer.y}
            onClose={handleCloseCard}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Helper to get live zones from the proximity module ── */
function getCollabZonesFromModule(): CollaborationZone[] {
  try {
    const { getCollaborationZones } = require('./useProximityGlow');
    return getCollaborationZones();
  } catch {
    return [];
  }
}

/* ── Memoized export — only re-renders when ghostMode or remoteUsers identity changes ── */
export const FluidCanvas = memo(FluidCanvasInner, (prev, next) => {
  if (prev.ghostMode !== next.ghostMode) return false;
  if (prev.remoteUsers !== next.remoteUsers) return false;
  return true;
});

function drawCursorGlow(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, r: number, g: number, b: number) {
  const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, 40);
  outerGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`);
  outerGlow.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${alpha * 0.05})`);
  outerGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fillStyle = outerGlow; ctx.fill();

  const midGlow = ctx.createRadialGradient(x, y, 0, x, y, 14);
  midGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
  midGlow.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`);
  midGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fillStyle = midGlow; ctx.fill();

  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.95})`; ctx.fill();

  ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`; ctx.fill();
}

function drawRemoteCursor(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string, alpha: number,
  isHovered: boolean,
  collabBoost: number,
) {
  const [cr, cg, cb] = hexToRgb(color);

  // ── Collaboration Zone boost — expanded glow when in a zone ──
  if (collabBoost > 0.05) {
    const boostAlpha = collabBoost * alpha;
    const boostRadius = 50 + collabBoost * 30;
    const breathe = 0.85 + 0.15 * Math.sin(performance.now() * 0.003);

    const collabGrad = ctx.createRadialGradient(x, y, 0, x, y, boostRadius * breathe);
    collabGrad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${boostAlpha * 0.2})`);
    collabGrad.addColorStop(0.3, `rgba(${cr}, ${cg}, ${cb}, ${boostAlpha * 0.1})`);
    collabGrad.addColorStop(0.6, `rgba(${cr}, ${cg}, ${cb}, ${boostAlpha * 0.03})`);
    collabGrad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
    ctx.beginPath();
    ctx.arc(x, y, boostRadius * breathe, 0, Math.PI * 2);
    ctx.fillStyle = collabGrad;
    ctx.fill();

    const ringAlpha = boostAlpha * 0.25 * breathe;
    ctx.beginPath();
    ctx.arc(x, y, 28 + collabBoost * 12, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${ringAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Hover highlight
  if (isHovered) {
    const breathe = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
    ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.5 * breathe})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 24 + breathe * 4, 0, Math.PI * 2); ctx.stroke();

    const hoverGrad = ctx.createRadialGradient(x, y, 0, x, y, 45);
    hoverGrad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.2})`);
    hoverGrad.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.06})`);
    hoverGrad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
    ctx.beginPath(); ctx.arc(x, y, 45, 0, Math.PI * 2); ctx.fillStyle = hoverGrad; ctx.fill();
  }

  // Outer ambient glow
  const outerGrad = ctx.createRadialGradient(x, y, 0, x, y, 35);
  outerGrad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.25})`);
  outerGrad.addColorStop(0.3, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.1})`);
  outerGrad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
  ctx.beginPath(); ctx.arc(x, y, 35, 0, Math.PI * 2); ctx.fillStyle = outerGrad; ctx.fill();

  // Mid glow ring
  const midGrad = ctx.createRadialGradient(x, y, 0, x, y, 12);
  midGrad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.6})`);
  midGrad.addColorStop(0.6, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.2})`);
  midGrad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
  ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fillStyle = midGrad; ctx.fill();

  // Core dot
  ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.9})`; ctx.fill();

  // White-hot center
  ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.75})`; ctx.fill();

  // Orbit ring indicator
  ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.2})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}
