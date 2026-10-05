"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BarChart3Icon, CrownIcon, PencilIcon, TrophyIcon } from "lucide-react"

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
      <Link
        href="/leaderboard"
        className="hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors hover:bg-accent sm:flex"
        title="Your XP"
      >
        <span className="text-brand">✦</span> {me.xp} XP
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Account menu">
            <Avatar className="size-8">
              <AvatarFallback className="bg-gradient-to-br from-brand/80 to-fuchsia-500/80 text-xs font-semibold text-white">
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
