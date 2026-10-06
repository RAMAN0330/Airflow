"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { motion } from "motion/react"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  ClockIcon,
  CodeIcon,
  CrownIcon,
  DatabaseIcon,
  LayersIcon,
  LibraryIcon,
  LockIcon,
  RefreshCwIcon,
  TrophyIcon,
  UnlockIcon,
} from "lucide-react"

import { Onboarding } from "@/components/learn/onboarding"
import { LockNotice } from "@/components/lock-notice"
import { AnimatedNumber, EASE, Stagger, StaggerItem } from "@/components/motion/primitives"
import { ProBadge, StatusBadge } from "@/components/status-badge"
import { TrackIcon } from "@/components/track-icon"
import { initials } from "@/components/user-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useFreshUnlock } from "@/hooks/use-fresh-unlock"
import { plural } from "@/lib/format"
import { courseHref, stepHref } from "@/lib/links"
import type { Course, Track } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"
import { useSessionStore } from "@/stores/session-store"

export function CoursesView() {
  const tracks = useCatalogStore((s) => s.tracks)
  const state = useCatalogStore((s) => s.tracksState)
  const error = useCatalogStore((s) => s.error)
  const progress = useCatalogStore((s) => s.progress)
  const loadTracks = useCatalogStore((s) => s.loadTracks)
  const loadProgress = useCatalogStore((s) => s.loadProgress)
  const params = useSearchParams()
  const router = useRouter()
  const selected = params.get("track")

  useEffect(() => {
    loadTracks()
    loadProgress()
  }, [loadTracks, loadProgress])

  const visible = tracks?.filter((t) => !selected || t.id === selected) ?? null
  const select = (id: string | null) => router.replace(id ? `/learn?track=${id}` : "/learn", { scroll: false })

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8 2xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      {/* Track navigator */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <TrackNav tracks={tracks} selected={selected} onSelect={select} />
      </aside>

      <main className="min-w-0 space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-medium text-brand">Your learning paths</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Courses</h1>
          <p className="max-w-3xl text-muted-foreground">
            Three independent tracks. In each one, courses unlock in order, and every module pairs a short lesson
            with a graded coding exercise. Start any track whenever you like.
          </p>
        </header>

        <div className="2xl:hidden">
          <RailSummary />
        </div>

        <Onboarding show={progress?.xp === 0} next={progress?.next_up ?? null} />

        {state === "error" && !tracks ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">Couldn&apos;t load courses</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadTracks({ force: true })}>
              <RefreshCwIcon /> Try again
            </Button>
          </div>
        ) : !visible ? (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : (
          <Stagger className="space-y-12" step={0.12} key={selected ?? "all"}>
            {visible.map((t) => (
              <StaggerItem key={t.id} as="section" aria-labelledby={`track-${t.id}`}>
                <TrackSection track={t} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </main>

      <aside className="hidden 2xl:block">
        <div className="sticky top-20 space-y-5">
          <RailSummary vertical />
          <PracticeCard />
          <MiniLeaderboard />
        </div>
      </aside>
    </div>
  )
}

function TrackNav({
  tracks,
  selected,
  onSelect,
}: {
  tracks: Track[] | null
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  if (!tracks) return <Skeleton className="h-56 rounded-xl" />
  const all = tracks.reduce((a, t) => [a[0] + t.completed_steps, a[1] + t.total_steps], [0, 0])
  const items = [
    { id: null, title: "All tracks", done: all[0], total: all[1], icon: null as Track | null },
    ...tracks.map((t) => ({ id: t.id, title: t.title, done: t.completed_steps, total: t.total_steps, icon: t })),
  ]
  return (
    <nav aria-label="Tracks" className="space-y-1">
      <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tracks</p>
      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
        {items.map((it) => {
          const active = (selected ?? null) === it.id
          return (
            <button
              key={it.id ?? "all"}
              type="button"
              onClick={() => onSelect(it.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "relative flex min-w-48 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted lg:min-w-0",
                active && "text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="track-nav"
                  className="absolute inset-0 -z-10 rounded-xl border bg-card shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              {it.icon ? (
                <TrackIcon icon={it.icon.icon} trackId={it.icon.id} className="size-8 rounded-lg [&_svg]:size-4" />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  <LayersIcon className="size-4" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.title}</span>
                <span className="mt-1 flex items-center gap-2">
                  <Progress value={it.total ? (it.done / it.total) * 100 : 0} className="h-1 bg-muted" indicatorClassName="bg-brand" />
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {it.done}/{it.total}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function TrackSection({ track: t }: { track: Track }) {
  const pct = t.total_steps ? (t.completed_steps / t.total_steps) * 100 : 0
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        <TrackIcon icon={t.icon} trackId={t.id} className="size-12" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={`track-${t.id}`} className="text-2xl font-semibold tracking-tight">
            {t.title}
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{t.description}</p>
        </div>
        <div className="w-full space-y-1.5 sm:w-56">
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>
              {t.completed_steps}/{t.total_steps} steps
            </span>
            <span>{Math.round(pct)}%</span>
          </div>
          <Progress value={pct} className="h-1.5 bg-muted" indicatorClassName={t.status === "completed" ? "bg-success" : "bg-brand"} />
        </div>
      </div>
      <ol className="grid gap-4 xl:grid-cols-2">
        {t.courses.map((c, i) => (
          <CourseCard key={c.id} course={c} nextLocked={i < t.courses.length - 1} />
        ))}
      </ol>
    </div>
  )
}

function CourseCard({ course: c, nextLocked }: { course: Course; nextLocked: boolean }) {
  const pct = c.total_steps ? (c.completed_steps / c.total_steps) * 100 : 0
  const released = c.modules.filter((m) => !m.coming_soon)
  const locked = c.status === "locked" || c.status === "upgrade_required"
  const firstOpen = c.modules.flatMap((m) => [m.lesson, m.exercise]).find((s) => s && (s.status === "in_progress" || s.status === "available"))
  const justOpened = useFreshUnlock(c.completed_steps === 0 ? firstOpen?.id : undefined)

  return (
    <li
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md sm:p-6",
        (c.status === "available" || c.status === "in_progress") && "border-brand/40 ring-1 ring-brand/10",
        locked && "bg-muted/20",
        justOpened && "ring-2 ring-brand/50"
      )}
    >
      {justOpened && <span aria-hidden className="animate-shimmer pointer-events-none absolute inset-0" />}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
              c.status === "completed" && "border-success bg-success text-white",
              (c.status === "available" || c.status === "in_progress") && "border-brand text-brand",
              locked && "text-muted-foreground"
            )}
          >
            {c.status === "completed" ? <CheckIcon className="size-4" /> : c.status === "upgrade_required" ? <CrownIcon className="size-4 text-amber-500" /> : c.status === "locked" ? <LockIcon className="size-4" /> : c.position}
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Course {c.position} · {c.level}
            </p>
            <h3 className="text-lg leading-snug font-semibold">
              <Link href={courseHref(c.id)} className="hover:underline">
                {c.title}
              </Link>
            </h3>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {justOpened ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-brand-foreground">
              <UnlockIcon className="size-3.5" /> Unlocked
            </span>
          ) : (
            <StatusBadge status={c.status} />
          )}
          {c.tier === "pro" && c.status !== "upgrade_required" && <ProBadge />}
        </div>
      </div>

      <p className="relative text-sm text-muted-foreground">{c.tagline}</p>

      <ul className="relative grid gap-1.5 text-sm">
        {c.modules.map((m) => (
          <li key={m.id} className={cn("flex items-center gap-2", m.coming_soon && "text-muted-foreground/70")}>
            {m.coming_soon ? (
              <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            ) : m.exercise?.status === "completed" ? (
              <CheckIcon className="size-3.5 shrink-0 text-success" />
            ) : (
              <span className="size-1.5 shrink-0 rounded-full bg-brand" />
            )}
            <span className="truncate">{m.title}</span>
            {m.coming_soon && <span className="ml-auto shrink-0 text-[11px]">soon</span>}
          </li>
        ))}
      </ul>

      <div className="relative mt-auto space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpenIcon className="size-3.5" /> {plural(released.filter((m) => m.lesson).length, "lesson")}
          </span>
          <span className="flex items-center gap-1">
            <CodeIcon className="size-3.5" /> {plural(released.filter((m) => m.exercise).length, "exercise")}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3.5" /> ~{c.estimated_minutes} min
          </span>
          <span className="text-brand">+{c.total_xp} XP</span>
        </div>
        {!locked && (
          <Progress value={pct} className="h-1 bg-muted" indicatorClassName={c.status === "completed" ? "bg-success" : "bg-brand"} />
        )}
        {c.lock_reason ? (
          <LockNotice reason={c.lock_reason} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {c.status === "completed" ? (
              <Button asChild variant="outline" size="sm">
                <Link href={courseHref(c.id)}>Review course</Link>
              </Button>
            ) : firstOpen ? (
              <Button asChild size="sm">
                <Link href={stepHref(firstOpen)}>
                  {c.status === "in_progress" ? "Continue" : "Start"} <ArrowRightIcon />
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href={courseHref(c.id)}>Syllabus</Link>
            </Button>
          </div>
        )}
        {nextLocked && c.status !== "completed" && !locked && (
          <p className="text-[11px] text-muted-foreground">Finish this course to unlock the next one in the track.</p>
        )}
      </div>
    </li>
  )
}

function RailSummary({ vertical }: { vertical?: boolean }) {
  const progress = useCatalogStore((s) => s.progress)
  if (!progress) return <Skeleton className="h-40 rounded-2xl" />
  const next = progress.next_up
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-xs", vertical ? "space-y-4" : "grid items-center gap-4 sm:grid-cols-[1fr_auto]")}>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="XP" value={<AnimatedNumber value={progress.xp} />} />
        <Stat label="Lessons" value={`${progress.lessons_completed}/${progress.total_lessons}`} />
        <Stat label="Exercises" value={`${progress.exercises_completed}/${progress.total_exercises}`} />
      </div>
      {next ? (
        <Button asChild className="w-full justify-between sm:w-auto 2xl:w-full">
          <Link href={stepHref(next)}>
            <span className="truncate">
              {next.status === "in_progress" ? "Continue" : "Up next"}: {next.title}
            </span>
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link href="/pricing">
            <CrownIcon /> Unlock more with Pro
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

function PracticeCard() {
  return (
    <div className="space-y-3 rounded-2xl border bg-gradient-to-br from-sky-500/10 via-card to-card p-5">
      <p className="text-sm font-semibold">Practice & reference</p>
      <Link href="/playground" className="group flex items-start gap-3 rounded-xl p-2 -mx-2 hover:bg-muted/60">
        <DatabaseIcon className="mt-0.5 size-4 text-sky-500" />
        <span className="text-sm">
          <span className="block font-medium group-hover:text-brand">SQL Playground</span>
          <span className="text-muted-foreground">Run any query against a sample shop database.</span>
        </span>
      </Link>
      <Link href="/library" className="group flex items-start gap-3 rounded-xl p-2 -mx-2 hover:bg-muted/60">
        <LibraryIcon className="mt-0.5 size-4 text-brand" />
        <span className="text-sm">
          <span className="block font-medium group-hover:text-brand">Library & glossary</span>
          <span className="text-muted-foreground">Every cited paper, doc and book, plus key terms.</span>
        </span>
      </Link>
    </div>
  )
}

function MiniLeaderboard() {
  const board = useCatalogStore((s) => s.leaderboards.all)
  const load = useCatalogStore((s) => s.loadLeaderboard)
  const me = useSessionStore((s) => s.me)
  useEffect(() => {
    if (!board) load("all")
  }, [board, load])
  if (!board) return <Skeleton className="h-44 rounded-2xl" />
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <TrophyIcon className="size-4 text-amber-500" /> Top learners
        </p>
        <Link href="/leaderboard" className="text-xs text-brand hover:underline">
          View all
        </Link>
      </div>
      {board.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Be the first on the board: finish a lesson.</p>
      ) : (
        <ol className="space-y-2">
          {board.entries.slice(0, 3).map((e, i) => (
            <motion.li
              key={e.rank}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: i * 0.08 }}
              className={cn("flex items-center gap-2.5 text-sm", e.is_me && "font-semibold")}
            >
              <span className="w-4 text-xs text-muted-foreground tabular-nums">{e.rank}</span>
              <Avatar className="size-6">
                <AvatarFallback className="bg-muted text-[10px] font-semibold">{initials(e.display_name)}</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{e.display_name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{e.xp} XP</span>
            </motion.li>
          ))}
        </ol>
      )}
      {me?.rank && me.rank > 3 && <p className="text-xs text-muted-foreground">You&apos;re #{me.rank} with {me.xp} XP.</p>}
    </div>
  )
}
