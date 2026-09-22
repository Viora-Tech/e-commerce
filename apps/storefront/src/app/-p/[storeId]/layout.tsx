import { liveThemeSettings, themeRootAttrs, themeToCss } from '@commerce/core'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { themeFontVariables } from '@/lib/fonts'
import { inStore } from '@/lib/store-context'
import { htmlThemeAttr, parseThemeMode, THEME_COOKIE } from '@/lib/theme-mode'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** The locked storefront's own document, painted in the live theme. The proxy routes here. */
export default async function PasswordLayout({ children, params }: Props) {
  const { storeId } = await params
  const theme = await inStore(storeId, (tx) => liveThemeSettings(tx, storeId))
  const mode = parseThemeMode((await cookies()).get(THEME_COOKIE)?.value, theme.darkMode.default)

  return (
    <html
      lang="en"
      data-theme={htmlThemeAttr(mode)}
      className={themeFontVariables}
      {...themeRootAttrs(theme)}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is built only from ThemeSchema-validated hex colours, numbers and enums; no free-form user string reaches it. */}
        <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
        {theme.brand.favicon ? <link rel="icon" href={theme.brand.favicon.url} /> : null}
      </head>
      <body>{children}</body>
    </html>
  )
}
