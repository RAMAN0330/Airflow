"use client"

import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { LabFrame, LabLogSlider, LabSlider, LabSvg, Stat, Swatch } from "./kit"
import { fmt, int, quantileSorted, scale } from "./math"
import { gaussian, mulberry32 } from "./rng"

const W = 480
const H = 300
const HIST_H = 210
const X0 = -5
const X1 = 5
const NB = 40
const sx = scale(X0, X1, 8, W - 8)
const REF_N = 3000

const REF = (() => {
  const r = mulberry32(42)
  return Float64Array.from({ length: REF_N }, () => gaussian(r)).sort()
})()
const CUR_Z = (() => {
  const r = mulberry32(7)
  return Float64Array.from({ length: 20000 }, () => gaussian(r))
})()

/** Kolmogorov-Smirnov two-sample statistic over sorted arrays. */
function ksStat(a: Float64Array, b: Float64Array) {
  let i = 0, j = 0, d = 0
  while (i < a.length && j < b.length) {
    const v = Math.min(a[i], b[j])
    while (i < a.length && a[i] <= v) i++
    while (j < b.length && b[j] <= v) j++
    d = Math.max(d, Math.abs(i / a.length - j / b.length))
  }
  return d
}

function ksPValue(d: number, n: number, m: number) {
  const en = Math.sqrt((n * m) / (n + m))
  const lam = (en + 0.12 + 0.11 / en) * d
  let p = 0
  for (let k = 1; k <= 100; k++) p += 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * lam * lam)
  return Math.min(1, Math.max(0, p))
}

const EDGES = Array.from({ length: 9 }, (_, i) => quantileSorted(REF, (i + 1) / 10))
const binOf = (v: number) => {
  let k = 0
  while (k < EDGES.length && v > EDGES[k]) k++
  return k
}

function histogram(xs: ArrayLike<number>) {
  const h = new Array(NB).fill(0)
  for (let i = 0; i < xs.length; i++) {
    const k = Math.floor(((xs[i] - X0) / (X1 - X0)) * NB)
    if (k >= 0 && k < NB) h[k]++
  }
  return h.map((c) => c / xs.length)
}
const REF_HIST = histogram(REF)

const LEVELS = [
  { max: 0.1, label: "No drift", cls: "border-success/40 bg-success/15 text-success" },
  { max: 0.25, label: "Moderate drift", cls: "border-warning/40 bg-warning/15 text-warning" },
  { max: Infinity, label: "Major drift", cls: "border-destructive/40 bg-destructive/15 text-destructive" },
]

export function DriftLab() {
  const [shift, setShift] = useState(0.3)
  const [spread, setSpread] = useState(1)
  const [n, setN] = useState(1000)

  const s = useMemo(() => {
    const cur = Float64Array.from(CUR_Z.subarray(0, Math.round(n)), (z) => shift + spread * z).sort()
    const counts = new Array(10).fill(0)
    for (const v of cur) counts[binOf(v)]++
    const eps = 1e-4
    const contrib = counts.map((c) => {
      const q = Math.max(c / cur.length, eps)
      const p = 0.1
      return (q - p) * Math.log(q / p)
    })
    const psi = contrib.reduce((a, b) => a + b, 0)
    const d = ksStat(REF, cur)
    return { hist: histogram(cur), contrib, psi, d, p: ksPValue(d, REF.length, cur.length) }
  }, [shift, spread, n])

  const level = LEVELS.find((l) => s.psi < l.max)!
  const maxH = Math.max(...REF_HIST, ...s.hist) * 1.1
  const hy = scale(0, maxH, HIST_H, 10)
  const bw = (W - 16) / NB
  const maxC = Math.max(0.05, ...s.contrib)
  const significant = s.p < 0.05

  return (
    <LabFrame
      title="Drift monitor: PSI and the KS test"
      prompt="Nudge the mean shift and watch PSI cross 0.1 and 0.25. Then shrink the shift to almost nothing and raise the sample size: KS calls it significant long before PSI cares."
      legend={
        <>
          <Swatch className="bg-muted-foreground/40" label={`Reference (n = ${int(REF_N)})`} />
          <Swatch className="bg-amber-500" label="Current" line />
          <span>Dotted lines: reference deciles (PSI bins) · bottom strip: PSI contribution per bin</span>
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-xs", level.cls)}>
              {level.label}
            </Badge>
            <Stat label="PSI" value={fmt(s.psi, 3)} />
            <Stat label="KS D" value={fmt(s.d, 3)} />
            <Stat label="KS p" value={fmt(s.p, 2)} />
          </span>
          PSI compares the share of current data in each reference decile (rule of thumb: &lt; 0.1 stable, 0.1–0.25 watch,
          &gt; 0.25 act). KS {significant ? "rejects" : "does not reject"} “same distribution” at α = 0.05.{" "}
          {significant && s.psi < 0.1
            ? "This is a statistically significant but practically small change: with enough data, KS flags almost any difference."
            : !significant && s.psi >= 0.1
              ? "PSI already warns while KS is unsure: small samples make the test underpowered."
              : ""}
        </>
      }
      controls={
        <>
          <LabSlider label="Mean shift (σ units)" value={shift} min={-2} max={2} step={0.05} format={(v) => v.toFixed(2)} onChange={setShift} />
          <LabSlider label="Scale (spread ×)" value={spread} min={0.4} max={2.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={setSpread} />
          <LabLogSlider label="Current sample size" value={n} min={50} max={20000} format={(v) => int(v)} onChange={setN} />
        </>
      }
    >
      <LabSvg width={W} height={H} label={`Reference versus current histograms; PSI ${fmt(s.psi, 3)}, ${level.label}`}>
        {EDGES.map((e, i) => (
          <line key={i} x1={sx(e)} x2={sx(e)} y1={10} y2={H - 6} className="stroke-muted-foreground" strokeOpacity={0.4} strokeDasharray="1 3" />
        ))}
        {REF_HIST.map((v, i) => (
          <rect key={i} x={8 + i * bw + 0.5} y={hy(v)} width={bw - 1} height={HIST_H - hy(v)} className="fill-muted-foreground" fillOpacity={0.3} />
        ))}
        <path
          d={`M${sx(X0)} ${HIST_H} ${s.hist.map((v, i) => `L${8 + i * bw} ${hy(v)} L${8 + (i + 1) * bw} ${hy(v)}`).join(" ")} L${sx(X1)} ${HIST_H}`}
          className="fill-amber-500 stroke-amber-500"
          fillOpacity={0.12}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <line x1={8} x2={W - 8} y1={HIST_H} y2={HIST_H} className="stroke-border" />
        {s.contrib.map((c, k) => {
          const a = k === 0 ? X0 : EDGES[k - 1]
          const b = k === 9 ? X1 : EDGES[k]
          const h = (Math.max(c, 0) / maxC) * 50
          return (
            <rect
              key={k}
              x={sx(Math.max(a, X0)) + 1}
              y={H - 8 - h}
              width={Math.max(sx(Math.min(b, X1)) - sx(Math.max(a, X0)) - 2, 1)}
              height={Math.max(h, 1)}
              rx={2}
              className={c > 0.025 ? "fill-destructive" : "fill-brand"}
              fillOpacity={0.7}
            />
          )
        })}
      </LabSvg>
    </LabFrame>
  )
}
