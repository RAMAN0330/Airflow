"use client"

import { useId, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from "react"
import { FlaskConicalIcon, PauseIcon, PlayIcon, RotateCcwIcon, StepForwardIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ frame */

/** The shared card every lab renders into: title, "try this" prompt, visual, controls, live readout. */
export function LabFrame({
  title,
  prompt,
  controls,
  readout,
  live = true,
  legend,
  children,
}: {
  title: string
  prompt: ReactNode
  controls: ReactNode
  readout: ReactNode
  /** Set false while animating so screen readers aren't flooded with updates. */
  live?: boolean
  legend?: ReactNode
  children: ReactNode
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border bg-gradient-to-br from-brand/5 via-card to-card">
      <figcaption className="space-y-1 border-b px-5 py-4 sm:px-6">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <FlaskConicalIcon className="size-4 text-brand" aria-hidden /> {title}
        </span>
        <p className="text-sm text-pretty text-muted-foreground">
          <span className="font-medium text-foreground">Try this: </span>
          {prompt}
        </p>
      </figcaption>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border bg-background p-2 sm:p-3">{children}</div>
          {legend && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">{legend}</div>}
        </div>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{controls}</div>
        <div aria-live={live ? "polite" : "off"} className="rounded-lg bg-muted/50 px-4 py-3 text-sm leading-6 text-pretty">
          {readout}
        </div>
      </div>
    </figure>
  )
}

/** Placeholder while a lab's code chunk loads. */
export function LabLoading() {
  return <Skeleton className="h-[28rem] w-full rounded-2xl" />
}

/** Legend swatch. `className` sets the colour via bg-*. */
export function Swatch({ className, label, line }: { className: string; label: ReactNode; line?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn(line ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-sm", className)} />
      {label}
    </span>
  )
}

/** A small metric shown inside readouts. */
export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </span>
  )
}

/* --------------------------------------------------------------- controls */

export function LabSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  className,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  className?: string
}) {
  const id = useId()
  const text = format ? format(value) : String(value)
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span id={id} className="font-medium text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-foreground tabular-nums">{text}</span>
      </div>
      <Slider
        aria-labelledby={id}
        thumbLabel={label}
        valueText={text}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  )
}

/** Slider on a log scale (learning rates, sample sizes, regularisation strengths). */
export function LabLogSlider({
  value,
  min,
  max,
  onChange,
  format,
  ...rest
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  format: (v: number) => string
  className?: string
}) {
  const lo = Math.log10(min)
  const hi = Math.log10(max)
  const pos = Math.round(((Math.log10(value) - lo) / (hi - lo)) * 200)
  return (
    <LabSlider
      {...rest}
      value={pos}
      min={0}
      max={200}
      format={() => format(value)}
      onChange={(p) => onChange(10 ** (lo + (p / 200) * (hi - lo)))}
    />
  )
}

export function LabSwitch({ label, checked, onChange, className }: { label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  const id = useId()
  return (
    <div className={cn("flex items-center justify-between gap-3 text-xs", className)}>
      <label htmlFor={id} className="font-medium text-muted-foreground">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** Segmented single choice rendered as pressed/unpressed buttons. */
export function LabChoice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn("space-y-1.5", className)}>
      <p id={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1">
        {options.map((o) => (
          <Button
            key={String(o.value)}
            type="button"
            size="sm"
            variant={o.value === value ? "default" : "outline"}
            aria-pressed={o.value === value}
            className="h-7 px-2.5 text-xs"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** Play / pause, single step and reset, laid out across the controls grid. */
export function PlayControls({
  playing,
  done,
  onToggle,
  onStep,
  onReset,
  stepLabel = "Step",
  children,
  className,
}: {
  playing: boolean
  done?: boolean
  onToggle: () => void
  onStep?: () => void
  onReset?: () => void
  stepLabel?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 sm:col-span-2", className)}>
      <Button type="button" size="sm" onClick={onToggle} aria-label={playing ? "Pause" : done ? "Replay" : "Play"}>
        {playing ? <PauseIcon /> : <PlayIcon />}
        {playing ? "Pause" : done ? "Replay" : "Play"}
      </Button>
      {onStep && (
        <Button type="button" size="sm" variant="outline" onClick={onStep} disabled={done}>
          <StepForwardIcon /> {stepLabel}
        </Button>
      )}
      {onReset && (
        <Button type="button" size="sm" variant="outline" onClick={onReset}>
          <RotateCcwIcon /> Reset
        </Button>
      )}
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------- svg */

/** Responsive SVG canvas with a fixed coordinate system. */
export function LabSvg({
  width,
  height,
  label,
  children,
  className,
  onPointer,
}: {
  width: number
  height: number
  label: string
  children: ReactNode
  className?: string
  /** Called with viewBox coordinates on pointer down (and drag, while pressed). */
  onPointer?: (x: number, y: number, kind: "down" | "move") => void
}) {
  const dragging = useRef(false)
  const toLocal = (e: ReactPointerEvent<SVGSVGElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * width, ((e.clientY - r.top) / r.height) * height]
  }
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={cn("block h-auto w-full text-foreground select-none", onPointer && "cursor-crosshair touch-none", className)}
      onPointerDown={
        onPointer &&
        ((e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          onPointer(...toLocal(e), "down")
        })
      }
      onPointerMove={onPointer && ((e) => dragging.current && onPointer(...toLocal(e), "move"))}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {children}
    </svg>
  )
}

/** Categorical colours that read well on light and dark backgrounds. */
export const SERIES = [
  { fill: "fill-brand", stroke: "stroke-brand", bg: "bg-brand", text: "text-brand" },
  { fill: "fill-amber-500", stroke: "stroke-amber-500", bg: "bg-amber-500", text: "text-amber-500" },
  { fill: "fill-sky-500", stroke: "stroke-sky-500", bg: "bg-sky-500", text: "text-sky-500" },
  { fill: "fill-emerald-500", stroke: "stroke-emerald-500", bg: "bg-emerald-500", text: "text-emerald-500" },
  { fill: "fill-rose-500", stroke: "stroke-rose-500", bg: "bg-rose-500", text: "text-rose-500" },
  { fill: "fill-teal-500", stroke: "stroke-teal-500", bg: "bg-teal-500", text: "text-teal-500" },
  { fill: "fill-fuchsia-500", stroke: "stroke-fuchsia-500", bg: "bg-fuchsia-500", text: "text-fuchsia-500" },
  { fill: "fill-lime-600", stroke: "stroke-lime-600", bg: "bg-lime-600", text: "text-lime-600" },
] as const
