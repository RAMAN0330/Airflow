"use client"

import { useMemo, useState } from "react"
import { DicesIcon, ShuffleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { LabChoice, LabFrame, LabSlider, LabSvg, PlayControls, SERIES, Stat } from "./kit"
import { fmt, scale } from "./math"
import { gaussian, mulberry32, randInt, type Rng } from "./rng"
import { usePlayback } from "./use-playback"

type P = [number, number]
type Phase = "init" | "assign" | "update"
interface State {
  phase: Phase
  centroids: P[]
  assign: number[] | null
  inertia: number | null
}

const W = 480
const H = 320
const sx = scale(0, 12, 0, W)
const sy = scale(0, 8, H, 0)
const GX = 48
const GY = 32

function makeData(seed: number): P[] {
  const r = mulberry32(seed)
  const centers: P[] = Array.from({ length: 4 }, () => [2 + r() * 8, 1.5 + r() * 5])
  const pts: P[] = []
  centers.forEach(([cx, cy], c) => {
    const s = 0.45 + r() * 0.5
    for (let i = 0; i < 40 + c * 6; i++) pts.push([cx + gaussian(r) * s, cy + gaussian(r) * s])
  })
  return pts
}

const d2 = (a: P, b: P) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
const nearest = (p: P, cs: P[]) => cs.reduce((best, c, i) => (d2(p, c) < d2(p, cs[best]) ? i : best), 0)

function initCentroids(pts: P[], k: number, r: Rng, plusPlus: boolean): P[] {
  const cs: P[] = [pts[randInt(r, pts.length)]]
  while (cs.length < k) {
    if (!plusPlus) {
      cs.push(pts[randInt(r, pts.length)])
      continue
    }
    // k-means++: pick the next centre with probability proportional to squared distance.
    const w = pts.map((p) => Math.min(...cs.map((c) => d2(p, c))))
    let u = r() * w.reduce((a, b) => a + b, 0)
    let i = 0
    while (u > w[i] && i < w.length - 1) u -= w[i++]
    cs.push(pts[i])
  }
  return cs.map((c) => [c[0], c[1]])
}

/** The full sequence of Lloyd half-steps: init, then alternating assign / update until stable. */
function lloyd(pts: P[], k: number, seed: number, plusPlus: boolean): State[] {
  let cs = initCentroids(pts, k, mulberry32(seed), plusPlus)
  const states: State[] = [{ phase: "init", centroids: cs, assign: null, inertia: null }]
  let prev: number[] | null = null
  for (let it = 0; it < 30; it++) {
    const assign = pts.map((p) => nearest(p, cs))
    const inertia = pts.reduce((s, p, i) => s + d2(p, cs[assign[i]]), 0)
    states.push({ phase: "assign", centroids: cs, assign, inertia })
    if (prev && assign.every((a, i) => a === prev![i])) break
    prev = assign
    cs = cs.map((c, j) => {
      const mine = pts.filter((_, i) => assign[i] === j)
      if (!mine.length) return c
      return [mine.reduce((s, p) => s + p[0], 0) / mine.length, mine.reduce((s, p) => s + p[1], 0) / mine.length]
    })
    const after = pts.reduce((s, p, i) => s + d2(p, cs[assign[i]]), 0)
    states.push({ phase: "update", centroids: cs, assign, inertia: after })
  }
  return states
}

export function KMeansLab() {
  const [dataSeed, setDataSeed] = useState(11)
  const [initSeed, setInitSeed] = useState(2)
  const [k, setK] = useState(4)
  const [plusPlus, setPlusPlus] = useState(false)

  const pts = useMemo(() => makeData(dataSeed), [dataSeed])
  const states = useMemo(() => lloyd(pts, k, initSeed * 7919 + k, plusPlus), [pts, k, initSeed, plusPlus])
  const pb = usePlayback({ length: states.length - 1, interval: 750 })
  const s = states[pb.t]
  const converged = pb.t === states.length - 1
  const iteration = Math.ceil(pb.t / 2)

  const regions = useMemo(() => {
    const out: { x: number; y: number; c: number }[] = []
    for (let j = 0; j < GY; j++)
      for (let i = 0; i < GX; i++) {
        const p: P = [((i + 0.5) / GX) * 12, 8 - ((j + 0.5) / GY) * 8]
        out.push({ x: (i * W) / GX, y: (j * H) / GY, c: nearest(p, s.centroids) })
      }
    return out
  }, [s.centroids])

  const change = (fn: () => void) => {
    fn()
    pb.reset()
  }

  const phaseText: Record<Phase, string> = {
    init: `Start: ${k} centroids placed ${plusPlus ? "with k-means++ (spread out, far from each other)" : "at random data points"}. Nothing is assigned yet.`,
    assign: "Assign step: every point joins its nearest centroid. The shaded regions are each centroid's territory.",
    update: "Update step: each centroid moves to the mean of the points assigned to it, which can only lower the inertia.",
  }

  return (
    <LabFrame
      title="K-means, one Lloyd step at a time"
      prompt="Step through the assign / update cycle. Then set k to 3 or 6, or reseed the starting centroids, and compare the final inertia."
      live={!pb.playing}
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="iteration" value={iteration} />
            <Stat label="inertia" value={s.inertia === null ? "–" : fmt(s.inertia)} />
            {converged && <Stat label="status" value="converged" />}
          </span>
          {converged
            ? `Converged after ${iteration} iterations: assignments stopped changing. Inertia only reaches a local minimum, so a different start can end somewhere worse (or better).`
            : phaseText[s.phase]}
        </>
      }
      controls={
        <>
          <LabSlider label="Number of clusters k" value={k} min={1} max={8} onChange={(v) => change(() => setK(v))} />
          <LabChoice
            label="Initialisation"
            value={plusPlus ? "pp" : "random"}
            options={[
              { value: "random", label: "Random points" },
              { value: "pp", label: "k-means++" },
            ]}
            onChange={(v) => change(() => setPlusPlus(v === "pp"))}
          />
          <PlayControls playing={pb.playing} done={pb.done} onToggle={pb.toggle} onStep={() => pb.step(1)} onReset={pb.reset} stepLabel="Half-step">
            <Button type="button" size="sm" variant="outline" onClick={() => change(() => setInitSeed((v) => v + 1))}>
              <ShuffleIcon /> Reseed centroids
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => change(() => setDataSeed((v) => v + 1))}>
              <DicesIcon /> New data
            </Button>
          </PlayControls>
        </>
      }
    >
      <LabSvg width={W} height={H} label={`Scatter of ${pts.length} points clustered into ${k} groups, iteration ${iteration}`}>
        {s.assign &&
          regions.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={W / GX + 0.5} height={H / GY + 0.5} className={SERIES[r.c].fill} fillOpacity={0.09} />
          ))}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={sx(p[0])}
            cy={sy(p[1])}
            r={3.5}
            className={s.assign ? SERIES[s.assign[i]].fill : "fill-muted-foreground"}
            fillOpacity={s.assign ? 0.85 : 0.5}
          />
        ))}
        {s.centroids.map((c, j) => {
          const trail = states.slice(0, pb.t + 1).map((st) => st.centroids[j])
          return (
            <g key={j}>
              <polyline
                points={trail.map((q) => `${sx(q[0])},${sy(q[1])}`).join(" ")}
                fill="none"
                className="stroke-foreground"
                strokeOpacity={0.45}
                strokeDasharray="3 3"
              />
              <circle cx={sx(c[0])} cy={sy(c[1])} r={9} className={`${SERIES[j].fill} stroke-foreground`} strokeWidth={2} />
              <path
                d={`M${sx(c[0]) - 4} ${sy(c[1]) - 4}L${sx(c[0]) + 4} ${sy(c[1]) + 4}M${sx(c[0]) + 4} ${sy(c[1]) - 4}L${sx(c[0]) - 4} ${sy(c[1]) + 4}`}
                className="stroke-background"
                strokeWidth={2}
              />
            </g>
          )
        })}
      </LabSvg>
    </LabFrame>
  )
}
