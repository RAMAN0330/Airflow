"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRightIcon, BookOpenIcon, CircleHelpIcon, CodeIcon, UnlockIcon, XIcon } from "lucide-react"

import { EASE } from "@/components/motion/primitives"
import { Button } from "@/components/ui/button"
import { stepHref } from "@/lib/links"
import type { StepRef } from "@/lib/types"
import { BRAND } from "@/lib/brand"
import { useJourneyStore } from "@/stores/journey-store"

const STEPS = [
  { icon: BookOpenIcon, title: "Read a short lesson", body: "The math and the shapes, in about 10 minutes." },
  { icon: CircleHelpIcon, title: "Pass the quiz", body: "Three questions. Retry as often as you like. +25 XP." },
  { icon: CodeIcon, title: "Write the code", body: "Implement it in NumPy and run the hidden tests. +100 XP and up." },
  { icon: UnlockIcon, title: "Unlock what's next", body: "The next lesson opens, and finishing a course opens the next course." },
]

/** First-visit guide to how the learning path works. Shown until dismissed or the learner earns XP. */
export function Onboarding({ show, next }: { show: boolean; next: StepRef | null }) {
  const dismissed = useJourneyStore((s) => s.onboardingDismissed)
  const dismiss = useJourneyStore((s) => s.dismissOnboarding)

  return (
    <AnimatePresence initial={false}>
      {show && !dismissed && (
        <motion.section
          key="onboarding"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-10 overflow-hidden"
          aria-label="How your learning path works"
        >
          <div className="relative rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 via-card to-ember/10 p-6 sm:p-8">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
              aria-label="Dismiss guide"
              onClick={dismiss}
            >
              <XIcon />
            </Button>
            <div className="mb-6 space-y-1.5 pr-8">
              <p className="text-sm font-medium text-brand">Welcome to {BRAND.name} 👋</p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Here&apos;s how your path works</h2>
            </div>
            <ol className="relative grid gap-5 sm:grid-cols-4 sm:gap-4">
              <motion.span
                aria-hidden
                className="absolute top-5 left-5 hidden h-0.5 origin-left bg-gradient-to-r from-primary via-brand to-ember sm:block"
                style={{ right: "12.5%" }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
              />
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <motion.li
                  key={title}
                  className="relative flex gap-3 sm:flex-col"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay: 0.25 + i * 0.3 }}
                >
                  <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 border-brand bg-background text-brand">
                    <Icon className="size-4" />
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                      {title}
                    </p>
                    <p className="text-sm text-muted-foreground">{body}</p>
                  </div>
                </motion.li>
              ))}
            </ol>
            <div className="mt-7 flex flex-wrap gap-2">
              {next && (
                <Button asChild>
                  <Link href={stepHref(next)} onClick={dismiss}>
                    Start your first lesson <ArrowRightIcon />
                  </Link>
                </Button>
              )}
              <Button variant="ghost" onClick={dismiss}>
                Got it
              </Button>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
