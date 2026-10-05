"use client"

import { MotionConfig } from "motion/react"

import { Confetti } from "@/components/motion/confetti"
import { CourseCelebration } from "@/components/motion/course-celebration"

/** Honors the OS "reduce motion" setting everywhere and mounts global journey overlays. */
export function MotionProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <CourseCelebration />
      <Confetti />
    </MotionConfig>
  )
}
