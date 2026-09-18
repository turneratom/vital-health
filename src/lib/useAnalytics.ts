import { useCallback, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getGlobalGhostMode } from '../components/Presence/usePresenceState';

import { getTwinSessionId } from '@/lib/twinSession'
/**
 * Scrub personal metadata from analytics payloads when ghost mode is active.
 * Removes names, emails, IDs, and any PII-like fields from JSON metadata strings.
 */
function scrubMetadata(metadata: string | undefined, isGhost: boolean): string | undefined {
  if (!metadata || !isGhost) return metadata;
  try {
    const parsed = JSON.parse(metadata);
    const scrubbed: Record<string, unknown> = {};
    const piiKeys = new Set([
      'name', 'email', 'userId', 'user_id', 'userName', 'user_name',
      'firstName', 'lastName', 'first_name', 'last_name', 'phone',
      'address', 'ip', 'ipAddress', 'ip_address', 'avatar', 'avatarUrl',
      'profileUrl', 'profile_url', 'displayName', 'display_name',
      'location', 'device_id', 'deviceId', 'device_name', 'deviceName',
      'geo', 'lat', 'lng', 'latitude', 'longitude', 'city', 'region',
      'country', 'timezone', 'userAgent', 'user_agent', 'fingerprint',
    ]);
    for (const [key, value] of Object.entries(parsed)) {
      if (piiKeys.has(key)) {
        scrubbed[key] = '[redacted]';
      } else if (typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        // Scrub anything that looks like an email address
        scrubbed[key] = '[redacted_email]';
      } else {
        scrubbed[key] = value;
      }
    }
    return JSON.stringify(scrubbed);
  } catch {
    // If metadata isn't valid JSON, redact entirely in ghost mode
    return '[redacted]';
  }
}

/**
 * Analytics hook for tracking user behavior signals:
 * - info_click: Info icon taps on data charts
 * - plan_completion: Today's Plan protocol completions
 * - nav_hesitation: Hover > 3s on ActionHub button without clicking (label confusion signal)
 * - quick_back: Back button pressed within 5s of entering a view (wrong-destination signal)
 *
 * 🔒 Ghost Mode Integration:
 * When ghostMode is active (from usePresenceState), all tracking calls are intercepted:
 * - sessionId is replaced with 'anonymous_ghost'
 * - All personal metadata (names, emails, IDs) is scrubbed before sending
 * - Events still fire (for aggregate UX insights) but are fully anonymized
 */
export function useAnalytics() {
  let trackEvent: ReturnType<typeof useMutation> | null = null;
  try {
    trackEvent = useMutation(api.mutations.trackAnalyticsEvent);
  } catch {
    // Convex not connected
  }

  const lastEventRef = useRef<Record<string, number>>({});

  /**
   * Get session ID — returns 'anonymous_ghost' when ghost mode is active,
   * otherwise returns the real session ID.
   */
  const getSessionId = useCallback(() => {
    if (getGlobalGhostMode()) return 'anonymous_ghost';
    if (typeof window === 'undefined') return 'default';
    return getTwinSessionId();
  }, []);

  /**
   * Privacy-aware event dispatcher. Intercepts all events when ghost mode
   * is active to anonymize session and scrub PII from metadata.
   *
   * Ghost Mode strips:
   * - sessionId → 'anonymous_ghost'
   * - userId / location / device_id → 'anon_session' in metadata
   * - All PII fields (names, emails, geo, fingerprints) → '[redacted]'
   */
  const dispatchEvent = useCallback((
    eventType: string,
    eventKey: string,
    metadata?: string,
  ) => {
    if (!trackEvent) return;

    const isGhost = getGlobalGhostMode();

    // In ghost mode, inject anonymized identity fields into metadata
    // so any downstream consumer sees 'anon_session' instead of real values
    let finalMetadata = metadata;
    if (isGhost) {
      try {
        const parsed = metadata ? JSON.parse(metadata) : {};
        // Force-replace identity fields with anon_session
        parsed.userId = 'anon_session';
        parsed.location = 'anon_session';
        parsed.device_id = 'anon_session';
        finalMetadata = JSON.stringify(parsed);
      } catch {
        finalMetadata = JSON.stringify({
          userId: 'anon_session',
          location: 'anon_session',
          device_id: 'anon_session',
        });
      }
    }

    trackEvent({
      sessionId: isGhost ? 'anonymous_ghost' : getTwinSessionId(),
      eventType,
      eventKey,
      metadata: scrubMetadata(finalMetadata, isGhost),
    }).catch(() => {});
  }, [trackEvent, getSessionId]);

  /**
   * Track an info icon click on a data chart.
   */
  const trackInfoClick = useCallback((chartKey: string, metadata?: string) => {
    const now = Date.now();
    const key = `info_click:${chartKey}`;
    if (lastEventRef.current[key] && now - lastEventRef.current[key] < 2000) return;
    lastEventRef.current[key] = now;

    dispatchEvent('info_click', chartKey, metadata);
  }, [dispatchEvent]);

  /**
   * Track Today's Plan completion status.
   */
  const trackPlanCompletion = useCallback((completedCount: number, totalCount: number) => {
    const now = Date.now();
    const key = `plan_completion:${completedCount}/${totalCount}`;
    if (lastEventRef.current[key] && now - lastEventRef.current[key] < 10000) return;
    lastEventRef.current[key] = now;

    const eventKey = completedCount === totalCount ? 'all_complete' : 'partial';
    dispatchEvent('plan_completion', eventKey, JSON.stringify({ completed: completedCount, total: totalCount }));
  }, [dispatchEvent]);

  /**
   * Track navigation hesitation — user hovered over an ActionHub button
   * for more than 3 seconds without clicking. Signals label confusion.
   * @param buttonId - The action button id (e.g., "food", "vitals")
   * @param buttonLabel - The human-readable label shown on the button
   */
  const trackNavHesitation = useCallback((buttonId: string, buttonLabel: string) => {
    const now = Date.now();
    const key = `nav_hesitation:${buttonId}`;
    // Debounce: ignore if same button hesitation within 30 seconds
    if (lastEventRef.current[key] && now - lastEventRef.current[key] < 30000) return;
    lastEventRef.current[key] = now;

    dispatchEvent('nav_hesitation', buttonId, JSON.stringify({ label: buttonLabel, hoveredMs: 3000 }));
  }, [dispatchEvent]);

  /**
   * Track quick back — user pressed Back within 5 seconds of entering a view.
   * Signals the user navigated to the wrong destination (label/icon mismatch).
   * @param viewId - The view they left quickly (e.g., "vitals", "activity")
   * @param durationMs - How long they stayed before pressing back
   */
  const trackQuickBack = useCallback((viewId: string, durationMs: number) => {
    const now = Date.now();
    const key = `quick_back:${viewId}`;
    // Debounce: ignore if same view quick-back within 60 seconds
    if (lastEventRef.current[key] && now - lastEventRef.current[key] < 60000) return;
    lastEventRef.current[key] = now;

    dispatchEvent('quick_back', viewId, JSON.stringify({ durationMs, withinThreshold: durationMs < 5000 }));
  }, [dispatchEvent]);

  /**
   * Track protocol selection — user clicked 'Got It' on a Protocol Detail Modal.
   * Correlates protocol adherence with future vitality score improvements.
   * @param protocolType - The protocol tier (e.g., 'high_performance', 'maintenance', 'active_recovery')
   * @param vitalityScore - The user's current vitality score at time of selection
   */
  const trackProtocolSelection = useCallback((protocolType: string, vitalityScore: number) => {
    const now = Date.now();
    const key = `protocol_selection:${protocolType}`;
    // Debounce: ignore duplicate selections within 10 seconds
    if (lastEventRef.current[key] && now - lastEventRef.current[key] < 10000) return;
    lastEventRef.current[key] = now;

    dispatchEvent('protocol_selection', protocolType, JSON.stringify({
      protocolType,
      vitalityScore,
      selectedAt: now,
    }));
  }, [dispatchEvent]);

  return { trackInfoClick, trackPlanCompletion, trackNavHesitation, trackQuickBack, trackProtocolSelection };
}
