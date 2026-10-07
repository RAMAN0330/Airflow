"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRightIcon,
  BrainIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  GraduationCapIcon,
  LayersIcon,
  PartyPopperIcon,
  PlayIcon,
  RefreshCwIcon,
  RepeatIcon,
  SparklesIcon,
} from "lucide-react"

import { EASE, Reveal } from "@/components/motion/primitives"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import type { ReviewDeck } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"
import { previewInterval, useReviewStore, utcDay, type Grade } from "@/stores/review-store"

import { buildDeck, deckStats, type ReviewCard } from "./deck"
import { Flashcard } from "./flashcard"

const GRADES: { grade: Grade; label: string; className: string }[] = [
  { grade: 1, label: "Again", className: "border-destructive/40 text-destructive hover:bg-destructive/10" },
  { grade: 2, label: "Hard", className: "border-warning/50 text-warning hover:bg-warning/10" },
  { grade: 3, label: "Good", className: "border-success/40 text-success hover:bg-success/10" },
  { grade: 4, label: "Easy", className: "border-brand/40 text-brand hover:bg-brand/10" },
]

interface Session {
  queue: string[]
  pos: number
  reviewed: number
  correct: number
}

export function ReviewView() {
  const [deck, setDeck] = useState<ReviewDeck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [track, setTrack] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  const tracks = useCatalogStore((s) => s.tracks)
  const library = useCatalogStore((s) => s.library)
  const loadTracks = useCatalogStore((s) => s.loadTracks)
  const loadLibrary = useCatalogStore((s) => s.loadLibrary)

  const states = useReviewStore((s) => s.cards)
  const newIntroduced = useReviewStore((s) => s.newIntroduced)
  const reviewsByDay = useReviewStore((s) => s.reviewsByDay)
  const includeAllTerms = useReviewStore((s) => s.includeAllTerms)
  const setIncludeAllTerms = useReviewStore((s) => s.setIncludeAllTerms)

  const load = useCallback(() => {
    api
      .reviewCards()
      .then((d) => {
        setDeck(d)
        setError(null)
        setNow(Date.now())
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    load()
    loadTracks()
    loadLibrary()
  }, [load, loadTracks, loadLibrary])

  const cards = useMemo(() => (deck ? buildDeck(deck, library, includeAllTerms) : []), [deck, library, includeAllTerms])
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const trackTitle = useCallback((id: string) => tracks?.find((t) => t.id === id)?.title ?? id, [tracks])
  const trackIds = useMemo(() => Array.from(new Set(cards.map((c) => c.lesson.track_id))), [cards])
  const visible = useMemo(() => (track ? cards.filter((c) => c.lesson.track_id === track) : cards), [cards, track])
  const stats = useMemo(() => deckStats(visible, states, newIntroduced, now), [visible, states, newIntroduced, now])
  const dueToday = stats.due.length + Math.min(stats.newLeft, stats.fresh.length)
  const reviewedToday = now ? (reviewsByDay[utcDay(now)] ?? 0) : 0

  const start = (ahead = false) => {
    const t = Date.now()
    setNow(t)
    const s = deckStats(visible, useReviewStore.getState().cards, useReviewStore.getState().newIntroduced, t)
    let queue = [...s.due, ...s.fresh.slice(0, s.newLeft)].map((c) => c.id)
    if (ahead && queue.length === 0) {
      // Practice ahead: the cards coming due soonest, or a handful of new ones.
      const st = useReviewStore.getState().cards
      queue = visible
        .filter((c) => st[c.id])
        .sort((a, b) => st[a.id].due - st[b.id].due)
        .slice(0, 10)
        .map((c) => c.id)
      if (queue.length === 0) queue = s.fresh.slice(0, 10).map((c) => c.id)
    }
    setSession({ queue, pos: 0, reviewed: 0, correct: 0 })
  }

  if (error && !deck) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Couldn&apos;t load your review deck</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCwIcon /> Try again
          </Button>
        </div>
      </Shell>
    )
  }

  if (!deck || !now) {
    return (
      <Shell>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </Shell>
    )
  }

  if (session) {
    return (
      <Shell compact>
        <SessionView
          session={session}
          setSession={setSession}
          cardById={cardById}
          trackTitle={trackTitle}
          onExit={() => {
            setSession(null)
            setNow(Date.now())
          }}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      {cards.length === 0 ? (
        <EmptyDeck includeAllTerms={includeAllTerms} onIncludeAll={() => setIncludeAllTerms(true)} />
      ) : (
        <>
          <Reveal className="grid gap-4 sm:grid-cols-3" y={10}>
            <Stat
              icon={CalendarClockIcon}
              tone="text-brand"
              label="Due today"
              value={dueToday}
              sub={`${stats.due.length} reviews · ${Math.min(stats.newLeft, stats.fresh.length)} new`}
            />
            <Stat icon={RepeatIcon} tone="text-warning" label="Reviewed today" value={reviewedToday} sub={`${stats.learning} cards in rotation`} />
            <Stat
              icon={BrainIcon}
              tone="text-success"
              label="Mastered"
              value={stats.mastered}
              sub={`of ${visible.length} cards${stats.fresh.length ? ` · ${stats.fresh.length} unseen` : ""}`}
            />
          </Reveal>

          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center">
            <div role="radiogroup" aria-label="Filter by track" className="flex flex-wrap gap-1.5">
              <FilterChip active={!track} onClick={() => setTrack(null)}>
                All tracks
              </FilterChip>
              {trackIds.map((id) => (
                <FilterChip key={id} active={track === id} onClick={() => setTrack(id)}>
                  {trackTitle(id)}
                </FilterChip>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Switch id="all-terms" checked={includeAllTerms} onCheckedChange={setIncludeAllTerms} />
              <Label htmlFor="all-terms" className="text-sm font-normal text-muted-foreground">
                Include every glossary term
              </Label>
            </div>
          </div>

          <Card className="overflow-hidden py-0">
            <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              {dueToday > 0 ? (
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {dueToday} card{dueToday === 1 ? "" : "s"} ready for review
                  </h2>
                  <p className="max-w-xl text-sm text-muted-foreground">
                    Short daily sessions beat cramming. Flip each card, then rate how well you remembered it: cards you
                    know come back later, cards you miss come back sooner.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                    <CheckCircle2Icon className="size-5 text-success" /> All caught up
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {stats.nextDue
                      ? `Your next card comes due ${relativeFuture(stats.nextDue - now)}. Finish more lessons to grow your deck.`
                      : "Finish more lessons to grow your deck."}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {dueToday > 0 ? (
                  <Button size="lg" onClick={() => start()}>
                    <PlayIcon /> Start review
                  </Button>
                ) : (
                  <Button size="lg" variant="outline" onClick={() => start(true)}>
                    <SparklesIcon /> Practice ahead
                  </Button>
                )}
              </div>
            </CardContent>
            <Forecast forecast={stats.forecast} now={now} />
          </Card>
        </>
      )}
    </Shell>
  )
}

function relativeFuture(ms: number): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  const minutes = Math.max(1, Math.round(ms / 60_000))
  if (minutes < 60) return rtf.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (hours < 24) return rtf.format(hours, "hour")
  return rtf.format(Math.round(hours / 24), "day")
}

function Shell({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("mx-auto w-full space-y-6 px-4 py-8 sm:px-6 sm:py-12", compact ? "max-w-3xl" : "max-w-5xl")}>
      {!compact && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-brand">
            <RepeatIcon className="size-4" /> Review
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Keep it in your head</h1>
          <p className="max-w-2xl text-muted-foreground">
            Spaced repetition over the terms and quiz questions from lessons you&apos;ve finished. A few minutes a day is
            enough.
          </p>
        </div>
      )}
      {children}
    </div>
  )
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: string
  label: string
  value: number
  sub: string
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="flex items-center justify-between text-sm text-muted-foreground">
        {label} <Icon className={cn("size-4", tone)} />
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "border-brand/40 bg-brand/10 text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Forecast({ forecast, now }: { forecast: number[]; now: number }) {
  const max = Math.max(1, ...forecast)
  const fmt = new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" })
  return (
    <div className="border-t bg-muted/30 px-6 py-4 sm:px-8">
      <p className="mb-3 text-xs font-medium text-muted-foreground">Next 7 days</p>
      <ol className="grid h-20 grid-cols-7 items-end gap-2" aria-label="Cards due over the next 7 days">
        {forecast.map((n, i) => (
          <li key={i} className="flex h-full flex-col items-center justify-end gap-1">
            <span className="text-[11px] text-muted-foreground tabular-nums">{n || ""}</span>
            <motion.span
              className={cn("w-full max-w-10 rounded-t-sm", i === 0 ? "bg-brand" : "bg-brand/35")}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(n ? 8 : 2, (n / max) * 44)}px` }}
              transition={{ duration: 0.6, ease: EASE, delay: i * 0.04 }}
            />
            <span className="text-[11px] text-muted-foreground">{i === 0 ? "Today" : fmt.format(now + i * 86_400_000)}</span>
            <span className="sr-only">{`${n} cards`}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function EmptyDeck({ includeAllTerms, onIncludeAll }: { includeAllTerms: boolean; onIncludeAll: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand/10">
        <LayersIcon className="size-6 text-brand" />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Your deck is empty</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Pass a lesson quiz and its key terms and questions land here, ready for spaced review.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/learn">
            <GraduationCapIcon /> Start a lesson
          </Link>
        </Button>
        {!includeAllTerms && (
          <Button variant="outline" onClick={onIncludeAll}>
            Study the whole glossary
          </Button>
        )}
      </div>
    </div>
  )
}

function SessionView({
  session,
  setSession,
  cardById,
  trackTitle,
  onExit,
}: {
  session: Session
  setSession: React.Dispatch<React.SetStateAction<Session | null>>
  cardById: Map<string, ReviewCard>
  trackTitle: (id: string) => string
  onExit: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const grade = useReviewStore((s) => s.grade)
  const states = useReviewStore((s) => s.cards)

  const id = session.queue[session.pos]
  const card = id ? cardById.get(id) : undefined
  const done = !card
  const total = session.queue.length

  const flip = useCallback(() => setFlipped((f) => !f), [])
  const pick = useCallback(
    (i: number) => {
      setPicked(i)
      setFlipped(true)
    },
    []
  )

  const rate = useCallback(
    (g: Grade) => {
      if (!card || !flipped) return
      grade(card.id, g, Date.now())
      setFlipped(false)
      setPicked(null)
      setSession((s) =>
        s && {
          // "Again" puts the card back at the end of this session.
          queue: g === 1 ? [...s.queue, card.id] : s.queue,
          pos: s.pos + 1,
          reviewed: s.reviewed + 1,
          correct: s.correct + (g >= 3 ? 1 : 0),
        }
      )
    },
    [card, flipped, grade, setSession]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return
      if (done) return
      const onControl = el?.tagName === "BUTTON" || el?.tagName === "A"
      if (e.key === " " || (e.key === "Enter" && !flipped && !onControl)) {
        e.preventDefault()
        flip()
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        rate(Number(e.key) as Grade)
      } else if (!flipped && card?.kind === "quiz") {
        const i = "abcdef".indexOf(e.key.toLowerCase())
        if (i >= 0 && i < card.options.length) {
          e.preventDefault()
          pick(i)
        }
      }
    }
    // Space would also "click" a focused button on keyup; the shortcut owns it here.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " && (e.target as HTMLElement | null)?.tagName === "BUTTON") e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [card, done, flip, flipped, pick, rate])

  if (done) {
    const pct = session.reviewed ? Math.round((session.correct / session.reviewed) * 100) : 0
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-14 text-center"
      >
        <span className="grid size-14 place-items-center rounded-full bg-success/10">
          <PartyPopperIcon className="size-7 text-success" />
        </span>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Session complete</h2>
          <p className="text-sm text-muted-foreground">
            {session.reviewed === 0
              ? "Nothing to review right now."
              : `${session.reviewed} review${session.reviewed === 1 ? "" : "s"} · ${pct}% remembered`}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onExit}>Back to review</Button>
          <Button asChild variant="outline">
            <Link href="/learn">
              Keep learning <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </motion.div>
    )
  }

  const progress = (session.pos / total) * 100

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          End session
        </Button>
        <div className="flex-1">
          <Progress value={progress} className="h-1.5 bg-muted" indicatorClassName="bg-brand" aria-label="Session progress" />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {session.pos + 1} / {total}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${card.id}-${session.pos}`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25, ease: EASE }}
        >
          <Flashcard
            card={card}
            flipped={flipped}
            picked={picked}
            onFlip={flip}
            onPick={pick}
            trackTitle={trackTitle(card.lesson.track_id)}
          />
        </motion.div>
      </AnimatePresence>

      <div className={cn("transition-opacity", flipped ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!flipped}>
        <p className="mb-2 text-center text-xs text-muted-foreground">How well did you remember it?</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map(({ grade: g, label, className }) => (
            <button
              key={g}
              type="button"
              tabIndex={flipped ? 0 : -1}
              onClick={() => rate(g)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl border bg-background px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                className
              )}
            >
              <span className="flex items-center gap-2">
                <Kbd className="hidden sm:inline-flex">{g}</Kbd> {label}
              </span>
              <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                {/* Intervals are relative, so any reference time gives the same preview. */}
                {previewInterval(states[card.id], g, 0)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="hidden text-center text-xs text-muted-foreground sm:block">
        <Kbd>Space</Kbd> flip · <Kbd>1</Kbd>–<Kbd>4</Kbd> rate{card.kind === "quiz" && <> · <Kbd>A</Kbd>–<Kbd>D</Kbd> answer</>}
      </p>
    </div>
  )
}
