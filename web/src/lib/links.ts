import type { StepRef } from "@/lib/types"

export const stepHref = (s: Pick<StepRef, "kind" | "id">) => (s.kind === "lesson" ? `/lessons/${s.id}` : `/exercises/${s.id}`)
export const courseHref = (id: string) => `/learn/${id}`
