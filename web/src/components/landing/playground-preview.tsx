"use client"

import { motion } from "motion/react"
import { DatabaseIcon, PlayIcon } from "lucide-react"

import { EASE } from "@/components/motion/primitives"

// The real result of this query on datasets/shop.sql.
const ROWS: [string, string][] = [
  ["Electronics", "15206.8"],
  ["Furniture", "11305.95"],
  ["Books", "5174.8"],
  ["Grocery", "1205.52"],
]

/** Animated preview of the SQL Playground, showing a real query and its real result. */
export function PlaygroundPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE }}
      className="overflow-hidden rounded-2xl border bg-card shadow-xl shadow-sky-500/10"
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs">
        <DatabaseIcon className="size-4 text-sky-500" />
        <span className="font-medium">shop.db</span>
        <span className="text-muted-foreground">customers · products · orders · order_items</span>
        <span className="ml-auto flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">
          <PlayIcon className="size-3" /> Run
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-6">
        <span className="text-brand">SELECT</span> p.category,{"\n"}       <span className="text-brand">ROUND</span>(<span className="text-brand">SUM</span>(oi.quantity * oi.unit_price), 2) <span className="text-brand">AS</span> revenue{"\n"}
        <span className="text-brand">FROM</span> order_items oi{"\n"}
        <span className="text-brand">JOIN</span> orders o <span className="text-brand">ON</span> o.order_id = oi.order_id <span className="text-brand">AND</span> o.status = <span className="text-emerald-600 dark:text-emerald-400">&apos;completed&apos;</span>{"\n"}
        <span className="text-brand">JOIN</span> products p <span className="text-brand">ON</span> p.product_id = oi.product_id{"\n"}
        <span className="text-brand">GROUP BY</span> p.category <span className="text-brand">ORDER BY</span> revenue <span className="text-brand">DESC</span>;
      </pre>
      <table className="w-full border-t font-mono text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left">category</th>
            <th className="px-4 py-2 text-right">revenue</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([c, r], i) => (
            <motion.tr
              key={c}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.5 + i * 0.12 }}
              className="border-t"
            >
              <td className="px-4 py-1.5">{c}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{r}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  )
}
