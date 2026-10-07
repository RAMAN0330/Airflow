/**
 * Marching squares: turns a scalar grid into SVG path data for one iso-level.
 * `values[j * nx + i]` is the value at grid column i, row j. `toPx` maps fractional
 * grid coordinates to pixels.
 */
export function contourPath(
  values: ArrayLike<number>,
  nx: number,
  ny: number,
  level: number,
  toPx: (gi: number, gj: number) => [number, number]
): string {
  const parts: string[] = []
  const seg = (a: [number, number], b: [number, number]) => {
    const [x1, y1] = toPx(a[0], a[1])
    const [x2, y2] = toPx(b[0], b[1])
    parts.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`)
  }
  const lerp = (va: number, vb: number) => (level - va) / (vb - va)

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v0 = values[j * nx + i]
      const v1 = values[j * nx + i + 1]
      const v2 = values[(j + 1) * nx + i + 1]
      const v3 = values[(j + 1) * nx + i]
      const b0 = v0 > level
      const b1 = v1 > level
      const b2 = v2 > level
      const b3 = v3 > level
      if (b0 === b1 && b1 === b2 && b2 === b3) continue
      const e: ([number, number] | null)[] = [
        b0 !== b1 ? [i + lerp(v0, v1), j] : null,
        b1 !== b2 ? [i + 1, j + lerp(v1, v2)] : null,
        b3 !== b2 ? [i + lerp(v3, v2), j + 1] : null,
        b0 !== b3 ? [i, j + lerp(v0, v3)] : null,
      ]
      const hits = e.filter(Boolean) as [number, number][]
      if (hits.length === 2) seg(hits[0], hits[1])
      else if (hits.length === 4) {
        const centerHigh = (v0 + v1 + v2 + v3) / 4 > level
        if (centerHigh === b0) {
          seg(e[0]!, e[1]!)
          seg(e[2]!, e[3]!)
        } else {
          seg(e[0]!, e[3]!)
          seg(e[1]!, e[2]!)
        }
      }
    }
  }
  return parts.join("")
}
