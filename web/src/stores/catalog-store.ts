import { create } from "zustand"

import { api } from "@/lib/api"
import type { Course, Leaderboard, LeaderboardPeriod, Library, Progress, Track } from "@/lib/types"
import { useSessionStore } from "@/stores/session-store"

type LoadState = "idle" | "loading" | "ready" | "error"

interface CatalogState {
  tracks: Track[] | null
  tracksState: LoadState
  library: Library | null
  libraryState: LoadState
  courses: Course[] | null
  coursesState: LoadState
  progress: Progress | null
  progressState: LoadState
  leaderboards: Partial<Record<LeaderboardPeriod, Leaderboard>>
  leaderboardState: LoadState
  error: string | null
  loadTracks: (opts?: { force?: boolean }) => Promise<void>
  loadLibrary: () => Promise<void>
  loadCourses: (opts?: { force?: boolean }) => Promise<void>
  loadProgress: (opts?: { force?: boolean }) => Promise<void>
  loadLeaderboard: (period: LeaderboardPeriod) => Promise<void>
  /** Call after anything that changes learner state (submission, quiz, plan). */
  invalidate: () => void
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  tracks: null,
  tracksState: "idle",
  library: null,
  libraryState: "idle",
  courses: null,
  coursesState: "idle",
  progress: null,
  progressState: "idle",
  leaderboards: {},
  leaderboardState: "idle",
  error: null,

  loadTracks: async ({ force } = {}) => {
    const s = get().tracksState
    if (s === "loading" || (s === "ready" && !force)) return
    set({ tracksState: "loading", error: null })
    try {
      const tracks = await api.tracks()
      set({ tracks, tracksState: "ready", courses: tracks.flatMap((t) => t.courses), coursesState: "ready" })
    } catch (e) {
      set({ tracksState: "error", error: (e as Error).message })
    }
  },

  loadLibrary: async () => {
    const s = get().libraryState
    if (s === "loading" || s === "ready") return
    set({ libraryState: "loading" })
    try {
      set({ library: await api.library(), libraryState: "ready" })
    } catch (e) {
      set({ libraryState: "error", error: (e as Error).message })
    }
  },

  loadCourses: async ({ force } = {}) => {
    const s = get().coursesState
    if (s === "loading" || (s === "ready" && !force)) return
    set({ coursesState: "loading", error: null })
    try {
      set({ courses: await api.courses(), coursesState: "ready" })
    } catch (e) {
      set({ coursesState: "error", error: (e as Error).message })
    }
  },

  loadProgress: async ({ force } = {}) => {
    const s = get().progressState
    if (s === "loading" || (s === "ready" && !force)) return
    set({ progressState: "loading", error: null })
    try {
      set({ progress: await api.progress(), progressState: "ready" })
    } catch (e) {
      set({ progressState: "error", error: (e as Error).message })
    }
  },

  loadLeaderboard: async (period) => {
    set({ leaderboardState: "loading", error: null })
    try {
      const board = await api.leaderboard(period)
      set((s) => ({ leaderboards: { ...s.leaderboards, [period]: board }, leaderboardState: "ready" }))
    } catch (e) {
      set({ leaderboardState: "error", error: (e as Error).message })
    }
  },

  invalidate: () => {
    set({ tracksState: "idle", coursesState: "idle", progressState: "idle", leaderboards: {} })
    useSessionStore.getState().load({ force: true })
  },
}))
