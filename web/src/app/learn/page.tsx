import type { Metadata } from "next"
import { Suspense } from "react"

import { CoursesView } from "@/components/learn/courses-view"

export const metadata: Metadata = { title: "Courses" }

export default function LearnPage() {
  return (
    <Suspense>
      <CoursesView />
    </Suspense>
  )
}
