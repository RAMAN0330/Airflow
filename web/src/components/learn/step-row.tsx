import Link from "next/link"
import { ArrowRightIcon, BookOpenIcon, CheckIcon, CodeIcon, LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { stepHref } from "@/lib/links"
import type { StepSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

const CTA = { available: "Start", in_progress: "Continue", completed: "Review", locked: "Locked" } as const

export function StepIcon({ step, className }: { step: Pick<StepSummary, "kind" | "status">; className?: string }) {
  const Icon = step.status === "completed" ? CheckIcon : step.status === "locked" ? LockIcon : step.kind === "lesson" ? BookOpenIcon : CodeIcon
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border-2 bg-background",
        step.status === "completed" && "border-success bg-success text-white",
        step.status === "available" && "border-brand text-brand",
        step.status === "in_progress" && "border-warning text-warning",
        step.status === "locked" && "border-border text-muted-foreground",
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

export function StepRow({ step, last }: { step: StepSummary; last?: boolean }) {
  const locked = step.status === "locked"
  const active = step.status === "available" || step.status === "in_progress"
  return (
    <li className="relative flex gap-4">
      {!last && <span className="absolute top-10 bottom-[-0.75rem] left-[17px] w-0.5 bg-border" aria-hidden />}
      <StepIcon step={step} />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3",
          active && "border-brand/40 bg-brand/5",
          locked && "bg-muted/30"
        )}
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {step.kind === "lesson" ? "Lesson" : "Exercise"}
            {step.difficulty && <span className="capitalize"> · {step.difficulty}</span>} · {step.estimated_minutes} min ·{" "}
            <span className="text-brand">+{step.xp} XP</span>
            {step.kind === "exercise" && step.attempts > 0 && step.best_score !== null && (
              <> · best {Math.round(step.best_score * 100)}%</>
            )}
          </p>
          <p className={cn("font-medium", locked && "text-muted-foreground")}>{step.title}</p>
          {locked && step.lock_reason && <p className="text-xs text-muted-foreground">{step.lock_reason.message}</p>}
        </div>
        {locked ? (
          <Button size="sm" variant="ghost" disabled>
            <LockIcon /> Locked
          </Button>
        ) : (
          <Button asChild size="sm" variant={active ? "default" : "outline"}>
            <Link href={stepHref(step)}>
              {CTA[step.status]} <ArrowRightIcon />
            </Link>
          </Button>
        )}
      </div>
    </li>
  )
}
