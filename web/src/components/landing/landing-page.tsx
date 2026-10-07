import Link from "next/link"
import { ArrowRightIcon, MapIcon } from "lucide-react"

import { CatalogStats, CountWord } from "@/components/landing/catalog-stats"
import { CoursePreview } from "@/components/landing/course-preview"
import { Faq } from "@/components/landing/faq"
import { FeatureBento } from "@/components/landing/feature-bento"
import { HeroStrata } from "@/components/landing/hero-strata"
import { HowItWorks } from "@/components/landing/how-it-works"
import { PlaygroundPreview } from "@/components/landing/playground-preview"
import { LogoMark } from "@/components/logo"
import { Reveal } from "@/components/motion/primitives"
import { PlanCards } from "@/components/pricing/plan-cards"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { BRAND } from "@/lib/brand"

const delay = (ms: number) => ({ "--enter-delay": `${ms}ms` }) as React.CSSProperties

function Eyebrow({ children, className = "text-brand" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm font-semibold tracking-wide uppercase ${className}`}>{children}</p>
}

export function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b">
        <div aria-hidden className="bg-aurora pointer-events-none absolute inset-0 -z-10" />
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pt-14 pb-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-16">
          <div className="min-w-0 space-y-7">
            <div className="enter" style={delay(0)}>
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border bg-card/70 py-1 pr-3 pl-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur">
                <LogoMark className="size-5" />
                <span className="truncate">Math · Data · Machine Learning · MLOps</span>
              </span>
            </div>
            <h1
              className="enter text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
              style={delay(90)}
            >
              Build ML, data &amp; MLOps <span className="text-gradient-brand animate-gradient">from the ground up.</span>
            </h1>
            <p className="enter max-w-xl text-lg text-pretty text-muted-foreground" style={delay(180)}>
              Start with the math, then build the pipelines, the models and the systems that ship them. Short lessons
              cite their sources. You implement every algorithm yourself, and hidden tests grade it the way a reviewer
              would.
            </p>
            <div className="enter flex flex-wrap gap-3" style={delay(270)}>
              <Button asChild size="lg" className="shadow-glow">
                <Link href="/learn">
                  Start learning free <ArrowRightIcon />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how-it-works">How it works</Link>
              </Button>
            </div>
            <p className="enter text-sm text-muted-foreground" style={delay(360)}>
              No sign-up needed. Your progress is saved in this browser.
            </p>
          </div>
          <div className="enter min-w-0" style={{ ...delay(120), "--enter-y": "24px" } as React.CSSProperties}>
            <HeroStrata />
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:pb-20">
          <div className="enter" style={delay(450)}>
            <CatalogStats />
          </div>
        </div>
      </section>

      <HowItWorks />

      {/* Tracks */}
      <section className="relative border-y bg-muted/30">
        <div aria-hidden className="bg-strata pointer-events-none absolute inset-x-0 top-0 h-40 text-brand [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl space-y-3">
              <Eyebrow>The tracks</Eyebrow>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                <CountWord kind="tracks" fallback="Four" /> tracks, each built in layers
              </h2>
              <p className="text-pretty text-muted-foreground">
                Ground yourself in the math, build the data platform models depend on, implement the models, then learn
                to run them in production. Courses within a track unlock in order. Tracks are independent, so start
                wherever you like.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/learn">
                View all courses <ArrowRightIcon />
              </Link>
            </Button>
          </Reveal>
          <CoursePreview />
        </div>
      </section>

      <FeatureBento />

      {/* Playground showcase */}
      <section className="border-t">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 overflow-x-clip px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <Reveal className="space-y-5">
            <Eyebrow className="text-sky-700 dark:text-sky-400">Practice, not just theory</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Query a real database from your first lesson
            </h2>
            <p className="text-pretty text-muted-foreground">
              The SQL Playground loads a small online shop: customers, products, orders and order lines. Explore the
              schema, run the sample queries, compare query plans before and after adding an index. Then apply it in the
              graded Data Engineering exercises.
            </p>
            <ul className="space-y-2 text-sm">
              {[
                "Schema explorer with keys and relationships",
                "Every statement's result in its own tab",
                "Sandboxed: writes never persist, runaway queries are stopped",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500" /> {t}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline">
              <Link href="/playground">
                Open the playground <ArrowRightIcon />
              </Link>
            </Button>
          </Reveal>
          <PlaygroundPreview />
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal className="mx-auto mb-12 max-w-2xl space-y-3 text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Start free. Upgrade when you&apos;re ready to go further.
            </h2>
          </Reveal>
          <PlanCards />
          <p className="mt-6 text-center text-sm">
            <Link href="/pricing" className="font-medium text-brand underline-offset-4 hover:underline">
              Compare plans in detail →
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ */}
      <Reveal as="section" id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
        <Faq />
      </Reveal>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:pb-28">
        <Reveal className="bg-brand-gradient relative isolate overflow-hidden rounded-3xl px-6 py-16 text-center text-white shadow-glow sm:px-12 lg:py-20">
          <div aria-hidden className="bg-strata pointer-events-none absolute inset-0 -z-10 text-white opacity-60" />
          <div
            aria-hidden
            className="animate-blob pointer-events-none absolute -top-24 -right-24 -z-10 size-80 rounded-full bg-[#ffb245]/30 blur-3xl"
          />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 -z-10 size-80 rounded-full bg-white/10 blur-3xl" />
          <LogoMark className="mx-auto mb-6 size-12 ring-white/30" />
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Lay the first layer today.</h2>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-white/85">{BRAND.tagline} Free to start, no sign-up needed.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-[#302bb0] hover:bg-white/90">
              <Link href="/learn">
                Start the first lesson <ArrowRightIcon />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white dark:border-white/40 dark:bg-white/10 dark:hover:bg-white/20"
            >
              <Link href="/map">
                <MapIcon /> Explore the Skill Map
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </>
  )
}
