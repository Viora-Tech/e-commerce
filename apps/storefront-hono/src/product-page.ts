import { mainProductSettings } from '@commerce/blocks'
import { withImportedDefaults } from '@commerce/blocks/imported-defaults'
import { createBlocksConfig, type PageData, type SectionMetadata } from '@commerce/blocks/puck'
import { renderBlock } from '@commerce/blocks/slots'
import {
  currentConsent,
  decodeConsent,
  liveThemeSettings,
  loadProductPageExtras,
  parseCustomerPrivacySettings,
  parseMarketSettings,
  parsePreferences,
  searchIndexable,
} from '@commerce/core'
import { isAbroad } from '@commerce/core/checkout-address'
import { CONSENT_COOKIE } from '@commerce/core/consent'
import { productOfferPolicies } from '@commerce/core/offer-policies'
import { appEmbedSourcesForStore } from '@commerce/core/registries'
import { resolveAppEmbeds } from '@commerce/core/theme'
import { APP_BLOCK_SLOT_ATTR } from '@commerce/core/theme-import'
import { type ComponentConfig, resolveAllData } from '@puckeditor/core'
import { createElement } from 'react'
import { renderToReadableStream, renderToString } from 'react-dom/server'
import { backInStockContext } from '@/lib/back-in-stock-context'
import { addLineAction } from '@/lib/cart-actions'
import type { ProductDetail } from '@/lib/catalog'
import { chatwootChatFor } from '@/lib/chatwoot'
import { NONCE_HEADER } from '@/lib/csp'
import { storeEmiOffers } from '@/lib/emi-offers'
import { requestExperiments } from '@/lib/experiments'
import { HONO_ISLAND_PATH } from '@/lib/hono-island/route'
import { inboxLauncherOf } from '@/lib/inbox-launcher'
import { liquidShim } from '@/lib/liquid-shim'
import { liquidSplit } from '@/lib/liquid-split'
import {
  type LiquidSectionHtml,
  liquidLayoutFor,
  mainProductStylesheetUrls,
  renderLiquidSections,
  WHOLE_TEMPLATE,
} from '@/lib/liquid-theme'
import { requestMarketPricing } from '@/lib/market-pricing'
import { MARKET_HEADERS } from '@/lib/markets'
import { attachImageMedia } from '@/lib/media-lookup'
import { storeOffersEmi, storeUpiDiscount } from '@/lib/payments'
import { storePixels } from '@/lib/pixels/pixels'
import { chatLauncherHtml, chatModuleSpec } from '@/lib/plain-html/chat-launcher'
import { islandScript } from '@/lib/plain-html/islands'
import { THEME_COMPAT_CSS } from '@/lib/plain-html/theme-compat'
import { ourFontsHref } from '@/lib/plain-html/theme-fonts'
import { policyPanels } from '@/lib/related'
import { productReviews } from '@/lib/reviews'
import { abThemeId } from '@/lib/rollout-ab'
import { jsonLd, marketCanonical, productGraph, requestOrigin } from '@/lib/seo'
import { shareImageUrl } from '@/lib/share-image'
import { storeRead } from '@/lib/store-cache'
import { liveThemeId, templateSections } from '@/lib/template-render'
import { resolveThemeMode, THEME_COOKIE, themeViewport } from '@/lib/theme-mode'
import { umamiTrackerOf } from '@/lib/umami'
import { islandBuild } from './island/assets'
import BuyBox from './island/buy-box'
import { ISLAND_MARK, placeIsland, splitPreloads } from './island/place'
import { ISLAND_PROPS_ID, type IslandProps, serializeIslandProps } from './island/props'
import { cookies, headers } from './next-headers'
import { liveMarketCount, loadProduct, reviewsCarousel, storeRow } from './product-data'

/**
 * The product page (`/products/:handle`) of an imported Shopify theme as one HTML document, from
 * the same loaders and the same Liquid render (and render cache) the Next route uses
 * (`apps/storefront/src/app/-s/[storeId]/products/[handle]/page.tsx`), placed the way the plain
 * HTML path places a home page (`apps/storefront/src/lib/plain-html/render.ts`).
 *
 * The theme's sections come out of the Liquid engine as strings. Our own product section
 * (`MainProduct`, the gallery and buy box) is the React `ProductView`, as on Next: it is rendered
 * here (`island/buy-box.tsx`) and hydrated in the browser by the island script
 * (`island/client.ts`) from the props written into the page (`island/props.ts`).
 *
 * A page this server cannot draw the way Next does returns a skip reason, and Next draws it
 * (the same rules as the plain HTML path): any other section of ours, an A/B theme test, an app
 * embed, one of our widgets in a theme app block slot, a theme buy button that would carry the
 * pre-order note, props that do not survive JSON, or no built island.
 */

/** Escaped as React escapes attribute values (`'` too), so the head matches the Next page's. */
const escapeHtml = (v: string) =>
  v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

type Attrs = Record<string, string>

function attrs(list: Attrs): string {
  return Object.entries(list)
    .filter(([k]) => /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(k) && !k.toLowerCase().startsWith('on'))
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
    .join('')
}

const meta = (name: string, content: string | undefined, key = 'name') =>
  content ? `<meta ${key}="${escapeHtml(name)}" content="${escapeHtml(content)}">` : ''

const placed = (s: LiquidSectionHtml) =>
  `<${s.tag} id="${escapeHtml(s.id)}" class="${escapeHtml(s.className)}">${s.html}</${s.tag}>`

/** Sections of a group (header, footer) when every one is the theme's own. */
async function liquidGroup(storeId: string, key: 'header' | 'footer') {
  const t = await templateSections(storeId, key)
  if (!t.bound.content.every((item) => item.type === 'LiquidSection')) return null
  return (await attachImageMedia(storeId, t.bound, false)).content
}

/** The app block slots the island fills, as Next's product page and layout do. */
const ISLAND_SLOTS = new Set(['reviews', 'reviews-carousel'])

/** Same rule ProductView uses for its first pick: the first purchasable variant. */
const defaultVariant = (product: ProductDetail) =>
  product.variants.find((v) => v.purchasable) ?? product.variants[0]

/** The island's tree as HTML, every lazy piece in (as Next's streamed render ends up). */
async function renderIsland(island: IslandProps): Promise<string> {
  const stream = await renderToReadableStream(createElement(BuyBox, { island }))
  await stream.allReady
  return new Response(stream).text()
}

/** Our product section's loaders are never called: the config only supplies `MainProduct`. */
const noCards = async () => []

export type ProductResult = { html: string } | { skip: string } | { notFound: true }

export async function renderProductPage(storeId: string, handle: string): Promise<ProductResult> {
  const found = await loadProduct(storeId, handle)
  if (!found) return { notFound: true }
  const { product } = found
  const current = await storeRow(storeId)
  if (!current) return { skip: 'store' }
  const built = islandBuild()
  if (!built) return { skip: 'no-island' }
  if (await abThemeId(storeId)) return { skip: 'theme-ab-test' }
  const themeId = await liveThemeId(storeId)
  if (!themeId) return { skip: 'no-theme' }
  const theme = await storeRead(storeId, 'live-theme-settings', (tx) =>
    liveThemeSettings(tx, storeId),
  )
  const embeds = await storeRead(
    storeId,
    'app-embed-sources',
    (tx) => appEmbedSourcesForStore(tx, storeId),
    { size: 4096 },
  )
  if (resolveAppEmbeds(embeds, theme.appEmbeds).some((e) => e.enabled)) {
    return { skip: 'app-embed' }
  }

  const [reviews, extras, upiDiscount, emiApp, bis, policies, offerPolicies] = await Promise.all([
    productReviews(storeId, product, {
      requestToken: null,
      openForm: false,
      storeName: found.storeName,
    }),
    storeRead(storeId, `product-extras|${product.id}`, (tx) =>
      loadProductPageExtras(tx, product.id),
    ),
    storeRead(storeId, 'upi-discount', (tx) => storeUpiDiscount(tx, storeId)),
    storeRead(storeId, 'emi-offers', (tx) => storeEmiOffers(tx, storeId)),
    storeRead(storeId, 'back-in-stock', (tx) => backInStockContext(tx, storeId)),
    storeRead(storeId, 'policy-panels', (tx) => policyPanels(tx)),
    storeRead(storeId, 'offer-policies', (tx) => productOfferPolicies(tx, storeId)),
  ])
  const rated =
    reviews && reviews.summary.count > 0
      ? reviews.summary
      : extras.rating
        ? { rating: extras.rating.value, count: extras.rating.count }
        : null
  const shown = { ...product, fields: extras.fields, collection: extras.collection }
  const legacyEmi = emiApp.installed
    ? false
    : await storeRead(storeId, 'legacy-emi', (tx) => storeOffersEmi(tx, storeId))
  const h = await headers()
  const abroad = isAbroad(h.get(MARKET_HEADERS.country) ?? 'IN')
  const underPrice: IslandProps['underPrice'] = abroad
    ? null
    : emiApp.config
      ? 'emi-offers'
      : legacyEmi
        ? 'emi-hint'
        : null
  const origin = await requestOrigin()
  const schema = productGraph(
    {
      ...product,
      description: found.description,
      images: product.images.filter((i) => !i.contentType?.startsWith('video/')),
      rating: rated ? { value: rated.rating, count: rated.count } : null,
      reviews:
        reviews?.widget.reviews.slice(0, 5).map((r) => ({
          author: r.name,
          rating: r.rating,
          title: r.title,
          body: r.body,
        })) ?? [],
      policies: offerPolicies,
    },
    origin,
    found.currency,
    found.storeName,
  )

  // The template, header and footer, as the Next route sees them.
  const t = await templateSections(storeId, 'product', {
    suffix: product.templateSuffix,
    sources: { productId: product.id },
  })
  const visible = await attachImageMedia(storeId, t.bound, false)
  const ours = visible.content.filter((item) => item.type !== 'LiquidSection')
  if (ours.length !== 1 || ours[0]?.type !== 'MainProduct') return { skip: 'own-section' }
  const [headerContent, footerContent] = await Promise.all([
    liquidGroup(storeId, 'header'),
    liquidGroup(storeId, 'footer'),
  ])
  if (!headerContent || !footerContent) return { skip: 'own-section' }
  const layout = await liquidLayoutFor(storeId, themeId)
  if (!layout) return { skip: 'not-imported' }
  const split = await liquidSplit('product', false)
  const [main, header, footer, themeSheets] = await Promise.all([
    renderLiquidSections(storeId, themeId, 'product', visible.content, {
      ...split,
      end: Infinity,
    }),
    renderLiquidSections(storeId, themeId, 'header', headerContent, WHOLE_TEMPLATE),
    renderLiquidSections(storeId, themeId, 'footer', footerContent, WHOLE_TEMPLATE),
    mainProductStylesheetUrls(storeId, themeId),
  ])
  if (!main || !header || !footer) return { skip: 'not-imported' }
  const liquidHtml = [main, header, footer].flatMap((m) => [...m.values()].map((s) => s.html))
  // Our widgets drawn into a theme's app block slots: the Reviews app's two go in the island
  // (`island/buy-box.tsx`); any other slot is a page Next draws.
  const slotRe = new RegExp(`${APP_BLOCK_SLOT_ATTR}="([^"]*)"`, 'g')
  const slots = new Set(liquidHtml.flatMap((html) => [...html.matchAll(slotRe)].map((m) => m[1])))
  const unknown = [...slots].filter((s) => !ISLAND_SLOTS.has(s ?? ''))
  if (unknown.length > 0) return { skip: `app-block:${unknown.join(',')}` }
  // A theme buy button that Next gives the pre-order note (`LiquidPreorderNote`).
  if (product.preorder?.note && liquidHtml.some((html) => html.includes('/cart/add'))) {
    return { skip: 'preorder-note' }
  }

  // Our product section through the same block config and Puck data pass as `renderTemplate`,
  // with a mark where the buy box goes (`island/place.ts`); the renderer keeps the settings.
  let settings: IslandProps['settings'] | null = null
  const metadata: SectionMetadata = {
    renderers: {
      MainProduct: (s) => {
        settings = {
          ...mainProductSettings(s),
          ...(abroad ? { showPaymentSignals: false } : {}),
          ratingValue: rated?.rating ?? 0,
          ratingCount: rated?.count ?? 0,
        }
        return ISLAND_MARK
      },
    },
    product: shown,
    productActions: { addToCart: addLineAction },
  }
  const config = createBlocksConfig(noCards)
  const page = { ...visible, content: visible.content.map((s) => withImportedDefaults(s)) }
  const resolved = await resolveAllData(page as unknown as PageData, config, metadata)
  const components = config.components as unknown as Record<string, ComponentConfig | undefined>
  const puck = { metadata, isEditing: false, renderDropZone: () => null, dragRef: null }

  const ourItem = resolved.content.find((item) => item.type !== 'LiquidSection')
  if (!ourItem) return { skip: 'own-section' }
  const aboveFold = resolved.content.indexOf(ourItem) === 0 ? { _aboveFold: true } : {}
  const node = renderBlock(
    { ...ourItem, props: { ...ourItem.props, ...aboveFold } },
    components,
    puck,
  )
  const shell = node ? renderToString(node) : ''
  if (!settings) return { skip: 'island-settings' }
  const variant = defaultVariant(product)
  const props: IslandProps = {
    product: shown,
    settings,
    upiDiscount,
    policyPanels: policies,
    underPrice,
    emiConfig: emiApp.config ?? null,
    notifyMe: bis.installed ? { whatsappEnabled: bis.whatsappEnabled } : null,
    moneyFormat: current.moneyFormat ?? null,
    pricing: await requestMarketPricing(storeId),
    cartHref: `${h.get(MARKET_HEADERS.prefix) ?? ''}/cart`,
    framed: false,
    viewContent: {
      name: 'ViewContent',
      productId: product.id,
      variantId: variant?.id,
      valuePaise: variant?.pricePaise ?? undefined,
    },
    reviews: reviews?.widget ?? null,
    reviewsCarousel: slots.has('reviews-carousel') ? await reviewsCarousel(storeId) : null,
  }
  const drawnIsland = splitPreloads(await renderIsland(props))
  const fit = placeIsland(shell, drawnIsland.body)
  if (!fit) return { skip: 'island-shape' }
  const island: IslandProps = { ...props, framed: fit.framed }
  let islandJson: string
  try {
    islandJson = serializeIslandProps(island)
  } catch (err) {
    // Which value (`island props: Date does not survive JSON`), for whoever reads the header.
    return {
      skip: `island-props:${err instanceof Error ? err.message.replace(/^island props: /, '') : '?'}`,
    }
  }

  const sections = resolved.content.map((item) => {
    if (item.type === 'LiquidSection') {
      const s = main.get(String(item.props.id))
      return s ? placed(s) : ''
    }
    return item === ourItem ? `<div class="shopify-section">${fit.html}</div>` : ''
  })

  const draw = (
    items: { props: Record<string, unknown> }[],
    html: Map<string, LiquidSectionHtml>,
  ) =>
    items
      .map((item) => html.get(String(item.props.id)))
      .filter((s): s is LiquidSectionHtml => s !== undefined)
      .map(placed)
      .join('')

  // Head and body around the sections, as the plain HTML path writes them.
  const prefs = parsePreferences(current.preferences)
  const jar = await cookies()
  const mode = resolveThemeMode(jar.get(THEME_COOKIE)?.value, theme.darkMode)
  const viewport = themeViewport(theme, mode)
  const privacy = parseCustomerPrivacySettings(current.preferences)
  const consent = decodeConsent(jar.get(CONSENT_COOKIE)?.value)
  const nonce = h.get(NONCE_HEADER) ?? ''
  const n = nonce ? ` nonce="${escapeHtml(nonce)}"` : ''
  const lang = h.get(MARKET_HEADERS.locale) ?? 'en'
  const favicon = layout.favicon ?? theme.brand.favicon?.url ?? null
  const v = prefs.verification
  const themeColors = Array.isArray(viewport.themeColor)
    ? viewport.themeColor
    : viewport.themeColor
      ? [{ color: String(viewport.themeColor) }]
      : []
  const canonical = await marketCanonical(`/products/${product.handle}`)
  const title = `${found.title} | ${found.storeName}`
  const images = product.images
    .filter((i) => !i.contentType?.startsWith('video/'))
    .slice(0, 4)
    .map((i) => ({ url: shareImageUrl(i), alt: i.alt ?? product.title }))
  const themeBanner = footerContent.some((item) => item.props.sectionType === 'cookie-banner')

  const headWith = (ourFonts: string | null) =>
    [
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      // Next's global stylesheet (Tailwind and the blocks' CSS), which styles the buy box.
      `<link rel="stylesheet" href="${HONO_ISLAND_PATH}/${built.css}">`,
      `<style>${THEME_COMPAT_CSS}</style>`,
      `<title>${escapeHtml(title)}</title>`,
      meta('description', found.description),
      `<link rel="canonical" href="${escapeHtml(origin + canonical)}">`,
      searchIndexable(prefs) ? '' : meta('robots', 'noindex, nofollow'),
      meta('google-site-verification', v.google),
      meta('msvalidate.01', v.bing),
      meta('facebook-domain-verification', v.meta),
      meta('p:domain_verify', v.pinterest),
      meta('og:type', 'website', 'property'),
      meta('og:site_name', current.name, 'property'),
      meta('og:title', found.title, 'property'),
      meta('og:description', found.description, 'property'),
      meta('og:url', origin + canonical, 'property'),
      ...images.flatMap((i) => [
        meta('og:image', new URL(i.url, origin).href, 'property'),
        meta('og:image:alt', i.alt, 'property'),
      ]),
      meta('twitter:card', images.length ? 'summary_large_image' : 'summary'),
      meta('twitter:title', found.title),
      meta('twitter:description', found.description),
      ...images.map((i) => meta('twitter:image', new URL(i.url, origin).href)),
      viewport.colorScheme ? meta('color-scheme', String(viewport.colorScheme)) : '',
      ...themeColors.map((tc) =>
        'media' in tc && tc.media
          ? `<meta name="theme-color" media="${escapeHtml(tc.media)}" content="${escapeHtml(tc.color)}">`
          : meta('theme-color', tc.color),
      ),
      layout.fontsHref ? `<link rel="stylesheet" href="${escapeHtml(layout.fontsHref)}">` : '',
      ourFonts ? `<link rel="stylesheet" href="${escapeHtml(ourFonts)}">` : '',
      favicon ? `<link rel="icon" href="${escapeHtml(favicon)}">` : '',
      // The gallery's first image, which React asked to preload (Next hoists it here too).
      drawnIsland.preloads,
      `<script${n}>${liquidShim({
        askConsent: currentConsent(consent, privacy.bannerVersion) === null,
        prefix: h.get(MARKET_HEADERS.prefix) ?? '',
      })}</script>`,
      layout.head,
    ].join('')

  const headerHtml = draw(headerContent, header)
  const wrappedHeader = layout.headerWrapper
    ? `<${layout.headerWrapper.tag}${attrs(layout.headerWrapper.attrs)}>${headerHtml}</${layout.headerWrapper.tag}>`
    : headerHtml
  // Our widgets the plain HTML island draws, as on a plain HTML page.
  const marketBanner =
    parseMarketSettings(current.preferences).suggestMarket && (await liveMarketCount(storeId)) > 1
  const inboxChat = inboxLauncherOf(current.apps)
  // The Inbox app's chat wins over Chatwoot's, as on the React page.
  const chatwoot = inboxChat ? null : await chatwootChatFor(storeId, current.apps)
  const plainIsland = `<script${n}>${islandScript({
    bannerVersion: privacy.bannerVersion,
    tracking: {
      ga4: prefs.tracking.ga4,
      gtm: prefs.tracking.gtm,
      metaPixel: prefs.tracking.metaPixel,
      googleAds: prefs.tracking.googleAds ?? '',
    },
    umami: umamiTrackerOf(current.apps),
    pixels: await storePixels(storeId, current.apps),
    experiments: Object.keys((await requestExperiments(storeId)).assignments),
    chat: inboxChat ? chatModuleSpec(inboxChat, current.name) : null,
    chatwoot,
    consentBanner: themeBanner ? null : { message: privacy.bannerMessage },
    marketBanner,
  })}</script>`
  // The buy box island: its props, then its module (deferred, so it runs after the parse).
  const buyBoxIsland = [
    `<script type="application/json" id="${ISLAND_PROPS_ID}">${islandJson}</script>`,
    `<script type="module"${n} src="${HONO_ISLAND_PATH}/${built.entry}"></script>`,
  ].join('')
  const { id: _id, tabindex: _tab, ...mainAttrs } = layout.mainAttrs
  const body = [
    `<body${attrs(layout.bodyAttrs)}>`,
    layout.beforeHeader,
    wrappedHeader,
    `<main id="MainContent" tabindex="-1"${attrs(mainAttrs)}>`,
    `<script type="application/ld+json">${jsonLd(schema).__html}</script>`,
    ...themeSheets.map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`),
    ...sections,
    '</main>',
    draw(footerContent, footer),
    layout.afterFooter,
    inboxChat ? chatLauncherHtml(inboxChat) : '',
    buyBoxIsland,
    plainIsland,
    '</body></html>',
  ].join('')
  const head = headWith(ourFontsHref(THEME_COMPAT_CSS + layout.head + body))
  return {
    html: `<!DOCTYPE html><html${attrs({ lang, ...layout.htmlAttrs })}><head>${head}</head>${body}`,
  }
}
