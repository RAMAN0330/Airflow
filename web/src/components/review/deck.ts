import type { LessonLink, Library, ReviewDeck } from "@/lib/types"
import { NEW_PER_DAY, utcDay, type CardState } from "@/stores/review-store"

export type ReviewCard =
  | { id: string; kind: "term"; lesson: LessonLink; term: string; definition: string }
  | {
      id: string
      kind: "quiz"
      lesson: LessonLink
      prompt: string
      options: string[]
      answer: number
      explanation: string | null
    }

export const termCardId = (lessonId: string, term: string) => `term:${lessonId}:${term.trim().toLowerCase()}`

/** Cards from lessons the learner passed, optionally plus every glossary term in the library. */
export function buildDeck(deck: ReviewDeck, library: Library | null, includeAllTerms: boolean): ReviewCard[] {
  const out = new Map<string, ReviewCard>()
  for (const t of deck.terms) {
    const id = termCardId(t.lesson.id, t.term)
    out.set(id, { id, kind: "term", lesson: t.lesson, term: t.term, definition: t.definition })
  }
  if (includeAllTerms && library) {
    for (const t of library.terms) {
      const id = termCardId(t.lesson.id, t.term)
      if (!out.has(id)) out.set(id, { id, kind: "term", lesson: t.lesson, term: t.term, definition: t.definition })
    }
  }
  for (const q of deck.questions) {
    out.set(q.id, {
      id: q.id,
      kind: "quiz",
      lesson: q.lesson,
      prompt: q.prompt,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
    })
  }
  return [...out.values()]
}

export interface DeckStats {
  due: ReviewCard[]
  fresh: ReviewCard[]
  newLeft: number
  mastered: number
  learning: number
  nextDue: number | null
  /** Cards coming due on each of the next 7 UTC days (index 0 = today, including overdue). */
  forecast: number[]
}

export function deckStats(
  cards: ReviewCard[],
  states: Record<string, CardState>,
  newIntroduced: Record<string, number>,
  now: number
): DeckStats {
  const due: ReviewCard[] = []
  const fresh: ReviewCard[] = []
  let mastered = 0
  let learning = 0
  let nextDue: number | null = null
  const forecast = Array<number>(7).fill(0)
  const today = Date.parse(utcDay(now))

  for (const c of cards) {
    const s = states[c.id]
    if (!s) {
      fresh.push(c)
      continue
    }
    if (s.box >= 4) mastered++
    else learning++
    if (s.due <= now) due.push(c)
    else if (nextDue === null || s.due < nextDue) nextDue = s.due
    const dayOffset = Math.max(0, Math.floor((s.due - today) / 86_400_000))
    if (dayOffset < 7) forecast[dayOffset]++
  }
  due.sort((a, b) => states[a.id].due - states[b.id].due)
  const newLeft = Math.max(0, NEW_PER_DAY - (newIntroduced[utcDay(now)] ?? 0))
  forecast[0] += Math.min(newLeft, fresh.length)
  return { due, fresh, newLeft, mastered, learning, nextDue, forecast }
}
