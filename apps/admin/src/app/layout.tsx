import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import './globals.css'
import '@shopify/polaris/build/esm/styles.css'
import { PolarisProvider } from '@/components/polaris-provider'

export const metadata: Metadata = { title: 'Admin' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-svh bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PolarisProvider>{children}</PolarisProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
