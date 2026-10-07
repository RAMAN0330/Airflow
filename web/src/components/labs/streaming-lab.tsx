"use client"

import { useMemo, useState } from "react"

import { LabFrame, LabSlider, LabSvg, PlayControls, Stat, Swatch } from "./kit"
import { scale } from "./math"
import { mulberry32 } from "./rng"
import { usePlayback } from "./use-playback"

interface Ev {
  id: number
  e: number // event time
  p: number // processing (arrival) time
}

const W = 480
const H = 340
const E_MAX = 60
const P_MAX = 80
const L = 40
const R = W - 10
const T = 14
const B = H - 30
const sx = scale(0, E_MAX, L, R)
const sy = scale(0, P_MAX, B, T)

const EVENTS: Ev[] = (() => {
  const r = mulberry32(2024)
  return Array.from({ length: 30 }, (_, id) => {
    const e = r() * 56 + 1
    const straggler = r() < 0.18
    const delay = straggler ? 6 + r() * 14 : 0.3 + -Math.log(1 - r()) * 1.4
    return { id, e, p: Math.min(e + delay, P_MAX - 1) }
  }).sort((a, b) => a.p - b.p)
})()

/** Watermark after the first k arrivals: max event time seen so far minus the allowed delay. */
function analyse(win: number, lag: number) {
  const marks: { p: number; wm: number }[] = []
  let maxE = -Infinity
  const dropped = new Set<number>()
  const fireAt = new Map<number, number>() // window start -> processing time it fired
  for (const ev of EVENTS) {
    const wmBefore = maxE - lag
    const wStart = Math.floor(ev.e / win) * win
    if (wmBefore >= wStart + win) dropped.add(ev.id)
    maxE = Math.max(maxE, ev.e)
    const wm = maxE - lag
    marks.push({ p: ev.p, wm })
    for (let s = 0; s < E_MAX; s += win) if (!fireAt.has(s) && wm >= s + win) fireAt.set(s, ev.p)
  }
  // End of stream: the source closes, the watermark jumps to +∞ and every remaining window fires.
  for (let s = 0; s < E_MAX; s += win) if (!fireAt.has(s)) fireAt.set(s, P_MAX)
  return { marks, dropped, fireAt }
}

export function StreamingWindowsLab() {
  const [win, setWin] = useState(10)
  const [lag, setLag] = useState(1)
  const pb = usePlayback({ length: P_MAX, interval: 120 })
  const now = pb.t
  const { marks, dropped, fireAt } = useMemo(() => analyse(win, lag), [win, lag])

  const arrived = EVENTS.filter((ev) => ev.p <= now)
  const wmNow = marks.filter((m) => m.p <= now).reduce((w, m) => Math.max(w, m.wm), -Infinity)
  const droppedSoFar = arrived.filter((ev) => dropped.has(ev.id)).length
  const windows = Array.from({ length: Math.ceil(E_MAX / win) }, (_, i) => i * win)
  const firedCount = windows.filter((s) => (fireAt.get(s) ?? Infinity) <= now).length

  // Watermark staircase in (event time, processing time) space.
  let d = ""
  let prev = -Infinity
  for (const m of marks) {
    if (m.p > now) break
    const x = Math.max(0, m.wm)
    if (prev === -Infinity) d += `M${sx(x)} ${sy(m.p)}`
    else d += `L${sx(Math.max(0, prev))} ${sy(m.p)}L${sx(x)} ${sy(m.p)}`
    prev = m.wm
  }
  if (prev !== -Infinity) d += `L${sx(Math.max(0, prev))} ${sy(now)}`

  return (
    <LabFrame
      title="Event time, processing time and watermarks"
      prompt="Play the stream. Late stragglers that arrive after their window already fired turn red and are dropped. Raise the watermark delay to keep them, and notice windows now fire later."
      live={!pb.playing}
      legend={
        <>
          <Swatch className="bg-brand" label="On-time event" />
          <Swatch className="bg-rose-500" label="Dropped (too late)" />
          <Swatch className="bg-amber-500" label="Watermark" line />
          <span>Dashed diagonal: zero delay (processing time = event time)</span>
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="processing time" value={`${now}s`} />
            <Stat label="watermark" value={Number.isFinite(wmNow) ? `${Math.max(0, wmNow).toFixed(1)}s` : "–"} />
            <Stat label="windows emitted" value={`${firedCount} / ${windows.length}`} />
            <Stat label="dropped" value={`${droppedSoFar} (${dropped.size} total)`} />
          </span>
          The watermark claims &ldquo;no more events older than this will arrive&rdquo;: it trails the newest event time seen by{" "}
          {lag}s. A {win}s window is emitted once the watermark passes its end, and any event for it that shows up afterwards is
          dropped. {lag < 4 ? "A short delay gives fast results but loses stragglers." : "A long delay keeps stragglers but every result waits longer."}
        </>
      }
      controls={
        <>
          <LabSlider label="Tumbling window size" value={win} min={4} max={20} step={1} format={(v) => `${v}s`} onChange={setWin} />
          <LabSlider label="Watermark delay (allowed lateness)" value={lag} min={0} max={15} step={0.5} format={(v) => `${v}s`} onChange={setLag} />
          <PlayControls playing={pb.playing} done={pb.done} onToggle={pb.toggle} onStep={() => pb.step(2)} onReset={pb.reset} stepLabel="+2s" />
        </>
      }
    >
      <LabSvg width={W} height={H} label={`Event-time versus processing-time scatter at processing time ${now}s, ${droppedSoFar} events dropped`}>
        {windows.map((s, i) => {
          const fired = (fireAt.get(s) ?? Infinity) <= now
          const count = arrived.filter((ev) => ev.e >= s && ev.e < s + win && !dropped.has(ev.id)).length
          return (
            <g key={s}>
              <rect x={sx(s)} y={T} width={sx(Math.min(s + win, E_MAX)) - sx(s)} height={B - T} className={i % 2 ? "fill-muted" : "fill-transparent"} fillOpacity={0.5} />
              {fired && <rect x={sx(s) + 1} y={T} width={sx(Math.min(s + win, E_MAX)) - sx(s) - 2} height={4} rx={2} className="fill-emerald-500" />}
              <text x={(sx(s) + sx(Math.min(s + win, E_MAX))) / 2} y={T + 16} textAnchor="middle" className={fired ? "fill-emerald-600 text-[10px] font-semibold dark:fill-emerald-400" : "fill-muted-foreground text-[10px]"}>
                {fired ? `✓ ${count}` : count}
              </text>
            </g>
          )
        })}
        <line x1={sx(0)} y1={sy(0)} x2={sx(E_MAX)} y2={sy(E_MAX)} className="stroke-muted-foreground" strokeDasharray="4 4" strokeOpacity={0.6} />
        <line x1={L} x2={R} y1={sy(now)} y2={sy(now)} className="stroke-foreground" strokeOpacity={0.5} />
        <path d={d} fill="none" className="stroke-amber-500" strokeWidth={2.5} />
        {EVENTS.map((ev) => {
          const here = ev.p <= now
          const isDropped = dropped.has(ev.id)
          return (
            <g key={ev.id}>
              {here && ev.p - ev.e > 5 && <line x1={sx(ev.e)} x2={sx(ev.e)} y1={sy(ev.e)} y2={sy(ev.p)} className={isDropped ? "stroke-rose-500" : "stroke-muted-foreground"} strokeOpacity={0.5} strokeDasharray="2 2" />}
              <circle
                cx={sx(ev.e)}
                cy={sy(ev.p)}
                r={here ? 4.5 : 3}
                className={here ? (isDropped ? "fill-rose-500" : "fill-brand") : "fill-none stroke-muted-foreground"}
                strokeOpacity={0.5}
              />
            </g>
          )
        })}
        <line x1={L} x2={R} y1={B} y2={B} className="stroke-border" />
        {[0, 10, 20, 30, 40, 50, 60].map((v) => (
          <text key={v} x={sx(v)} y={B + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {v}s
          </text>
        ))}
        <text x={(L + R) / 2} y={H - 3} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          event time (when it happened) →
        </text>
        {[0, 20, 40, 60, 80].map((v) => (
          <text key={v} x={L - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {v}s
          </text>
        ))}
        <text x={10} y={(T + B) / 2} transform={`rotate(-90 10 ${(T + B) / 2})`} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          processing time (arrival) →
        </text>
      </LabSvg>
    </LabFrame>
  )
}
