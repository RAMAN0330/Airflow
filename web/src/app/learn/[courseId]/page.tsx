import type { Metadata } from "next"

import { CourseView } from "@/components/learn/course-view"

export const metadata: Metadata = { title: "Course" }

export default async function CoursePage({ params }: PageProps<"/learn/[courseId]">) {
  const { courseId } = await params
  return <CourseView courseId={courseId} />
}
