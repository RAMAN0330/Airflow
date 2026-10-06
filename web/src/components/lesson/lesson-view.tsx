"use client"

import Link from "next/link"
import { useEffect, useMemo } from "react"
import { BookOpenIcon, ChevronRightIcon, ClockIcon, CrownIcon, LibraryIcon } from "lucide-react"

import { KeyTerms, Takeaways } from "@/components/learning/aids"
import { CourseOutline } from "@/components/learning/course-outline"
import { FlowDiagram } from "@/components/learning/flow-diagram"
import { OnThisPage, type TocItem } from "@/components/learning/on-this-page"
import { ReadingProgress } from "@/components/learning/reading-progress"
import { SourceCard } from "@/components/learning/source-card"
import { Quiz } from "@/components/lesson/quiz"
import { LockNotice } from "@/components/lock-notice"
import { Markdown } from "@/components/markdown"
import { Reveal } from "@/components/motion/primitives"
import { ProBadge, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useFreshUnlock } from "@/hooks/use-fresh-unlock"
import { courseHref } from "@/lib/links"
import { markdownHeadings } from "@/lib/slug"
import { useLessonStore } from "@/stores/lesson-store"

export function LessonView({ lessonId }: { lessonId: string }) {
  const open = useLessonStore((s) => s.open)
  const lesson = useLessonStore((s) => (s.lessonId === lessonId ? s.lesson : null))
  const loadError = useLessonStore((s) => s.loadError)

  useEffect(() => {
    open(lessonId)
  }, [lessonId, open])
  useFreshUnlock(lessonId, { consume: true, after: 300 })

  const toc = useMemo<TocItem[]>(() => {
    if (!lesson || !lesson.markdown) return []
    const items: TocItem[] = []
    if (lesson.takeaways.length) items.push({ id: "takeaways", label: "Key takeaways" })
    if (lesson.flow) items.push({ id: "flow", label: lesson.flow.title })
    items.push(...markdownHeadings(lesson.markdown))
    if (lesson.terms.length) items.push({ id: "key-terms", label: "Key terms" })
    if (lesson.questions.length) items.push({ id: "quiz-title", label: "Check your understanding" })
    if (lesson.sources.length) items.push({ id: "sources", label: "Sources & further reading" })
    return items
  }, [lesson])

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
      <div className="mx-auto grid w-full max-w-[1600px] gap-10 px-4 py-10 sm:px-6 lg:px-8 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
        <Skeleton className="hidden h-96 rounded-xl xl:block" />
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="hidden h-64 rounded-xl xl:block" />
      </div>
    )
  }

  const paywalled = lesson.lock_reason?.kind === "plan"

  return (
    <>
      <ReadingProgress />
      <div className="mx-auto grid w-full max-w-[1600px] gap-10 px-4 py-8 sm:px-6 lg:px-8 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
        <aside className="hidden xl:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2">
            <CourseOutline course={lesson.course} outline={lesson.outline} currentId={lesson.id} />
          </div>
        </aside>

        <article className="mx-auto w-full min-w-0 max-w-3xl">
          <nav className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-foreground">
              {lesson.course.track_title}
            </Link>
            <ChevronRightIcon className="size-3.5" />
            <Link href={courseHref(lesson.course.id)} className="hover:text-foreground">
              {lesson.course.title}
            </Link>
            <ChevronRightIcon className="size-3.5" />
            <span>{lesson.module_title}</span>
          </nav>

          <header className="mb-8 space-y-4">
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
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{lesson.title}</h1>
            {lesson.summary && <p className="text-lg text-pretty text-muted-foreground">{lesson.summary}</p>}
            {lesson.lock_reason && <LockNotice reason={lesson.lock_reason} />}
            {lesson.status === "locked" && !paywalled && (
              <p className="text-xs text-muted-foreground">You can read ahead. The quiz unlocks when you reach this step.</p>
            )}
          </header>

          {paywalled ? (
            <div className="space-y-6">
              <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 text-center">
                <CrownIcon className="mx-auto size-8 text-amber-500" />
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  This lesson is part of {lesson.course.title}, which is included with Pro. Its sources are below, so
                  you can see what it builds on.
                </p>
                <Button asChild>
                  <Link href="/pricing">See Pro plans</Link>
                </Button>
              </div>
              <SourcesSection lesson={lesson} />
            </div>
          ) : (
            <Reveal className="space-y-10" y={12}>
              <Takeaways items={lesson.takeaways} />
              {lesson.flow && (
                <div id="flow" className="scroll-mt-24">
                  <FlowDiagram flow={lesson.flow} />
                </div>
              )}
              <div className="text-[15px] [&_.prose-task]:text-[15px] [&_h1]:hidden [&_h2]:mt-10 [&_h2]:text-xl [&_p]:leading-7">
                <Markdown>{lesson.markdown}</Markdown>
              </div>
              <KeyTerms terms={lesson.terms} />
              <Quiz lesson={lesson} />
              <SourcesSection lesson={lesson} />
            </Reveal>
          )}
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-20 space-y-8">
            <OnThisPage items={toc} />
            {lesson.sources.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Primary sources</p>
                <ul className="space-y-1.5 text-sm">
                  {lesson.sources.slice(0, 4).map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-muted-foreground hover:text-brand">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="link" size="sm" className="h-auto p-0 text-brand">
                  <Link href="/library">
                    <LibraryIcon /> Browse the library
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}

function SourcesSection({ lesson }: { lesson: { sources: import("@/lib/types").Source[] } }) {
  if (!lesson.sources.length) return null
  return (
    <section id="sources" className="scroll-mt-24 space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Sources & further reading</h2>
      <p className="text-sm text-muted-foreground">
        This lesson is based on primary sources: original papers, official documentation and standard texts.
        Read them to go deeper.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {lesson.sources.map((s) => (
          <SourceCard key={s.url} source={s} />
        ))}
      </div>
    </section>
  )
}
