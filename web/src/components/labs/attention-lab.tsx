"use client"

import { useId, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { LabChoice, LabFrame, LabSlider, LabSwitch, Stat } from "./kit"
import { fmt, pct } from "./math"
import { gaussian, hashString, mulberry32 } from "./rng"

const D = 8
const MAX_TOKENS = 10
const DEFAULT_TEXT = "the cat sat on the mat because it was tired"

type Mat = number[][]

function randomMatrix(seed: number): Mat {
  const r = mulberry32(seed)
  return Array.from({ length: D }, () => Array.from({ length: D }, () => gaussian(r) / Math.sqrt(D)))
}
const matvec = (M: Mat, v: number[]) => M.map((row) => row.reduce((s, m, j) => s + m * v[j], 0))

/** A word's toy embedding: deterministic from its spelling, so equal words share a vector. */
function embed(word: string): number[] {
  const r = mulberry32(hashString(word.toLowerCase()))
  return Array.from({ length: D }, () => gaussian(r))
}

/** Rotary position embedding: rotate each (2i, 2i+1) pair by pos * 10000^(-2i/D). */
function rope(v: number[], pos: number): number[] {
  const out = v.slice()
  for (let i = 0; i < D / 2; i++) {
    const theta = pos * 10000 ** ((-2 * i) / D)
    const c = Math.cos(theta)
    const s = Math.sin(theta)
    out[2 * i] = v[2 * i] * c - v[2 * i + 1] * s
    out[2 * i + 1] = v[2 * i] * s + v[2 * i + 1] * c
  }
  return out
}

function headWeights(seed: number) {
  const wq = randomMatrix(seed)
  const noise = randomMatrix(seed + 1)
  // Keys share most of the query projection, so similar words tend to score highly.
  const wk = wq.map((row, i) => row.map((v, j) => v + 0.6 * noise[i][j]))
  return { wq, wk }
}

function attention(tokens: string[], seed: number, opts: { temp: number; scaled: boolean; causal: boolean; rope: boolean }) {
  const { wq, wk } = headWeights(seed)
  const E = tokens.map(embed)
  const Q = E.map((e, i) => (opts.rope ? rope(matvec(wq, e), i) : matvec(wq, e)))
  const K = E.map((e, i) => (opts.rope ? rope(matvec(wk, e), i) : matvec(wk, e)))
  const div = (opts.scaled ? Math.sqrt(D) : 1) * opts.temp
  return Q.map((q, i) => {
    const scores = K.map((k, j) => (opts.causal && j > i ? -Infinity : q.reduce((s, qv, d) => s + qv * k[d], 0) / div))
    const m = Math.max(...scores)
    const ex = scores.map((s) => (s === -Infinity ? 0 : Math.exp(s - m)))
    const z = ex.reduce((a, b) => a + b, 0)
    return ex.map((e) => e / z)
  })
}

function AttentionPlayground({ multiHead }: { multiHead: boolean }) {
  const inputId = useId()
  const [text, setText] = useState(DEFAULT_TEXT)
  const [temp, setTemp] = useState(1)
  const [scaled, setScaled] = useState(true)
  const [causal, setCausal] = useState(false)
  const [useRope, setUseRope] = useState(multiHead)
  const [head, setHead] = useState(0)
  const [query, setQuery] = useState(7)

  const tokens = useMemo(() => text.split(/\s+/).filter(Boolean).slice(0, MAX_TOKENS), [text])
  const A = useMemo(
    () => attention(tokens, 7 + head * 101, { temp, scaled, causal, rope: multiHead && useRope }),
    [tokens, head, temp, scaled, causal, useRope, multiHead]
  )
  const n = tokens.length
  const qi = Math.min(query, n - 1)
  const row = A[qi] ?? []
  const allowed = row.filter((w, j) => !(causal && j > qi)).length
  const top = row.reduce((b, w, j) => (w > row[b] ? j : b), 0)
  const entropy = -row.reduce((s, w) => (w > 0 ? s + w * Math.log(w) : s), 0)
  const focus = allowed > 1 ? 1 - entropy / Math.log(allowed) : 1

  return (
    <LabFrame
      title={multiHead ? "Multi-head attention with RoPE" : "Attention weights, live"}
      prompt={
        multiHead
          ? "Switch heads to see that each head learns a different pattern over the same sentence. Toggle RoPE and watch the repeated word “the” stop scoring identically."
          : "Click a token on the left to pick the query row, then lower the temperature to sharpen the softmax or turn on the causal mask. Edit the sentence too."
      }
      readout={
        n === 0 ? (
          "Type a few words to build the attention matrix."
        ) : (
          <>
            <span className="mb-1.5 flex flex-wrap gap-1.5">
              <Stat label="query" value={tokens[qi]} />
              <Stat label="top key" value={`${tokens[top]} · ${pct(row[top])}`} />
              <Stat label="focus" value={pct(focus)} />
            </span>
            Row &ldquo;{tokens[qi]}&rdquo; is a softmax over {allowed} {causal ? "visible (earlier) " : ""}tokens, so it sums to
            100%. {temp < 0.6 ? "Low temperature exaggerates score gaps, so one key takes almost all the weight." : temp > 1.8 ? "High temperature flattens the scores toward a uniform average." : "Each cell is how much of that key's value vector flows into the query's output."}
            {!scaled && " Without the 1/√d scale, dot products grow with dimension and the softmax saturates."}
          </>
        )
      }
      controls={
        <>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
              Sentence (up to {MAX_TOKENS} words)
            </label>
            <Input id={inputId} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          </div>
          <LabSlider label="Temperature τ (scores ÷ τ)" value={temp} min={0.1} max={3} step={0.05} format={(v) => v.toFixed(2)} onChange={setTemp} />
          <div className="space-y-3">
            <LabSwitch label="Causal mask (no peeking ahead)" checked={causal} onChange={setCausal} />
            <LabSwitch label="Scale scores by 1/√d" checked={scaled} onChange={setScaled} />
            {multiHead && <LabSwitch label="Rotary position embedding (RoPE)" checked={useRope} onChange={setUseRope} />}
          </div>
          {multiHead && (
            <LabChoice
              label="Head"
              value={head}
              options={[0, 1, 2, 3].map((h) => ({ value: h, label: `Head ${h + 1}` }))}
              onChange={setHead}
              className="sm:col-span-2"
            />
          )}
        </>
      }
    >
      {n === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No tokens yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div
            role="grid"
            aria-label="Attention weight matrix: rows are queries, columns are keys"
            className="grid min-w-[22rem] gap-0.5 text-[11px]"
            style={{ gridTemplateColumns: `minmax(3.5rem,auto) repeat(${n}, minmax(0, 1fr))` }}
          >
            <div role="row" className="contents">
              <div role="columnheader" className="flex items-end pb-1 text-[10px] text-muted-foreground">
                query ↓ key →
              </div>
              {tokens.map((t, j) => (
                <div key={j} role="columnheader" className="truncate pb-1 text-center font-mono text-muted-foreground" title={t}>
                  {t}
                </div>
              ))}
            </div>
            {A.map((r, i) => (
              <div key={i} role="row" className="contents">
                <div role="rowheader" className="contents">
                <button
                  type="button"
                  onClick={() => setQuery(i)}
                  aria-pressed={i === qi}
                  className={cn(
                    "truncate rounded-md px-1.5 text-right font-mono outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    i === qi ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tokens[i]}
                </button>
                </div>
                {r.map((w, j) => {
                  const masked = causal && j > i
                  return (
                    <div
                      key={j}
                      role="gridcell"
                      aria-label={masked ? `${tokens[i]} to ${tokens[j]}: masked` : `${tokens[i]} to ${tokens[j]}: ${pct(w)}`}
                      className={cn(
                        "grid aspect-square place-items-center rounded-[3px] font-mono tabular-nums",
                        masked && "bg-[repeating-linear-gradient(45deg,var(--muted)_0_3px,transparent_3px_6px)]",
                        i === qi && "ring-1 ring-brand/60"
                      )}
                      style={masked ? undefined : { backgroundColor: `color-mix(in oklch, var(--brand) ${Math.round(w * 100)}%, transparent)` }}
                    >
                      {!masked && i === qi && <span className={w > 0.45 ? "text-brand-foreground" : "text-foreground"}>{fmt(w * 100, 2)}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </LabFrame>
  )
}

export function AttentionLab() {
  return <AttentionPlayground multiHead={false} />
}

export function MultiHeadAttentionLab() {
  return <AttentionPlayground multiHead />
}
