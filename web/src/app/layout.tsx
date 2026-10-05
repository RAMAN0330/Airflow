import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import { MotionProviders } from "@/components/motion/providers"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Gradient: Learn ML by building it", template: "%s · Gradient" },
  description:
    "Interactive ML/AI practice platform. Implement gradient descent, activations and self-attention from scratch, graded by hidden tests in a sandbox.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>
            <MotionProviders>
              <SiteHeader />
              <main className="flex flex-1 flex-col">{children}</main>
              <Toaster position="bottom-right" richColors closeButton />
            </MotionProviders>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
