import type { Metadata } from "next"

import { LessonView } from "@/components/lesson/lesson-view"

export const metadata: Metadata = { title: "Lesson" }

export default async function LessonPage({ params }: PageProps<"/lessons/[id]">) {
  const { id } = await params
  return <LessonView lessonId={id} />
}
