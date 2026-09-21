import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import './globals.css'
import { PolarisProvider } from '@/components/polaris-provider'
import { layoutContent } from '@/data/layout'

export const metadata: Metadata = { title: 'Admin' }

const sans = Inter({ subsets: ['latin'], variable: '--font-primary' })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {layoutContent.skipToContent}
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PolarisProvider>{children}</PolarisProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
