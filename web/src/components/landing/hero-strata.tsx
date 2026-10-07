import type { CSSProperties } from "react"

/** One isometric slab. Faces are coloured with Tailwind fill utilities so they work in both themes. */
interface Layer {
  title: string
  note: string
  a: number // half-width of the top face
  cy: number // y of the top-face centre
  top: string
  left: string
  right: string
}

const CX = 196
const H = 26 // slab thickness

// Bottom to top: the foundation first, production on top.
const LAYERS: Layer[] = [
  { title: "Math & Statistics", note: "the foundation", a: 180, cy: 304, top: "fill-emerald-400", left: "fill-emerald-500", right: "fill-emerald-700" },
  { title: "Data Engineering", note: "the pipelines", a: 150, cy: 258, top: "fill-sky-400", left: "fill-sky-500", right: "fill-sky-700" },
  { title: "Machine Learning", note: "the models", a: 120, cy: 212, top: "fill-violet-400", left: "fill-violet-500", right: "fill-violet-700" },
  { title: "MLOps", note: "in production", a: 90, cy: 166, top: "fill-amber-300", left: "fill-amber-400", right: "fill-amber-600" },
]

function pts(...p: [number, number][]) {
  return p.map(([x, y]) => `${x},${y}`).join(" ")
}

function Slab({ a, cy, top, left, right }: Pick<Layer, "a" | "cy" | "top" | "left" | "right">) {
  const b = a / 2
  const inner = a * 0.62
  const ib = inner / 2
  return (
    <>
      <polygon className={left} points={pts([CX - a, cy], [CX, cy + b], [CX, cy + b + H], [CX - a, cy + H])} />
      <polygon className={right} points={pts([CX, cy + b], [CX + a, cy], [CX + a, cy + H], [CX, cy + b + H])} />
      <polygon className={top} points={pts([CX, cy - b], [CX + a, cy], [CX, cy + b], [CX - a, cy])} />
      {/* Inset outline on the top face for a machined look. */}
      <polygon
        points={pts([CX, cy - ib], [CX + inner, cy], [CX, cy + ib], [CX - inner, cy])}
        fill="none"
        stroke="white"
        strokeOpacity={0.35}
        strokeWidth={1.25}
      />
      {/* Highlight along the front edges. */}
      <polyline points={pts([CX - a, cy], [CX, cy + b], [CX + a, cy])} fill="none" stroke="white" strokeOpacity={0.45} strokeWidth={1.25} />
    </>
  )
}

/**
 * Hero illustration: the four tracks as strata, each settling onto the layer beneath it.
 * Server-rendered SVG animated with CSS, so it is visible before hydration and still for
 * people who prefer reduced motion.
 */
export function HeroStrata() {
  const capCy = 104
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        aria-hidden
        className="animate-blob absolute inset-[8%] -z-10 rounded-full bg-gradient-to-br from-brand/25 via-primary/15 to-ember/20 blur-3xl"
      />
      <svg
        viewBox="0 0 560 440"
        role="img"
        aria-labelledby="hero-strata-title"
        className="h-auto w-full overflow-visible"
      >
        <title id="hero-strata-title">
          Four tracks stacked as layers: Math &amp; Statistics at the base, then Data Engineering, Machine Learning and
          MLOps on top.
        </title>
        {/* Ground shadow. */}
        <ellipse cx={CX} cy={412} rx={190} ry={22} className="fill-primary/10 dark:fill-black/40" />
        {LAYERS.map((l, i) => (
          <g key={l.title} className="strata-drop" style={{ "--enter-delay": `${200 + i * 160}ms` } as CSSProperties}>
            <Slab {...l} />
            <line
              x1={CX + l.a + 6}
              y1={l.cy + H / 2}
              x2={CX + l.a + 24}
              y2={l.cy + H / 2}
              className="stroke-muted-foreground/50"
              strokeWidth={1.25}
              strokeDasharray="2 3"
            />
            <circle cx={CX + l.a + 4} cy={l.cy + H / 2} r={2.5} className="fill-muted-foreground/70" />
            <text x={CX + l.a + 30} y={l.cy + H / 2} dominantBaseline="middle" className="fill-foreground text-[17px] font-semibold">
              {l.title}
            </text>
            <text x={CX + l.a + 30} y={l.cy + H / 2 + 19} dominantBaseline="middle" className="fill-muted-foreground text-[13px] max-sm:hidden">
              {l.note}
            </text>
          </g>
        ))}
        {/* The next block, hovering where it will land: what you build next. */}
        <g className="strata-drop" style={{ "--enter-delay": "900ms" } as CSSProperties}>
          <line x1={CX} y1={capCy + 44} x2={CX} y2={LAYERS[3].cy - 2} className="stroke-brand/50" strokeWidth={1.5} strokeDasharray="3 4" />
          <g className="animate-float">
            <polygon className="fill-brand/80" points={pts([CX - 26, capCy], [CX, capCy + 13], [CX, capCy + 39], [CX - 26, capCy + 26])} />
            <polygon className="fill-primary" points={pts([CX, capCy + 13], [CX + 26, capCy], [CX + 26, capCy + 26], [CX, capCy + 39])} />
            <polygon className="fill-brand" points={pts([CX, capCy - 13], [CX + 26, capCy], [CX, capCy + 13], [CX - 26, capCy])} />
            <polyline points={pts([CX - 26, capCy], [CX, capCy + 13], [CX + 26, capCy])} fill="none" stroke="white" strokeOpacity={0.5} strokeWidth={1.25} />
          </g>
        </g>
      </svg>
    </div>
  )
}
