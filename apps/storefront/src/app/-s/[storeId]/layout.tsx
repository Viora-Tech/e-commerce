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
  getTheme,
  grievanceOfficerOf,
  liveThemeSettings,
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
import { browserSentryMeta } from '@commerce/observability'
import { eq } from 'drizzle-orm'
import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import StoreChrome from '@/components/checkout/store-chrome'
import ConsentManager from '@/components/privacy/consent-manager'
import PredictiveSearch from '@/components/search/predictive-search'
import LiquidBoot from '@/components/theme/liquid-boot'
import LiquidHtml from '@/components/theme/liquid-html'
import PreviewBar from '@/components/theme/preview-bar'
import ThemePreviewBridge from '@/components/theme/theme-preview-bridge'
import { policyPageContent } from '@/data/policies'
import { privacyContent } from '@/data/privacy'
import { searchContent } from '@/data/search'
import { liquidLayoutForPath } from '@/lib/checkout-path'
import { listCollections } from '@/lib/collections'
import { COOKIE_SETTINGS_HASH } from '@/lib/cookie-settings'
import { NONCE_HEADER } from '@/lib/csp'
import { themeFontVariables } from '@/lib/fonts'
import { liquidShim } from '@/lib/liquid-shim'
import { liquidLayoutFor, reactAttrs } from '@/lib/liquid-theme'
import { mediaByUrl } from '@/lib/media-lookup'
import { subscribeAction } from '@/lib/newsletter-actions'
import { requestCart } from '@/lib/request-cart'
import { heightForWidth } from '@/lib/section-images'
import { requestOrigin } from '@/lib/seo'
import { storeRead } from '@/lib/store-cache'
import { inStore } from '@/lib/store-context'
import { readPreview } from '@/lib/storefront-gate'
import { liveThemeId, renderTemplate } from '@/lib/template-render'
import { htmlThemeAttr, resolveThemeMode, THEME_COOKIE, themeViewport } from '@/lib/theme-mode'
import { umamiTrackerOf } from '@/lib/umami'

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

/** The live theme's settings, cached per store version. */
function liveTheme(storeId: string) {
  return storeRead(storeId, 'live-theme-settings', (tx) => liveThemeSettings(tx, storeId))
}

/** What every page's layout reads from the store, cached per store version. */
function layoutData(storeId: string) {
  return storeRead(storeId, 'layout', async (tx) => {
    const [s] = await tx
      .select({
        name: store.name,
        preferences: store.preferences,
        navigation: store.navigation,
        apps: store.apps,
      })
      .from(store)
      .where(eq(store.id, storeId))
    return {
      current: s ?? null,
      menus: await tx.select().from(navigationMenu),
      policies: await publishedPolicyLinks({ tx, storeId }),
    }
  })
}

/** Browser chrome and colour-scheme hint in the mode this request renders. */
export async function generateViewport({ params }: Pick<Props, 'params'>): Promise<Viewport> {
  const { storeId } = await params
  const theme = await liveTheme(storeId)
  const mode = resolveThemeMode((await cookies()).get(THEME_COOKIE)?.value, theme.darkMode)
  return themeViewport(theme, mode)
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { storeId } = await params
  const s = (await layoutData(storeId)).current
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
  const { current, menus, policies } = await layoutData(storeId)
  if (!current) notFound()
  const previewed = preview?.themeId
    ? await inStore(storeId, (tx) => getTheme(tx, preview.themeId as string))
    : null
  const theme = previewed?.settings ?? (await liveTheme(storeId))
  const previewName = previewed && previewed.role !== 'main' ? previewed.name : null
  // The logo's real aspect ratio, so the header reserves its height before it loads.
  const logo = theme.brand.logo
  const logoHeight = logo
    ? heightForWidth(
        (await storeRead(storeId, `media|${logo.url}`, (tx) => mediaByUrl(tx, [logo.url]))).get(
          logo.url,
        ),
        theme.brand.logoWidth,
      )
    : undefined

  // An imported Shopify theme draws its own page shell (`layout/theme.liquid`): its
  // stylesheets, icon sprites, cart drawer and scripts around our <main>. Never around the
  // locked checkout, which then also skips the theme's header and footer (`liquidLayoutForPath`).
  const pathname = (await headers()).get('x-pathname') ?? '/'
  const themeId = preview?.themeId ?? (await liveThemeId(storeId))
  const themeLayout = themeId ? await liquidLayoutFor(storeId, themeId) : null
  const liquid = liquidLayoutForPath(themeLayout, pathname)
  const themeChrome = liquid !== null || themeLayout === null

  const cartCount = (await requestCart(storeId))?.itemCount ?? 0
  const jar = await cookies()
  const mode = resolveThemeMode(jar.get(THEME_COOKIE)?.value, theme.darkMode)
  const prefs = parsePreferences(current.preferences)
  const privacy = parseCustomerPrivacySettings(current.preferences)
  const officer = grievanceOfficerOf(current.preferences)
  const env = loadEnv(process.env)
  const adminOrigin = new URL(env.ADMIN_URL).origin
  // The DSN, environment and release for browser error reporting, read per request (the image
  // is built once, env is set at deploy); `instrumentation-client.ts` reads it back.
  const sentry = browserSentryMeta(env)
  const sentryMeta = sentry ? <meta name={sentry.name} content={sentry.content} /> : null
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
  const collections = themeChrome
    ? await storeRead(storeId, 'collections', (tx) => listCollections(tx))
    : []
  const headerGroup = themeChrome
    ? renderTemplate(storeId, 'header', {
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
                showThemeToggle={
                  theme.darkMode.enabled && theme.darkMode.togglePosition === 'header'
                }
                cartCount={cartCount}
                search={
                  <PredictiveSearch label={searchContent.title} popular={popular} brands={brands} />
                }
                logo={
                  theme.brand.logo
                    ? {
                        url: theme.brand.logo.url,
                        width: theme.brand.logoWidth,
                        height: logoHeight,
                      }
                    : null
                }
                settings={hs}
                collections={collections}
              />
            )
          },
        },
      })
    : null
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
    umami: umamiTrackerOf(current.apps),
  }
  let themedConsent = false
  let consentDrawn = false
  // Without the theme's footer group (checkout under an imported theme) the standalone
  // ConsentManager below asks and runs the tags, so a purchase is still measured.
  const footerGroup = themeChrome
    ? renderTemplate(storeId, 'footer', {
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
              newsletterAction={subscribeAction}
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
      })
    : null
  // Header and footer render side by side.
  const [header, footer] = await Promise.all([headerGroup, footerGroup])

  if (liquid) {
    return (
      <html lang="en" {...reactAttrs(liquid.htmlAttrs)} suppressHydrationWarning>
        <head>
          {sentryMeta}
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
          <main id="MainContent" tabIndex={-1} {...reactAttrs(liquid.mainAttrs)}>
            {children}
          </main>
          {footer}
          <LiquidHtml html={liquid.afterFooter} />
          <LiquidBoot />
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
        {sentryMeta}
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
