"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCapIcon, SparklesIcon, TrophyIcon } from "lucide-react"

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
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:px-3",
                match(pathname) && "bg-accent text-foreground"
              )}
            >
              <Icon className="size-4 md:hidden" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
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
