"use client"

import Link from "next/link"
import { ArrowRightIcon, BookOpenIcon, CheckIcon, CodeIcon, LockIcon } from "lucide-react"

import { motion } from "motion/react"

import { EASE, StaggerItem } from "@/components/motion/primitives"
import { Button } from "@/components/ui/button"
import { useFreshUnlock } from "@/hooks/use-fresh-unlock"
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
  const fresh = useFreshUnlock(step.status === "locked" ? undefined : step.id, { consume: true })
  return (
    <StaggerItem as="li" className="relative flex gap-4">
      {!last && (
        <span className="absolute top-10 bottom-[-0.75rem] left-[17px] w-0.5 overflow-hidden bg-border" aria-hidden>
          {step.status === "completed" && (
            <motion.span
              className="absolute inset-x-0 top-0 bg-success"
              initial={{ height: 0 }}
              animate={{ height: "100%" }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.4 }}
            />
          )}
        </span>
      )}
      <motion.div
        className="relative"
        initial={fresh ? { scale: 0.6, rotate: -20 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 12, delay: 0.3 }}
      >
        {fresh && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-brand/40"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <StepIcon step={step} />
      </motion.div>
      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-lg border px-4 py-3 transition-colors",
          active && "border-brand/40 bg-brand/5",
          locked && "bg-muted/30",
          fresh && "ring-2 ring-brand/50"
        )}
      >
        {fresh && <span aria-hidden className="animate-shimmer pointer-events-none absolute inset-0" />}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs text-muted-foreground">
            {step.kind === "lesson" ? "Lesson" : "Exercise"}
            {step.difficulty && <span className="capitalize"> · {step.difficulty}</span>} · {step.estimated_minutes} min ·{" "}
            <span className="text-brand">+{step.xp} XP</span>
            {step.kind === "exercise" && step.attempts > 0 && step.best_score !== null && (
              <> · best {Math.round(step.best_score * 100)}%</>
            )}
          </p>
          <p className={cn("flex items-center gap-2 font-medium", locked && "text-muted-foreground")}>
            {step.title}
            {fresh && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.5 }}
                className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-foreground uppercase"
              >
                New
              </motion.span>
            )}
          </p>
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
    </StaggerItem>
  )
}
