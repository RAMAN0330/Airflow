import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import { CommandPalette } from "@/components/command-palette"
import { MotionProviders } from "@/components/motion/providers"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BRAND } from "@/lib/brand"

import "./globals.css"

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
  openGraph: { title: BRAND.name, description: BRAND.tagline, siteName: BRAND.name, type: "website" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfe" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b17" },
  ],
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
              <CommandPalette />
              <Toaster position="bottom-right" richColors closeButton />
            </MotionProviders>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
