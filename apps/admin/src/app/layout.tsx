import { loadEnv } from '@commerce/config'
import { browserSentryMeta } from '@commerce/observability'
import type { Metadata } from 'next'
import { Geist_Mono, Noto_Sans_Devanagari, Plus_Jakarta_Sans } from 'next/font/google'
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

/* Fonts match the Koomerce Figma kit: variable Plus Jakarta Sans for everything (titles and big
   numbers too), a Devanagari partner for Hindi, and Geist Mono for eyebrows, keys and code. */
/* Plus Jakarta Sans (SIL OFL 1.1): every UI string. */
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

/* Noto Sans Devanagari (SIL OFL 1.1): Hindi glyphs, which Plus Jakarta Sans doesn't have. Its
   unicode-range keeps it off the wire for English pages, so it isn't preloaded. */
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
  preload: false,
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
  // The DSN, environment and release for browser error reporting, read per request (the image
  // is built once, env is set at deploy); `instrumentation-client.ts` reads it back.
  const sentry = browserSentryMeta(loadEnv(process.env))

  return (
    <html
      lang={locale}
      className={`${sans.variable} ${devanagari.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      {/* Extensions such as Grammarly write attributes onto <body> before React hydrates
          (data-gr-ext-installed, an inline margin). This only silences <body>'s own
          attributes; everything inside it is still checked. */}
      <body
        className="min-h-svh bg-sidebar font-sans text-body text-foreground antialiased"
        suppressHydrationWarning
      >
        {/* React hoists this into <head>. */}
        {sentry ? <meta name={sentry.name} content={sentry.content} /> : null}
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
