import { create } from "zustand"

import { api, ApiError } from "@/lib/api"
import type { LessonDetail, QuizAttemptResult } from "@/lib/types"
import { useCatalogStore } from "@/stores/catalog-store"

interface LessonState {
  lessonId: string | null
  lesson: LessonDetail | null
  loading: boolean
  loadError: { status: number; message: string } | null
  answers: Record<string, number>
  submitting: boolean
  attempt: QuizAttemptResult | null
  open: (id: string) => Promise<void>
  choose: (questionId: string, option: number) => void
  submit: () => Promise<QuizAttemptResult | null>
}

export const useLessonStore = create<LessonState>()((set, get) => ({
  lessonId: null,
  lesson: null,
  loading: false,
  loadError: null,
  answers: {},
  submitting: false,
  attempt: null,

  open: async (id) => {
    set({ lessonId: id, lesson: null, loading: true, loadError: null, answers: {}, attempt: null })
    try {
      const lesson = await api.lesson(id)
      if (get().lessonId === id) set({ lesson, loading: false })
    } catch (e) {
      const err = e as ApiError
      if (get().lessonId === id) set({ loading: false, loadError: { status: err.status ?? 0, message: err.message } })
    }
  },

  choose: (questionId, option) =>
    set((s) => ({
      answers: { ...s.answers, [questionId]: option },
      // Editing an answer clears that question's previous verdict.
      attempt: s.attempt && { ...s.attempt, results: s.attempt.results.filter((r) => r.id !== questionId) },
    })),

  submit: async () => {
    const { lessonId, answers, submitting } = get()
    if (!lessonId || submitting) return null
    set({ submitting: true })
    try {
      const attempt = await api.attemptQuiz(lessonId, answers)
      set({ attempt })
      if (attempt.newly_completed) {
        const lesson = await api.lesson(lessonId)
        set({ lesson })
        useCatalogStore.getState().invalidate()
      }
      return attempt
    } finally {
      set({ submitting: false })
    }
  },
}))
