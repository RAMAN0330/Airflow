"use client"

import { useCallback, useEffect } from "react"
import { motion } from "motion/react"
import {
  AlertTriangleIcon,
  ClockIcon,
  DatabaseIcon,
  HistoryIcon,
  KeyRoundIcon,
  LinkIcon,
  Loader2Icon,
  PlayIcon,
  SparklesIcon,
  TableIcon,
} from "lucide-react"

import { CodeEditor } from "@/components/code-editor"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { plural, timeAgo } from "@/lib/format"
import type { PlaygroundResultSet } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePlaygroundStore } from "@/stores/playground-store"

export function PlaygroundView() {
  const sql = usePlaygroundStore((s) => s.sql)
  const setSql = usePlaygroundStore((s) => s.setSql)
  const run = usePlaygroundStore((s) => s.run)
  const running = usePlaygroundStore((s) => s.running)
  const loadSchema = usePlaygroundStore((s) => s.loadSchema)

  useEffect(() => {
    loadSchema()
  }, [loadSchema])

  const onRun = useCallback(() => {
    run()
  }, [run])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        run()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [run])

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-400 text-white">
          <DatabaseIcon className="size-4" />
        </span>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold">SQL Playground</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            SQLite · sample shop database · every run starts from a fresh copy
          </p>
        </div>
        <MobileSamples />
        <Button size="sm" className="min-w-24 lg:ml-auto" onClick={onRun} disabled={running}>
          {running ? <Loader2Icon className="animate-spin" /> : <PlayIcon />}
          {running ? "Running" : "Run"}
          <Kbd className="ml-1 hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex">⌘↵</Kbd>
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-r lg:block">
          <SchemaPanel />
        </aside>
        <ResizablePanelGroup direction="vertical" autoSaveId="playground-v" className="min-h-0">
          <ResizablePanel defaultSize={45} minSize={20}>
            <CodeEditor language="sql" value={sql} onChange={setSql} onRun={onRun} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={55} minSize={20}>
            <ResultsPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

function MobileSamples() {
  const schema = usePlaygroundStore((s) => s.schema)
  const setSql = usePlaygroundStore((s) => s.setSql)
  if (!schema) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto lg:hidden">
          <SparklesIcon /> Samples
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {schema.samples.map((s) => (
          <DropdownMenuItem key={s.title} onSelect={() => setSql(s.sql)}>
            {s.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SchemaPanel() {
  const schema = usePlaygroundStore((s) => s.schema)
  const setSql = usePlaygroundStore((s) => s.setSql)
  const history = usePlaygroundStore((s) => s.history)

  if (!schema) {
    return (
      <div className="space-y-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        <section className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <TableIcon className="size-3.5" /> Tables
          </p>
          <p className="text-xs text-muted-foreground">{schema.description}</p>
          <Accordion type="multiple" defaultValue={["orders"]} className="rounded-lg border">
            {schema.tables.map((t) => (
              <AccordionItem key={t.name} value={t.name} className="px-3">
                <AccordionTrigger className="py-2.5 font-mono text-xs hover:no-underline">
                  <span className="flex flex-1 items-center gap-2">
                    {t.name}
                    <span className="ml-auto font-sans text-[11px] text-muted-foreground tabular-nums">{t.row_count} rows</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <ul className="space-y-1">
                    {t.columns.map((c) => (
                      <li key={c.name} className="flex items-center gap-1.5 font-mono text-[11px]">
                        {c.pk ? <KeyRoundIcon className="size-3 text-amber-500" /> : c.references ? <LinkIcon className="size-3 text-sky-500" /> : <span className="size-3" />}
                        <button type="button" className="hover:text-brand" onClick={() => setSql(`SELECT ${c.name}, COUNT(*) AS n\nFROM ${t.name}\nGROUP BY ${c.name}\nORDER BY n DESC\nLIMIT 20;`)}>
                          {c.name}
                        </button>
                        <span className="text-muted-foreground">{c.type.toLowerCase()}</span>
                        {c.references && <span className="ml-auto truncate text-sky-600 dark:text-sky-400">→ {c.references}</span>}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <SparklesIcon className="size-3.5" /> Try these
          </p>
          <ul className="space-y-1">
            {schema.samples.map((s) => (
              <li key={s.title}>
                <button type="button" onClick={() => setSql(s.sql)} className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted">
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {history.length > 0 && (
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <HistoryIcon className="size-3.5" /> Recent
            </p>
            <ul className="space-y-1">
              {history.slice(0, 6).map((h) => (
                <li key={h.at}>
                  <button type="button" onClick={() => setSql(h.sql)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted">
                    <span className="line-clamp-1 font-mono text-[11px]">{h.sql.replace(/\s+/g, " ")}</span>
                    <span className={cn("text-[11px]", h.ok ? "text-muted-foreground" : "text-destructive")}>
                      {h.ok ? "ran" : "failed"} {timeAgo(new Date(h.at).toISOString())}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ScrollArea>
  )
}

function ResultsPanel() {
  const result = usePlaygroundStore((s) => s.result)
  const running = usePlaygroundStore((s) => s.running)
  const active = usePlaygroundStore((s) => s.activeResult)
  const setActive = usePlaygroundStore((s) => s.setActiveResult)

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="grid size-10 place-items-center rounded-full bg-muted">
          <TableIcon className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Run a query to see results</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Pick a table or sample on the left, or write your own SQL. Press <Kbd>Ctrl</Kbd>
          <Kbd>Enter</Kbd> to run.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col transition-opacity", running && "opacity-50")}>
      <div className="flex h-10 shrink-0 items-center gap-3 border-b px-3 text-xs text-muted-foreground">
        <span>
          {result.statements} statement{result.statements === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <ClockIcon className="size-3" /> {result.duration_ms.toFixed(1)} ms
        </span>
        {result.error ? (
          <Badge variant="outline" className="ml-auto border-destructive/30 bg-destructive/10 text-destructive">
            Error
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto border-success/30 bg-success/10 text-success">
            OK
          </Badge>
        )}
      </div>
      {result.error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="m-3 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-mono text-xs text-destructive"
        >
          <AlertTriangleIcon className="size-4 shrink-0" /> {result.error}
        </motion.div>
      )}
      {result.results.length > 0 && (
        <Tabs value={String(active)} onValueChange={(v) => setActive(Number(v))} className="min-h-0 flex-1 gap-0">
          {result.results.length > 1 && (
            <div className="border-b px-3 py-1.5">
              <TabsList className="h-8">
                {result.results.map((r, i) => (
                  <TabsTrigger key={i} value={String(i)} className="text-xs">
                    #{r.statement} {r.columns.length ? `· ${plural(r.rows.length, "row")}` : "· done"}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          )}
          {result.results.map((r, i) => (
            <TabsContent key={i} value={String(i)} className="min-h-0">
              <ResultTable result={r} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

function ResultTable({ result: r }: { result: PlaygroundResultSet }) {
  if (!r.columns.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Statement {r.statement} ran{r.rows_affected != null ? ` and affected ${r.rows_affected} row${r.rows_affected === 1 ? "" : "s"}` : ""}.
        <span className="mt-1 block font-mono text-xs">{r.sql}</span>
      </p>
    )
  }
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse font-mono text-xs">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            <th className="w-10 border-b px-3 py-2 text-right font-normal text-muted-foreground">#</th>
            {r.columns.map((c, i) => (
              <th key={i} className="border-b px-3 py-2 text-left font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: Math.min(i, 20) * 0.015 }}
              className="border-b hover:bg-muted/40"
            >
              <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{i + 1}</td>
              {row.map((v, j) => (
                <td key={j} className={cn("px-3 py-1.5 whitespace-nowrap", typeof v === "number" && "text-right tabular-nums", v === null && "text-muted-foreground italic")}>
                  {v === null ? "NULL" : String(v)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
      {r.truncated && <p className="p-3 text-xs text-muted-foreground">Showing the first {r.rows.length} rows.</p>}
    </div>
  )
}
