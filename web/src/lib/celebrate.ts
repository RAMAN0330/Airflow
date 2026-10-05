import { toast } from "sonner"

import { stepHref } from "@/lib/links"
import type { StepRef } from "@/lib/types"
import { useJourneyStore } from "@/stores/journey-store"

interface Win {
  title: string
  xp: number
  unlocked: StepRef[]
  navigate: (href: string) => void
  /** Set when this step finished its course: opens the full-screen celebration instead of a toast. */
  courseComplete?: { courseTitle: string; next: StepRef | null }
}

/** One place for every "you did it" moment: confetti, unlock highlights, then a toast or the course celebration. */
export function celebrate({ title, xp, unlocked, navigate, courseComplete }: Win) {
  const journey = useJourneyStore.getState()
  journey.markUnlocked(unlocked.map((u) => u.id))

  if (courseComplete) {
    toast.dismiss() // the celebration dialog is the whole moment
    journey.celebrateCourse({
      courseTitle: courseComplete.courseTitle,
      xpEarned: xp,
      next: unlocked[0] ?? courseComplete.next,
    })
    return
  }

  journey.fireConfetti()
  const next = unlocked[0]
  const parts = [xp ? `+${xp} XP` : null, next ? `Unlocked: ${next.title}` : null].filter(Boolean)
  toast.success(title, {
    description: parts.join(" · ") || undefined,
    action: next ? { label: next.kind === "lesson" ? "Start lesson" : "Start exercise", onClick: () => navigate(stepHref(next)) } : undefined,
    duration: 8000,
  })
}
