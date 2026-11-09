import 'server-only'
import {
  currentConsent,
  decodeConsent,
  liveThemeSettings,
  parseCustomerPrivacySettings,
  parseMarketSettings,
  parsePreferences,
  searchIndexable,
  type TemplateKey,
} from '@commerce/core'
import { CONSENT_COOKIE } from '@commerce/core/consent'
import { policyTypeOfHandle } from '@commerce/core/policies'
import { appEmbedSourcesForStore } from '@commerce/core/registries'
import { resolveAppEmbeds } from '@commerce/core/theme'
import { APP_BLOCK_SLOT_ATTR } from '@commerce/core/theme-import'
import { market, page as pageTable, store } from '@commerce/db'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import { eq } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { chatwootChatFor } from '../chatwoot'
import { NONCE_HEADER } from '../csp'
import { requestExperiments } from '../experiments'
import { inboxLauncherOf } from '../inbox-launcher'
import { liquidShim } from '../liquid-shim'
import { liquidSplit } from '../liquid-split'
import {
  type LiquidSectionHtml,
  liquidLayoutFor,
  renderLiquidSections,
  WHOLE_TEMPLATE,
} from '../liquid-theme'
import { MARKET_HEADERS } from '../markets'
import { attachImageMedia } from '../media-lookup'
import { storePixels } from '../pixels/pixels'
import { abThemeId } from '../rollout-ab'
import { jsonLd, marketCanonical, metaDescription, requestOrigin, storeGraph } from '../seo'
import { storeShareImages } from '../share-image'
import { storeRead } from '../store-cache'
import { liveThemeId, templateSections } from '../template-render'
import { resolveThemeMode, THEME_COOKIE, themeViewport } from '../theme-mode'
import { umamiTrackerOf } from '../umami'
import { chatLauncherHtml, chatModuleSpec } from './chat-launcher'
import { islandScript } from './islands'
import { plainKind, plainPageHandle } from './route'

/**
 * An imported Shopify theme's page as one plain HTML document: the theme's `layout/theme.liquid`
 * around its rendered sections (the same render cache the React page reads, `liquid-theme.ts`),
 * our SEO head, and one small inline island script (`islands.ts`). No React, no RSC payload, no
 * Next.js client runtime, no global stylesheet (docs/design/storefront-plain-html.md).
 *
 * Returns a skip reason when the page cannot go out plain yet, and the route hands it back to the React
 * page (`forward.ts`): one of our own sections in its template or groups (our product, our
 * collection grid...), a widget only React draws (the Inbox chat, Chatwoot, the Pixels app,
 * app embeds, the market banner), an A/B test, or a page Next answers itself (a policy redirect,
 * a 404).
 */

type Attrs = Record<string, string>

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Theme layout attributes as written: inline handlers dropped, as the React page drops them. */
function attrs(list: Attrs): string {
  return Object.entries(list)
    .filter(([k]) => /^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(k) && !k.toLowerCase().startsWith('on'))
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${escapeHtml(v)}"`))
    .join('')
}

const meta = (name: string, content: string | undefined, key = 'name') =>
  content ? `<meta ${key}="${escapeHtml(name)}" content="${escapeHtml(content)}">` : ''

/** One section inside Shopify's wrapper, as `LiquidSlot` draws it on the React page. */
const placed = (s: LiquidSectionHtml) =>
  `<${s.tag} id="${escapeHtml(s.id)}" class="${escapeHtml(s.className)}">${s.html}</${s.tag}>`

/** What every plain page reads from the store row, cached per store version. */
function storeRow(storeId: string) {
  return storeRead(storeId, 'plain-store', async (tx) => {
    const [s] = await tx
      .select({ name: store.name, preferences: store.preferences, apps: store.apps })
      .from(store)
      .where(eq(store.id, storeId))
    return s ?? null
  })
}

/** How many markets shoppers can be in, as the store layout counts them (same cache entry). */
function liveMarketCount(storeId: string) {
  return storeRead(storeId, 'live-market-count', async (tx) => {
    const rows = await tx.select({ id: market.id }).from(market).where(eq(market.enabled, true))
    return rows.length
  })
}

/** The `/pages/<handle>` row, cached per store version. */
function pageRow(storeId: string, handle: string) {
  return storeRead(storeId, `plain-page|${handle}`, async (tx) => {
    const [found] = await tx
      .select({
        handle: pageTable.handle,
        title: pageTable.title,
        body: pageTable.body,
        seoTitle: pageTable.seoTitle,
        seoDescription: pageTable.seoDescription,
        templateSuffix: pageTable.templateSuffix,
        publishedAt: pageTable.publishedAt,
      })
      .from(pageTable)
      .where(eq(pageTable.handle, handle))
    return found ?? null
  })
}

/**
 * A template's visible sections when every one is the theme's own; null when any is ours. A section
 * in an A/B test is already the shopper's variant (`templateSections`); the island reports it.
 */
async function liquidOnly(storeId: string, key: TemplateKey, suffix?: string | null) {
  const t = await templateSections(storeId, key, { suffix })
  if (!t.bound.content.every((item) => item.type === 'LiquidSection')) return null
  return (await attachImageMedia(storeId, t.bound, false)).content
}

type Seo = {
  title: string
  description: string | undefined
  canonical: string
  ogUrl: string | null
  jsonLd: unknown
}

/** The page, or why it goes to the React page instead (sent back as `x-plain-skip-reason`). */
export type PlainResult = { html: string } | { skip: string }

const skip = (reason: string): PlainResult => ({ skip: reason })

export async function renderPlainPage(storeId: string): Promise<PlainResult> {
  const h = await headers()
  const path = h.get('x-pathname') ?? '/'
  const kind = plainKind(path)
  if (!kind) return skip('path')
  const current = await storeRow(storeId)
  if (!current) return skip('store')
  const prefs = parsePreferences(current.preferences)
  if (!prefs.delivery.plainHtml) return skip('switch-off')

  // Our widgets, drawn by the island's modules (docs: phase 2).
  const marketBanner =
    parseMarketSettings(current.preferences).suggestMarket && (await liveMarketCount(storeId)) > 1
  const inboxChat = inboxLauncherOf(current.apps)
  // The Inbox app's chat wins over Chatwoot's, as on the React page.
  const chatwoot = inboxChat ? null : await chatwootChatFor(storeId, current.apps)
  if (await abThemeId(storeId)) return skip('theme-ab-test')
  const themeId = await liveThemeId(storeId)
  if (!themeId) return skip('no-theme')
  const theme = await storeRead(storeId, 'live-theme-settings', (tx) =>
    liveThemeSettings(tx, storeId),
  )
  const embeds = await storeRead(
    storeId,
    'app-embed-sources',
    (tx) => appEmbedSourcesForStore(tx, storeId),
    { size: 4096 },
  )
  if (resolveAppEmbeds(embeds, theme.appEmbeds).some((e) => e.enabled)) return skip('app-embed')

  // The page this path shows, as the React route finds it.
  const handle = kind === 'page' ? plainPageHandle(path) : null
  if (handle && policyTypeOfHandle(handle)) return skip('policy')
  const found = handle ? await pageRow(storeId, handle) : null
  if (kind === 'page' && !found?.publishedAt) return skip('not-found')
  const key: TemplateKey = kind === 'home' ? 'home' : 'page'

  const [content, headerContent, footerContent] = await Promise.all([
    liquidOnly(storeId, key, found?.templateSuffix),
    liquidOnly(storeId, 'header'),
    liquidOnly(storeId, 'footer'),
  ])
  if (!content || !headerContent || !footerContent) return skip('own-section')
  // The theme's own cookie banner asks for consent (the shim answers it); without one, ours does.
  const themeBanner = footerContent.some((item) => item.props.sectionType === 'cookie-banner')
  const layout = await liquidLayoutFor(storeId, themeId)
  if (!layout) return skip('not-imported')

  const split = await liquidSplit(key, false)
  const [main, header, footer] = await Promise.all([
    renderLiquidSections(storeId, themeId, key, content, { ...split, end: Infinity }),
    renderLiquidSections(storeId, themeId, 'header', headerContent, WHOLE_TEMPLATE),
    renderLiquidSections(storeId, themeId, 'footer', footerContent, WHOLE_TEMPLATE),
  ])
  if (!main || !header || !footer) return skip('not-imported')
  // One of our widgets drawn into a theme app block's slot (the reviews carousel) is React's.
  if (
    [main, header, footer].some((m) =>
      [...m.values()].some((s) => s.html.includes(APP_BLOCK_SLOT_ATTR)),
    )
  ) {
    return skip('app-block')
  }
  const draw = (items: typeof content, html: Map<string, LiquidSectionHtml>) =>
    items
      .map((item) => html.get(String(item.props.id)))
      .filter((s): s is LiquidSectionHtml => s !== undefined)
      .map(placed)
      .join('')

  const origin = await requestOrigin()
  const seo = await seoFor(storeId, origin, current.name, prefs, found)
  const images = (await storeShareImages(storeId)) ?? []
  const jar = await cookies()
  const mode = resolveThemeMode(jar.get(THEME_COOKIE)?.value, theme.darkMode)
  const viewport = themeViewport(theme, mode)
  const privacy = parseCustomerPrivacySettings(current.preferences)
  const consent = decodeConsent(jar.get(CONSENT_COOKIE)?.value)
  const nonce = h.get(NONCE_HEADER) ?? ''
  const n = nonce ? ` nonce="${escapeHtml(nonce)}"` : ''
  const lang = h.get(MARKET_HEADERS.locale) ?? 'en'
  const favicon = layout.favicon ?? theme.brand.favicon?.url ?? null
  const umami = umamiTrackerOf(current.apps)
  const v = prefs.verification
  const themeColors = Array.isArray(viewport.themeColor)
    ? viewport.themeColor
    : viewport.themeColor
      ? [{ color: String(viewport.themeColor) }]
      : []

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(seo.title)}</title>`,
    meta('description', seo.description),
    `<link rel="canonical" href="${escapeHtml(origin + seo.canonical)}">`,
    searchIndexable(prefs) ? '' : meta('robots', 'noindex, nofollow'),
    meta('google-site-verification', v.google),
    meta('msvalidate.01', v.bing),
    meta('facebook-domain-verification', v.meta),
    meta('p:domain_verify', v.pinterest),
    meta('og:type', 'website', 'property'),
    meta('og:site_name', current.name, 'property'),
    meta('og:title', seo.title, 'property'),
    meta('og:description', seo.description, 'property'),
    seo.ogUrl ? meta('og:url', origin + seo.ogUrl, 'property') : '',
    ...images.flatMap((i) => [
      meta('og:image', new URL(i.url, origin).href, 'property'),
      meta('og:image:alt', i.alt, 'property'),
    ]),
    meta('twitter:card', images.length ? 'summary_large_image' : 'summary'),
    meta('twitter:title', seo.title),
    meta('twitter:description', seo.description),
    ...images.map((i) => meta('twitter:image', new URL(i.url, origin).href)),
    viewport.colorScheme ? meta('color-scheme', String(viewport.colorScheme)) : '',
    ...themeColors.map((t) =>
      'media' in t && t.media
        ? `<meta name="theme-color" media="${escapeHtml(t.media)}" content="${escapeHtml(t.color)}">`
        : meta('theme-color', t.color),
    ),
    layout.fontsHref ? `<link rel="stylesheet" href="${escapeHtml(layout.fontsHref)}">` : '',
    favicon ? `<link rel="icon" href="${escapeHtml(favicon)}">` : '',
    `<script${n}>${liquidShim({
      askConsent: currentConsent(consent, privacy.bannerVersion) === null,
      prefix: '',
    })}</script>`,
    layout.head,
  ].join('')

  const headerHtml = draw(headerContent, header)
  const wrappedHeader = layout.headerWrapper
    ? `<${layout.headerWrapper.tag}${attrs(layout.headerWrapper.attrs)}>${headerHtml}</${layout.headerWrapper.tag}>`
    : headerHtml
  const graph = seo.jsonLd
    ? `<script type="application/ld+json">${jsonLd(seo.jsonLd).__html}</script>`
    : ''
  const island = `<script${n}>${islandScript({
    bannerVersion: privacy.bannerVersion,
    tracking: {
      ga4: prefs.tracking.ga4,
      gtm: prefs.tracking.gtm,
      metaPixel: prefs.tracking.metaPixel,
      googleAds: prefs.tracking.googleAds ?? '',
    },
    umami,
    pixels: await storePixels(storeId, current.apps),
    experiments: Object.keys((await requestExperiments(storeId)).assignments),
    chat: inboxChat ? chatModuleSpec(inboxChat, current.name) : null,
    chatwoot,
    consentBanner: themeBanner ? null : { message: privacy.bannerMessage },
    marketBanner,
  })}</script>`

  const html = [
    `<!DOCTYPE html><html${attrs({ lang, ...layout.htmlAttrs })}>`,
    `<head>${head}</head>`,
    `<body${attrs(layout.bodyAttrs)}>`,
    layout.beforeHeader,
    wrappedHeader,
    `<main id="MainContent" tabindex="-1"${attrs(withoutId(layout.mainAttrs))}>`,
    draw(content, main),
    graph,
    '</main>',
    draw(footerContent, footer),
    layout.afterFooter,
    inboxChat ? chatLauncherHtml(inboxChat) : '',
    island,
    '</body></html>',
  ].join('')
  return { html }
}

/** `<main>`'s theme attributes without the id and tabindex this page sets itself. */
function withoutId(list: Attrs): Attrs {
  const { id: _id, tabindex: _tabindex, ...rest } = list
  return rest
}

/** Title, description, canonical and structured data, as the React route's metadata writes them. */
async function seoFor(
  storeId: string,
  origin: string,
  storeName: string,
  prefs: ReturnType<typeof parsePreferences>,
  found: Awaited<ReturnType<typeof pageRow>>,
): Promise<Seo> {
  if (found) {
    const canonical = await marketCanonical(`/pages/${found.handle}`)
    return {
      title: `${found.seoTitle || found.title} | ${storeName}`,
      description: metaDescription(
        found.seoDescription || richTextToPlainText(parseRichText(found.body)),
      ),
      canonical,
      ogUrl: canonical,
      jsonLd: null,
    }
  }
  const identity = await storeRead(storeId, 'home-identity', async (tx) => {
    const [s] = await tx.select().from(store).where(eq(store.id, storeId))
    const theme = await liveThemeSettings(tx, storeId)
    return {
      name: s?.name ?? '',
      logoUrl: theme.brand.logo?.url,
      description: parsePreferences(s?.preferences).seo.description || undefined,
      email: s?.contactEmail,
      phone: s?.contactPhone,
    }
  })
  return {
    title: prefs.seo.title || storeName,
    description: prefs.seo.description || undefined,
    canonical: await marketCanonical('/'),
    ogUrl: null,
    jsonLd: storeGraph({ ...identity, origin }),
  }
}
