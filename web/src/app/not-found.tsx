import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="text-sm text-muted-foreground">This page doesn&apos;t exist.</p>
      <Button asChild variant="outline">
        <Link href="/learn">Browse courses</Link>
      </Button>
    </div>
  )
}
