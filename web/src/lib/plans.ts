// Plan catalog shown on the landing and pricing pages. Prices are placeholders:
// change them here. Entitlements are enforced by the API (course "tier" in
// exercises/curriculum.json), so keep the feature copy in sync with it.

export type Interval = "month" | "year"

export interface PlanInfo {
  id: "free" | "pro" | "teams"
  name: string
  tagline: string
  price: { month: number; year: number } | null
  features: string[]
  highlighted?: boolean
  comingSoon?: boolean
}

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Learn the foundations at your own pace.",
    price: { month: 0, year: 0 },
    features: [
      "Machine Learning: Classical ML and Deep Learning courses",
      "Data Engineering: Databases & SQL and ETL/ELT Pipelines",
      "SQL Playground with a sample database",
      "Library of cited sources and a glossary",
      "Sandboxed grading, hints and mentor tips",
      "XP, streaks and the leaderboard",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Every track, through transformers and production MLOps.",
    price: { month: 12, year: 96 },
    highlighted: true,
    features: [
      "Everything in Free",
      "Generative AI & LLMs course",
      "MLOps Foundations: registry, drift and feature stores",
      "Every new Pro course as it ships",
      "Unlimited submissions and full history",
    ],
  },
  {
    id: "teams",
    name: "Teams",
    tagline: "Run a cohort or upskill an ML team.",
    price: null,
    comingSoon: true,
    features: ["Everything in Pro for each seat", "Cohort progress dashboards", "Central billing and seat management"],
  },
]

export const COMPARISON: { feature: string; free: boolean | string; pro: boolean | string }[] = [
  { feature: "Classical Machine Learning", free: true, pro: true },
  { feature: "Deep Learning Foundations", free: true, pro: true },
  { feature: "Databases & SQL", free: true, pro: true },
  { feature: "ETL/ELT Pipelines", free: true, pro: true },
  { feature: "Generative AI & LLMs", free: false, pro: true },
  { feature: "MLOps Foundations", free: false, pro: true },
  { feature: "Future Pro courses", free: false, pro: true },
  { feature: "SQL Playground", free: true, pro: true },
  { feature: "Library of cited sources & glossary", free: true, pro: true },
  { feature: "Lessons, quizzes & flow diagrams", free: true, pro: true },
  { feature: "Hidden-test grading in a sandbox", free: true, pro: true },
  { feature: "Leaderboard & XP", free: true, pro: true },
]

export function monthlyPrice(plan: PlanInfo, interval: Interval): number | null {
  if (!plan.price) return null
  return interval === "year" ? Math.round((plan.price.year / 12) * 100) / 100 : plan.price.month
}

export const YEARLY_SAVINGS = Math.round((1 - PLANS[1].price!.year / (PLANS[1].price!.month * 12)) * 100)
