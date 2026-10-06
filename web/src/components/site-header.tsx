"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "motion/react"
import { DatabaseIcon, GraduationCapIcon, LibraryIcon, SparklesIcon, TrophyIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/components/user-menu"
import { cn } from "@/lib/utils"

const NAV = [
  {
    href: "/learn",
    label: "Learn",
    icon: GraduationCapIcon,
    match: (p: string) => ["/learn", "/lessons", "/exercises", "/progress"].some((x) => p.startsWith(x)),
  },
  { href: "/playground", label: "Playground", icon: DatabaseIcon, match: (p: string) => p.startsWith("/playground") },
  { href: "/library", label: "Library", icon: LibraryIcon, match: (p: string) => p.startsWith("/library") },
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon, match: (p: string) => p.startsWith("/leaderboard") },
  { href: "/pricing", label: "Pricing", icon: SparklesIcon, match: (p: string) => p.startsWith("/pricing") },
]

export function SiteHeader() {
  const pathname = usePathname()
  const onLanding = pathname === "/"
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Logo />
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm sm:gap-1">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground sm:px-3",
                  active && "text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-md bg-accent"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="size-4 lg:hidden" />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {onLanding ? (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/learn">Start learning</Link>
            </Button>
          ) : null}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
