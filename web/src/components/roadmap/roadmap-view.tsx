"use client"

import Link from "next/link"
import { useEffect, useMemo } from "react"
import { ArrowRightIcon, RefreshCwIcon, TrophyIcon } from "lucide-react"

import { ModuleCard } from "@/components/roadmap/module-card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import type { Phase } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"

export function RoadmapView() {
  const curriculum = useCatalogStore((s) => s.curriculum)
  const progress = useCatalogStore((s) => s.progress)
  const state = useCatalogStore((s) => s.curriculumState)
  const error = useCatalogStore((s) => s.error)
  const loadCurriculum = useCatalogStore((s) => s.loadCurriculum)
  const loadProgress = useCatalogStore((s) => s.loadProgress)

  useEffect(() => {
    loadCurriculum()
    loadProgress()
  }, [loadCurriculum, loadProgress])

  const titles = useMemo(() => {
    const out: Record<string, string> = {}
    curriculum?.phases.forEach((p) => p.modules.forEach((m) => m.exercise && (out[m.exercise.id] = m.exercise.title)))
    return out
  }, [curriculum])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="mb-12 grid items-end gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <p className="text-sm font-medium text-brand">Interactive ML/AI practice</p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Learn machine learning by building it from scratch.
          </h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Write the math yourself, from gradient descent to self-attention. Every exercise runs in an isolated sandbox
            against hidden tests that check shapes, gradients and convergence, then gives you targeted hints when something
            breaks.
          </p>
        </div>
        <ProgressCard />
      </section>

      {state === "error" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Couldn&apos;t load the curriculum</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadCurriculum({ force: true })}>
            <RefreshCwIcon /> Try again
          </Button>
        </div>
      )}

      {!curriculum && state !== "error" && <RoadmapSkeleton />}

      {curriculum && (
        <div className="space-y-14">
          {curriculum.phases.map((phase, i) => (
            <PhaseSection key={phase.id} phase={phase} titles={titles} last={i === curriculum.phases.length - 1} />
          ))}
        </div>
      )}

      {progress && progress.completed === progress.total_exercises && progress.total_exercises > 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          You&apos;ve completed every available exercise. New modules are on the way.
        </p>
      )}
    </div>
  )
}

function ProgressCard() {
  const progress = useCatalogStore((s) => s.progress)
  if (!progress) return <Skeleton className="h-[150px] rounded-xl" />

  const pct = progress.total_exercises ? (progress.completed / progress.total_exercises) * 100 : 0
  const next = progress.next_up

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Your progress</p>
          <p className="text-2xl font-semibold tabular-nums">
            {progress.completed}
            <span className="text-base font-normal text-muted-foreground"> / {progress.total_exercises} exercises</span>
          </p>
        </div>
        <div className="grid size-10 place-items-center rounded-full bg-brand/10">
          <TrophyIcon className="size-5 text-brand" />
        </div>
      </div>
      <Progress value={pct} className="h-2 bg-muted" indicatorClassName="bg-gradient-to-r from-brand to-fuchsia-500" />
      {next ? (
        <Button asChild className="w-full justify-between">
          <Link href={`/exercises/${next.id}`}>
            <span className="truncate">
              {next.status === "in_progress" ? "Continue" : "Start"}: {next.title}
            </span>
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link href="/progress">View your stats</Link>
        </Button>
      )}
    </div>
  )
}

function PhaseSection({ phase, titles, last }: { phase: Phase; titles: Record<string, string>; last: boolean }) {
  const exercises = phase.modules.flatMap((m) => (m.exercise ? [m.exercise] : []))
  const done = exercises.filter((e) => e.status === "completed").length
  const complete = exercises.length > 0 && done === exercises.length

  return (
    <section className="relative grid gap-6 md:grid-cols-[3rem_1fr]">
      <div className="hidden md:flex md:flex-col md:items-center">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-full border-2 bg-background text-sm font-semibold",
            complete ? "border-success text-success" : "border-brand text-brand"
          )}
        >
          {phase.id}
        </span>
        {!last && <span className="mt-2 w-px flex-1 bg-border" />}
      </div>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase md:hidden">Phase {phase.id}</p>
            <h2 className="text-xl font-semibold tracking-tight">{phase.title}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{phase.description}</p>
          </div>
          {exercises.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {done}/{exercises.length} complete
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...phase.modules]
            .sort((a, b) => Number(!!b.exercise) - Number(!!a.exercise))
            .map((m) => (
              <ModuleCard key={m.id} module={m} titles={titles} />
            ))}
        </div>
      </div>
    </section>
  )
}

function RoadmapSkeleton() {
  return (
    <div className="space-y-12">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4 md:pl-[4.5rem]">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-56 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
