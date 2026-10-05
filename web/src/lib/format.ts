export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 45) return "just now"
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
  ]
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  let unit: Intl.RelativeTimeFormatUnit = "minute"
  let div = 60
  for (const [s, u] of units) {
    if (seconds >= s) {
      unit = u
      div = s
    }
  }
  return rtf.format(-Math.round(seconds / div), unit)
}

export function prettyTestName(name: string): string {
  const [base, param] = name.split("[")
  const words = base.replace(/^test_/, "").replace(/_/g, " ")
  const label = words.charAt(0).toUpperCase() + words.slice(1)
  return param ? `${label} [${param}` : label
}

export function pct(score: number | null | undefined): string {
  return `${Math.round((score ?? 0) * 100)}%`
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}
