"use client"

import { useMemo, useState } from "react"

import { contourPath } from "./contours"
import { LabChoice, LabFrame, LabLogSlider, LabSlider, LabSvg, PlayControls, SERIES, Stat, Swatch } from "./kit"
import { fmt, scale } from "./math"
import { usePlayback } from "./use-playback"

type Vec = [number, number]
type LandscapeId = "bowl" | "rosenbrock"
type Opt = "gd" | "momentum" | "adam"

interface Landscape {
  label: string
  f: (x: number, y: number) => number
  grad: (x: number, y: number) => Vec
  xDom: Vec
  yDom: Vec
  start: Vec
  min: Vec
  /** [min, max, default] learning rate for GD / momentum. */
  lr: [number, number, number]
  /** [min, max, default] Adam step size. */
  adam: [number, number, number]
  levels: number[]
  steps: number
}

const LANDSCAPES: Record<LandscapeId, Landscape> = {
  bowl: {
    label: "Stretched bowl",
    f: (x, y) => 0.5 * (x * x + 10 * y * y),
    grad: (x, y) => [x, 10 * y],
    xDom: [-3, 3],
    yDom: [-2, 2],
    start: [-2.6, 1.5],
    min: [0, 0],
    lr: [0.005, 0.3, 0.05],
    adam: [0.005, 0.5, 0.08],
    levels: [0.02, 0.1, 0.3, 0.7, 1.5, 3, 6, 10, 16],
    steps: 150,
  },
  rosenbrock: {
    label: "Rosenbrock valley",
    f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
    xDom: [-2.25, 2.25],
    yDom: [-1, 2],
    start: [-1.5, 2],
    min: [1, 1],
    lr: [0.00002, 0.004, 0.001],
    adam: [0.002, 0.3, 0.03],
    levels: [0.25, 1, 3, 8, 20, 50, 120, 300, 700],
    steps: 600,
  },
}

const OPTS: { id: Opt; label: string; color: (typeof SERIES)[number] }[] = [
  { id: "gd", label: "SGD", color: SERIES[2] },
  { id: "momentum", label: "Momentum", color: SERIES[0] },
  { id: "adam", label: "Adam", color: SERIES[1] },
]

function descend(L: Landscape, start: Vec, opt: Opt, lr: number, beta: number) {
  let [x, y] = start
  const path: Vec[] = [[x, y]]
  let vx = 0, vy = 0, mx = 0, my = 0, sx = 0, sy = 0
  for (let k = 1; k <= L.steps; k++) {
    const [gx, gy] = L.grad(x, y)
    if (opt === "adam") {
      mx = 0.9 * mx + 0.1 * gx
      my = 0.9 * my + 0.1 * gy
      sx = 0.999 * sx + 0.001 * gx * gx
      sy = 0.999 * sy + 0.001 * gy * gy
      const c1 = 1 - 0.9 ** k
      const c2 = 1 - 0.999 ** k
      x -= (lr * (mx / c1)) / (Math.sqrt(sx / c2) + 1e-8)
      y -= (lr * (my / c1)) / (Math.sqrt(sy / c2) + 1e-8)
    } else {
      const b = opt === "gd" ? 0 : beta
      vx = b * vx + gx
      vy = b * vy + gy
      x -= lr * vx
      y -= lr * vy
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 40 || Math.abs(y) > 40) return { path, diverged: true }
    path.push([x, y])
  }
  return { path, diverged: false }
}

const W = 480
const H = 320
const NX = 72
const NY = 48

function useLandscape(id: LandscapeId) {
  return useMemo(() => {
    const L = LANDSCAPES[id]
    const sx = scale(L.xDom[0], L.xDom[1], 0, W)
    const sy = scale(L.yDom[0], L.yDom[1], H, 0)
    const vals = new Float64Array(NX * NY)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const x = L.xDom[0] + (i / (NX - 1)) * (L.xDom[1] - L.xDom[0])
        const y = L.yDom[0] + (j / (NY - 1)) * (L.yDom[1] - L.yDom[0])
        vals[j * NX + i] = L.f(x, y)
      }
    const toPx = (gi: number, gj: number): Vec => [(gi / (NX - 1)) * W, H - (gj / (NY - 1)) * H]
    const contours = L.levels.map((lv) => contourPath(vals, NX, NY, lv, toPx))
    return { L, sx, sy, contours }
  }, [id])
}

function GradientDescentPlayground({ compare }: { compare: boolean }) {
  const [id, setId] = useState<LandscapeId>(compare ? "rosenbrock" : "bowl")
  const { L, sx, sy, contours } = useLandscape(id)
  const [lr, setLr] = useState(L.lr[2])
  const [beta, setBeta] = useState(compare ? 0.9 : 0)
  const [adamLr, setAdamLr] = useState(L.adam[2])
  const [start, setStart] = useState<Vec>(L.start)

  const runs = useMemo(() => {
    const opts = compare ? OPTS : [OPTS[1]]
    return opts.map((o) => ({ ...o, ...descend(L, start, o.id, o.id === "adam" ? adamLr : lr, beta) }))
  }, [L, start, compare, lr, beta, adamLr])

  const length = Math.max(...runs.map((r) => r.path.length - 1))
  const pb = usePlayback({ length, interval: 40, stride: Math.ceil(L.steps / 150) })

  const switchLandscape = (next: LandscapeId) => {
    const N = LANDSCAPES[next]
    setId(next)
    setLr(N.lr[2])
    setAdamLr(N.adam[2])
    setStart(N.start)
    pb.reset()
  }

  const onPointer = (px: number, py: number) => {
    const x = L.xDom[0] + (px / W) * (L.xDom[1] - L.xDom[0])
    const y = L.yDom[1] - (py / H) * (L.yDom[1] - L.yDom[0])
    setStart([x, y])
    pb.reset()
  }

  const at = (r: (typeof runs)[number]) => r.path[Math.min(pb.t, r.path.length - 1)]
  const main = runs[0]
  const p = at(main)
  const loss = L.f(p[0], p[1])
  const blewUp = main.diverged && pb.t >= main.path.length - 1

  let readout
  if (compare) {
    readout = (
      <>
        <span className="mb-1.5 flex flex-wrap gap-1.5">
          <Stat label="step" value={pb.t} />
          {runs.map((r) => {
            const q = at(r)
            const gone = r.diverged && pb.t >= r.path.length - 1
            return <Stat key={r.id} label={r.label} value={gone ? "diverged" : fmt(L.f(q[0], q[1]))} />
          })}
        </span>
        {id === "rosenbrock"
          ? "SGD crawls along the flat, curved valley floor; momentum accumulates velocity along it; Adam rescales each coordinate by its recent gradient size, so steep and flat directions move at similar speeds."
          : "In the stretched bowl SGD zig-zags across the steep axis; momentum cancels the zig-zag and speeds up the shallow axis; Adam normalises both axes to similar step sizes."}
      </>
    )
  } else if (blewUp) {
    readout = (
      <>
        <strong className="text-destructive">Diverged after {main.path.length - 1} steps.</strong> Each update overshoots the
        valley and lands higher up the opposite wall, so the error grows instead of shrinking. Lower the learning rate
        {id === "bowl" && <> (plain GD on this bowl needs lr &lt; 2/10 = 0.2, since the steep axis has curvature 10)</>}.
      </>
    )
  } else if (id === "bowl") {
    const factor = 1 - lr * 10
    readout = (
      <>
        Step {pb.t}: loss <strong>{fmt(loss)}</strong>. Without momentum, each step multiplies the steep-axis error by
        1 − lr×10 = <strong>{fmt(factor)}</strong>
        {factor < 0 ? ", which is negative, so the path zig-zags across the valley" : ", so the path slides smoothly into the valley"}.
        {beta > 0 && <> Momentum β = {fmt(beta)} carries {Math.round(beta * 100)}% of the previous velocity forward.</>}
      </>
    )
  } else {
    readout = (
      <>
        Step {pb.t}: loss <strong>{fmt(loss)}</strong>, distance to the minimum (1, 1) ={" "}
        <strong>{fmt(Math.hypot(p[0] - 1, p[1] - 1))}</strong>. The valley walls are steep but its floor is nearly flat,
        so a learning rate small enough to stay stable makes slow progress along the floor.{" "}
        {beta === 0 ? "Add momentum to build up speed along it." : `Momentum (β = ${fmt(beta)}) builds up speed along it.`}
      </>
    )
  }

  return (
    <LabFrame
      title={compare ? "Optimizer race: SGD vs Momentum vs Adam" : "Gradient descent on a loss surface"}
      prompt={
        compare
          ? "Press play and watch the three optimizers leave the same start point. Then click the plot to start them somewhere else."
          : "Raise the learning rate until the path zig-zags, then until it diverges. Then add momentum. Click the plot to choose a new start point."
      }
      live={!pb.playing}
      legend={
        <>
          {runs.map((r) => (
            <Swatch key={r.id} className={r.color.bg} label={compare ? r.label : "Descent path"} line />
          ))}
          <Swatch className="bg-emerald-500" label="Minimum" />
          <span>Lines are loss contours</span>
        </>
      }
      readout={readout}
      controls={
        <>
          <LabChoice
            label="Loss surface"
            value={id}
            options={[
              { value: "bowl", label: LANDSCAPES.bowl.label },
              { value: "rosenbrock", label: LANDSCAPES.rosenbrock.label },
            ]}
            onChange={switchLandscape}
          />
          <LabLogSlider
            label={compare ? "Learning rate (SGD, Momentum)" : "Learning rate"}
            value={lr}
            min={L.lr[0]}
            max={L.lr[1]}
            format={(v) => fmt(v, 2)}
            onChange={(v) => {
              setLr(v)
              pb.reset()
            }}
          />
          <LabSlider
            label="Momentum β"
            value={beta}
            min={0}
            max={0.98}
            step={0.02}
            format={(v) => v.toFixed(2)}
            onChange={(v) => {
              setBeta(v)
              pb.reset()
            }}
          />
          {compare && (
            <LabLogSlider
              label="Adam step size α"
              value={adamLr}
              min={L.adam[0]}
              max={L.adam[1]}
              format={(v) => fmt(v, 2)}
              onChange={(v) => {
                setAdamLr(v)
                pb.reset()
              }}
            />
          )}
          <PlayControls playing={pb.playing} done={pb.done} onToggle={pb.toggle} onStep={() => pb.step(1)} onReset={pb.reset} />
        </>
      }
    >
      <LabSvg
        width={W}
        height={H}
        label={`Contour plot of the ${L.label} loss with ${compare ? "three optimizer paths" : "the gradient descent path"}`}
        onPointer={(x, y, kind) => kind === "down" && onPointer(x, y)}
      >
        <defs>
          <clipPath id={`gd-clip-${compare ? "c" : "s"}`}>
            <rect width={W} height={H} />
          </clipPath>
        </defs>
        <g clipPath={`url(#gd-clip-${compare ? "c" : "s"})`}>
          {contours.map((d, i) => (
            <path key={i} d={d} fill="none" className="stroke-muted-foreground" strokeOpacity={0.15 + 0.45 * (1 - i / contours.length)} strokeWidth={1} />
          ))}
          <circle cx={sx(L.min[0])} cy={sy(L.min[1])} r={5} className="fill-emerald-500" />
          {runs.map((r) => {
            const pts = r.path.slice(0, Math.min(pb.t, r.path.length - 1) + 1)
            const cur = pts[pts.length - 1]
            return (
              <g key={r.id}>
                <polyline
                  points={pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")}
                  fill="none"
                  className={r.color.stroke}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                <circle cx={sx(cur[0])} cy={sy(cur[1])} r={5} className={`${r.color.fill} stroke-background`} strokeWidth={1.5} />
              </g>
            )
          })}
          <circle cx={sx(start[0])} cy={sy(start[1])} r={3} className="fill-foreground" />
        </g>
      </LabSvg>
    </LabFrame>
  )
}

export function GradientDescentLab() {
  return <GradientDescentPlayground compare={false} />
}

export function OptimizerRaceLab() {
  return <GradientDescentPlayground compare />
}
