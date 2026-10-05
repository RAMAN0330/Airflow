import Link from "next/link"
import { ArrowRightIcon, ClockIcon, LockIcon, SparklesIcon } from "lucide-react"

import { DifficultyBadge, StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { Module } from "@/lib/types"
import { cn } from "@/lib/utils"

const CTA = {
  available: "Start exercise",
  in_progress: "Continue",
  completed: "Review",
  locked: "Preview",
} as const

export function ModuleCard({ module, titles }: { module: Module; titles: Record<string, string> }) {
  const ex = module.exercise

  if (!ex) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-dashed p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-muted-foreground">{module.title}</h3>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <SparklesIcon /> Coming soon
          </Badge>
        </div>
        <Concepts concepts={module.concepts} muted />
      </div>
    )
  }

  const locked = ex.status === "locked"
  const missing = ex.prerequisites.map((p) => titles[p] ?? p)

  return (
    <Link
      href={`/exercises/${ex.id}`}
      className={cn(
        "group relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
        ex.status === "available" && "border-brand/40 ring-1 ring-brand/10",
        locked && "bg-muted/30 hover:translate-y-0 hover:shadow-xs"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{module.title}</p>
          <h3 className={cn("leading-snug font-semibold", locked && "text-muted-foreground")}>{ex.title}</h3>
        </div>
        <StatusBadge status={ex.status} className="shrink-0" />
      </div>

      <p className="line-clamp-3 text-sm text-muted-foreground">{ex.summary}</p>
      <Concepts concepts={module.concepts} muted={locked} />

      <div className="mt-auto space-y-3">
        {ex.attempts > 0 && ex.best_score !== null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Best score</span>
              <span className="tabular-nums">{Math.round(ex.best_score * 100)}%</span>
            </div>
            <Progress
              value={ex.best_score * 100}
              className="h-1 bg-muted"
              indicatorClassName={ex.status === "completed" ? "bg-success" : "bg-warning"}
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <DifficultyBadge difficulty={ex.difficulty} />
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3" /> {ex.estimated_minutes}m
            </span>
          </div>
          {locked ? (
            <span className="flex items-center gap-1 truncate text-xs text-muted-foreground" title={`Requires ${missing.join(", ")}`}>
              <LockIcon className="size-3 shrink-0" />
              <span className="truncate">Requires {missing.join(", ")}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-medium group-hover:text-brand">
              {CTA[ex.status]}
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function Concepts({ concepts, muted }: { concepts: string[]; muted?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {concepts.map((c) => (
        <span
          key={c}
          className={cn("rounded-md bg-muted px-2 py-0.5 text-xs", muted ? "text-muted-foreground" : "text-foreground/80")}
        >
          {c}
        </span>
      ))}
    </div>
  )
}
