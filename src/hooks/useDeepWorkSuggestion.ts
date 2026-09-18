import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { normalizeHrvScore, normalizeSleepScore } from '@/lib/bioSyncLogic';
import { getDeepWorkActive } from '@/components/layout/HUDOverlay';

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════ */
/*  DEEP WORK SUGGESTION ENGINE                                   */
/*                                                                */
/*  Evaluates biometric readiness each morning and surfaces a     */
/*  subtle HUD toast when conditions are optimal for deep focus.  */
/*                                                                */
/*  Trigger criteria (ALL must be met):                           */
/*    1. Sleep score ≥ 75 (last night)                            */
/*    2. Morning HRV ≥ 60ms (today's first reading or avg)       */
/*    3. Current hour is between 6 AM – 12 PM (morning window)   */
/*    4. User is NOT already in Deep Work mode                    */
/*    5. Suggestion not already dismissed today                   */
/*    6. Low caffeine intake (< 200mg so far today)              */
/*                                                                */
/*  When triggered, shows a toast suggesting Alpha Waves + Deep   */
/*  Work with a one-tap "Enter Focus" action.                     */
/* ══════════════════════════════════════════════════════════════ */

const DISMISS_KEY = 'vive-dw-suggest-dismissed';
const COOLDOWN_KEY = 'vive-dw-suggest-cooldown';

export interface DeepWorkSuggestion {
  shouldSuggest: boolean;
  sleepScore: number;
  hrvValue: number;
  caffeineLevel: number;
  confidence: 'high' | 'moderate' | 'low';
  message: string;
  detail: string;
}

function isDismissedToday(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    return localStorage.getItem(DISMISS_KEY) === today;
  } catch { return false; }
}

function dismissForToday(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(DISMISS_KEY, today);
  } catch { /* no-op */ }
}

function isInCooldown(): boolean {
  try {
    const ts = localStorage.getItem(COOLDOWN_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < 2 * 60 * 60 * 1000; // 2hr cooldown
  } catch { return false; }
}

function setCooldown(): void {
  try {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch { /* no-op */ }
}

function isMorningWindow(): boolean {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 12;
}

/** Normalize sleep score for suggestion threshold (reuse bioSync logic) */
function evalSleep(sleepScore: number | null, sleepHours: number | null): number {
  if (sleepScore != null) return sleepScore;
  if (sleepHours != null) return normalizeSleepScore(sleepHours);
  return 0;
}

/** Normalize HRV for suggestion threshold */
function evalHrv(hrvAvg: number | null, hrvCurrent: number | null): number {
  if (hrvCurrent != null && hrvCurrent > 0) return hrvCurrent;
  if (hrvAvg != null && hrvAvg > 0) return hrvAvg;
  return 0;
}

/** Build the suggestion message based on biometric strength */
function buildMessage(sleep: number, hrv: number, caffeine: number): { message: string; detail: string; confidence: DeepWorkSuggestion['confidence'] } {
  const sleepGood = sleep >= 75;
  const hrvGood = hrv >= 60;
  const caffeineGood = caffeine < 200;

  let confidence: DeepWorkSuggestion['confidence'] = 'low';
  if (sleepGood && hrvGood && caffeineGood) confidence = 'high';
  else if (sleepGood && hrvGood) confidence = 'moderate';

  if (confidence === 'high') {
    return {
      message: 'Peak readiness detected — enter Deep Work?',
      detail: `Sleep ${sleep}/100 · HRV ${hrv}ms · Alpha Waves recommended`,
      confidence,
    };
  }

  if (confidence === 'moderate') {
    return {
      message: 'Strong recovery — ideal for focused work',
      detail: `Sleep ${sleep}/100 · HRV ${hrv}ms · Try Alpha Waves for flow`,
      confidence,
    };
  }

  return {
    message: 'Good conditions for a focus session',
    detail: `Your biometrics support a productive morning`,
    confidence,
  };
}

export function useDeepWorkSuggestion(): {
  suggestion: DeepWorkSuggestion | null;
  dismiss: () => void;
  accept: () => void;
} {
  const [suggestion, setSuggestion] = useState<DeepWorkSuggestion | null>(null);
  const evaluatedRef = useRef(false);
  const sessionId = getTwinSessionId();

  // Pull today's vitals from the backend
  const vitals = useQuery(api.vitalsData.getVitalsTimeSeries, { sessionId });

  const dismiss = useCallback(() => {
    dismissForToday();
    setCooldown();
    setSuggestion(null);
  }, []);

  const accept = useCallback(() => {
    dismissForToday();
    setSuggestion(null);
    // The caller (index.tsx) will handle triggering Deep Work + Alpha Waves
  }, []);

  useEffect(() => {
    // Guard: only evaluate once per mount, during morning window
    if (evaluatedRef.current) return;
    if (!vitals || !vitals.hasData) return;
    if (!isMorningWindow()) return;
    if (isDismissedToday()) return;
    if (isInCooldown()) return;
    if (getDeepWorkActive()) return;

    evaluatedRef.current = true;

    // Extract today's data (last entry in dailyData array)
    const today = vitals.dailyData[vitals.dailyData.length - 1];
    const yesterday = vitals.dailyData.length >= 2
      ? vitals.dailyData[vitals.dailyData.length - 2]
      : null;

    // Sleep: prefer last night's score (yesterday's entry since sleep is logged for the night)
    const sleepData = yesterday || today;
    const sleepScore = evalSleep(sleepData?.sleepScore ?? null, sleepData?.sleepHours ?? null);

    // HRV: prefer today's average, fall back to bioVault current
    const hrvValue = evalHrv(
      today?.hrvAvg ?? null,
      vitals.bioVault?.hrvCurrent ?? null,
    );

    // Caffeine: today's total
    const caffeineLevel = vitals.caffeine?.todayTotal ?? 0;

    // Evaluate thresholds
    const sleepReady = sleepScore >= 75;
    const hrvReady = hrvValue >= 60;

    if (sleepReady && hrvReady) {
      const { message, detail, confidence } = buildMessage(sleepScore, hrvValue, caffeineLevel);

      // Delay the suggestion slightly so it doesn't compete with morning brief
      setTimeout(() => {
        // Re-check deep work state after delay
        if (getDeepWorkActive() || isDismissedToday()) return;

        setSuggestion({
          shouldSuggest: true,
          sleepScore,
          hrvValue,
          caffeineLevel,
          confidence,
          message,
          detail,
        });
      }, 6000); // 6s delay — after morning brief has had time to show
    }
  }, [vitals]);

  return { suggestion, dismiss, accept };
}

/* ── Re-export normalization helpers for external use ── */
export { normalizeSleepScore, normalizeHrvScore };
