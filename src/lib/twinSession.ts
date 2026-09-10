/**
 * Twin sessionId ownership
 *
 * Guests: random UUID in localStorage `vive-session-id`
 * Authenticated: stable `user:<betterAuthUserId>`
 * On signup/signin: bind local key + Convex rekey guest → user
 */

export const TWIN_SESSION_KEY = 'vive-session-id'
export const TWIN_GUEST_SESSION_KEY = 'vive-guest-session-id'
export const TWIN_BOUND_USER_KEY = 'vive-bound-user-id'

const AUTH_PREFIX = 'user:'

export function authTwinSessionId(userId: string): string {
  return `${AUTH_PREFIX}${userId}`
}

export function isAuthTwinSessionId(sessionId: string): boolean {
  return sessionId.startsWith(AUTH_PREFIX)
}

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

/** Ensure a guest (or current) twin session id exists and return it. */
export function getTwinSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = safeGet(TWIN_SESSION_KEY)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest-${Date.now().toString(36)}`
    safeSet(TWIN_SESSION_KEY, id)
  }
  return id
}

/**
 * Bind local twin session to authenticated user.
 * Preserves prior guest id for Convex migrate. Returns { from, to }.
 */
export function bindTwinSessionToUser(userId: string): {
  from: string
  to: string
  guestSessionId: string | null
} {
  const to = authTwinSessionId(userId)
  const current = safeGet(TWIN_SESSION_KEY)
  let guestSessionId = safeGet(TWIN_GUEST_SESSION_KEY)

  if (current && !isAuthTwinSessionId(current)) {
    guestSessionId = current
    safeSet(TWIN_GUEST_SESSION_KEY, current)
  }

  safeSet(TWIN_SESSION_KEY, to)
  safeSet(TWIN_BOUND_USER_KEY, userId)

  try {
    sessionStorage.setItem(TWIN_SESSION_KEY, to)
  } catch {
    /* ignore */
  }

  return { from: current ?? to, to, guestSessionId }
}

/** Clear auth binding markers but keep a fresh guest id (sign-out path). */
export function unbindTwinSessionToGuest(): string {
  const priorGuest = safeGet(TWIN_GUEST_SESSION_KEY)
  const next =
    priorGuest && !isAuthTwinSessionId(priorGuest)
      ? priorGuest
      : typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest-${Date.now().toString(36)}`
  safeSet(TWIN_SESSION_KEY, next)
  try {
    localStorage.removeItem(TWIN_BOUND_USER_KEY)
    sessionStorage.setItem(TWIN_SESSION_KEY, next)
  } catch {
    /* ignore */
  }
  return next
}

export function getBoundUserId(): string | null {
  return safeGet(TWIN_BOUND_USER_KEY)
}
