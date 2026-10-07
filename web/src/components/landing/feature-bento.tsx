import {
  AwardIcon,
  BookMarkedIcon,
  CheckIcon,
  CommandIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  GitCompareArrowsIcon,
  LightbulbIcon,
  MapIcon,
  RotateCcwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"

import { LogoMark } from "@/components/logo"
import { Reveal, Stagger, StaggerItem } from "@/components/motion/primitives"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

/* ---------- Small static illustrations, one per tile. Decorative, so hidden from AT. ---------- */

function TestsVisual() {
  const rows: [boolean, string][] = [
    [true, "Gradient matches finite differences"],
    [true, "Loss decreases every epoch"],
    [true, "Stable for large logits"],
    [false, "No look-ahead across the time split"],
  ]
  return (
    <div className="space-y-2 rounded-xl border bg-background/70 p-4 font-mono text-[11px] shadow-xs sm:text-xs">
      <div className="mb-3 flex items-center justify-between font-sans text-xs font-medium">
        <span>3 of 4 tests passing</span>
        <span className="text-muted-foreground">sandbox · 0.8s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-primary via-brand to-ember" />
      </div>
      {rows.map(([ok, name]) => (
        <div key={name} className="flex items-center gap-2">
          {ok ? <CheckIcon className="size-3.5 shrink-0 text-success" /> : <XIcon className="size-3.5 shrink-0 text-destructive" />}
          <span className="truncate">{name}</span>
        </div>
      ))}
      <div className="mt-2 flex items-start gap-2 rounded-md bg-brand/10 px-2 py-1.5 font-sans text-muted-foreground">
        <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
        Fit the scaler on the training window only, then apply it to the test window.
      </div>
    </div>
  )
}

function PaletteVisual() {
  return (
    <div className="overflow-hidden rounded-xl border bg-background/70 shadow-xs">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
        <SearchIcon className="size-3.5" />
        <span className="flex-1">attention</span>
        <Kbd className="border bg-background">⌘K</Kbd>
      </div>
      <ul className="space-y-0.5 p-1.5 text-xs">
        {["Lesson · Attention intuition", "Exercise · Multi-head attention", "Page · Skill Map"].map((t, i) => (
          <li key={t} className={cn("truncate rounded-md px-2 py-1.5", i === 0 ? "bg-accent text-foreground" : "text-muted-foreground")}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FlashcardVisual() {
  return (
    <div className="relative h-28">
      <div className="absolute inset-x-6 top-0 h-20 rotate-[-4deg] rounded-xl border bg-muted/60" />
      <div className="absolute inset-x-3 top-2 h-20 rotate-[2deg] rounded-xl border bg-muted" />
      <div className="absolute inset-x-0 top-4 flex h-24 flex-col justify-between rounded-xl border bg-card p-3 shadow-sm transition-transform duration-300 group-hover:-translate-y-1">
        <p className="text-xs font-medium">Why scale scores by √dₖ?</p>
        <div className="flex gap-1.5 text-[10px] font-medium">
          {["Again", "Hard", "Good", "Easy"].map((b, i) => (
            <span key={b} className={cn("rounded-md border px-1.5 py-0.5", i === 2 && "border-brand/40 bg-brand/10 text-brand")}>
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkillMapVisual() {
  const nodes: [number, number, string][] = [
    [30, 70, "fill-emerald-500"],
    [90, 40, "fill-emerald-500"],
    [90, 100, "fill-sky-500"],
    [150, 70, "fill-violet-500"],
    [210, 40, "fill-violet-500"],
    [210, 100, "fill-muted-foreground/30"],
    [260, 70, "fill-muted-foreground/30"],
  ]
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [3, 5],
    [4, 6],
    [5, 6],
  ]
  return (
    <svg viewBox="0 0 290 140" className="h-28 w-full" aria-hidden>
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={nodes[a][0]}
          y1={nodes[a][1]}
          x2={nodes[b][0]}
          y2={nodes[b][1]}
          className={b >= 5 ? "stroke-border" : "stroke-brand/50"}
          strokeWidth={2}
          strokeDasharray={b >= 5 ? "4 4" : undefined}
        />
      ))}
      {nodes.map(([x, y, c], i) => (
        <circle key={i} cx={x} cy={y} r={i === 4 ? 11 : 9} className={cn(c, "stroke-card")} strokeWidth={3} />
      ))}
      <circle cx={nodes[4][0]} cy={nodes[4][1]} r={16} className="fill-none stroke-brand/40" strokeWidth={2} />
    </svg>
  )
}

function CompareVisual() {
  const yours = ["w = w - lr * grad", "for _ in range(n):", "  grad = X.T @ (X@w - y)"]
  const ref = ["w -= lr * grad", "for _ in range(n_iter):", "  grad = X.T @ (X@w - y) / n"]
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border font-mono text-[10px] shadow-xs">
      {[
        ["You", yours],
        ["Reference", ref],
      ].map(([label, lines]) => (
        <div key={label as string} className="min-w-0 bg-background/80 p-2.5">
          <p className="mb-1.5 font-sans text-[10px] font-medium text-muted-foreground">{label as string}</p>
          {(lines as string[]).map((l, i) => (
            <p
              key={i}
              className={cn(
                "truncate rounded-sm px-1",
                i === 2 && (label === "You" ? "bg-destructive/10" : "bg-success/15")
              )}
            >
              {l}
            </p>
          ))}
        </div>
      ))}
    </div>
  )
}

function LabVisual() {
  return (
    <div className="rounded-xl border bg-background/70 p-4 shadow-xs">
      <svg viewBox="0 0 300 90" className="h-24 w-full" aria-hidden>
        <path d="M0 80 C 60 80, 80 10, 150 10 S 240 80, 300 80" className="fill-none stroke-border" strokeWidth={2} />
        <path d="M0 80 C 60 80, 80 10, 150 10 S 240 80, 300 80" className="fill-none stroke-brand" strokeWidth={2.5} strokeDasharray="300" strokeDashoffset="110" />
        {[30, 70, 110, 150].map((x, i) => (
          <circle key={x} cx={x + 20} cy={[78, 48, 16, 10][i]} r={4.5} className="fill-ember stroke-background" strokeWidth={2} />
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="shrink-0">learning rate</span>
        <span className="relative h-1.5 flex-1 rounded-full bg-muted">
          <span className="absolute inset-y-0 left-0 w-[45%] rounded-full bg-brand" />
          <span className="absolute top-1/2 left-[45%] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-background shadow-sm transition-[left] duration-500 group-hover:left-[70%]" />
        </span>
        <span className="w-8 text-right font-mono tabular-nums">0.05</span>
      </div>
    </div>
  )
}

function CertificateVisual() {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-ember/10 p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <LogoMark className="size-6" />
        <AwardIcon className="size-5 text-ember" />
      </div>
      <p className="mt-3 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Certificate of completion</p>
      <p className="mt-1 text-sm font-semibold">Deep Learning Foundations</p>
      <div className="mt-3 space-y-1.5">
        <div className="h-1.5 w-3/4 rounded-full bg-muted" />
        <div className="h-1.5 w-1/2 rounded-full bg-muted" />
      </div>
    </div>
  )
}

/* ---------- The grid ---------- */

interface Tile {
  icon: LucideIcon
  title: string
  body: string
  visual?: React.ReactNode
  className?: string
  isNew?: boolean
}

const TILES: Tile[] = [
  {
    icon: FlaskConicalIcon,
    title: "Graded by hidden tests, in a sandbox",
    body: "Property-based tests check what makes an implementation correct: gradients against finite differences, convergence, numerical stability, leakage. Any correct approach passes, and each failure comes with a targeted hint.",
    visual: <TestsVisual />,
    className: "md:col-span-2 lg:col-span-4",
  },
  {
    icon: CommandIcon,
    title: "Jump anywhere with ⌘K",
    body: "A command palette to find any course, lesson, exercise or page from the keyboard.",
    visual: <PaletteVisual />,
    className: "lg:col-span-2",
    isNew: true,
  },
  {
    icon: RotateCcwIcon,
    title: "Spaced-repetition Review",
    body: "Concepts from lessons you've finished return as flashcards, scheduled to come back right before you'd forget them.",
    visual: <FlashcardVisual />,
    className: "lg:col-span-2",
    isNew: true,
  },
  {
    icon: MapIcon,
    title: "Skill Map",
    body: "See how concepts across the tracks build on each other, and where you are on the map.",
    visual: <SkillMapVisual />,
    className: "lg:col-span-2",
    isNew: true,
  },
  {
    icon: GitCompareArrowsIcon,
    title: "Compare with a reference solution",
    body: "Once your code passes, put it side by side with a reference implementation and see a different way to write it.",
    visual: <CompareVisual />,
    className: "lg:col-span-2",
    isNew: true,
  },
  {
    icon: SlidersHorizontalIcon,
    title: "Interactive visual labs",
    body: "Drag, tweak parameters and watch an algorithm respond before you implement it. Build intuition first, then the code.",
    visual: <LabVisual />,
    className: "lg:col-span-3",
    isNew: true,
  },
  {
    icon: AwardIcon,
    title: "Course certificates",
    body: "Finish every lesson and graded exercise in a course to earn a certificate for it.",
    visual: <CertificateVisual />,
    className: "lg:col-span-3",
    isNew: true,
  },
  {
    icon: DatabaseIcon,
    title: "A real SQL playground",
    body: "Query a sample shop database with a schema explorer. Every run gets a fresh copy, so experiment freely.",
    className: "lg:col-span-2",
  },
  {
    icon: BookMarkedIcon,
    title: "Cited, trusted sources",
    body: "Lessons link the original papers, official docs and textbooks they draw on, collected in a searchable library and glossary.",
    className: "lg:col-span-2",
  },
  {
    icon: LightbulbIcon,
    title: "Built for focus",
    body: "A resizable editor, keyboard shortcuts, autosaved drafts, light and dark themes, and a layout that works on a phone.",
    className: "md:col-span-2 lg:col-span-2",
  },
]

export function FeatureBento() {
  return (
    <section id="features" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <Reveal className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">Everything you need to go deep</p>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Feedback that teaches, and tools that make it stick
        </h2>
      </Reveal>
      <Stagger inView step={0.06} className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        {TILES.map(({ icon: Icon, title, body, visual, className, isNew }) => (
          <StaggerItem
            key={title}
            className={cn(
              "group relative flex flex-col gap-5 overflow-hidden rounded-2xl border bg-card p-6 shadow-xs transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-elevated motion-reduce:hover:translate-y-0",
              className
            )}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-24 size-48 rounded-full bg-brand/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
            />
            {visual && <div aria-hidden>{visual}</div>}
            <div className="mt-auto space-y-1.5">
              <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                <Icon className="size-4 text-brand" aria-hidden />
                {title}
                {isNew && (
                  <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-ember">
                    New
                  </span>
                )}
              </h3>
              <p className="text-sm text-pretty text-muted-foreground">{body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}
