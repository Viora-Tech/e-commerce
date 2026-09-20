import { Footer, Header } from '@commerce/blocks'
import { parseTheme, themeToCss } from '@commerce/core'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { archivo, figtree, fontVar } from '@/lib/fonts'
import { inStore } from '@/lib/store-context'
import { htmlThemeAttr, parseThemeMode, THEME_COOKIE } from '@/lib/theme-mode'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

const NAV = [
  { label: 'Mice', href: '/collections/mice' },
  { label: 'Mousepads', href: '/collections/mousepads' },
  { label: 'Glasspads', href: '/collections/glass-mousepads' },
  { label: 'Keyboards', href: '/collections/keyboards' },
  { label: 'Guides', href: '/guides' },
]

export default async function StoreLayout({ children, params }: Props) {
  const { storeId } = await params
  const current = await inStore(storeId, async (tx) => {
    const [s] = await tx.select().from(store).where(eq(store.id, storeId))
    return s
  })
  if (!current) notFound()

  const theme = parseTheme(current.theme)
  const mode = parseThemeMode((await cookies()).get(THEME_COOKIE)?.value, theme.darkMode.default)
  const fontStyle = `:root{--font-heading:${fontVar[theme.fonts.heading]};--font-body:${fontVar[theme.fonts.body]}}`

  return (
    <html
      lang="en"
      data-theme={htmlThemeAttr(mode)}
      className={`${archivo.variable} ${figtree.variable}`}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS is built only from ThemeSchema-validated hex colours and enums; no user string reaches it. */}
        <style dangerouslySetInnerHTML={{ __html: `${themeToCss(theme)}\n${fontStyle}` }} />
      </head>
      <body>
        <Header
          storeName={current.name}
          links={NAV}
          themeMode={mode}
          showThemeToggle={theme.darkMode.enabled && theme.darkMode.togglePosition === 'header'}
        />
        <main id="MainContent">{children}</main>
        <Footer
          storeName={current.name}
          tagline="Gaming peripherals built for the grind."
          columns={[
            {
              heading: 'Shop',
              links: [
                { label: 'Mice', href: '/collections/mice' },
                { label: 'Mousepads', href: '/collections/mousepads' },
                { label: 'Glasspads', href: '/collections/glass-mousepads' },
                { label: 'Preorders', href: '/collections/preorder' },
              ],
            },
            {
              heading: 'Help',
              links: [
                { label: 'Track order', href: '/track' },
                { label: 'Shipping', href: '/policies/shipping' },
                { label: 'Returns', href: '/policies/returns' },
                { label: 'Contact', href: '/pages/contact' },
              ],
            },
            {
              heading: 'Community',
              links: [
                { label: 'Discord', href: 'https://discord.gg/waimers' },
                { label: 'Instagram', href: 'https://instagram.com/waimers' },
                { label: 'Mouse Notes', href: '/notes' },
              ],
            },
          ]}
        />
      </body>
    </html>
  )
}
