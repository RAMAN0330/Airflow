"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CrownIcon, MedalIcon, PencilIcon, RefreshCwIcon, TrophyIcon } from "lucide-react"

import { RenameDialog } from "@/components/rename-dialog"
import { initials } from "@/components/user-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LeaderboardEntry, LeaderboardPeriod } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"
import { useSessionStore } from "@/stores/session-store"

const MEDAL = ["text-amber-500", "text-zinc-400", "text-orange-700 dark:text-orange-400"]

export function LeaderboardView() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all")
  const board = useCatalogStore((s) => s.leaderboards[period])
  const state = useCatalogStore((s) => s.leaderboardState)
  const load = useCatalogStore((s) => s.loadLeaderboard)
  const me = useSessionStore((s) => s.me)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    load(period)
  }, [period, load, me?.display_name])

  const podium = board?.entries.slice(0, 3) ?? []
  const meOutside = board?.me && !board.entries.some((e) => e.is_me)

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand">Community</p>
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            Earn XP by completing lessons (+25) and exercises (+100 to +300, by difficulty).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRenaming(true)}>
            <PencilIcon /> {me ? me.display_name : "Display name"}
          </Button>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
            <TabsList>
              <TabsTrigger value="all">All time</TabsTrigger>
              <TabsTrigger value="week">This week</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {!board && state === "error" ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">Couldn&apos;t load the leaderboard</p>
          <Button variant="outline" size="sm" onClick={() => load(period)}>
            <RefreshCwIcon /> Try again
          </Button>
        </div>
      ) : !board ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : board.entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <TrophyIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">{period === "week" ? "No XP earned this week yet" : "No one is on the board yet"}</p>
          <p className="max-w-sm text-sm text-muted-foreground">Complete your first lesson to claim the top spot.</p>
          <Button asChild size="sm">
            <Link href="/learn">Start learning</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 items-end gap-3 sm:gap-4">
            {[1, 0, 2].map((i) => {
              const e = podium[i]
              if (!e) return <div key={i} />
              return <PodiumCard key={e.rank} entry={e} place={i} />
            })}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 pl-4">Rank</TableHead>
                  <TableHead>Learner</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Lessons</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Exercises</TableHead>
                  <TableHead className="pr-4 text-right">XP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.entries.map((e) => (
                  <Row key={e.rank} entry={e} />
                ))}
                {meOutside && board.me && (
                  <>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={5} className="py-1 text-center text-xs text-muted-foreground">
                        ⋯
                      </TableCell>
                    </TableRow>
                    <Row entry={board.me} />
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {board.total_learners} learner{board.total_learners === 1 ? "" : "s"} ranked
            {period === "week" ? " in the last 7 days" : ""}.{" "}
            {!board.me && "Complete a lesson to join the board."}
          </p>
        </div>
      )}
      <RenameDialog open={renaming} onOpenChange={setRenaming} />
    </div>
  )
}

function PodiumCard({ entry: e, place }: { entry: LeaderboardEntry; place: number }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border bg-card px-2 text-center shadow-xs",
        place === 0 ? "border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-card py-6" : "py-4",
        e.is_me && "ring-2 ring-brand"
      )}
    >
      {place === 0 ? <CrownIcon className="size-6 text-amber-500" /> : <MedalIcon className={cn("size-5", MEDAL[place])} />}
      <Avatar className={place === 0 ? "size-14" : "size-11"}>
        <AvatarFallback className="bg-gradient-to-br from-brand/80 to-fuchsia-500/80 font-semibold text-white">
          {initials(e.display_name)}
        </AvatarFallback>
      </Avatar>
      <p className="w-full truncate px-1 text-sm font-medium">{e.display_name}</p>
      <p className="text-lg font-semibold tabular-nums">
        {e.xp} <span className="text-xs font-normal text-muted-foreground">XP</span>
      </p>
    </div>
  )
}

function Row({ entry: e }: { entry: LeaderboardEntry }) {
  return (
    <TableRow className={cn(e.is_me && "bg-brand/5 hover:bg-brand/10")}>
      <TableCell className="pl-4 font-medium tabular-nums">
        {e.rank <= 3 ? <MedalIcon className={cn("size-4", MEDAL[e.rank - 1])} aria-label={`Rank ${e.rank}`} /> : `#${e.rank}`}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="size-7">
            <AvatarFallback className="bg-muted text-[10px] font-semibold">{initials(e.display_name)}</AvatarFallback>
          </Avatar>
          <span className="max-w-48 truncate font-medium">{e.display_name}</span>
          {e.is_me && <Badge className="bg-brand text-brand-foreground">You</Badge>}
        </div>
      </TableCell>
      <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{e.lessons_completed}</TableCell>
      <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{e.exercises_completed}</TableCell>
      <TableCell className="pr-4 text-right font-semibold tabular-nums">{e.xp}</TableCell>
    </TableRow>
  )
}
