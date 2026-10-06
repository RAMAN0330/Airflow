import { BookMarkedIcon, LightbulbIcon } from "lucide-react"

import type { Term } from "@/lib/types"

export function Takeaways({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <section id="takeaways" className="scroll-mt-24 rounded-2xl border border-brand/25 bg-brand/5 p-5" aria-labelledby="takeaways-title">
      <h2 id="takeaways-title" className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <LightbulbIcon className="size-4 text-brand" /> Key takeaways
      </h2>
      <ol className="grid gap-2.5 sm:grid-cols-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="text-foreground/85">{t}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function KeyTerms({ terms }: { terms: Term[] }) {
  if (!terms.length) return null
  return (
    <section id="key-terms" aria-labelledby="key-terms-title" className="scroll-mt-24 space-y-3">
      <h2 id="key-terms-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <BookMarkedIcon className="size-4 text-brand" /> Key terms
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {terms.map((t) => (
          <div key={t.term} className="rounded-xl border bg-card p-3.5">
            <dt className="text-sm font-semibold">{t.term}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
