import { CheckIcon, MinusIcon } from "lucide-react"

import { Faq } from "@/components/landing/faq"
import { PlanCards } from "@/components/pricing/plan-cards"
import { SiteFooter } from "@/components/site-footer"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { COMPARISON } from "@/lib/plans"

const PRICING_FAQ = [
  {
    q: "What happens to my progress if I switch plans?",
    a: "Nothing is lost. Completed lessons, exercises, submissions and XP stay on your account. If you move from Pro to Free, Pro-only courses lock again until you upgrade.",
  },
  {
    q: "Do I still have to complete courses in order on Pro?",
    a: "Yes. Pro opens Pro courses, but every course still unlocks after the one before it. The path is designed so each course builds on the last.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan is the trial: two full courses with no time limit. Upgrade once you're ready for transformers and LLMs.",
  },
  {
    q: "Do you offer team or classroom pricing?",
    a: "Team plans with cohort dashboards and central billing are in the works.",
  },
]

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") return <span className="text-sm">{value}</span>
  return value ? (
    <CheckIcon className="mx-auto size-4 text-success" aria-label="Included" />
  ) : (
    <MinusIcon className="mx-auto size-4 text-muted-foreground/50" aria-label="Not included" />
  )
}

export function PricingPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 pt-16 pb-12 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl space-y-3 text-center">
          <p className="text-sm font-medium text-brand">Pricing</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance">Simple plans for a long path</h1>
          <p className="text-muted-foreground">
            Two complete courses are free, forever. Pro opens the advanced track on transformers and LLMs.
          </p>
        </div>
        <PlanCards />
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">Compare plans</h2>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Feature</TableHead>
                <TableHead className="w-24 text-center">Free</TableHead>
                <TableHead className="w-24 text-center">Pro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="pl-4">{row.feature}</TableCell>
                  <TableCell className="text-center">
                    <Cell value={row.free} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Cell value={row.pro} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-12 pb-20 sm:px-6">
        <h2 className="mb-4 text-2xl font-semibold tracking-tight">Billing questions</h2>
        <Faq items={PRICING_FAQ} />
      </section>
      <SiteFooter />
    </>
  )
}
