"use client"

import Link from "next/link"
import { useEffect } from "react"
import { ArrowRightIcon, BookOpenIcon, CodeIcon } from "lucide-react"

import { ProBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { plural } from "@/lib/format"
import { courseHref } from "@/lib/links"
import { useCatalogStore } from "@/stores/catalog-store"

export function CoursePreview() {
  const courses = useCatalogStore((s) => s.courses)
  const load = useCatalogStore((s) => s.loadCourses)
  useEffect(() => {
    load()
  }, [load])

  if (!courses) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {courses.map((c) => {
        const released = c.modules.filter((m) => !m.coming_soon)
        return (
          <li key={c.id}>
            <Link
              href={courseHref(c.id)}
              className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-full border-2 border-brand text-sm font-semibold text-brand">
                  {c.position}
                </span>
                {c.tier === "pro" ? <ProBadge /> : <Badge variant="secondary">Free</Badge>}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{c.level}</p>
                <h3 className="text-lg font-semibold tracking-tight">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.tagline}</p>
              </div>
              <ul className="space-y-1.5 text-sm">
                {c.modules.map((m) => (
                  <li key={m.id} className={m.coming_soon ? "flex items-center gap-2 text-muted-foreground/70" : "flex items-center gap-2"}>
                    {m.coming_soon ? (
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-brand" />
                    )}
                    <span className="truncate">{m.title}</span>
                    {m.coming_soon && <span className="ml-auto shrink-0 text-[11px]">soon</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <BookOpenIcon className="size-3.5" /> {plural(released.filter((m) => m.lesson).length, "lesson")}
                  </span>
                  <span className="flex items-center gap-1">
                    <CodeIcon className="size-3.5" /> {plural(released.filter((m) => m.exercise).length, "exercise")}
                  </span>
                </span>
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
