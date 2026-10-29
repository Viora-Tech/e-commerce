import { siteConfig } from '@commerce/config/site'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Noto_Sans_Devanagari, Plus_Jakarta_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'
import CursorLight from '@/components/common/cursor-light'
import JsonLd from '@/components/common/json-ld'
import ConsentProvider from '@/components/consent/consent-provider'
import { organizationLd, websiteLd } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.urls.site),
  title: {
    default: `${siteConfig.brand.name}: AI e-commerce platform for Indian brands`,
    template: `%s · ${siteConfig.brand.name}`,
  },
  description: siteConfig.brand.tagline,
  applicationName: siteConfig.brand.name,
  publisher: siteConfig.brand.name,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // Search Console and Bing Webmaster: set the tokens in Vercel when verifying by meta tag.
  verification: {
    ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { other: { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
      : {}),
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
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
      lang="en-IN"
      className={`dark ${sans.variable} ${devanagari.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh overflow-x-clip bg-background font-sans text-body text-foreground antialiased print:bg-white print:text-black">
        <JsonLd data={[organizationLd(), websiteLd()]} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
        >
          Skip to content
        </a>
        <CursorLight />
        <ConsentProvider>{children}</ConsentProvider>
      </body>
    </html>
  )
}
