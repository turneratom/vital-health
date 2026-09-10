import { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { getTwinSessionId } from '@/lib/twinSession';
import type { VitalsState } from '../types';

/**
 * Vitals for dashboard widgets.
 * Prefers manual / twin-session entries from Convex (quickLog.getLatestVitals).
 * Falls back to clearly-simulated local walk only when nothing is logged yet.
 */
export function useSimulatedVitals(): VitalsState & { source: 'manual' | 'simulated' } {
  const sessionId = useMemo(() => getTwinSessionId(), []);
  const latest = useQuery(api.quickLog.getLatestVitals, sessionId ? { sessionId } : 'skip');

  const [hr, setHr] = useState(68);
  const [spo2, setSpo2] = useState(97);
  const [stress, setStress] = useState(28);
  const [recovery, setRecovery] = useState(82);

  const hasManual =
    !!latest &&
    (!!latest.hr || !!latest.hrv || !!latest.spo2 || !!latest.sleepHours || !!latest.steps);

  useEffect(() => {
    if (hasManual) return;
    const iv = setInterval(() => {
      setHr((p) => Math.max(55, Math.min(105, p + (Math.random() - 0.48) * 3)));
      setSpo2((p) => Math.max(95, Math.min(100, p + (Math.random() - 0.5) * 0.4)));
      setStress((p) => Math.max(8, Math.min(85, p + (Math.random() - 0.5) * 4)));
      setRecovery((p) => Math.max(40, Math.min(100, p + (Math.random() - 0.5) * 2)));
    }, 3000);
    return () => clearInterval(iv);
  }, [hasManual]);

  if (hasManual) {
    return {
      hr: Math.round(latest?.hr?.value ?? hr),
      spo2: Math.round(latest?.spo2?.value ?? spo2),
      // stress/recovery not in manual schema — keep soft placeholders, not wearable claims
      stress: Math.round(stress),
      recovery: Math.round(recovery),
      source: 'manual',
    };
  }

  return {
    hr: Math.round(hr),
    spo2: Math.round(spo2),
    stress: Math.round(stress),
    recovery: Math.round(recovery),
    source: 'simulated',
  };
}
