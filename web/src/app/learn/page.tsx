import type { Metadata } from "next"

import { CoursesView } from "@/components/learn/courses-view"

export const metadata: Metadata = { title: "Courses" }

export default function LearnPage() {
  return <CoursesView />
}
