import { useRef, useCallback, useEffect, useState } from 'react';
import { getTwinSessionId } from '@/lib/twinSession';

export interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
}

// ── Global ghost mode state ──
let _ghostMode = false;
const _ghostListeners = new Set<(v: boolean) => void>();

export function getGlobalGhostMode() { return _ghostMode; }

export function setGlobalGhostMode(v: boolean) {
  _ghostMode = v;
  _ghostListeners.forEach((fn) => fn(v));
}

export function useGhostMode() {
  const [gm, setGm] = useState(_ghostMode);
  useEffect(() => {
    setGm(_ghostMode);
    _ghostListeners.add(setGm);
    return () => { _ghostListeners.delete(setGm); };
  }, []);
  return gm;
}

// ── Global presence coordinates (for proximity glow) ──
let _currentX = 0;
let _currentY = 0;
let _isActive = false;
const _posListeners = new Set<() => void>();

function notifyPos() { _posListeners.forEach((fn) => fn()); }

// ── Session ID — prefer bound twin session (auth user:<id> or guest UUID) ──
export function getSessionId() {
  try {
    return getTwinSessionId();
  } catch {
    return typeof crypto !== 'undefined'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
}

// ── Convex broadcast callback ──
let _broadcastFn: ((x: number, y: number, ghost: boolean) => void) | null = null;

export function setPresenceBroadcast(fn: ((x: number, y: number, ghost: boolean) => void) | null) {
  _broadcastFn = fn;
}

// ── LERP config ──
const LERP = 0.08;
const MAX_TRAIL = 80;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Core presence hook — tracks mouse/touch with lerp smoothing.
 * Broadcasts position to Convex via setPresenceBroadcast callback.
 * Only ONE instance should drive the animation loop (the index route).
 */
export function usePresenceState() {
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: _currentX, y: _currentY });
  const trailRef = useRef<TrailPoint[]>([]);
  const rafRef = useRef(0);
  const broadcastTimerRef = useRef(0);

  const [state, setState] = useState({
    currentX: 0,
    currentY: 0,
    trail: [] as TrailPoint[],
    isActive: false,
  });

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const pt = 'touches' in e ? e.touches[0] : e;
      if (pt) {
        targetRef.current = { x: pt.clientX, y: pt.clientY };
        if (!_isActive) {
          _isActive = true;
        }
      }
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('touchmove', handleMove, { passive: true });

    let lastFrame = 0;

    const animate = (time: number) => {
      rafRef.current = requestAnimationFrame(animate);

      // ~60fps
      if (time - lastFrame < 14) return;
      lastFrame = time;

      const prev = currentRef.current;
      const target = targetRef.current;
      const nx = lerp(prev.x, target.x, LERP);
      const ny = lerp(prev.y, target.y, LERP);
      currentRef.current = { x: nx, y: ny };

      // Update globals for proximity glow
      _currentX = nx;
      _currentY = ny;
      notifyPos();

      const dx = nx - prev.x;
      const dy = ny - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.5) {
        trailRef.current.push({ x: nx, y: ny, timestamp: performance.now() });
        if (trailRef.current.length > MAX_TRAIL) {
          trailRef.current = trailRef.current.slice(-MAX_TRAIL);
        }
      }

      // Broadcast to Convex at ~10fps (every 100ms)
      const now = Date.now();
      if (_broadcastFn && now - broadcastTimerRef.current > 100) {
        broadcastTimerRef.current = now;
        _broadcastFn(nx, ny, _ghostMode);
      }

      setState({
        currentX: nx,
        currentY: ny,
        trail: [...trailRef.current],
        isActive: _isActive,
      });
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
    };
  }, []);

  return state;
}

/**
 * Lightweight hook for proximity glow — reads global position without
 * running its own animation loop. Subscribes to position updates.
 */
export function usePresencePosition() {
  const [pos, setPos] = useState({ currentX: _currentX, currentY: _currentY, isActive: _isActive });

  useEffect(() => {
    const update = () => {
      setPos({ currentX: _currentX, currentY: _currentY, isActive: _isActive });
    };
    _posListeners.add(update);
    return () => { _posListeners.delete(update); };
  }, []);

  return pos;
}
