"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect } from "react"
import {
  ChevronLeftIcon,
  CodeIcon,
  FileTextIcon,
  FlaskConicalIcon,
  Loader2Icon,
  LockIcon,
  PlayIcon,
  RotateCcwIcon,
  Settings2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { CodeEditor } from "@/components/code-editor"
import { LockNotice } from "@/components/lock-notice"
import { DifficultyBadge, StatusBadge } from "@/components/status-badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ResultsPanel } from "@/components/workspace/results-panel"
import { TaskPane } from "@/components/workspace/task-pane"
import { useFreshUnlock } from "@/hooks/use-fresh-unlock"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ApiError } from "@/lib/api"
import { celebrate } from "@/lib/celebrate"
import { courseHref } from "@/lib/links"
import type { ExerciseDetail } from "@/lib/types"
import { useEditorStore, type EditorFontSize } from "@/stores/editor-store"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function Workspace({ exerciseId }: { exerciseId: string }) {
  const router = useRouter()
  const open = useWorkspaceStore((s) => s.open)
  const exercise = useWorkspaceStore((s) => (s.exerciseId === exerciseId ? s.exercise : null))
  const loadError = useWorkspaceStore((s) => s.loadError)
  const running = useWorkspaceStore((s) => s.running)
  const runSubmission = useWorkspaceStore((s) => s.run)

  const draft = useEditorStore((s) => s.drafts[exerciseId])
  const setDraft = useEditorStore((s) => s.setDraft)
  const clearDraft = useEditorStore((s) => s.clearDraft)

  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const code = draft ?? exercise?.starter_code ?? ""
  const locked = exercise?.status === "locked"

  useEffect(() => {
    open(exerciseId)
  }, [exerciseId, open])
  useFreshUnlock(exerciseId, { consume: true, after: 300 })

  const run = useCallback(async () => {
    if (!exercise || locked || running) return
    try {
      const sub = await runSubmission(code)
      if (!sub) return
      if (sub.newly_completed) {
        // The last step of a course completes the course.
        const courseDone = !exercise.next || exercise.next.course_id !== exercise.course.id
        celebrate({
          title: "Exercise complete!",
          xp: sub.xp_earned,
          unlocked: sub.unlocked,
          navigate: (h) => router.push(h),
          courseComplete: courseDone ? { courseTitle: exercise.course.title, next: exercise.next } : undefined,
        })
      } else if (sub.status === "passed") {
        toast.success("All tests passing")
      }
    } catch (e) {
      const err = e as ApiError
      toast.error(err.status === 429 ? "A run is already in progress" : "Couldn't run your code", {
        description: err.message,
      })
    }
  }, [code, exercise, locked, running, runSubmission, router])

  // Ctrl/Cmd+Enter anywhere in the workspace (the editor binds it too).
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

  const onChange = useCallback((v: string) => setDraft(exerciseId, v), [exerciseId, setDraft])
  const restore = useCallback(
    (c: string) => {
      setDraft(exerciseId, c)
      toast("Code restored from a previous attempt")
    },
    [exerciseId, setDraft]
  )

  if (loadError) return <LoadError status={loadError.status} message={loadError.message} />
  if (!exercise) return <WorkspaceSkeleton />

  const editor = (
    <div className="flex h-full flex-col">
      {exercise.lock_reason && <LockNotice reason={exercise.lock_reason} compact className="border-b bg-muted/50 px-4 py-2" />}
      <div className="min-h-0 flex-1">
        <CodeEditor value={code} onChange={onChange} onRun={run} readOnly={locked} />
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <Toolbar
        exercise={exercise}
        running={running}
        dirty={draft !== undefined && draft !== exercise.starter_code}
        onRun={run}
        onReset={() => clearDraft(exerciseId)}
      />
      {isDesktop ? (
        <ResizablePanelGroup direction="horizontal" autoSaveId="workspace-h" className="min-h-0 flex-1">
          <ResizablePanel defaultSize={38} minSize={24}>
            <TaskPane exercise={exercise} onRestore={restore} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={62} minSize={35}>
            <ResizablePanelGroup direction="vertical" autoSaveId="workspace-v">
              <ResizablePanel defaultSize={60} minSize={20}>
                {editor}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={15}>
                <ResultsPanel />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <MobileWorkspace exercise={exercise} editor={editor} onRestore={restore} />
      )}
    </div>
  )
}

function MobileWorkspace({
  exercise,
  editor,
  onRestore,
}: {
  exercise: ExerciseDetail
  editor: React.ReactNode
  onRestore: (code: string) => void
}) {
  const result = useWorkspaceStore((s) => s.result)
  return (
    <Tabs defaultValue="task" className="min-h-0 flex-1 gap-0">
      <div className="border-b px-3 py-2">
        <TabsList className="w-full">
          <TabsTrigger value="task">
            <FileTextIcon /> Task
          </TabsTrigger>
          <TabsTrigger value="code">
            <CodeIcon /> Code
          </TabsTrigger>
          <TabsTrigger value="results">
            <FlaskConicalIcon /> Results
            {result && (
              <span className="text-muted-foreground tabular-nums">
                {result.passed_tests}/{result.total_tests}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="task" className="min-h-0">
        <TaskPane exercise={exercise} onRestore={onRestore} />
      </TabsContent>
      <TabsContent value="code" className="min-h-0">
        {editor}
      </TabsContent>
      <TabsContent value="results" className="min-h-0">
        <ResultsPanel />
      </TabsContent>
    </Tabs>
  )
}

function Toolbar({
  exercise,
  running,
  dirty,
  onRun,
  onReset,
}: {
  exercise: ExerciseDetail
  running: boolean
  dirty: boolean
  onRun: () => void
  onReset: () => void
}) {
  const fontSize = useEditorStore((s) => s.fontSize)
  const setFontSize = useEditorStore((s) => s.setFontSize)
  const minimap = useEditorStore((s) => s.minimap)
  const toggleMinimap = useEditorStore((s) => s.toggleMinimap)
  const locked = exercise.status === "locked"

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
      <Button asChild variant="ghost" size="icon-sm" aria-label="Back to course">
        <Link href={courseHref(exercise.course.id)}>
          <ChevronLeftIcon />
        </Link>
      </Button>
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden max-w-48 truncate text-xs text-muted-foreground md:inline">{exercise.course.title}</span>
        <span className="hidden text-muted-foreground/50 md:inline">/</span>
        <h1 className="truncate text-sm font-semibold">{exercise.title}</h1>
        <div className="hidden items-center gap-1.5 lg:flex">
          <DifficultyBadge difficulty={exercise.difficulty} />
          <StatusBadge status={exercise.status} />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Editor settings">
              <Settings2Icon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Font size</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={String(fontSize)} onValueChange={(v) => setFontSize(Number(v) as EditorFontSize)}>
              {[12, 13, 14, 16].map((s) => (
                <DropdownMenuRadioItem key={s} value={String(s)}>
                  {s}px
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={toggleMinimap}>{minimap ? "Hide" : "Show"} minimap</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Reset to starter code" disabled={!dirty}>
                  <RotateCcwIcon />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Reset to starter code</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset to the starter template?</AlertDialogTitle>
              <AlertDialogDescription>
                Your current editor contents will be replaced. Earlier attempts stay available under Submissions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onReset}>Reset code</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" onClick={onRun} disabled={running || locked} className="min-w-24">
                {running ? <Loader2Icon className="animate-spin" /> : locked ? <LockIcon /> : <PlayIcon />}
                {running ? "Running" : "Run tests"}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {locked ? (
              (exercise.lock_reason?.message ?? "Locked")
            ) : (
              <span className="flex items-center gap-1">
                Run hidden tests <Kbd>Ctrl</Kbd>
                <Kbd>↵</Kbd>
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex h-12 items-center gap-3 border-b px-3">
        <Skeleton className="size-8" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="ml-auto h-8 w-24" />
      </div>
      <div className="grid flex-1 gap-px bg-border lg:grid-cols-[38fr_62fr]">
        <div className="space-y-3 bg-background p-5">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="hidden bg-background p-4 lg:block">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  )
}

function LoadError({ status, message }: { status: number; message: string }) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-4xl font-semibold tracking-tight">{status === 404 ? "404" : "Oops"}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {status === 404 ? "That exercise doesn't exist." : message}
      </p>
      <Button asChild variant="outline">
        <Link href="/learn">Back to courses</Link>
      </Button>
    </div>
  )
}
