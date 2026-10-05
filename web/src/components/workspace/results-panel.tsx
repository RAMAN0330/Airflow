"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  FlaskConicalIcon,
  LightbulbIcon,
  Loader2Icon,
  TerminalIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"
import { RunStatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Kbd } from "@/components/ui/kbd"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { prettyTestName } from "@/lib/format"
import type { RunResult, TestResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useWorkspaceStore, type ResultsTab } from "@/stores/workspace-store"

export function ResultsPanel() {
  const result = useWorkspaceStore((s) => s.result)
  const running = useWorkspaceStore((s) => s.running)
  const tab = useWorkspaceStore((s) => s.resultsTab)
  const setTab = useWorkspaceStore((s) => s.setResultsTab)

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ResultsTab)} className="h-full gap-0">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b px-3">
        <TabsList className="h-8">
          <TabsTrigger value="tests" className="text-xs">
            <FlaskConicalIcon /> Tests
            {result && result.total_tests > 0 && (
              <span className="text-muted-foreground tabular-nums">
                {result.passed_tests}/{result.total_tests}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="output" className="text-xs">
            <TerminalIcon /> Output
          </TabsTrigger>
          <TabsTrigger value="errors" className="text-xs">
            <TriangleAlertIcon /> Errors
            {result?.stderr && <span className="size-1.5 rounded-full bg-destructive" />}
          </TabsTrigger>
        </TabsList>
        {result && !running && <ResultSummary result={result} />}
        {running && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" /> Running hidden tests in the sandbox…
          </span>
        )}
      </div>

      <div className={cn("min-h-0 flex-1 transition-opacity", running && "opacity-50")}>
        {!result ? (
          <EmptyState />
        ) : (
          <>
            <TabsContent value="tests" className="h-full">
              <ScrollArea className="h-full">
                <TestsView result={result} />
              </ScrollArea>
            </TabsContent>
            <TabsContent value="output" className="h-full">
              <StreamView text={result.stdout} empty="Your code didn't print anything. Use print() to inspect values." />
            </TabsContent>
            <TabsContent value="errors" className="h-full">
              <StreamView text={result.stderr} empty="No errors." tone="error" />
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  )
}

function ResultSummary({ result }: { result: RunResult }) {
  return (
    <div className="ml-auto flex items-center gap-3">
      <span className="hidden items-center gap-1 text-xs text-muted-foreground tabular-nums sm:flex">
        <ClockIcon className="size-3" />
        {(result.duration_ms / 1000).toFixed(2)}s
      </span>
      <RunStatusBadge status={result.status} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-muted">
        <FlaskConicalIcon className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No results yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Run your code to check it against the hidden test suite. Press <Kbd>Ctrl</Kbd>
        <Kbd>Enter</Kbd> from the editor.
      </p>
    </div>
  )
}

function TestsView({ result }: { result: RunResult }) {
  if (result.status === "timeout") {
    return (
      <div className="p-4">
        <Alert className="border-warning/40">
          <ClockIcon className="text-warning" />
          <AlertTitle>Execution timed out</AlertTitle>
          <AlertDescription>
            Your code ran past the sandbox time limit. Look for an infinite loop or an unvectorized loop over a large array.
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  if (result.status === "error" && result.total_tests === 0) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Your code couldn&apos;t be loaded</AlertTitle>
          <AlertDescription>
            The tests never ran. This is usually a syntax error or a failing import. See the Errors tab for the traceback.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const failed = result.tests.filter((t) => t.outcome !== "passed")
  const passed = result.tests.filter((t) => t.outcome === "passed")

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            <AnimatedNumber value={result.passed_tests} /> of {result.total_tests} tests passing
          </span>
          <AnimatedNumber value={result.score * 100} format={(n) => `${Math.round(n)}%`} className="text-muted-foreground tabular-nums" />
        </div>
        <Progress
          value={result.score * 100}
          className="h-1.5 bg-muted"
          indicatorClassName={result.status === "passed" ? "bg-success" : "bg-brand"}
        />
      </div>

      {result.remediation.map((r) => (
        <Reveal key={r.tag} y={8}>
        <Alert className="border-brand/30 bg-brand/5">
          <LightbulbIcon className="text-brand" />
          <AlertTitle>Mentor tip</AlertTitle>
          <AlertDescription>
            <p>{r.hint}</p>
            {r.exercise && (
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-brand">
                <Link href={`/exercises/${r.exercise}`}>
                  Review a foundational exercise <ArrowRightIcon />
                </Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
        </Reveal>
      ))}

      <Stagger as="ul" step={0.035} key={`${result.status}-${result.duration_ms}-${result.passed_tests}`} className="divide-y overflow-hidden rounded-lg border">
        {failed.map((t, i) => (
          <FailedTestRow key={t.name} test={t} defaultOpen={i === 0} />
        ))}
        {passed.map((t) => (
          <StaggerItem as="li" key={t.name} className="flex items-center gap-2.5 px-3 py-2 text-sm">
            <CheckIcon className="size-4 shrink-0 text-success" />
            <span className="truncate">{prettyTestName(t.name)}</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{t.duration_ms.toFixed(0)} ms</span>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}

function FailedTestRow({ test, defaultOpen }: { test: TestResult; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <StaggerItem as="li">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/50">
          <XIcon className="size-4 shrink-0 text-destructive" />
          <span className="truncate font-medium">{prettyTestName(test.name)}</span>
          {test.error_type && (
            <Badge variant="outline" className="ml-auto font-mono text-[10px]">
              {test.error_type}
            </Badge>
          )}
          <ChevronRightIcon
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !test.error_type && "ml-auto", open && "rotate-90")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 px-3 pb-3 pl-9">
          {test.message && test.message !== test.error_type && (
            <pre className="rounded-md bg-destructive/5 p-2.5 font-mono text-xs break-words whitespace-pre-wrap text-destructive">
              {test.message}
            </pre>
          )}
          {test.hint && (
            <p className="flex gap-2 text-xs text-muted-foreground">
              <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>{test.hint}</span>
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </StaggerItem>
  )
}

function StreamView({ text, empty, tone }: { text: string; empty: string; tone?: "error" }) {
  if (!text.trim()) {
    return <p className="p-4 text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ScrollArea className="h-full">
      <pre
        className={cn(
          "p-4 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap",
          tone === "error" && "text-destructive"
        )}
      >
        {text}
      </pre>
    </ScrollArea>
  )
}
