/* ═══════════════════════════════════════════════════════════════
   SESSION SHIELD — Persistent State Recovery
   
   Saves viewport position (pan/zoom) and active ProtocolTimer
   state to localStorage. On return:
   • FluidCanvas restores last known pan + zoom
   • ProtocolTimer resumes with elapsed time subtracted
   ═══════════════════════════════════════════════════════════════ */

const VIEWPORT_KEY = 'vive-session-viewport';
const TIMER_KEY = 'vive-session-timer';

/* ── Viewport State ── */
export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  savedAt: number;
}

export function saveViewport(state: ViewportState): void {
  try {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(state));
  } catch { /* quota or private browsing */ }
}

export function loadViewport(): ViewportState | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewportState;
    // Expire after 24 hours
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(VIEWPORT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearViewport(): void {
  try { localStorage.removeItem(VIEWPORT_KEY); } catch { /* no-op */ }
}

/* ── Timer State ── */
export interface TimerState {
  protocolId: string;
  protocolName: string;
  icon: string;
  category: string;
  /** Total duration of the protocol in seconds */
  totalDuration: number;
  /** Seconds remaining when the timer was last persisted */
  remainingAtSave: number;
  /** Whether the timer was paused */
  isPaused: boolean;
  /** Timestamp (ms) when this snapshot was saved */
  savedAt: number;
  /** The sessionId that owns this timer */
  sessionId: string;
}

export function saveTimer(state: TimerState): void {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(state));
  } catch { /* quota or private browsing */ }
}

export function loadTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TimerState;
    // Expire after 24 hours — no point resuming a stale timer
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(TIMER_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearTimer(): void {
  try { localStorage.removeItem(TIMER_KEY); } catch { /* no-op */ }
}

/**
 * Calculate the adjusted remaining seconds for a resumed timer.
 * If the timer was running (not paused), subtract the wall-clock
 * time that elapsed since the tab was closed.
 */
export function getResumedRemaining(saved: TimerState): number {
  if (saved.isPaused) {
    // Timer was paused — no time elapsed
    return Math.max(0, saved.remainingAtSave);
  }
  const elapsedSinceClose = Math.floor((Date.now() - saved.savedAt) / 1000);
  const adjusted = saved.remainingAtSave - elapsedSinceClose;
  return Math.max(0, adjusted);
}
