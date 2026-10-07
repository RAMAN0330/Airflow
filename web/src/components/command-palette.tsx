"use client"

import { useRouter } from "next/navigation"
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  ArrowRightIcon,
  BarChart3Icon,
  BookMarkedIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  CodeIcon,
  CornerDownLeftIcon,
  CrownIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GraduationCapIcon,
  HomeIcon,
  LayersIcon,
  LibraryIcon,
  Loader2Icon,
  LockIcon,
  MapIcon,
  RepeatIcon,
  SearchIcon,
  SparklesIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { fuzzyRank } from "@/lib/fuzzy"
import { courseHref, stepHref } from "@/lib/links"
import type { CourseStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"

export const OPEN_COMMAND_PALETTE = "open-command-palette"

/** Opens the palette from anywhere (e.g. a header search button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE))
}

type Group = "Pages" | "Tracks" | "Courses" | "Lessons" | "Exercises" | "Glossary" | "Sources"
const GROUP_ORDER: Group[] = ["Pages", "Tracks", "Courses", "Lessons", "Exercises", "Glossary", "Sources"]

interface Item {
  id: string
  group: Group
  title: string
  subtitle?: string
  keywords?: string
  icon: LucideIcon
  status?: CourseStatus
  href: string
  external?: boolean
}

interface Ranked extends Item {
  score: number
  positions: number[]
}

const PAGES: Item[] = [
  { id: "page:home", group: "Pages", title: "Home", href: "/", icon: HomeIcon, keywords: "landing start" },
  { id: "page:learn", group: "Pages", title: "Courses", href: "/learn", icon: GraduationCapIcon, keywords: "learn tracks catalog" },
  { id: "page:map", group: "Pages", title: "Skill map", href: "/map", icon: MapIcon, keywords: "graph tree roadmap path" },
  { id: "page:review", group: "Pages", title: "Review", href: "/review", icon: RepeatIcon, keywords: "flashcards spaced repetition practice" },
  { id: "page:progress", group: "Pages", title: "My progress", href: "/progress", icon: BarChart3Icon, keywords: "stats streak xp" },
  { id: "page:leaderboard", group: "Pages", title: "Leaderboard", href: "/leaderboard", icon: TrophyIcon, keywords: "rank xp" },
  { id: "page:library", group: "Pages", title: "Library", href: "/library", icon: LibraryIcon, keywords: "sources glossary papers" },
  { id: "page:playground", group: "Pages", title: "SQL playground", href: "/playground", icon: DatabaseIcon, keywords: "sql query" },
  { id: "page:pricing", group: "Pages", title: "Pricing", href: "/pricing", icon: CrownIcon, keywords: "pro plan upgrade" },
]

const STATUS_META: Record<CourseStatus, { icon: LucideIcon; label: string; className: string }> = {
  completed: { icon: CheckCircle2Icon, label: "Completed", className: "text-success" },
  in_progress: { icon: CircleDotIcon, label: "In progress", className: "text-warning" },
  available: { icon: CircleDashedIcon, label: "Available", className: "text-brand" },
  locked: { icon: LockIcon, label: "Locked", className: "text-muted-foreground" },
  upgrade_required: { icon: CrownIcon, label: "Pro", className: "text-amber-600 dark:text-amber-400" },
}

const EMPTY_LIMIT: Partial<Record<Group, number>> = { Pages: 9, Tracks: 6 }
const QUERY_LIMIT = 6

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const tracks = useCatalogStore((s) => s.tracks)
  const tracksState = useCatalogStore((s) => s.tracksState)
  const library = useCatalogStore((s) => s.library)
  const libraryState = useCatalogStore((s) => s.libraryState)
  const loadTracks = useCatalogStore((s) => s.loadTracks)
  const loadLibrary = useCatalogStore((s) => s.loadLibrary)

  const show = useCallback(() => {
    setQuery("")
    setActive(0)
    setOpen(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        if (open) setOpen(false)
        else show()
      }
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_COMMAND_PALETTE, show)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_COMMAND_PALETTE, show)
    }
  }, [open, show])

  useEffect(() => {
    if (!open) return
    loadTracks()
    loadLibrary()
  }, [open, loadTracks, loadLibrary])

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [...PAGES]
    for (const t of tracks ?? []) {
      out.push({
        id: `track:${t.id}`, group: "Tracks", title: t.title, subtitle: t.tagline, href: `/learn?track=${t.id}`,
        icon: LayersIcon, status: t.status, keywords: t.description,
      })
      for (const c of t.courses) {
        out.push({
          id: `course:${c.id}`, group: "Courses", title: c.title, subtitle: `${t.title} · Course ${c.position}`,
          href: courseHref(c.id), icon: GraduationCapIcon, status: c.status, keywords: `${c.tagline} ${c.level}`,
        })
        for (const m of c.modules) {
          const concepts = m.concepts.join(" ")
          if (m.lesson) {
            out.push({
              id: `lesson:${m.lesson.id}`, group: "Lessons", title: m.lesson.title, subtitle: `${c.title} · ${m.title}`,
              href: stepHref(m.lesson), icon: BookOpenIcon, status: m.lesson.status, keywords: `${m.title} ${concepts}`,
            })
          }
          if (m.exercise) {
            out.push({
              id: `exercise:${m.exercise.id}`, group: "Exercises", title: m.exercise.title, subtitle: `${c.title} · ${m.title}`,
              href: stepHref(m.exercise), icon: CodeIcon, status: m.exercise.status, keywords: `${m.title} ${concepts}`,
            })
          }
        }
      }
    }
    for (const term of library?.terms ?? []) {
      out.push({
        id: `term:${term.lesson.id}:${term.term}`, group: "Glossary", title: term.term, subtitle: term.definition,
        href: `/lessons/${term.lesson.id}`, icon: BookMarkedIcon, keywords: term.lesson.title,
      })
    }
    for (const src of library?.sources ?? []) {
      out.push({
        id: `source:${src.url}`, group: "Sources", title: src.title,
        subtitle: [src.author, src.publisher, src.year].filter(Boolean).join(" · ") || src.kind,
        href: src.url, external: true, icon: ExternalLinkIcon, keywords: `${src.kind} ${src.lessons.map((l) => l.title).join(" ")}`,
      })
    }
    return out
  }, [tracks, library])

  const groups = useMemo(() => {
    const q = query.trim()
    const byGroup = new Map<Group, Ranked[]>()
    for (const item of items) {
      if (!q && !EMPTY_LIMIT[item.group]) continue
      const m = fuzzyRank(q, item.title, `${item.subtitle ?? ""} ${item.keywords ?? ""}`)
      if (!m) continue
      const list = byGroup.get(item.group) ?? []
      list.push({ ...item, ...m })
      byGroup.set(item.group, list)
    }
    return GROUP_ORDER.flatMap((g) => {
      const list = byGroup.get(g)
      if (!list?.length) return []
      if (q) list.sort((a, b) => b.score - a.score)
      return [{ group: g, items: list.slice(0, q ? QUERY_LIMIT : EMPTY_LIMIT[g]) }]
    }).map((g, gi, all) => ({ ...g, start: all.slice(0, gi).reduce((n, x) => n + x.items.length, 0) }))
  }, [items, query])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0))
  const activeItem = flat[activeIndex]

  useEffect(() => {
    if (!activeItem) return
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, activeItem])

  const select = useCallback(
    (item: Item) => {
      setOpen(false)
      if (item.external) window.open(item.href, "_blank", "noopener,noreferrer")
      else router.push(item.href)
    },
    [router]
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!flat.length) return
    const move = (to: number) => {
      e.preventDefault()
      setActive((to + flat.length) % flat.length)
    }
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) move(activeIndex + 1)
    else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) move(activeIndex - 1)
    else if (e.key === "Home" && e.ctrlKey) move(0)
    else if (e.key === "End" && e.ctrlKey) move(flat.length - 1)
    else if (e.key === "PageDown") move(Math.min(activeIndex + 5, flat.length - 1))
    else if (e.key === "PageUp") move(Math.max(activeIndex - 5, 0))
    else if (e.key === "Enter" && activeItem) {
      e.preventDefault()
      select(activeItem)
    }
  }

  const loading = (tracksState === "loading" && !tracks) || (libraryState === "loading" && !library)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 sm:max-w-xl"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, courses, lessons, exercises, glossary terms and sources. Use the arrow keys to move and Enter to open.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-4">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Search courses, lessons, terms…"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeItem ? `${listId}-${activeIndex}` : undefined}
            spellCheck={false}
            autoComplete="off"
          />
          {loading && <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
          <Kbd className="hidden sm:inline-flex">Esc</Kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="max-h-[min(60vh,28rem)] overflow-y-auto overscroll-contain p-2">
          {flat.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <SparklesIcon className="size-5 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No matches for “{query.trim()}”</p>
              <p className="text-xs text-muted-foreground">Try a concept like “attention”, “SQL join” or “gradient”.</p>
            </div>
          ) : (
            groups.map(({ group, items: groupItems, start }) => (
              <div key={group} role="group" aria-labelledby={`${listId}-g-${group}`} className="pb-1">
                <p id={`${listId}-g-${group}`} className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {group}
                </p>
                {groupItems.map((item, j) => {
                  const i = start + j
                  const selected = i === activeIndex
                  const status = item.status ? STATUS_META[item.status] : null
                  const Icon = item.icon
                  return (
                    <div
                      key={item.id}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={selected}
                      onMouseMove={() => !selected && setActive(i)}
                      onClick={() => select(item)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm",
                        selected ? "bg-accent text-accent-foreground" : "text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-md border bg-background",
                          selected && "border-brand/40 text-brand"
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          <Highlight text={item.title} positions={item.positions} />
                        </span>
                        {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                      </span>
                      {status && (
                        <span className={cn("flex shrink-0 items-center gap-1 text-xs", status.className)} title={status.label}>
                          <status.icon className="size-3.5" aria-hidden />
                          <span className="sr-only sm:not-sr-only">{status.label}</span>
                        </span>
                      )}
                      {selected && (item.external ? (
                        <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      ) : (
                        <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      ))}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="hidden items-center gap-4 border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>
              <CornerDownLeftIcon />
            </Kbd>
            to open
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd> to toggle
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Highlight({ text, positions }: { text: string; positions: number[] }) {
  if (!positions.length) return <>{text}</>
  const set = new Set(positions)
  const parts: { s: string; hit: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i)
    const last = parts[parts.length - 1]
    if (last && last.hit === hit) last.s += text[i]
    else parts.push({ s: text[i], hit })
  }
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-[2px] bg-brand/15 text-inherit">
            {p.s}
          </mark>
        ) : (
          <Fragment key={i}>{p.s}</Fragment>
        )
      )}
    </>
  )
}
