"use client"

import { useMemo, useState } from "react"
import { DicesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { LabChoice, LabFrame, LabSlider, LabSvg, PlayControls, Stat, Swatch } from "./kit"
import { fmt, int, quantileSorted, scale } from "./math"
import { gaussian, mulberry32, randInt } from "./rng"
import { usePlayback } from "./use-playback"

type Statistic = "mean" | "median"

const W = 480
const H = 320
const STRIP = 64
const MAX_B = 2000
const SIGMA = 0.75 // log-normal population: skewed, mean exp(σ²/2), median 1
const TRUTH: Record<Statistic, number> = { mean: Math.exp((SIGMA * SIGMA) / 2), median: 1 }

const stat = (xs: number[], s: Statistic) => {
  if (s === "mean") return xs.reduce((a, b) => a + b, 0) / xs.length
  const sorted = [...xs].sort((a, b) => a - b)
  return quantileSorted(sorted, 0.5)
}

export function BootstrapLab() {
  const [n, setN] = useState(30)
  const [seed, setSeed] = useState(1)
  const [which, setWhich] = useState<Statistic>("mean")

  const sample = useMemo(() => {
    const r = mulberry32(seed * 977)
    return Array.from({ length: n }, () => Math.exp(SIGMA * gaussian(r)))
  }, [n, seed])

  const boots = useMemo(() => {
    const r = mulberry32(seed * 31 + n)
    return Array.from({ length: MAX_B }, () => stat(Array.from({ length: n }, () => sample[randInt(r, n)]), which))
  }, [sample, n, seed, which])

  const pb = usePlayback({ length: MAX_B, interval: 50, stride: 20 })
  const shown = boots.slice(0, pb.t)
  const sorted = [...shown].sort((a, b) => a - b)
  const ci = shown.length >= 40 ? [quantileSorted(sorted, 0.025), quantileSorted(sorted, 0.975)] : null
  const point = stat(sample, which)
  const truth = TRUTH[which]
  const covers = ci ? ci[0] <= truth && truth <= ci[1] : null

  // Fixed x-range per sample so the histogram doesn't jump while it fills.
  const range = useMemo(() => {
    const s = [...boots].sort((a, b) => a - b)
    const lo = Math.min(quantileSorted(s, 0.001), truth)
    const hi = Math.max(quantileSorted(s, 0.999), truth)
    const pad = (hi - lo) * 0.1
    return [lo - pad, hi + pad] as const
  }, [boots, truth])
  const bx = scale(range[0], range[1], 10, W - 10)
  const NB = 36
  const counts = new Array(NB).fill(0)
  for (const v of shown) {
    const k = Math.floor(((v - range[0]) / (range[1] - range[0])) * NB)
    if (k >= 0 && k < NB) counts[k]++
  }
  const maxCount = Math.max(8, ...counts)
  const by = scale(0, maxCount, H - 18, STRIP + 30)
  const bw = (W - 20) / NB
  const rx = scale(0, 6, 10, W - 10)

  const restart = (fn: () => void) => {
    fn()
    pb.reset()
  }

  return (
    <LabFrame
      title="Bootstrap: a sampling distribution from one sample"
      prompt="Press play to resample your data with replacement thousands of times. Then quadruple the sample size and watch the confidence interval roughly halve."
      live={!pb.playing}
      legend={
        <>
          <Swatch className="bg-brand" label={`Bootstrap ${which}s`} />
          <Swatch className="bg-amber-500" label="95% percentile CI" line />
          <Swatch className="bg-emerald-500" label={`True population ${which}`} line />
          <Swatch className="bg-foreground" label="Your sample's value" line />
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="resamples" value={int(pb.t)} />
            <Stat label={`sample ${which}`} value={fmt(point)} />
            <Stat label="95% CI" value={ci ? `[${fmt(ci[0])}, ${fmt(ci[1])}]` : "–"} />
          </span>
          {ci ? (
            <>
              Each resample draws {n} values from your own sample, with replacement, and recomputes the {which}. The spread of
              those values estimates how much the {which} would vary across real repeated samples. This interval{" "}
              <strong>{covers ? "contains" : "misses"}</strong> the true {which} ({fmt(truth)}); over many fresh samples, about
              95% of such intervals should contain it.
            </>
          ) : (
            "Press play (or step) to start resampling. The interval appears after 40 resamples."
          )}
        </>
      }
      controls={
        <>
          <LabSlider label="Sample size n" value={n} min={5} max={200} onChange={(v) => restart(() => setN(v))} />
          <LabChoice
            label="Statistic"
            value={which}
            options={[
              { value: "mean", label: "Mean" },
              { value: "median", label: "Median" },
            ]}
            onChange={(v) => restart(() => setWhich(v))}
          />
          <PlayControls playing={pb.playing} done={pb.done} onToggle={pb.toggle} onStep={() => pb.step(100)} onReset={pb.reset} stepLabel="+100">
            <Button type="button" size="sm" variant="outline" onClick={() => restart(() => setSeed((s) => s + 1))}>
              <DicesIcon /> Draw a new sample
            </Button>
          </PlayControls>
        </>
      }
    >
      <LabSvg width={W} height={H} label={`Bootstrap distribution of the ${which} from ${pb.t} resamples`}>
        <text x={10} y={12} className="fill-muted-foreground text-[11px]">
          Your sample (n = {n}) from a skewed population
        </text>
        <line x1={10} x2={W - 10} y1={STRIP} y2={STRIP} className="stroke-border" />
        {sample.map((v, i) => (
          <circle key={i} cx={rx(Math.min(v, 6))} cy={STRIP - 8 - ((i * 7) % 30)} r={3} className="fill-foreground" fillOpacity={0.45} />
        ))}
        <line x1={rx(point)} x2={rx(point)} y1={18} y2={STRIP} className="stroke-foreground" strokeWidth={2} />
        {[0, 1, 2, 3, 4, 5, 6].map((v) => (
          <text key={v} x={rx(v)} y={STRIP + 12} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {v}
          </text>
        ))}

        {counts.map((c, i) => (
          <rect key={i} x={10 + i * bw + 0.5} y={by(c)} width={bw - 1} height={H - 18 - by(c)} className="fill-brand" fillOpacity={0.75} />
        ))}
        <line x1={10} x2={W - 10} y1={H - 18} y2={H - 18} className="stroke-border" />
        {ci && (
          <g className="stroke-amber-500" strokeWidth={2}>
            <rect x={bx(ci[0])} y={STRIP + 30} width={bx(ci[1]) - bx(ci[0])} height={H - 48 - STRIP} className="fill-amber-500" fillOpacity={0.08} stroke="none" />
            <line x1={bx(ci[0])} x2={bx(ci[0])} y1={STRIP + 30} y2={H - 18} />
            <line x1={bx(ci[1])} x2={bx(ci[1])} y1={STRIP + 30} y2={H - 18} />
          </g>
        )}
        <line x1={bx(truth)} x2={bx(truth)} y1={STRIP + 24} y2={H - 18} className="stroke-emerald-500" strokeWidth={2} strokeDasharray="5 3" />
        <line x1={bx(point)} x2={bx(point)} y1={STRIP + 24} y2={H - 18} className="stroke-foreground" strokeWidth={1.5} />
        {[range[0], (range[0] + range[1]) / 2, range[1]].map((v, i) => (
          <text key={i} x={bx(v)} y={H - 4} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} className="fill-muted-foreground text-[10px]">
            {fmt(v, 2)}
          </text>
        ))}
      </LabSvg>
    </LabFrame>
  )
}
