import Link from "next/link"

import { Logo } from "@/components/logo"

const LINKS = [
  { href: "/learn", label: "Courses" },
  { href: "/pricing", label: "Pricing" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/progress", label: "My progress" },
]

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Learn machine learning by implementing it, one graded step at a time.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Gradient</div>
    </footer>
  )
}
