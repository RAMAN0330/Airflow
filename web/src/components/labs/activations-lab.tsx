"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"

import { LabFrame, LabSlider, LabSvg, LabSwitch, SERIES, Stat, Swatch } from "./kit"
import { fmt, scale } from "./math"

type Act = "sigmoid" | "tanh" | "relu" | "leaky" | "gelu"

const sig = (x: number) => 1 / (1 + Math.exp(-x))
const ACTS: { id: Act; label: string; f: (x: number) => number; color: (typeof SERIES)[number] }[] = [
  { id: "sigmoid", label: "Sigmoid", f: sig, color: SERIES[0] },
  { id: "tanh", label: "Tanh", f: Math.tanh, color: SERIES[1] },
  { id: "relu", label: "ReLU", f: (x) => Math.max(0, x), color: SERIES[2] },
  { id: "leaky", label: "Leaky ReLU", f: (x) => (x > 0 ? x : 0.1 * x), color: SERIES[3] },
  {
    id: "gelu",
    label: "GELU",
    f: (x) => 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3))),
    color: SERIES[4],
  },
]

/** Central-difference derivative; exact enough for plotting and readouts. */
const deriv = (f: (x: number) => number, x: number) => {
  const h = 1e-4
  return (f(x + h) - f(x - h)) / (2 * h)
}

const W = 480
const H = 300
const X0 = -5
const X1 = 5
const Y0 = -1.5
const Y1 = 3
const sx = scale(X0, X1, 28, W - 8)
const sy = scale(Y0, Y1, H - 20, 8)

export function ActivationsLab() {
  const [on, setOn] = useState<Record<Act, boolean>>({ sigmoid: true, tanh: true, relu: true, leaky: false, gelu: false })
  const [showDeriv, setShowDeriv] = useState(true)
  const [probe, setProbe] = useState(2.5)
  const [depth, setDepth] = useState(10)

  const visible = ACTS.filter((a) => on[a.id])

  const curves = useMemo(
    () =>
      ACTS.map((a) => {
        const xs = Array.from({ length: 201 }, (_, i) => X0 + (i / 200) * (X1 - X0))
        const line = (g: (x: number) => number) =>
          xs.map((x) => `${sx(x).toFixed(1)},${sy(Math.max(Y0 - 1, Math.min(Y1 + 1, g(x)))).toFixed(1)}`).join(" ")
        return { id: a.id, f: line(a.f), d: line((x) => deriv(a.f, x)) }
      }),
    []
  )

  const rows = visible.map((a) => {
    const d = deriv(a.f, probe)
    return { ...a, y: a.f(probe), d, chain: Math.abs(d) ** depth }
  })
  const worst = rows.reduce<(typeof rows)[number] | null>((m, r) => (!m || r.chain < m.chain ? r : m), null)

  return (
    <LabFrame
      title="Activation functions and their gradients"
      prompt="Drag the probe to x = 4 and compare the dashed derivative curves. Then raise the depth to see how gradients survive (or vanish) through many layers."
      legend={
        <>
          {visible.map((a) => (
            <Swatch key={a.id} className={a.color.bg} label={a.label} line />
          ))}
          {showDeriv && <span>Dashed = derivative f′(x)</span>}
        </>
      }
      readout={
        rows.length === 0 ? (
          "Turn on at least one activation to compare."
        ) : (
          <>
            <span className="mb-1.5 flex flex-wrap gap-1.5">
              {rows.map((r) => (
                <Stat key={r.id} label={`${r.label} f′(${fmt(probe, 2)})`} value={fmt(r.d)} />
              ))}
            </span>
            Backprop multiplies one f′ per layer. At x = {fmt(probe, 2)} through {depth} layers,{" "}
            {worst && (
              <>
                {worst.label} keeps only <strong>{fmt(worst.chain)}</strong> of the gradient
                {worst.chain < 1e-3 ? ": it has effectively vanished." : "."}
              </>
            )}{" "}
            {probe < 0 && on.relu ? "ReLU's derivative is 0 here, so that unit passes no gradient at all (a \"dead\" unit)." : ""}
          </>
        )
      }
      controls={
        <>
          <div className="space-y-1.5 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground" id="act-toggle-label">
              Activations
            </p>
            <div role="group" aria-labelledby="act-toggle-label" className="flex flex-wrap gap-1">
              {ACTS.map((a) => (
                <Button
                  key={a.id}
                  type="button"
                  size="sm"
                  variant={on[a.id] ? "default" : "outline"}
                  aria-pressed={on[a.id]}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setOn((s) => ({ ...s, [a.id]: !s[a.id] }))}
                >
                  <span aria-hidden className={`size-2 rounded-full ${a.color.bg}`} /> {a.label}
                </Button>
              ))}
            </div>
          </div>
          <LabSlider label="Probe x" value={probe} min={-5} max={5} step={0.1} format={(v) => v.toFixed(1)} onChange={setProbe} />
          <LabSlider label="Network depth (layers)" value={depth} min={1} max={30} onChange={setDepth} />
          <LabSwitch label="Show derivatives" checked={showDeriv} onChange={setShowDeriv} />
        </>
      }
    >
      <LabSvg
        width={W}
        height={H}
        label="Plot of the selected activation functions and their derivatives"
        onPointer={(x) => setProbe(Math.round(Math.max(X0, Math.min(X1, X0 + ((x - 28) / (W - 36)) * (X1 - X0))) * 10) / 10)}
      >
        {[-1, 0, 1, 2, 3].map((v) => (
          <g key={v}>
            <line x1={28} x2={W - 8} y1={sy(v)} y2={sy(v)} className="stroke-border" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={22} y={sy(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {v}
            </text>
          </g>
        ))}
        {[-4, -2, 0, 2, 4].map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={8} y2={H - 20} className="stroke-border" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={sx(v)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {v}
            </text>
          </g>
        ))}
        <defs>
          <clipPath id="act-clip">
            <rect x={28} y={8} width={W - 36} height={H - 28} />
          </clipPath>
        </defs>
        <g clipPath="url(#act-clip)">
          {visible.map((a) => {
            const c = curves.find((k) => k.id === a.id)!
            return (
              <g key={a.id} className={a.color.stroke} fill="none">
                <polyline points={c.f} strokeWidth={2.25} />
                {showDeriv && <polyline points={c.d} strokeWidth={1.5} strokeDasharray="5 4" />}
              </g>
            )
          })}
        </g>
        <line x1={sx(probe)} x2={sx(probe)} y1={8} y2={H - 20} className="stroke-foreground" strokeOpacity={0.5} strokeDasharray="2 3" />
        {rows.map((r) => (
          <g key={r.id}>
            <circle cx={sx(probe)} cy={sy(r.y)} r={4} className={`${r.color.fill} stroke-background`} strokeWidth={1.5} />
            {showDeriv && <circle cx={sx(probe)} cy={sy(r.d)} r={3} className={`fill-background ${r.color.stroke}`} strokeWidth={1.5} />}
          </g>
        ))}
      </LabSvg>
    </LabFrame>
  )
}
