"use client"

import { useMemo, useState } from "react"
import { DicesIcon, EraserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { LabChoice, LabFrame, LabLogSlider, LabSlider, LabSvg, Stat, Swatch } from "./kit"
import { fmt, pct, scale } from "./math"
import { gaussian, mulberry32 } from "./rng"

type Pt = { x: number; y: number; c: 0 | 1 }

const W = 480
const H = 320
const XD: [number, number] = [-3.6, 3.6]
const YD: [number, number] = [-2.4, 2.4]
const sx = scale(XD[0], XD[1], 0, W)
const sy = scale(YD[0], YD[1], H, 0)
const GX = 48
const GY = 32

function makeData(seed: number, spread: number): Pt[] {
  const r = mulberry32(seed)
  const pts: Pt[] = []
  for (let i = 0; i < 70; i++) {
    const c = (i % 2) as 0 | 1
    const cx = c ? 1 : -1
    const cy = c ? 0.5 : -0.5
    pts.push({ x: cx + gaussian(r) * spread, y: cy + gaussian(r) * spread, c })
  }
  return pts
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** Solve a 3x3 linear system by Gaussian elimination with partial pivoting. */
function solve3(A: number[][], b: number[]): number[] {
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = c + 1; r < 3; r++) {
      const f = M[r][c] / M[c][c]
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = [0, 0, 0]
  for (let r = 2; r >= 0; r--) {
    let acc = M[r][3]
    for (let k = r + 1; k < 3; k++) acc -= M[r][k] * x[k]
    x[r] = acc / M[r][r]
  }
  return x
}

/** L2-regularised logistic regression fit with Newton's method (IRLS). Returns [w1, w2, b]. */
function fit(pts: Pt[], lambda: number): number[] {
  let th = [0, 0, 0]
  const n = pts.length
  for (let it = 0; it < 30; it++) {
    const g = [lambda * th[0], lambda * th[1], 0]
    const Hm = [
      [lambda, 0, 0],
      [0, lambda, 0],
      [0, 0, 1e-6],
    ]
    for (const p of pts) {
      const f = [p.x, p.y, 1]
      const q = sigmoid(th[0] * p.x + th[1] * p.y + th[2])
      for (let i = 0; i < 3; i++) {
        g[i] += ((q - p.c) * f[i]) / n
        for (let j = 0; j < 3; j++) Hm[i][j] += (q * (1 - q) * f[i] * f[j]) / n
      }
    }
    const step = solve3(Hm, g)
    if (!step.every(Number.isFinite)) break
    th = th.map((v, i) => v - step[i])
    if (Math.hypot(...step) < 1e-8) break
  }
  return th
}

/** Endpoints of the line w1 x + w2 y + b = k inside the plot box. */
function lineAt(th: number[], k: number): [number, number, number, number] | null {
  const [a, b, c] = th
  if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return null
  if (Math.abs(b) > Math.abs(a)) {
    const y = (x: number) => (k - c - a * x) / b
    return [sx(XD[0]), sy(y(XD[0])), sx(XD[1]), sy(y(XD[1]))]
  }
  const x = (y: number) => (k - c - b * y) / a
  return [sx(x(YD[0])), sy(YD[0]), sx(x(YD[1])), sy(YD[1])]
}

export function LogisticLab() {
  const [seed, setSeed] = useState(3)
  const [spread, setSpread] = useState(0.8)
  const [lambda, setLambda] = useState(0.01)
  const [extra, setExtra] = useState<Pt[]>([])
  const [addClass, setAddClass] = useState<0 | 1>(1)

  const pts = useMemo(() => [...makeData(seed, spread), ...extra], [seed, spread, extra])
  const th = useMemo(() => fit(pts, lambda), [pts, lambda])

  const shade = useMemo(() => {
    const cells: { x: number; y: number; p: number }[] = []
    for (let j = 0; j < GY; j++)
      for (let i = 0; i < GX; i++) {
        const x = XD[0] + ((i + 0.5) / GX) * (XD[1] - XD[0])
        const y = YD[1] - ((j + 0.5) / GY) * (YD[1] - YD[0])
        cells.push({ x: (i * W) / GX, y: (j * H) / GY, p: sigmoid(th[0] * x + th[1] * y + th[2]) })
      }
    return cells
  }, [th])

  let correct = 0
  let loss = 0
  for (const p of pts) {
    const q = sigmoid(th[0] * p.x + th[1] * p.y + th[2])
    if ((q > 0.5 ? 1 : 0) === p.c) correct++
    loss -= p.c ? Math.log(Math.max(q, 1e-12)) : Math.log(Math.max(1 - q, 1e-12))
  }
  const norm = Math.hypot(th[0], th[1])
  const band = norm > 1e-9 ? (2 * Math.log(3)) / norm : Infinity // width between p=0.25 and p=0.75

  const boundary = lineAt(th, 0)
  const lo = lineAt(th, -Math.log(3))
  const hi = lineAt(th, Math.log(3))

  return (
    <LabFrame
      title="Logistic regression decision boundary"
      prompt="Slide L2 regularisation from weak to strong and watch the probability band widen. Click the plot to add points and drag the boundary around."
      legend={
        <>
          <Swatch className="bg-brand" label="Class 1" />
          <Swatch className="bg-amber-500" label="Class 0" />
          <span>Solid line p = 0.5 · dashed lines p = 0.25 / 0.75</span>
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="accuracy" value={pct(correct / pts.length)} />
            <Stat label="log-loss" value={fmt(loss / pts.length)} />
            <Stat label="‖w‖" value={fmt(norm)} />
            <Stat label="25→75% band" value={Number.isFinite(band) ? fmt(band, 2) : "∞"} />
          </span>
          The model predicts p = σ(w·x + b). {lambda > 0.5 ? "Strong L2 shrinks w, so the logit changes slowly across the plane: probabilities stay near 50% over a wide band." : lambda < 0.003 ? "Weak L2 lets w grow large, so the probability jumps from 0 to 1 over a thin band: confident, and prone to overfit outliers." : "L2 trades off fitting the points against keeping w small; the dashed band shows where the model is genuinely unsure."}
        </>
      }
      controls={
        <>
          <LabLogSlider label="L2 strength λ" value={lambda} min={0.0005} max={5} format={(v) => fmt(v, 2)} onChange={setLambda} />
          <LabSlider label="Class overlap (spread)" value={spread} min={0.3} max={1.6} step={0.05} format={(v) => v.toFixed(2)} onChange={setSpread} />
          <LabChoice
            label="Click adds a point of"
            value={addClass}
            options={[
              { value: 1, label: "Class 1" },
              { value: 0, label: "Class 0" },
            ]}
            onChange={setAddClass}
          />
          <div className="flex flex-wrap items-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)}>
              <DicesIcon /> New data
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setExtra([])} disabled={!extra.length}>
              <EraserIcon /> Clear added ({extra.length})
            </Button>
          </div>
        </>
      }
    >
      <LabSvg
        width={W}
        height={H}
        label={`Two classes of points with a logistic regression boundary; accuracy ${pct(correct / pts.length)}`}
        onPointer={(px, py, kind) => {
          if (kind !== "down") return
          const x = XD[0] + (px / W) * (XD[1] - XD[0])
          const y = YD[1] - (py / H) * (YD[1] - YD[0])
          setExtra((e) => [...e, { x, y, c: addClass }])
        }}
      >
        {shade.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={W / GX + 0.5}
            height={H / GY + 0.5}
            className={c.p > 0.5 ? "fill-brand" : "fill-amber-500"}
            fillOpacity={Math.abs(c.p - 0.5) * 0.5}
          />
        ))}
        {lo && <line x1={lo[0]} y1={lo[1]} x2={lo[2]} y2={lo[3]} className="stroke-foreground" strokeOpacity={0.5} strokeDasharray="5 4" />}
        {hi && <line x1={hi[0]} y1={hi[1]} x2={hi[2]} y2={hi[3]} className="stroke-foreground" strokeOpacity={0.5} strokeDasharray="5 4" />}
        {boundary && <line x1={boundary[0]} y1={boundary[1]} x2={boundary[2]} y2={boundary[3]} className="stroke-foreground" strokeWidth={2} />}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={i >= pts.length - extra.length ? 5.5 : 4}
            className={`${p.c ? "fill-brand" : "fill-amber-500"} stroke-background`}
            strokeWidth={1.25}
          />
        ))}
      </LabSvg>
    </LabFrame>
  )
}
