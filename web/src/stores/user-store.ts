import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `u-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

interface UserState {
  userId: string | null
  /** Returns the anonymous learner id, creating one on first use. */
  ensureUserId: () => string
  /** Forget this learner and start over with a fresh id. */
  resetIdentity: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      userId: null,
      ensureUserId: () => {
        const existing = get().userId
        if (existing) return existing
        const id = newId()
        set({ userId: id })
        return id
      },
      resetIdentity: () => set({ userId: newId() }),
    }),
    { name: "gradient-user", storage: createJSONStorage(() => localStorage) }
  )
)
