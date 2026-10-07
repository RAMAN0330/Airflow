import { BookIcon, BrainIcon, DatabaseIcon, SigmaIcon, WorkflowIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  brain: BrainIcon,
  database: DatabaseIcon,
  workflow: WorkflowIcon,
  sigma: SigmaIcon,
  math: SigmaIcon,
  calculator: SigmaIcon,
}

const MATH_TONE = "from-emerald-500 to-teal-400"

// One accent per track, so tracks are recognizable everywhere they appear.
export const TRACK_TONE: Record<string, string> = {
  "machine-learning": "from-violet-500 to-fuchsia-500",
  "data-engineering": "from-sky-500 to-cyan-400",
  mlops: "from-amber-500 to-orange-500",
  math: MATH_TONE,
  "math-statistics": MATH_TONE,
  "math-and-statistics": MATH_TONE,
  "math-stats": MATH_TONE,
  mathematics: MATH_TONE,
}

/** Tone for a track id, falling back to the brand gradient for tracks without their own. */
export function trackTone(trackId?: string) {
  return TRACK_TONE[trackId ?? ""] ?? "from-primary to-brand"
}

export function TrackIcon({ icon, trackId, className }: { icon: string; trackId?: string; className?: string }) {
  const Icon = ICONS[icon] ?? BookIcon
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ring-1 ring-white/15 ring-inset",
        trackTone(trackId),
        className
      )}
    >
      <Icon className="size-5" />
    </span>
  )
}
