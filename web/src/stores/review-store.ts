import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/** 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. */
export type Grade = 1 | 2 | 3 | 4

export interface CardState {
  /** Leitner box, 0 (new / lapsed) to 5 (mastered). */
  box: number
  /** SM-2 ease factor. */
  ease: number
  /** Current interval in days (0 while relearning). */
  interval: number
  /** Epoch ms when the card is next due. */
  due: number
  reps: number
  lapses: number
  lastReviewed: number
}

const DAY = 86_400_000
const MINUTE = 60_000
export const NEW_PER_DAY = 20
const MAX_INTERVAL = 365

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** SM-2 flavoured scheduling with Leitner boxes for display. Pure: same input, same output. */
export function schedule(prev: CardState | undefined, grade: Grade, now: number): CardState {
  const s: CardState = prev ?? { box: 0, ease: 2.5, interval: 0, due: now, reps: 0, lapses: 0, lastReviewed: now }
  let { ease, interval, reps, lapses, box } = s

  if (grade === 1) {
    lapses += s.reps > 0 ? 1 : 0
    reps = 0
    interval = 0
    box = 0
    ease = Math.max(1.3, ease - 0.2)
    return { box, ease, interval, reps, lapses, due: now + 10 * MINUTE, lastReviewed: now }
  }

  if (grade === 2) {
    interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2))
    ease = Math.max(1.3, ease - 0.15)
  } else if (grade === 3) {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(Math.max(interval, 1) * ease)
  } else {
    interval = reps === 0 ? 4 : Math.round(Math.max(interval, 1) * ease * 1.3)
    ease = ease + 0.15
  }
  interval = Math.min(MAX_INTERVAL, interval)
  reps += 1
  box = Math.min(5, box + (grade === 2 ? 0 : grade === 4 ? 2 : 1))
  return { box: Math.max(box, 1), ease, interval, reps, lapses, due: now + interval * DAY, lastReviewed: now }
}

/** Short label for when a grade would schedule the card next ("10m", "3d", "2mo"). */
export function previewInterval(prev: CardState | undefined, grade: Grade, now: number): string {
  const ms = schedule(prev, grade, now).due - now
  if (ms < DAY) return `${Math.max(1, Math.round(ms / MINUTE))}m`
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

interface ReviewState {
  cards: Record<string, CardState>
  /** New cards introduced per UTC day, to cap the daily load. */
  newIntroduced: Record<string, number>
  /** Reviews done per UTC day. */
  reviewsByDay: Record<string, number>
  includeAllTerms: boolean
  grade: (id: string, grade: Grade, now?: number) => void
  setIncludeAllTerms: (v: boolean) => void
  reset: () => void
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set) => ({
      cards: {},
      newIntroduced: {},
      reviewsByDay: {},
      includeAllTerms: false,
      grade: (id, grade, now = Date.now()) =>
        set((s) => {
          const day = utcDay(now)
          const isNew = !s.cards[id]
          // Keep only the last few weeks of daily counters.
          const trim = (r: Record<string, number>) =>
            Object.fromEntries(Object.entries(r).filter(([d]) => now - Date.parse(d) < 60 * DAY))
          return {
            cards: { ...s.cards, [id]: schedule(s.cards[id], grade, now) },
            newIntroduced: isNew ? { ...trim(s.newIntroduced), [day]: (s.newIntroduced[day] ?? 0) + 1 } : s.newIntroduced,
            reviewsByDay: { ...trim(s.reviewsByDay), [day]: (s.reviewsByDay[day] ?? 0) + 1 },
          }
        }),
      setIncludeAllTerms: (includeAllTerms) => set({ includeAllTerms }),
      reset: () => set({ cards: {}, newIntroduced: {}, reviewsByDay: {} }),
    }),
    { name: "gradient-review", storage: createJSONStorage(() => localStorage), version: 1 }
  )
)
