import Link from "next/link"
import { ArrowRightIcon, CrownIcon, LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { courseHref, stepHref } from "@/lib/links"
import type { LockReason } from "@/lib/types"
import { cn } from "@/lib/utils"

function action(reason: LockReason): { href: string; label: string } | null {
  if (reason.kind === "plan") return { href: "/pricing", label: "Upgrade to Pro" }
  if (reason.kind === "previous_course" && reason.target) return { href: courseHref(reason.target.id), label: "Go to course" }
  if (reason.kind === "previous_step" && reason.target?.kind)
    return { href: stepHref({ kind: reason.target.kind, id: reason.target.id }), label: "Go there" }
  return null
}

/** Inline banner explaining why something is locked, with the one action that unlocks it. */
export function LockNotice({ reason, className, compact }: { reason: LockReason; className?: string; compact?: boolean }) {
  const a = action(reason)
  const isPlan = reason.kind === "plan"
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 text-sm",
        compact ? "" : "rounded-lg border px-4 py-3",
        !compact && (isPlan ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/50"),
        className
      )}
    >
      {isPlan ? <CrownIcon className="size-4 text-amber-500" /> : <LockIcon className="size-4 text-muted-foreground" />}
      <span className="text-muted-foreground">{reason.message}</span>
      {a && (
        <Button asChild size="sm" variant={isPlan ? "default" : "outline"} className="ml-auto h-7">
          <Link href={a.href}>
            {a.label} <ArrowRightIcon />
          </Link>
        </Button>
      )}
    </div>
  )
}
