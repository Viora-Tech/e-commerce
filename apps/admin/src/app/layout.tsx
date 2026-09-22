import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { ReactNode } from 'react'
import './globals.css'
import { layoutContent } from '@/data/layout'

export const metadata: Metadata = { title: 'Admin' }

/* Satoshi (Fontshare, ITF FFL) self-hosted from public/fonts/satoshi; weight axis 300 to 900. */
const sans = localFont({
  src: [
    { path: '../../public/fonts/satoshi/Satoshi-Variable.woff2', style: 'normal' },
    { path: '../../public/fonts/satoshi/Satoshi-VariableItalic.woff2', style: 'italic' },
  ],
  weight: '300 900',
  variable: '--font-primary',
  display: 'swap',
  fallback: ['Inter', 'system-ui', 'sans-serif'],
})

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans text-body text-foreground antialiased">
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
