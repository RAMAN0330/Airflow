"use client"

import { motion, useScroll, useSpring } from "motion/react"

/** Thin bar under the header showing how far through the page the reader is. */
export function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 })
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-14 z-30 h-0.5 origin-left bg-gradient-to-r from-brand to-fuchsia-500"
      style={{ scaleX }}
    />
  )
}
