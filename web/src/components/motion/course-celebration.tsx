"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRightIcon, CrownIcon, TrophyIcon } from "lucide-react"

import { AnimatedNumber, EASE } from "@/components/motion/primitives"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { stepHref } from "@/lib/links"
import { useJourneyStore } from "@/stores/journey-store"
import { useSessionStore } from "@/stores/session-store"

/** The end-of-course moment: what you finished, what you earned, where to go next. */
export function CourseCelebration() {
  const celebration = useJourneyStore((s) => s.celebration)
  const close = useJourneyStore((s) => s.closeCelebration)
  const me = useSessionStore((s) => s.me)
  const next = celebration?.next ?? null
  const needsPro = next?.status === "locked"

  return (
    <Dialog open={!!celebration} onOpenChange={(o) => !o && close()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        {celebration && (
          <div className="relative px-6 pt-10 pb-6 text-center">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand/20 to-transparent" />
            <motion.div
              initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
              className="relative mx-auto mb-5 grid size-20 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/30"
            >
              <TrophyIcon className="size-10 text-white" />
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-amber-400"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
              className="relative space-y-2"
            >
              <p className="text-xs font-medium tracking-wider text-brand uppercase">Course complete</p>
              <DialogTitle className="text-2xl font-semibold tracking-tight">{celebration.courseTitle}</DialogTitle>
              <DialogDescription>
                You finished every lesson and exercise in this course.
              </DialogDescription>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.45 }}
              className="relative mx-auto mt-6 inline-flex items-baseline gap-1 rounded-full bg-brand/10 px-4 py-1.5 text-brand"
            >
              <span className="text-lg font-semibold">+{celebration.xpEarned} XP</span>
              {me && (
                <span className="text-sm">
                  · <AnimatedNumber value={me.xp} /> total
                </span>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.6 }}
              className="relative mt-8 grid gap-2"
            >
              {next && !needsPro && (
                <Button asChild size="lg" onClick={close}>
                  <Link href={stepHref(next)}>
                    Start the next course <ArrowRightIcon />
                  </Link>
                </Button>
              )}
              {next && needsPro && (
                <Button asChild size="lg" onClick={close}>
                  <Link href="/pricing">
                    <CrownIcon /> Unlock the next course with Pro
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" onClick={close}>
                <Link href="/learn">Back to all courses</Link>
              </Button>
            </motion.div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
