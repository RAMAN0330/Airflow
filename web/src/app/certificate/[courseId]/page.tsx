import type { Metadata } from "next"

import { CertificateView } from "@/components/certificate/certificate-view"

export const metadata: Metadata = { title: "Certificate" }

export default async function CertificatePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  return <CertificateView courseId={courseId} />
}
