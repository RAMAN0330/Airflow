"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react"
import { ArrowLeftIcon, AwardIcon, LockIcon, PrinterIcon, RefreshCwIcon } from "lucide-react"

import { EASE } from "@/components/motion/primitives"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, api } from "@/lib/api"
import { BRAND } from "@/lib/brand"
import { courseHref } from "@/lib/links"
import type { Certificate } from "@/lib/types"

// Print: only the certificate, landscape, edge to edge, with its colors intact.
const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #certificate, #certificate * { visibility: visible !important; }
  #certificate {
    position: fixed !important; inset: 0 !important; margin: 0 !important;
    width: 100vw !important; height: 100vh !important; max-width: none !important;
    border-radius: 0 !important; box-shadow: none !important;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
}
`

export function CertificateView({ courseId }: { courseId: string }) {
  const [cert, setCert] = useState<Certificate | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)

  const load = useCallback(() => {
    api
      .certificate(courseId)
      .then((c) => {
        setCert(c)
        setError(null)
      })
      .catch((e: ApiError) => setError({ status: e.status ?? 0, message: e.message }))
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  if (error) {
    const locked = error.status === 403
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-muted">
          {locked ? <LockIcon className="size-6 text-muted-foreground" /> : <AwardIcon className="size-6 text-muted-foreground" />}
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">
            {locked ? "Certificate not earned yet" : error.status === 404 ? "No such course" : "Couldn't load the certificate"}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {locked ? "Finish every lesson and exercise in this course and your certificate appears here." : error.message}
          </p>
        </div>
        <div className="flex gap-2">
          {error.status !== 404 && (
            <Button asChild>
              <Link href={courseHref(courseId)}>Go to course</Link>
            </Button>
          )}
          {!locked && error.status !== 404 && (
            <Button variant="outline" onClick={load}>
              <RefreshCwIcon /> Try again
            </Button>
          )}
          {error.status === 404 && (
            <Button asChild variant="outline">
              <Link href="/learn">All courses</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={courseHref(courseId)}>
            <ArrowLeftIcon /> Back to course
          </Link>
        </Button>
        <Button onClick={() => window.print()} disabled={!cert}>
          <PrinterIcon /> Print / Save as PDF
        </Button>
      </div>

      {!cert ? (
        <Skeleton className="aspect-[1.414] w-full rounded-2xl" />
      ) : (
        <>
          {/* Narrow screens scroll the certificate sideways rather than squashing it. */}
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="min-w-[680px]"
            >
              <CertificateSheet cert={cert} />
            </motion.div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Tip: in the print dialog choose “Save as PDF”, landscape, and enable background graphics.
          </p>
        </>
      )}
    </div>
  )
}

/** The certificate itself: always a light "paper" document, in both themes and in print. */
function CertificateSheet({ cert }: { cert: Certificate }) {
  const date = new Date(cert.completed_at).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
  const hours = Math.max(1, Math.round(cert.estimated_minutes / 60))
  const concepts = cert.concepts.slice(0, 10)

  return (
    <article
      id="certificate"
      aria-label={`Certificate of completion for ${cert.course_title}`}
      className="relative aspect-[1.414] w-full overflow-hidden rounded-2xl bg-[#fdfcf8] text-zinc-900 shadow-2xl shadow-black/10 ring-1 ring-black/5 [print-color-adjust:exact] dark:shadow-black/50"
    >
      {/* Guilloche-style background and double frame */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1414 1000" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="cert-band" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#c026d3" />
          </linearGradient>
          <pattern id="cert-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="#7c3aed" strokeOpacity="0.05" />
          </pattern>
        </defs>
        <rect width="1414" height="1000" fill="url(#cert-grid)" />
        {Array.from({ length: 9 }, (_, i) => (
          <ellipse key={i} cx="1414" cy="1000" rx={260 + i * 38} ry={180 + i * 30} fill="none" stroke="url(#cert-band)" strokeOpacity={0.09} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <ellipse key={`b${i}`} cx="0" cy="0" rx={220 + i * 34} ry={160 + i * 26} fill="none" stroke="url(#cert-band)" strokeOpacity={0.07} />
        ))}
        <rect x="28" y="28" width="1358" height="944" rx="14" fill="none" stroke="url(#cert-band)" strokeWidth="3" />
        <rect x="42" y="42" width="1330" height="916" rx="8" fill="none" stroke="#a1a1aa" strokeOpacity="0.5" />
      </svg>

      <div className="relative flex h-full flex-col items-center px-[8%] pt-[6.5%] pb-[5%] text-center">
        <p className="flex items-center gap-2 text-[clamp(10px,1.3vw,15px)] font-semibold tracking-[0.35em] text-violet-700 uppercase">
          {BRAND.name}
        </p>
        <h1 className="mt-[2.2%] font-serif text-[clamp(26px,4.4vw,52px)] leading-tight tracking-tight">Certificate of Completion</h1>
        <p className="mt-[2%] text-[clamp(11px,1.4vw,16px)] text-zinc-500">This certifies that</p>
        <p className="mt-[1.2%] font-serif text-[clamp(30px,5.2vw,62px)] leading-tight text-zinc-950 italic">{cert.display_name}</p>
        <div className="mt-[1%] h-px w-1/2 bg-gradient-to-r from-transparent via-zinc-400 to-transparent" />
        <p className="mt-[2%] max-w-[80%] text-[clamp(11px,1.4vw,16px)] text-pretty text-zinc-600">
          has completed every lesson and graded exercise in the {cert.level.toLowerCase()} course
        </p>
        <h2 className="mt-[1.2%] text-[clamp(18px,2.8vw,34px)] font-semibold tracking-tight text-violet-800">{cert.course_title}</h2>
        <p className="mt-[0.6%] text-[clamp(10px,1.2vw,14px)] text-zinc-500">{cert.track_title} track</p>

        {concepts.length > 0 && (
          <ul className="mt-[2.4%] flex max-w-[86%] flex-wrap justify-center gap-x-2 gap-y-1 text-[clamp(9px,1vw,12px)] text-zinc-600">
            {concepts.map((c, i) => (
              <li key={c} className="flex items-center gap-2">
                {i > 0 && <span className="text-violet-400">•</span>}
                {c}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto grid w-full grid-cols-[1fr_auto_1fr] items-end gap-6">
          <dl className="grid grid-cols-3 gap-4 text-left">
            <Fact label="Lessons" value={cert.lessons} />
            <Fact label="Exercises" value={cert.exercises} />
            <Fact label="XP" value={cert.total_xp} />
          </dl>
          <Seal hours={hours} />
          <div className="space-y-3 text-right">
            <div>
              <p className="font-serif text-[clamp(12px,1.5vw,18px)] text-zinc-900">{date}</p>
              <div className="mt-1 ml-auto h-px w-40 max-w-full bg-zinc-300" />
              <p className="mt-1 text-[clamp(8px,0.9vw,11px)] tracking-wider text-zinc-500 uppercase">Date completed</p>
            </div>
            <p className="font-mono text-[clamp(8px,0.9vw,11px)] text-zinc-500">
              Certificate ID <span className="text-zinc-700">{cert.id}</span>
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="text-[clamp(14px,2vw,24px)] font-semibold text-zinc-900 tabular-nums">{value.toLocaleString()}</dd>
      <dt className="text-[clamp(8px,0.9vw,11px)] tracking-wider text-zinc-500 uppercase">{label}</dt>
    </div>
  )
}

function Seal({ hours }: { hours: number }) {
  const ticks = 36
  return (
    <svg viewBox="0 0 120 120" className="size-[clamp(72px,11vw,128px)]" role="img" aria-label="Verified seal">
      <defs>
        <linearGradient id="seal-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#c026d3" />
        </linearGradient>
      </defs>
      <path
        d={Array.from({ length: ticks * 2 }, (_, i) => {
          const a = (i / (ticks * 2)) * Math.PI * 2
          const r = i % 2 ? 54 : 58
          return `${i ? "L" : "M"}${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`
        }).join(" ") + "Z"}
        fill="url(#seal-fill)"
      />
      <circle cx="60" cy="60" r="44" fill="none" stroke="#fff" strokeOpacity="0.6" strokeDasharray="2 3" />
      <text x="60" y="54" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" letterSpacing="1.5">
        VERIFIED
      </text>
      <text x="60" y="72" textAnchor="middle" fill="#fff" fontSize="9" opacity="0.9">
        {`~${hours} hr${hours === 1 ? "" : "s"} of work`}
      </text>
    </svg>
  )
}
