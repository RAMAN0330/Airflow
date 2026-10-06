import { BookOpenIcon, ExternalLinkIcon, FileTextIcon, GraduationCapIcon, NewspaperIcon, ScrollTextIcon, type LucideIcon } from "lucide-react"

import type { Source, SourceKind } from "@/lib/types"
import { cn } from "@/lib/utils"

export const KIND: Record<SourceKind, { label: string; icon: LucideIcon; tone: string }> = {
  paper: { label: "Paper", icon: ScrollTextIcon, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300" },
  docs: { label: "Official docs", icon: FileTextIcon, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  book: { label: "Book", icon: BookOpenIcon, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  course: { label: "Course", icon: GraduationCapIcon, tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  article: { label: "Guide", icon: NewspaperIcon, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-300" },
}

export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function SourceByline({ source }: { source: Source }) {
  return (
    <span className="text-xs text-muted-foreground">
      {[source.author, source.publisher, source.year].filter(Boolean).join(" · ")}
    </span>
  )
}

/** A cited reference: what it is, who published it, and where it lives. */
export function SourceCard({ source, compact, children }: { source: Source; compact?: boolean; children?: React.ReactNode }) {
  const k = KIND[source.kind]
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex h-full flex-col gap-2 rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md",
        compact ? "p-3" : "p-4"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", k.tone)}>
          <k.icon className="size-3" /> {k.label}
        </span>
        <ExternalLinkIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-brand" />
      </span>
      <span className={cn("leading-snug font-medium group-hover:text-brand", compact ? "text-sm" : "")}>{source.title}</span>
      <SourceByline source={source} />
      <span className="mt-auto truncate text-xs text-muted-foreground/80">{hostname(source.url)}</span>
      {children}
    </a>
  )
}
