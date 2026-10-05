"use client"

import Link from "next/link"
import { useEffect } from "react"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  CodeIcon,
  CrownIcon,
  LockIcon,
  RefreshCwIcon,
  TrophyIcon,
} from "lucide-react"

import { LockNotice } from "@/components/lock-notice"
import { ProBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { plural } from "@/lib/format"
import { courseHref, stepHref } from "@/lib/links"
import type { Course } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"
import { useSessionStore } from "@/stores/session-store"

export function CoursesView() {
  const courses = useCatalogStore((s) => s.courses)
  const state = useCatalogStore((s) => s.coursesState)
  const error = useCatalogStore((s) => s.error)
  const loadCourses = useCatalogStore((s) => s.loadCourses)
  const loadProgress = useCatalogStore((s) => s.loadProgress)

  useEffect(() => {
    loadCourses()
    loadProgress()
  }, [loadCourses, loadProgress])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="mb-10 grid items-end gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <p className="text-sm font-medium text-brand">Your learning path</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Courses</h1>
          <p className="max-w-xl text-muted-foreground">
            Work through each course in order. Every module pairs a short lesson with a graded coding exercise, and
            finishing a course unlocks the next one.
          </p>
        </div>
        <SummaryCard />
      </section>

      {state === "error" && !courses ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Couldn&apos;t load courses</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => loadCourses({ force: true })}>
            <RefreshCwIcon /> Try again
          </Button>
        </div>
      ) : !courses ? (
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (
        <ol className="space-y-6">
          {courses.map((c, i) => (
            <CourseCard key={c.id} course={c} last={i === courses.length - 1} />
          ))}
        </ol>
      )}
    </div>
  )
}

function SummaryCard() {
  const progress = useCatalogStore((s) => s.progress)
  const me = useSessionStore((s) => s.me)
  if (!progress) return <Skeleton className="h-[164px] rounded-xl" />
  const next = progress.next_up
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="XP" value={progress.xp} />
        <Stat label="Lessons" value={`${progress.lessons_completed}/${progress.total_lessons}`} />
        <Stat label="Exercises" value={`${progress.exercises_completed}/${progress.total_exercises}`} />
      </div>
      {next ? (
        <Button asChild className="w-full justify-between">
          <Link href={stepHref(next)}>
            <span className="truncate">
              {next.status === "in_progress" ? "Continue" : "Up next"}: {next.title}
            </span>
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : me?.plan !== "pro" && progress.courses.some((c) => c.status === "upgrade_required") ? (
        <Button asChild className="w-full">
          <Link href="/pricing">
            <CrownIcon /> Upgrade to continue
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link href="/leaderboard">
            <TrophyIcon /> See the leaderboard
          </Link>
        </Button>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function CourseCard({ course: c, last }: { course: Course; last: boolean }) {
  const pct = c.total_steps ? (c.completed_steps / c.total_steps) * 100 : 0
  const released = c.modules.filter((m) => !m.coming_soon)
  const locked = c.status === "locked" || c.status === "upgrade_required"
  const firstOpen = c.modules
    .flatMap((m) => [m.lesson, m.exercise])
    .find((s) => s && (s.status === "in_progress" || s.status === "available"))

  return (
    <li className="relative grid gap-4 sm:grid-cols-[2.75rem_1fr]">
      <div className="hidden flex-col items-center sm:flex">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-full border-2 bg-background text-sm font-semibold",
            c.status === "completed" && "border-success bg-success text-white",
            (c.status === "available" || c.status === "in_progress") && "border-brand text-brand",
            locked && "border-border text-muted-foreground"
          )}
        >
          {c.status === "completed" ? (
            <CheckIcon className="size-5" />
          ) : c.status === "upgrade_required" ? (
            <CrownIcon className="size-4 text-amber-500" />
          ) : c.status === "locked" ? (
            <LockIcon className="size-4" />
          ) : (
            c.position
          )}
        </span>
        {!last && <span className="mt-2 w-0.5 flex-1 bg-border" />}
      </div>

      <div
        className={cn(
          "space-y-5 rounded-xl border bg-card p-5 shadow-xs sm:p-6",
          (c.status === "available" || c.status === "in_progress") && "border-brand/40 ring-1 ring-brand/10",
          locked && "bg-muted/20"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Course {c.position} · {c.level}
            </p>
            <h2 className="text-xl font-semibold tracking-tight">
              <Link href={courseHref(c.id)} className="hover:underline">
                {c.title}
              </Link>
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">{c.tagline}</p>
          </div>
          <div className="flex items-center gap-2">
            {c.tier === "pro" && c.status !== "upgrade_required" && <ProBadge />}
            <StatusBadge status={c.status} />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpenIcon className="size-4" /> {plural(released.filter((m) => m.lesson).length, "lesson")}
          </span>
          <span className="flex items-center gap-1.5">
            <CodeIcon className="size-4" /> {plural(released.filter((m) => m.exercise).length, "exercise")}
          </span>
          <span className="flex items-center gap-1.5">
            <ClockIcon className="size-4" /> ~{c.estimated_minutes} min
          </span>
          <span className="text-brand">+{c.total_xp} XP</span>
          {c.modules.length > released.length && (
            <span>{plural(c.modules.length - released.length, "more module")} coming soon</span>
          )}
        </div>

        {!locked && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {c.completed_steps} of {c.total_steps} steps
              </span>
              <span>{Math.round(pct)}%</span>
            </div>
            <Progress
              value={pct}
              className="h-1.5 bg-muted"
              indicatorClassName={c.status === "completed" ? "bg-success" : "bg-brand"}
            />
          </div>
        )}

        {c.lock_reason && <LockNotice reason={c.lock_reason} />}

        <div className="flex flex-wrap gap-2">
          {c.status === "completed" ? (
            <Button asChild variant="outline">
              <Link href={courseHref(c.id)}>Review course</Link>
            </Button>
          ) : !locked && firstOpen ? (
            <Button asChild>
              <Link href={stepHref(firstOpen)}>
                {c.status === "in_progress" ? "Continue" : "Start course"}: {firstOpen.title}
                <ArrowRightIcon />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link href={courseHref(c.id)}>{locked ? "Preview syllabus" : "View syllabus"}</Link>
          </Button>
        </div>
      </div>
    </li>
  )
}
