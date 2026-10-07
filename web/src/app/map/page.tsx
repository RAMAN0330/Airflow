import type { Metadata } from "next"

import { SkillMap } from "@/components/map/skill-map"

export const metadata: Metadata = { title: "Skill map" }

export default function MapPage() {
  return <SkillMap />
}
