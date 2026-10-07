"use client"

import { useEffect, useMemo } from "react"

import { AnimatedNumber } from "@/components/motion/primitives"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"

export interface CatalogCounts {
  tracks: number
  courses: number
  lessons: number
  exercises: number
}

/** Live catalog size from /api/tracks, so marketing copy never drifts from the real curriculum. */
export function useCatalogCounts(): { counts: CatalogCounts | null; failed: boolean } {
  const tracks = useCatalogStore((s) => s.tracks)
  const state = useCatalogStore((s) => s.tracksState)
  const load = useCatalogStore((s) => s.loadTracks)
  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    if (!tracks) return null
    const courses = tracks.flatMap((t) => t.courses)
    const modules = courses.flatMap((c) => c.modules).filter((m) => !m.coming_soon)
    return {
      tracks: tracks.length,
      courses: courses.length,
      lessons: modules.filter((m) => m.lesson).length,
      exercises: modules.filter((m) => m.exercise).length,
    }
  }, [tracks])

  return { counts, failed: !tracks && state === "error" }
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"]

/** "Four" (capitalized number word) for a live count, or `fallback` while loading. */
export function CountWord({ kind, fallback }: { kind: keyof CatalogCounts; fallback: string }) {
  const { counts } = useCatalogCounts()
  if (!counts) return <>{fallback}</>
  const n = counts[kind]
  return <>{WORDS[n] ?? n.toLocaleString()}</>
}

const STATS: { key: keyof CatalogCounts; label: string }[] = [
  { key: "tracks", label: "tracks" },
  { key: "courses", label: "courses" },
  { key: "lessons", label: "cited lessons" },
  { key: "exercises", label: "graded exercises" },
]

/** A row of live catalog numbers. Renders nothing if the API can't be reached. */
export function CatalogStats({ className }: { className?: string }) {
  const { counts, failed } = useCatalogCounts()
  if (failed) return null
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4", className)}>
      {STATS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-0.5 bg-card/80 px-5 py-4 backdrop-blur">
          <dt className="order-2 text-xs text-muted-foreground sm:text-sm">{label}</dt>
          <dd className="order-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {counts ? (
              <AnimatedNumber value={counts[key]} className="text-gradient-brand tabular-nums" />
            ) : (
              <Skeleton className="my-1 h-7 w-12" aria-label="Loading" />
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
