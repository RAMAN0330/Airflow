"use client"

import * as React from "react"
import { motion } from "motion/react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indicatorClassName?: string }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      value={value}
      {...props}
    >
      {/* Fills from empty on mount and glides between values. */}
      <motion.div
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 rounded-full bg-primary", indicatorClassName)}
        initial={{ x: "-100%" }}
        animate={{ x: `-${100 - (value || 0)}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
