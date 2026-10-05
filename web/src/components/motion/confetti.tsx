"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { useJourneyStore } from "@/stores/journey-store"

const COLORS = ["#7c5cff", "#d946ef", "#22c55e", "#f59e0b", "#38bdf8", "#f43f5e"]
const COUNT = 70

interface Piece {
  id: number
  x: number
  peak: number
  fall: number
  rotate: number
  size: number
  color: string
  delay: number
  duration: number
  round: boolean
}

function burst(seed: number): Piece[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = Math.random() * Math.PI - Math.PI / 2
    const power = 0.4 + Math.random() * 0.6
    return {
      id: seed * 1000 + i,
      x: Math.sin(angle) * power * 46, // vw
      peak: -(18 + Math.random() * 26), // vh
      fall: 40 + Math.random() * 45, // vh
      rotate: (Math.random() - 0.5) * 900,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 0.12,
      duration: 1.6 + Math.random() * 0.9,
      round: Math.random() > 0.6,
    }
  })
}

/** Full-screen confetti burst, triggered by useJourneyStore().fireConfetti(). */
export function Confetti() {
  const key = useJourneyStore((s) => s.confettiKey)
  const reduce = useReducedMotion()
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!key || reduce) return
    // Particle positions are random per burst, so they're generated when the key changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(burst(key))
    const t = setTimeout(() => setPieces([]), 2800)
    return () => clearTimeout(t)
  }, [key, reduce])

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      <AnimatePresence>
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            className="absolute top-[38%] left-1/2 block"
            style={{
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              background: p.color,
              borderRadius: p.round ? 999 : 2,
            }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{
              x: [`0vw`, `${p.x * 0.7}vw`, `${p.x}vw`],
              y: [`0vh`, `${p.peak}vh`, `${p.fall}vh`],
              rotate: p.rotate,
              opacity: [1, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: p.duration, delay: p.delay, ease: ["easeOut", "easeIn"], times: [0, 0.35, 1] }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
