"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ActivityIcon, CheckCircle2Icon, FlameIcon, RefreshCwIcon, SparklesIcon, TargetIcon, UserRoundXIcon } from "lucide-react"

import { ActivityHeatmap, currentStreak } from "@/components/progress/activity-heatmap"
import { RunStatusBadge, StatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { timeAgo } from "@/lib/format"
import { stepHref } from "@/lib/links"
import type { Progress as ProgressData } from "@/lib/types"
import { useCatalogStore } from "@/stores/catalog-store"
import { useEditorStore } from "@/stores/editor-store"
import { useSessionStore } from "@/stores/session-store"
import { useUserStore } from "@/stores/user-store"

export function ProgressView() {
  const progress = useCatalogStore((s) => s.progress)
  const state = useCatalogStore((s) => s.progressState)
  const error = useCatalogStore((s) => s.error)
  const load = useCatalogStore((s) => s.loadProgress)

  useEffect(() => {
    load({ force: true })
  }, [load])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your progress</h1>
          <p className="text-sm text-muted-foreground">Every run you make is graded and recorded here.</p>
        </div>
        <ResetIdentityButton />
      </div>

      {state === "error" && !progress ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Couldn&apos;t load your progress</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load({ force: true })}>
            <RefreshCwIcon /> Try again
          </Button>
        </div>
      ) : !progress ? (
        <ProgressSkeleton />
      ) : (
        <ProgressContent progress={progress} />
      )}
    </div>
  )
}

function ProgressContent({ progress }: { progress: ProgressData }) {
  const streak = currentStreak(progress.activity)
  const stats = [
    {
      label: "Total XP",
      value: progress.xp,
      sub: progress.rank ? `Rank #${progress.rank}` : "Not ranked yet",
      icon: SparklesIcon,
      tone: "text-brand",
    },
    {
      label: "Steps completed",
      value: progress.lessons_completed + progress.exercises_completed,
      sub: `${progress.lessons_completed}/${progress.total_lessons} lessons · ${progress.exercises_completed}/${progress.total_exercises} exercises`,
      icon: CheckCircle2Icon,
      tone: "text-success",
    },
    {
      label: "Pass rate",
      value: `${Math.round(progress.pass_rate * 100)}%`,
      sub: `${progress.total_submissions} submissions`,
      icon: TargetIcon,
      tone: "text-warning",
    },
    { label: "Day streak", value: streak, sub: streak ? "Keep it going" : "Run code today to start one", icon: FlameIcon, tone: "text-orange-500" },
  ]

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, tone }) => (
          <Card key={label} className="gap-2 py-5">
            <CardHeader className="px-5">
              <CardDescription className="flex items-center justify-between">
                {label}
                <Icon className={`size-4 ${tone}`} />
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Courses</CardTitle>
          <CardDescription>Courses unlock in order. Finish one to open the next.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {progress.courses.map((c, i) => {
            const pct = c.total_steps ? (c.completed_steps / c.total_steps) * 100 : 0
            return (
              <Link key={c.id} href={`/learn/${c.id}`} className="space-y-3 rounded-lg border p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Course {i + 1}</p>
                    <p className="font-medium">{c.title}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="space-y-1.5">
                  <Progress
                    value={pct}
                    className="h-1.5 bg-muted"
                    indicatorClassName={c.status === "completed" ? "bg-success" : "bg-brand"}
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {c.completed_steps}/{c.total_steps} steps
                  </p>
                </div>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Exercises</CardTitle>
            <CardDescription>Best score and status for every exercise, in course order.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="w-36">Best score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progress.exercises.map(({ exercise: ex, course_title, completed_at }) => (
                  <TableRow key={ex.id}>
                    <TableCell className="max-w-64">
                      <Link href={`/exercises/${ex.id}`} className="block truncate font-medium hover:underline">
                        {ex.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {course_title}
                        {completed_at && ` · completed ${timeAgo(completed_at)}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ex.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ex.attempts}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={(ex.best_score ?? 0) * 100}
                          className="h-1.5 bg-muted"
                          indicatorClassName={ex.status === "completed" ? "bg-success" : "bg-warning"}
                        />
                        <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                          {ex.best_score === null ? "–" : `${Math.round(ex.best_score * 100)}%`}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ActivityIcon className="size-4" /> Activity
            </CardTitle>
            <CardDescription>Last 12 weeks (UTC)</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityHeatmap activity={progress.activity} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {progress.recent.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">No submissions yet. Your first run will show up here.</p>
              {progress.next_up && (
                <Button asChild size="sm">
                  <Link href={stepHref(progress.next_up)}>Start {progress.next_up.title}</Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {progress.recent.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <RunStatusBadge status={s.status} className="w-20 justify-center" />
                  <Link href={`/exercises/${s.exercise_id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {progress.exercises.find((e) => e.exercise.id === s.exercise_id)?.exercise.title ?? s.exercise_id}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {s.passed_tests}/{s.total_tests}
                  </span>
                  <span className="hidden w-28 text-right text-xs text-muted-foreground sm:inline">{timeAgo(s.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function ResetIdentityButton() {
  const resetIdentity = useUserStore((s) => s.resetIdentity)
  const invalidate = useCatalogStore((s) => s.invalidate)
  const load = useCatalogStore((s) => s.loadProgress)

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRoundXIcon /> Start fresh
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Start over with a new learner profile?</AlertDialogTitle>
          <AlertDialogDescription>
            Progress is tied to an anonymous ID stored in this browser. This creates a new ID and clears your saved
            drafts. Your old submissions stay on the server but will no longer be linked to this browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              resetIdentity()
              useEditorStore.setState({ drafts: {} })
              useSessionStore.setState({ me: null })
              invalidate()
              load({ force: true })
            }}
          >
            Start fresh
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProgressSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
