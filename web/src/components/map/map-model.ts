import type { Course, ModuleSummary, StepSummary } from "@/lib/types"

export type NodeStatus = "completed" | "in_progress" | "available" | "locked" | "upgrade" | "soon"

export function moduleSteps(m: ModuleSummary): StepSummary[] {
  return [m.lesson, m.exercise].filter(Boolean) as StepSummary[]
}

export function moduleStatus(course: Course, m: ModuleSummary): NodeStatus {
  if (m.coming_soon) return "soon"
  const steps = moduleSteps(m)
  if (steps.every((s) => s.status === "completed")) return "completed"
  if (course.status === "upgrade_required") return "upgrade"
  if (steps.some((s) => s.status === "in_progress") || steps.some((s) => s.status === "completed")) return "in_progress"
  if (steps.some((s) => s.status === "available")) return "available"
  return "locked"
}

export function courseNodeStatus(course: Course): NodeStatus {
  if (course.status === "upgrade_required") return "upgrade"
  return course.status
}

/** Whether the path *into* a node is open (drawn solid) or still closed (dashed). */
export const isOpen = (s: NodeStatus) => s === "completed" || s === "in_progress" || s === "available"

export const NODE_TONE: Record<NodeStatus, { dot: string; ring: string; text: string; label: string; line: string }> = {
  completed: { dot: "bg-success text-white", ring: "border-success/40", text: "text-success", label: "Completed", line: "bg-success" },
  in_progress: { dot: "bg-warning text-white", ring: "border-warning/50", text: "text-warning", label: "In progress", line: "bg-warning" },
  available: { dot: "bg-brand text-brand-foreground", ring: "border-brand/50", text: "text-brand", label: "Available", line: "bg-brand" },
  locked: { dot: "bg-muted text-muted-foreground", ring: "border-border", text: "text-muted-foreground", label: "Locked", line: "bg-border" },
  upgrade: {
    dot: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ring: "border-amber-500/40",
    text: "text-amber-600 dark:text-amber-400",
    label: "Pro",
    line: "bg-amber-500/40",
  },
  soon: { dot: "bg-muted text-muted-foreground", ring: "border-dashed border-border", text: "text-muted-foreground", label: "Coming soon", line: "bg-border" },
}
