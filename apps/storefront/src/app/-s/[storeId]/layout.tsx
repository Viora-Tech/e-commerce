import { Footer, Header } from '@commerce/blocks'
import {
  getCart,
  parseNavigationSettings,
  parseTheme,
  themeToCss,
  toFooterColumns,
  toNavLinks,
} from '@commerce/core'
import { navigationMenu, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import VisitBeacon from '@/components/analytics/visit-beacon'
import { readCartId } from '@/lib/cart-cookie'
import { archivo, figtree, fontVar } from '@/lib/fonts'
import { inStore } from '@/lib/store-context'
import { htmlThemeAttr, parseThemeMode, THEME_COOKIE } from '@/lib/theme-mode'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

export default async function StoreLayout({ children, params }: Props) {
  const { storeId } = await params
  const { current, menus } = await inStore(storeId, async (tx) => {
    const [s] = await tx.select().from(store).where(eq(store.id, storeId))
    const rows = await tx.select().from(navigationMenu)
    return { current: s, menus: rows }
  })

  if (!current) notFound()

  const cartId = await readCartId()
  const cartCount = cartId
    ? await inStore(storeId, async (tx) => (await getCart({ storeId, tx }, cartId))?.itemCount ?? 0)
    : 0
  const theme = parseTheme(current.theme)
  const mode = parseThemeMode((await cookies()).get(THEME_COOKIE)?.value, theme.darkMode.default)
  const fontStyle = `:root{--font-heading:${fontVar[theme.fonts.heading]};--font-body:${fontVar[theme.fonts.body]}}`

  // Which menus to render comes from the store setting; the menus themselves are
  // rows. A handle that points at nothing renders nothing rather than a broken link.
  const settings = parseNavigationSettings(current.navigation)
  const menusByHandle = new Map(menus.map((menu) => [menu.handle, menu]))
  const mainMenu = settings.main === null ? undefined : menusByHandle.get(settings.main)
  const navLinks = toNavLinks(mainMenu?.items ?? [])
  // A nested footer menu splits into one column per parent, as Shopify's does.
  const footerColumns = settings.footer.flatMap((handle) => {
    const menu = menusByHandle.get(handle)
    return menu ? toFooterColumns(menu.title, menu.items) : []
  })

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
          links={navLinks}
          themeMode={mode}
          showThemeToggle={theme.darkMode.enabled && theme.darkMode.togglePosition === 'header'}
          cartCount={cartCount}
        />
        <main id="MainContent">{children}</main>
        <VisitBeacon />
        <Footer
          storeName={current.name}
          tagline="Gaming peripherals built for the grind."
          columns={footerColumns}
        />
      </body>
    </html>
  )
}
