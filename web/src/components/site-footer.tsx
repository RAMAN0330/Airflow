import Link from "next/link"

import { Logo } from "@/components/logo"
import { BRAND } from "@/lib/brand"

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { href: "/learn", label: "Courses" },
      { href: "/map", label: "Skill Map" },
      { href: "/review", label: "Review" },
      { href: "/progress", label: "My progress" },
    ],
  },
  {
    title: "Practice",
    links: [
      { href: "/playground", label: "SQL Playground" },
      { href: "/library", label: "Library" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    title: BRAND.name,
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t bg-muted/30">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_2fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">{BRAND.tagline}</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Every lesson cites its sources. Every exercise is graded by hidden tests in a sandbox.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="space-y-3">
              <p className="text-xs font-semibold tracking-wider text-foreground uppercase">{col.title}</p>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} {BRAND.name}
          </p>
          <p>Learn it by building it.</p>
        </div>
      </div>
    </footer>
  )
}
