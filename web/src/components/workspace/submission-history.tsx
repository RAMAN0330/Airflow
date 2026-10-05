"use client"

import { HistoryIcon, RotateCcwIcon } from "lucide-react"

import { RunStatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { timeAgo } from "@/lib/format"
import type { Submission } from "@/lib/types"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function SubmissionHistory({ onRestore }: { onRestore: (code: string) => void }) {
  const submissions = useWorkspaceStore((s) => s.submissions)
  const showSubmission = useWorkspaceStore((s) => s.showSubmission)

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <HistoryIcon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">No submissions yet</p>
        <p className="text-xs text-muted-foreground">Every run is saved here so you can compare attempts or roll back.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y">
      {submissions.map((s: Submission, i) => (
        <li key={s.id} className="group flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => showSubmission(s)}
            className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
          >
            <div className="flex items-center gap-2">
              <RunStatusBadge status={s.status} />
              <span className="text-sm font-medium tabular-nums">
                {s.passed_tests}/{s.total_tests} tests
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Attempt #{submissions.length - i} · {timeAgo(s.created_at)} · {(s.duration_ms / 1000).toFixed(1)}s
            </span>
          </button>
          {s.code && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Restore this code"
                  className="opacity-60 group-hover:opacity-100"
                  onClick={() => onRestore(s.code!)}
                >
                  <RotateCcwIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Load this attempt into the editor</TooltipContent>
            </Tooltip>
          )}
        </li>
      ))}
    </ul>
  )
}
