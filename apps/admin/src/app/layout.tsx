import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import './globals.css'
import { PolarisProvider } from '@/components/polaris-provider'

export const metadata: Metadata = { title: 'Admin' }

const sans = Inter({ subsets: ['latin'], variable: '--font-primary' })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PolarisProvider>{children}</PolarisProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
