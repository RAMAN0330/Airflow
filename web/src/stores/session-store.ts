import { create } from "zustand"

import { api } from "@/lib/api"
import type { Me } from "@/lib/types"

interface SessionState {
  me: Me | null
  loading: boolean
  load: (opts?: { force?: boolean }) => Promise<void>
  rename: (name: string) => Promise<void>
  upgrade: (interval: "month" | "year") => Promise<void>
  cancel: () => Promise<void>
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  me: null,
  loading: false,
  load: async ({ force } = {}) => {
    if (get().loading || (get().me && !force)) return
    set({ loading: true })
    try {
      set({ me: await api.me() })
    } catch {
      // Header degrades gracefully without profile data.
    } finally {
      set({ loading: false })
    }
  },
  rename: async (name) => set({ me: await api.rename(name) }),
  upgrade: async (interval) => set({ me: await api.checkout(interval) }),
  cancel: async () => set({ me: await api.cancel() }),
}))
