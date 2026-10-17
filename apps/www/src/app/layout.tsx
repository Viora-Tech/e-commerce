import { siteConfig } from '@commerce/config/site'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Noto_Sans_Devanagari, Plus_Jakarta_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'
import ConsentProvider from '@/components/consent/consent-provider'
import WaitlistProvider from '@/components/waitlist/waitlist-provider'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.urls.site),
  title: { default: siteConfig.brand.name, template: `%s · ${siteConfig.brand.name}` },
  description: siteConfig.brand.tagline,
}

export const viewport: Viewport = { themeColor: '#0a0a0a', colorScheme: 'dark' }

/* Fonts match the Figma kit and the admin: Plus Jakarta Sans for text and titles, a Devanagari
   partner for Hindi, Geist Mono for eyebrows (SIL OFL 1.1). */
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
  preload: false,
})
const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono-code',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
})

type RootLayoutProps = { children: ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${devanagari.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh bg-background font-sans text-body text-foreground antialiased print:bg-white print:text-black">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
        >
          Skip to content
        </a>
        <WaitlistProvider>
          <ConsentProvider>{children}</ConsentProvider>
        </WaitlistProvider>
      </body>
    </html>
  )
}
