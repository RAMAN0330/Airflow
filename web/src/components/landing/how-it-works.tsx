import { AwardIcon, BookOpenCheckIcon, CircleHelpIcon, CodeIcon, FlaskConicalIcon, RotateCcwIcon } from "lucide-react"

import { HeroPreview } from "@/components/landing/hero-preview"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"

const JOURNEY = [
  {
    icon: BookOpenCheckIcon,
    title: "Learn the idea",
    body: "A short lesson walks through the math and the shapes, with key takeaways, an animated flow diagram and links to the papers and docs it's based on.",
  },
  {
    icon: CircleHelpIcon,
    title: "Check your understanding",
    body: "A quick quiz confirms the idea landed. Pass it to unlock the exercise. Retry as often as you like.",
  },
  {
    icon: CodeIcon,
    title: "Build it yourself",
    body: "Implement the algorithm or pipeline in a full editor, starting from a template. No framework does the work for you.",
  },
  {
    icon: FlaskConicalIcon,
    title: "Get graded, then compare",
    body: "Hidden tests run in a sandbox and point to exactly what broke, with a hint for each failure. Once you pass, compare your code with a reference solution.",
  },
  {
    icon: RotateCcwIcon,
    title: "Make it stick",
    body: "Concepts you've finished come back as spaced-repetition flashcards in Review, so they're still there next month.",
  },
  {
    icon: AwardIcon,
    title: "Earn the next layer",
    body: "Each step unlocks the next. Finish a course to earn its certificate and open the course that builds on it.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative mx-auto w-full max-w-7xl scroll-mt-20 overflow-x-clip px-4 py-20 sm:px-6 lg:py-28">
      <Reveal className="mx-auto mb-14 max-w-2xl space-y-3 text-center">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">How it works</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          One loop, repeated until the foundations are solid
        </h2>
        <p className="text-pretty text-muted-foreground">
          Every module follows the same rhythm: understand it, build it, prove it, keep it.
        </p>
      </Reveal>
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <Stagger as="ol" inView step={0.1} className="relative space-y-1">
          <span
            aria-hidden
            className="absolute top-5 bottom-5 left-5 w-px bg-gradient-to-b from-primary via-brand to-ember opacity-50"
          />
          {JOURNEY.map(({ icon: Icon, title, body }, i) => (
            <StaggerItem as="li" key={title} className="relative flex gap-4 rounded-xl p-0 pb-6 last:pb-0">
              <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border bg-card text-brand shadow-xs ring-4 ring-background">
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 pt-1.5">
                <h3 className="flex items-baseline gap-2 font-semibold">
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">0{i + 1}</span>
                  {title}
                </h3>
                <p className="mt-1 text-sm text-pretty text-muted-foreground">{body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="min-w-0 lg:sticky lg:top-24">
          <HeroPreview />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Illustration of the exercise workspace: run the hidden tests, see what broke, get a hint.
          </p>
        </div>
      </div>
    </section>
  )
}
