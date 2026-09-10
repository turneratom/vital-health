/* ══════════════════════════════════════════════════════════════════
   useCognitiveState — React hook for the Cognitive Load Sensor
   
   Provides the global cognitive state (Calm / Focused / Alert / Overload)
   to any UI component. When the state reaches 'overload', the UI
   auto-simplifies — hiding deep data tables and surfacing a single
   high-contrast "Rest & Recalibrate" command.
   
   Usage:
     const { state, score, isSimplified, dismiss, snapshot } = useCognitiveState();
     
     if (isSimplified) {
       return <RestRecalibrateCard onDismiss={dismiss} />;
     }
   ══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  cognitiveSensor,
  type CognitiveSnapshot,
  type CognitiveState,
} from '@/lib/CognitiveSensor';

export interface CognitiveHookResult {
  /** Current cognitive state label */
  state: CognitiveState;
  /** 0–100 composite score */
  score: number;
  /** True when score ≥ 75 and UI should auto-simplify */
  isSimplified: boolean;
  /** True when score ≥ 61 (alert or overload) */
  isElevated: boolean;
  /** User manually dismissed the simplification overlay */
  dismiss: () => void;
  /** Full snapshot with all metrics */
  snapshot: CognitiveSnapshot;
  /** Minutes in current session */
  sessionMinutes: number;
  /** Score trend direction */
  trending: 'rising' | 'stable' | 'falling';
  /** Reset the sensor (e.g., after a break) */
  reset: () => void;
}

const SIMPLIFY_THRESHOLD = 75;
const ELEVATED_THRESHOLD = 61;
// After user dismisses, suppress for 3 minutes
const DISMISS_COOLDOWN_MS = 3 * 60 * 1000;

export function useCognitiveState(): CognitiveHookResult {
  const [snapshot, setSnapshot] = useState<CognitiveSnapshot>(
    cognitiveSensor.getSnapshot()
  );
  const [dismissed, setDismissed] = useState(false);
  const dismissedAtRef = useRef<number>(0);

  useEffect(() => {
    // Start the sensor if not already running
    cognitiveSensor.start();

    const unsub = cognitiveSensor.subscribe((snap) => {
      setSnapshot(snap);

      // Auto-clear dismiss after cooldown
      if (dismissedAtRef.current > 0) {
        if (Date.now() - dismissedAtRef.current > DISMISS_COOLDOWN_MS) {
          setDismissed(false);
          dismissedAtRef.current = 0;
        }
      }

      // If score drops back to calm, clear dismiss state
      if (snap.score < 40 && dismissedAtRef.current > 0) {
        setDismissed(false);
        dismissedAtRef.current = 0;
      }
    });

    return unsub;
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    dismissedAtRef.current = Date.now();
  }, []);

  const reset = useCallback(() => {
    cognitiveSensor.reset();
    setDismissed(false);
    dismissedAtRef.current = 0;
  }, []);

  const isSimplified = !dismissed && snapshot.score >= SIMPLIFY_THRESHOLD;
  const isElevated = snapshot.score >= ELEVATED_THRESHOLD;

  return {
    state: snapshot.state,
    score: snapshot.score,
    isSimplified,
    isElevated,
    dismiss,
    snapshot,
    sessionMinutes: snapshot.sessionMinutes,
    trending: snapshot.trending,
    reset,
  };
}

/** Lightweight hook — just returns boolean for conditional rendering */
export function useIsSimplifiedMode(): boolean {
  const { isSimplified } = useCognitiveState();
  return isSimplified;
}
