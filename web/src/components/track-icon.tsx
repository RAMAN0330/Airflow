import { BookIcon, BrainIcon, DatabaseIcon, SigmaIcon, WorkflowIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = { brain: BrainIcon, database: DatabaseIcon, workflow: WorkflowIcon, sigma: SigmaIcon }

// One accent per track, so tracks are recognizable everywhere they appear.
export const TRACK_TONE: Record<string, string> = {
  "machine-learning": "from-violet-500 to-fuchsia-500",
  "data-engineering": "from-sky-500 to-cyan-400",
  mlops: "from-amber-500 to-orange-500",
  "math-statistics": "from-emerald-500 to-teal-400",
}

export function TrackIcon({ icon, trackId, className }: { icon: string; trackId?: string; className?: string }) {
  const Icon = ICONS[icon] ?? BookIcon
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm",
        TRACK_TONE[trackId ?? ""] ?? "from-brand to-fuchsia-500",
        className
      )}
    >
      <Icon className="size-5" />
    </span>
  )
}
