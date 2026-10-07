"use client"

import { useState } from "react"

import { LabChoice, LabFrame, LabLogSlider, LabSvg, PlayControls, Stat, Swatch } from "./kit"
import { int, scale } from "./math"
import { usePlayback } from "./use-playback"

const W = 480
const H = 330
const ROWS_PER_PAGE = 100
const FRAMES = 100
const N_MIN = 10
const N_MAX = 1e9

const depthFor = (n: number, fanout: number) => Math.max(1, Math.ceil(Math.log(n / 1) / Math.log(fanout) - 1e-9))
const scanPages = (n: number) => Math.max(1, Math.ceil(n / ROWS_PER_PAGE))

export function BTreeLab() {
  const [n, setN] = useState(1_000_000)
  const [fanout, setFanout] = useState(100)
  const pb = usePlayback({ length: FRAMES, interval: 40 })

  const depth = depthFor(n, fanout)
  const indexPages = depth + 1 // root-to-leaf, plus the heap page holding the row
  const totalScan = scanPages(n)
  // Animation runs on a log clock: frame k = budget of totalScan^(k/FRAMES) page reads.
  const budget = pb.t === 0 ? 0 : Math.max(1, Math.round(totalScan ** (pb.t / FRAMES)))
  const scanRead = Math.min(totalScan, budget)
  const idxRead = Math.min(indexPages, budget)

  // ---- tree diagram (top) ----
  const TREE_H = 130
  const levelY = (l: number) => 18 + (l * (TREE_H - 30)) / Math.max(depth, 1)
  const shownLevels = Math.min(depth, 6)

  // ---- log-log chart (bottom) ----
  const top = TREE_H + 50
  const lx = scale(Math.log10(N_MIN), Math.log10(N_MAX), 44, W - 10)
  const ly = scale(0, Math.log10(scanPages(N_MAX)), H - 22, top)
  const ns = Array.from({ length: 61 }, (_, i) => 10 ** (1 + (i / 60) * 8))
  const line = (f: (v: number) => number) => ns.map((v) => `${lx(Math.log10(v)).toFixed(1)},${ly(Math.log10(f(v))).toFixed(1)}`).join(" ")

  return (
    <LabFrame
      title="Index lookup vs full table scan"
      prompt="Run a lookup, then grow the table from thousands to billions of rows. The scan's work explodes while the B-tree adds a level only every time the table grows by the fanout."
      live={!pb.playing}
      legend={
        <>
          <Swatch className="bg-rose-500" label="Full scan (pages read)" line />
          <Swatch className="bg-brand" label="B-tree lookup (pages read)" line />
          <span>Animation time is logarithmic</span>
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="rows" value={int(n)} />
            <Stat label="tree depth" value={depth} />
            <Stat label="index reads" value={`${idxRead} / ${indexPages}`} />
            <Stat label="scan reads" value={`${int(scanRead)} / ${int(totalScan)}`} />
          </span>
          To find one key, the B-tree descends {depth} level{depth > 1 ? "s" : ""} (each page holds up to {fanout} keys) and
          then reads the row: <strong>{indexPages} pages</strong>. Without an index the database must read every page:{" "}
          <strong>{int(totalScan)} pages</strong>, about {int(totalScan / indexPages)}× more work. Ten times more rows adds at
          most one level to the tree.
        </>
      }
      controls={
        <>
          <LabLogSlider label="Table size (rows)" value={n} min={N_MIN} max={N_MAX} format={(v) => int(v)} onChange={(v) => { setN(v); pb.reset() }} />
          <LabChoice
            label="Fanout (keys per index page)"
            value={fanout}
            options={[16, 100, 500].map((f) => ({ value: f, label: String(f) }))}
            onChange={(v) => { setFanout(v); pb.reset() }}
          />
          <PlayControls playing={pb.playing} done={pb.done} onToggle={pb.toggle} onStep={() => pb.step(10)} onReset={pb.reset} />
        </>
      }
    >
      <LabSvg width={W} height={H} label={`B-tree of depth ${depth} versus a scan of ${int(totalScan)} pages`}>
        {/* B-tree: one highlighted path, siblings sketched around it */}
        <text x={10} y={12} className="fill-muted-foreground text-[11px]">
          B-tree lookup
        </text>
        {Array.from({ length: shownLevels }, (_, l) => {
          const lvl = l === shownLevels - 1 ? depth - 1 : l
          const y = levelY(l * (depth / shownLevels))
          const count = Math.min(fanout ** lvl, 7)
          const read = idxRead > lvl
          return (
            <g key={l}>
              {Array.from({ length: count }, (_, i) => {
                const span = Math.min(count * 34, 240)
                const x = 130 - span / 2 + (count === 1 ? span / 2 - 14 : (i * (span - 28)) / (count - 1))
                const onPath = i === Math.floor(count / 2)
                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={28}
                    height={14}
                    rx={3}
                    className={onPath && read ? "fill-brand stroke-brand" : "fill-muted stroke-border"}
                  />
                )
              })}
              {fanout ** lvl > 7 && (
                <text x={258} y={y + 11} className="fill-muted-foreground text-[10px]">
                  … {int(Math.min(fanout ** lvl, Math.ceil(n / fanout)))} pages
                </text>
              )}
              {l < shownLevels - 1 && (
                <line x1={130} x2={130} y1={y + 14} y2={levelY((l + 1) * (depth / shownLevels))} className={read ? "stroke-brand" : "stroke-border"} strokeWidth={2} />
              )}
            </g>
          )
        })}
        {depth > shownLevels && (
          <text x={60} y={TREE_H} className="fill-muted-foreground text-[10px]">
            ({depth} levels, some hidden)
          </text>
        )}

        {/* Scan bar */}
        <text x={320} y={12} className="fill-muted-foreground text-[11px]">
          Full scan
        </text>
        <rect x={320} y={20} width={150} height={TREE_H - 30} rx={6} className="fill-muted" />
        <rect
          x={320}
          y={20 + (TREE_H - 30) * (1 - scanRead / totalScan)}
          width={150}
          height={(TREE_H - 30) * (scanRead / totalScan)}
          rx={6}
          className="fill-rose-500"
          fillOpacity={0.7}
        />
        <text x={395} y={TREE_H + 4} textAnchor="middle" className="fill-foreground text-[11px] tabular-nums">
          {int(scanRead)} pages read
        </text>

        {/* Growth chart */}
        <text x={10} y={top - 12} className="fill-muted-foreground text-[11px]">
          Pages read per lookup vs table size (log–log)
        </text>
        {[1, 2, 3, 4, 5, 6, 7].map((e) => (
          <text key={e} x={40} y={ly(e) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
            1e{e}
          </text>
        ))}
        {[1, 3, 5, 7, 9].map((e) => (
          <text key={e} x={lx(e)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {int(10 ** e)}
          </text>
        ))}
        <line x1={44} x2={W - 10} y1={H - 22} y2={H - 22} className="stroke-border" />
        <polyline points={line(scanPages)} fill="none" className="stroke-rose-500" strokeWidth={2} />
        <polyline points={line((v) => depthFor(v, fanout) + 1)} fill="none" className="stroke-brand" strokeWidth={2} />
        <line x1={lx(Math.log10(n))} x2={lx(Math.log10(n))} y1={top} y2={H - 22} className="stroke-foreground" strokeDasharray="3 3" />
        <circle cx={lx(Math.log10(n))} cy={ly(Math.log10(totalScan))} r={4} className="fill-rose-500" />
        <circle cx={lx(Math.log10(n))} cy={ly(Math.log10(indexPages))} r={4} className="fill-brand" />
      </LabSvg>
    </LabFrame>
  )
}
