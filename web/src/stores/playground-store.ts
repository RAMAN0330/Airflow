import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { api, ApiError } from "@/lib/api"
import type { PlaygroundResult, PlaygroundSchema } from "@/lib/types"

const DEFAULT_SQL = `-- Explore the shop database. Every run starts from a fresh copy.
SELECT c.name, COUNT(o.order_id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id
ORDER BY orders DESC
LIMIT 10;`

interface HistoryEntry {
  sql: string
  at: number
  ok: boolean
}

interface PlaygroundState {
  sql: string
  history: HistoryEntry[]
  schema: PlaygroundSchema | null
  result: PlaygroundResult | null
  running: boolean
  activeResult: number
  setSql: (sql: string) => void
  setActiveResult: (i: number) => void
  loadSchema: () => Promise<void>
  run: () => Promise<void>
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set, get) => ({
      sql: DEFAULT_SQL,
      history: [],
      schema: null,
      result: null,
      running: false,
      activeResult: 0,
      setSql: (sql) => set({ sql }),
      setActiveResult: (activeResult) => set({ activeResult }),
      loadSchema: async () => {
        if (get().schema) return
        try {
          set({ schema: await api.playgroundSchema() })
        } catch {
          // The page shows a retry state when schema stays null.
        }
      },
      run: async () => {
        const { sql, running } = get()
        if (running || !sql.trim()) return
        set({ running: true })
        try {
          const result = await api.runSql(sql)
          const withRows = result.results.findLastIndex((r) => r.columns.length > 0)
          set((s) => ({
            result,
            activeResult: Math.max(withRows, 0),
            history: [{ sql, at: Date.now(), ok: !result.error }, ...s.history.filter((h) => h.sql !== sql)].slice(0, 15),
          }))
        } catch (e) {
          const err = e as ApiError
          set({ result: { results: [], statements: 0, error: err.message, duration_ms: 0 } })
        } finally {
          set({ running: false })
        }
      },
    }),
    {
      name: "gradient-playground",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sql: s.sql, history: s.history }),
    }
  )
)
