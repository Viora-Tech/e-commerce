import {
  CursorFill,
  cleanCustomCss,
  cookieBannerSettings,
  Footer,
  footerSettings,
  Header,
  headerSettings,
  MoneyFormatProvider,
  StoreActionsProvider,
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
  searchIndexable,
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
import { type ReactNode, Suspense } from 'react'
import ExperimentBeacon from '@/components/analytics/experiment-beacon'
import CartDrawer from '@/components/cart/cart-drawer'
import StoreChrome from '@/components/checkout/store-chrome'
import InboxLauncher from '@/components/inbox/inbox-launcher'
import ConsentManager from '@/components/privacy/consent-manager'
import PredictiveSearch from '@/components/search/predictive-search'
import AppEmbeds from '@/components/theme/app-embeds'
import LiquidBoot from '@/components/theme/liquid-boot'
import LiquidHtml from '@/components/theme/liquid-html'
import PreviewBar from '@/components/theme/preview-bar'
import ThemePreviewBridge from '@/components/theme/theme-preview-bridge'
import { collectionsContent } from '@/data/collections'
import { policyPageContent } from '@/data/policies'
import { privacyContent } from '@/data/privacy'
import { searchContent } from '@/data/search'
import { addLineAction } from '@/lib/cart-actions'
import { chatwootChatFor } from '@/lib/chatwoot'
import { liquidLayoutForPath } from '@/lib/checkout-path'
import { listCollections } from '@/lib/collections'
import { COOKIE_SETTINGS_HASH } from '@/lib/cookie-settings'
import { NONCE_HEADER } from '@/lib/csp'
import { requestExperiments } from '@/lib/experiments'
import { themeFontVariables } from '@/lib/fonts'
import { inboxLauncherOf } from '@/lib/inbox-launcher'
import { liquidShim } from '@/lib/liquid-shim'
import { liquidLayoutFor, reactAttrs } from '@/lib/liquid-theme'
import { mediaByUrl } from '@/lib/media-lookup'
import { subscribeAction } from '@/lib/newsletter-actions'
import { storePixels } from '@/lib/pixels/pixels'
import { requestCart } from '@/lib/request-cart'
import { heightForWidth } from '@/lib/section-images'
import { requestOrigin, verificationMeta } from '@/lib/seo'
import { storeRead } from '@/lib/store-cache'
import { inStore } from '@/lib/store-context'
import { readPreview } from '@/lib/storefront-gate'
import { liveThemeId, renderTemplate } from '@/lib/template-render'
import { htmlThemeAttr, resolveThemeMode, THEME_COOKIE, themeViewport } from '@/lib/theme-mode'
import { isRerender, RERENDER_COOKIE } from '@/lib/themed-rerender'
import { umamiTrackerOf } from '@/lib/umami'

type Props = { children: ReactNode; params: Promise<{ storeId: string }> }

/** The theme preview the proxy verified and forwarded, if any. */
async function previewRequest(storeId: string) {
  const h = await headers()
  const preview = readPreview(storeId, h.get('x-theme-preview'))
  return preview ? { ...preview, inFrame: h.get('sec-fetch-dest') === 'iframe' } : null
}

/**
 * The browser's second load of a not-found page under an imported theme (`lib/themed-rerender.ts`):
 * the page renders inside a Suspense boundary, so the theme's shell is rendered on the server.
 */
async function themedRerender() {
  const pathname = (await headers()).get('x-pathname') ?? '/'
  return isRerender((await cookies()).get(RERENDER_COOKIE)?.value, pathname)
}

/** Collections a store with no menu at all shows in its header, after "Shop all". */
const STARTER_MENU_COLLECTIONS = 4

/** A store with no footer menu yet gets two plain columns, so its footer is never blank. */
function starterFooterColumns(collections: readonly { handle: string; title: string }[]) {
  const copy = collectionsContent.starterFooter
  return [
    {
      id: 'starter-shop',
      heading: copy.shop,
      links: [
        { id: 'starter-all', label: collectionsContent.shopAll, href: '/collections/all' },
        ...collections.slice(0, STARTER_MENU_COLLECTIONS).map((c) => ({
          id: `starter-${c.handle}`,
          label: c.title,
          href: `/collections/${c.handle}`,
        })),
      ],
    },
    {
      id: 'starter-help',
      heading: copy.help,
      links: [
        { id: 'starter-search', label: copy.search, href: '/search' },
        { id: 'starter-track', label: copy.trackOrder, href: '/track-order' },
        { id: 'starter-account', label: copy.account, href: '/account' },
      ],
    },
  ]
}

/**
 * The Header section's menu, or the Navigation setting's main menu when it names none. A store
 * that has no such menu yet (a new store) gets Shopify's starter: Shop all and its first
 * collections, so the header is never empty. A menu the merchant emptied stays empty.
 */
function menuLinks(
  menus: Map<string, { items: Parameters<typeof toNavLinks>[0] }>,
  handle: unknown,
  fallback: string | null,
  collections: readonly { handle: string; title: string }[],
) {
  const picked = typeof handle === 'string' && handle ? handle : fallback
  const menu = picked === null ? undefined : menus.get(picked)
  if (menu) return toNavLinks(menu.items)
  return [
    { id: 'starter-all', label: collectionsContent.shopAll, href: '/collections/all' },
    ...collections.slice(0, STARTER_MENU_COLLECTIONS).map((c) => ({
      id: `starter-${c.handle}`,
      label: c.title,
      href: `/collections/${c.handle}`,
    })),
  ]
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
        moneyFormat: store.moneyFormat,
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
  const prefs = parsePreferences(s.preferences)
  const { seo } = prefs
  const title = seo.title || s.name
  const description = seo.description || undefined
  const images = seo.image ? [{ url: seo.image.url, alt: seo.imageAlt || title }] : undefined
  return {
    // Preferences › Search engine visibility: ownership tags for the search consoles and Meta.
    verification: verificationMeta(prefs.verification),
    // Canonical and Open Graph URLs are paths; they resolve against the host being served.
    metadataBase: new URL(await requestOrigin()),
    title: { default: title, template: `%s | ${s.name}` },
    description,
    openGraph: { type: 'website', siteName: s.name, title, description, images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images },
    // A preview renders an unpublished theme, and the themed reload a page that may be a 404
    // answered with 200: keep both out of every index. So is every page when the merchant
    // switched search indexing off (Preferences), matching robots.txt.
    ...(!searchIndexable(prefs) || (await previewRequest(storeId)) || (await themedRerender())
      ? { robots: { index: false, follow: false } }
      : {}),
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
  const hasFooterMenu = settings.footer.length > 0
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
            const links = menuLinks(menusByHandle, hs.menu, settings.main, collections)
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
  // The Inbox app's chat button: never in a theme preview, and only while the app is on.
  const inboxChat = preview ? null : inboxLauncherOf(current.apps)
  const consent = {
    tracking: prefs.tracking,
    bannerMessage: privacy.bannerMessage,
    bannerVersion: privacy.bannerVersion,
    initial: decodeConsent(jar.get(CONSENT_COOKIE)?.value),
    nonce,
    // The Pixels app's pixels (null without the app); never in a theme preview.
    pixels: preview ? null : await storePixels(storeId, current.apps),
    umami: umamiTrackerOf(current.apps),
    // Never in a theme preview (the consent manager is not drawn there either). When the
    // Inbox app is installed its own chat wins and Chatwoot's is not drawn.
    chatwoot: preview || inboxChat ? null : await chatwootChatFor(storeId, current.apps),
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
          Footer: (s) => {
            const settings = footerSettings(s)
            return (
              <Footer
                {...settings}
                // The section's own links win; with none, Theme settings → Social media fills in.
                socials={settings.socials.length ? settings.socials : theme.social.links}
                storeName={current.name}
                columns={hasFooterMenu ? footerColumns : starterFooterColumns(collections)}
                newsletterAction={subscribeAction}
                policies={policies.map((p) => ({ label: p.title, href: p.href }))}
                // Reopens the cookie banner, so a choice can be changed any time.
                cookieSettings={{
                  label: privacyContent.cookieSettings,
                  href: COOKIE_SETTINGS_HASH,
                }}
                grievance={officer ? policyPageContent.grievance(officer) : null}
                themeToggle={
                  theme.darkMode.enabled && theme.darkMode.togglePosition === 'footer' ? mode : null
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
              />
            )
          },
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
  // A not-found error inside the boundary leaves the shell to render on the server (status 200).
  const page = (await themedRerender()) ? <Suspense fallback={null}>{children}</Suspense> : children

  if (liquid) {
    // An imported theme may branch on `request.experiments` anywhere, so every experiment the
    // shopper is in counts as viewed on its pages (sections with an A/B test setting report
    // their own in `renderTemplate`).
    const tested = preview ? [] : Object.keys((await requestExperiments(storeId)).assignments)
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
          {/* React sections inside the theme (cards, product, search) read the store's price format. */}
          <MoneyFormatProvider format={current.moneyFormat}>
            {header}
            <main id="MainContent" tabIndex={-1} {...reactAttrs(liquid.mainAttrs)}>
              {page}
            </main>
            {footer}
          </MoneyFormatProvider>
          <LiquidHtml html={liquid.afterFooter} />
          <LiquidBoot />
          <AppEmbeds storeId={storeId} appEmbeds={theme.appEmbeds} />
          {tested.length ? <ExperimentBeacon seen={tested} /> : null}
          <ThemePreviewBridge adminOrigin={adminOrigin} />
          {preview ? null : <ConsentManager {...consent} themeBanner={themedConsent} />}
          {inboxChat ? <InboxLauncher widget={inboxChat} storeName={current.name} /> : null}
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
        {theme.customCss.trim() ? (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: cleanCustomCss strips anything that could close the style tag or open HTML
          <style dangerouslySetInnerHTML={{ __html: cleanCustomCss(theme.customCss) }} />
        ) : null}
        {theme.brand.favicon ? <link rel="icon" href={theme.brand.favicon.url} /> : null}
      </head>
      <body>
        {/* Prices in blocks (cards, product, search) read the store's format. */}
        <MoneyFormatProvider format={current.moneyFormat}>
          {previewName && !preview?.inFrame ? <PreviewBar themeName={previewName} /> : null}
          <StoreChrome>{header}</StoreChrome>
          <main id="MainContent">
            <StoreActionsProvider addToCart={addLineAction}>{page}</StoreActionsProvider>
          </main>
          {theme.cart.type === 'drawer' ? (
            <CartDrawer freeShippingBar={theme.cart.freeShippingBar} />
          ) : null}
          <StoreChrome>
            <CursorFill />
          </StoreChrome>
          <ThemePreviewBridge adminOrigin={adminOrigin} />
          {preview || themedConsent ? null : <ConsentManager {...consent} />}
          <StoreChrome>{footer}</StoreChrome>
          {inboxChat ? <InboxLauncher widget={inboxChat} storeName={current.name} /> : null}
          <AppEmbeds storeId={storeId} appEmbeds={theme.appEmbeds} />
        </MoneyFormatProvider>
      </body>
    </html>
  )
}
