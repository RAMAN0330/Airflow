"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BarChart3Icon, CrownIcon, FlameIcon, PencilIcon, TrophyIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { AnimatedNumber, EASE } from "@/components/motion/primitives"

import { RenameDialog } from "@/components/rename-dialog"
import { ProBadge } from "@/components/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useSessionStore } from "@/stores/session-store"

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?"
}

export function UserMenu() {
  const me = useSessionStore((s) => s.me)
  const load = useSessionStore((s) => s.load)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  if (!me) return <Skeleton className="size-8 rounded-full" />

  return (
    <>
      <XpPill xp={me.xp} streak={me.current_streak ?? 0} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Account menu">
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-white">
                {initials(me.display_name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="truncate">{me.display_name}</span>
              {me.plan === "pro" && <ProBadge className="h-5" />}
            </span>
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {me.xp} XP{me.rank ? ` · Rank #${me.rank}` : ""}
            </span>
            {(me.current_streak ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs font-normal text-orange-500">
                <FlameIcon className="size-3.5" /> {me.current_streak}-day streak
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/progress">
              <BarChart3Icon /> My progress
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/leaderboard">
              <TrophyIcon /> Leaderboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <PencilIcon /> Edit display name
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/pricing">
              <CrownIcon /> {me.plan === "pro" ? "Manage plan" : "Upgrade to Pro"}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog open={renaming} onOpenChange={setRenaming} />
    </>
  )
}

/** XP counter that counts up and floats a "+N" when XP increases. */
function XpPill({ xp, streak }: { xp: number; streak: number }) {
  const [prev, setPrev] = useState(xp)
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null)

  // Derive the gain during render when XP changes (no effect needed).
  if (xp !== prev) {
    if (xp > prev) setGain({ amount: xp - prev, key: xp })
    setPrev(xp)
  }

  useEffect(() => {
    if (!gain) return
    const t = setTimeout(() => setGain(null), 1800)
    return () => clearTimeout(t)
  }, [gain])

  return (
    <Link
      href="/leaderboard"
      className="relative hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent sm:flex"
      title={streak ? `Your XP · ${streak}-day streak` : "Your XP"}
    >
      {streak > 0 && (
        <span className="flex items-center gap-0.5 border-r pr-1.5 text-orange-500 tabular-nums" aria-label={`${streak}-day streak`}>
          <FlameIcon className="size-3.5" aria-hidden /> {streak}
        </span>
      )}
      <motion.span
        key={gain?.key ?? "idle"}
        className="text-brand"
        animate={gain ? { rotate: [0, 180, 360], scale: [1, 1.5, 1] } : undefined}
        transition={{ duration: 0.7 }}
      >
        ✦
      </motion.span>
      <AnimatedNumber value={xp} /> XP
      <AnimatePresence>
        {gain && (
          <motion.span
            key={gain.key}
            className="absolute -top-1 right-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-foreground"
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: 1, y: -18, scale: 1 }}
            exit={{ opacity: 0, y: -28 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            +{gain.amount}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}
