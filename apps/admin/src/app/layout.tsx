import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import './globals.css'
import '@shopify/polaris/build/esm/styles.css'
import { PolarisProvider } from '@/components/polaris-provider'

export const metadata: Metadata = { title: 'Admin' }

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-primary' })

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
