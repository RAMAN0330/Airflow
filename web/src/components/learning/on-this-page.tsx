"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

export interface TocItem {
  id: string
  label: string
}

/** Table of contents that highlights the section currently in view. */
export function OnThisPage({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-80px 0px -65% 0px" }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [items])

  if (!items.length) return null
  return (
    <nav aria-label="On this page" className="space-y-2 text-sm">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">On this page</p>
      <ul className="space-y-0.5 border-l">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              className={cn(
                "-ml-px block border-l-2 border-transparent py-1 pl-3 text-muted-foreground transition-colors hover:text-foreground",
                active === i.id && "border-brand font-medium text-foreground"
              )}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
