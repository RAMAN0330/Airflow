import type { Metadata } from "next"

import { Workspace } from "@/components/workspace/workspace"

export const metadata: Metadata = { title: "Exercise" }

export default async function ExercisePage({ params }: PageProps<"/exercises/[id]">) {
  const { id } = await params
  return <Workspace exerciseId={id} />
}
