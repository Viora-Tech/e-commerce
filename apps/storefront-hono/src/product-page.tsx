import { mainProductSettings, ProductView } from '@commerce/blocks'
import { withImportedDefaults } from '@commerce/blocks/imported-defaults'
import { createBlocksConfig, type PageData, type SectionMetadata } from '@commerce/blocks/puck'
import { renderBlock } from '@commerce/blocks/slots'
import {
  currentConsent,
  decodeConsent,
  liveThemeSettings,
  loadProductPageExtras,
  parseCustomerPrivacySettings,
  parsePreferences,
  searchIndexable,
} from '@commerce/core'
import { seoSnippet } from '@commerce/core/catalog'
import { isAbroad } from '@commerce/core/checkout-address'
import { CONSENT_COOKIE } from '@commerce/core/consent'
import { productOfferPolicies } from '@commerce/core/offer-policies'
import { depositIsNonRefundable, parsePreorderStoreSettings } from '@commerce/core/preorder'
import { store } from '@commerce/db'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import { type ComponentConfig, resolveAllData } from '@puckeditor/core'
import { eq } from 'drizzle-orm'
import { renderToString } from 'react-dom/server'
import DeliveryEstimateWidget from '@/components/product/delivery-estimate'
import EmiHint from '@/components/product/emi-hint'
import EmiOffers from '@/components/product/emi-offers'
import EmiOffersProvider from '@/components/product/emi-offers-provider'
import NotifyMeForm from '@/components/product/notify-me-form'
import RecordView from '@/components/product/record-view'
import { backInStockContext } from '@/lib/back-in-stock-context'
import { addLineAction } from '@/lib/cart-actions'
import { getProductByHandle, getProductSeo, type ProductDetail } from '@/lib/catalog'
import { NONCE_HEADER } from '@/lib/csp'
import { storeEmiOffers } from '@/lib/emi-offers'
import { requestExperiments } from '@/lib/experiments'
import { liquidShim } from '@/lib/liquid-shim'
import { liquidSplit } from '@/lib/liquid-split'
import {
  type LiquidSectionHtml,
  liquidLayoutFor,
  mainProductStylesheetUrls,
  renderLiquidSections,
  WHOLE_TEMPLATE,
} from '@/lib/liquid-theme'
import { MARKET_HEADERS } from '@/lib/markets'
import { attachImageMedia } from '@/lib/media-lookup'
import { storeOffersEmi, storeUpiDiscount } from '@/lib/payments'
import { storePixels } from '@/lib/pixels/pixels'
import { islandScript } from '@/lib/plain-html/islands'
import { THEME_COMPAT_CSS } from '@/lib/plain-html/theme-compat'
import { ourFontsHref } from '@/lib/plain-html/theme-fonts'
import { policyPanels } from '@/lib/related'
import { productReviews } from '@/lib/reviews'
import { jsonLd, marketCanonical, metaDescription, productGraph, requestOrigin } from '@/lib/seo'
import { shareImageUrl } from '@/lib/share-image'
import { storeRead } from '@/lib/store-cache'
import { liveThemeId, templateSections } from '@/lib/template-render'
import { resolveThemeMode, THEME_COOKIE, themeViewport } from '@/lib/theme-mode'
import { umamiTrackerOf } from '@/lib/umami'
import { cookies, headers } from './next-headers'

/**
 * The product page (`/products/:handle`) of an imported Shopify theme as one HTML document, from
 * the same loaders and the same Liquid render (and render cache) the Next route uses
 * (`apps/storefront/src/app/-s/[storeId]/products/[handle]/page.tsx`), placed the way the plain
 * HTML path places a home page (`apps/storefront/src/lib/plain-html/render.ts`).
 *
 * The theme's sections come out of the Liquid engine as strings. Our own product section
 * (`MainProduct`, the gallery and buy box) is a React component in the Next storefront; the pilot
 * draws it with `renderToString` (no hydration: its buttons would need an island) so the page
 * carries the same markup. Anything else of ours in the template sends a skip reason back.
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

function withDepositPolicy(
  product: ProductDetail,
  policy: ReturnType<typeof parsePreorderStoreSettings>,
): ProductDetail {
  if (!product.preorder?.depositPreview || !depositIsNonRefundable(policy)) return product
  return {
    ...product,
    preorder: { ...product.preorder, nonRefundableDepositDays: policy.payWithinDays },
  }
}

/** The same store read, under the same cache key, as the Next route's `loadProduct`. */
function loadProduct(storeId: string, handle: string) {
  return storeRead(storeId, `product-page|${handle}`, async (tx) => {
    const [s] = await tx
      .select({ name: store.name, currency: store.currency, preorder: store.preorder })
      .from(store)
      .where(eq(store.id, storeId))
    const policy = parsePreorderStoreSettings(s?.preorder)
    const found = await getProductByHandle(tx, handle, policy.note)
    if (!found) return null
    const seo = await getProductSeo(tx, found.id)
    const product = withDepositPolicy(found, policy)
    const text = richTextToPlainText(parseRichText(product.description))
    return {
      product,
      title: seo?.seoTitle || product.title,
      description: metaDescription(seo?.seoDescription || seoSnippet(text)),
      storeName: s?.name ?? '',
      currency: s?.currency ?? 'INR',
    }
  })
}

function storeRow(storeId: string) {
  return storeRead(storeId, 'plain-store', async (tx) => {
    const [s] = await tx
      .select({ name: store.name, preferences: store.preferences, apps: store.apps })
      .from(store)
      .where(eq(store.id, storeId))
    return s ?? null
  })
}

/** Sections of a group (header, footer) when every one is the theme's own. */
async function liquidGroup(storeId: string, key: 'header' | 'footer') {
  const t = await templateSections(storeId, key)
  if (!t.bound.content.every((item) => item.type === 'LiquidSection')) return null
  return (await attachImageMedia(storeId, t.bound, false)).content
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
  const themeId = await liveThemeId(storeId)
  if (!themeId) return { skip: 'no-theme' }

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
  const UnderPrice = abroad
    ? undefined
    : emiApp.config
      ? EmiOffers
      : legacyEmi
        ? EmiHint
        : undefined
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
  if (ours.some((item) => item.type !== 'MainProduct')) return { skip: 'own-section' }
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

  // Our product section through the same block config and Puck data pass as `renderTemplate`.
  const metadata: SectionMetadata = {
    renderers: {
      MainProduct: (s) => {
        const view = (
          <ProductView
            product={shown}
            onAddToCart={addLineAction}
            settings={{
              ...mainProductSettings(s),
              ...(abroad ? { showPaymentSignals: false } : {}),
              ratingValue: rated?.rating ?? 0,
              ratingCount: rated?.count ?? 0,
            }}
            upiDiscount={upiDiscount}
            policyPanels={policies}
            UnderPrice={UnderPrice}
            belowBuy={<DeliveryEstimateWidget />}
            NotifyMe={bis.installed ? NotifyMeForm : undefined}
            notifyMeProps={bis.installed ? { whatsappEnabled: bis.whatsappEnabled } : undefined}
          />
        )
        return (
          <>
            {emiApp.config ? (
              <EmiOffersProvider config={emiApp.config}>{view}</EmiOffersProvider>
            ) : (
              view
            )}
            <RecordView handle={product.handle} />
          </>
        )
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

  const sections = resolved.content.map((item, index) => {
    if (item.type === 'LiquidSection') {
      const s = main.get(String(item.props.id))
      return s ? placed(s) : ''
    }
    const aboveFold = index === 0 ? { _aboveFold: true } : {}
    const node = renderBlock({ ...item, props: { ...item.props, ...aboveFold } }, components, puck)
    return node ? `<div class="shopify-section">${renderToString(node)}</div>` : ''
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
  const theme = await storeRead(storeId, 'live-theme-settings', (tx) =>
    liveThemeSettings(tx, storeId),
  )
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
  const island = `<script${n}>${islandScript({
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
    chat: null,
    chatwoot: null,
    consentBanner: themeBanner ? null : { message: privacy.bannerMessage },
    marketBanner: false,
  })}</script>`
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
    island,
    '</body></html>',
  ].join('')
  const head = headWith(ourFontsHref(THEME_COMPAT_CSS + layout.head + body))
  return {
    html: `<!DOCTYPE html><html${attrs({ lang, ...layout.htmlAttrs })}><head>${head}</head>${body}`,
  }
}
