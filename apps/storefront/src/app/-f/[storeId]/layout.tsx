import '../portal.css'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import type { ReactNode } from 'react'
import { affiliatePortalContent as copy } from '@/data/affiliate-portal'
import { portalStore } from '@/lib/affiliate-portal'
import { NONCE_HEADER } from '@/lib/csp'
import { PORTAL_THEME_COOKIE, portalThemeClass } from '@/lib/portal-theme'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

/* Plus Jakarta Sans (SIL OFL 1.1), the admin's face: the portal is our app, not the theme. */
const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-primary',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

/** Before paint: the system's dark setting when the affiliate has not picked light or dark. */
const SYSTEM_THEME = `if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { storeId } = await params
  const store = await portalStore(storeId)
  return {
    title: { default: copy.metaTitle(store.name), template: `%s · ${copy.metaTitle(store.name)}` },
    robots: { index: false, follow: false },
  }
}

/**
 * The affiliate portal's document (`affiliate.<store domain>` or `/affiliate`): our shadcn look
 * from `@commerce/ui`, light or dark, with none of the store's theme, header or footer.
 */
export default async function PortalLayout({ children }: Props) {
  // Hooks
  const saved = (await cookies()).get(PORTAL_THEME_COOKIE)?.value
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined

  // Render logic
  const theme = portalThemeClass(saved)
  return (
    <html lang="en" className={`${sans.variable} ${theme ?? ''}`} suppressHydrationWarning>
      <head>
        {theme === null ? (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, no input
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SYSTEM_THEME }} />
        ) : null}
      </head>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
