import { CheckCircle2Icon, CircleDashedIcon, CircleDotIcon, LockIcon, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Difficulty, ExerciseStatus, RunStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS: Record<ExerciseStatus, { label: string; icon: LucideIcon; className: string }> = {
  completed: { label: "Completed", icon: CheckCircle2Icon, className: "border-success/30 bg-success/10 text-success" },
  in_progress: { label: "In progress", icon: CircleDotIcon, className: "border-warning/30 bg-warning/10 text-warning" },
  available: { label: "Available", icon: CircleDashedIcon, className: "border-brand/30 bg-brand/10 text-brand" },
  locked: { label: "Locked", icon: LockIcon, className: "text-muted-foreground" },
}

export function StatusBadge({ status, className }: { status: ExerciseStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = STATUS[status]
  return (
    <Badge variant="outline" className={cn(tone, className)}>
      <Icon /> {label}
    </Badge>
  )
}

const DIFFICULTY: Record<Difficulty, string> = {
  beginner: "text-success",
  intermediate: "text-warning",
  advanced: "text-destructive",
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge variant="outline" className="gap-1.5 capitalize">
      <span className={cn("size-1.5 rounded-full bg-current", DIFFICULTY[difficulty])} />
      {difficulty}
    </Badge>
  )
}

const RUN: Record<RunStatus, { label: string; className: string }> = {
  passed: { label: "Passed", className: "border-success/30 bg-success/10 text-success" },
  failed: { label: "Failed", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  error: { label: "Error", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  timeout: { label: "Timed out", className: "border-warning/30 bg-warning/10 text-warning" },
}

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(RUN[status].className, className)}>
      {RUN[status].label}
    </Badge>
  )
}
