"use client"

import Link from "next/link"
import { ArrowRightIcon, CheckCircle2Icon, ClockIcon, FileTextIcon, HistoryIcon, LockIcon } from "lucide-react"

import { Markdown } from "@/components/markdown"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SubmissionHistory } from "@/components/workspace/submission-history"
import type { ExerciseDetail, ExerciseRef } from "@/lib/types"
import { useWorkspaceStore, type TaskTab } from "@/stores/workspace-store"

export function TaskPane({ exercise, onRestore }: { exercise: ExerciseDetail; onRestore: (code: string) => void }) {
  const tab = useWorkspaceStore((s) => s.taskTab)
  const setTab = useWorkspaceStore((s) => s.setTaskTab)
  const count = useWorkspaceStore((s) => s.submissions.length)

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TaskTab)} className="h-full gap-0">
      <div className="flex h-11 shrink-0 items-center border-b px-3">
        <TabsList className="h-8">
          <TabsTrigger value="description" className="text-xs">
            <FileTextIcon /> Description
          </TabsTrigger>
          <TabsTrigger value="submissions" className="text-xs">
            <HistoryIcon /> Submissions
            {count > 0 && <span className="text-muted-foreground tabular-nums">{count}</span>}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="description" className="min-h-0">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-5">
            <Markdown>{exercise.task_markdown}</Markdown>
            <Separator />
            <MetaSection exercise={exercise} />
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="submissions" className="min-h-0">
        <ScrollArea className="h-full">
          <SubmissionHistory onRestore={onRestore} />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}

function MetaSection({ exercise }: { exercise: ExerciseDetail }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <ClockIcon /> ~{exercise.estimated_minutes} min
        </Badge>
        {exercise.tags.map((t) => (
          <Badge key={t} variant="outline" className="text-muted-foreground">
            {t}
          </Badge>
        ))}
      </div>
      {exercise.prerequisite_details.length > 0 && (
        <RefList title="Builds on" items={exercise.prerequisite_details} />
      )}
      {exercise.unlocks.length > 0 && <RefList title="Unlocks" items={exercise.unlocks} />}
    </div>
  )
}

function RefList({ title, items }: { title: string; items: ExerciseRef[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      <ul className="space-y-1">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              href={`/exercises/${r.id}`}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted"
            >
              {r.status === "completed" ? (
                <CheckCircle2Icon className="size-4 text-success" />
              ) : r.status === "locked" ? (
                <LockIcon className="size-4 text-muted-foreground" />
              ) : (
                <span className="grid size-4 place-items-center">
                  <span className="size-2 rounded-full bg-brand" />
                </span>
              )}
              <span className="flex-1">{r.title}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
