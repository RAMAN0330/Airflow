"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowDownIcon, ArrowRightIcon, PauseIcon, PlayIcon, WorkflowIcon } from "lucide-react"

import { EASE } from "@/components/motion/primitives"
import { Button } from "@/components/ui/button"
import type { Flow } from "@/lib/types"
import { cn } from "@/lib/utils"

/** A step-by-step process diagram that walks through itself; click any step to focus it. */
export function FlowDiagram({ flow, className }: { flow: Flow; className?: string }) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(!reduce)
  const n = flow.steps.length

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setActive((i) => (i + 1) % n), 2600)
    return () => clearInterval(t)
  }, [playing, n])

  const select = (i: number) => {
    setActive(i)
    setPlaying(false)
  }

  return (
    <figure className={cn("rounded-2xl border bg-gradient-to-br from-brand/5 via-card to-card p-5 sm:p-6", className)}>
      <figcaption className="mb-5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <WorkflowIcon className="size-4 text-brand" /> {flow.title}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause walkthrough" : "Play walkthrough"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />} {playing ? "Pause" : "Walk through"}
        </Button>
      </figcaption>

      <ol className="flex flex-col items-stretch gap-1 lg:flex-row lg:items-center">
        {flow.steps.map((step, i) => {
          const isActive = i === active
          const done = i < active
          return (
            <li key={step.label} className="flex flex-col items-center lg:flex-1 lg:flex-row">
              <button
                type="button"
                onClick={() => select(i)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "relative w-full rounded-xl border bg-background px-3 py-2.5 text-left text-sm transition-all duration-300 lg:text-center",
                  isActive && "border-brand shadow-md shadow-brand/15",
                  done && "border-brand/40",
                  !isActive && "hover:border-brand/50"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId={`flow-glow-${flow.title}`}
                    className="absolute inset-0 -z-0 rounded-xl bg-brand/10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-2 lg:flex-col lg:gap-1">
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                      isActive || done ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className={cn("font-medium", !isActive && !done && "text-muted-foreground")}>{step.label}</span>
                </span>
              </button>
              {i < n - 1 && (
                <span className="flex shrink-0 items-center justify-center px-1 py-0.5 text-muted-foreground lg:px-1.5">
                  <ArrowDownIcon className={cn("size-4 lg:hidden", done && "text-brand")} />
                  <ArrowRightIcon className={cn("hidden size-4 lg:block", done && "text-brand")} />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <div className="relative mt-4 min-h-12 overflow-hidden rounded-lg bg-muted/50 px-4 py-3 text-sm" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <span className="font-medium text-foreground">{flow.steps[active].label}: </span>
            <span className="text-muted-foreground">{flow.steps[active].detail}</span>
          </motion.p>
        </AnimatePresence>
        {playing && (
          <motion.span
            key={`bar-${active}`}
            className="absolute bottom-0 left-0 h-0.5 bg-brand"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.6, ease: "linear" }}
          />
        )}
      </div>
    </figure>
  )
}
