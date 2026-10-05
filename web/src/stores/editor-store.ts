import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type EditorFontSize = 12 | 13 | 14 | 16

interface EditorState {
  /** Unsaved editor buffers, keyed by exercise id. Survive reloads. */
  drafts: Record<string, string>
  fontSize: EditorFontSize
  minimap: boolean
  setDraft: (exerciseId: string, code: string) => void
  clearDraft: (exerciseId: string) => void
  setFontSize: (size: EditorFontSize) => void
  toggleMinimap: () => void
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      drafts: {},
      fontSize: 13,
      minimap: false,
      setDraft: (exerciseId, code) => set((s) => ({ drafts: { ...s.drafts, [exerciseId]: code } })),
      clearDraft: (exerciseId) =>
        set((s) => {
          const rest = { ...s.drafts }
          delete rest[exerciseId]
          return { drafts: rest }
        }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleMinimap: () => set((s) => ({ minimap: !s.minimap })),
    }),
    { name: "gradient-editor", storage: createJSONStorage(() => localStorage), version: 1 }
  )
)
