"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, CheckCircle2Icon, CircleHelpIcon, Loader2Icon, PartyPopperIcon, XCircleIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { EASE, Stagger, StaggerItem } from "@/components/motion/primitives"

import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { celebrate } from "@/lib/celebrate"
import { stepHref } from "@/lib/links"
import type { LessonDetail } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useLessonStore } from "@/stores/lesson-store"

export function Quiz({ lesson }: { lesson: LessonDetail }) {
  const router = useRouter()
  const answers = useLessonStore((s) => s.answers)
  const choose = useLessonStore((s) => s.choose)
  const submit = useLessonStore((s) => s.submit)
  const submitting = useLessonStore((s) => s.submitting)
  const attempt = useLessonStore((s) => s.attempt)

  const locked = lesson.status === "locked"
  const completed = lesson.status === "completed"
  const allAnswered = lesson.questions.every((q) => answers[q.id] !== undefined)
  const verdict = (id: string) => attempt?.results.find((r) => r.id === id)
  const passedNow = attempt?.passed

  const onSubmit = async () => {
    try {
      const res = await submit()
      if (!res) return
      if (res.newly_completed) {
        celebrate({ title: "Lesson complete!", xp: res.xp_earned, unlocked: res.unlocked, navigate: (h) => router.push(h) })
      } else if (!res.passed) {
        const wrong = res.results.filter((r) => !r.correct).length
        toast(`${wrong} answer${wrong > 1 ? "s" : ""} to revisit`, {
          description: "Re-read the relevant section and try again. There's no penalty for retrying.",
        })
      }
    } catch (e) {
      toast.error("Couldn't check your answers", { description: (e as Error).message })
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-xs sm:p-7" aria-labelledby="quiz-title">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10">
          <CircleHelpIcon className="size-5 text-brand" />
        </div>
        <div className="space-y-1">
          <h2 id="quiz-title" className="text-lg font-semibold">
            Check your understanding
          </h2>
          <p className="text-sm text-muted-foreground">
            {completed
              ? "You've passed this quiz. Retake it any time to review."
              : `Answer all ${lesson.questions.length} correctly to complete the lesson (+${lesson.xp} XP) and unlock the next step.`}
          </p>
        </div>
      </div>

      <Stagger as="ol" inView step={0.1} className="space-y-6">
        {lesson.questions.map((q, qi) => {
          const v = verdict(q.id)
          return (
            <StaggerItem as="li" key={q.id} className="space-y-3">
              <p className="font-medium">
                <span className="mr-2 text-muted-foreground tabular-nums">{qi + 1}.</span>
                {q.prompt}
              </p>
              <RadioGroup
                value={answers[q.id] !== undefined ? String(answers[q.id]) : ""}
                onValueChange={(val) => choose(q.id, Number(val))}
                disabled={locked}
                className="gap-2"
              >
                {q.options.map((opt, oi) => {
                  const selected = answers[q.id] === oi
                  const id = `${q.id}-${oi}`
                  return (
                    <label
                      key={oi}
                      htmlFor={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-all duration-200 hover:translate-x-0.5 hover:bg-muted/50 active:scale-[0.99]",
                        selected && "border-brand bg-brand/5",
                        selected && v?.correct && "border-success bg-success/5",
                        selected && v && !v.correct && "border-destructive bg-destructive/5",
                        locked && "cursor-not-allowed opacity-60"
                      )}
                    >
                      <RadioGroupItem id={id} value={String(oi)} />
                      <span>{opt}</span>
                    </label>
                  )
                })}
              </RadioGroup>
              <AnimatePresence initial={false}>
                {v && (
                  <motion.p
                    key={`${q.id}-${v.correct}`}
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={v.correct ? { opacity: 1, height: "auto", y: 0 } : { opacity: 1, height: "auto", y: 0, x: [0, -6, 6, -4, 4, 0] }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className={cn(
                      "flex gap-2 overflow-hidden rounded-md px-3 py-2 text-sm",
                      v.correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {v.correct ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" /> : <XCircleIcon className="mt-0.5 size-4 shrink-0" />}
                    <span className={v.correct ? "text-foreground/80" : undefined}>
                      {v.correct ? v.explanation : "Not quite. Review the lesson and pick another answer."}
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>
            </StaggerItem>
          )
        })}
      </Stagger>

      <AnimatePresence>
      {passedNow || completed ? (
        <motion.div
          key="passed"
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4"
        >
          <motion.span
            initial={{ rotate: -30, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10, delay: 0.15 }}
          >
            <PartyPopperIcon className="size-5 text-success" />
          </motion.span>
          <p className="flex-1 text-sm">
            <span className="font-medium">{attempt?.newly_completed ? `Lesson complete: +${attempt.xp_earned} XP.` : "Lesson complete."}</span>{" "}
            {lesson.next && <span className="text-muted-foreground">Next: {lesson.next.title}</span>}
          </p>
          {lesson.next && lesson.next.status !== "locked" ? (
            <Button asChild>
              <Link href={stepHref(lesson.next)}>
                {lesson.next.kind === "exercise" ? "Start the exercise" : "Next lesson"} <ArrowRightIcon />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/learn/${lesson.course.id}`}>Back to course</Link>
            </Button>
          )}
        </motion.div>
      ) : null}
      </AnimatePresence>

      {!passedNow && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {locked && <span className="text-sm text-muted-foreground">Unlock this lesson to submit answers.</span>}
          {!locked && !allAnswered && (
            <span className="text-sm text-muted-foreground">
              {Object.keys(answers).length} of {lesson.questions.length} answered
            </span>
          )}
          <Button onClick={onSubmit} variant={completed ? "outline" : "default"} disabled={locked || !allAnswered || submitting}>
            {submitting && <Loader2Icon className="animate-spin" />}
            {attempt ? "Check again" : "Check answers"}
          </Button>
        </div>
      )}
    </section>
  )
}
