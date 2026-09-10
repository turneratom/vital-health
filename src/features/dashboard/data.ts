/* ── Dashboard Static Data & Generators ── */

/** Generate sparkline data with random walk */
export function genSpark(base: number, variance: number, len = 24): number[] {
  const d: number[] = [];
  let v = base;
  for (let i = 0; i < len; i++) {
    v += (Math.random() - 0.48) * variance;
    v = Math.max(base - variance * 3, Math.min(base + variance * 3, v));
    d.push(v);
  }
  return d;
}

/** Get stress color based on level */
export function getStressColor(stress: number): string {
  if (stress < 40) return '#00ffaa';
  if (stress < 70) return '#ffaa00';
  return '#ff4444';
}

/** Get stress label */
export function getStressLabel(stress: number): string {
  if (stress < 40) return 'LOW';
  if (stress < 70) return 'MOD';
  return 'HIGH';
}

/** Get recovery color */
export function getRecoveryColor(recovery: number): string {
  if (recovery >= 75) return '#00ffaa';
  if (recovery >= 50) return '#ffaa00';
  return '#ff4444';
}

/** Get time-based greeting */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Format current time */
export function getTimeStr(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
