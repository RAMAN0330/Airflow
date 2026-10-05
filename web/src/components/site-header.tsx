"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3Icon, MapIcon } from "lucide-react"

import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Roadmap", icon: MapIcon, match: (p: string) => p === "/" || p.startsWith("/exercises") },
  { href: "/progress", label: "Progress", icon: BarChart3Icon, match: (p: string) => p.startsWith("/progress") },
]

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map(({ href, label, icon: Icon, match }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                match(pathname) && "bg-accent text-foreground"
              )}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
