import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useState, useEffect, useCallback, useRef } from 'react';

export interface BioPing {
  id: string;
  category: "opportunity" | "recovery" | "nutrition" | "supplement" | "momentum" | "circadian";
  icon: string;
  message: string;
  subtext: string;
  urgency: "whisper" | "nudge" | "alert";
  accentColor: string;
  actionLabel?: string;
  actionType?: string;
  expiresAt: number;
  generatedAt: number;
}

export function useBioPings() {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user';

  const data = useQuery(api.bioPings.getProactivePings, { sessionId });
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('vive-dismissed-pings');
      if (stored) {
        const parsed = JSON.parse(stored) as { ids: string[]; ts: number };
        if (Date.now() - parsed.ts < 4 * 60 * 60 * 1000) {
          return new Set(parsed.ids);
        }
      }
    } catch {}
    return new Set<string>();
  });

  const [activePing, setActivePing] = useState<BioPing | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const queueRef = useRef<BioPing[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((id: string) => {
    setIsVisible(false);
    setTimeout(() => setActivePing(null), 400);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('vive-dismissed-pings', JSON.stringify({ ids: Array.from(next), ts: Date.now() }));
      } catch {}
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    if (activePing) dismiss(activePing.id);
    queueRef.current = [];
  }, [activePing, dismiss]);

  // Update queue when data changes
  useEffect(() => {
    if (!data?.pings) return;
    const now = Date.now();
    const fresh = data.pings.filter(
      (p) => !dismissedIds.has(p.id) && p.expiresAt > now
    );
    queueRef.current = fresh;
  }, [data, dismissedIds]);

  // Show next ping from queue with haptic bounce event
  useEffect(() => {
    if (activePing || queueRef.current.length === 0) return;

    // Stagger: show first ping after 3s, subsequent after 20s
    const delay = isVisible ? 20000 : 3000;
    showTimerRef.current = setTimeout(() => {
      const next = queueRef.current.shift();
      if (next) {
        setActivePing(next);
        setIsVisible(true);

        // Emit haptic bounce event for UI animations
        try {
          window.dispatchEvent(new CustomEvent('vive-bio-ping', {
            detail: { id: next.id, urgency: next.urgency, category: next.category },
          }));
        } catch {}

        // Auto-dismiss whispers after 12s, nudges after 20s, alerts stay
        const autoDismissMs = next.urgency === 'whisper' ? 12000 : next.urgency === 'nudge' ? 20000 : 0;
        if (autoDismissMs > 0) {
          timerRef.current = setTimeout(() => dismiss(next.id), autoDismissMs);
        }
      }
    }, delay);

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, [activePing, isVisible, dismiss]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    };
  }, []);

  return {
    activePing,
    isVisible,
    dismiss,
    dismissAll,
    totalPings: data?.pings?.filter((p) => !dismissedIds.has(p.id)).length ?? 0,
    dataSignals: data?.dataSignals ?? 0,
  };
}
