import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { LogoMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { BRAND } from "@/lib/brand"

export default function NotFound() {
  return (
    <div className="relative isolate flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-4 py-20 text-center">
      <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <LogoMark className="size-12" />
      <p className="text-gradient-brand text-6xl font-semibold tracking-tight">404</p>
      <h1 className="text-xl font-semibold tracking-tight">Nothing has been built here yet</h1>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">
        This page doesn&apos;t exist. Head back to solid ground and pick up where you left off in {BRAND.name}.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/learn">
            Browse courses <ArrowRightIcon />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  )
}
