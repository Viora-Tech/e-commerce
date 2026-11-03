import 'server-only'
import { renderThemeCards, type ThemeCardSection } from '@commerce/core'
import { logger } from '@commerce/observability/logging'
import { headers } from 'next/headers'
import { currentCustomer } from './customer-session'
import { type CachedLiquid, keepable, renderTtl, sectionCacheKey, servable } from './liquid-cache'
import { toLiquidCart } from './liquid-cart'
import { deferThemeScripts } from './liquid-defer'
import {
  cacheScope,
  finish,
  importedTheme,
  requestScope,
  signedOut,
  tracedContext,
} from './liquid-theme'
import { cartIsEmpty, requestCart } from './request-cart'
import { CACHE_TTL_MS, peekForStore, rememberForStore } from './store-cache'
import { inStore } from './store-context'
import { readPreview } from './storefront-gate'
import { liveThemeId } from './template-render'

/** The theme's own product cards for a collection grid (`renderThemeCards` in core). */
export type LiquidCards = { head: string; cards: string[] }

type CardsInput = { handles: string[]; sections?: ThemeCardSection[] | undefined }

/**
 * The imported theme's product card for each handle, cached like a section (`liquid-theme.ts`);
 * null when `themeId` is not an imported theme, it has no card snippet, or the render failed.
 */
async function renderLiquidCards(
  storeId: string,
  themeId: string,
  input: CardsInput,
): Promise<LiquidCards | null> {
  const theme = await importedTheme(storeId, themeId)
  if (!theme || input.handles.length === 0) return null
  const scope = await requestScope(storeId)
  const scoped = cacheScope(scope, themeId, theme.bundle)
  const key = scoped ? sectionCacheKey(scoped, { cards: input }) : null
  const out = (html: string): LiquidCards => {
    const cards = JSON.parse(html) as LiquidCards
    return { head: finish(cards.head, scope), cards: cards.cards.map((c) => finish(c, scope)) }
  }
  const hit = key ? await peekForStore<CachedLiquid>(storeId, key) : undefined
  const fresh = hit
    ? await servable(
        hit,
        () => cartIsEmpty(storeId),
        () => signedOut(storeId),
      )
    : false
  if (hit && fresh) return hit.html ? out(hit.html) : null
  const cart = toLiquidCart(await requestCart(storeId), scope.pricing)
  const customer = await currentCustomer(storeId)
  const { cards, trace } = await inStore(storeId, async (tx) => {
    const live = await tracedContext(tx, storeId, themeId, theme, scope, cart, customer)
    const trace = live.start()
    const cards = await renderThemeCards(live.ctx, input, (err) => {
      trace.failed = true
      logger.error('theme product cards failed to render', { storeId, error: err })
    })
    if (live.ctx.cache.missing) trace.failed = true
    return { cards, trace }
  })
  // No card (a failed render) is kept too, briefly (renderTtl): the next shopper does not wait.
  const html = cards
    ? JSON.stringify({
        head: deferThemeScripts(cards.head),
        cards: cards.cards.map(deferThemeScripts),
      })
    : ''
  if (key && keepable(trace, cart.itemCount === 0, customer !== null)) {
    const entry: CachedLiquid = { html, cart: trace.cart, customer: trace.customer }
    await rememberForStore(storeId, key, entry, {
      size: html.length,
      ttlMs: renderTtl(trace, CACHE_TTL_MS),
    })
  }
  return html ? out(html) : null
}

/**
 * On a store whose live (or previewed) theme is an imported Shopify theme: that theme's own
 * product card for each handle of a collection grid (#1047). Null on our own themes, and when the
 * theme has no card snippet or it failed to render: the grid draws our cards then.
 */
export async function themeCardsFor(
  storeId: string,
  input: CardsInput,
): Promise<LiquidCards | null> {
  const preview = readPreview(storeId, (await headers()).get('x-theme-preview'))
  const themeId = preview?.themeId ?? (await liveThemeId(storeId))
  return themeId ? renderLiquidCards(storeId, themeId, input) : null
}
