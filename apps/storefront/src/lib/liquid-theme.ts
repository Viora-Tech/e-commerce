import 'server-only'
import {
  compactVideosByUrl,
  googleFontsHref,
  liquidPlacement,
  mainProductStylesheets,
  renderLiquidLayout,
  renderLiquidSection,
  sectionWrapper,
  showsCookieSettingsLink,
  videoSources,
  withCompactVideos,
} from '@commerce/core'
import { pickVariantUrls } from '@commerce/core/media-loader'
import type { StoreTx } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { privacyContent } from '@/data/privacy'
import { currentCustomer } from './customer-session'
import {
  type CachedLiquid,
  type CachedReads,
  keepable,
  layoutCacheKey,
  NONCE_MARK,
  type RenderTrace,
  renderTtl,
  sectionCacheKey,
  servable,
} from './liquid-cache'
import { toLiquidCart } from './liquid-cart'
import { compactThemeHtml } from './liquid-compact'
import { revealConsentEarly } from './liquid-consent-reveal'
import { importedTheme, tracedContext } from './liquid-context'
import { withCookieSettingsLink } from './liquid-cookie-settings'
import { deferThemeScripts } from './liquid-defer'
import { belowTheFold } from './liquid-fold'
import { avifImagePreloads } from './liquid-preload'
import { cacheScope, finish, type RequestScope, requestScope, signedOut } from './liquid-scope'
import { withoutVideoCovers } from './liquid-video-cover'
import { withVideoPosters } from './liquid-video-poster'
import { postersByVideoUrl } from './media-lookup'
import { RenderAbortedError } from './render-gate'
import { withRenderSlot } from './render-slot'
import { cartIsEmpty, requestCart } from './request-cart'
import { CACHE_TTL_MS, peekForStore, rememberForStore } from './store-cache'
import { inStore } from './store-context'
import { bundleThemeStylesheets } from './theme-css'

/**
 * The storefront side of imported Shopify themes (`@commerce/core` theme-import): the
 * section HTML the `LiquidSection` renderer draws, and the layout parts (head, icon sprites,
 * cart drawer, scripts) the store layout puts around `<main>`.
 *
 * Rendered Liquid is cached per store version (`store-cache.ts`, `liquid-cache.ts`): a page
 * whose sections are all cached renders no Liquid and reads no theme data. Sections that read
 * the cart are kept only as rendered for an empty cart, and sections that read `customer` only
 * as rendered for a signed-out shopper; a theme preview is never cached.
 *
 * The request's scope lives in `liquid-scope.ts`, the theme bundle and page context in
 * `liquid-context.ts`, and the section rendering endpoints in `liquid-static-section.ts`.
 */

/** Template key → the location Liquid sees (`section.location`). */
const LOCATION: Record<string, string> = { header: 'header-group', footer: 'footer-group' }

export type LiquidSectionHtml = { html: string; tag: string; id: string; className: string }

/** Which of a template's sections one call renders, and where the fold is. */
export type LiquidPart = {
  /** Top-level positions in the template's content this call renders: `start` up to `end`. */
  start: number
  end: number
  /** Sections at this position or later are below the fold (`liquid-fold.ts`). */
  fold: number
}

/** Every section, none below the fold (header and footer groups, theme previews). */
export const WHOLE_TEMPLATE: LiquidPart = { start: 0, end: Infinity, fold: Infinity }

/** Links for the theme stylesheets of the product section `MainProduct` replaces. */
export async function mainProductStylesheetUrls(storeId: string, themeId: string) {
  const theme = await importedTheme(storeId, themeId)
  if (!theme) return []
  return mainProductStylesheets(theme.bundle).map(
    (file) => `/theme-assets/${themeId}/${file}?v=${theme.bundle.assets.get(file)}`,
  )
}

/** A video poster's width when it has variants (a merchant's pick): a full-bleed hero. */
const POSTER_PICK_WIDTH = 1280

/**
 * Each video's poster address from Files, keyed by the video's original address and by its
 * smaller copy's (the section HTML holds the copy by then).
 */
async function posterAddresses(
  tx: StoreTx,
  sources: readonly string[],
  small: ReadonlyMap<string, string> | null,
): Promise<Map<string, string>> {
  const found = await postersByVideoUrl(tx, sources)
  const out = new Map<string, string>()
  for (const [video, poster] of found) {
    const url = pickVariantUrls(poster, POSTER_PICK_WIDTH).webp ?? poster.url
    out.set(video, url)
    const copy = small?.get(video)
    if (copy) out.set(copy, url)
  }
  return out
}

/** The footer's "Cookie settings" link, added after the cache (`./liquid-cookie-settings.ts`). */
const withCookieLink = (p: { cookieLink: boolean }, html: string) =>
  p.cookieLink ? withCookieSettingsLink(html, privacyContent.cookieSettings) : html

/**
 * The `LiquidSection`s of a template within `part`, keyed by Puck id: from the cache, or
 * rendered now (all the missing ones in one transaction). Null when `themeId` is not an
 * imported theme.
 */
export async function renderLiquidSections(
  storeId: string,
  themeId: string,
  key: string,
  content: { type: string; props: Record<string, unknown> }[],
  part: LiquidPart = WHOLE_TEMPLATE,
): Promise<Map<string, LiquidSectionHtml> | null> {
  const theme = await importedTheme(storeId, themeId)
  if (!theme) return null
  // Placement counts every Liquid section of the template (`section.index`), drawn or not.
  const liquidItems = content
    .flatMap((item, position) => (item.type === 'LiquidSection' ? [{ item, position }] : []))
    .map((entry, index) => ({ ...entry, index }))
  const inPart = liquidItems.filter(({ position }) => position >= part.start && position < part.end)
  if (inPart.length === 0) return new Map()
  const scope = await requestScope(storeId)
  const cacheKey = cacheScope(scope, themeId, theme.bundle)
  const location = LOCATION[key] ?? 'template'
  const placed = inPart.map(({ item, position, index }) => {
    const type = typeof item.props.sectionType === 'string' ? item.props.sectionType : ''
    const schema = theme.bundle.sections.get(type)?.schema ?? null
    const section = liquidPlacement(item.props, schema, location, index)
    const belowFold = position >= part.fold
    return {
      id: String(item.props.id),
      type,
      section,
      belowFold,
      wrapper: sectionWrapper(theme.bundle, section),
      cookieLink: showsCookieSettingsLink(type, item.props),
      key: cacheKey ? sectionCacheKey(cacheKey, { section, belowFold }) : null,
    }
  })

  const out = new Map<string, LiquidSectionHtml>()
  const missing: typeof placed = []
  for (const p of placed) {
    const hit = p.key ? await peekForStore<CachedLiquid>(storeId, p.key) : undefined
    if (
      hit &&
      (await servable(
        hit,
        () => cartIsEmpty(storeId),
        () => signedOut(storeId),
      ))
    ) {
      // A hit cached before covers left the hero gets the same treatment (it is idempotent).
      const html = p.belowFold ? hit.html : withoutVideoCovers(hit.html)
      out.set(p.id, { html: finish(withCookieLink(p, html), scope), ...p.wrapper })
    } else missing.push(p)
  }
  if (missing.length === 0) return out

  // The cart is read before the transaction: a second connection taken inside one could wait
  // on a pool that busy requests have filled.
  const cart = toLiquidCart(await requestCart(storeId), scope.pricing)
  const customer = await currentCustomer(storeId)
  // One page's misses share a slot in the render queue (`render-slot.ts`); once the visitor has
  // gone, the sections left are not drawn.
  const rendered = await withRenderSlot((signal) =>
    inStore(storeId, async (tx) => {
      const live = await tracedContext(tx, storeId, themeId, theme, scope, cart, customer)
      const done: { p: (typeof placed)[number]; html: string; trace: RenderTrace }[] = []
      // The page's first video is its LCP: the first above-the-fold template section with one.
      const videoBefore = (p: (typeof placed)[number]) =>
        placed
          .slice(0, placed.indexOf(p))
          .some((q) =>
            /<video\b/i.test(out.get(q.id)?.html ?? done.find((d) => d.p === q)?.html ?? ''),
          )
      for (const p of missing) {
        if (signal?.aborted) throw new RenderAbortedError()
        const trace = live.start()
        const html = await renderLiquidSection(live.ctx, p.section, (err) => {
          trace.failed = true
          logger.error('liquid section failed to render', { storeId, section: p.type, error: err })
        })
        if (live.ctx.cache.missing) trace.failed = true
        // The theme's own `<script>` tags carry the nonce (written at parse time,
        // `nonceThemeScripts` in core); a script that came in with data never does. Its deferred
        // and module scripts wait for React (`./liquid-defer.ts`); a cookie banner shows with
        // the first paint (`./liquid-consent-reveal.ts`).
        // A video from Files plays its smaller copy when the worker has made one
        // (`@commerce/core` compact-video); one query, only for a section with videos.
        const sources = videoSources(html)
        const small = sources.length ? await compactVideosByUrl(tx, sources) : null
        const sized = small ? withCompactVideos(html, small) : html
        const posters = sources.length ? await posterAddresses(tx, sources, small) : null
        const parked = revealConsentEarly(deferThemeScripts(sized), NONCE_MARK)
        // Above the fold, a hero video plays without its cover (`./liquid-video-cover.ts`), and
        // a video without a poster gets its first frame from Files (`./liquid-video-poster.ts`),
        // the page's first one eagerly. Indentation out, once, before the cache keeps it
        // (`./liquid-compact.ts`).
        const folded = p.belowFold ? belowTheFold(parked) : withoutVideoCovers(parked)
        const lcp = location === 'template' && part.start === 0 && !p.belowFold && !videoBefore(p)
        const placedHtml = compactThemeHtml(
          posters ? withVideoPosters(folded, posters, { lcp, nonceMark: NONCE_MARK }) : folded,
        )
        done.push({ p, html: placedHtml, trace })
      }
      return done
    }),
  )
  for (const { p, html, trace } of rendered) {
    out.set(p.id, { html: finish(withCookieLink(p, html), scope), ...p.wrapper })
    if (p.key && keepable(trace, cart.itemCount === 0, customer !== null)) {
      const entry: CachedLiquid = { html, cart: trace.cart, customer: trace.customer }
      await rememberForStore(storeId, p.key, entry, {
        size: html.length,
        ttlMs: renderTtl(trace, CACHE_TTL_MS),
      })
    }
  }
  return out
}

export type LiquidLayout = Awaited<ReturnType<typeof renderLiquidLayout>> & {
  fontsHref: string | null
}

type CachedLayout = { layout: LiquidLayout } & CachedReads

/** `finish` over every HTML part of a layout. */
function layoutWithNonce(layout: LiquidLayout, scope: RequestScope): LiquidLayout {
  return {
    ...layout,
    head: finish(layout.head, scope),
    beforeHeader: finish(layout.beforeHeader, scope),
    afterFooter: finish(layout.afterFooter, scope),
  }
}

/**
 * The parts of the theme's `layout/theme.liquid` the store layout draws around `<main>`, for
 * `themeId` (the verified preview's, else the live one). Null for our own themes.
 */
export async function liquidLayoutFor(
  storeId: string,
  themeId: string,
): Promise<LiquidLayout | null> {
  const theme = await importedTheme(storeId, themeId)
  if (!theme) return null
  const scope = await requestScope(storeId)
  const cacheKey = cacheScope(scope, themeId, theme.bundle)
  const key = cacheKey ? layoutCacheKey(cacheKey) : null
  const hit = key ? await peekForStore<CachedLayout>(storeId, key) : undefined
  if (
    hit &&
    (await servable(
      hit,
      () => cartIsEmpty(storeId),
      () => signedOut(storeId),
    ))
  ) {
    return layoutWithNonce(hit.layout, scope)
  }

  const cart = toLiquidCart(await requestCart(storeId), scope.pricing)
  const customer = await currentCustomer(storeId)
  const { layout, trace } = await withRenderSlot(() =>
    inStore(storeId, async (tx) => {
      const live = await tracedContext(tx, storeId, themeId, theme, scope, cart, customer)
      const trace = live.start()
      const parts = await renderLiquidLayout(live.ctx, (err) => {
        trace.failed = true
        logger.error('liquid layout failed to render', { storeId, error: err })
      })
      if (live.ctx.cache.missing) trace.failed = true
      const layout: LiquidLayout = {
        ...parts,
        // One request for the head's run of theme stylesheets (`theme-css.ts`).
        // The product page's gallery is our AVIF-first picture: its preload asks for AVIF too.
        head: bundleThemeStylesheets(
          compactThemeHtml(
            deferThemeScripts(
              scope.template === 'product' ? avifImagePreloads(parts.head) : parts.head,
            ),
          ),
        ),
        beforeHeader: compactThemeHtml(deferThemeScripts(parts.beforeHeader)),
        afterFooter: compactThemeHtml(deferThemeScripts(parts.afterFooter)),
        fontsHref: googleFontsHref(parts.fonts),
      }
      return { layout, trace }
    }),
  )
  if (key && keepable(trace, cart.itemCount === 0, customer !== null)) {
    const entry: CachedLayout = { layout, cart: trace.cart, customer: trace.customer }
    await rememberForStore(storeId, key, entry, {
      size: layout.head.length + layout.beforeHeader.length + layout.afterFooter.length,
      ttlMs: renderTtl(trace, CACHE_TTL_MS),
    })
  }
  return layoutWithNonce(layout, scope)
}

/** Theme layout attributes (`class`, `data-*`, `lang`) as React props; handlers and styles dropped. */
export function reactAttrs(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') || k === 'style') continue
    out[k === 'class' ? 'className' : k === 'tabindex' ? 'tabIndex' : k] = v
  }
  return out
}
