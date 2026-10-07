"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore } from "react"
import { motion } from "motion/react"
import {
  ArrowRightIcon,
  BrainCircuitIcon,
  DatabaseIcon,
  GraduationCapIcon,
  LibraryIcon,
  MapIcon,
  MenuIcon,
  RotateCcwIcon,
  SearchIcon,
  SparklesIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react"

import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserMenu } from "@/components/user-menu"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  match: (p: string) => boolean
}

const starts = (...prefixes: string[]) => (p: string) => prefixes.some((x) => p === x || p.startsWith(`${x}/`))

const NAV: NavItem[] = [
  { href: "/learn", label: "Learn", icon: GraduationCapIcon, match: starts("/learn", "/lessons", "/exercises", "/progress", "/certificate") },
  { href: "/map", label: "Skill Map", icon: MapIcon, match: starts("/map") },
  { href: "/review", label: "Review", icon: RotateCcwIcon, match: starts("/review") },
  { href: "/playground", label: "Playground", icon: DatabaseIcon, match: starts("/playground") },
  { href: "/library", label: "Library", icon: LibraryIcon, match: starts("/library") },
  { href: "/leaderboard", label: "Leaderboard", icon: TrophyIcon, match: starts("/leaderboard") },
  { href: "/pricing", label: "Pricing", icon: SparklesIcon, match: starts("/pricing") },
]

/** Opens the global command palette (mounted elsewhere), which listens for this event. */
export function openCommandPalette() {
  window.dispatchEvent(new Event("open-command-palette"))
}

const noopSubscribe = () => () => {}

/** True on Apple platforms. The server snapshot assumes ⌘, corrected right after hydration. */
function useIsApple() {
  return useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent),
    () => true
  )
}

function SearchTrigger({ className }: { className?: string }) {
  const apple = useIsApple()
  const shortcut = apple ? "⌘K" : "Ctrl K"
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn("xl:hidden", className)}
        aria-label={`Search and jump to (${shortcut})`}
        aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
        onClick={openCommandPalette}
      >
        <SearchIcon />
      </Button>
      <button
        type="button"
        onClick={openCommandPalette}
        aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
        className={cn(
          "hidden h-8 w-44 items-center gap-2 rounded-lg border bg-muted/40 pr-1.5 pl-2.5 text-sm text-muted-foreground shadow-xs transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:flex",
          className
        )}
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <Kbd className="border bg-background">{shortcut}</Kbd>
      </button>
    </>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { href, label, icon: Icon } = item
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:px-3",
            active && "text-foreground"
          )}
        >
          {active && (
            <motion.span
              layoutId="nav-active"
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-accent shadow-xs ring-1 ring-border/70"
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            />
          )}
          <Icon className={cn("size-4 xl:hidden", active && "text-brand")} aria-hidden />
          <span className="sr-only xl:not-sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="xl:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}

function MobileMenu({ pathname }: { pathname: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <div className="flex items-center gap-2 pr-10">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetClose asChild>
            <Logo />
          </SheetClose>
        </div>
        <SheetDescription className="text-xs">{BRAND.tagline}</SheetDescription>
        <nav aria-label="Main" className="-mx-2 flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <SheetClose asChild key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active && "bg-accent text-foreground"
                  )}
                >
                  <Icon className={cn("size-4", active && "text-brand")} aria-hidden />
                  {label}
                </Link>
              </SheetClose>
            )
          })}
        </nav>
        <div className="mt-auto space-y-3 border-t pt-4">
          <SheetClose asChild>
            <Button variant="outline" className="w-full justify-start" onClick={openCommandPalette}>
              <SearchIcon /> Search and jump to…
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button asChild className="w-full">
              <Link href="/learn">
                <BrainCircuitIcon /> Continue learning <ArrowRightIcon className="ml-auto" />
              </Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const onLanding = pathname === "/"
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/60">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent"
      />
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 md:gap-5">
        <Logo />
        <nav aria-label="Main" className="hidden min-w-0 items-center gap-0.5 text-sm md:flex">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={item.match(pathname)} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <SearchTrigger />
          <ThemeToggle />
          {onLanding ? (
            <Button asChild size="sm" className="hidden 2xl:inline-flex">
              <Link href="/learn">Start learning</Link>
            </Button>
          ) : null}
          <UserMenu />
          <MobileMenu pathname={pathname} />
        </div>
      </div>
    </header>
  )
}
