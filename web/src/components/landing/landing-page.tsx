import Link from "next/link"
import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  BoxIcon,
  CodeIcon,
  FlaskConicalIcon,
  LightbulbIcon,
  ListOrderedIcon,
  MoonStarIcon,
  ShieldCheckIcon,
  TrophyIcon,
} from "lucide-react"

import { CoursePreview } from "@/components/landing/course-preview"
import { Faq } from "@/components/landing/faq"
import { HeroPreview } from "@/components/landing/hero-preview"
import { PlanCards } from "@/components/pricing/plan-cards"
import { SiteFooter } from "@/components/site-footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const STEPS = [
  {
    icon: BookOpenCheckIcon,
    title: "Learn the idea",
    body: "A focused lesson walks through the math and the shapes. Pass a short quiz to unlock the exercise.",
  },
  {
    icon: CodeIcon,
    title: "Implement it",
    body: "Write the algorithm in NumPy in a full editor, starting from a template. There's no framework doing the work for you.",
  },
  {
    icon: FlaskConicalIcon,
    title: "Get graded",
    body: "Hidden tests run in a sandbox and tell you exactly which property broke, with a hint for each failure.",
  },
]

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    title: "Sandboxed execution",
    body: "Every run is isolated with CPU, memory and time limits, so infinite loops and memory bombs fail safely.",
  },
  {
    icon: FlaskConicalIcon,
    title: "Property-based hidden tests",
    body: "Finite-difference gradient checks, convergence, numerical stability and causal leakage. Correct code passes however you write it.",
  },
  {
    icon: LightbulbIcon,
    title: "Hints, not answers",
    body: "Each failing test comes with a targeted hint. Recurring mistakes point you back to the lesson that fixes them.",
  },
  {
    icon: ListOrderedIcon,
    title: "A path that builds up",
    body: "Lessons and exercises unlock in sequence, and each course opens when you finish the previous one.",
  },
  {
    icon: TrophyIcon,
    title: "XP and leaderboard",
    body: "Earn XP for every lesson and exercise you complete, and see how you stack up this week and all time.",
  },
  {
    icon: MoonStarIcon,
    title: "Built for focus",
    body: "A resizable IDE, keyboard shortcuts, autosaved drafts, light and dark themes, and a layout that works on a phone.",
  },
]

export function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-brand)/0.12,transparent_60%)]" />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="space-y-6">
            <Badge variant="outline" className="gap-1.5 border-brand/30 bg-brand/5 py-1 text-brand">
              <BoxIcon /> Hands-on ML, graded in a sandbox
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Learn machine learning by{" "}
              <span className="bg-gradient-to-r from-brand to-fuchsia-500 bg-clip-text text-transparent">building it</span>.
            </h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">
              Go from gradient descent to self-attention by writing every algorithm yourself. Short lessons explain the
              math, and hidden tests check your code the way a reviewer would.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/learn">
                  Start learning free <ArrowRightIcon />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">No sign-up needed. Your progress is saved in this browser.</p>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
          <p className="text-sm font-medium text-brand">How it works</p>
          <h2 className="text-3xl font-semibold tracking-tight">Read, implement, get graded. Then unlock the next step.</h2>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="relative rounded-xl border bg-card p-6">
              <span className="absolute top-6 right-6 text-5xl font-semibold text-muted/80 tabular-nums select-none">{i + 1}</span>
              <div className="mb-4 grid size-10 place-items-center rounded-lg bg-brand/10">
                <Icon className="size-5 text-brand" />
              </div>
              <h3 className="mb-1.5 font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Curriculum */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm font-medium text-brand">The path</p>
              <h2 className="text-3xl font-semibold tracking-tight">Three courses, in order</h2>
              <p className="text-muted-foreground">
                Start with the estimators every model is built on, move through neural-network internals, and finish
                inside a transformer.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/learn">
                View all courses <ArrowRightIcon />
              </Link>
            </Button>
          </div>
          <CoursePreview />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
          <p className="text-sm font-medium text-brand">Why Gradient</p>
          <h2 className="text-3xl font-semibold tracking-tight">Feedback that teaches, not just a pass/fail</h2>
        </div>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-2">
              <Icon className="size-5 text-brand" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
            <p className="text-sm font-medium text-brand">Pricing</p>
            <h2 className="text-3xl font-semibold tracking-tight">Start free. Upgrade when you reach transformers.</h2>
          </div>
          <PlanCards />
          <p className="mt-6 text-center text-sm">
            <Link href="/pricing" className="font-medium text-brand underline-offset-4 hover:underline">
              Compare plans in detail →
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
        <Faq />
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-fuchsia-600 px-6 py-14 text-center text-white sm:px-12">
          <h2 className="text-3xl font-semibold tracking-tight">Your first lesson takes 12 minutes.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            Derive the gradient of a loss, then make gradient descent converge on real data, graded on the spot.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <Link href="/learn">
              Start the first lesson <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
