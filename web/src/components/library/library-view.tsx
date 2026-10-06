"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { BookMarkedIcon, LibraryIcon, SearchIcon, XIcon } from "lucide-react"

import { KIND, SourceCard } from "@/components/learning/source-card"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"
import { TrackIcon } from "@/components/track-icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SourceKind } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"

export function LibraryView() {
  const library = useCatalogStore((s) => s.library)
  const tracks = useCatalogStore((s) => s.tracks)
  const loadLibrary = useCatalogStore((s) => s.loadLibrary)
  const loadTracks = useCatalogStore((s) => s.loadTracks)
  const [query, setQuery] = useState("")
  const [track, setTrack] = useState<string | null>(null)
  const [kind, setKind] = useState<SourceKind | null>(null)

  useEffect(() => {
    loadLibrary()
    loadTracks()
  }, [loadLibrary, loadTracks])

  const q = query.trim().toLowerCase()
  const sources = useMemo(
    () =>
      (library?.sources ?? []).filter(
        (s) =>
          (!track || s.track_ids.includes(track)) &&
          (!kind || s.kind === kind) &&
          (!q || [s.title, s.author, s.publisher, ...s.lessons.map((l) => l.title)].join(" ").toLowerCase().includes(q))
      ),
    [library, track, kind, q]
  )
  const terms = useMemo(
    () =>
      (library?.terms ?? []).filter(
        (t) => (!track || t.lesson.track_id === track) && (!q || `${t.term} ${t.definition}`.toLowerCase().includes(q))
      ),
    [library, track, q]
  )
  const letters = useMemo(() => Array.from(new Set(terms.map((t) => t.term[0].toUpperCase()))), [terms])
  const trackTitle = (id: string) => tracks?.find((t) => t.id === id)?.title ?? id

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Reveal className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-brand">
            <LibraryIcon className="size-4" /> Library
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Trusted sources & glossary</h1>
          <p className="max-w-3xl text-muted-foreground">
            Every lesson is grounded in primary sources: the original papers, official documentation and standard
            textbooks. Here they all are, plus every key term, linked back to the lesson that teaches it.
          </p>
        </div>
        {library && (
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{library.sources.length}</p>
              <p className="text-muted-foreground">sources</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{library.terms.length}</p>
              <p className="text-muted-foreground">terms</p>
            </div>
          </div>
        )}
      </Reveal>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, authors, terms…"
            className="h-10 pl-9"
            aria-label="Search the library"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!track} onClick={() => setTrack(null)}>
            All tracks
          </Chip>
          {tracks?.map((t) => (
            <Chip key={t.id} active={track === t.id} onClick={() => setTrack(track === t.id ? null : t.id)}>
              <TrackIcon icon={t.icon} trackId={t.id} className="size-4 rounded [&_svg]:size-2.5" /> {t.title}
            </Chip>
          ))}
        </div>
      </div>

      {!library ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="sources" className="gap-6">
          <TabsList className="h-10">
            <TabsTrigger value="sources" className="px-4">
              <LibraryIcon /> Sources <span className="text-muted-foreground tabular-nums">{sources.length}</span>
            </TabsTrigger>
            <TabsTrigger value="glossary" className="px-4">
              <BookMarkedIcon /> Glossary <span className="text-muted-foreground tabular-nums">{terms.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
              <Chip active={!kind} onClick={() => setKind(null)}>
                All types
              </Chip>
              {(Object.keys(KIND) as SourceKind[]).map((k) => {
                const K = KIND[k]
                return (
                  <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>
                    <K.icon className="size-3.5" /> {K.label}
                  </Chip>
                )
              })}
            </div>
            {sources.length === 0 ? (
              <Empty onReset={() => { setQuery(""); setKind(null); setTrack(null) }} />
            ) : (
              <Stagger key={`${track}-${kind}-${q}`} step={0.03} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {sources.map((s) => (
                  <StaggerItem key={s.url}>
                    <SourceCard source={s}>
                      <span className="flex flex-wrap gap-1 border-t pt-2">
                        {s.lessons.map((l) => (
                          <span key={l.id} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {l.title}
                          </span>
                        ))}
                      </span>
                    </SourceCard>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </TabsContent>

          <TabsContent value="glossary" className="space-y-5">
            <nav aria-label="Jump to letter" className="flex flex-wrap gap-1">
              {letters.map((l) => (
                <a key={l} href={`#letter-${l}`} className="grid size-8 place-items-center rounded-md border text-sm font-medium hover:border-brand hover:text-brand">
                  {l}
                </a>
              ))}
            </nav>
            {terms.length === 0 ? (
              <Empty onReset={() => { setQuery(""); setTrack(null) }} />
            ) : (
              <div className="space-y-8">
                {letters.map((letter) => (
                  <section key={letter} id={`letter-${letter}`} className="scroll-mt-24 space-y-3">
                    <h2 className="text-lg font-semibold text-brand">{letter}</h2>
                    <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {terms
                        .filter((t) => t.term[0].toUpperCase() === letter)
                        .map((t) => (
                          <div key={`${t.term}-${t.lesson.id}`} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
                            <dt className="font-semibold">{t.term}</dt>
                            <dd className="text-sm text-muted-foreground">{t.definition}</dd>
                            <dd className="mt-auto pt-1 text-xs">
                              <Link href={`/lessons/${t.lesson.id}`} className="text-brand hover:underline">
                                {t.lesson.title}
                              </Link>
                              <span className="text-muted-foreground"> · {trackTitle(t.lesson.track_id)}</span>
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </section>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        active ? "border-brand bg-brand text-brand-foreground" : "bg-background text-muted-foreground hover:border-brand/50 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function Empty({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
      <p className="font-medium">Nothing matches those filters</p>
      <Button variant="outline" size="sm" onClick={onReset}>
        Clear filters
      </Button>
    </div>
  )
}
