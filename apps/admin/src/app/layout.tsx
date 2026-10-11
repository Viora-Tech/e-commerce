import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Sans, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import { ThemeProvider } from 'next-themes'
import { NuqsAdapter } from 'nuqs/adapters/next/app'
import type { ReactNode } from 'react'
import './globals.css'
import LocaleProvider from '@/components/layout/locale-provider'
import MotionProvider from '@/components/layout/motion-provider'
import { layoutContent } from '@/data/layout'
import { localize } from '@/lib/copy'
import { getLocale, getRegion } from '@/lib/copy-server'
import { NONCE_HEADER } from '@/lib/csp'

export const metadata: Metadata = { title: 'Admin' }

/* Fonts match Proofly: variable DM Sans / Bricolage Grotesque (every weight, no static list)
   and Geist Mono for numbers and code. */
/* DM Sans (SIL OFL 1.1): every UI string. */
const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

/* Bricolage Grotesque (SIL OFL 1.1): page titles and big numbers only. */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display-face',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

/* Geist Mono (SIL OFL 1.1): code, ids and tabular numbers. */
const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono-code',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
})

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The admin language comes from a cookie and is read here, on the server, so the first
  // paint is already in it (no flash) and client components get it through LocaleProvider.
  const locale = await getLocale()
  const region = await getRegion()
  const copy = localize(layoutContent, locale)
  // The script CSP's nonce for this request (`proxy.ts`): next-themes' no-flash script needs it.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined

  return (
    <html
      lang={locale}
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      {/* Extensions such as Grammarly write attributes onto <body> before React hydrates
          (data-gr-ext-installed, an inline margin). This only silences <body>'s own
          attributes; everything inside it is still checked. */}
      <body
        className="min-h-svh bg-sidebar font-sans text-body text-foreground antialiased"
        suppressHydrationWarning
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {copy.skipToContent}
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
          <NuqsAdapter>
            <LocaleProvider locale={locale} region={region}>
              <MotionProvider>{children}</MotionProvider>
            </LocaleProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  )
}
