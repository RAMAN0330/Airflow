import Link from "next/link"

import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

/**
 * The Groundwork mark: three strata stacked like foundation courses, widest at the
 * bottom, with an amber capstone on top. Drawn on a 24-unit grid so it stays crisp at
 * 24px, and set on the brand gradient so it reads the same in light and dark themes.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-brand-gradient relative grid size-7 shrink-0 place-items-center overflow-hidden rounded-[28%] shadow-sm ring-1 ring-white/15 ring-inset",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[78%]" fill="none">
        <rect x="3.5" y="16" width="17" height="4" rx="1.4" fill="white" />
        <rect x="3.5" y="10.25" width="12.5" height="4" rx="1.4" fill="white" fillOpacity="0.78" />
        <rect x="3.5" y="4.5" width="7.5" height="4" rx="1.4" fill="#ffb245" />
      </svg>
    </span>
  )
}

export function Logo({
  className,
  markClassName,
  ...props
}: Omit<React.ComponentProps<typeof Link>, "href"> & { markClassName?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND.name} home`}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      <LogoMark className={markClassName} />
      <span className="text-[15px]">{BRAND.name}</span>
    </Link>
  )
}
