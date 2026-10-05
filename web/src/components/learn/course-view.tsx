"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ArrowRightIcon, ChevronLeftIcon, ClockIcon, PartyPopperIcon, SparklesIcon } from "lucide-react"

import { StepRow } from "@/components/learn/step-row"
import { LockNotice } from "@/components/lock-notice"
import { ProBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { plural } from "@/lib/format"
import { courseHref, stepHref } from "@/lib/links"
import type { StepSummary } from "@/lib/types"
import { useCatalogStore } from "@/stores/catalog-store"

export function CourseView({ courseId }: { courseId: string }) {
  const courses = useCatalogStore((s) => s.courses)
  const state = useCatalogStore((s) => s.coursesState)
  const load = useCatalogStore((s) => s.loadCourses)

  useEffect(() => {
    load()
  }, [load])

  if (!courses) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6">
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

  const nextCourse = courses.find((c) => c.position === course.position + 1)
  const released = course.modules.filter((m) => !m.coming_soon)
  const upcoming = course.modules.filter((m) => m.coming_soon)
  const steps = released.flatMap((m) => [m.lesson, m.exercise]).filter(Boolean) as StepSummary[]
  const current = steps.find((s) => s.status === "in_progress" || s.status === "available")
  const pct = course.total_steps ? (course.completed_steps / course.total_steps) * 100 : 0

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/learn" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> All courses
      </Link>

      <header className="mb-8 space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Course {course.position} of {courses.length} · {course.level}
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
          </div>
        )}
      </header>

      {course.status === "completed" && nextCourse && (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
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
        </div>
      )}

      <div className="space-y-8">
        {released.map((m, i) => {
          const items = [m.lesson, m.exercise].filter(Boolean) as StepSummary[]
          return (
            <section key={m.id} className="space-y-3">
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
              <ol className="space-y-3">
                {items.map((s, j) => (
                  <StepRow key={s.id} step={s} last={j === items.length - 1} />
                ))}
              </ol>
            </section>
          )
        })}
      </div>

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
  )
}
