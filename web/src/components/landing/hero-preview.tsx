"use client"

import { motion } from "motion/react"
import { CheckIcon, LightbulbIcon, PlayIcon, XIcon } from "lucide-react"

import { EASE } from "@/components/motion/primitives"

const LINES: [string, string, string][] = [
  ["", "def", " scaled_dot_product_attention(Q, K, V, mask=None):"],
  ["    ", "", "d_k = Q.shape[-1]"],
  ["    ", "", "scores = Q @ K.swapaxes(-1, -2) / np.sqrt(d_k)"],
  ["    ", "if", " mask is not None:"],
  ["        ", "", "scores = np.where(mask, scores, -np.inf)"],
  ["    ", "", "weights = softmax(scores, axis=-1)"],
  ["    ", "return", " weights @ V, weights"],
]

const TESTS: [boolean, string][] = [
  [true, "Softmax is numerically stable"],
  [true, "Scaling by √d_k is applied"],
  [false, "Causal head ignores future tokens"],
]

/** Illustrative, animated preview of the exercise workspace: code types in, tests tick, a hint appears. */
export function HeroPreview() {
  const codeDone = 0.35 + LINES.length * 0.12
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 30, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      style={{ transformPerspective: 1200 }}
    >
      <div className="animate-blob absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/30 via-fuchsia-500/15 to-sky-400/10 blur-2xl" />
      <motion.div
        className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-brand/10"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 text-xs text-muted-foreground">self_attention.py</span>
          <motion.span
            className="ml-auto flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
            initial={{ scale: 1 }}
            animate={{ scale: [1, 0.92, 1] }}
            transition={{ duration: 0.3, delay: codeDone }}
          >
            <PlayIcon className="size-3" /> Run tests
          </motion.span>
        </div>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-6">
          {LINES.map(([indent, kw, rest], i) => (
            <motion.div
              key={i}
              className="whitespace-pre"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.35 + i * 0.12 }}
            >
              <span className="mr-4 inline-block w-4 text-right text-muted-foreground/60 select-none">{i + 1}</span>
              {indent}
              {kw && <span className="text-brand">{kw}</span>}
              <span>{rest}</span>
              {i === LINES.length - 1 && <span className="animate-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-brand" />}
            </motion.div>
          ))}
        </pre>
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3 text-xs">
          <motion.div
            className="flex items-center justify-between font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: codeDone + 0.2 }}
          >
            <span>13 of 14 tests passing</span>
            <span className="text-muted-foreground">0.9s</span>
          </motion.div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-brand"
              initial={{ width: "0%" }}
              animate={{ width: "93%" }}
              transition={{ duration: 1, ease: EASE, delay: codeDone + 0.2 }}
            />
          </div>
          {TESTS.map(([ok, name], i) => (
            <motion.div
              key={name}
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: codeDone + 0.45 + i * 0.18 }}
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15, delay: codeDone + 0.5 + i * 0.18 }}
              >
                {ok ? <CheckIcon className="size-3.5 text-success" /> : <XIcon className="size-3.5 text-destructive" />}
              </motion.span>
              {name}
            </motion.div>
          ))}
          <motion.div
            className="flex items-start gap-2 rounded-md bg-brand/10 px-2 py-1.5 text-muted-foreground"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.4, ease: EASE, delay: codeDone + 1.1 }}
          >
            <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
            Build the mask from the sequence length and pass it through when causal=True.
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
