/* ══════════════════════════════════════════════════════════════════
   COGNITIVE LOAD SENSOR — Vive 4.0 AI Brain Module
   
   Passively monitors user interaction patterns within the OS:
   • Click/tap frequency & acceleration
   • Scroll velocity & direction reversals
   • Input hesitation (time between keystrokes)
   • Navigation thrashing (rapid route changes)
   • Session duration fatigue curve
   
   Outputs a 0–100 "Cognitive Load Index" (CLI) that the UI
   consumes to decide when to auto-simplify the interface.
   
   Thresholds:
     0–30  → CALM      (full data density, all panels visible)
     31–60 → FOCUSED   (normal mode, subtle de-emphasis of tertiary data)
     61–80 → ALERT     (elevated — hide deep tables, surface summaries)
     81–100→ OVERLOAD  (auto-simplify — single "Rest & Recalibrate" command)
   ══════════════════════════════════════════════════════════════════ */

export type CognitiveState = 'calm' | 'focused' | 'alert' | 'overload';

export interface CognitiveSnapshot {
  /** 0–100 composite index */
  score: number;
  state: CognitiveState;
  /** Interactions per second (rolling 10s window) */
  interactionRate: number;
  /** Scroll direction reversals in last 15s */
  scrollReversals: number;
  /** Rapid navigation changes in last 30s */
  navThrashing: number;
  /** Minutes since session start */
  sessionMinutes: number;
  /** Whether the score is trending up (worsening) */
  trending: 'rising' | 'stable' | 'falling';
  /** Timestamp of last computation */
  computedAt: number;
}

type InteractionEvent = {
  type: 'click' | 'scroll' | 'key' | 'nav' | 'touch';
  ts: number;
  meta?: number; // scroll direction: 1=down, -1=up
};

type Listener = (snapshot: CognitiveSnapshot) => void;

const WINDOW_MS = 10_000;       // 10s rolling window for interaction rate
const SCROLL_WINDOW_MS = 15_000; // 15s for scroll reversal detection
const NAV_WINDOW_MS = 30_000;    // 30s for nav thrashing
const COMPUTE_INTERVAL = 2_000;  // recompute every 2s
const HISTORY_SIZE = 500;        // max events in buffer
const FATIGUE_ONSET_MIN = 25;    // fatigue curve starts at 25 min
const SCORE_SMOOTHING = 0.35;    // EMA smoothing factor (lower = smoother)

class CognitiveSensorEngine {
  private events: InteractionEvent[] = [];
  private listeners = new Set<Listener>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private sessionStart: number = Date.now();
  private lastScore: number = 0;
  private lastSnapshot: CognitiveSnapshot | null = null;
  private scoreHistory: number[] = [];
  private attached = false;

  /** Start monitoring — call once at app boot */
  start() {
    if (this.attached) return;
    this.attached = true;
    this.sessionStart = Date.now();
    this.events = [];
    this.lastScore = 0;
    this.scoreHistory = [];

    // Passive event listeners (capture phase, non-blocking)
    window.addEventListener('click', this.onClick, { capture: true, passive: true });
    window.addEventListener('pointerdown', this.onTouch, { capture: true, passive: true });
    window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    window.addEventListener('keydown', this.onKey, { capture: true, passive: true });

    // Compute loop
    this.intervalId = setInterval(() => this.compute(), COMPUTE_INTERVAL);
  }

  /** Stop monitoring — cleanup */
  stop() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('click', this.onClick, { capture: true });
    window.removeEventListener('pointerdown', this.onTouch, { capture: true });
    window.removeEventListener('scroll', this.onScroll, { capture: true });
    window.removeEventListener('keydown', this.onKey, { capture: true });
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Record a navigation event (call from router) */
  recordNavigation() {
    this.pushEvent({ type: 'nav', ts: Date.now() });
  }

  /** Subscribe to cognitive state changes */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    // Immediately emit current state
    if (this.lastSnapshot) fn(this.lastSnapshot);
    return () => { this.listeners.delete(fn); };
  }

  /** Get current snapshot without subscribing */
  getSnapshot(): CognitiveSnapshot {
    return this.lastSnapshot ?? {
      score: 0,
      state: 'calm',
      interactionRate: 0,
      scrollReversals: 0,
      navThrashing: 0,
      sessionMinutes: 0,
      trending: 'stable',
      computedAt: Date.now(),
    };
  }

  /** Force a manual reset (e.g., after user takes a break) */
  reset() {
    this.events = [];
    this.lastScore = 0;
    this.scoreHistory = [];
    this.sessionStart = Date.now();
    this.compute();
  }

  // ── Private event handlers ──

  private onClick = () => {
    this.pushEvent({ type: 'click', ts: Date.now() });
  };

  private onTouch = () => {
    this.pushEvent({ type: 'touch', ts: Date.now() });
  };

  private lastScrollDir: number = 0;
  private onScroll = () => {
    // Detect scroll direction from window
    const dir = 1; // simplified — we track reversals via rapid scroll events
    this.pushEvent({ type: 'scroll', ts: Date.now(), meta: dir });
  };

  private onKey = () => {
    this.pushEvent({ type: 'key', ts: Date.now() });
  };

  private pushEvent(evt: InteractionEvent) {
    this.events.push(evt);
    // Trim buffer
    if (this.events.length > HISTORY_SIZE) {
      this.events = this.events.slice(-HISTORY_SIZE);
    }
  }

  // ── Core computation ──

  private compute() {
    const now = Date.now();
    const sessionMin = (now - this.sessionStart) / 60_000;

    // 1. Interaction rate (events per second in rolling window)
    const windowStart = now - WINDOW_MS;
    const recentEvents = this.events.filter(e => e.ts >= windowStart);
    const interactionRate = recentEvents.length / (WINDOW_MS / 1000);

    // 2. Scroll reversals (rapid scroll direction changes)
    const scrollWindowStart = now - SCROLL_WINDOW_MS;
    const scrollEvents = this.events.filter(e => e.type === 'scroll' && e.ts >= scrollWindowStart);
    let scrollReversals = 0;
    // Count clusters of rapid scroll events (>3 per second = frantic)
    const scrollBuckets = new Map<number, number>();
    for (const se of scrollEvents) {
      const bucket = Math.floor(se.ts / 1000);
      scrollBuckets.set(bucket, (scrollBuckets.get(bucket) || 0) + 1);
    }
    for (const count of scrollBuckets.values()) {
      if (count > 4) scrollReversals++;
    }

    // 3. Navigation thrashing
    const navWindowStart = now - NAV_WINDOW_MS;
    const navEvents = this.events.filter(e => e.type === 'nav' && e.ts >= navWindowStart);
    const navThrashing = navEvents.length;

    // 4. Click acceleration (are clicks speeding up?)
    const clickEvents = recentEvents.filter(e => e.type === 'click' || e.type === 'touch');
    let clickAcceleration = 0;
    if (clickEvents.length >= 3) {
      const intervals: number[] = [];
      for (let i = 1; i < clickEvents.length; i++) {
        intervals.push(clickEvents[i].ts - clickEvents[i - 1].ts);
      }
      const avgFirst = intervals.slice(0, Math.floor(intervals.length / 2))
        .reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(intervals.length / 2));
      const avgSecond = intervals.slice(Math.floor(intervals.length / 2))
        .reduce((a, b) => a + b, 0) / Math.max(1, intervals.length - Math.floor(intervals.length / 2));
      // If second half intervals are shorter, clicks are accelerating
      if (avgFirst > 0 && avgSecond > 0) {
        clickAcceleration = Math.max(0, (avgFirst - avgSecond) / avgFirst);
      }
    }

    // 5. Session fatigue curve
    const fatigueFactor = sessionMin > FATIGUE_ONSET_MIN
      ? Math.min(1, (sessionMin - FATIGUE_ONSET_MIN) / 60) * 15
      : 0;

    // ── Composite score ──
    // Weights: interaction rate (35%), scroll chaos (20%), nav thrashing (20%), 
    //          click acceleration (15%), fatigue (10%)
    const rateScore = Math.min(40, interactionRate * 8);        // 0–40 (5 events/s = 40)
    const scrollScore = Math.min(20, scrollReversals * 5);      // 0–20
    const navScore = Math.min(20, navThrashing * 4);            // 0–20 (5 nav changes = 20)
    const accelScore = clickAcceleration * 15;                  // 0–15
    const fatigueScore = fatigueFactor;                         // 0–15

    const rawScore = Math.min(100, rateScore + scrollScore + navScore + accelScore + fatigueScore);

    // EMA smoothing to prevent jitter
    const smoothedScore = this.lastScore === 0
      ? rawScore
      : this.lastScore * (1 - SCORE_SMOOTHING) + rawScore * SCORE_SMOOTHING;

    this.lastScore = smoothedScore;

    // Track score history for trend detection
    this.scoreHistory.push(smoothedScore);
    if (this.scoreHistory.length > 15) this.scoreHistory.shift();

    // Trend detection
    let trending: CognitiveSnapshot['trending'] = 'stable';
    if (this.scoreHistory.length >= 5) {
      const recent5 = this.scoreHistory.slice(-5);
      const older5 = this.scoreHistory.slice(-10, -5);
      if (older5.length >= 3) {
        const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
        const olderAvg = older5.reduce((a, b) => a + b, 0) / older5.length;
        const delta = recentAvg - olderAvg;
        if (delta > 5) trending = 'rising';
        else if (delta < -5) trending = 'falling';
      }
    }

    // Map score to state
    const state: CognitiveState = smoothedScore <= 30
      ? 'calm'
      : smoothedScore <= 60
        ? 'focused'
        : smoothedScore <= 80
          ? 'alert'
          : 'overload';

    const snapshot: CognitiveSnapshot = {
      score: Math.round(smoothedScore),
      state,
      interactionRate: Math.round(interactionRate * 10) / 10,
      scrollReversals,
      navThrashing,
      sessionMinutes: Math.round(sessionMin),
      trending,
      computedAt: now,
    };

    this.lastSnapshot = snapshot;
    this.listeners.forEach(fn => fn(snapshot));
  }
}

// ── Singleton export ──
export const cognitiveSensor = new CognitiveSensorEngine();
