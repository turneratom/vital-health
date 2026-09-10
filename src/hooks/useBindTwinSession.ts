import { useEffect, useRef } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useSession } from '@/lib/auth-client'
import {
  bindTwinSessionToUser,
  getBoundUserId,
  getTwinSessionId,
} from '@/lib/twinSession'

/**
 * When better-auth session resolves, bind localStorage twin sessionId to
 * `user:<id>` and claim/migrate guest data on Convex before the dashboard
 * keeps querying the old guest key.
 */
export function useBindTwinSession() {
  const { data: session, isPending } = useSession()
  const claimAndMigrate = useMutation(api.sessionBind.claimAndMigrate)
  const ranForUser = useRef<string | null>(null)

  useEffect(() => {
    if (isPending) return
    const userId = session?.user?.id
    if (!userId) return
    if (ranForUser.current === userId && getBoundUserId() === userId) {
      // Still ensure local key matches even if already claimed
      const expected = `user:${userId}`
      if (getTwinSessionId() !== expected) {
        bindTwinSessionToUser(userId)
      }
      return
    }

    const { guestSessionId, to } = bindTwinSessionToUser(userId)
    ranForUser.current = userId

    void claimAndMigrate({
      userId,
      guestSessionId: guestSessionId ?? undefined,
    }).catch((err) => {
      console.warn('[vive] session bind migrate failed', err)
    })

    // Soft signal for any listeners that memoized session at mount
    try {
      window.dispatchEvent(
        new CustomEvent('vive-session-bound', { detail: { sessionId: to, userId } }),
      )
    } catch {
      /* ignore */
    }
  }, [session, isPending, claimAndMigrate])

  return {
    sessionId: getTwinSessionId(),
    userId: session?.user?.id ?? null,
    isPending,
  }
}
