"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ArrowRightIcon, AwardIcon, ChevronLeftIcon, ClockIcon, CrownIcon, LibraryIcon, PartyPopperIcon, SparklesIcon } from "lucide-react"
import { motion } from "motion/react"

import { StepRow } from "@/components/learn/step-row"
import { LockNotice } from "@/components/lock-notice"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"
import { ProBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { plural } from "@/lib/format"
import { courseHref, stepHref } from "@/lib/links"
import type { Course, StepSummary } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"

export function CourseView({ courseId }: { courseId: string }) {
  const courses = useCatalogStore((s) => s.courses)
  const tracks = useCatalogStore((s) => s.tracks)
  const state = useCatalogStore((s) => s.coursesState)
  const load = useCatalogStore((s) => s.loadTracks)

  useEffect(() => {
    load()
  }, [load])

  if (!courses) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        {state === "error" && <p className="text-sm text-destructive">Couldn&apos;t load this course.</p>}
      </div>
    )
  }

  const course = courses.find((c) => c.id === courseId)
  if (!course) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-4xl font-semibold">404</p>
        <p className="text-sm text-muted-foreground">That course doesn&apos;t exist.</p>
        <Button asChild variant="outline">
          <Link href="/learn">All courses</Link>
        </Button>
      </div>
    )
  }

  const nextCourse = courses.find((c) => c.track_id === course.track_id && c.position === course.position + 1)
  const released = course.modules.filter((m) => !m.coming_soon)
  const upcoming = course.modules.filter((m) => m.coming_soon)
  const steps = released.flatMap((m) => [m.lesson, m.exercise]).filter(Boolean) as StepSummary[]
  const current = steps.find((s) => s.status === "in_progress" || s.status === "available")
  const pct = course.total_steps ? (course.completed_steps / course.total_steps) * 100 : 0

  const track = tracks?.find((t) => t.id === course.track_id) ?? null
  const trackCourses = courses.filter((c) => c.track_id === course.track_id)

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
    <div className="min-w-0">
      <Link href={`/learn?track=${course.track_id}`} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> {track?.title ?? "All courses"}
      </Link>

      <Reveal as="div" y={10} className="mb-8 space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Course {course.position} of {trackCourses.length} · {course.level}
            </span>
            {course.tier === "pro" && course.status !== "upgrade_required" && <ProBadge />}
            <StatusBadge status={course.status} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{course.title}</h1>
          <p className="max-w-2xl text-muted-foreground">{course.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-4" /> ~{course.estimated_minutes} min
          </span>
          <span className="text-brand">+{course.total_xp} XP</span>
          <span>
            {plural(released.length, "module")} available{upcoming.length > 0 && `, ${upcoming.length} coming soon`}
          </span>
        </div>
        {course.lock_reason ? (
          <LockNotice reason={course.lock_reason} />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-48 flex-1 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>
                  {course.completed_steps} of {course.total_steps} steps complete
                </span>
                <span>{Math.round(pct)}%</span>
              </div>
              <Progress
                value={pct}
                className="h-2 bg-muted"
                indicatorClassName={course.status === "completed" ? "bg-success" : "bg-brand"}
              />
            </div>
            {current && (
              <Button asChild>
                <Link href={stepHref(current)}>
                  {current.status === "in_progress" || course.completed_steps > 0 ? "Continue" : "Start"} <ArrowRightIcon />
                </Link>
              </Button>
            )}
            {course.status === "completed" && (
              <Button asChild variant="outline">
                <Link href={`/certificate/${course.id}`}>
                  <AwardIcon /> View certificate
                </Link>
              </Button>
            )}
          </div>
        )}
      </Reveal>

      {course.status === "completed" && nextCourse && (
        <Reveal className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
          <PartyPopperIcon className="size-5 text-success" />
          <p className="flex-1 text-sm">
            <span className="font-medium">Course complete.</span>{" "}
            <span className="text-muted-foreground">Next up: {nextCourse.title}.</span>
          </p>
          <Button asChild size="sm">
            <Link href={courseHref(nextCourse.id)}>
              Go to course {nextCourse.position} <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
      )}

      <Stagger className="space-y-8" step={0.1} delay={0.1}>
        {released.map((m, i) => {
          const items = [m.lesson, m.exercise].filter(Boolean) as StepSummary[]
          return (
            <StaggerItem as="section" key={m.id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  <span className="mr-2 text-muted-foreground tabular-nums">Module {i + 1}</span>
                  {m.title}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {m.concepts.map((c) => (
                    <span key={c} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <Stagger as="ol" className="space-y-3" step={0.12}>
                {items.map((s, j) => (
                  <StepRow key={s.id} step={s} last={j === items.length - 1} />
                ))}
              </Stagger>
            </StaggerItem>
          )
        })}
      </Stagger>

      {upcoming.length > 0 && (
        <section className="mt-12 space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <SparklesIcon className="size-4 text-muted-foreground" /> Coming soon to this course
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((m) => (
              <div key={m.id} className="space-y-2 rounded-lg border border-dashed p-4">
                <p className="font-medium text-muted-foreground">{m.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {m.concepts.map((c) => (
                    <span key={c} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
    <CourseRail course={course} trackCourses={trackCourses} trackTitle={track?.title ?? ""} />
    </div>
  )
}

function CourseRail({ course, trackCourses, trackTitle }: { course: Course; trackCourses: Course[]; trackTitle: string }) {
  const pct = course.total_steps ? Math.round((course.completed_steps / course.total_steps) * 100) : 0
  const concepts = course.modules.filter((m) => !m.coming_soon).flatMap((m) => m.concepts)
  const r = 42
  const circ = 2 * Math.PI * r
  return (
    <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
      <div className="flex items-center gap-5 rounded-2xl border bg-card p-5 shadow-xs">
        <svg viewBox="0 0 100 100" className="size-24 shrink-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="9" />
          <motion.circle
            cx="50" cy="50" r={r}
            className={course.status === "completed" ? "fill-none stroke-success" : "fill-none stroke-brand"}
            strokeWidth="9" strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ * (1 - pct / 100) }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="space-y-1">
          <p className="text-3xl font-semibold tabular-nums">{pct}%</p>
          <p className="text-sm text-muted-foreground">
            {course.completed_steps} of {course.total_steps} steps · +{course.total_xp} XP
          </p>
        </div>
      </div>

      {concepts.length > 0 && (
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <p className="text-sm font-semibold">What you&apos;ll learn</p>
          <div className="flex flex-wrap gap-1.5">
            {concepts.map((c) => (
              <span key={c} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <p className="text-sm font-semibold">{trackTitle} path</p>
        <ol className="space-y-1">
          {trackCourses.map((c, i) => {
            const current = c.id === course.id
            return (
              <li key={c.id} className="relative">
                {i < trackCourses.length - 1 && <span className="absolute top-8 bottom-[-4px] left-[15px] w-px bg-border" aria-hidden />}
                <Link
                  href={courseHref(c.id)}
                  className={cn("flex items-center gap-3 rounded-lg p-1.5 text-sm hover:bg-muted", current && "bg-brand/10 font-medium")}
                >
                  <span
                    className={cn(
                      "relative grid size-[22px] shrink-0 place-items-center rounded-full border-2 bg-background text-[10px] font-semibold",
                      c.status === "completed" ? "border-success bg-success text-white" : current ? "border-brand text-brand" : "text-muted-foreground"
                    )}
                    style={{ marginLeft: 4 }}
                  >
                    {c.status === "completed" ? "✓" : c.position}
                  </span>
                  <span className="flex-1 truncate">{c.title}</span>
                  {c.tier === "pro" && <CrownIcon className="size-3.5 text-amber-500" />}
                </Link>
              </li>
            )
          })}
        </ol>
      </div>

      <Link href="/library" className="group flex items-center gap-3 rounded-2xl border bg-card p-4 text-sm hover:border-brand/40">
        <LibraryIcon className="size-4 text-brand" />
        <span className="flex-1">
          <span className="block font-medium group-hover:text-brand">Sources for this course</span>
          <span className="text-muted-foreground">Every lesson cites the papers and docs it&apos;s based on.</span>
        </span>
        <ArrowRightIcon className="size-4 text-muted-foreground" />
      </Link>
    </aside>
  )
}

