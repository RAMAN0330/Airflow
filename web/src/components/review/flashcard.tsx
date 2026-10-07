"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { BookMarkedIcon, BookOpenIcon, CheckIcon, HelpCircleIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

import type { ReviewCard } from "./deck"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

interface FlashcardProps {
  card: ReviewCard
  flipped: boolean
  /** Option the learner picked on a quiz card before flipping. */
  picked: number | null
  onFlip: () => void
  onPick: (option: number) => void
  trackTitle?: string
}

/** A two-sided card that flips in 3D (or cross-fades when reduced motion is on). */
export function Flashcard({ card, flipped, picked, onFlip, onPick, trackTitle }: FlashcardProps) {
  const reduce = useReducedMotion()
  const face = "col-start-1 row-start-1 flex min-h-72 flex-col rounded-2xl border bg-card p-6 shadow-sm sm:min-h-80 sm:p-8"

  return (
    <div className="grid [perspective:1600px]">
      <motion.div
        className="col-start-1 row-start-1 grid"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={reduce ? undefined : { rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
      >
        {/* Front */}
        <motion.section
          aria-hidden={flipped}
          inert={flipped}
          className={face}
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          animate={reduce ? { opacity: flipped ? 0 : 1 } : undefined}
        >
          <CardMeta card={card} trackTitle={trackTitle} />
          {card.kind === "term" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">What does this mean?</p>
              <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{card.term}</h2>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 py-4">
              <h2 className="text-lg font-semibold text-balance sm:text-xl">{card.prompt}</h2>
              <ol className="grid gap-2">
                {card.options.map((o, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onPick(i)}
                      className="flex w-full items-start gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-brand/50 hover:bg-brand/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="grid size-5 shrink-0 place-items-center rounded border text-[11px] font-semibold text-muted-foreground">
                        {LETTERS[i]}
                      </span>
                      <span>{o}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <button
            type="button"
            onClick={onFlip}
            className="mx-auto mt-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <RotateCcwIcon className="size-4" /> {card.kind === "quiz" ? "Show answer" : "Flip card"}
            <Kbd className="hidden sm:inline-flex">Space</Kbd>
          </button>
        </motion.section>

        {/* Back */}
        <motion.section
          aria-hidden={!flipped}
          inert={!flipped}
          className={cn(face, "bg-gradient-to-br from-card to-brand/5")}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: reduce ? undefined : "rotateY(180deg)",
          }}
          animate={reduce ? { opacity: flipped ? 1 : 0 } : undefined}
        >
          <CardMeta card={card} trackTitle={trackTitle} />
          {card.kind === "term" ? (
            <div className="flex flex-1 flex-col justify-center gap-3 py-6">
              <p className="text-sm font-semibold text-brand">{card.term}</p>
              <p className="text-lg leading-relaxed text-pretty">{card.definition}</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 py-4">
              <p className="text-sm font-medium text-muted-foreground">{card.prompt}</p>
              {picked !== null && (
                <p
                  className={cn(
                    "flex items-center gap-2 text-sm font-medium",
                    picked === card.answer ? "text-success" : "text-destructive"
                  )}
                  role="status"
                >
                  {picked === card.answer ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />}
                  {picked === card.answer ? "You got it." : `You picked ${LETTERS[picked]}.`}
                </p>
              )}
              <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-sm">
                <span className="mr-2 font-semibold text-success">{LETTERS[card.answer]}</span>
                {card.options[card.answer]}
              </div>
              {card.explanation && (
                <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <HelpCircleIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>{card.explanation}</span>
                </p>
              )}
            </div>
          )}
          <Link
            href={`/lessons/${card.lesson.id}`}
            className="mt-2 inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-brand"
          >
            <BookOpenIcon className="size-3.5" /> Revisit “{card.lesson.title}”
          </Link>
        </motion.section>
      </motion.div>
    </div>
  )
}

function CardMeta({ card, trackTitle }: { card: ReviewCard; trackTitle?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5 font-medium">
        {card.kind === "term" ? <BookMarkedIcon className="size-3.5" /> : <HelpCircleIcon className="size-3.5" />}
        {card.kind === "term" ? "Glossary" : "Quiz"}
      </span>
      <span className="truncate">{trackTitle ?? card.lesson.title}</span>
    </div>
  )
}
