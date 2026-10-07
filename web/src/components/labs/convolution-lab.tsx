"use client"

import { useMemo, useState } from "react"
import { FastForwardIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { LabChoice, LabFrame, PlayControls, Stat, Swatch } from "./kit"
import { fmt } from "./math"
import { usePlayback } from "./use-playback"

const N = 8
const K = 3
const OUT = N - K + 1

type KernelId = "identity" | "blur" | "sharpen" | "edge" | "sobelx" | "sobely"
const KERNELS: Record<KernelId, { label: string; k: number[]; note: string }> = {
  identity: { label: "Identity", k: [0, 0, 0, 0, 1, 0, 0, 0, 0], note: "copies the centre pixel, so the output is the input (minus its border)." },
  blur: { label: "Blur", k: Array(9).fill(1 / 9), note: "averages the 3×3 neighbourhood, smoothing sharp transitions." },
  sharpen: { label: "Sharpen", k: [0, -1, 0, -1, 5, -1, 0, -1, 0], note: "boosts the centre against its neighbours, exaggerating contrast at edges." },
  edge: { label: "Edge", k: [-1, -1, -1, -1, 8, -1, -1, -1, -1], note: "sums to zero, so flat regions give 0 and only changes in brightness respond." },
  sobelx: { label: "Sobel x", k: [-1, 0, 1, -2, 0, 2, -1, 0, 1], note: "responds to left-to-right brightness changes, i.e. vertical edges." },
  sobely: { label: "Sobel y", k: [-1, -2, -1, 0, 0, 0, 1, 2, 1], note: "responds to top-to-bottom brightness changes, i.e. horizontal edges." },
}

const IMAGES: Record<string, (r: number, c: number) => number> = {
  square: (r, c) => (r >= 2 && r <= 5 && c >= 2 && c <= 5 ? 1 : 0),
  diagonal: (r, c) => (c >= r ? 1 : 0),
  cross: (r, c) => (r === 3 || r === 4 || c === 3 || c === 4 ? 1 : 0),
}

const makeImage = (name: string) => Array.from({ length: N * N }, (_, i) => IMAGES[name](Math.floor(i / N), i % N))
const LEVELS = [0, 0.5, 1]

export function ConvolutionLab() {
  const [image, setImage] = useState(() => makeImage("square"))
  const [preset, setPreset] = useState("square")
  const [kid, setKid] = useState<KernelId>("edge")
  const pb = usePlayback({ length: OUT * OUT - 1, interval: 350 })
  const pos = pb.t
  const pr = Math.floor(pos / OUT)
  const pc = pos % OUT
  const kernel = KERNELS[kid].k

  const output = useMemo(
    () =>
      Array.from({ length: OUT * OUT }, (_, o) => {
        const r = Math.floor(o / OUT)
        const c = o % OUT
        let s = 0
        for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) s += kernel[i * K + j] * image[(r + i) * N + (c + j)]
        return s
      }),
    [image, kernel]
  )
  const maxAbs = Math.max(1e-9, ...output.map(Math.abs))

  const terms = Array.from({ length: 9 }, (_, t) => ({ w: kernel[t], x: image[(pr + Math.floor(t / K)) * N + pc + (t % K)] })).filter(
    (t) => t.w !== 0 && t.x !== 0
  )
  const value = output[pos]

  const inWindow = (r: number, c: number) => r >= pr && r < pr + K && c >= pc && c < pc + K
  const cellColor = (v: number) =>
    `color-mix(in oklch, ${v >= 0 ? "var(--brand)" : "var(--destructive)"} ${Math.round((Math.abs(v) / maxAbs) * 100)}%, transparent)`

  return (
    <LabFrame
      title="Convolution: a 3×3 kernel sliding over an image"
      prompt="Press play to slide the kernel across the image, or click any output cell to jump there. Switch kernels, and click input pixels to draw your own shape."
      live={!pb.playing}
      legend={
        <>
          <Swatch className="bg-brand" label="Positive response" />
          <Swatch className="bg-destructive" label="Negative response" />
          <span>Outlined: the 3×3 window and the cell it produces</span>
        </>
      }
      readout={
        <>
          <span className="mb-1.5 flex flex-wrap gap-1.5">
            <Stat label="position" value={`row ${pr + 1}, col ${pc + 1}`} />
            <Stat label="output" value={fmt(value, 3)} />
          </span>
          <span className="font-mono text-xs">
            {terms.length ? terms.map((t) => `${fmt(t.w, 2)}×${fmt(t.x, 2)}`).join(" + ") : "every kernel×pixel product is 0"} = {fmt(value, 3)}
          </span>
          <br />
          The output is the sum of kernel weights times the pixels under them. The {KERNELS[kid].label.toLowerCase()} kernel{" "}
          {KERNELS[kid].note} An 8×8 input shrinks to {OUT}×{OUT} without padding.
        </>
      }
      controls={
        <>
          <LabChoice
            label="Kernel"
            value={kid}
            options={(Object.keys(KERNELS) as KernelId[]).map((k) => ({ value: k, label: KERNELS[k].label }))}
            onChange={setKid}
          />
          <LabChoice
            label="Image"
            value={preset}
            options={Object.keys(IMAGES).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) }))}
            onChange={(v) => {
              setPreset(v)
              setImage(makeImage(v))
            }}
          />
          <PlayControls playing={pb.playing} done={pb.done} onToggle={pb.toggle} onStep={() => pb.step(1)} onReset={pb.reset}>
            <Button type="button" size="sm" variant="outline" onClick={() => pb.seek(OUT * OUT - 1)}>
              <FastForwardIcon /> Show whole map
            </Button>
          </PlayControls>
        </>
      }
    >
      <div className="grid items-center gap-4 p-1 sm:grid-cols-[minmax(0,8fr)_minmax(0,3.4fr)_minmax(0,6fr)]">
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Input (click pixels)</p>
          <div className="grid grid-cols-8 gap-px rounded-md bg-border p-px" role="group" aria-label="Input image, 8 by 8 pixels">
            {image.map((v, i) => {
              const r = Math.floor(i / N)
              const c = i % N
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Pixel row ${r + 1} column ${c + 1}, brightness ${v}`}
                  onClick={() => setImage((img) => img.map((x, j) => (j === i ? LEVELS[(LEVELS.indexOf(x) + 1) % LEVELS.length] : x)))}
                  className={cn(
                    "aspect-square bg-background outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                    inWindow(r, c) && "ring-2 ring-brand ring-inset"
                  )}
                  style={{ backgroundColor: v ? `color-mix(in oklch, var(--foreground) ${v * 85}%, var(--background))` : undefined }}
                />
              )
            })}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Kernel <span className="sr-only">weights</span></p>
          <div className="grid grid-cols-3 gap-px rounded-md bg-border p-px font-mono text-[10px] sm:text-[11px]">
            {kernel.map((w, i) => (
              <span key={i} className="grid aspect-square place-items-center bg-background tabular-nums" style={w ? { backgroundColor: `color-mix(in oklch, ${w > 0 ? "var(--brand)" : "var(--destructive)"} 30%, var(--background))` } : undefined}>
                {Number.isInteger(w) ? w : "1/9"}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Feature map</p>
          <div className="grid grid-cols-6 gap-px rounded-md bg-border p-px" role="group" aria-label="Output feature map, 6 by 6">
            {output.map((v, i) => {
              const computed = i <= pos
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Output row ${Math.floor(i / OUT) + 1} column ${(i % OUT) + 1}${computed ? `: ${fmt(v, 3)}` : ""}`}
                  aria-current={i === pos ? "true" : undefined}
                  onClick={() => pb.seek(i)}
                  className={cn(
                    "grid aspect-square place-items-center bg-background font-mono text-[9px] tabular-nums outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:text-[10px]",
                    i === pos && "ring-2 ring-brand ring-inset"
                  )}
                  style={computed ? { backgroundColor: cellColor(v) } : undefined}
                >
                  {computed ? fmt(v, 2) : ""}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </LabFrame>
  )
}
