"use client"

import { useMemo, useState } from "react"
import { DicesIcon, TargetIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { LabChoice, LabFrame, LabSlider, LabSvg, Stat, Swatch } from "./kit"
import { clamp, fmt, scale } from "./math"
import { gaussian, mulberry32 } from "./rng"

type Pt = { v: [number, number]; c: 0 | 1 }
type Criterion = "gini" | "entropy"

const W = 480
const TOP = 230 // scatter panel height
const GAP = 26
const CURVE = 90 // gain-curve panel height
const H = TOP + GAP + CURVE + 18
const sx = scale(0, 10, 10, W - 10)
const sy = scale(0, 10, TOP - 6, 6)

function makeData(seed: number): Pt[] {
  const r = mulberry32(seed)
  return Array.from({ length: 70 }, () => {
    const x = r() * 10
    const y = r() * 10
    // Mostly separable on x around 6, with a weaker pattern on y and some label noise.
    const score = (x - 6) * 1.2 + (y - 5) * 0.35 + gaussian(r) * 1.3
    return { v: [x, y] as [number, number], c: (score > 0 ? 1 : 0) as 0 | 1 }
  })
}

function impurity(n1: number, n: number, crit: Criterion) {
  if (n === 0) return 0
  const p = n1 / n
  if (crit === "gini") return 1 - p * p - (1 - p) * (1 - p)
  const h = (q: number) => (q > 0 ? -q * Math.log2(q) : 0)
  return h(p) + h(1 - p)
}

function evaluate(pts: Pt[], f: 0 | 1, t: number, crit: Criterion) {
  let nl = 0, l1 = 0, nr = 0, r1 = 0
  for (const p of pts) {
    if (p.v[f] <= t) {
      nl++
      l1 += p.c
    } else {
      nr++
      r1 += p.c
    }
  }
  const n = nl + nr
  const parent = impurity(l1 + r1, n, crit)
  const left = impurity(l1, nl, crit)
  const right = impurity(r1, nr, crit)
  const weighted = (nl / n) * left + (nr / n) * right
  return { nl, l1, nr, r1, parent, left, right, weighted, gain: parent - weighted }
}

export function TreeSplitLab() {
  const [seed, setSeed] = useState(4)
  const [feature, setFeature] = useState<0 | 1>(0)
  const [threshold, setThreshold] = useState(3)
  const [crit, setCrit] = useState<Criterion>("gini")

  const pts = useMemo(() => makeData(seed), [seed])
  const curve = useMemo(() => {
    const ts = Array.from({ length: 101 }, (_, i) => i / 10)
    return ts.map((t) => ({ t, gain: evaluate(pts, feature, t, crit).gain }))
  }, [pts, feature, crit])
  const best = curve.reduce((b, c) => (c.gain > b.gain ? c : b), curve[0])
  const maxGain = Math.max(best.gain, 0.05)
  const e = evaluate(pts, feature, threshold, crit)
  const cy = scale(0, maxGain, TOP + GAP + CURVE, TOP + GAP)

  const fname = feature === 0 ? "x₁" : "x₂"
  const critName = crit === "gini" ? "Gini" : "Entropy"

  return (
    <LabFrame
      title="Decision tree split explorer"
      prompt="Drag across the plot (or use the slider) to move the split. Find the threshold with the highest information gain, then compare splitting on x₁ versus x₂."
      legend={
        <>
          <Swatch className="bg-brand" label="Class 1" />
          <Swatch className="bg-amber-500" label="Class 0" />
          <span>Bottom: information gain for every threshold on {fname}</span>
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label={`left ≤ ${threshold.toFixed(1)}`} value={`${e.nl} pts · ${critName} ${fmt(e.left, 2)}`} />
            <Stat label="right" value={`${e.nr} pts · ${critName} ${fmt(e.right, 2)}`} />
            <Stat label="gain" value={fmt(e.gain, 3)} />
          </span>
          Parent {critName} {fmt(e.parent, 3)} − weighted children {fmt(e.weighted, 3)} = gain <strong>{fmt(e.gain, 3)}</strong>.{" "}
          {Math.abs(threshold - best.t) < 0.05
            ? "This is the best split on this feature: it is exactly what a greedy tree would pick here."
            : `The best split on ${fname} is at ${best.t.toFixed(1)} (gain ${fmt(best.gain, 3)}). A tree tries every feature and threshold and keeps the biggest gain.`}
        </>
      }
      controls={
        <>
          <LabChoice
            label="Split on feature"
            value={feature}
            options={[
              { value: 0, label: "x₁ (horizontal)" },
              { value: 1, label: "x₂ (vertical)" },
            ]}
            onChange={setFeature}
          />
          <LabChoice
            label="Impurity"
            value={crit}
            options={[
              { value: "gini", label: "Gini" },
              { value: "entropy", label: "Entropy" },
            ]}
            onChange={setCrit}
          />
          <LabSlider label={`Threshold on ${fname}`} value={threshold} min={0} max={10} step={0.1} format={(v) => v.toFixed(1)} onChange={setThreshold} />
          <div className="flex flex-wrap items-end gap-1.5">
            <Button type="button" size="sm" variant="outline" onClick={() => setThreshold(best.t)}>
              <TargetIcon /> Snap to best
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)}>
              <DicesIcon /> New data
            </Button>
          </div>
        </>
      }
    >
      <LabSvg
        width={W}
        height={H}
        label={`Split on ${fname} at ${threshold.toFixed(1)}: information gain ${fmt(e.gain, 3)}`}
        onPointer={(px, py) => {
          const t = feature === 0 || py > TOP ? (px - 10) / ((W - 20) / 10) : (TOP - 6 - py) / ((TOP - 12) / 10)
          setThreshold(Math.round(clamp(t, 0, 10) * 10) / 10)
        }}
      >
        {feature === 0 ? (
          <>
            <rect x={sx(0)} y={0} width={sx(threshold) - sx(0)} height={TOP} className="fill-muted" fillOpacity={0.6} />
            <line x1={sx(threshold)} x2={sx(threshold)} y1={0} y2={TOP} className="stroke-foreground" strokeWidth={2} />
          </>
        ) : (
          <>
            <rect x={0} y={sy(threshold)} width={W} height={TOP - sy(threshold)} className="fill-muted" fillOpacity={0.6} />
            <line x1={0} x2={W} y1={sy(threshold)} y2={sy(threshold)} className="stroke-foreground" strokeWidth={2} />
          </>
        )}
        <rect x={0.5} y={0.5} width={W - 1} height={TOP - 1} fill="none" className="stroke-border" />
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p.v[0])} cy={sy(p.v[1])} r={4.5} className={`${p.c ? "fill-brand" : "fill-amber-500"} stroke-background`} />
        ))}

        <text x={10} y={TOP + GAP - 8} className="fill-muted-foreground text-[11px]">
          Information gain vs threshold on {fname}
        </text>
        <line x1={sx(0)} x2={sx(10)} y1={cy(0)} y2={cy(0)} className="stroke-border" />
        <path
          d={`M${sx(0)} ${cy(0)} ${curve.map((c) => `L${sx(c.t).toFixed(1)} ${cy(c.gain).toFixed(1)}`).join(" ")} L${sx(10)} ${cy(0)}Z`}
          className="fill-brand"
          fillOpacity={0.15}
        />
        <polyline points={curve.map((c) => `${sx(c.t).toFixed(1)},${cy(c.gain).toFixed(1)}`).join(" ")} fill="none" className="stroke-brand" strokeWidth={2} />
        <circle cx={sx(best.t)} cy={cy(best.gain)} r={4} className="fill-emerald-500" />
        <line x1={sx(threshold)} x2={sx(threshold)} y1={TOP + GAP} y2={cy(0)} className="stroke-foreground" strokeDasharray="3 3" />
        <circle cx={sx(threshold)} cy={cy(e.gain)} r={4.5} className="fill-foreground" />
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <text key={v} x={sx(v)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {v}
          </text>
        ))}
      </LabSvg>
    </LabFrame>
  )
}
