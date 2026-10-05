"use client"

import Link from "next/link"
import { useEffect } from "react"
import { BookOpenIcon, ChevronRightIcon, ClockIcon, CrownIcon } from "lucide-react"

import { LockNotice } from "@/components/lock-notice"
import { Markdown } from "@/components/markdown"
import { Quiz } from "@/components/lesson/quiz"
import { ProBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { courseHref } from "@/lib/links"
import { useLessonStore } from "@/stores/lesson-store"

export function LessonView({ lessonId }: { lessonId: string }) {
  const open = useLessonStore((s) => s.open)
  const lesson = useLessonStore((s) => (s.lessonId === lessonId ? s.lesson : null))
  const loadError = useLessonStore((s) => s.loadError)

  useEffect(() => {
    open(lessonId)
  }, [lessonId, open])

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-4xl font-semibold">{loadError.status === 404 ? "404" : "Oops"}</p>
        <p className="text-sm text-muted-foreground">{loadError.status === 404 ? "That lesson doesn't exist." : loadError.message}</p>
        <Button asChild variant="outline">
          <Link href="/learn">All courses</Link>
        </Button>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const paywalled = lesson.lock_reason?.kind === "plan"

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/learn" className="hover:text-foreground">
          Courses
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <Link href={courseHref(lesson.course.id)} className="hover:text-foreground">
          {lesson.course.title}
        </Link>
        <ChevronRightIcon className="size-3.5" />
        <span>{lesson.module_title}</span>
      </nav>

      <header className="mb-8 space-y-3 border-b pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium tracking-wide uppercase">
            <BookOpenIcon className="size-3.5" /> Lesson
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3.5" /> {lesson.estimated_minutes} min read
          </span>
          <span className="text-brand">+{lesson.xp} XP</span>
          {lesson.course.tier === "pro" && !paywalled && <ProBadge />}
          <StatusBadge status={lesson.status} />
        </div>
        {lesson.lock_reason && <LockNotice reason={lesson.lock_reason} />}
        {lesson.status === "locked" && !paywalled && (
          <p className="text-xs text-muted-foreground">You can read ahead. The quiz unlocks when you reach this step.</p>
        )}
      </header>

      {paywalled ? (
        <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
          <CrownIcon className="mx-auto size-8 text-amber-500" />
          <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            This lesson is part of {lesson.course.title}, which is included with Pro.
          </p>
          <Button asChild>
            <Link href="/pricing">See Pro plans</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
          <div className="text-[15px] [&_.prose-task]:text-[15px] [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-10 [&_h2]:text-xl [&_p]:leading-7">
            <Markdown>{lesson.markdown}</Markdown>
          </div>
          <Quiz lesson={lesson} />
        </div>
      )}
    </article>
  )
}
