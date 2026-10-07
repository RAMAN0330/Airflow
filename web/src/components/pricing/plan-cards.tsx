"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { CheckIcon, CrownIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/motion/primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { monthlyPrice, PLANS, YEARLY_SAVINGS, type Interval, type PlanInfo } from "@/lib/plans"
import { cn } from "@/lib/utils"
import { useCatalogStore } from "@/stores/catalog-store"
import { useSessionStore } from "@/stores/session-store"

const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`)

export function PlanCards() {
  const [interval, setInterval] = useState<Interval>("year")
  const me = useSessionStore((s) => s.me)
  const load = useSessionStore((s) => s.load)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-3 text-sm">
        <Label htmlFor="billing-interval" className={cn(interval === "month" ? "text-foreground" : "text-muted-foreground")}>
          Monthly
        </Label>
        <Switch
          id="billing-interval"
          checked={interval === "year"}
          onCheckedChange={(c) => setInterval(c ? "year" : "month")}
          aria-label="Bill yearly"
        />
        <Label htmlFor="billing-interval" className={cn(interval === "year" ? "text-foreground" : "text-muted-foreground")}>
          Yearly
        </Label>
        <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
          Save {YEARLY_SAVINGS}%
        </Badge>
      </div>

      <Stagger inView step={0.1} className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <StaggerItem key={plan.id} className="flex">
          <PlanCard
            plan={plan}
            interval={interval}
            currentPlan={me?.plan ?? null}
            billingEnabled={me ? me.billing_mode === "demo" : true}
            onUpgrade={() => setCheckoutOpen(true)}
            onCancel={() => setCancelOpen(true)}
          />
          </StaggerItem>
        ))}
      </Stagger>

      <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} interval={interval} />
      <CancelDialog open={cancelOpen} onOpenChange={setCancelOpen} />
    </div>
  )
}

function PlanCard({
  plan,
  interval,
  currentPlan,
  billingEnabled,
  onUpgrade,
  onCancel,
}: {
  plan: PlanInfo
  interval: Interval
  currentPlan: "free" | "pro" | null
  billingEnabled: boolean
  onUpgrade: () => void
  onCancel: () => void
}) {
  const price = monthlyPrice(plan, interval)
  const isCurrent = currentPlan === plan.id

  let cta: React.ReactNode
  if (plan.comingSoon) {
    cta = (
      <Button variant="outline" disabled className="w-full">
        Coming soon
      </Button>
    )
  } else if (plan.id === "free") {
    cta =
      currentPlan === "pro" ? (
        <Button variant="ghost" className="w-full" onClick={onCancel}>
          Switch to Free
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link href="/learn">{isCurrent ? "Continue learning" : "Start learning"}</Link>
        </Button>
      )
  } else if (isCurrent) {
    cta = (
      <Button variant="secondary" disabled className="w-full">
        <CheckIcon /> Your current plan
      </Button>
    )
  } else {
    cta = (
      <Button className="w-full" onClick={onUpgrade} disabled={!billingEnabled}>
        <CrownIcon /> {billingEnabled ? "Upgrade to Pro" : "Checkout unavailable"}
      </Button>
    )
  }

  return (
    <div
      className={cn(
        "relative flex w-full flex-col gap-6 rounded-2xl border bg-card p-6 shadow-xs transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-elevated motion-reduce:hover:translate-y-0",
        plan.highlighted && "border-brand/60 shadow-glow lg:-my-2 lg:py-8",
        plan.comingSoon && "bg-muted/30"
      )}
    >
      {plan.highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gradient border-transparent text-white">
          Recommended
        </Badge>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          {isCurrent && <Badge variant="secondary">Current</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
      </div>
      <div className="min-h-16">
        {price === null ? (
          <p className="text-3xl font-semibold tracking-tight">Custom</p>
        ) : (
          <>
            <p className="flex items-baseline gap-1">
              <AnimatedNumber value={price} format={fmt} duration={0.5} className="text-4xl font-semibold tracking-tight tabular-nums" />
              <span className="text-sm text-muted-foreground">/ month</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {price === 0
                ? "Free forever"
                : interval === "year"
                  ? `${fmt(plan.price!.year)} billed yearly`
                  : "Billed monthly, cancel anytime"}
            </p>
          </>
        )}
      </div>
      {cta}
      <ul className="space-y-2.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <CheckIcon className={cn("mt-0.5 size-4 shrink-0", plan.highlighted ? "text-brand" : "text-success")} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CheckoutDialog({ open, onOpenChange, interval }: { open: boolean; onOpenChange: (o: boolean) => void; interval: Interval }) {
  const router = useRouter()
  const upgrade = useSessionStore((s) => s.upgrade)
  const [busy, setBusy] = useState(false)
  const pro = PLANS.find((p) => p.id === "pro")!

  const confirm = async () => {
    setBusy(true)
    try {
      await upgrade(interval)
      useCatalogStore.getState().invalidate()
      onOpenChange(false)
      toast.success("Welcome to Pro!", {
        description: "The Generative AI & LLMs course is now open to you once you reach it.",
        action: { label: "View courses", onClick: () => router.push("/learn") },
      })
    } catch (e) {
      toast.error("Upgrade failed", { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CrownIcon className="size-5 text-amber-500" /> Upgrade to Pro
          </DialogTitle>
          <DialogDescription>Unlock the Generative AI & LLMs course and every future Pro course.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-lg border p-4 text-sm">
          <div className="flex justify-between">
            <span>Pro, billed {interval === "year" ? "yearly" : "monthly"}</span>
            <span className="font-medium tabular-nums">
              {fmt(interval === "year" ? pro.price!.year : pro.price!.month)}/{interval === "year" ? "yr" : "mo"}
            </span>
          </div>
          <div className="flex justify-between border-t pt-3 font-medium">
            <span>Due today</span>
            <span className="tabular-nums">$0.00</span>
          </div>
        </div>
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Demo checkout: payments aren&apos;t connected on this server, so no card is needed and nothing is charged.
          Your account switches to Pro immediately.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={busy}>
            {busy && <Loader2Icon className="animate-spin" />} Confirm upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const cancel = useSessionStore((s) => s.cancel)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Switch back to Free?</AlertDialogTitle>
          <AlertDialogDescription>
            You keep all completed lessons, exercises and XP. Pro-only courses lock again until you upgrade.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Pro</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await cancel()
              useCatalogStore.getState().invalidate()
              toast("You're on the Free plan now")
            }}
          >
            Switch to Free
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
