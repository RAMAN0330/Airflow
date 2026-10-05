import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import type { StepRef } from "@/lib/types"

export interface CourseCelebration {
  courseTitle: string
  xpEarned: number
  /** First step of the following course, if any (may be plan-locked). */
  next: StepRef | null
}

const UNLOCK_TTL_MS = 30 * 60 * 1000

interface JourneyState {
  onboardingDismissed: boolean
  /** Step ids unlocked recently, highlighted until the learner has seen them. */
  recentlyUnlocked: Record<string, number>
  confettiKey: number
  celebration: CourseCelebration | null
  dismissOnboarding: () => void
  markUnlocked: (ids: string[]) => void
  markSeen: (id: string) => void
  fireConfetti: () => void
  celebrateCourse: (c: CourseCelebration) => void
  closeCelebration: () => void
}

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set) => ({
      onboardingDismissed: false,
      recentlyUnlocked: {},
      confettiKey: 0,
      celebration: null,
      dismissOnboarding: () => set({ onboardingDismissed: true }),
      markUnlocked: (ids) =>
        set((s) => {
          const now = Date.now()
          // Drop highlights the learner never came back to.
          const kept = Object.fromEntries(Object.entries(s.recentlyUnlocked).filter(([, t]) => now - t < UNLOCK_TTL_MS))
          return { recentlyUnlocked: { ...kept, ...Object.fromEntries(ids.map((id) => [id, now])) } }
        }),
      markSeen: (id) =>
        set((s) => {
          const next = { ...s.recentlyUnlocked }
          delete next[id]
          return { recentlyUnlocked: next }
        }),
      fireConfetti: () => set((s) => ({ confettiKey: s.confettiKey + 1 })),
      celebrateCourse: (celebration) => set((s) => ({ celebration, confettiKey: s.confettiKey + 1 })),
      closeCelebration: () => set({ celebration: null }),
    }),
    {
      name: "gradient-journey",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ onboardingDismissed: s.onboardingDismissed, recentlyUnlocked: s.recentlyUnlocked }),
    }
  )
)
