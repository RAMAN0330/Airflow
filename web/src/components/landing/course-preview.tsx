"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ArrowRightIcon, CrownIcon } from "lucide-react"

import { Stagger, StaggerItem } from "@/components/motion/primitives"
import { TrackIcon } from "@/components/track-icon"
import { Skeleton } from "@/components/ui/skeleton"
import { plural } from "@/lib/format"
import { useCatalogStore } from "@/stores/catalog-store"

/** The three learning tracks with their courses in order, loaded live from the API. */
export function CoursePreview() {
  const tracks = useCatalogStore((s) => s.tracks)
  const load = useCatalogStore((s) => s.loadTracks)
  useEffect(() => {
    load()
  }, [load])

  if (!tracks) {
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-96 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <Stagger as="ol" inView step={0.12} className="grid gap-5 lg:grid-cols-3">
      {tracks.map((t) => {
        const exercises = t.courses.flatMap((c) => c.modules).filter((m) => m.exercise).length
        return (
          <StaggerItem as="li" key={t.id}>
            <Link
              href={`/learn?track=${t.id}`}
              className="group flex h-full flex-col gap-5 rounded-2xl border bg-card p-6 shadow-xs transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <TrackIcon icon={t.icon} trackId={t.id} className="size-11" />
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{t.title}</h3>
                  <p className="text-sm text-muted-foreground">{t.tagline}</p>
                </div>
              </div>
              <ol className="space-y-3">
                {t.courses.map((c, i) => (
                  <li key={c.id} className="relative flex gap-3">
                    {i < t.courses.length - 1 && <span className="absolute top-7 bottom-[-12px] left-[11px] w-px bg-border" aria-hidden />}
                    <span className="relative grid size-6 shrink-0 place-items-center rounded-full border-2 border-brand/60 bg-background text-[11px] font-semibold text-brand">
                      {c.position}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {c.title}
                        {c.tier === "pro" && <CrownIcon className="size-3.5 text-amber-500" aria-label="Pro" />}
                      </p>
                      <p className="flex flex-wrap gap-1">
                        {c.modules.filter((m) => !m.coming_soon).map((m) => (
                          <span key={m.id} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {m.title}
                          </span>
                        ))}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                <span>
                  {plural(t.courses.length, "course")} · {plural(exercises, "graded exercise")}
                </span>
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
              </div>
            </Link>
          </StaggerItem>
        )
      })}
    </Stagger>
  )
}
