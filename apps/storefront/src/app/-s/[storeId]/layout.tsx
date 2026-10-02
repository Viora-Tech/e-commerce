import {
  CursorFill,
  cookieBannerSettings,
  Footer,
  footerSettings,
  Header,
  headerSettings,
  searchShortcuts,
} from '@commerce/blocks'
import { loadEnv } from '@commerce/config'
import {
  CONSENT_COOKIE,
  currentConsent,
  decodeConsent,
  getCart,
  getTheme,
  grievanceOfficerOf,
  liveThemeSettings,
  mainThemeId,
  parseCustomerPrivacySettings,
  parseNavigationSettings,
  parsePreferences,
  publishedPolicyLinks,
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
import StoreChrome from '@/components/checkout/store-chrome'
import ConsentManager from '@/components/privacy/consent-manager'
import PredictiveSearch from '@/components/search/predictive-search'
import PreviewBar from '@/components/theme/preview-bar'
import LiquidHtml from '@/components/theme/liquid-html'
import ThemePreviewBridge from '@/components/theme/theme-preview-bridge'
import { policyPageContent } from '@/data/policies'
import { privacyContent } from '@/data/privacy'
import { searchContent } from '@/data/search'
import { readCartId } from '@/lib/cart-cookie'
import { listCollections } from '@/lib/collections'
import { COOKIE_SETTINGS_HASH } from '@/lib/cookie-settings'
import { NONCE_HEADER } from '@/lib/csp'
import { themeFontVariables } from '@/lib/fonts'
import { liquidContextFor, liquidLayoutFor, reactAttrs } from '@/lib/liquid-theme'
import { liquidShim } from '@/lib/liquid-shim'
import { mediaByUrl } from '@/lib/media-lookup'
import { heightForWidth } from '@/lib/section-images'
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
  const { current, menus, policies, theme, previewName, logoHeight } = await inStore(
    storeId,
    async (tx) => {
      const [s] = await tx.select().from(store).where(eq(store.id, storeId))
      const rows = await tx.select().from(navigationMenu)
      const previewed = preview?.themeId ? await getTheme(tx, preview.themeId) : null
      const settings = previewed?.settings ?? (await liveThemeSettings(tx, storeId))
      const logo = settings.brand.logo
      return {
        current: s,
        menus: rows,
        policies: await publishedPolicyLinks({ tx, storeId }),
        theme: settings,
        previewName: previewed && previewed.role !== 'main' ? previewed.name : null,
        // The logo's real aspect ratio, so the header reserves its height before it loads.
        logoHeight: logo
          ? heightForWidth(
              (await mediaByUrl(tx, [logo.url])).get(logo.url),
              settings.brand.logoWidth,
            )
          : undefined,
      }
    },
  )

  if (!current) notFound()

  // An imported Shopify theme draws its own page shell (`layout/theme.liquid`): its
  // stylesheets, icon sprites, cart drawer and scripts around our <main>.
  const liquid = await inStore(storeId, async (tx) => {
    const themeId = preview?.themeId ?? (await mainThemeId(tx))
    const ctx = themeId ? await liquidContextFor(tx, storeId, themeId) : null
    return ctx ? liquidLayoutFor(ctx) : null
  })

  const cartId = await readCartId()
  const cartCount = cartId
    ? await inStore(storeId, async (tx) => (await getCart({ storeId, tx }, cartId))?.itemCount ?? 0)
    : 0
  const jar = await cookies()
  const mode = resolveThemeMode(jar.get(THEME_COOKIE)?.value, theme.darkMode)
  const prefs = parsePreferences(current.preferences)
  const privacy = parseCustomerPrivacySettings(current.preferences)
  const officer = grievanceOfficerOf(current.preferences)
  const adminOrigin = new URL(loadEnv(process.env).ADMIN_URL).origin
  // The script CSP's nonce for this request (`proxy.ts`); the tracking tags carry it.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined

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
  // The store's collections give the menu its card images and the search its brand pills.
  const header = await inStore(storeId, async (tx) => {
    const collections = await listCollections(tx)
    return renderTemplate(tx, storeId, 'header', {
      renderers: {
        Header: (s) => {
          const hs = headerSettings(s)
          const links = menuLinks(menusByHandle, hs.menu, settings.main)
          const { popular, brands } = searchShortcuts(
            hs.popularTerms,
            hs.brandCollections,
            links,
            collections,
          )
          return (
            <Header
              storeName={current.name}
              links={links}
              themeMode={mode}
              showThemeToggle={theme.darkMode.enabled && theme.darkMode.togglePosition === 'header'}
              cartCount={cartCount}
              search={
                <PredictiveSearch label={searchContent.title} popular={popular} brands={brands} />
              }
              logo={
                theme.brand.logo
                  ? { url: theme.brand.logo.url, width: theme.brand.logoWidth, height: logoHeight }
                  : null
              }
              settings={hs}
              collections={collections}
            />
          )
        },
      },
    })
  })
  // The consent banner and the tags it gates. Never in a theme preview, where nobody is
  // being tracked. When the footer group holds a CookieBanner section, that section draws
  // it in the theme's look; otherwise the standalone one below does, so there is always
  // exactly one.
  const consent = {
    tracking: prefs.tracking,
    bannerMessage: privacy.bannerMessage,
    bannerVersion: privacy.bannerVersion,
    initial: decodeConsent(jar.get(CONSENT_COOKIE)?.value),
    nonce,
  }
  let themedConsent = false
  let consentDrawn = false
  const footer = await inStore(storeId, (tx) =>
    renderTemplate(tx, storeId, 'footer', {
      // The mobile dock's cart count.
      appBlockContext: { cartCount },
      onSections: (types) => {
        // The theme's own cookie banner (ours or an imported one) replaces the standalone one.
        themedConsent = types.has('CookieBanner') || types.has('LiquidSection:cookie-banner')
      },
      renderers: {
        Footer: (s) => (
          <Footer
            {...footerSettings(s)}
            storeName={current.name}
            columns={footerColumns}
            policies={policies.map((p) => ({ label: p.title, href: p.href }))}
            // Reopens the cookie banner, so a choice can be changed any time.
            cookieSettings={{ label: privacyContent.cookieSettings, href: COOKIE_SETTINGS_HASH }}
            grievance={officer ? policyPageContent.grievance(officer) : null}
            themeToggle={
              theme.darkMode.enabled && theme.darkMode.togglePosition === 'footer' ? mode : null
            }
            logo={
              theme.brand.logo
                ? { url: theme.brand.logo.url, width: theme.brand.logoWidth, height: logoHeight }
                : null
            }
          />
        ),
        CookieBanner: (s) => {
          // A second CookieBanner section (it is single in Customize, but saved data is data)
          // must not ask twice.
          if (preview || consentDrawn) return null
          consentDrawn = true
          return <ConsentManager {...consent} appearance={cookieBannerSettings(s)} />
        },
      },
    }),
  )

  if (liquid) {
    return (
      <html lang="en" {...reactAttrs(liquid.htmlAttrs)} suppressHydrationWarning>
        <head>
          {liquid.fontsHref ? <link rel="stylesheet" href={liquid.fontsHref} /> : null}
          {theme.brand.favicon ? <link rel="icon" href={theme.brand.favicon.url} /> : null}
        </head>
        <body {...reactAttrs(liquid.bodyAttrs)} suppressHydrationWarning>
          <LiquidHtml
            html={`<script${nonce ? ` nonce="${nonce}"` : ''}>${liquidShim({ askConsent: currentConsent(consent.initial, consent.bannerVersion) === null })}</script>${liquid.head}`}
          />
          {previewName && !preview?.inFrame ? <PreviewBar themeName={previewName} /> : null}
          <LiquidHtml html={liquid.beforeHeader} />
          {header}
          <main id="MainContent" role="main" tabIndex={-1} {...reactAttrs(liquid.mainAttrs)}>
            {children}
          </main>
          {footer}
          <LiquidHtml html={liquid.afterFooter} />
          <ThemePreviewBridge adminOrigin={adminOrigin} />
          {preview ? null : <ConsentManager {...consent} themeBanner={themedConsent} />}
        </body>
      </html>
    )
  }

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
        <StoreChrome>{header}</StoreChrome>
        <main id="MainContent">{children}</main>
        <StoreChrome>
          <CursorFill />
        </StoreChrome>
        <ThemePreviewBridge adminOrigin={adminOrigin} />
        {preview || themedConsent ? null : <ConsentManager {...consent} />}
        <StoreChrome>{footer}</StoreChrome>
      </body>
    </html>
  )
}
