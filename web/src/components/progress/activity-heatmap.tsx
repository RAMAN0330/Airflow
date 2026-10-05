import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ActivityDay } from "@/lib/types"
import { cn } from "@/lib/utils"

const WEEKS = 12

function utcDay(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function lastNDays(n: number): string[] {
  const today = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (n - 1 - i)))
    return utcDay(d)
  })
}

/** Consecutive days with at least one submission, ending today (or yesterday). */
export function currentStreak(activity: ActivityDay[]): number {
  const active = new Set(activity.filter((a) => a.submissions > 0).map((a) => a.day))
  const days = lastNDays(400).reverse()
  let i = active.has(days[0]) ? 0 : 1
  let streak = 0
  while (i < days.length && active.has(days[i])) {
    streak++
    i++
  }
  return streak
}

function level(n: number) {
  if (n === 0) return "bg-muted"
  if (n <= 2) return "bg-brand/30"
  if (n <= 5) return "bg-brand/60"
  return "bg-brand"
}

export function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  const byDay = new Map(activity.map((a) => [a.day, a]))
  const days = lastNDays(WEEKS * 7)

  return (
    <div className="space-y-3">
      <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const a = byDay.get(day)
          const n = a?.submissions ?? 0
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div className={cn("aspect-square w-full max-w-4 rounded-[3px]", level(n))} />
              </TooltipTrigger>
              <TooltipContent>
                {n === 0 ? "No submissions" : `${n} submission${n > 1 ? "s" : ""}, ${a?.passed ?? 0} passed`} ·{" "}
                {new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        Less
        {[0, 1, 3, 6].map((n) => (
          <span key={n} className={cn("size-3 rounded-[3px]", level(n))} />
        ))}
        More
      </div>
    </div>
  )
}
