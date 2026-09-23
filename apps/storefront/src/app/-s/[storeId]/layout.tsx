import { CursorFill, Footer, Header } from '@commerce/blocks'
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
import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import VisitBeacon from '@/components/analytics/visit-beacon'
import ConsentManager from '@/components/privacy/consent-manager'
import PredictiveSearch from '@/components/search/predictive-search'
import PreviewBar from '@/components/theme/preview-bar'
import ThemePreviewBridge from '@/components/theme/theme-preview-bridge'
import { searchContent } from '@/data/search'
import { readCartId } from '@/lib/cart-cookie'
import { themeFontVariables } from '@/lib/fonts'
import { requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { readPreview } from '@/lib/storefront-gate'
import { renderTemplate } from '@/lib/template-render'
import { htmlThemeAttr, resolveThemeMode, THEME_COOKIE, themeViewport } from '@/lib/theme-mode'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

/** The theme preview the proxy verified and forwarded, if any. */
async function previewRequest(storeId: string) {
  const h = await headers()
  const preview = readPreview(storeId, h.get('x-theme-preview'))
  return preview ? { ...preview, inFrame: h.get('sec-fetch-dest') === 'iframe' } : null
}

/** The Header section's menu, or the Navigation setting's main menu when it names none. */
function menuLinks(
  menus: Map<string, { items: Parameters<typeof toNavLinks>[0] }>,
  handle: unknown,
  fallback: string | null,
) {
  const picked = typeof handle === 'string' && handle ? handle : fallback
  const menu = picked === null ? undefined : menus.get(picked)
  return toNavLinks(menu?.items ?? [])
}

/** Browser chrome and colour-scheme hint in the mode this request renders. */
export async function generateViewport({ params }: Pick<Props, 'params'>): Promise<Viewport> {
  const { storeId } = await params
  const theme = await inStore(storeId, (tx) => liveThemeSettings(tx, storeId))
  const mode = resolveThemeMode((await cookies()).get(THEME_COOKIE)?.value, theme.darkMode)
  return themeViewport(theme, mode)
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
    // Canonical and Open Graph URLs are paths; they resolve against the host being served.
    metadataBase: new URL(await requestOrigin()),
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
  const mode = resolveThemeMode(jar.get(THEME_COOKIE)?.value, theme.darkMode)
  const prefs = parsePreferences(current.preferences)
  const adminOrigin = new URL(loadEnv(process.env).ADMIN_URL).origin

  // Which menus to render comes from the store setting; the menus themselves are
  // rows. A handle that points at nothing renders nothing rather than a broken link.
  const settings = parseNavigationSettings(current.navigation)
  const menusByHandle = new Map(menus.map((menu) => [menu.handle, menu]))
  // A nested footer menu splits into one column per parent, as Shopify's does.
  const footerColumns = settings.footer.flatMap((handle) => {
    const menu = menusByHandle.get(handle)
    return menu ? toFooterColumns(menu, menu.items) : []
  })

  // The header and footer are the theme's section groups: announcement bars and
  // signups sit around the Header and Footer sections, which draw the store's menus.
  const header = await inStore(storeId, (tx) =>
    renderTemplate(tx, storeId, 'header', {
      renderers: {
        Header: (s) => (
          <Header
            storeName={current.name}
            links={menuLinks(menusByHandle, s.menu, settings.main)}
            themeMode={mode}
            showThemeToggle={theme.darkMode.enabled && theme.darkMode.togglePosition === 'header'}
            cartCount={cartCount}
            search={<PredictiveSearch label={searchContent.title} />}
            logo={
              theme.brand.logo ? { url: theme.brand.logo.url, width: theme.brand.logoWidth } : null
            }
          />
        ),
      },
    }),
  )
  const footer = await inStore(storeId, (tx) =>
    renderTemplate(tx, storeId, 'footer', {
      renderers: {
        Footer: (s) => (
          <Footer
            storeName={current.name}
            tagline={typeof s.tagline === 'string' ? s.tagline : ''}
            columns={footerColumns}
            themeToggle={
              theme.darkMode.enabled && theme.darkMode.togglePosition === 'footer' ? mode : null
            }
          />
        ),
      },
    }),
  )

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
        {header}
        <main id="MainContent">{children}</main>
        <VisitBeacon />
        <CursorFill />
        <ThemePreviewBridge storeId={storeId} adminOrigin={adminOrigin} />
        {preview ? null : (
          <ConsentManager
            privacy={prefs.privacy}
            tracking={prefs.tracking}
            initial={decodeConsent(jar.get(CONSENT_COOKIE)?.value)}
          />
        )}
        {footer}
      </body>
    </html>
  )
}
