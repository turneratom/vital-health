/**
 * Metric Highlight Event Bus
 * Emits events when the AI mentions specific metrics so dashboard cards can pulse.
 */

export type MetricHighlightEvent = {
  metric: string;
  color: string;
  timestamp: number;
};

type Listener = (event: MetricHighlightEvent) => void;

const listeners = new Set<Listener>();

export function onMetricHighlight(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitMetricHighlight(metric: string, color: string) {
  const event: MetricHighlightEvent = { metric, color, timestamp: Date.now() };
  listeners.forEach(fn => fn(event));
}

/* ── Metric detection map ── */
const METRIC_PATTERNS: { pattern: RegExp; metric: string; color: string }[] = [
  { pattern: /vitamin\s*d/i, metric: 'vitamin-d', color: '#FFD60A' },
  { pattern: /testosterone/i, metric: 'testosterone', color: '#BF5AF2' },
  { pattern: /ferritin/i, metric: 'ferritin', color: '#FF6B6B' },
  { pattern: /crp|c-reactive/i, metric: 'crp', color: '#FF453A' },
  { pattern: /hba1c|a1c|glycated/i, metric: 'hba1c', color: '#FF9500' },
  { pattern: /hrv|heart\s*rate\s*variability/i, metric: 'hrv', color: '#00F2FF' },
  { pattern: /resting\s*(hr|heart\s*rate)|rhr/i, metric: 'rhr', color: '#30D158' },
  { pattern: /sleep/i, metric: 'sleep', color: '#6366F1' },
  { pattern: /recovery/i, metric: 'recovery', color: '#34D399' },
  { pattern: /strain/i, metric: 'strain', color: '#FF9500' },
  { pattern: /vo2|oxygen/i, metric: 'vo2max', color: '#00FFCC' },
  { pattern: /readiness/i, metric: 'readiness', color: '#00F2FF' },
  { pattern: /calorie|kcal/i, metric: 'calories', color: '#FF9500' },
  { pattern: /protein/i, metric: 'protein', color: '#FF6B6B' },
  { pattern: /step/i, metric: 'steps', color: '#30D158' },
  { pattern: /magnesium/i, metric: 'magnesium', color: '#BF5AF2' },
  { pattern: /omega|fish\s*oil/i, metric: 'omega3', color: '#007AFF' },
  { pattern: /creatine/i, metric: 'creatine', color: '#FF2D55' },
  { pattern: /mthfr/i, metric: 'mthfr', color: '#BF5AF2' },
  { pattern: /apoe/i, metric: 'apoe4', color: '#FF453A' },
  { pattern: /caffeine/i, metric: 'caffeine', color: '#FFD60A' },
  { pattern: /vitality\s*score/i, metric: 'vitality', color: '#00FFCC' },
  { pattern: /deep\s*sleep/i, metric: 'deep-sleep', color: '#6366F1' },
  { pattern: /rem/i, metric: 'rem-sleep', color: '#818CF8' },
];

/**
 * Scan AI response text and emit highlight events for every mentioned metric.
 * Returns the list of detected metrics for the typewriter to schedule pulses.
 */
export function detectAndEmitMetrics(text: string): { metric: string; color: string; charIndex: number }[] {
  const found: { metric: string; color: string; charIndex: number }[] = [];
  const seen = new Set<string>();

  for (const { pattern, metric, color } of METRIC_PATTERNS) {
    const match = pattern.exec(text);
    if (match && !seen.has(metric)) {
      seen.add(metric);
      found.push({ metric, color, charIndex: match.index });
    }
  }

  return found.sort((a, b) => a.charIndex - b.charIndex);
}
