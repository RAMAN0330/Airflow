import { create } from "zustand"

import { api } from "@/lib/api"
import type { Curriculum, Progress } from "@/lib/types"

type LoadState = "idle" | "loading" | "ready" | "error"

interface CatalogState {
  curriculum: Curriculum | null
  progress: Progress | null
  curriculumState: LoadState
  progressState: LoadState
  error: string | null
  loadCurriculum: (opts?: { force?: boolean }) => Promise<void>
  loadProgress: (opts?: { force?: boolean }) => Promise<void>
  /** Mark cached data stale after a submission so the next view refetches. */
  invalidate: () => void
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  curriculum: null,
  progress: null,
  curriculumState: "idle",
  progressState: "idle",
  error: null,

  loadCurriculum: async ({ force } = {}) => {
    const { curriculumState } = get()
    if (curriculumState === "loading" || (curriculumState === "ready" && !force)) return
    set({ curriculumState: "loading", error: null })
    try {
      set({ curriculum: await api.curriculum(), curriculumState: "ready" })
    } catch (e) {
      set({ curriculumState: "error", error: (e as Error).message })
    }
  },

  loadProgress: async ({ force } = {}) => {
    const { progressState } = get()
    if (progressState === "loading" || (progressState === "ready" && !force)) return
    set({ progressState: "loading", error: null })
    try {
      set({ progress: await api.progress(), progressState: "ready" })
    } catch (e) {
      set({ progressState: "error", error: (e as Error).message })
    }
  },

  invalidate: () => set({ curriculumState: "idle", progressState: "idle" }),
}))
