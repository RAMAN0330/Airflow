import { CheckIcon, LightbulbIcon, PlayIcon, XIcon } from "lucide-react"

/** Static, illustrative preview of the exercise workspace for the landing hero. */
export function HeroPreview() {
  const lines: [string, string][] = [
    ["def", " scaled_dot_product_attention(Q, K, V, mask=None):"],
    ["", "    d_k = Q.shape[-1]"],
    ["", "    scores = Q @ K.swapaxes(-1, -2) / np.sqrt(d_k)"],
    ["if", " mask is not None:"],
    ["", "        scores = np.where(mask, scores, -np.inf)"],
    ["", "    weights = softmax(scores, axis=-1)"],
    ["return", " weights @ V, weights"],
  ]
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-brand/25 via-fuchsia-500/10 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-xl border bg-card shadow-xl">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 text-xs text-muted-foreground">self_attention.py</span>
          <span className="ml-auto flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">
            <PlayIcon className="size-3" /> Run tests
          </span>
        </div>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-6">
          {lines.map(([kw, rest], i) => {
            const indent = kw === "if" ? "    " : kw === "return" ? "    " : ""
            return (
              <div key={i} className="whitespace-pre">
                <span className="mr-4 inline-block w-4 text-right text-muted-foreground/60 select-none">{i + 1}</span>
                {indent}
                {kw && <span className="text-brand">{kw}</span>}
                <span>{rest}</span>
              </div>
            )
          })}
        </pre>
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3 text-xs">
          <div className="flex items-center justify-between font-medium">
            <span>13 of 14 tests passing</span>
            <span className="text-muted-foreground">0.9s</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[93%] rounded-full bg-brand" />
          </div>
          <div className="flex items-center gap-2">
            <CheckIcon className="size-3.5 text-success" /> Softmax is numerically stable
          </div>
          <div className="flex items-center gap-2">
            <CheckIcon className="size-3.5 text-success" /> Scaling by √d_k is applied
          </div>
          <div className="flex items-center gap-2">
            <XIcon className="size-3.5 text-destructive" /> Causal head ignores future tokens
          </div>
          <div className="flex items-start gap-2 rounded-md bg-brand/10 px-2 py-1.5 text-muted-foreground">
            <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
            Build the mask from the sequence length and pass it through when causal=True.
          </div>
        </div>
      </div>
    </div>
  )
}
