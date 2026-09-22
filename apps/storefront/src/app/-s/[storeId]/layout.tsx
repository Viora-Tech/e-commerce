import { Footer, Header } from '@commerce/blocks'
import { loadEnv } from '@commerce/config'
import {
  CONSENT_COOKIE,
  decodeConsent,
  getCart,
  getTheme,
  liveThemeSettings,
  parseNavigationSettings,
  parsePreferences,
  themeRootAttrs,
  themeToCss,
  toFooterColumns,
  toNavLinks,
} from '@commerce/core'
import { navigationMenu, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import VisitBeacon from '@/components/analytics/visit-beacon'
import ConsentManager from '@/components/privacy/consent-manager'
import PreviewBar from '@/components/theme/preview-bar'
import ThemePreviewBridge from '@/components/theme/theme-preview-bridge'
import { readCartId } from '@/lib/cart-cookie'
import { themeFontVariables } from '@/lib/fonts'
import { inStore } from '@/lib/store-context'
import { readPreview } from '@/lib/storefront-gate'
import { htmlThemeAttr, parseThemeMode, THEME_COOKIE } from '@/lib/theme-mode'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

/** The theme preview the proxy verified and forwarded, if any. */
async function previewRequest(storeId: string) {
  const h = await headers()
  const preview = readPreview(storeId, h.get('x-theme-preview'))
  return preview ? { ...preview, inFrame: h.get('sec-fetch-dest') === 'iframe' } : null
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { storeId } = await params
  const [s] = await inStore(storeId, (tx) =>
    tx
      .select({ name: store.name, preferences: store.preferences })
      .from(store)
      .where(eq(store.id, storeId)),
  )
  if (!s) return {}
  const { seo } = parsePreferences(s.preferences)
  const title = seo.title || s.name
  const description = seo.description || undefined
  const images = seo.image ? [{ url: seo.image.url, alt: seo.imageAlt || title }] : undefined
  return {
    title: { default: title, template: `%s | ${s.name}` },
    description,
    openGraph: { type: 'website', siteName: s.name, title, description, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images },
    // A preview renders an unpublished theme; keep it out of every index.
    ...((await previewRequest(storeId)) ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function StoreLayout({ children, params }: Props) {
  const { storeId } = await params
  const preview = await previewRequest(storeId)
  const { current, menus, theme, previewName } = await inStore(storeId, async (tx) => {
    const [s] = await tx.select().from(store).where(eq(store.id, storeId))
    const rows = await tx.select().from(navigationMenu)
    const previewed = preview?.themeId ? await getTheme(tx, preview.themeId) : null
    return {
      current: s,
      menus: rows,
      theme: previewed?.settings ?? (await liveThemeSettings(tx, storeId)),
      previewName: previewed && previewed.role !== 'main' ? previewed.name : null,
    }
  })

  if (!current) notFound()

  const cartId = await readCartId()
  const cartCount = cartId
    ? await inStore(storeId, async (tx) => (await getCart({ storeId, tx }, cartId))?.itemCount ?? 0)
    : 0
  const jar = await cookies()
  const mode = parseThemeMode(jar.get(THEME_COOKIE)?.value, theme.darkMode.default)
  const prefs = parsePreferences(current.preferences)
  const adminOrigin = new URL(loadEnv(process.env).ADMIN_URL).origin

  // Which menus to render comes from the store setting; the menus themselves are
  // rows. A handle that points at nothing renders nothing rather than a broken link.
  const settings = parseNavigationSettings(current.navigation)
  const menusByHandle = new Map(menus.map((menu) => [menu.handle, menu]))
  const mainMenu = settings.main === null ? undefined : menusByHandle.get(settings.main)
  const navLinks = toNavLinks(mainMenu?.items ?? [])
  // A nested footer menu splits into one column per parent, as Shopify's does.
  const footerColumns = settings.footer.flatMap((handle) => {
    const menu = menusByHandle.get(handle)
    return menu ? toFooterColumns(menu, menu.items) : []
  })

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
      <body>
        {previewName && !preview?.inFrame ? <PreviewBar themeName={previewName} /> : null}
        <Header
          storeName={current.name}
          links={navLinks}
          themeMode={mode}
          showThemeToggle={theme.darkMode.enabled && theme.darkMode.togglePosition === 'header'}
          cartCount={cartCount}
          logo={
            theme.brand.logo ? { url: theme.brand.logo.url, width: theme.brand.logoWidth } : null
          }
        />
        <main id="MainContent">{children}</main>
        <VisitBeacon />
        <ThemePreviewBridge storeId={storeId} adminOrigin={adminOrigin} />
        {preview ? null : (
          <ConsentManager
            privacy={prefs.privacy}
            tracking={prefs.tracking}
            initial={decodeConsent(jar.get(CONSENT_COOKIE)?.value)}
          />
        )}
        <Footer
          storeName={current.name}
          tagline="Gaming peripherals built for the grind."
          columns={footerColumns}
        />
      </body>
    </html>
  )
}
