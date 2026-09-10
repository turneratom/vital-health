import { useEffect, useRef, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════
   AUTO-FOCUS ENGINE
   
   Detects two focus triggers:
   1. Steady mouse pace — consistent velocity for 3+ seconds
   2. Dwell detection — mouse stays within a data panel for 10+ seconds
   
   When triggered, dispatches 'vive-auto-focus' event that dims all
   non-focused UI elements and remote peers on the FluidCanvas.
   ══════════════════════════════════════════════════════════════ */

export interface AutoFocusState {
  active: boolean;
  targetRect: DOMRect | null;
  targetId: string | null;
  intensity: number; // 0–1 dimming intensity
}

// ── Global focus state accessible from canvas render loop ──
let _autoFocusState: AutoFocusState = {
  active: false,
  targetRect: null,
  targetId: null,
  intensity: 0,
};

export function getAutoFocusState(): AutoFocusState {
  return _autoFocusState;
}

// Smoothly animated intensity for canvas consumption
let _animatedIntensity = 0;
export function getAutoFocusIntensity(): number {
  return _animatedIntensity;
}

// ── Data panel selectors that qualify as focus targets ──
const FOCUS_PANEL_SELECTORS = [
  '.vive-card',
  '.vive-card-glow',
  '[data-focus-panel]',
  '[class*="GlassPanel"]',
  '.glass-panel',
];

const DWELL_THRESHOLD_MS = 10_000;    // 10 seconds to trigger focus
const STEADY_PACE_THRESHOLD_MS = 3000; // 3 seconds of steady movement
const VELOCITY_TOLERANCE = 0.35;       // 35% velocity variance = "steady"
const MIN_VELOCITY = 0.5;             // px/frame minimum to count as moving
const MAX_VELOCITY = 8;               // px/frame max — too fast = scanning
const FADE_IN_SPEED = 0.025;          // intensity ramp-up per frame
const FADE_OUT_SPEED = 0.04;          // intensity ramp-down per frame
const EXIT_DELAY_MS = 1500;           // grace period before unfocusing

export function useAutoFocus(enabled: boolean = true) {
  const mouseRef = useRef({ x: 0, y: 0, timestamp: 0 });
  const velocityHistoryRef = useRef<number[]>([]);
  const dwellStartRef = useRef<number>(0);
  const dwellPanelRef = useRef<Element | null>(null);
  const focusActiveRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number>(0);

  // Find the nearest focus-eligible panel under the cursor
  const findFocusPanel = useCallback((x: number, y: number): Element | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    
    for (const selector of FOCUS_PANEL_SELECTORS) {
      const panel = el.closest(selector);
      if (panel) return panel;
    }
    return null;
  }, []);

  // Activate focus mode
  const activateFocus = useCallback((panel: Element | null) => {
    if (focusActiveRef.current) return;
    focusActiveRef.current = true;

    const rect = panel?.getBoundingClientRect() ?? null;
    const id = panel?.getAttribute('data-focus-panel') || 
               panel?.getAttribute('id') || 
               (panel ? `panel-${Math.round(rect?.x ?? 0)}-${Math.round(rect?.y ?? 0)}` : null);

    _autoFocusState = {
      active: true,
      targetRect: rect,
      targetId: id,
      intensity: 0, // will ramp up smoothly
    };

    window.dispatchEvent(new CustomEvent('vive-auto-focus', {
      detail: { active: true, targetRect: rect, targetId: id },
    }));
  }, []);

  // Deactivate focus mode
  const deactivateFocus = useCallback(() => {
    if (!focusActiveRef.current) return;
    focusActiveRef.current = false;

    _autoFocusState = {
      ..._autoFocusState,
      active: false,
    };

    window.dispatchEvent(new CustomEvent('vive-auto-focus', {
      detail: { active: false, targetRect: null, targetId: null },
    }));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const prev = mouseRef.current;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const dt = now - prev.timestamp;

      if (dt > 0 && prev.timestamp > 0) {
        const velocity = Math.sqrt(dx * dx + dy * dy) / (dt / 16.67); // normalize to ~60fps
        const history = velocityHistoryRef.current;
        history.push(velocity);
        if (history.length > 60) history.shift(); // ~1 second at 60fps

        // ── Steady pace detection ──
        if (history.length >= 30) {
          const recent = history.slice(-30);
          const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
          
          if (avg >= MIN_VELOCITY && avg <= MAX_VELOCITY) {
            const variance = recent.reduce((s, v) => s + Math.abs(v - avg), 0) / recent.length;
            const normalizedVariance = avg > 0 ? variance / avg : 1;
            
            if (normalizedVariance < VELOCITY_TOLERANCE) {
              // Steady pace detected — check duration
              const steadyDuration = history.length * 16.67;
              if (steadyDuration >= STEADY_PACE_THRESHOLD_MS) {
                const panel = findFocusPanel(e.clientX, e.clientY);
                if (panel) {
                  activateFocus(panel);
                  // Clear exit timer if re-entering focus
                  if (exitTimerRef.current) {
                    clearTimeout(exitTimerRef.current);
                    exitTimerRef.current = null;
                  }
                }
              }
            }
          }
        }
      }

      // ── Dwell detection ──
      const currentPanel = findFocusPanel(e.clientX, e.clientY);
      if (currentPanel && currentPanel === dwellPanelRef.current) {
        // Still on same panel — check dwell time
        if (now - dwellStartRef.current >= DWELL_THRESHOLD_MS) {
          activateFocus(currentPanel);
          if (exitTimerRef.current) {
            clearTimeout(exitTimerRef.current);
            exitTimerRef.current = null;
          }
        }
      } else {
        // Moved to different panel — reset dwell
        dwellPanelRef.current = currentPanel;
        dwellStartRef.current = now;

        // If focus was active and we left the panel, start exit timer
        if (focusActiveRef.current && !currentPanel) {
          if (!exitTimerRef.current) {
            exitTimerRef.current = setTimeout(() => {
              deactivateFocus();
              exitTimerRef.current = null;
            }, EXIT_DELAY_MS);
          }
        } else if (exitTimerRef.current && currentPanel) {
          // Re-entered a panel — cancel exit
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
      }

      // Fast/erratic movement breaks focus
      if (dt > 0) {
        const instantVelocity = Math.sqrt(dx * dx + dy * dy) / (dt / 16.67);
        if (instantVelocity > MAX_VELOCITY * 2.5 && focusActiveRef.current) {
          velocityHistoryRef.current = [];
          if (!exitTimerRef.current) {
            exitTimerRef.current = setTimeout(() => {
              deactivateFocus();
              exitTimerRef.current = null;
            }, 600);
          }
        }
      }

      mouseRef.current = { x: e.clientX, y: e.clientY, timestamp: now };
    };

    // ── Smooth intensity animation loop ──
    const animateIntensity = () => {
      const target = _autoFocusState.active ? 1 : 0;
      if (_animatedIntensity < target) {
        _animatedIntensity = Math.min(1, _animatedIntensity + FADE_IN_SPEED);
      } else if (_animatedIntensity > target) {
        _animatedIntensity = Math.max(0, _animatedIntensity - FADE_OUT_SPEED);
      }
      _autoFocusState.intensity = _animatedIntensity;
      rafRef.current = requestAnimationFrame(animateIntensity);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(animateIntensity);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      _autoFocusState = { active: false, targetRect: null, targetId: null, intensity: 0 };
      _animatedIntensity = 0;
    };
  }, [enabled, findFocusPanel, activateFocus, deactivateFocus]);

  return {
    isAutoFocused: focusActiveRef.current,
    breakFocus: deactivateFocus,
  };
}
