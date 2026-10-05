import { toast } from "sonner"

import { stepHref } from "@/lib/links"
import type { StepRef } from "@/lib/types"

/** Toast for a newly completed step, offering the next unlocked step. */
export function celebrate(
  title: string,
  xp: number,
  unlocked: StepRef[],
  navigate: (href: string) => void,
  courseCompleted?: boolean
) {
  const next = unlocked[0]
  const parts = [xp ? `+${xp} XP` : null, next ? `Unlocked: ${next.title}` : null].filter(Boolean)
  toast.success(courseCompleted ? "Course complete! 🎉" : title, {
    description: parts.join(" · ") || undefined,
    action: next ? { label: next.kind === "lesson" ? "Start lesson" : "Start exercise", onClick: () => navigate(stepHref(next)) } : undefined,
    duration: 8000,
  })
}
