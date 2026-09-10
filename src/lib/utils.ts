import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ══════════════════════════════════════════════════════════════
   BIOLOGICAL WINDOW — Time-of-Day Awareness
   
   Determines the current biological window based on local time
   and provides frictionless priority scoring for protocol sorting.
   The Twin doesn't notify — it's simply ready when you look.
   ══════════════════════════════════════════════════════════════ */

export type BiologicalWindow = 'early-morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export interface WindowInfo {
  window: BiologicalWindow
  label: string
  icon: string
  /** Which timeOfDay values are "active" right now */
  activeSlots: string[]
  /** Which timeOfDay values are "upcoming" (next window) */
  upcomingSlots: string[]
  /** Which timeOfDay values are "past" for today */
  pastSlots: string[]
  /** Hour (0-23) */
  hour: number
}

export function getBiologicalWindow(now?: Date): WindowInfo {
  const d = now ?? new Date()
  const h = d.getHours()

  // Early morning: 5-7 AM — wake-up rituals, sunlight, cold exposure
  if (h >= 5 && h < 7) {
    return {
      window: 'early-morning',
      label: 'Early Morning',
      icon: '🌅',
      activeSlots: ['morning', 'all-day'],
      upcomingSlots: ['afternoon'],
      pastSlots: [],
      hour: h,
    }
  }
  // Morning: 7-11 AM — supplements, training, focus work
  if (h >= 7 && h < 11) {
    return {
      window: 'morning',
      label: 'Morning',
      icon: '☀️',
      activeSlots: ['morning', 'all-day'],
      upcomingSlots: ['afternoon'],
      pastSlots: [],
      hour: h,
    }
  }
  // Midday: 11 AM - 2 PM — hydration, nutrition, movement
  if (h >= 11 && h < 14) {
    return {
      window: 'midday',
      label: 'Midday',
      icon: '🌤️',
      activeSlots: ['afternoon', 'all-day'],
      upcomingSlots: ['evening'],
      pastSlots: ['morning'],
      hour: h,
    }
  }
  // Afternoon: 2-6 PM — zone 2 cardio, mobility, hydration
  if (h >= 14 && h < 18) {
    return {
      window: 'afternoon',
      label: 'Afternoon',
      icon: '🏃',
      activeSlots: ['afternoon', 'all-day'],
      upcomingSlots: ['evening'],
      pastSlots: ['morning'],
      hour: h,
    }
  }
  // Evening: 6-10 PM — recovery, sauna, magnesium, wind-down
  if (h >= 18 && h < 22) {
    return {
      window: 'evening',
      label: 'Evening',
      icon: '🌙',
      activeSlots: ['evening', 'all-day'],
      upcomingSlots: [],
      pastSlots: ['morning', 'afternoon'],
      hour: h,
    }
  }
  // Night: 10 PM - 5 AM — sleep protocols only
  return {
    window: 'night',
    label: 'Night',
    icon: '😴',
    activeSlots: ['evening', 'all-day'],
    upcomingSlots: ['morning'],
    pastSlots: ['morning', 'afternoon'],
    hour: h,
  }
}

/**
 * Score a protocol's frictionless priority for the current moment.
 * Lower score = higher priority (shown first).
 * 
 * Scoring logic:
 * - Active window match + not completed → 0 (top priority)
 * - All-day + not completed → 1
 * - Upcoming window + not completed → 2
 * - Past window + not completed → 3
 * - Completed items → 10+ (sink to end)
 */
export function getProtocolTimePriority(
  timeOfDay: string,
  completed: boolean,
  windowInfo: WindowInfo
): number {
  if (completed) return 10 + (windowInfo.activeSlots.includes(timeOfDay) ? 0 : 1)

  // Active right now
  if (timeOfDay !== 'all-day' && windowInfo.activeSlots.includes(timeOfDay)) return 0
  // All-day tasks are always relevant
  if (timeOfDay === 'all-day') return 1
  // Coming up next
  if (windowInfo.upcomingSlots.includes(timeOfDay)) return 2
  // Already past for today
  if (windowInfo.pastSlots.includes(timeOfDay)) return 3
  // Fallback
  return 4
}

/* ══════════════════════════════════════════════════════════════
   OVERDUE DETECTION — Friction-Aware Protocol Intelligence
   
   Determines if a protocol is "overdue" — its timeOfDay window
   has passed and it hasn't been completed. Critical protocols
   (supplements, training, recovery, biohacking) get an amber
   glow nudge. The Twin advises, never nags.
   ══════════════════════════════════════════════════════════════ */

/** Categories considered 'critical' for overdue detection */
const CRITICAL_CATEGORIES = new Set([
  'supplement', 'training', 'recovery', 'biohacking', 'movement',
])

/** Protocol name patterns that are always critical regardless of category */
const CRITICAL_NAME_PATTERNS = [
  'vitamin d', 'magnesium', 'omega', 'creatine', 'ashwagandha',
  'zone 2', 'strength', 'cold', 'sauna', 'breathwork',
  'sleep', 'protein', 'hydration',
]

/**
 * Check if a protocol is considered "critical" based on category + name.
 * Critical protocols trigger the amber overdue glow when their window passes.
 */
export function isCriticalProtocol(name: string, category: string): boolean {
  if (CRITICAL_CATEGORIES.has(category)) return true
  const lower = name.toLowerCase()
  return CRITICAL_NAME_PATTERNS.some(p => lower.includes(p))
}

/**
 * Check if a protocol is overdue — its time window has passed
 * and it hasn't been completed yet.
 */
export function isProtocolOverdue(
  timeOfDay: string,
  completed: boolean,
  windowInfo: WindowInfo
): boolean {
  if (completed) return false
  if (timeOfDay === 'all-day') return false
  return windowInfo.pastSlots.includes(timeOfDay)
}

/**
 * Full overdue check: is the protocol both critical AND overdue?
 * Only critical protocols get the amber friction nudge.
 */
export function isCriticalOverdue(
  name: string,
  category: string,
  timeOfDay: string,
  completed: boolean,
  windowInfo: WindowInfo
): boolean {
  return isCriticalProtocol(name, category) && isProtocolOverdue(timeOfDay, completed, windowInfo)
}

/** Amber palette for overdue states */
export const OVERDUE_AMBER = {
  color: '#FFB86B',
  glow: 'rgba(255,184,107,',
  border: 'rgba(255,184,107,0.25)',
  bg: 'rgba(255,184,107,0.06)',
  nudgeText: 'Friction detected: Skipping this may impact tomorrow\u2019s recovery.',
}
