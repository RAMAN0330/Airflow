"use client"

import { useEffect } from "react"

import { useJourneyStore } from "@/stores/journey-store"

/** True if `id` was unlocked recently and not yet visited. With `consume`, clears it after a moment on screen. */
export function useFreshUnlock(id: string | undefined, { consume = false, after = 6000 } = {}) {
  const fresh = useJourneyStore((s) => !!id && id in s.recentlyUnlocked)
  const markSeen = useJourneyStore((s) => s.markSeen)
  useEffect(() => {
    if (!consume || !fresh || !id) return
    const t = setTimeout(() => markSeen(id), after)
    return () => clearTimeout(t)
  }, [consume, fresh, id, after, markSeen])
  return fresh
}
