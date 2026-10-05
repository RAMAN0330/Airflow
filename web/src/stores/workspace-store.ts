import { create } from "zustand"

import { api, ApiError } from "@/lib/api"
import type { ExerciseDetail, RunResult, Submission, SubmissionOut } from "@/lib/types"
import { useCatalogStore } from "@/stores/catalog-store"

export type ResultsTab = "tests" | "output" | "errors"
export type TaskTab = "description" | "submissions"

interface WorkspaceState {
  exerciseId: string | null
  exercise: ExerciseDetail | null
  submissions: Submission[]
  loading: boolean
  loadError: { status: number; message: string } | null

  running: boolean
  result: RunResult | null
  lastSubmission: SubmissionOut | null
  resultsTab: ResultsTab
  taskTab: TaskTab

  open: (exerciseId: string) => Promise<void>
  run: (code: string) => Promise<SubmissionOut | null>
  showSubmission: (s: Submission) => void
  setResultsTab: (tab: ResultsTab) => void
  setTaskTab: (tab: TaskTab) => void
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  exerciseId: null,
  exercise: null,
  submissions: [],
  loading: false,
  loadError: null,
  running: false,
  result: null,
  lastSubmission: null,
  resultsTab: "tests",
  taskTab: "description",

  open: async (exerciseId) => {
    set({
      exerciseId,
      exercise: null,
      submissions: [],
      loading: true,
      loadError: null,
      result: null,
      lastSubmission: null,
      resultsTab: "tests",
      taskTab: "description",
    })
    try {
      const [exercise, submissions] = await Promise.all([api.exercise(exerciseId), api.submissions(exerciseId)])
      if (get().exerciseId !== exerciseId) return
      set({ exercise, submissions, loading: false, result: submissions[0]?.result ?? null })
    } catch (e) {
      if (get().exerciseId !== exerciseId) return
      const err = e as ApiError
      set({ loading: false, loadError: { status: err.status ?? 0, message: err.message } })
    }
  },

  run: async (code) => {
    const { exerciseId, running } = get()
    if (!exerciseId || running) return null
    set({ running: true })
    try {
      const sub = await api.submit(exerciseId, code)
      if (get().exerciseId !== exerciseId) return sub
      const result = sub.result!
      const failed = result.tests.some((t) => t.outcome === "failed")
      set((s) => ({
        result,
        lastSubmission: sub,
        submissions: [{ ...sub, code }, ...s.submissions],
        resultsTab: result.status === "error" || result.status === "timeout" ? "errors" : failed || !result.stdout ? "tests" : s.resultsTab,
        exercise: s.exercise && {
          ...s.exercise,
          attempts: s.exercise.attempts + 1,
          best_score: Math.max(s.exercise.best_score ?? 0, sub.score),
          status: sub.status === "passed" ? "completed" : s.exercise.status === "completed" ? "completed" : "in_progress",
          next: s.exercise.next && (sub.unlocked.find((u) => u.id === s.exercise!.next!.id) ?? s.exercise.next),
        },
      }))
      useCatalogStore.getState().invalidate()
      return sub
    } finally {
      set({ running: false })
    }
  },

  showSubmission: (s) => set({ result: s.result, resultsTab: "tests" }),
  setResultsTab: (resultsTab) => set({ resultsTab }),
  setTaskTab: (taskTab) => set({ taskTab }),
}))
