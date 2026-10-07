"use client"

import { useMemo, useState } from "react"
import { DicesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { LabFrame, LabSlider, LabSvg, LabSwitch, Stat, Swatch } from "./kit"
import { fmt, pct, scale } from "./math"
import { gaussian, mulberry32 } from "./rng"

const W = 480
const H = 320
const PW = 320 // square scatter panel; the rest holds the variance bars
const sx = scale(-4, 4, 0, PW)
const sy = scale(-4, 4, H, 0)

function pca(pts: [number, number][]) {
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p[0], 0) / n
  const my = pts.reduce((s, p) => s + p[1], 0) / n
  let a = 0, b = 0, c = 0
  for (const [x, y] of pts) {
    a += (x - mx) ** 2
    b += (x - mx) * (y - my)
    c += (y - my) ** 2
  }
  a /= n - 1
  b /= n - 1
  c /= n - 1
  const tr = (a + c) / 2
  const disc = Math.sqrt(((a - c) / 2) ** 2 + b * b)
  const l1 = tr + disc
  const l2 = Math.max(tr - disc, 0)
  const phi = 0.5 * Math.atan2(2 * b, a - c)
  return { mean: [mx, my] as [number, number], l1, l2, u1: [Math.cos(phi), Math.sin(phi)] as [number, number], u2: [-Math.sin(phi), Math.cos(phi)] as [number, number], phi, cov: [a, b, c] }
}

export function PcaLab() {
  const [seed, setSeed] = useState(5)
  const [angle, setAngle] = useState(30)
  const [stretch, setStretch] = useState(3)
  const [project, setProject] = useState(false)

  const base = useMemo(() => {
    const r = mulberry32(seed)
    return Array.from({ length: 160 }, () => [gaussian(r), gaussian(r)] as [number, number])
  }, [seed])

  const pts = useMemo(() => {
    const t = (angle * Math.PI) / 180
    const s1 = 0.9 * Math.sqrt(stretch)
    const s2 = 0.9 / Math.sqrt(stretch)
    return base.map(([u, v]) => {
      const x = u * s1
      const y = v * s2
      return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)] as [number, number]
    })
  }, [base, angle, stretch])

  const P = useMemo(() => pca(pts), [pts])
  const total = P.l1 + P.l2
  const ev1 = P.l1 / total
  const corr = P.cov[1] / Math.sqrt(P.cov[0] * P.cov[2])
  const phiDeg = (((P.phi * 180) / Math.PI) + 180) % 180

  const axis = (u: [number, number], l: number, cls: string, label: string) => {
    const L = 2 * Math.sqrt(l)
    const [mx, my] = P.mean
    return (
      <g className={cls}>
        <line x1={sx(mx - u[0] * L)} y1={sy(my - u[1] * L)} x2={sx(mx + u[0] * L)} y2={sy(my + u[1] * L)} strokeWidth={3} strokeLinecap="round" className="stroke-current" />
        <circle cx={sx(mx + u[0] * L)} cy={sy(my + u[1] * L)} r={4} className="fill-current" />
        <text x={sx(mx + u[0] * L) + 6} y={sy(my + u[1] * L) - 6} className="fill-current text-[12px] font-semibold">
          {label}
        </text>
      </g>
    )
  }

  const barH = H - 60
  return (
    <LabFrame
      title="PCA: find the directions of greatest spread"
      prompt="Rotate the cloud and watch PC1 follow it. Then squash the stretch toward 1 so the cloud turns round, and see the explained-variance bars even out."
      legend={
        <>
          <Swatch className="bg-brand" label="PC1" line />
          <Swatch className="bg-amber-500" label="PC2" line />
          <span>Axis length = 2 standard deviations along that direction</span>
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="PC1 explains" value={pct(ev1, 1)} />
            <Stat label="PC1 angle" value={`${phiDeg.toFixed(0)}°`} />
            <Stat label="correlation" value={fmt(corr, 2)} />
          </span>
          {stretch < 1.3
            ? "The cloud is nearly round, so no direction dominates: the principal axes become unstable and dropping PC2 would lose almost half the variance."
            : `Keeping only PC1 compresses each point to one number and keeps ${pct(ev1)} of the variance.`}{" "}
          {project && "The thin lines are the reconstruction errors: what you throw away by dropping PC2."}
        </>
      }
      controls={
        <>
          <LabSlider label="Rotate cloud" value={angle} min={0} max={180} format={(v) => `${v}°`} onChange={setAngle} />
          <LabSlider label="Stretch (major ÷ minor spread)" value={stretch} min={1} max={8} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={setStretch} />
          <LabSwitch label="Project onto PC1" checked={project} onChange={setProject} />
          <div>
            <Button type="button" size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)}>
              <DicesIcon /> New sample
            </Button>
          </div>
        </>
      }
    >
      <LabSvg width={W} height={H} label={`Correlated point cloud; PC1 explains ${pct(ev1)} of the variance`}>
        <line x1={sx(-4)} x2={sx(4)} y1={sy(0)} y2={sy(0)} className="stroke-border" />
        <line x1={sx(0)} x2={sx(0)} y1={sy(-4)} y2={sy(4)} className="stroke-border" />
        {pts.map(([x, y], i) => {
          const dx = x - P.mean[0]
          const dy = y - P.mean[1]
          const t = dx * P.u1[0] + dy * P.u1[1]
          const px = P.mean[0] + t * P.u1[0]
          const py = P.mean[1] + t * P.u1[1]
          return (
            <g key={i}>
              {project && <line x1={sx(x)} y1={sy(y)} x2={sx(px)} y2={sy(py)} className="stroke-muted-foreground" strokeOpacity={0.5} />}
              <circle cx={sx(x)} cy={sy(y)} r={2.75} className="fill-foreground" fillOpacity={project ? 0.25 : 0.55} />
              {project && <circle cx={sx(px)} cy={sy(py)} r={2.25} className="fill-brand" />}
            </g>
          )
        })}
        {axis(P.u2, P.l2, "text-amber-500", "PC2")}
        {axis(P.u1, P.l1, "text-brand", "PC1")}

        <g transform={`translate(${PW + 30}, 20)`}>
          <text x={55} y={0} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            Explained variance
          </text>
          {[
            { v: ev1, cls: "fill-brand", label: "PC1" },
            { v: 1 - ev1, cls: "fill-amber-500", label: "PC2" },
          ].map((b, i) => (
            <g key={b.label} transform={`translate(${12 + i * 55}, 14)`}>
              <rect width={36} height={barH} rx={4} className="fill-muted" />
              <rect y={barH * (1 - b.v)} width={36} height={barH * b.v} rx={4} className={b.cls} />
              <text x={18} y={barH + 16} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
                {b.label}
              </text>
              <text x={18} y={Math.max(barH * (1 - b.v) - 5, 10)} textAnchor="middle" className="fill-foreground text-[11px]">
                {pct(b.v)}
              </text>
            </g>
          ))}
        </g>
      </LabSvg>
    </LabFrame>
  )
}
