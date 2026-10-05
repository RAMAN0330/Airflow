import Link from "next/link"

import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-brand to-fuchsia-500 text-brand-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
          <path d="M4 18 L10 11 L14 14 L20 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>Gradient</span>
    </Link>
  )
}
