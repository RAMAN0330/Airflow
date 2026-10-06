import Link from "next/link"
import { BookOpenIcon, CheckIcon, CodeIcon, LockIcon } from "lucide-react"

import { courseHref, stepHref } from "@/lib/links"
import type { CourseRef, OutlineModule } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Left-rail navigation through a course's steps, with the current step highlighted. */
export function CourseOutline({ course, outline, currentId }: { course: CourseRef; outline: OutlineModule[]; currentId: string }) {
  return (
    <nav aria-label="Course outline" className="space-y-4 text-sm">
      <Link href={courseHref(course.id)} className="block space-y-0.5 rounded-lg px-2 py-1.5 hover:bg-muted">
        <span className="block text-xs text-muted-foreground">{course.track_title}</span>
        <span className="block font-semibold leading-snug">{course.title}</span>
      </Link>
      {outline.map((m, mi) => (
        <div key={m.id} className="space-y-1">
          <p className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Module {mi + 1} · {m.title}
          </p>
          <ul className="space-y-0.5">
            {m.steps.map((st) => {
              const current = st.id === currentId
              const locked = st.status === "locked"
              const Icon = st.status === "completed" ? CheckIcon : locked ? LockIcon : st.kind === "lesson" ? BookOpenIcon : CodeIcon
              return (
                <li key={st.id}>
                  <Link
                    href={stepHref(st)}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted",
                      current && "bg-brand/10 font-medium text-foreground hover:bg-brand/15",
                      locked && !current && "text-muted-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0",
                        st.status === "completed" ? "text-success" : current ? "text-brand" : "text-muted-foreground"
                      )}
                    />
                    <span className="leading-snug">{st.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
