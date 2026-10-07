/**
 * Small fuzzy matcher for the command palette: every query character must appear
 * in order. Contiguous runs, word starts and prefix matches score higher.
 */
export interface FuzzyMatch {
  score: number
  /** Indices into `text` that matched, for highlighting. */
  positions: number[]
}

const isBoundary = (text: string, i: number) => i === 0 || /[\s\-_/.:(]/.test(text[i - 1])

export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase()
  if (!q) return { score: 0, positions: [] }
  const t = text.toLowerCase()

  // Fast path: a substring match is always the best alignment.
  const at = t.indexOf(q)
  if (at !== -1) {
    const positions = Array.from({ length: q.length }, (_, k) => at + k)
    const score = 100 + q.length * 4 + (at === 0 ? 40 : isBoundary(text, at) ? 20 : 0) - Math.min(at, 20) - t.length / 50
    return { score, positions }
  }

  const positions: number[] = []
  let score = 0
  let run = 0
  let ti = 0
  for (const ch of q) {
    if (ch === " ") continue
    const found = t.indexOf(ch, ti)
    if (found === -1) return null
    const contiguous = positions.length > 0 && found === positions[positions.length - 1] + 1
    run = contiguous ? run + 1 : 0
    score += 1 + run * 3 + (isBoundary(text, found) ? 6 : 0) - Math.min(found - ti, 8) * 0.5
    positions.push(found)
    ti = found + 1
  }
  return { score: score - t.length / 50, positions }
}

/** Best match of a query against a primary label and optional secondary keywords. */
export function fuzzyRank(query: string, label: string, keywords = ""): FuzzyMatch | null {
  const primary = fuzzyMatch(query, label)
  if (primary) return { ...primary, score: primary.score + 10 }
  if (!keywords) return null
  const secondary = fuzzyMatch(query, keywords)
  return secondary && { score: secondary.score * 0.6, positions: [] }
}
