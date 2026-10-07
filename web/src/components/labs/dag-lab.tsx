"use client"

import { useMemo, useState, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

import { LabChoice, LabFrame, LabSlider, LabSvg, PlayControls, Stat } from "./kit"
import { usePlayback } from "./use-playback"

type State = "none" | "queued" | "running" | "success" | "failed" | "upstream_failed"
interface Task {
  id: string
  dur: number
  deps: string[]
  col: number
  row: number
}

const TASKS: Task[] = [
  { id: "extract_orders", dur: 2, deps: [], col: 0, row: 0 },
  { id: "extract_users", dur: 1, deps: [], col: 0, row: 1 },
  { id: "extract_events", dur: 3, deps: [], col: 0, row: 2 },
  { id: "clean_orders", dur: 2, deps: ["extract_orders"], col: 1, row: 0 },
  { id: "clean_events", dur: 2, deps: ["extract_events"], col: 1, row: 2 },
  { id: "join", dur: 2, deps: ["clean_orders", "extract_users"], col: 2, row: 0.5 },
  { id: "quality_check", dur: 1, deps: ["clean_events"], col: 2, row: 2 },
  { id: "train", dur: 3, deps: ["join", "quality_check"], col: 3, row: 0.5 },
  { id: "events_report", dur: 1, deps: ["quality_check"], col: 3, row: 2 },
]
const BY_ID = Object.fromEntries(TASKS.map((t) => [t.id, t]))

interface Run {
  start?: number
  end?: number
  slot?: number
  final: "success" | "failed" | "upstream_failed"
  decidedAt: number
}

/** Discrete-time scheduler: start ready tasks (in DAG order) whenever a slot is free. */
function simulate(slots: number, failId: string | null) {
  const runs: Record<string, Run> = {}
  const free = Array.from({ length: slots }, () => 0) // time each slot frees up
  let time = 0
  const done = (id: string) => runs[id] && runs[id].decidedAt <= time && runs[id].final !== undefined
  for (let guard = 0; guard < 100 && Object.keys(runs).length < TASKS.length; guard++) {
    // Propagate upstream failures that are known by now.
    let changed = true
    while (changed) {
      changed = false
      for (const t of TASKS) {
        if (runs[t.id]) continue
        if (t.deps.some((d) => done(d) && runs[d].final !== "success")) {
          runs[t.id] = { final: "upstream_failed", decidedAt: time }
          changed = true
        }
      }
    }
    for (const t of TASKS) {
      if (runs[t.id]) continue
      if (!t.deps.every((d) => done(d) && runs[d].final === "success")) continue
      const slot = free.findIndex((f) => f <= time)
      if (slot === -1) continue
      free[slot] = time + t.dur
      runs[t.id] = { start: time, end: time + t.dur, slot, final: t.id === failId ? "failed" : "success", decidedAt: time + t.dur }
    }
    const next = Math.min(...Object.values(runs).filter((r) => r.end !== undefined && r.end > time).map((r) => r.end!), Infinity)
    time = Number.isFinite(next) ? next : time + 1
  }
  const makespan = Math.max(0, ...Object.values(runs).map((r) => r.decidedAt))
  return { runs, makespan }
}

function stateAt(t: Task, run: Run | undefined, time: number, runs: Record<string, Run>): State {
  if (!run) return "none"
  if (run.start === undefined) return run.decidedAt <= time ? "upstream_failed" : "none"
  if (run.end! <= time) return run.final
  if (run.start <= time) return "running"
  const depsDone = t.deps.every((d) => runs[d]?.final === "success" && runs[d].decidedAt <= time)
  return depsDone ? "queued" : "none"
}

const STYLE: Record<State, { box: string; label: string }> = {
  none: { box: "fill-muted stroke-border", label: "no status" },
  queued: { box: "fill-background stroke-amber-500", label: "queued" },
  running: { box: "fill-sky-500/25 stroke-sky-500", label: "running" },
  success: { box: "fill-emerald-500/25 stroke-emerald-500", label: "success" },
  failed: { box: "fill-rose-500/30 stroke-rose-500", label: "failed" },
  upstream_failed: { box: "fill-orange-500/20 stroke-orange-500", label: "upstream_failed" },
}

const W = 480
const NODE_W = 104
const NODE_H = 30
const nx = (c: number) => 6 + c * 124
const ny = (r: number) => 10 + r * 50
const GANTT_Y = 170

export function DagLab() {
  const [slots, setSlots] = useState(2)
  const [failId, setFailId] = useState<string | null>(null)
  const sim = useMemo(() => simulate(slots, failId), [slots, failId])
  const pb = usePlayback({ length: sim.makespan, interval: 800 })
  const H = GANTT_Y + slots * 22 + 34

  const states = Object.fromEntries(TASKS.map((t) => [t.id, stateAt(t, sim.runs[t.id], pb.t, sim.runs)])) as Record<string, State>
  const count = (s: State) => Object.values(states).filter((v) => v === s).length
  const tx = (time: number) => 70 + (time / Math.max(sim.makespan, 1)) * (W - 80)

  const toggleFail = (id: string) => {
    setFailId((f) => (f === id ? null : id))
    pb.reset()
  }
  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggleFail(id)
    }
  }

  const blocked = TASKS.filter((t) => sim.runs[t.id]?.final === "upstream_failed").map((t) => t.id)
  const finished = pb.done

  return (
    <LabFrame
      title="DAG scheduler: parallel slots and failure propagation"
      prompt="Play the run with 1 slot, then 3. Next, make a task fail (click its box) and watch upstream_failed spread only to the tasks downstream of it."
      live={!pb.playing}
      legend={(["queued", "running", "success", "failed", "upstream_failed"] as State[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <svg aria-hidden width="12" height="12">
            <rect x="1" y="1" width="10" height="10" rx="2" className={STYLE[s].box} strokeWidth={1.5} />
          </svg>
          {STYLE[s].label}
        </span>
      ))}
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="time" value={`${pb.t} / ${sim.makespan}`} />
            <Stat label="running" value={`${count("running")} / ${slots} slots`} />
            <Stat label="queued" value={count("queued")} />
            <Stat label="done" value={count("success")} />
          </span>
          {finished
            ? failId
              ? `${failId} failed, so ${blocked.join(", ") || "nothing"} ${blocked.length === 1 ? "was" : "were"} marked upstream_failed without running. Branches that don't depend on it still succeeded.`
              : `All ${TASKS.length} tasks succeeded in ${sim.makespan} time units with ${slots} slot${slots > 1 ? "s" : ""}. More slots help only until the critical path (the longest dependency chain) is the bottleneck.`
            : count("queued") > 0
              ? "Some tasks are ready but queued: every slot is busy. That's the cost of limited parallelism."
              : "A task becomes ready only when all its upstream tasks have succeeded; the scheduler then starts it in a free slot."}
        </>
      }
      controls={
        <>
          <LabSlider label="Parallel slots (pool size)" value={slots} min={1} max={4} onChange={(v) => { setSlots(v); pb.reset() }} />
          <LabChoice
            label="Inject a failure"
            value={failId ?? "none"}
            options={[{ value: "none", label: "None" }, ...["extract_orders", "clean_events", "join"].map((id) => ({ value: id, label: id }))]}
            onChange={(v) => { setFailId(v === "none" ? null : v); pb.reset() }}
          />
          <PlayControls playing={pb.playing} done={pb.done} onToggle={pb.toggle} onStep={() => pb.step(1)} onReset={pb.reset} />
        </>
      }
    >
      <LabSvg width={W} height={H} label={`Pipeline DAG at time ${pb.t}`}>
        <defs>
          <marker id="dag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {TASKS.flatMap((t) =>
          t.deps.map((d) => {
            const s = BY_ID[d]
            const x1 = nx(s.col) + NODE_W
            const y1 = ny(s.row) + NODE_H / 2
            const x2 = nx(t.col)
            const y2 = ny(t.row) + NODE_H / 2
            return (
              <path
                key={`${d}-${t.id}`}
                d={`M${x1} ${y1} C${x1 + 12} ${y1} ${x2 - 14} ${y2} ${x2 - 1} ${y2}`}
                fill="none"
                className="stroke-muted-foreground"
                strokeOpacity={0.6}
                markerEnd="url(#dag-arrow)"
              />
            )
          })
        )}
        {TASKS.map((t) => {
          const st = states[t.id]
          return (
            <g
              key={t.id}
              role="button"
              tabIndex={0}
              aria-label={`${t.id}: ${STYLE[st].label}. ${failId === t.id ? "Set to fail; press to clear" : "Press to make it fail"}`}
              aria-pressed={failId === t.id}
              onClick={() => toggleFail(t.id)}
              onKeyDown={(e) => onKey(e, t.id)}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-ring [&:focus-visible>rect]:stroke-[3]"
            >
              <rect x={nx(t.col)} y={ny(t.row)} width={NODE_W} height={NODE_H} rx={7} className={cn(STYLE[st].box, "motion-safe:transition-colors")} strokeWidth={1.5} />
              <text x={nx(t.col) + NODE_W / 2} y={ny(t.row) + 13} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
                {t.id}
              </text>
              <text x={nx(t.col) + NODE_W / 2} y={ny(t.row) + 24} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {failId === t.id ? "will fail · " : ""}
                {t.dur}t
              </text>
            </g>
          )
        })}

        <text x={6} y={GANTT_Y - 8} className="fill-muted-foreground text-[11px]">
          Worker slots over time
        </text>
        {Array.from({ length: slots }, (_, s) => (
          <g key={s}>
            <text x={6} y={GANTT_Y + s * 22 + 14} className="fill-muted-foreground text-[10px]">
              slot {s + 1}
            </text>
            <rect x={70} y={GANTT_Y + s * 22} width={W - 80} height={18} rx={4} className="fill-muted" fillOpacity={0.6} />
          </g>
        ))}
        {TASKS.map((t) => {
          const r = sim.runs[t.id]
          if (!r || r.start === undefined || r.start >= pb.t) return null
          const end = Math.min(r.end!, pb.t)
          return (
            <g key={t.id}>
              <rect
                x={tx(r.start) + 1}
                y={GANTT_Y + r.slot! * 22 + 1}
                width={Math.max(tx(end) - tx(r.start) - 2, 2)}
                height={16}
                rx={3}
                className={STYLE[states[t.id]].box}
              />
              <text x={tx(r.start) + 4} y={GANTT_Y + r.slot! * 22 + 13} className="fill-foreground text-[9px]">
                {tx(end) - tx(r.start) > 44 ? t.id : ""}
              </text>
            </g>
          )
        })}
        <line x1={tx(pb.t)} x2={tx(pb.t)} y1={GANTT_Y - 4} y2={GANTT_Y + slots * 22 + 2} className="stroke-foreground" strokeWidth={1.5} />
        {Array.from({ length: sim.makespan + 1 }, (_, i) => (
          <text key={i} x={tx(i)} y={GANTT_Y + slots * 22 + 16} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {i}
          </text>
        ))}
      </LabSvg>
    </LabFrame>
  )
}
