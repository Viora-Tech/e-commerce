import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { ReactNode } from 'react'
import './globals.css'
import { layoutContent } from '@/data/layout'

export const metadata: Metadata = { title: 'Admin' }

/* Geist (SIL OFL 1.1), Vercel's UI face; variable weights. */
const sans = Geist({
  subsets: ['latin'],
  variable: '--font-primary',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      {/* Extensions such as Grammarly write attributes onto <body> before React hydrates
          (data-gr-ext-installed, an inline margin). This only silences <body>'s own
          attributes; everything inside it is still checked. */}
      <body
        className="min-h-svh bg-background font-sans text-body text-foreground antialiased"
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {layoutContent.skipToContent}
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NuqsAdapter>{children}</NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  )
}
