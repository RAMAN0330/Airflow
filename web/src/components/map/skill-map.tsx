"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  CodeIcon,
  CrownIcon,
  LockIcon,
  MapIcon,
  RefreshCwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"

import { LockNotice } from "@/components/lock-notice"
import { EASE, Reveal } from "@/components/motion/primitives"
import { StatusBadge } from "@/components/status-badge"
import { TrackIcon } from "@/components/track-icon"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { courseHref, stepHref } from "@/lib/links"
import type { Course, ModuleSummary, StepSummary, Track } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"

import { courseNodeStatus, isOpen, moduleStatus, moduleSteps, NODE_TONE, type NodeStatus } from "./map-model"

interface Selection {
  courseId: string
  moduleId: string
}

export function SkillMap() {
  const tracks = useCatalogStore((s) => s.tracks)
  const state = useCatalogStore((s) => s.tracksState)
  const error = useCatalogStore((s) => s.error)
  const load = useCatalogStore((s) => s.loadTracks)
  const [selected, setSelected] = useState<Selection | null>(null)

  useEffect(() => {
    load()
  }, [load])

  const done = tracks?.reduce((n, t) => n + t.completed_steps, 0) ?? 0
  const total = tracks?.reduce((n, t) => n + t.total_steps, 0) ?? 0

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Reveal className="flex flex-wrap items-end justify-between gap-6" y={10}>
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-brand">
            <MapIcon className="size-4" /> Skill map
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Every path, at a glance</h1>
          <p className="max-w-2xl text-muted-foreground">
            Tracks run independently. Inside a track, courses unlock left to right, and modules unlock top to bottom.
            Select a module to see what it covers.
          </p>
        </div>
        {tracks && (
          <div className="min-w-56 space-y-1.5">
            <p className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall</span>
              <span className="font-medium tabular-nums">
                {done} / {total} steps
              </span>
            </p>
            <Progress value={total ? (done / total) * 100 : 0} className="h-2 bg-muted" indicatorClassName="bg-brand" />
          </div>
        )}
      </Reveal>

      <Legend />

      {!tracks ? (
        state === "error" ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">Couldn&apos;t load the map</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load({ force: true })}>
              <RefreshCwIcon /> Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-8">
          {tracks.map((t, i) => (
            <TrackLane
              key={t.id}
              track={t}
              index={i}
              selected={selected?.courseId && t.courses.some((c) => c.id === selected.courseId) ? selected : null}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Legend() {
  const items: NodeStatus[] = ["completed", "in_progress", "available", "locked", "upgrade", "soon"]
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Legend">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={cn("grid size-4 place-items-center rounded-full border", NODE_TONE[s].dot, NODE_TONE[s].ring)}>
            <StatusGlyph status={s} className="size-2.5" />
          </span>
          {NODE_TONE[s].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="h-0.5 w-6 rounded bg-success" /> unlocked path
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-0 w-6 border-t-2 border-dashed border-muted-foreground/40" /> still locked
      </li>
    </ul>
  )
}

function StatusGlyph({ status, className, index }: { status: NodeStatus; className?: string; index?: number }) {
  if (status === "completed") return <CheckIcon className={className} strokeWidth={3} />
  if (status === "locked") return <LockIcon className={className} />
  if (status === "upgrade") return <CrownIcon className={className} />
  if (status === "soon") return <SparklesIcon className={className} />
  if (index !== undefined) return <span className="text-[11px] font-semibold tabular-nums">{index}</span>
  return <span className={cn("rounded-full bg-current", className, "size-1.5")} />
}

function TrackLane({
  track,
  index,
  selected,
  onSelect,
}: {
  track: Track
  index: number
  selected: Selection | null
  onSelect: (s: Selection | null) => void
}) {
  const pct = track.total_steps ? Math.round((track.completed_steps / track.total_steps) * 100) : 0
  const course = selected ? track.courses.find((c) => c.id === selected.courseId) : undefined
  const mod = course?.modules.find((m) => m.id === selected?.moduleId)

  return (
    <Reveal as="section" delay={index * 0.05} className="overflow-hidden rounded-2xl border bg-card" aria-labelledby={`track-${track.id}`}>
      <header className="flex flex-wrap items-center gap-4 border-b px-4 py-4 sm:px-6">
        <TrackIcon icon={track.icon} trackId={track.id} />
        <div className="min-w-0 flex-1">
          <h2 id={`track-${track.id}`} className="font-semibold">
            <Link href={`/learn?track=${track.id}`} className="hover:underline">
              {track.title}
            </Link>
          </h2>
          <p className="truncate text-sm text-muted-foreground">{track.tagline}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {track.completed_steps}/{track.total_steps} · {pct}%
          </span>
          <StatusBadge status={track.status} />
        </div>
      </header>

      {/* Only this container scrolls sideways on narrow screens. */}
      <div className="overflow-x-auto overscroll-x-contain" role="group" aria-label={`${track.title} courses`} tabIndex={0}>
        <ol className="flex w-max items-start p-4 sm:p-6">
          {track.courses.map((c, i) => (
            <li key={c.id} className="flex items-start">
              {i > 0 && <CourseConnector from={track.courses[i - 1]} to={c} />}
              <CourseColumn
                course={c}
                selectedModule={selected?.courseId === c.id ? selected.moduleId : null}
                onSelect={(moduleId) =>
                  onSelect(selected?.courseId === c.id && selected.moduleId === moduleId ? null : { courseId: c.id, moduleId })
                }
              />
            </li>
          ))}
        </ol>
      </div>

      <AnimatePresence initial={false}>
        {course && mod && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden border-t"
          >
            <ModuleDetails course={course} module={mod} onClose={() => onSelect(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </Reveal>
  )
}

/** Arrow between consecutive courses: solid once the next course is unlocked, dashed while locked. */
function CourseConnector({ from, to }: { from: Course; to: Course }) {
  const reduce = useReducedMotion()
  const toStatus = courseNodeStatus(to)
  const open = isOpen(toStatus)
  const stroke = open
    ? from.status === "completed"
      ? "stroke-success"
      : "stroke-brand"
    : toStatus === "upgrade"
      ? "stroke-amber-500/60"
      : "stroke-muted-foreground/40"
  return (
    <div className="mt-8 w-12 shrink-0 sm:w-16" aria-hidden>
      <svg viewBox="0 0 64 16" className="h-4 w-full overflow-visible" preserveAspectRatio="none">
        <motion.path
          d="M2 8 H56"
          className={cn("fill-none", stroke)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={open ? undefined : "4 4"}
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
        />
        <path d="M52 3 L60 8 L52 13" className={cn("fill-none", stroke)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function CourseColumn({
  course,
  selectedModule,
  onSelect,
}: {
  course: Course
  selectedModule: string | null
  onSelect: (moduleId: string) => void
}) {
  const status = courseNodeStatus(course)
  const tone = NODE_TONE[status]
  const pct = course.total_steps ? (course.completed_steps / course.total_steps) * 100 : 0

  return (
    <div className="w-60 shrink-0 sm:w-64">
      <Link
        href={courseHref(course.id)}
        className={cn(
          "group block rounded-xl border-2 bg-background p-3 transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          tone.ring
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", tone.dot)}>
            <StatusGlyph status={status} className="size-3.5" index={course.position} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold group-hover:underline">{course.title}</span>
            <span className="block text-[11px] text-muted-foreground">
              Course {course.position} · {course.level}
            </span>
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <Progress
            value={pct}
            className="h-1 bg-muted"
            indicatorClassName={course.status === "completed" ? "bg-success" : "bg-brand"}
            aria-label={`${course.title} progress`}
          />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {course.completed_steps}/{course.total_steps}
          </span>
        </div>
      </Link>

      <ol className="mt-1 pl-0" aria-label={`${course.title} modules`}>
        {course.modules.map((m, j) => {
          const s = moduleStatus(course, m)
          return (
            <li key={m.id}>
              <ModuleConnector status={s} delay={j * 0.06} />
              <ModuleNode
                module={m}
                status={s}
                index={j + 1}
                selected={selectedModule === m.id}
                onSelect={() => onSelect(m.id)}
              />
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ModuleConnector({ status, delay }: { status: NodeStatus; delay: number }) {
  const reduce = useReducedMotion()
  const open = isOpen(status)
  return (
    <div className="flex h-4 w-[2.375rem] justify-center" aria-hidden>
      {open ? (
        <motion.span
          className={cn("block w-0.5 origin-top rounded-full", NODE_TONE[status].line)}
          initial={reduce ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35, ease: EASE, delay }}
        />
      ) : (
        <span className="block h-full border-l-2 border-dashed border-muted-foreground/30" />
      )}
    </div>
  )
}

function ModuleNode({
  module: m,
  status,
  index,
  selected,
  onSelect,
}: {
  module: ModuleSummary
  status: NodeStatus
  index: number
  selected: boolean
  onSelect: () => void
}) {
  const tone = NODE_TONE[status]
  const steps = moduleSteps(m)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={`Module ${index}: ${m.title}. ${tone.label}.`}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl border bg-background p-2 text-left transition-all hover:-translate-y-px hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            tone.ring,
            status === "soon" && "opacity-70",
            selected && "ring-2 ring-brand ring-offset-2 ring-offset-card"
          )}
        >
          <span className={cn("grid size-[1.375rem] shrink-0 place-items-center rounded-full", tone.dot)}>
            <StatusGlyph status={status} className="size-3" index={index} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{m.title}</span>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {steps.map((s) => (
                <span key={s.id} className="flex items-center gap-0.5">
                  {s.kind === "lesson" ? <BookOpenIcon className="size-3" /> : <CodeIcon className="size-3" />}
                  {s.status === "completed" && <CheckIcon className="size-2.5 text-success" strokeWidth={3} />}
                </span>
              ))}
              {m.concepts.length > 0 && <span className="truncate">{m.concepts.length} concepts</span>}
            </span>
          </span>
        </button>
      </TooltipTrigger>
      {m.concepts.length > 0 && (
        <TooltipContent side="right" className="max-w-64">
          <p className="mb-1 font-medium">{m.title}</p>
          <p className="opacity-80">{m.concepts.join(" · ")}</p>
        </TooltipContent>
      )}
    </Tooltip>
  )
}

function ModuleDetails({ course, module: m, onClose }: { course: Course; module: ModuleSummary; onClose: () => void }) {
  const status = moduleStatus(course, m)
  const steps = moduleSteps(m)
  return (
    <div className="grid gap-5 bg-muted/30 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{course.title}</p>
            <h3 className="text-lg font-semibold">{m.title}</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close module details">
            <XIcon />
          </Button>
        </div>
        <p className={cn("text-sm font-medium", NODE_TONE[status].text)}>{NODE_TONE[status].label}</p>
        {m.concepts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {m.concepts.map((c) => (
              <span key={c} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {m.coming_soon ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            This module is being written. Its lesson and exercise will appear here soon.
          </p>
        ) : (
          steps.map((s) => <StepLink key={s.id} step={s} />)
        )}
      </div>
    </div>
  )
}

function StepLink({ step }: { step: StepSummary }) {
  const locked = step.status === "locked"
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
        {step.kind === "lesson" ? <BookOpenIcon className="size-4" /> : <CodeIcon className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{step.title}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{step.kind}</span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3" /> {step.estimated_minutes} min
          </span>
          <span className="text-brand">+{step.xp} XP</span>
        </p>
      </div>
      <StatusBadge status={step.status} />
      {locked && step.lock_reason ? (
        <LockNotice reason={step.lock_reason} compact className="w-full text-xs" />
      ) : (
        <Button asChild size="sm" variant={step.status === "completed" ? "outline" : "default"}>
          <Link href={stepHref(step)}>
            {step.status === "completed" ? "Revisit" : step.status === "in_progress" ? "Continue" : "Start"} <ArrowRightIcon />
          </Link>
        </Button>
      )}
    </div>
  )
}
