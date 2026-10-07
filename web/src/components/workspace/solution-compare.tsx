"use client"

import { useEffect, useRef, useState } from "react"
import { DiffEditor, loader, type MonacoDiffEditor } from "@monaco-editor/react"
import { motion } from "motion/react"
import { AlertCircleIcon, Columns2Icon, GitCompareArrowsIcon, Rows2Icon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMediaQuery } from "@/hooks/use-media-query"
import { api } from "@/lib/api"
import type { ExerciseDetail, Solution } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useEditorStore } from "@/stores/editor-store"

// Same self-hosted Monaco as the main editor (see components/code-editor.tsx).
loader.config({ paths: { vs: "/monaco/vs" } })

type Source = "passing" | "editor"

/** "Compare with reference" button + side-by-side diff. Renders nothing until the exercise is passed. */
export function SolutionCompare({ exercise }: { exercise: ExerciseDetail }) {
  const [open, setOpen] = useState(false)
  if (exercise.status !== "completed") return null

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label="Compare with reference solution">
              <GitCompareArrowsIcon />
              <span className="hidden xl:inline">Compare with reference</span>
            </Button>
          </motion.span>
        </TooltipTrigger>
        <TooltipContent>See how your passing code differs from the reference solution</TooltipContent>
      </Tooltip>
      {open && <CompareDialog exercise={exercise} onOpenChange={setOpen} />}
    </>
  )
}

function CompareDialog({ exercise, onOpenChange }: { exercise: ExerciseDetail; onOpenChange: (o: boolean) => void }) {
  const { resolvedTheme } = useTheme()
  const wide = useMediaQuery("(min-width: 768px)")
  const fontSize = useEditorStore((s) => s.fontSize)
  const draft = useEditorStore((s) => s.drafts[exercise.id])
  const [solution, setSolution] = useState<Solution | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<Source>("passing")
  const [sideBySide, setSideBySide] = useState(true)
  const editorRef = useRef<MonacoDiffEditor | null>(null)

  useEffect(() => {
    let live = true
    api
      .solution(exercise.id)
      .then((s) => live && setSolution(s))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [exercise.id])

  // The diff editor keeps its models (avoids a Monaco dispose-order bug); release them ourselves.
  useEffect(
    () => () => {
      const ed = editorRef.current
      if (!ed) return
      try {
        const models = ed.getModel()
        ed.setModel(null)
        models?.original.dispose()
        models?.modified.dispose()
      } catch {}
    },
    []
  )

  const editorCode = draft ?? exercise.starter_code
  const yours = source === "passing" ? (solution?.your_code ?? editorCode) : editorCode
  const split = sideBySide && wide

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-4 py-3 pr-12 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrowsIcon className="size-4 text-brand" /> Compare with reference
          </DialogTitle>
          <DialogDescription>
            {exercise.title}: your code on the left, the reference solution on the right. There&apos;s more than one right
            answer. Look for ideas, not differences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2 sm:px-5">
          <div role="radiogroup" aria-label="Your code" className="inline-flex rounded-md border bg-background p-0.5 text-xs">
            {(
              [
                ["passing", "Last passing run"],
                ["editor", "Current editor"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={source === value}
                onClick={() => setSource(value)}
                disabled={value === "passing" && solution !== null && !solution.your_code}
                className={cn(
                  "rounded px-2.5 py-1 font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                  source === value ? "bg-brand/10 text-brand" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {wide && (
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setSideBySide((v) => !v)}>
              {sideBySide ? <Rows2Icon /> : <Columns2Icon />}
              {sideBySide ? "Inline view" : "Side by side"}
            </Button>
          )}
        </div>

        {split && solution && (
          <div className="grid grid-cols-2 border-b text-[11px] font-medium text-muted-foreground">
            <span className="px-5 py-1.5">Your code</span>
            <span className="border-l px-5 py-1.5">Reference solution</span>
          </div>
        )}

        <div className="min-h-0 flex-1">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <AlertCircleIcon className="size-6 text-destructive" />
              <p className="text-sm font-medium">Couldn&apos;t load the reference solution</p>
              <p className="max-w-sm text-xs text-muted-foreground">{error}</p>
            </div>
          ) : !solution ? (
            <Skeleton className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" />
          ) : (
            <DiffEditor
              language="python"
              original={yours}
              modified={solution.code}
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              keepCurrentOriginalModel
              keepCurrentModifiedModel
              onMount={(ed) => {
                editorRef.current = ed
              }}
              loading={<Skeleton className="m-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" />}
              options={{
                readOnly: true,
                originalEditable: false,
                renderSideBySide: split,
                useInlineViewWhenSpaceIsLimited: true,
                fontSize,
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                renderOverviewRuler: false,
                ignoreTrimWhitespace: true,
                padding: { top: 12, bottom: 12 },
                hideUnchangedRegions: { enabled: false },
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
