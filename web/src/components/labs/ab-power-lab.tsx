"use client"

import { useState } from "react"

import { LabChoice, LabFrame, LabLogSlider, LabSlider, LabSvg, Stat, Swatch } from "./kit"
import { int, normCdf, normPdf, pct, scale } from "./math"

const W = 480
const H = 260
const BASE = H - 24
const Z_BETA_80 = 0.8416
const Z_ALPHA: Record<string, number> = { "0.05": 1.96, "0.01": 2.5758 }

export function AbPowerLab() {
  const [p0, setP0] = useState(0.05)
  const [mde, setMde] = useState(0.1)
  const [n, setN] = useState(10000)
  const [alpha, setAlpha] = useState<"0.05" | "0.01">("0.05")

  const za = Z_ALPHA[alpha]
  const delta = p0 * mde
  const p1 = Math.min(p0 + delta, 0.999)
  const pbar = (p0 + p1) / 2
  const se0 = Math.sqrt((2 * pbar * (1 - pbar)) / n)
  const se1 = Math.sqrt((p0 * (1 - p0) + p1 * (1 - p1)) / n)
  const crit = za * se0
  const power = 1 - normCdf((crit - delta) / se1) + normCdf((-crit - delta) / se1)
  const needed = ((za * Math.sqrt(2 * pbar * (1 - pbar)) + Z_BETA_80 * Math.sqrt(p0 * (1 - p0) + p1 * (1 - p1))) / delta) ** 2

  const lo = Math.min(-4 * se0, delta - 4 * se1)
  const hi = Math.max(4 * se0, delta + 4 * se1)
  const x = scale(lo, hi, 10, W - 10)
  const peak = Math.max(normPdf(0) / se0, normPdf(0) / se1)
  const y = scale(0, peak * 1.08, BASE, 12)
  const xs = Array.from({ length: 241 }, (_, i) => lo + (i / 240) * (hi - lo))
  const pdf0 = (v: number) => normPdf(v / se0) / se0
  const pdf1 = (v: number) => normPdf((v - delta) / se1) / se1
  const curve = (f: (v: number) => number, pts = xs) => pts.map((v) => `${x(v).toFixed(1)},${y(f(v)).toFixed(1)}`).join(" ")
  const area = (f: (v: number) => number, a: number, b: number) => {
    if (b <= a) return ""
    const pts = xs.filter((v) => v >= a && v <= b)
    return `M${x(a)} ${BASE} L${curve(f, [a, ...pts, b]).replaceAll(" ", " L")} L${x(b)} ${BASE}Z`
  }
  const pp = (v: number) => `${(v * 100).toFixed(v * 100 < 1 ? 2 : 1)} pp`

  return (
    <LabFrame
      title="A/B test power"
      prompt="Shrink the minimum detectable effect and watch the two curves overlap until power collapses. Then raise the sample size until power passes 80%."
      legend={
        <>
          <Swatch className="bg-muted-foreground" label="No real effect (H₀)" line />
          <Swatch className="bg-brand" label={`True lift of ${pct(mde)} (H₁)`} line />
          <Swatch className="bg-brand/30" label="Power" />
          <Swatch className="bg-destructive/40" label="False-positive rate α" />
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="power" value={pct(power)} className={power >= 0.8 ? "border-success/50" : "border-destructive/40"} />
            <Stat label="lift" value={`${pct(p0, 1)} → ${pct(p1, 2)}`} />
            <Stat label="n for 80% power" value={`${int(needed)} / arm`} />
          </span>
          The curves show where the observed difference in conversion lands across many repeats of this experiment. Anything
          beyond ±{pp(crit)} counts as significant. If the true lift is {pp(delta)}, you detect it <strong>{pct(power)}</strong> of
          the time
          {power < 0.8 ? `; to reach 80% you need about ${int(needed)} users per arm.` : ", which meets the usual 80% bar."}
        </>
      }
      controls={
        <>
          <LabSlider label="Baseline conversion" value={Math.round(p0 * 1000)} min={5} max={500} step={5} format={(v) => pct(v / 1000, 1)} onChange={(v) => setP0(v / 1000)} />
          <LabSlider label="Minimum detectable effect (relative)" value={Math.round(mde * 100)} min={1} max={50} format={(v) => `${v}%`} onChange={(v) => setMde(v / 100)} />
          <LabLogSlider label="Sample size per arm" value={n} min={100} max={1_000_000} format={(v) => int(v)} onChange={setN} />
          <LabChoice
            label="Significance level α (two-sided)"
            value={alpha}
            options={[
              { value: "0.05", label: "0.05" },
              { value: "0.01", label: "0.01" },
            ]}
            onChange={setAlpha}
          />
        </>
      }
    >
      <LabSvg width={W} height={H} label={`Null and alternative sampling distributions; power ${pct(power)}`}>
        <path d={area(pdf1, crit, hi)} className="fill-brand" fillOpacity={0.25} />
        <path d={area(pdf1, lo, -crit)} className="fill-brand" fillOpacity={0.25} />
        <path d={area(pdf0, crit, hi)} className="fill-destructive" fillOpacity={0.35} />
        <path d={area(pdf0, lo, -crit)} className="fill-destructive" fillOpacity={0.35} />
        <polyline points={curve(pdf0)} fill="none" className="stroke-muted-foreground" strokeWidth={2} />
        <polyline points={curve(pdf1)} fill="none" className="stroke-brand" strokeWidth={2.5} />
        {[crit, -crit].map((c, i) =>
          c > lo && c < hi ? <line key={i} x1={x(c)} x2={x(c)} y1={12} y2={BASE} className="stroke-foreground" strokeDasharray="4 3" /> : null
        )}
        <line x1={10} x2={W - 10} y1={BASE} y2={BASE} className="stroke-border" />
        <text x={x(0)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          0
        </text>
        <text x={x(delta)} y={H - 6} textAnchor="middle" className="fill-brand text-[10px] font-medium">
          +{pp(delta)}
        </text>
        {crit < hi && (
          <text x={x(crit) + 4} y={22} className="fill-foreground text-[10px]">
            significance threshold
          </text>
        )}
      </LabSvg>
    </LabFrame>
  )
}
