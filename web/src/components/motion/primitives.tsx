"use client"

import { useEffect, useRef } from "react"
import { animate, motion, useReducedMotion, type HTMLMotionProps, type Variants } from "motion/react"

/** House easing: fast out, gentle settle. */
export const EASE = [0.22, 1, 0.36, 1] as const

const TAGS = {
  div: motion.div,
  section: motion.section,
  ol: motion.ol,
  ul: motion.ul,
  li: motion.li,
} as const
type Tag = keyof typeof TAGS

type BaseProps = Omit<HTMLMotionProps<"div">, "initial" | "animate" | "whileInView" | "variants"> & { as?: Tag }

/** Fades and lifts its content in once, when it scrolls into view. */
export function Reveal({ as = "div", delay = 0, y = 18, children, ...rest }: BaseProps & { delay?: number; y?: number }) {
  const Comp = TAGS[as] as typeof motion.div
  return (
    <Comp
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  )
}

const container = (step: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
})

/** Staggers its StaggerItem children in, on mount or when scrolled into view. */
export function Stagger({
  as = "div",
  step = 0.07,
  delay = 0,
  inView = false,
  children,
  ...rest
}: BaseProps & { step?: number; delay?: number; inView?: boolean }) {
  const Comp = TAGS[as] as typeof motion.div
  const trigger = inView
    ? { whileInView: "show" as const, viewport: { once: true, margin: "-60px" } }
    : { animate: "show" as const }
  return (
    <Comp variants={container(step, delay)} initial="hidden" {...trigger} {...rest}>
      {children}
    </Comp>
  )
}

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

export function StaggerItem({ as = "div", children, ...rest }: BaseProps) {
  const Comp = TAGS[as] as typeof motion.div
  return (
    <Comp variants={itemVariants} {...rest}>
      {children}
    </Comp>
  )
}

/** Counts up from the previous value (0 on first mount) to `value`. */
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString(),
  duration = 0.9,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = format(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = format(v)
      },
    })
    from.current = value
    return () => controls.stop()
    // format is usually an inline lambda; re-running on identity change would restart the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduce])

  return (
    <span ref={ref} className={className ?? "tabular-nums"}>
      {format(value)}
    </span>
  )
}
