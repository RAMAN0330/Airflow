import type { Metadata } from "next"

import { PlaygroundView } from "@/components/playground/playground-view"

export const metadata: Metadata = { title: "SQL Playground" }

export default function Page() {
  return <PlaygroundView />
}
