/** Small numeric helpers shared by the labs. Pure functions, no dependencies. */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Linear map from a domain to a range. */
export function scale(d0: number, d1: number, r0: number, r1: number) {
  const k = (r1 - r0) / (d1 - d0)
  return (v: number) => r0 + (v - d0) * k
}

export function mean(xs: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += xs[i]
  return xs.length ? s / xs.length : 0
}

export function variance(xs: ArrayLike<number>): number {
  const m = mean(xs)
  let s = 0
  for (let i = 0; i < xs.length; i++) s += (xs[i] - m) ** 2
  return xs.length > 1 ? s / (xs.length - 1) : 0
}

/** Quantile of an ascending-sorted array (linear interpolation). */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  if (!sorted.length) return NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** Error function (Abramowitz & Stegun 7.1.26, |err| < 1.5e-7). */
export function erf(x: number): number {
  const s = Math.sign(x)
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}

export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2))
export const normPdf = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)

/** Compact human formatting for readouts. */
export function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return n > 0 ? "∞" : n < 0 ? "−∞" : "NaN"
  const a = Math.abs(n)
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return n.toExponential(1).replace("-", "−")
  const s = Number(n.toPrecision(digits)).toString()
  return s.replace("-", "−")
}

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`

/** Integer with thousands separators. */
export const int = (n: number) => Math.round(n).toLocaleString("en-US")
